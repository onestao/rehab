// @ts-nocheck
(function attachSearchEvidenceUi(root) {
    const foodMeta = evidence => {
        if (evidence?.status === 'needs-confirmation') return { icon: 'help', label: '请确认规格或改动项' };
        if (evidence?.status === 'unavailable') return { icon: 'error', label: '未能联网核实' };
        return {
            'official-exact': ['verified', '官方数据'],
            'official-composed': ['account_tree', '官方拆分计算'],
            'database-estimate': ['database', '食材估算'],
            'vision-estimate': ['photo_camera', '识别估算']
        }[evidence?.confidenceTier]?.reduce((result, value, index) => ({ ...result, [index ? 'label' : 'icon']: value }), {}) || { icon: 'data_thresholding', label: '估算，建议确认' };
    };
    const sourcesOf = value => (Array.isArray(value) ? value : value?.evidence || value?.sources || []).filter(item => String(item?.url || '').startsWith('https://'));
    const normalizeSources = value => sourcesOf(value).slice(0, 20).map(item => ({ title: String(item.title || '').slice(0, 300), url: String(item.url).slice(0, 2048), domain: String(item.domain || '').slice(0, 253), official: item.official === true, sourceType: String(item.sourceType || 'other'), readStatus: item.readStatus === 'deep-read' ? 'deep-read' : 'summary' }));
    const sourceTrail = (value, esc, className = 'advice-source-trail') => {
        const sources = sourcesOf(value);
        return sources.length ? `<details class="${className}"><summary>联网来源 · ${sources.length}</summary><ul>${sources.map(item => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || item.domain || '来源')}</a><small class="search-source-read-status">${item.readStatus === 'deep-read' ? '已深读' : '仅摘要'}</small></li>`).join('')}</ul></details>` : '';
    };
    const trail = (value, esc) => sourceTrail(value, esc);
    const summary = (value, taskId = '') => Array.from(root.searchPolicyPure?.summarizeSearchEvidence?.(value, { taskId }) || []);
    const attach = (target, value, taskId) => (target.searchEvidence = summary(value, taskId), target);
    const version = payload => root.searchPolicyPure.searchEvidenceVersion(payload);
    const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const plainNumber = value => Number(numeric(value).toFixed(2)).toString();
    const signed = value => `${numeric(value) < 0 ? '−' : '+'}${plainNumber(Math.abs(numeric(value)))}`;
    const nutrientDeltaText = (nutrients = {}, factor = 1) => {
        const values = [
            ['cal', 'kcal', ''],
            ['pro', 'g', '蛋白 '],
            ['carb', 'g', '碳水 '],
            ['fat', 'g', '脂肪 ']
        ];
        return values.filter(([key]) => numeric(nutrients?.[key]) !== 0).map(([key, unit, label]) => `${label}${signed(numeric(nutrients[key]) * factor)} ${unit}`);
    };
    const modificationText = item => {
        const kind = String(item?.kind || 'add');
        const nutrients = item?.nutrients || {};
        const replaced = item?.replacedNutrients || {};
        if (kind === 'portion') return item?.portionFactor ? `份量 ×${plainNumber(item.portionFactor)}` : '份量待确认';
        if (kind === 'replace') {
            const oldCal = numeric(replaced.cal), newCal = numeric(nutrients.cal), netCal = newCal - oldCal;
            const parts = [`旧项 −${plainNumber(oldCal)} + 新项 ${plainNumber(newCal)} = 净 ${signed(netCal)} kcal`];
            const oldPro = numeric(replaced.pro), newPro = numeric(nutrients.pro);
            if (oldPro || newPro) parts.push(`蛋白净 ${signed(newPro - oldPro)} g`);
            return parts.join(' · ');
        }
        const factor = kind === 'remove' ? -1 : 1;
        const changes = nutrientDeltaText(nutrients, factor);
        return changes.length ? changes.join(' · ') : '数值待确认';
    };
    const nutrientSummary = nutrients => {
        const value = nutrients || {};
        return `${plainNumber(value.cal)} kcal · 蛋白 ${plainNumber(value.pro)} g · 碳水 ${plainNumber(value.carb)} g · 脂肪 ${plainNumber(value.fat)} g`;
    };
    const list = (items, render) => items?.length ? `<ul class="food-evidence-list">${items.map(render).join('')}</ul>` : '';
    const block = (title, html) => html ? `<div class="food-evidence-block"><strong>${title}</strong>${html}</div>` : '';
    const modificationList = (evidence, esc) => list(evidence?.modifications, item => `<li><span>${esc(item.label || '改动')}</span><small>${esc(modificationText(item))}</small>${item.assumption ? `<em>${esc(item.assumption)}</em>` : ''}</li>`);
    const sharedFoodBody = (evidence, esc) => {
        const base = evidence?.base || {};
        const total = evidence?.total?.nutrients || {};
        const range = evidence?.total?.range?.cal || [];
        const assumptions = list(evidence?.assumptions, item => `<li>${esc(item)}</li>`);
        const required = list(evidence?.requiredUserInput, item => `<li>${esc(item)}</li>`);
        return `${base.name ? `<div class="food-evidence-line"><strong>基础餐品</strong><span>${esc(base.name)}${base.grams ? ` · ${esc(base.grams)} g` : ''}${base.servingLabel ? ` · ${esc(base.servingLabel)}` : ''}</span></div>` : ''}
            ${Object.values(base.nutrients || {}).some(value => numeric(value)) ? `<div class="food-evidence-line"><strong>基础值</strong><span>${esc(nutrientSummary(base.nutrients))}</span></div>` : ''}
            ${Object.values(total).some(value => numeric(value)) ? `<div class="food-evidence-line"><strong>核算总量</strong><span>${esc(nutrientSummary(total))}</span></div>` : ''}
            ${range.length === 2 ? `<div class="food-evidence-line"><strong>热量范围</strong><span>${esc(range[0])}–${esc(range[1])} kcal</span></div>` : ''}
            ${block('DIY 加减', modificationList(evidence, esc))}${block('假设', assumptions)}${block('待确认', required)}${block('来源', sourceTrail(evidence, esc, 'food-evidence-sources'))}`;
    };
    const foodDetails = (evidence, idx, esc) => {
        const meta = foodMeta(evidence);
        const safeIndex = Math.max(0, Math.floor(Number(idx) || 0));
        return `<div class="food-evidence-panel" data-evidence-idx="${safeIndex}"><div class="food-evidence-status" role="status"><span class="material-symbols-rounded">${meta.icon}</span>${esc(meta.label)}</div>
            ${sharedFoodBody(evidence, esc)}
            <button class="md-btn md-btn-tonal food-evidence-action" type="button" onclick="data.verifyAiFood(${safeIndex})"><span class="material-symbols-rounded">refresh</span>重新核实</button></div>`;
    };
    const savedFood = (evidence, esc) => evidence ? `<details class="food-evidence-panel food-evidence-saved"><summary>${esc(foodMeta(evidence).label)}</summary>${sharedFoodBody(evidence, esc)}</details>` : '';
    root.searchEvidenceUi = { foodMeta, foodDetails, savedFood, sourceTrail, trail, summary, attach, version, normalizeSources, modificationText, nutrientSummary };
})(window);
