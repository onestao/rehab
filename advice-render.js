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
    MODEL_ICON_CDN_BASES: [
        'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/',
        'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/'
    ],
    MODEL_ICON_SLUGS: {
        openai: 'openai',
        gemini: 'gemini',
        grok: 'grok',
        deepseek: 'deepseek',
        claude: 'claude',
        qwen: 'qwen',
        doubao: 'doubao',
        kimi: 'kimi',
        minimax: 'minimax',
        mimo: 'xiaomimimo',
        glm: 'zhipu',
        mistral: 'mistral',
        meta: 'meta',
        llama: 'meta',
        ollama: 'ollama',
        perplexity: 'perplexity',
        cohere: 'cohere',
        baichuan: 'baichuan',
        yi: 'zeroone',
        stepfun: 'stepfun',
        siliconflow: 'siliconcloud',
        openrouter: 'openrouter',
        azure: 'azure',
        huggingface: 'huggingface'
    },
    MODEL_ICONS: {
        openai: 'assets/model-icons/openai.svg',
        gemini: 'assets/model-icons/gemini.svg',
        grok: 'assets/model-icons/grok.svg',
        deepseek: 'assets/model-icons/deepseek.svg',
        claude: 'assets/model-icons/claude.svg',
        qwen: 'assets/model-icons/qwen.svg',
        doubao: 'assets/model-icons/doubao.svg',
        kimi: 'assets/model-icons/kimi.svg',
        minimax: 'assets/model-icons/minimax.svg',
        mimo: 'assets/model-icons/mimo.svg',
        glm: 'assets/model-icons/glm.svg',
        generic: 'assets/model-icons/generic.svg'
    },
    iconFallbackSrcs(key = 'generic') {
        const slug = this.MODEL_ICON_SLUGS?.[key] || key;
        if (key === 'kimi') {
            const mono = (this.MODEL_ICON_CDN_BASES || []).map(base => `${base}${slug}.svg`);
            return Array.from(new Set([...mono, this.MODEL_ICONS?.kimi, this.MODEL_ICONS?.generic].filter(Boolean)));
        }
        const cdn = (this.MODEL_ICON_CDN_BASES || []).map(base => [`${base}${slug}-color.svg`, `${base}${slug}.svg`]).flat();
        const local = [this.MODEL_ICONS?.[key], this.MODEL_ICONS?.generic].filter(Boolean);
        const unique = new Set([...cdn, ...local]);
        return Array.from(unique);
    },

    adviceModelIconHtml(visual = {}) {
        const srcs = visual.iconSrcs || [];
        const mark = this.escapeHtml(visual.mark || 'AI');
        if (!srcs.length) return mark;
        const src = srcs[0];
        const fallbacks = srcs.slice(1).map(s => `this.src='${this.escapeHtml(s)}'`).join(';');
        const onerror = fallbacks ? `this.onerror=function(){this.onerror=null;${fallbacks}};` : 'this.onerror=null;';
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
        const s = String(key || 'generic');
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        }
        return Math.abs(h) % 360;
    },

    modelThemeFor(key = 'generic') {
        const hue = this.providerHashHue(key);
        const dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        return dark
            ? {
                bg: `linear-gradient(135deg, hsl(${hue} 28% 22%), hsl(${(hue + 28) % 360} 24% 16%))`,
                color: `hsl(${hue} 62% 90%)`,
                markBg: `color-mix(in srgb, hsl(${hue} 36% 36%) 58%, var(--md-sys-surface-container-highest))`
            }
            : {
                bg: `linear-gradient(135deg, hsl(${hue} 64% 93%), hsl(${(hue + 28) % 360} 60% 90%))`,
                color: `hsl(${hue} 52% 22%)`,
                markBg: `color-mix(in srgb, hsl(${hue} 72% 80%) 56%, white)`
            };
    },

    detectAdviceModelProvider(model = '') {
        const text = String(model || '').toLowerCase();
        if (/grok|x-ai|\bxai\b/.test(text)) return { key: 'grok', label: 'Grok', mark: 'G' };
        if (/gemini|google/.test(text)) return { key: 'gemini', label: 'Gemini', mark: 'Gem' };
        if (/deepseek/.test(text)) return { key: 'deepseek', label: 'DeepSeek', mark: 'DS' };
        if (/claude|anthropic/.test(text)) return { key: 'claude', label: 'Claude', mark: 'C' };
        if (/qwen|通义|tongyi/.test(text)) return { key: 'qwen', label: 'Qwen', mark: 'Q' };
        if (/doubao|豆包|volc|火山/.test(text)) return { key: 'doubao', label: '豆包', mark: '豆' };
        if (/kimi|moonshot|moon/.test(text)) return { key: 'kimi', label: 'Kimi', mark: 'K' };
        if (/minimax/.test(text)) return { key: 'minimax', label: 'MiniMax', mark: 'MM' };
        if (/mimo/.test(text)) return { key: 'mimo', label: 'Mimo', mark: 'Mi' };
        if (/glm|chatglm|zhipu|智谱/.test(text)) return { key: 'glm', label: 'GLM', mark: 'GLM' };
        if (/gpt|openai|chatgpt|\bo[134]\b|o1|o3|o4/.test(text)) return { key: 'openai', label: 'OpenAI', mark: 'GPT' };
        return { key: 'generic', label: 'AI 模型', mark: 'AI' };
    },

    adviceModelVisual(model = '') {
        const provider = this.detectAdviceModelProvider(model);
        const iconSrcs = this.iconFallbackSrcs(provider.key);
        const theme = this.modelThemeFor(provider.key);
        const visual = { ...provider, iconSrcs, theme };
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

        for (const raw of lines) {
            const line = raw.trimEnd();
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
        const list = document.querySelector('.advice-chat-list');
        if (list) {
            const distance = list.scrollHeight - list.clientHeight - list.scrollTop;
            if (force || distance < 180 || this._adviceFollowStream) {
                if (!force && this._adviceUserScrollPaused) return;
                const scrollable = getComputedStyle(list).overflowY !== 'visible' && list.scrollHeight > list.clientHeight + 2;
                if (scrollable) {
                    list.scrollTo({ top: list.scrollHeight, behavior });
                    return;
                }
                const latest = list.querySelector('[data-advice-latest="true"]') || list.lastElementChild;
                latest?.scrollIntoView({ block: 'end', behavior });
            }
        }
    },

    renderAdviceMessages(messages) {
        const currentKeyword = String(this.adviceSearchQuery || '').trim();
        if (!messages.length) {
            return currentKeyword
                ? '<div class="empty-state advice-empty"><span class="material-symbols-rounded">search_off</span><p>没有匹配的聊天记录</p></div>'
                : '<div class="empty-state advice-empty"><span class="material-symbols-rounded">forum</span><p>还没有 AI 建议，选择下方快捷问题开始</p></div>';
        }
        const groups = messages.reduce((acc, msg, idx) => {
            const date = this.logicalDateKey(this.parseHistoryDate(msg.at));
            if (!acc[date]) acc[date] = [];
            acc[date].push({ ...msg, idx: Number.isInteger(msg.idx) ? msg.idx : idx });
            return acc;
        }, {});
        const lastVisibleIdx = messages[messages.length - 1]?.idx ?? messages.length - 1;
        return Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(date => {
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
        const time = highlightKeyword(
            this.parseHistoryDate(msg.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            currentKeyword
        );
        const model = msg.model ? ` · ${highlightKeyword(msg.model, currentKeyword)}` : '';
        const usage = msg.tokenUsage && (msg.tokenUsage.in || msg.tokenUsage.out)
            ? ` · ${highlightKeyword(String(msg.tokenUsage.in || 0), currentKeyword)}→${highlightKeyword(String(msg.tokenUsage.out || 0), currentKeyword)} tok`
            : '';
        const cost = typeof msg.costUsd === 'number' && msg.costUsd > 0
            ? ` · $${highlightKeyword(msg.costUsd.toFixed(4), currentKeyword)}`
            : '';
        const rawContent = String(msg.content || '');
        const content = msg.role === 'assistant'
            ? (rawContent ? highlightRenderedHtml(this.renderAdviceMarkdown(rawContent), currentKeyword) : '')
            : `<p>${highlightKeyword(rawContent, currentKeyword).replace(/\n/g, '<br>')}</p>`;
        const state = msg.pending ? ' pending' : msg.error ? ' error' : '';
        const versionGroup = Array.isArray(msg.versionGroup) ? msg.versionGroup : null;
        let versionSwitcher = '';
        if (versionGroup && versionGroup.length > 1) {
            const sorted = versionGroup.slice().sort((a, b) => Number(a.versionIdx || 0) - Number(b.versionIdx || 0));
            const activeIdx = sorted.findIndex(v => v.id === msg.id);
            const safeActive = activeIdx < 0 ? sorted.length - 1 : activeIdx;
            const rootId = msg.replyToId || msg.id;
            const pinIcon = msg.versionPinned ? 'bookmark_add' : 'bookmark_border';
            versionSwitcher = `<div class="advice-version-switcher" data-advice-version-root="${rootId}">
                <button class="advice-version-btn" onclick="data.cycleAdviceVersion('${rootId}', -1)" type="button" aria-label="上一个版本"><span class="material-symbols-rounded">chevron_left</span></button>
                <span class="advice-version-label">${safeActive + 1}/${sorted.length}</span>
                <button class="advice-version-btn" onclick="data.cycleAdviceVersion('${rootId}', 1)" type="button" aria-label="下一个版本"><span class="material-symbols-rounded">chevron_right</span></button>
                <button class="advice-version-btn ${msg.versionPinned ? 'active' : ''}" onclick="data.pinAdviceVersion('${rootId}', '${msg.id}')" type="button" aria-label="星标版本" title="星标版本"><span class="material-symbols-rounded">${pinIcon}</span></button>
            </div>`;
        }
        const actions = msg.role === 'assistant'
            ? `<div class="advice-bubble-actions">
                <button onclick="data.copyAdviceMessage(${msg.idx})" type="button">复制</button>
                ${(msg.error || !msg.pending) ? `<button onclick="data.retryAdviceFrom(${msg.idx})" type="button">重试</button>` : ''}
                ${versionGroup && versionGroup.length > 1
                    ? `<button onclick="data.deleteAdviceVersion('${msg.replyToId || msg.id}', '${msg.id}')" type="button">删除版本</button>`
                    : `<button onclick="data.deleteAiAdviceMessage(${msg.idx})" type="button">删除</button>`}
            </div>`
            : `<div class="advice-bubble-actions"><button onclick="data.deleteAiAdviceMessage(${msg.idx})" type="button">删除</button></div>`;
        return `<div class="advice-bubble ${msg.role}${state}" ${msg.id ? `data-advice-id="${msg.id}"` : ''} ${latest ? 'data-advice-latest="true"' : ''}>
            <div class="advice-bubble-head">
                <b>${label}<small>${time}${model}${usage}${cost}</small></b>
                ${versionSwitcher}
                ${msg.pending ? '<span class="advice-typing-dot"></span>' : ''}
            </div>
            <div class="advice-bubble-content">${msg.pending ? '<div class="skeleton-line skeleton" style="width:80%"></div><div class="skeleton-line skeleton" style="width:60%"></div><div class="skeleton-line skeleton" style="width:90%"></div>' : content}</div>
            ${actions}
        </div>`;
    },
});
