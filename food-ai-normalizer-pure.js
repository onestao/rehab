// @ts-nocheck
(function attachFoodAiNormalizer(root) {
    'use strict';

    const ALIASES = {
        name: ['name', 'food', 'foodname', 'foodtitle', 'dish', 'dishname', 'itemname', 'productname', 'title', '食物', '食物名', '食物名称', '食品名称', '菜品名称', '菜名', '餐品名称', '名称', '名字'],
        grams: ['grams', 'gram', 'g', 'weight', 'weightg', 'servingweight', 'servingsize', 'servingsizeg', 'portionsize', 'portiongrams', 'amountg', 'quantityg', 'massg', '重量', '估计重量', '估算重量', '克数', '净重', '份量', '分量', '食用量'],
        cal: ['cal', 'kcal', 'calorie', 'calories', 'totalcalories', 'energy', 'totalenergy', '热量', '卡路里', '千卡', '能量'],
        pro: ['pro', 'protein', 'proteing', 'totalprotein', '蛋白', '蛋白质'],
        carb: ['carb', 'carbs', 'carbohydrate', 'carbohydrates', 'carbohydrateg', 'totalcarb', 'totalcarbs', 'totalcarbohydrate', 'netcarb', 'netcarbs', '碳水', '碳水化合物'],
        fat: ['fat', 'totalfat', 'fatg', '脂肪', '总脂肪'],
        fiber: ['fiber', 'dietaryfiber', '膳食纤维', '纤维'], sugar: ['sugar', 'totalsugar', '糖', '糖分'],
        sodium: ['sodium', 'sodiummg', '钠'], saturatedFat: ['saturatedfat', 'satfat', '饱和脂肪'],
        ingredients: ['ingredients', 'ingredient', '主要配料', '配料', '食材'], cooking: ['cooking', 'cookingmethod', '烹饪方式', '做法'],
        source: ['source', 'basis', '估算依据', '来源'], confidence: ['confidence', 'score', '置信度'], note: ['note', 'remark', '备注', '健康性备注']
    };

    function keyOf(value) {
        return String(value ?? '').normalize('NFKC').trim().toLowerCase()
            .replace(/[\s_\-./()\[\]{}【】]/g, '');
    }

    const ALIAS_SETS = Object.fromEntries(Object.entries(ALIASES).map(([field, values]) => [field, new Set(values.map(keyOf))]));

    function fieldScore(field, node) {
        const key = node.keyNorm;
        const reduced = key.replace(/(?:estimated|estimate|approximate|approximately|content|amount|value|total|估算|估计|大约|约|含量|数值|总)/g, '');
        if (ALIAS_SETS[field]?.has(key) || ALIAS_SETS[field]?.has(reduced)) return 120;
        if (field === 'name') {
            if (node.nutrient || /nutrition|nutrient|macro|营养|成分/.test(node.pathNorm)) return 0;
            return /(?:food|dish|item|product|meal).*(?:name|title)|(?:食物|食品|菜品|餐品|菜肴).*(?:名称|名字|名)$/.test(key) ? 105 : 0;
        }
        if (field === 'grams') {
            if (/(?:gram|weight|mass|serving|portion|重量|克数|净重|份量|分量|食用量)/.test(key)) return 100;
            return /^(?:amount|quantity|数量)$/.test(key) && /serving|portion|weight|份量|分量|重量/.test(node.pathNorm) ? 90 : 0;
        }
        if (field === 'cal') return /cal|calorie|energy|热量|能量|卡路里|千卡/.test(reduced) ? 100 : 0;
        if (field === 'pro') return /protein|蛋白/.test(reduced) ? 100 : 0;
        if (field === 'carb') return /carb|碳水/.test(reduced) ? 100 : 0;
        if (field === 'fat') return !/saturat|trans|饱和|反式/.test(key) && /fat|脂肪/.test(reduced) ? 100 : 0;
        if (field === 'fiber') return /fiber|纤维/.test(reduced) ? 100 : 0;
        if (field === 'sugar') return /sugar|糖/.test(reduced) ? 100 : 0;
        if (field === 'sodium') return /sodium|钠/.test(reduced) ? 100 : 0;
        if (field === 'saturatedFat') return /saturat.*fat|satfat|饱和脂肪/.test(reduced) ? 100 : 0;
        return 0;
    }

    function collectNodes(input) {
        const nodes = [];
        const seen = new WeakSet();
        const valueByKey = (object, aliases) => Object.entries(object || {}).find(([key]) => aliases.includes(keyOf(key)))?.[1];
        const walk = (value, path = [], nutrient = false, depth = 0) => {
            if (!value || typeof value !== 'object' || depth > 7 || seen.has(value)) return;
            seen.add(value);
            if (Array.isArray(value)) {
                value.forEach(entry => {
                    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
                    const label = valueByKey(entry, ['nutrient', 'nutrientname', 'type', 'label', 'name', '营养素', '项目', '名称']);
                    const amount = valueByKey(entry, ['value', 'amount', 'quantity', 'content', '数值', '含量', '数量']);
                    const unit = valueByKey(entry, ['unit', '单位']);
                    const isNutrient = label != null && amount != null && (/nutrition|nutrient|macro|营养|成分/.test(path.map(keyOf).join('.')) || valueByKey(entry, ['nutrient', 'nutrientname', '营养素']) != null);
                    if (isNutrient) add(String(label), { value: amount, unit }, path, true);
                    walk(entry, path, nutrient || isNutrient, depth + 1);
                });
                return;
            }
            Object.entries(value).forEach(([key, child]) => {
                add(key, child, path, nutrient);
                walk(child, [...path, key], nutrient, depth + 1);
            });
        };
        const add = (key, value, path, nutrient) => {
            const fullPath = [...path, key];
            nodes.push({ key, keyNorm: keyOf(key), path: fullPath, pathNorm: fullPath.map(keyOf).join('.'), value, nutrient });
        };
        walk(input);
        return nodes;
    }

    function numberOf(value, field = '') {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'object') {
            const entries = Object.entries(value);
            const find = aliases => entries.find(([key]) => aliases.includes(keyOf(key)))?.[1];
            const nested = find(['value', 'amount', 'quantity', 'content', '数值', '含量', '数量']);
            const unit = find(['unit', '单位']);
            return numberOf(unit ? `${nested} ${unit}` : nested, field);
        }
        const text = String(value).normalize('NFKC').replace(/,/g, '').trim().toLowerCase();
        const measures = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(kcal|kilocalories?|kj|kilojoules?|kg|千克|公斤|mg|毫克|g|克|%)/gi)]
            .map(match => ({ value: Number(match[1]), unit: match[2].toLowerCase() }));
        if (field === 'grams') {
            const valueWithUnit = measures.find(item => /kg|千克|公斤|g|克/.test(item.unit));
            if (valueWithUnit) return /kg|千克|公斤/.test(valueWithUnit.unit) ? valueWithUnit.value * 1000 : valueWithUnit.value;
        }
        if (field === 'cal') {
            const kcal = measures.find(item => /kcal|kilocalorie/.test(item.unit));
            if (kcal) return kcal.value;
            const kj = measures.find(item => /kj|kilojoule/.test(item.unit));
            if (kj) return Number((kj.value / 4.184).toFixed(1));
        }
        if (['pro', 'carb', 'fat', 'fiber', 'sugar', 'saturatedFat'].includes(field)) {
            const valueWithUnit = measures.find(item => /mg|毫克|g|克/.test(item.unit));
            if (valueWithUnit) return /mg|毫克/.test(valueWithUnit.unit) ? valueWithUnit.value / 1000 : valueWithUnit.value;
        }
        if (field === 'sodium') {
            const valueWithUnit = measures.find(item => /mg|毫克|g|克/.test(item.unit));
            if (valueWithUnit) return /(?:^g$)|克/.test(valueWithUnit.unit) ? valueWithUnit.value * 1000 : valueWithUnit.value;
        }
        const match = text.match(/-?\d+(?:\.\d+)?/);
        const number = match ? Number(match[0]) : null;
        return Number.isFinite(number) ? number : null;
    }

    function normalize(items = []) {
        const diagnostics = [];
        const output = (Array.isArray(items) ? items : []).map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                const name = String(item || '').trim();
                diagnostics.push({ index, missingFields: name ? ['grams', 'cal', 'pro', 'carb', 'fat'] : ['name', 'grams', 'cal', 'pro', 'carb', 'fat'], recoveredFields: [], sourceKeys: [] });
                return { name, grams: 0, cal: 0, pro: 0, carb: 0, fat: 0 };
            }
            const nodes = collectNodes(item);
            const per100 = node => /per100|100g|100gram|每100|每百克/.test(node.pathNorm);
            const select = (field, parser, wantPer100 = false) => {
                const candidates = nodes.map(node => ({ node, score: fieldScore(field, node) }))
                    .filter(candidate => candidate.score > 0 && per100(candidate.node) === wantPer100)
                    .sort((a, b) => b.score - a.score || a.node.path.length - b.node.path.length);
                for (const candidate of candidates) {
                    const value = parser(candidate.node.value, field);
                    if (value !== '' && value !== undefined && value !== null && !(typeof value === 'number' && !Number.isFinite(value))) return { found: true, value, node: candidate.node };
                }
                return { found: false, value: parser === numberOf ? 0 : parser(undefined, field), node: null };
            };
            const stringOf = value => value === undefined || value === null || typeof value === 'object' ? '' : String(value).trim();
            const listOf = value => Array.isArray(value) ? value.map(entry => String(entry || '').trim()).filter(Boolean) : (stringOf(value) ? stringOf(value).split(/[、,，;；]/).map(entry => entry.trim()).filter(Boolean) : []);
            const name = select('name', stringOf);
            const grams = select('grams', numberOf);
            const numeric = {};
            const numericFields = ['cal', 'pro', 'carb', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat'];
            numericFields.forEach(field => {
                const direct = select(field, numberOf);
                const base = direct.found ? null : select(field, numberOf, true);
                numeric[field] = direct.found ? direct : (base.found && grams.value > 0
                    ? { found: true, value: Number((base.value * grams.value / 100).toFixed(field === 'cal' ? 1 : 2)), node: base.node, recovered: true }
                    : direct);
            });
            const recoveredFields = numericFields.filter(field => numeric[field].recovered);
            if (!numeric.carb.found && numeric.cal.found && numeric.cal.value > 0 && (numeric.pro.value || numeric.fat.value)) {
                const residual = (numeric.cal.value - numeric.pro.value * 4 - numeric.fat.value * 9) / 4;
                if (Number.isFinite(residual) && residual >= 0) {
                    numeric.carb = { found: true, value: Number(residual.toFixed(1)), node: null, recovered: true };
                    recoveredFields.push('carb');
                }
            }
            if (!numeric.cal.found && (numeric.pro.value || numeric.carb.value || numeric.fat.value)) {
                numeric.cal = { found: true, value: Number((numeric.pro.value * 4 + numeric.carb.value * 4 + numeric.fat.value * 9).toFixed(1)), node: null, recovered: true };
                recoveredFields.push('cal');
            }
            const extension = field => select(field, field === 'ingredients' ? listOf : stringOf).value;
            const normalized = {
                ...item, name: name.value, grams: grams.value, cal: numeric.cal.value, pro: numeric.pro.value, carb: numeric.carb.value, fat: numeric.fat.value,
                fiber: numeric.fiber.value, sugar: numeric.sugar.value, sodium: numeric.sodium.value, saturatedFat: numeric.saturatedFat.value,
                ingredients: extension('ingredients'), cooking: extension('cooking'), source: extension('source') || 'ai-food-parse',
                confidence: select('confidence', numberOf).value || '', note: extension('note')
            };
            if (recoveredFields.includes('cal') && !normalized.note) normalized.note = '热量按已识别的宏量营养素估算';
            const core = { name, grams, cal: numeric.cal, pro: numeric.pro, carb: numeric.carb, fat: numeric.fat };
            diagnostics.push({ index, missingFields: Object.entries(core).filter(([, result]) => !result.found).map(([field]) => field), recoveredFields: [...new Set(recoveredFields)], sourceKeys: [...new Set(nodes.map(node => node.key))].slice(0, 20) });
            return normalized;
        }).filter(item => item.name || item.grams || item.cal || item.pro || item.carb || item.fat);
        Object.defineProperty(output, 'normalizationDiagnostics', { value: { inputCount: Array.isArray(items) ? items.length : 0, outputCount: output.length, items: diagnostics }, enumerable: false });
        return output;
    }

    root.foodAiNormalizer = { normalize };
})(typeof window !== 'undefined' ? window : globalThis);
