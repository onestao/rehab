// @ts-nocheck
(function () {
    const MAX_ATTACHMENTS = 4;
    const MAX_TEXT_CHARS = 50000;
    const MAX_TOTAL_TEXT_CHARS = 90000;
    const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
    const FILE_ACCEPT = '.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.html,.htm,.xml,.log,.ini,.cfg,.conf,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/*,application/json,application/pdf';
    const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const TEXT_RE = /\.(txt|md|markdown|csv|tsv|json|jsonl|html?|xml|log|ini|cfg|conf|ya?ml)$/i;
    const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?)$/i;

    function attachmentId(prefix = 'att') {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function sanitizeError(e) {
        return window.toast?.sanitize ? toast.sanitize(e) : String(e?.message || e || '处理失败');
    }

    function getAttachmentList(ctx) {
        ctx._adviceAttachments = Array.isArray(ctx._adviceAttachments) ? ctx._adviceAttachments : [];
        return ctx._adviceAttachments;
    }

    function previewStore(ctx) {
        ctx._adviceAttachmentPreviewUrls = ctx._adviceAttachmentPreviewUrls || {};
        return ctx._adviceAttachmentPreviewUrls;
    }

    function payloadRegistry(ctx) {
        ctx._adviceAttachmentPayloads = ctx._adviceAttachmentPayloads instanceof Map
            ? ctx._adviceAttachmentPayloads
            : new Map();
        return ctx._adviceAttachmentPayloads;
    }

    function fmt(bytes = 0) {
        const n = Math.max(0, Number(bytes) || 0);
        return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
    }

    function ext(name = '') {
        return (String(name).toLowerCase().match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    }

    function classify(file) {
        const name = String(file?.name || 'attachment').slice(0, 160);
        const mime = String(file?.type || '').toLowerCase();
        const suffix = ext(name);
        if (mime.startsWith('image/') || IMAGE_RE.test(name)) return { kind: 'image', label: '图片', readable: true, name, mime, ext: suffix };
        if (mime.startsWith('text/') || /json|csv|xml|yaml|markdown|html|javascript/.test(mime) || TEXT_RE.test(name)) return { kind: 'text', label: suffix === 'csv' ? 'CSV' : suffix === 'tsv' ? 'TSV' : suffix === 'json' ? 'JSON' : '文本', readable: true, name, mime, ext: suffix };
        if (DOC_RE.test(name) || /pdf|wordprocessingml|spreadsheetml|presentationml|msword|excel|powerpoint/.test(mime)) return { kind: 'document', label: suffix ? suffix.toUpperCase() : '文件', readable: false, name, mime, ext: suffix, reason: '当前版本暂不解析该文件内容' };
        return { kind: 'unsupported', label: '文件', readable: false, name, mime, ext: suffix, reason: '当前版本暂不支持解析该文件类型' };
    }

    function truncate(text = '', limit = MAX_TEXT_CHARS) {
        const raw = String(text || '');
        const max = Math.max(1000, Number(limit) || MAX_TEXT_CHARS);
        return raw.length <= max ? { text: raw, truncated: false, omitted: 0 } : { text: raw.slice(0, max), truncated: true, omitted: raw.length - max };
    }

    function normalizeText(text = '', att = {}) {
        const raw = String(text || '').replace(/\r\n/g, '\n');
        if (att.ext === 'json') {
            try { return JSON.stringify(JSON.parse(raw), null, 2); } catch {}
        }
        return raw;
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.onload = () => resolve(String(reader.result || ''));
            reader.readAsText(file);
        });
    }

    async function previewableImageFile(file) {
        if (!file) return file;
        if (window.ai?.preprocessVisionImageFile) {
            try { return await window.ai.preprocessVisionImageFile(file); } catch {}
        }
        return file;
    }

    function fileToThumb(file, maxSide = 320) {
        return new Promise((resolve) => {
            if (!file || !String(file.type || '').startsWith('image/')) return resolve('');
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
                    canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
                    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.72));
                } catch { resolve(''); }
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
            img.src = url;
        });
    }

    const adviceAttachments = {
        renderAdviceAttachmentInputs() {
            return `<input id="adviceImageInput" class="hidden" type="file" accept="${IMAGE_ACCEPT}" multiple>
                <input id="adviceFileInput" class="hidden" type="file" accept="${FILE_ACCEPT}" multiple>`;
        },

        renderAdviceAttachmentControls() {
            return `<div class="advice-attach-actions" aria-label="添加附件">
                <button id="adviceAttachButton" class="advice-attach-btn" type="button" title="点按添加图片，长按添加文件" aria-label="点按添加图片，长按添加文件"><span class="material-symbols-rounded">picture_in_picture_alt</span></button>
            </div>`;
        },

        renderAdviceAttachmentChips() {
            const list = getAttachmentList(this);
            if (!list.length) return '';
            return `<div id="adviceAttachmentChips" class="advice-attachment-chips">
                ${list.map(att => {
                    const icon = att.kind === 'image' ? 'picture_in_picture_alt' : att.kind === 'text' ? 'clinical_notes' : 'upload_file';
                    const state = att.status === 'failed' ? ' failed' : att.status === 'processing' ? ' processing' : '';
                    const title = this.escapeHtml(att.error || att.reason || `${att.name || '附件'}｜${att.label || att.kind || '文件'}｜${att.mime || att.ext || 'unknown'}｜${fmt(att.size || 0)}`);
                    const preview = att.kind === 'image' && att.thumb ? `<button class="advice-attachment-thumb" type="button" onclick="data.previewAdviceAttachment('${this.escapeHtml(att.id)}')" aria-label="预览图片"><img src="${this.escapeHtml(att.thumb)}" alt=""></button>` : `<span class="material-symbols-rounded">${icon}</span>`;
                    return `<div class="advice-attachment-chip${state} ${att.kind === 'image' ? 'has-thumb' : ''}" title="${title}">
                        ${preview}
                        <span class="advice-attachment-name">${this.escapeHtml(att.name || '附件')}</span>
                        <small>${this.escapeHtml(att.label || att.kind || '文件')} · ${this.escapeHtml(fmt(att.size || 0))}</small>
                        ${att.status === 'processing' ? '<span class="material-symbols-rounded advice-attachment-spin">progress_activity</span>' : ''}
                        <button type="button" onclick="data.removeAdviceAttachment('${this.escapeHtml(att.id)}')" aria-label="移除附件"><span class="material-symbols-rounded">close</span></button>
                    </div>`;
                }).join('')}
            </div>`;
        },

        bindAdviceAttachmentControls() {
            const button = document.getElementById('adviceAttachButton');
            const imageInput = document.getElementById('adviceImageInput');
            const fileInput = document.getElementById('adviceFileInput');
            if (button && !button.dataset.bound) {
                button.dataset.bound = 'true';
                let timer = 0;
                let longPressed = false;
                const cancel = () => { if (timer) clearTimeout(timer); timer = 0; };
                const start = () => {
                    cancel();
                    longPressed = false;
                    timer = setTimeout(() => {
                        longPressed = true;
                        button.classList.add('is-long-press');
                        window.haptics?.light?.();
                        this.openAdviceFilePicker();
                        setTimeout(() => button.classList.remove('is-long-press'), 260);
                    }, 550);
                };
                const end = (e) => {
                    cancel();
                    if (longPressed) {
                        e?.preventDefault?.();
                        longPressed = false;
                        return;
                    }
                    this.openAdviceImagePicker();
                };
                button.addEventListener('pointerdown', start);
                button.addEventListener('pointerup', end);
                button.addEventListener('pointerleave', cancel);
                button.addEventListener('pointercancel', cancel);
                button.addEventListener('contextmenu', (e) => e.preventDefault());
            }
            if (imageInput && !imageInput.dataset.bound) {
                imageInput.dataset.bound = 'true';
                imageInput.addEventListener('change', () => this.handleAdviceSelectedFiles(imageInput.files, 'image').finally(() => { imageInput.value = ''; }));
            }
            if (fileInput && !fileInput.dataset.bound) {
                fileInput.dataset.bound = 'true';
                fileInput.addEventListener('change', () => this.handleAdviceSelectedFiles(fileInput.files, 'file').finally(() => { fileInput.value = ''; }));
            }
        },

        openAdviceImagePicker() {
            this.bindAdviceAttachmentControls?.();
            document.getElementById('adviceImageInput')?.click?.();
        },

        openAdviceFilePicker() {
            this.bindAdviceAttachmentControls?.();
            document.getElementById('adviceFileInput')?.click?.();
        },

        refreshAdviceAttachmentUi() {
            const chips = document.getElementById('adviceAttachmentChips');
            const html = this.renderAdviceAttachmentChips?.() || '';
            if (chips) chips.outerHTML = html || '<div id="adviceAttachmentChips" class="advice-attachment-chips hidden"></div>';
            else document.querySelector('.advice-composer-stack')?.insertAdjacentHTML('afterbegin', html);
            this.updateAdviceSendState?.();
        },

        updateAdviceSendState() {
            const send = document.getElementById('adviceSendBtn');
            if (!send) return;
            const icon = send.querySelector('.material-symbols-rounded');
            const prompt = String(document.getElementById('advicePrompt')?.value || '').trim();
            const hasUsableAttachment = getAttachmentList(this).some(att => att.status !== 'failed' && (att.kind === 'image' || att.readable));
            const sending = !!this._adviceSending;
            send.disabled = sending ? false : (!prompt && !hasUsableAttachment);
            send.classList.toggle('is-stopping', sending);
            send.setAttribute('aria-label', sending ? '停止生成' : '发送问题');
            send.title = sending ? '停止生成' : '发送问题';
            send.setAttribute('onclick', sending ? 'data.cancelAiAdvice()' : 'data.sendAiAdvice()');
            if (icon) icon.textContent = sending ? 'stop' : 'send';
        },

        async handleAdviceSelectedFiles(fileList, pickerKind = 'file') {
            const files = Array.from(fileList || []);
            if (!files.length) return;
            const list = getAttachmentList(this);
            const slots = Math.max(0, MAX_ATTACHMENTS - list.length);
            if (!slots) {
                window.toast?.show?.(`最多添加 ${MAX_ATTACHMENTS} 个附件`, 'info');
                return;
            }
            for (const file of files.slice(0, slots)) {
                const classified = classify(file);
                if (pickerKind === 'image' && classified.kind !== 'image') {
                    window.toast?.show?.('图片入口仅支持图片文件', 'info');
                    continue;
                }
                if (pickerKind === 'file' && classified.kind === 'image') {
                    window.toast?.show?.('请使用图片入口添加图片', 'info');
                    continue;
                }
                const att = {
                    id: attachmentId(classified.kind),
                    file,
                    ...classified,
                    size: file.size || 0,
                    status: classified.readable ? 'processing' : 'ready',
                    persisted: false
                };
                list.push(att);
                this.refreshAdviceAttachmentUi?.();
                await this.prepareAdviceAttachment(att);
                this.refreshAdviceAttachmentUi?.();
            }
            if (files.length > slots) window.toast?.show?.(`已添加前 ${slots} 个附件`, 'info');
        },

        async prepareAdviceAttachment(att) {
            try {
                if (att.kind === 'image') {
                    att.previewId = att.id;
                    const previewFile = await previewableImageFile(att.file);
                    try { previewStore(this)[att.previewId] = URL.createObjectURL(previewFile || att.file); } catch {}
                    att.thumb = await fileToThumb(previewFile || att.file);
                    att.status = 'ready';
                    return att;
                }
                if (att.kind === 'text') {
                    const raw = await readFileAsText(att.file);
                    const clipped = truncate(normalizeText(raw, att), MAX_TEXT_CHARS);
                    att.text = clipped.text;
                    att.truncated = !!clipped.truncated;
                    att.omitted = clipped.omitted || 0;
                    att.status = 'ready';
                    return att;
                }
                att.status = 'ready';
                return att;
            } catch (e) {
                att.status = 'failed';
                att.error = sanitizeError(e);
                return att;
            }
        },

        removeAdviceAttachment(id = '') {
            this._adviceAttachments = getAttachmentList(this).filter(att => att.id !== id);
            this.refreshAdviceAttachmentUi?.();
        },

        clearAdviceAttachments() {
            this._adviceAttachments = [];
            this.refreshAdviceAttachmentUi?.();
        },

        registerAdviceAttachmentPayload(id = '', attachments = []) {
            const key = String(id || '').trim();
            if (!key) return null;
            const retained = (Array.isArray(attachments) ? attachments : [])
                .filter(att => att?.kind === 'image' && att.file);
            if (!retained.length) return null;
            const payload = Object.freeze({ attachments: Object.freeze(retained.slice()) });
            payloadRegistry(this).set(key, payload);
            return payload;
        },

        getAdviceAttachmentPayload(id = '') {
            const key = String(id || '').trim();
            return key ? (payloadRegistry(this).get(key) || null) : null;
        },

        releaseAdviceAttachmentPayload(id = '') {
            const key = String(id || '').trim();
            return key ? payloadRegistry(this).delete(key) : false;
        },

        releaseAdviceAttachmentPayloads() {
            payloadRegistry(this).clear();
        },

        adviceAttachmentMetadata(attachments = getAttachmentList(this)) {
            return attachments.map(att => ({
                id: att.id,
                previewId: att.previewId || att.id,
                kind: att.kind,
                label: att.label,
                name: att.name,
                mime: att.mime,
                size: att.size,
                readable: !!att.readable,
                status: att.status,
                truncated: !!att.truncated,
                omitted: att.omitted || 0,
                persisted: false
            }));
        },

        buildAdviceAttachmentPromptSuffix(attachments = getAttachmentList(this)) {
            const usable = attachments.filter(att => att.status !== 'failed');
            if (!usable.length) return '';
            let remaining = MAX_TOTAL_TEXT_CHARS;
            const blocks = [];
            const unreadable = [];
            for (const att of usable) {
                if (att.kind === 'text' && att.text) {
                    const clipped = truncate(att.text, remaining);
                    remaining -= clipped.text.length;
                    blocks.push(`【附件：${att.name}】\n类型：${att.mime || att.ext || att.label || 'text'}；大小：${fmt(att.size || 0)}\n${att.truncated || clipped.truncated ? `说明：内容过长，已截断${att.omitted || clipped.omitted ? `，省略约 ${att.omitted || clipped.omitted} 字符` : ''}。\n` : ''}内容：\n${clipped.text}`);
                    if (remaining <= 0) break;
                } else if (att.kind !== 'image') {
                    unreadable.push(`- ${att.name}（${att.label || att.kind}，${fmt(att.size || 0)}）：${att.reason || '未读取内容'}`);
                }
            }
            const imageCount = usable.filter(att => att.kind === 'image').length;
            if (imageCount) blocks.push(`【图片附件】\n已附加 ${imageCount} 张图片。请结合图片内容和上面的健康/训练/饮食上下文回答。`);
            if (unreadable.length) blocks.push(`【未解析附件】\n以下文件本次只发送元信息，未读取文件内容：\n${unreadable.join('\n')}`);
            return blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
        },

        applyAdviceAttachmentsToMessages(messages = [], attachments = getAttachmentList(this)) {
            const suffix = this.buildAdviceAttachmentPromptSuffix?.(attachments) || '';
            if (!suffix) return messages;
            const next = messages.map(m => ({ ...m }));
            for (let i = next.length - 1; i >= 0; i--) {
                if (next[i]?.role === 'user') {
                    next[i].content = `${next[i].content || ''}${suffix}`;
                    break;
                }
            }
            return next;
        },

        canSendAdviceWithAttachments(prompt = '', attachments = getAttachmentList(this)) {
            const usable = attachments.filter(att => att.status !== 'failed');
            if (String(prompt || '').trim()) return true;
            if (usable.some(att => att.kind === 'image')) return true;
            if (usable.some(att => att.kind === 'text' && att.text)) return true;
            return false;
        },

        previewAdviceAttachment(id = '') {
            const att = getAttachmentList(this).find(item => item.id === id) || (this.db?.health?.aiAdviceChat || []).flatMap(msg => msg.attachments || []).find(item => item.id === id || item.previewId === id);
            if (!att || att.kind !== 'image') return;
            const src = previewStore(this)[att.previewId || att.id] || att.thumb || '';
            if (!src) {
                window.toast?.show?.('该图片未保留本地预览', 'info');
                return;
            }
            let root = document.getElementById('adviceAttachmentPreview');
            if (!root) {
                root = document.createElement('div');
                root.id = 'adviceAttachmentPreview';
                root.className = 'advice-attachment-preview hidden';
                root.innerHTML = '<div class="advice-attachment-preview-backdrop" data-preview-close></div><div class="advice-attachment-preview-card"><button class="advice-attachment-preview-close" type="button" data-preview-close aria-label="关闭"><span class="material-symbols-rounded">close</span></button><img alt="图片预览"><div class="advice-attachment-preview-caption"></div></div>';
                document.body.appendChild(root);
                root.addEventListener('click', (e) => { if (e.target?.closest?.('[data-preview-close]')) this.closeAdviceAttachmentPreview?.(); });
            }
            const img = root.querySelector('img');
            const caption = root.querySelector('.advice-attachment-preview-caption');
            if (img) img.src = src;
            if (caption) caption.textContent = `${att.name || '图片'} · ${fmt(att.size || 0)}`;
            root.classList.remove('hidden');
            root.setAttribute('aria-hidden', 'false');
        },

        closeAdviceAttachmentPreview() {
            const root = document.getElementById('adviceAttachmentPreview');
            if (!root) return;
            root.classList.add('hidden');
            root.setAttribute('aria-hidden', 'true');
        }
    };

    window.adviceAttachments = adviceAttachments;
    window.addEventListener?.('pagehide', () => window.data?.releaseAdviceAttachmentPayloads?.());
})();
