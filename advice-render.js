// @ts-nocheck
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(s) {
    return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightKeyword(text, keyword) {
    const safe = escapeHtml(text);
    const kw = String(keyword ?? '').trim();
    if (!kw) return safe;
    const re = new RegExp(escapeRegExp(kw), 'gi');
    return safe.replace(re, m => `<mark class="ai-hit">${m}</mark>`);
}

function highlightRenderedHtml(html, keyword) {
    const kw = String(keyword ?? '').trim();
    if (!kw || typeof document === 'undefined') return String(html ?? '');
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
        const value = node.nodeValue || '';
        if (!value.trim()) return;
        const highlighted = highlightKeyword(value, kw);
        if (highlighted === escapeHtml(value)) return;
        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlighted;
        node.replaceWith(...wrapper.childNodes);
    });
    return template.innerHTML;
}

Object.assign(advicePanel, {
    iconFallbackSrcs(key = 'generic') {
        return window.aiModelVisual.iconFallbackSrcs(key);
    },

    adviceModelIconHtml(visual = {}) {
        const srcs = visual.iconSrcs || [];
        const mark = this.escapeHtml(visual.mark || 'AI');
        if (!srcs.length) return mark;
        const src = srcs[0];
        const fallbacks = srcs.slice(1).map(s => `'${this.escapeHtml(s)}'`).join(',');
        const onerror = fallbacks ? `const a=[${fallbacks}],i=+(this.dataset.fi||0);if(i<a.length){this.dataset.fi=i+1;this.src=a[i]}else{this.onerror=null}` : 'this.onerror=null;';
        return `<img class="advice-model-icon" src="${this.escapeHtml(src)}" alt="" onerror="${onerror}">`;
    },

    adviceModelThemeStyle(visual = {}) {
        const t = visual.theme || {};
        return [
            t.bg ? `--advice-model-bg:${t.bg}` : '',
            t.color ? `--advice-model-color:${t.color}` : '',
            t.markBg ? `--advice-model-mark-bg:${t.markBg}` : ''
        ].filter(Boolean).join(';');
    },

    providerHashHue(key = 'generic') {
        return window.aiModelVisual.hashHue(key);
    },

    modelThemeFor(key = 'generic') {
        return window.aiModelVisual.themeFor(key);
    },

    detectAdviceModelProvider(model = '') {
        return window.aiModelVisual.detect(model);
    },

    adviceModelVisual(model = '', provider = '', iconKey = '') {
        const visual = window.aiModelVisual.resolve({ modelId: model, provider, iconKey });
        this._lastVisual = visual;
        return visual;
    },

    refreshAdviceModelPicker() {
        const picker = document.querySelector('.advice-model-picker');
        const mark = picker?.querySelector('.advice-model-mark');
        if (!picker || !mark) return;
        const select = document.getElementById('adviceModel');
        const selected = select?.value || this.adviceModel || '__current__';
        const option = select?.selectedOptions?.[0];
        const activeModelValue = selected === '__current__' ? ai.cfg.model : (option?.textContent || selected);
        const visual = this.adviceModelVisual(activeModelValue);
        picker.className = `advice-model-picker advice-model-${visual.key}`;
        picker.title = `切换分析模型：${visual.label}`;
        picker.setAttribute('aria-label', `切换分析模型：${visual.label}`);
        const style = this.adviceModelThemeStyle(visual);
        if (style) picker.setAttribute('style', style);
        mark.innerHTML = this.adviceModelIconHtml(visual);
    },
    _parseMarkdownTable(lines, startIdx) {
        const rows = [];
        let i = startIdx;
        let sawTableAfterBlank = false;
        for (; i < lines.length; i++) {
            const t = lines[i].trim();
            if (!t) {
                if (!rows.length) break;
                sawTableAfterBlank = true;
                continue;
            }
            if (!t.startsWith('|') || !t.endsWith('|')) break;
            const cells = t.slice(1, -1).split('|').map(c => c.trim());
            if (rows.length && cells.length !== rows[0].length) break;
            sawTableAfterBlank = false;
            rows.push(cells);
        }
        while (sawTableAfterBlank && i > startIdx && !lines[i - 1].trim()) i--;
        if (rows.length < 3) return null;
        const sepRow = rows[1];
        if (!sepRow.every(c => /^[:\-]+$/.test(c))) return null;
        const header = rows[0];
        const dataRows = rows.slice(2);
        return { header, dataRows, endIdx: i, colCount: header.length, rowCount: dataRows.length };
    },

    _isComparisonTable(table) {
        if (!table || table.colCount < 3) return false;
        const lastCol = table.header.length - 1;
        const verdictHeader = String(table.header[lastCol] || '').trim();
        if (!/^(更优|优选|推荐|判定|判断|结论|结果|胜负|赢家|选择|建议)$/i.test(verdictHeader)) return false;
        const verdictPattern = /胜|负|优|劣|推荐|赢|更好|更佳|最佳|最差|首选|避免|✓|✗|好|差/;
        let matchCount = 0;
        for (const row of table.dataRows) {
            if (verdictPattern.test(row[lastCol] || '')) matchCount++;
        }
        return matchCount >= Math.ceil(table.dataRows.length * 0.6);
    },

    _renderComparisonCards(table, renderInline) {
        const headers = table.header;
        const lastCol = headers.length - 1;
        const itemA = headers[1] || '';
        const itemB = headers[2] || '';

        let winsA = 0;
        let winsB = 0;
        for (const row of table.dataRows) {
            const verdict = row[lastCol] || '';
            if (new RegExp(escapeRegExp(itemA.split('(')[0].split('（')[0].trim().slice(0, 2)), 'i').test(verdict)) winsA++;
            else if (new RegExp(escapeRegExp(itemB.split('(')[0].split('（')[0].trim().slice(0, 2)), 'i').test(verdict)) winsB++;
            else { winsA++; }
        }
        const winnerIdx = winsA >= winsB ? 1 : 2;
        const winnerName = headers[winnerIdx] || '';
        const winnerShort = winnerName.split('(')[0].split('（')[0].trim();
        const score = winnerIdx === 1 ? `${winsA} : ${winsB}` : `${winsB} : ${winsA}`;

        const getWinnerMetrics = () => {
            const metrics = [];
            for (const row of table.dataRows) {
                const dim = row[0] || '';
                const val = row[winnerIdx] || '';
                if (/热量|kcal|蛋白|脂肪|碳水|糖/i.test(dim)) {
                    metrics.push({ label: dim.replace(/\s*含量$/, ''), value: val });
                }
            }
            return metrics.slice(0, 3);
        };
        const winnerMetrics = getWinnerMetrics();
        const summaryParts = [];
        for (const row of table.dataRows) {
            const dim = row[0] || '';
            const val = row[winnerIdx] || '';
            if (summaryParts.length < 2 && !/热量|kcal|蛋白|脂肪|碳水|糖/i.test(dim)) {
                summaryParts.push(renderInline(dim) + '更优');
            }
        }

        const summaryMetricsHtml = winnerMetrics.map(m =>
            `<div class="ai-sc-m"><div class="ai-sc-ml">${renderInline(m.label)}</div><div class="ai-sc-mv">${renderInline(m.value)}</div></div>`
        ).join('');

        const detailCards = table.dataRows.map(row => {
            const title = row[0] || headers[0] || '对比项';
            const verdict = row[lastCol] || '';
            const cells = [];
            for (let c = 1; c < headers.length; c++) {
                const label = headers[c] || '';
                const value = row[c] || '';
                cells.push(`<div class="ai-cc"><div class="ai-cl">${renderInline(label)}</div><div class="ai-cv">${renderInline(value)}</div></div>`);
            }
            return `<div class="ai-cmp-card"><div class="ai-cmp-header"><span class="ai-cmp-vs">${renderInline(title)}</span>${verdict ? `<span class="ai-cmp-verdict win">${renderInline(verdict)}</span>` : ''}</div><div class="ai-cmp-body">${cells.join('')}</div></div>`;
        }).join('');

        return `<div class="ai-cmp-winner"><div class="ai-sc-title">${renderInline(winnerShort)} 更优 <span class="ai-sc-badge">${score} 完胜</span></div>${summaryMetricsHtml ? `<div class="ai-sc-grid">${summaryMetricsHtml}</div>` : ''}<div class="ai-sc-note">${summaryParts.length ? summaryParts.join('；') + '。' : ''}</div></div><div class="ai-cmp-cards">${detailCards}</div>`;
    },

    _renderRawTablePreview(rawTable = '') {
        return `<details class="ai-raw-table-preview"><summary>查看原始表格</summary><pre><code>${rawTable}</code></pre></details>`;
    },

    _renderDimensionCards(table, renderInline) {
        const headers = table.header;
        return table.dataRows.map(row => {
            const title = row[0] || '';
            const cells = [];
            for (let c = 1; c < headers.length; c++) {
                const label = headers[c] || '';
                const value = row[c] || '';
                cells.push(`<div class="ai-cc"><div class="ai-cl">${renderInline(label)}</div><div class="ai-cv">${renderInline(value)}</div></div>`);
            }
            return `<div class="ai-cmp-card"><div class="ai-cmp-header"><span class="ai-cmp-vs">${renderInline(title)}</span></div><div class="ai-cmp-body">${cells.join('')}</div></div>`;
        }).join('');
    },

    _renderKeyValueGrid(table, renderInline) {
        return `<div class="ai-kv-grid">${table.dataRows.map(row => `<div class="ai-kv-item"><div class="ai-kv-k">${renderInline(row[0] || '')}</div><div class="ai-kv-v">${renderInline(row[1] || '')}</div></div>`).join('')}</div>`;
    },

    _renderScrollTable(table, renderInline) {
        const esc = escapeHtml;
        const thead = table.header.map(h => `<th>${renderInline(h)}</th>`).join('');
        const tbody = table.dataRows.map(row => {
            const tds = row.map((cell, ci) => `<td${ci > 0 && /^[\d.]+%?$/.test(cell.trim()) ? ' class="num"' : ''}>${renderInline(cell)}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');
        return `<div class="ai-table-wrap"><table class="ai-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div><div class="ai-table-hint">← 左右滑动查看更多 →</div>`;
    },

    renderAdviceMarkdown(text = '') {
        const escaped = this.escapeHtml(String(text || ''));
        const normalized = escaped.replace(/\r\n?/g, '\n');

        const renderInline = (line) => line
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');

        const lines = normalized.split('\n');
        const out = [];
        let inList = false;
        let inCode = false;

        for (let li = 0; li < lines.length; li++) {
            const line = lines[li].trimEnd();
            if (line.startsWith('```')) {
                if (inList) { out.push('</ul>'); inList = false; }
                out.push(inCode ? '</code></pre>' : '<pre><code>');
                inCode = !inCode;
                continue;
            }
            if (inCode) {
                out.push(`${line}\n`);
                continue;
            }
            if (!line.trim()) {
                if (inList) { out.push('</ul>'); inList = false; }
                continue;
            }
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                if (inList) { out.push('</ul>'); inList = false; }
                const level = heading[1].length;
                out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
                continue;
            }
            const bullet = line.match(/^[-*]\s+(.+)$/);
            if (bullet) {
                if (!inList) { out.push('<ul>'); inList = true; }
                out.push(`<li>${renderInline(bullet[1])}</li>`);
                continue;
            }

            const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
            if (isTableLine) {
                const table = advicePanel._parseMarkdownTable(lines, li);
                if (table) {
                    const rawTable = lines.slice(li, table.endIdx).join('\n');
                    let renderedTable = '';
                    if (inList) { out.push('</ul>'); inList = false; }
                    if (advicePanel._isComparisonTable(table)) {
                        renderedTable = advicePanel._renderComparisonCards(table, renderInline);
                    } else if (table.colCount === 2 && table.rowCount <= 8) {
                        renderedTable = advicePanel._renderKeyValueGrid(table, renderInline);
                    } else if (table.colCount <= 4 && table.rowCount <= 6) {
                        renderedTable = `<div class="ai-cmp-cards">${advicePanel._renderDimensionCards(table, renderInline)}</div>`;
                    } else {
                        renderedTable = advicePanel._renderScrollTable(table, renderInline);
                    }
                    out.push(`${renderedTable}${advicePanel._renderRawTablePreview(rawTable)}`);
                    li = table.endIdx - 1;
                    continue;
                }
            }

            if (inList) { out.push('</ul>'); inList = false; }
            out.push(`<p>${renderInline(line)}</p>`);
        }

        if (inList) out.push('</ul>');
        if (inCode) out.push('</code></pre>');
        return out.join('');
    },
    scheduleAdviceStreamScroll(force = false) {
        if (this._adviceUserScrollPaused) return;
        if (!force && !this._adviceFollowStream) return;
        if (this._adviceScrollRaf) return;
        this._adviceScrollRaf = requestAnimationFrame(() => {
            this._adviceScrollRaf = 0;
            if (this._adviceUserScrollPaused) return;
            this.scrollAdviceToLatest(force || !!this._adviceFollowStream, 'auto');
        });
    },

    scrollAdviceToLatest(force = false, behavior = force ? 'smooth' : 'auto') {
        const list = this._adviceMessageList?.()
            || document.querySelector('.advice-chat-list')
            || document.querySelector('#ai-coach .ai-msg-list');
        if (list) {
            const scroller = this._adviceScrollContainer?.() || list;
            const scrollTop = this._adviceCurrentScrollY?.(scroller) ?? (scroller.scrollTop || 0);
            const maxScroll = this._adviceMaxScrollY?.(scroller) ?? Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            const distance = maxScroll - scrollTop;
            if (force || distance < 180 || this._adviceFollowStream) {
                if (!force && this._adviceUserScrollPaused) return;
                const isDoc = scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;
                const scrollable = isDoc || (getComputedStyle(scroller).overflowY !== 'visible' && scroller.scrollHeight > scroller.clientHeight + 2);
                if (scrollable) {
                    this._adviceSetScrollY?.(scroller, maxScroll, behavior !== 'auto');
                    return;
                }
                const latest = list.querySelector('[data-advice-latest="true"]') || list.lastElementChild;
                latest?.scrollIntoView({ block: 'end', behavior });
            }
        }
    },

    renderAdviceMessages(messages, hiddenCount = 0) {
        const currentKeyword = String(this.adviceSearchQuery || '').trim();
        if (!messages.length) {
            return currentKeyword
                ? '<div class="empty-state advice-empty"><span class="material-symbols-rounded">search_off</span><p>没有匹配的聊天记录</p></div>'
                : '<div class="empty-state advice-empty"><span class="material-symbols-rounded">forum</span><p>还没有 AI 建议，选择下方快捷问题开始</p></div>';
        }
        const olderNotice = hiddenCount > 0
            ? `<div class="advice-history-window"><button type="button" onclick="data.expandAdviceRenderWindow?.()"><span class="material-symbols-rounded">expand_less</span> 加载更早 ${hiddenCount} 条消息</button><button type="button" onclick="data.toggleAdviceSearch?.()"><span class="material-symbols-rounded">manage_search</span> 搜索归档</button></div>`
            : '';
        const groups = messages.reduce((acc, msg, idx) => {
            const date = this.logicalDateKey(this.parseHistoryDate(msg.at));
            if (!acc[date]) acc[date] = [];
            acc[date].push({ ...msg, idx: Number.isInteger(msg.idx) ? msg.idx : idx });
            return acc;
        }, {});
        const lastVisibleIdx = messages[messages.length - 1]?.idx ?? messages.length - 1;
        return olderNotice + Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(date => {
            const list = groups[date];
            const today = date === this.logicalDateKey();
            const collapsed = this.isCollapsed(`advice_${date}`, !today && list.every(msg => msg.idx < lastVisibleIdx - 4));
            return `<section class="advice-date-group ${collapsed ? 'collapsed' : ''}">
                <button class="advice-date-head" onclick="data.toggleCollapse('advice_${date}')" type="button">
                    <span class="material-symbols-rounded">event_note</span>
                    <strong>${highlightKeyword(date, currentKeyword)}</strong>
                    <small>${list.length} 条</small>
                    <span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="advice-date-content">
                    ${list.map(msg => this.renderAdviceMessage(msg, msg.idx === lastVisibleIdx, currentKeyword)).join('')}
                </div>
            </section>`;
        }).join('');
    },

    renderAdviceMessage(msg, latest = false, currentKeyword = '') {
        const label = highlightKeyword(msg.role === 'user' ? '我' : 'AI', currentKeyword);
        const parsedAt = this.parseHistoryDate(msg.at);
        const timeText = parsedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const dateMeta = msg.showDateMeta ? `${this.logicalDateKey(parsedAt)} ` : '';
        const time = highlightKeyword(
            `${dateMeta}${timeText}`,
            currentKeyword
        );
        const model = msg.model ? ` · ${highlightKeyword(msg.model, currentKeyword)}${msg.temporaryModel ? ' · <span class="advice-temp-model">临时模型</span>' : ''}` : '';
        const usage = msg.tokenUsage && (msg.tokenUsage.in || msg.tokenUsage.out)
            ? ` · ${highlightKeyword(String(msg.tokenUsage.in || 0), currentKeyword)}→${highlightKeyword(String(msg.tokenUsage.out || 0), currentKeyword)} tok`
            : '';
        const cost = typeof msg.costUsd === 'number' && msg.costUsd > 0
            ? ` · $${highlightKeyword(msg.costUsd.toFixed(4), currentKeyword)}`
            : '';
        const finishReason = String(msg.finishReason || msg.errorInfo?.finishReason || '').toLowerCase();
        const limitedByTokens = /length|max[_-]?tokens?|max[_-]?output/.test(finishReason);
        const limitBadge = limitedByTokens ? ' · <span class="advice-limit-badge">达到上限</span>' : '';
        const stoppedBadge = msg.stopped ? ' · <span class="advice-stopped-badge">已停止</span>' : '';
        const detailMeta = `${model}${usage}${cost}${limitBadge}${stoppedBadge}`;
        const rawContent = String(msg.content || '');
        const isLongAssistant = msg.role === 'assistant'
            && !latest
            && !currentKeyword
            && rawContent.length > 12000;
        const expandedLongMessage = !!(msg.id && this._expandedAdviceMessageIds?.has?.(msg.id));
        const displayContent = isLongAssistant && !expandedLongMessage
            ? rawContent.slice(0, 4000)
            : rawContent;
        const routineBlocks = msg.role === 'assistant' && !msg.pending && !msg.error && typeof this.extractAdviceRoutineBlocks === 'function'
            ? this.extractAdviceRoutineBlocks(displayContent)
            : [];
        const content = msg.role === 'assistant'
            ? (displayContent ? highlightRenderedHtml(this.renderAdviceMarkdown(displayContent), currentKeyword) : '')
            : `<p>${highlightKeyword(displayContent, currentKeyword).replace(/\n/g, '<br>')}</p>`;
        const longMessageToggle = isLongAssistant && msg.id
            ? `<div class="advice-long-message-toggle">
                <button type="button" onclick="data.toggleAdviceMessageExpanded?.('${escapeHtml(msg.id)}')">
                    <span class="material-symbols-rounded">${expandedLongMessage ? 'expand_less' : 'expand_more'}</span>
                    ${expandedLongMessage ? '收起长回复' : `展开完整回复（约 ${Math.ceil(rawContent.length / 1000)}k 字）`}
                </button>
            </div>`
            : '';
        const attachments = Array.isArray(msg.attachments) && msg.attachments.length
            ? `<div class="advice-message-attachments">${msg.attachments.map(att => {
                const icon = att.kind === 'image' ? 'visibility' : att.kind === 'text' ? 'clinical_notes' : 'upload_file';
                const bytes = Math.max(0, Number(att.size) || 0);
                const size = bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB` : `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
                const meta = [att.label || att.kind || '文件', size].filter(Boolean).join(' · ');
                const preview = att.kind === 'image' && att.thumb
                    ? `<button class="advice-attachment-thumb" type="button" onclick="data.previewAdviceAttachment('${escapeHtml(att.previewId || att.id || '')}')" aria-label="预览图片"><img src="${escapeHtml(att.thumb)}" alt=""></button>`
                    : `<span class="material-symbols-rounded">${icon}</span>`;
                return `<span class="advice-message-attachment ${att.kind === 'image' && att.thumb ? 'has-thumb' : ''}" title="${escapeHtml(att.name || '附件')}">${preview}${highlightKeyword(att.name || '附件', currentKeyword)}<small>${highlightKeyword(meta, currentKeyword)}</small></span>`;
            }).join('')}</div>`
            : '';
        const state = msg.pending ? ' pending' : msg.error ? ' error' : msg.stopped ? ' stopped' : '';
        const versionGroup = Array.isArray(msg.versionGroup) ? msg.versionGroup : null;
        let versionSwitcher = '';
        if (versionGroup && versionGroup.length > 1) {
            const sorted = versionGroup.slice().sort((a, b) => Number(a.versionIdx || 0) - Number(b.versionIdx || 0));
            const activeIdx = sorted.findIndex(v => v.id === msg.id);
            const safeActive = activeIdx < 0 ? sorted.length - 1 : activeIdx;
            const rootId = msg.replyToId || msg.id;
            const safeRootId = escapeHtml(rootId || '');
            const pinIcon = msg.versionPinned ? 'bookmark_add' : 'bookmark_border';
            versionSwitcher = `<div class="advice-version-switcher" data-advice-version-root="${safeRootId}">
                <button class="advice-version-btn" onclick="data.cycleAdviceVersion(this.closest('.advice-version-switcher')?.dataset.adviceVersionRoot || '', -1)" type="button" aria-label="上一个版本"><span class="material-symbols-rounded">chevron_left</span></button>
                <span class="advice-version-label">${safeActive + 1}/${sorted.length}</span>
                <button class="advice-version-btn" onclick="data.cycleAdviceVersion(this.closest('.advice-version-switcher')?.dataset.adviceVersionRoot || '', 1)" type="button" aria-label="下一个版本"><span class="material-symbols-rounded">chevron_right</span></button>
                <button class="advice-version-btn ${msg.versionPinned ? 'active' : ''}" onclick="data.pinAdviceVersion(this.closest('.advice-version-switcher')?.dataset.adviceVersionRoot || '', this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="星标版本" title="星标版本"><span class="material-symbols-rounded">${pinIcon}</span></button>
            </div>`;
        }
        const safeId = escapeHtml(msg.id || '');
        const routineActions = routineBlocks.length && safeId
            ? `<div class="advice-routine-actions">
                ${routineBlocks.map((_routine, idx) => `<button class="md-btn md-btn-tonal" onclick="data.openAdviceRoutineSave(this.closest('.advice-bubble')?.dataset.adviceId || '', ${idx})" type="button"><span class="material-symbols-rounded">library_books</span> 保存到方案库${routineBlocks.length > 1 ? ` ${idx + 1}` : ''}</button>`).join('')}
            </div>`
            : '';
        const errorRecovery = msg.error ? (this.renderAdviceErrorRecovery?.(msg) || '') : '';
        const limitNotice = limitedByTokens ? '<div class="advice-limit-notice"><span class="material-symbols-rounded">data_thresholding</span>回复达到模型输出上限，结尾可能不完整。可点击重试，或直接输入“继续”。</div>' : '';
        const stoppedNotice = msg.stopped ? '<div class="advice-stopped-notice"><span class="material-symbols-rounded">stop</span>已停止生成，已保留上方部分回复。</div>' : '';
        const actions = msg.role === 'assistant'
            ? `<div class="advice-bubble-actions" aria-label="AI 回答操作">
                <button class="advice-action-btn" onclick="data.copyAdviceMessage(${msg.idx}, this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="复制" title="复制"><span class="material-symbols-rounded">content_copy</span></button>
                ${(msg.error || !msg.pending) ? `<button class="advice-action-btn" onclick="data.retryAdviceFrom(${msg.idx}, this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="重试" title="重试"><span class="material-symbols-rounded">refresh</span></button>` : ''}
                ${versionGroup && versionGroup.length > 1
                    ? `<button class="advice-action-btn advice-action-danger" onclick="data.deleteAdviceVersion(this.closest('.advice-bubble')?.querySelector('.advice-version-switcher')?.dataset.adviceVersionRoot || '', this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="删除当前版本" title="删除当前版本"><span class="material-symbols-rounded">delete</span></button>`
                    : `<button class="advice-action-btn advice-action-danger" onclick="data.deleteAiAdviceMessage(${msg.idx}, this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="删除" title="删除"><span class="material-symbols-rounded">delete</span></button>`}
                ${versionSwitcher}
            </div>`
            : `<div class="advice-bubble-actions" aria-label="提问操作">
                <button class="advice-action-btn" onclick="data.openEditAdviceMessage(${msg.idx}, this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="编辑重问" title="编辑重问"><span class="material-symbols-rounded">edit_square</span></button>
                <button class="advice-action-btn advice-action-danger" onclick="data.deleteAiAdviceMessage(${msg.idx}, this.closest('.advice-bubble')?.dataset.adviceId || '')" type="button" aria-label="删除" title="删除"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        return `<div class="advice-bubble ${msg.role}${state}" ${safeId ? `data-advice-id="${safeId}"` : ''} ${latest ? 'data-advice-latest="true"' : ''}>
            <div class="advice-bubble-head">
                <b class="advice-bubble-meta">
                    <span class="advice-bubble-author">${label}</span>
                    <span class="advice-bubble-dot" aria-hidden="true">·</span>
                    <small class="advice-bubble-time">${time}</small>
                    ${detailMeta ? `<small class="advice-bubble-details">${detailMeta}</small>` : ''}
                </b>
                ${msg.pending ? '<span class="advice-typing-dot"></span>' : ''}
            </div>
            ${attachments}
            <div class="advice-bubble-content">${msg.pending ? '<div class="skeleton-line skeleton" style="width:80%"></div><div class="skeleton-line skeleton" style="width:60%"></div><div class="skeleton-line skeleton" style="width:90%"></div>' : content}</div>
            ${limitNotice}
            ${stoppedNotice}
            ${errorRecovery}
            ${longMessageToggle}
            ${routineActions}
            ${actions}
        </div>`;
    },
});
