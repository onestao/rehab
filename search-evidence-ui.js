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
    const normalizeSources = value => sourcesOf(value).slice(0, 20).map(item => ({ title: String(item.title || '').slice(0, 300), url: String(item.url).slice(0, 2048), domain: String(item.domain || '').slice(0, 253), official: item.official === true, sourceType: String(item.sourceType || 'other') }));
    const sourceTrail = (value, esc, className = 'advice-source-trail') => {
        const sources = sourcesOf(value);
        return sources.length ? `<details class="${className}"><summary>联网来源 · ${sources.length}</summary><ul>${sources.map(item => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || item.domain || '来源')}</a></li>`).join('')}</ul></details>` : '';
    };
    const foodDetails = (evidence, idx, esc) => {
        const meta = foodMeta(evidence), base = evidence?.base || {}, total = evidence?.total?.nutrients || {}, range = evidence?.total?.range?.cal || [];
        const list = (items, render) => items?.length ? `<ul class="food-evidence-list">${items.map(render).join('')}</ul>` : '';
        const block = (title, html) => html ? `<div class="food-evidence-block"><strong>${title}</strong>${html}</div>` : '';
        const nutrientText = item => {
            const nutrients = item?.nutrients || {};
            const replaced = item?.replacedNutrients || {};
            const parts = [];
            if (item?.kind === 'portion' && item.portionFactor) parts.push(`×${esc(item.portionFactor)}`);
            if (item?.kind === 'replace') {
                if (replaced.cal || replaced.pro || replaced.carb || replaced.fat) parts.push(`减 ${esc(replaced.cal || 0)}kcal/${esc(replaced.pro || 0)}P/${esc(replaced.carb || 0)}C/${esc(replaced.fat || 0)}F`);
                if (nutrients.cal || nutrients.pro || nutrients.carb || nutrients.fat) parts.push(`加 ${esc(nutrients.cal || 0)}kcal/${esc(nutrients.pro || 0)}P/${esc(nutrients.carb || 0)}C/${esc(nutrients.fat || 0)}F`);
            } else if (item?.kind === 'remove') {
                parts.push(`-${esc(nutrients.cal || 0)}kcal / -${esc(nutrients.pro || 0)}P / -${esc(nutrients.carb || 0)}C / -${esc(nutrients.fat || 0)}F`);
            } else if (nutrients.cal || nutrients.pro || nutrients.carb || nutrients.fat) {
                parts.push(`+${esc(nutrients.cal || 0)}kcal / +${esc(nutrients.pro || 0)}P / +${esc(nutrients.carb || 0)}C / +${esc(nutrients.fat || 0)}F`);
            }
            return parts.length ? ` · ${parts.join(' · ')}` : '';
        };
        const mods = list(evidence?.modifications, item => `<li>${esc(item.kind || 'add')} · ${esc(item.label || '改动')}${nutrientText(item)}${item.assumption ? `（${esc(item.assumption)}）` : ''}</li>`);
        const assumptions = list(evidence?.assumptions, item => `<li>${esc(item)}</li>`);
        const required = list(evidence?.requiredUserInput, item => `<li>${esc(item)}</li>`);
        return `<div class="food-evidence-panel" data-evidence-idx="${idx}"><div class="food-evidence-status" role="status"><span class="material-symbols-rounded">${meta.icon}</span>${esc(meta.label)}</div>
            ${base.name ? `<div class="food-evidence-line"><strong>基础餐品</strong><span>${esc(base.name)}${base.grams ? ` · ${esc(base.grams)}g` : ''}${base.servingLabel ? ` · ${esc(base.servingLabel)}` : ''}</span></div>` : ''}
            ${(total.cal || total.pro || total.carb || total.fat) ? `<div class="food-evidence-line"><strong>核算总量</strong><span>${esc(total.cal || 0)} kcal · 蛋白 ${esc(total.pro || 0)}g · 碳水 ${esc(total.carb || 0)}g · 脂肪 ${esc(total.fat || 0)}g</span></div>` : ''}
            ${range.length === 2 ? `<div class="food-evidence-line"><strong>热量范围</strong><span>${esc(range[0])}–${esc(range[1])} kcal</span></div>` : ''}
            ${block('DIY 加减', mods)}${block('假设', assumptions)}${block('待确认', required)}${block('来源', sourceTrail(evidence, esc, 'food-evidence-sources'))}
            <button class="md-btn md-btn-tonal food-evidence-action" type="button" onclick="data.verifyAiFood(${idx})"><span class="material-symbols-rounded">refresh</span>重新核实</button></div>`;
    };
    const savedFood = (evidence, esc) => evidence ? `<details class="food-evidence-panel food-evidence-saved"><summary>${esc(foodMeta(evidence).label)}</summary>
        ${evidence.base?.name ? `<div class="food-evidence-line"><strong>基础餐品</strong><span>${esc(evidence.base.name)}</span></div>` : ''}
        ${evidence.modifications?.length ? `<div class="food-evidence-block"><strong>DIY 加减</strong><ul class="food-evidence-list">${evidence.modifications.map(item => {
            const nutrients = item?.nutrients || {};
            const detail = item?.kind === 'portion' && item.portionFactor
                ? ` · ×${esc(item.portionFactor)}`
                : (nutrients.cal || nutrients.pro || nutrients.carb || nutrients.fat)
                    ? ` · ${esc(nutrients.cal || 0)}kcal/${esc(nutrients.pro || 0)}P/${esc(nutrients.carb || 0)}C/${esc(nutrients.fat || 0)}F`
                    : '';
            return `<li>${esc(item.kind || '')} · ${esc(item.label || '改动')}${detail}</li>`;
        }).join('')}</ul></div>` : ''}${sourceTrail(evidence, esc, 'food-evidence-sources')}</details>` : '';
    root.searchEvidenceUi = { foodMeta, foodDetails, savedFood, sourceTrail, normalizeSources };
})(window);
