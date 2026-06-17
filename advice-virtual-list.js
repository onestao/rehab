// @ts-nocheck
(function () {
    const DEFAULT_SEGMENT_SIZE = 100;
    const DEFAULT_CACHE_CAPACITY = 6;
    const DEFAULT_ITEM_HEIGHT = 132;

    function nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
        return Date.now();
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeId(value) {
        return String(value || '').trim();
    }

    function recordId(record) {
        return normalizeId(record && record.id);
    }

    function uniqueIds(ids) {
        const seen = new Set();
        const out = [];
        (Array.isArray(ids) ? ids : []).forEach(id => {
            const key = normalizeId(id);
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(key);
        });
        return out;
    }

    function activeRecords(records) {
        return (Array.isArray(records) ? records : []).filter(record => record && !record.deleted && recordId(record));
    }

    class LRUSegmentCache {
        constructor(options = {}) {
            this.segmentSize = Math.max(1, Number(options.segmentSize || DEFAULT_SEGMENT_SIZE));
            this.capacity = clamp(Math.round(Number(options.capacity || DEFAULT_CACHE_CAPACITY)), 4, 8);
            this.segments = new Map();
            this.records = new Map();
        }

        segmentIdForIndex(index) {
            return Math.floor(Math.max(0, Number(index) || 0) / this.segmentSize);
        }

        has(segmentId) {
            return this.segments.has(Number(segmentId));
        }

        get(segmentId) {
            const key = Number(segmentId);
            if (!this.segments.has(key)) return null;
            const entry = this.segments.get(key);
            this.segments.delete(key);
            this.segments.set(key, entry);
            return entry.records;
        }

        set(segmentId, records = [], ids = null) {
            const key = Number(segmentId);
            const cleanIds = ids ? uniqueIds(ids) : null;
            const byId = new Map();
            activeRecords(records).forEach(record => byId.set(recordId(record), record));
            const ordered = cleanIds
                ? cleanIds.map(id => byId.get(id)).filter(Boolean)
                : Array.from(byId.values());
            ordered.forEach(record => this.records.set(recordId(record), record));
            if (this.segments.has(key)) this.segments.delete(key);
            this.segments.set(key, { ids: cleanIds || ordered.map(recordId), records: ordered });
            this._evictIfNeeded();
            return ordered;
        }

        seedFromRecords(records = [], idsRef = [], startIndex = 0) {
            const ids = Array.isArray(idsRef) && idsRef.length
                ? idsRef
                : activeRecords(records).map(recordId);
            const byId = new Map();
            activeRecords(records).forEach(record => byId.set(recordId(record), record));
            const groups = new Map();
            ids.forEach((id, offset) => {
                const record = byId.get(id);
                if (!record) return;
                const index = Math.max(0, startIndex + offset);
                const segmentId = this.segmentIdForIndex(index);
                if (!groups.has(segmentId)) groups.set(segmentId, { ids: [], records: [] });
                groups.get(segmentId).ids.push(id);
                groups.get(segmentId).records.push(record);
            });
            groups.forEach((entry, segmentId) => this.set(segmentId, entry.records, entry.ids));
            activeRecords(records).forEach(record => this.records.set(recordId(record), record));
        }

        getRecordById(id) {
            return this.records.get(normalizeId(id)) || null;
        }

        getRecordByIndex(index, idsRef = []) {
            return this.getRecordById(idsRef[Math.max(0, Number(index) || 0)]);
        }

        upsert(record) {
            const id = recordId(record);
            if (!id) return;
            if (record.deleted) {
                this.deleteId(id);
                return;
            }
            this.records.set(id, record);
            this.segments.forEach(entry => {
                const idx = entry.ids.indexOf(id);
                if (idx >= 0) entry.records[idx] = record;
            });
        }

        deleteId(id) {
            const key = normalizeId(id);
            if (!key) return;
            this.records.delete(key);
            this.segments.forEach(entry => {
                const idx = entry.ids.indexOf(key);
                if (idx < 0) return;
                entry.ids.splice(idx, 1);
                entry.records.splice(idx, 1);
            });
        }

        clear() {
            this.segments.clear();
            this.records.clear();
        }

        keys() {
            return Array.from(this.segments.keys());
        }

        _evictIfNeeded() {
            while (this.segments.size > this.capacity) {
                const oldest = this.segments.keys().next().value;
                const entry = this.segments.get(oldest);
                this.segments.delete(oldest);
                (entry?.ids || []).forEach(id => {
                    const stillCached = Array.from(this.segments.values()).some(segment => segment.ids.includes(id));
                    if (!stillCached) this.records.delete(id);
                });
            }
        }
    }

    class LagSmoothingFilter {
        constructor(options = {}) {
            this.minBudget = Math.max(0, Number(options.minBudget ?? 1));
            this.maxBudget = Math.max(this.minBudget, Number(options.maxBudget ?? 4));
            this.decayDelayMs = Math.max(0, Number(options.decayDelayMs ?? 900));
            this.decayStepMs = Math.max(16, Number(options.decayStepMs ?? 240));
            this.fastBudget = this.minBudget;
            this.slowBudget = this.minBudget;
            this.lastIncreaseAt = 0;
            this.lastDecayAt = 0;
            this.lastObservedLag = 0;
        }

        observeLag(lag = 0, at = nowMs()) {
            const needed = clamp(Math.ceil(Math.max(0, Number(lag) || 0)), this.minBudget, this.maxBudget);
            this.lastObservedLag = needed;
            if (needed > this.slowBudget) {
                this.fastBudget = needed;
                this.slowBudget = needed;
                this.lastIncreaseAt = at;
                return this.getBudget();
            }
            this.fastBudget = Math.max(this.minBudget, needed);
            if (needed < this.slowBudget
                && at - this.lastIncreaseAt >= this.decayDelayMs
                && at - this.lastDecayAt >= this.decayStepMs) {
                this.slowBudget = Math.max(needed, this.slowBudget - 1);
                this.lastDecayAt = at;
            }
            return this.getBudget();
        }

        getBudget() {
            return Math.max(this.fastBudget, this.slowBudget);
        }
    }

    class QueryPlanningLayer {
        constructor(options = {}) {
            this.segmentSize = Math.max(1, Number(options.segmentSize || DEFAULT_SEGMENT_SIZE));
            this.cache = options.cache || new LRUSegmentCache({ segmentSize: this.segmentSize });
            this.getActiveIds = typeof options.getActiveIds === 'function' ? options.getActiveIds : () => [];
            this.fetchByIds = typeof options.fetchByIds === 'function' ? options.fetchByIds : async () => [];
            this.prefetchRadius = Math.max(0, Number(options.prefetchRadius ?? 2));
            this.missThreshold = Math.max(0, Number(options.missThreshold ?? 3));
            this.cooldownMs = Math.max(0, Number(options.cooldownMs ?? 700));
            this.recoveryMs = Math.max(0, Number(options.recoveryMs ?? 1200));
            this.missWindowMs = Math.max(100, Number(options.missWindowMs ?? 800));
            this.pending = new Map();
            this.onSegmentLoaded = typeof options.onSegmentLoaded === 'function' ? options.onSegmentLoaded : null;
            this.state = 'NORMAL';
            this.missCount = 0;
            this.lastMissAt = 0;
            this.lastEmergencyAt = -Infinity;
            this.recoverySince = 0;
            this.emergencyCount = 0;
        }

        segmentIdForIndex(index) {
            return Math.floor(Math.max(0, Number(index) || 0) / this.segmentSize);
        }

        indexesForSegment(segmentId) {
            const start = Math.max(0, Number(segmentId) || 0) * this.segmentSize;
            return { start, end: start + this.segmentSize };
        }

        loadSegment(segmentId, reason = 'prefetch') {
            const key = Number(segmentId);
            if (!Number.isFinite(key) || key < 0) return Promise.resolve([]);
            const activeIdsRef = this.getActiveIds();
            const { start, end } = this.indexesForSegment(key);
            const ids = activeIdsRef.slice(start, end);
            if (!ids.length) {
                this.cache.set(key, [], []);
                return Promise.resolve([]);
            }
            if (this.cache.has(key)) return Promise.resolve(this.cache.get(key) || []);
            if (this.pending.has(key)) return this.pending.get(key);
            const job = Promise.resolve(this.fetchByIds(ids, { segmentId: key, reason }))
                .then(records => {
                    const cached = this.cache.set(key, records || [], ids);
                    this.onSegmentLoaded?.({ segmentId: key, reason, records: cached });
                    return cached;
                })
                .catch(err => {
                    console.warn('[advice-virtual] segment load failed', err);
                    return [];
                })
                .finally(() => {
                    this.pending.delete(key);
                    this._recoverIfQuiet(nowMs());
                });
            this.pending.set(key, job);
            return job;
        }

        prefetchAround(rangeOrIndex, radius = this.prefetchRadius, reason = 'prefetch') {
            const range = typeof rangeOrIndex === 'object'
                ? rangeOrIndex
                : { startIndex: Number(rangeOrIndex) || 0, endIndex: Number(rangeOrIndex) || 0 };
            const startSegment = this.segmentIdForIndex(range.startIndex ?? range.start ?? 0);
            const endSegment = this.segmentIdForIndex(range.endIndex ?? range.end ?? range.startIndex ?? 0);
            const jobs = [];
            for (let segmentId = startSegment - radius; segmentId <= endSegment + radius; segmentId++) {
                if (segmentId >= 0) jobs.push(this.loadSegment(segmentId, reason));
            }
            return Promise.all(jobs);
        }

        recordMiss(index) {
            const at = nowMs();
            if (at - this.lastMissAt > this.missWindowMs) this.missCount = 0;
            this.missCount += 1;
            this.lastMissAt = at;
            if (this.state === 'RECOVERY') this._recoverIfQuiet(at);
            if (this.missCount <= this.missThreshold || at - this.lastEmergencyAt <= this.cooldownMs) {
                return false;
            }
            this.state = 'DEGRADED';
            this.emergencyCount += 1;
            this.lastEmergencyAt = at;
            this.prefetchAround({ startIndex: index, endIndex: index }, 1, 'emergency')
                .finally(() => {
                    this.state = 'RECOVERY';
                    this.recoverySince = nowMs();
                });
            return true;
        }

        telemetry() {
            return {
                state: this.state,
                missCount: this.missCount,
                emergencyCount: this.emergencyCount,
                lastEmergencyAt: this.lastEmergencyAt,
                cachedSegments: this.cache.keys(),
                pendingSegments: Array.from(this.pending.keys())
            };
        }

        _recoverIfQuiet(at) {
            if (this.state !== 'RECOVERY') return;
            if (at - this.recoverySince >= this.recoveryMs) {
                this.state = 'NORMAL';
                this.missCount = 0;
            }
        }
    }

    class AdviceVirtualStore {
        constructor(options = {}) {
            this.segmentSize = Math.max(1, Number(options.segmentSize || DEFAULT_SEGMENT_SIZE));
            this.cache = options.cache || new LRUSegmentCache({
                capacity: options.cacheCapacity || DEFAULT_CACHE_CAPACITY,
                segmentSize: this.segmentSize
            });
            this.lagFilter = options.lagFilter || new LagSmoothingFilter(options.lagOptions || {});
            this.state = { mode: 'recent', version: 0, activeIdsRef: [] };
            this.majorVersionStep = Math.max(this.lagFilter.maxBudget + 1, Number(options.majorVersionStep || 8));
            this.queryPlanner = new QueryPlanningLayer({
                segmentSize: this.segmentSize,
                cache: this.cache,
                getActiveIds: () => this.state.activeIdsRef,
                fetchByIds: options.fetchByIds,
                prefetchRadius: options.prefetchRadius,
                missThreshold: options.missThreshold,
                cooldownMs: options.cooldownMs,
                recoveryMs: options.recoveryMs,
                onSegmentLoaded: options.onSegmentLoaded
            });
        }

        get mode() { return this.state.mode; }
        get version() { return this.state.version; }
        get activeIdsRef() { return this.state.activeIdsRef; }

        setActiveIds(ids = [], mode = this.state.mode, seedRecords = []) {
            const nextIds = uniqueIds(ids);
            const nextMode = mode || this.state.mode || 'recent';
            const step = nextMode !== this.state.mode ? this.majorVersionStep : 1;
            this.state = {
                mode: nextMode,
                version: this.state.version + step,
                activeIdsRef: nextIds.slice()
            };
            if (seedRecords && seedRecords.length) this.cache.seedFromRecords(seedRecords, nextIds, 0);
            return this.snapshot();
        }

        setActiveRecords(records = [], mode = this.state.mode) {
            const clean = activeRecords(records);
            return this.setActiveIds(clean.map(recordId), mode, clean);
        }

        upsertRecord(record) {
            const id = recordId(record);
            if (!id) return this.snapshot();
            this.cache.upsert(record);
            const ids = this.state.activeIdsRef.slice();
            const idx = ids.indexOf(id);
            if (record.deleted) {
                if (idx >= 0) ids.splice(idx, 1);
            } else if (idx < 0 && this.state.mode !== 'search') {
                ids.push(id);
            }
            this.state = { ...this.state, version: this.state.version + 1, activeIdsRef: ids };
            return this.snapshot();
        }

        deleteId(id) {
            const key = normalizeId(id);
            if (!key) return this.snapshot();
            this.cache.deleteId(key);
            const ids = this.state.activeIdsRef.filter(item => item !== key);
            this.state = { ...this.state, version: this.state.version + 1, activeIdsRef: ids };
            return this.snapshot();
        }

        getItem(index, renderVersion = this.state.version) {
            const lag = this.state.version - Number(renderVersion || 0);
            const budget = this.lagFilter.observeLag(lag);
            if (!Number.isFinite(lag) || lag < 0 || lag > budget) {
                return { skeleton: true, stale: true, id: `skel-stale-${index}` };
            }
            const id = this.state.activeIdsRef[Math.max(0, Number(index) || 0)];
            if (!id) return { skeleton: true, id: `skel-${index}` };
            const record = this.cache.getRecordById(id);
            if (record && !record.deleted) return record;
            this.queryPlanner.recordMiss(index);
            return { skeleton: true, id: `skel-${index}`, sourceId: id };
        }

        prefetchAround(rangeOrIndex, radius, reason) {
            return this.queryPlanner.prefetchAround(rangeOrIndex, radius, reason);
        }

        setSegmentLoadedCallback(callback) {
            this.queryPlanner.onSegmentLoaded = typeof callback === 'function' ? callback : null;
        }

        snapshot() {
            return {
                mode: this.state.mode,
                version: this.state.version,
                activeIdsRef: this.state.activeIdsRef.slice(),
                telemetry: this.queryPlanner.telemetry()
            };
        }
    }

    function createSearchWorkerClient(options = {}) {
        let worker = null;
        let requestSeq = 0;
        const pending = new Map();
        const workerUrl = options.workerUrl || 'advice-search.worker.js';

        function ensureWorker() {
            if (worker || typeof Worker === 'undefined') return worker;
            try {
                worker = new Worker(workerUrl);
                worker.onmessage = event => {
                    const msg = event.data || {};
                    const payload = msg.payload || {};
                    if (msg.type !== 'SEARCH_RESULT') return;
                    const req = pending.get(payload.requestId);
                    if (!req) return;
                    pending.delete(payload.requestId);
                    req.resolve(payload);
                };
                worker.onerror = err => {
                    pending.forEach(req => req.reject(err));
                    pending.clear();
                };
            } catch (err) {
                console.warn('[advice-virtual] search worker unavailable', err);
                worker = null;
            }
            return worker;
        }

        function post(type, payload = {}) {
            const target = ensureWorker();
            if (!target) return false;
            target.postMessage({ type, payload });
            return true;
        }

        return {
            init(snapshot = []) {
                post('INIT', { snapshot });
            },
            search(query = '', limit = 20) {
                const target = ensureWorker();
                if (!target) return Promise.reject(new Error('search worker unavailable'));
                const requestId = ++requestSeq;
                target.postMessage({ type: 'SEARCH', payload: { requestId, query, limit } });
                return new Promise((resolve, reject) => {
                    pending.set(requestId, { resolve, reject });
                    setTimeout(() => {
                        if (!pending.has(requestId)) return;
                        pending.delete(requestId);
                        reject(new Error('search worker timeout'));
                    }, 5000);
                });
            },
            add(record) { post('ADD', { record }); },
            update(record) { post('UPDATE', { record }); },
            remove(id) { post('REMOVE', { id }); }
        };
    }

    function defaultSkeletonHtml(item) {
        const stale = item && item.stale;
        return `<div class="advice-bubble assistant advice-virtual-skeleton ${stale ? 'is-stale' : ''}" aria-busy="true">
            <div class="advice-virtual-shimmer"></div>
            <div class="advice-virtual-shimmer short"></div>
        </div>`;
    }

    class AdviceVirtualListController {
        constructor(host, options = {}) {
            this.host = host;
            this.controllerId = `advice-virtual-${Math.random().toString(36).slice(2)}`;
            this.cleanup = null;
            this.virtualizer = null;
            this.pendingSegmentRender = false;
            this.segmentLoadedHandler = info => {
                this.options.onSegmentLoaded?.(info);
                this.scheduleRender();
            };
            this.setOptions(options);
            this._mount();
        }

        setOptions(options = {}) {
            this.options = { ...(this.options || {}), ...options };
            this.store = this.options.store;
            this.renderVersion = this.store?.version || 0;
            this.estimateSize = Math.max(40, Number(this.options.initialHeight || DEFAULT_ITEM_HEIGHT));
            this._bindSegmentLoadedCallback();
            if (this.virtualizer) {
                this.virtualizer.setOptions(this._virtualizerOptions());
                this.virtualizer._willUpdate();
                this.render();
                this._notifyRange(this.virtualizer);
            }
        }

        _bindSegmentLoadedCallback() {
            if (!this.store) return;
            if (typeof this.store.setSegmentLoadedCallback === 'function') {
                this.store.setSegmentLoadedCallback(this.segmentLoadedHandler);
            } else if (this.store.queryPlanner) {
                this.store.queryPlanner.onSegmentLoaded = this.segmentLoadedHandler;
            }
        }

        scheduleRender() {
            if (this.pendingSegmentRender) return;
            this.pendingSegmentRender = true;
            const flush = () => {
                this.pendingSegmentRender = false;
                if (this.virtualizer) {
                    this.virtualizer._willUpdate?.();
                    this.render(this.virtualizer);
                    this._notifyRange(this.virtualizer);
                } else {
                    this.renderFallback();
                }
            };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
            else setTimeout(flush, 0);
        }

        _mount() {
            this.host.dataset.adviceVirtualList = 'true';
            this.host.dataset.adviceVirtualActive = 'true';
            this.host.innerHTML = '<div class="advice-virtual-inner" data-advice-virtual-inner></div>';
            this.inner = this.host.querySelector('[data-advice-virtual-inner]');
            const core = window.VirtualCore;
            if (!core || !core.Virtualizer) {
                this.renderFallback();
                return;
            }
            this.virtualizer = new core.Virtualizer(this._virtualizerOptions());
            this.cleanup = this.virtualizer._didMount();
            this.virtualizer._willUpdate();
            this.render();
            this._notifyRange(this.virtualizer);
        }

        _virtualizerOptions() {
            const core = window.VirtualCore || {};
            const store = this.store;
            const idsRef = store?.activeIdsRef || [];
            return {
                count: idsRef.length,
                getScrollElement: () => this.host,
                estimateSize: () => this.estimateSize,
                overscan: Math.max(4, Number(this.options.overscan || 10)),
                gap: Number(this.options.gap ?? 8),
                getItemKey: index => idsRef[index] || `skel-${store?.version || 0}-${index}`,
                observeElementRect: core.observeElementRect,
                observeElementOffset: core.observeElementOffset,
                scrollToFn: core.elementScroll,
                measureElement: core.measureElement,
                useAnimationFrameWithResizeObserver: true,
                anchorTo: 'end',
                followOnAppend: 'auto',
                onChange: instance => {
                    this.render(instance);
                    this._notifyRange(instance);
                }
            };
        }

        _notifyRange(instance = this.virtualizer) {
            const count = this.store?.activeIdsRef?.length || 0;
            const totalSize = instance?.getTotalSize?.() || this._estimatedTotalSize(count);
            const items = (instance?.getVirtualItems?.() || []);
            const visibleItems = items.length ? items : this._fallbackVirtualItems(count, totalSize);
            if (!visibleItems.length) return;
            const startIndex = visibleItems[0].index;
            const endIndex = visibleItems[visibleItems.length - 1].index;
            this.store?.prefetchAround?.({ startIndex, endIndex }, 2, 'scroll');
            this.options.onRangeChange?.({ startIndex, endIndex });
        }

        _estimatedTotalSize(count = 0) {
            const gap = Number(this.options.gap ?? 8);
            const safeCount = Math.max(0, Number(count) || 0);
            return safeCount * this.estimateSize + Math.max(0, safeCount - 1) * gap;
        }

        _fallbackVirtualItems(count = 0, totalSize = 0) {
            const safeCount = Math.max(0, Number(count) || 0);
            if (!safeCount) return [];
            const gap = Number(this.options.gap ?? 8);
            const stride = this.estimateSize + gap;
            const windowSize = Math.min(safeCount, Math.max(8, Number(this.options.initialWindow || 24)));
            const startIndex = Math.max(0, safeCount - windowSize);
            const maxStart = Math.max(0, (Number(totalSize) || this._estimatedTotalSize(safeCount)) - this.estimateSize);
            return Array.from({ length: windowSize }, (_, offset) => {
                const index = startIndex + offset;
                return {
                    index,
                    key: this.store?.activeIdsRef?.[index] || `fallback-${index}`,
                    size: this.estimateSize,
                    start: Math.min(Math.max(0, index * stride), maxStart),
                    end: Math.min(Math.max(0, index * stride + this.estimateSize), maxStart)
                };
            });
        }

        render(instance = this.virtualizer) {
            if (!this.store) return;
            this.host.dataset.adviceVirtualActive = 'true';
            if (!this.inner || !this.inner.isConnected) {
                this.host.innerHTML = '<div class="advice-virtual-inner" data-advice-virtual-inner></div>';
                this.inner = this.host.querySelector('[data-advice-virtual-inner]');
            }
            const count = this.store.activeIdsRef.length;
            if (!count) {
                this.inner.style.height = 'auto';
                this.inner.innerHTML = this.options.emptyHtml || '';
                return;
            }
            const measuredItems = instance?.getVirtualItems?.() || [];
            const totalSize = Math.max(instance?.getTotalSize?.() || 0, this._estimatedTotalSize(count));
            const virtualItems = measuredItems.length ? measuredItems : this._fallbackVirtualItems(count, totalSize);
            this.inner.style.height = `${Math.max(1, totalSize)}px`;
            this.inner.innerHTML = virtualItems.map(row => {
                const item = this.store.getItem(row.index, this.renderVersion);
                const html = item?.skeleton
                    ? (this.options.renderSkeleton?.(item, row.index) || defaultSkeletonHtml(item))
                    : this.options.renderItem?.(item, row.index, row.index === count - 1, this.options.keyword || '');
                return `<div class="advice-virtual-row" data-index="${row.index}" data-advice-virtual-row style="transform:translateY(${row.start}px)">${html || ''}</div>`;
            }).join('');
            this.inner.querySelectorAll('[data-advice-virtual-row]').forEach(el => {
                instance?.measureElement?.(el);
            });
        }

        renderFallback() {
            if (!this.store) return;
            delete this.host.dataset.adviceVirtualActive;
            const count = this.store.activeIdsRef.length;
            if (!count) {
                this.host.innerHTML = this.options.emptyHtml || '';
                return;
            }
            this.host.innerHTML = this.store.activeIdsRef.map((_, index) => {
                const item = this.store.getItem(index, this.renderVersion);
                if (item?.skeleton) return this.options.renderSkeleton?.(item, index) || defaultSkeletonHtml(item);
                return this.options.renderItem?.(item, index, index === count - 1, this.options.keyword || '') || '';
            }).join('');
        }

        scrollToIndex(index, align = 'start', behavior = 'smooth') {
            this.virtualizer?.scrollToIndex?.(index, { align, behavior });
        }

        destroy() {
            if (typeof this.cleanup === 'function') this.cleanup();
            if (this.store?.queryPlanner?.onSegmentLoaded === this.segmentLoadedHandler) {
                this.store.queryPlanner.onSegmentLoaded = null;
            }
            this.cleanup = null;
            this.virtualizer = null;
            delete this.host.dataset.adviceVirtualActive;
            delete this.host._adviceVirtualController;
        }
    }

    function mountVirtualList(host, options = {}) {
        if (!host) return null;
        if (host._adviceVirtualController) {
            host._adviceVirtualController.setOptions(options);
            return host._adviceVirtualController;
        }
        host._adviceVirtualController = new AdviceVirtualListController(host, options);
        return host._adviceVirtualController;
    }

    window.adviceVirtualList = {
        SEGMENT_SIZE: DEFAULT_SEGMENT_SIZE,
        LRUSegmentCache,
        LagSmoothingFilter,
        QueryPlanningLayer,
        AdviceVirtualStore,
        createStore: options => new AdviceVirtualStore(options),
        createSearchWorkerClient,
        mountVirtualList,
        defaultSkeletonHtml
    };
})();
