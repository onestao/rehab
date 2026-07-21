import * as aiJsonPure from '../ai-json-pure.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

async function loadFoodLog() {
    const normalizer = await readFile(
        new URL('../food-ai-normalizer-pure.js', import.meta.url),
        'utf8',
    );
    const source = await readFile(new URL('../food-log.js', import.meta.url), 'utf8');
    return vm.runInNewContext(`${normalizer}\n${source}\nfoodLog;`, {});
}

async function loadAiApi(raw) {
    const source = await readFile(new URL('../ai-api.js', import.meta.url), 'utf8');
    const sandbox = {
        ai: {},
        window: {
            dataAiTemplates: null,
            data: { db: {} },
        },
        console,
    };
    sandbox.window.aiJsonPure = aiJsonPure.default || aiJsonPure;
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.runInNewContext(`${source}\nai;`, sandbox);
    sandbox.ai.call = async () => raw;
    return sandbox.ai;
}

test('normalizes Chinese AI food fields into app nutrition fields', async () => {
    const foodLog = await loadFoodLog();

    const items = foodLog.normalizeAiFoodItems(
        JSON.parse(
            JSON.stringify([
                {
                    食物名: '鸡胸肉饭',
                    克数: '350g',
                    热量: '520 kcal',
                    蛋白质: '38克',
                    碳水化合物: '62 g',
                    脂肪: '9g',
                    膳食纤维: '4g',
                    糖: '3g',
                    钠: '720mg',
                    饱和脂肪: '2g',
                    主要配料: '米饭、鸡胸肉、青菜',
                    烹饪方式: '煎',
                    估算依据: '常见份量',
                    置信度: '82',
                    备注: '蛋白较高',
                },
            ]),
        ),
    );

    assert.deepEqual(JSON.parse(JSON.stringify(items[0])), {
        食物名: '鸡胸肉饭',
        克数: '350g',
        热量: '520 kcal',
        蛋白质: '38克',
        碳水化合物: '62 g',
        脂肪: '9g',
        膳食纤维: '4g',
        糖: '3g',
        钠: '720mg',
        饱和脂肪: '2g',
        主要配料: '米饭、鸡胸肉、青菜',
        烹饪方式: '煎',
        估算依据: '常见份量',
        置信度: '82',
        备注: '蛋白较高',
        name: '鸡胸肉饭',
        grams: 350,
        cal: 520,
        pro: 38,
        carb: 62,
        fat: 9,
        fiber: 4,
        sugar: 3,
        sodium: 720,
        saturatedFat: 2,
        ingredients: ['米饭', '鸡胸肉', '青菜'],
        cooking: '煎',
        source: '常见份量',
        confidence: 82,
        note: '蛋白较高',
    });
});

test('normalizes nested nutrition and per-100g AI food fields', async () => {
    const foodLog = await loadFoodLog();

    const items = foodLog.normalizeAiFoodItems([
        {
            food: '牛肉面',
            weight: { value: '400', unit: 'g' },
            nutrition: {
                per100g: {
                    kcal: 110,
                    protein: 6.5,
                    carbohydrate: 16,
                    fat: 2.2,
                },
            },
        },
    ]);

    assert.equal(items[0].name, '牛肉面');
    assert.equal(items[0].grams, 400);
    assert.equal(items[0].cal, 440);
    assert.equal(items[0].pro, 26);
    assert.equal(items[0].carb, 64);
    assert.equal(items[0].fat, 8.8);
});

test('converts kilojoule food energy values to kcal', async () => {
    const foodLog = await loadFoodLog();

    const [item1] = foodLog.normalizeAiFoodItems([
        { name: '能量棒', grams: 50, energy: '836 kJ', protein: 10 },
    ]);
    assert.equal(item1.cal, 199.8);
    assert.equal(item1.pro, 10);

    const [item2] = foodLog.normalizeAiFoodItems([
        { name: '牛奶', energy: { value: 836, unit: 'kJ' } },
    ]);
    assert.equal(item2.cal, 199.8);
});

test('normalizes unit-suffixed macro keys and derives missing energy from macros', async () => {
    const foodLog = await loadFoodLog();

    const [item] = foodLog.normalizeAiFoodItems([
        {
            name: '去皮去骨纯鸡肉',
            grams: '90 g',
            '蛋白质（g）': '22g',
            '脂肪（g）': '10g',
            '碳水化合物（g）': '0g',
        },
    ]);

    assert.equal(item.grams, 90);
    assert.equal(item.pro, 22);
    assert.equal(item.carb, 0);
    assert.equal(item.fat, 10);
    assert.equal(item.cal, 178);
});

test('derives omitted carbohydrate from a returned calorie total when possible', async () => {
    const foodLog = await loadFoodLog();

    const [item] = foodLog.normalizeAiFoodItems([
        {
            name: '鸡胸肉饭',
            grams: 350,
            calories: 520,
            protein: 38,
            fat: 9,
        },
    ]);

    assert.equal(item.cal, 520);
    assert.equal(item.carb, 71.8);
});

test('normalizes structurally varied food schemas without dropping core fields', async () => {
    const foodLog = await loadFoodLog();

    const items = foodLog.normalizeAiFoodItems([
        {
            food: {
                title: '去皮鸡胸肉',
                serving: { quantity: 90, unit: 'g' },
            },
            营养成分: {
                '热量(kcal)': 178,
                '蛋白质含量(g)': 22,
                '碳水化合物含量(g)': 0,
                '总脂肪(g)': 10,
            },
        },
        {
            食品名称: '燕麦牛奶',
            估算重量: '1杯（约260克）',
            nutrients: [
                { nutrient: 'energy', amount: 220, unit: 'kcal' },
                { nutrient: 'protein', amount: 8, unit: 'g' },
                { nutrient: 'total carbohydrates', amount: 32, unit: 'g' },
                { nutrient: 'fat', amount: 7, unit: 'g' },
            ],
        },
        {
            item_name: '希腊酸奶',
            serving_size: { amount: 200, unit: 'g' },
            nutrition_facts: {
                energy: { value: 500, unit: 'kJ' },
                protein_content_g: 20,
                total_carbohydrate_g: 15,
                total_fat_g: 0,
            },
        },
    ]);

    assert.deepEqual(
        JSON.parse(
            JSON.stringify(
                items.map(({ name, grams, cal, pro, carb, fat }) => ({
                    name,
                    grams,
                    cal,
                    pro,
                    carb,
                    fat,
                })),
            ),
        ),
        [
            { name: '去皮鸡胸肉', grams: 90, cal: 178, pro: 22, carb: 0, fat: 10 },
            { name: '燕麦牛奶', grams: 260, cal: 220, pro: 8, carb: 32, fat: 7 },
            { name: '希腊酸奶', grams: 200, cal: 119.5, pro: 20, carb: 15, fat: 0 },
        ],
    );
});

test('reports incomplete model fields instead of silently treating them as valid zeroes', async () => {
    const foodLog = await loadFoodLog();
    const items = foodLog.normalizeAiFoodItems([
        {
            food_name: '豆腐',
            serving_size_g: 100,
            protein_g: 8,
            carbohydrates_g: 'unknown',
        },
    ]);

    assert.equal(items[0].name, '豆腐');
    assert.equal(items[0].grams, 100);
    assert.deepEqual([...items.normalizationDiagnostics.items[0].missingFields], ['carb', 'fat']);
    assert.deepEqual([...items.normalizationDiagnostics.items[0].recoveredFields], ['cal']);
});

test('parseFood discovers food arrays inside unfamiliar nested wrappers', async () => {
    const ai = await loadAiApi(
        JSON.stringify({
            meal_analysis: {
                detected_foods: [{ food_name: '米饭', serving_size_g: 150, carbohydrates_g: 39 }],
            },
        }),
    );

    const parsed = await ai.parseFood('一碗米饭');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].food_name, '米饭');
});

test('parseFood accepts fenced, wrapped, and noisy model JSON responses', async () => {
    const cases = [
        {
            raw: '```json\n[{"name":"鸡胸肉","grams":120}]\n```',
            name: '鸡胸肉',
        },
        {
            raw: '识别结果：{"foods":[{"name":"米饭","grams":150}]}',
            name: '米饭',
        },
        {
            raw: '{"name":"鸡蛋","grams":50,"cal":70}',
            name: '鸡蛋',
        },
        {
            raw: '结果：[{"name":"豆浆","grams":300}]\n备注：[完成]',
            name: '豆浆',
        },
    ];

    for (const item of cases) {
        const ai = await loadAiApi(item.raw);
        const parsed = await ai.parseFood('早餐');
        assert.equal(parsed[0].name, item.name);
    }
});

async function loadAiApiWithRunJson(sequence) {
    const source = await readFile(new URL('../ai-api.js', import.meta.url), 'utf8');
    const queue = [...sequence];
    const calls = [];
    const sandbox = {
        ai: {},
        window: {
            dataAiTemplates: null,
            data: { db: {} },
            aiRoutingPure: {
                buildReasoningOptions() {
                    return {
                        params: {},
                        omitTemperature: false,
                        maxOutputTokens: 2000,
                        effectiveDepth: 'off',
                    };
                },
                isRetryableAiError() {
                    return false;
                },
            },
            toast: { show() {} },
        },
        console,
        setTimeout,
        clearTimeout,
        AbortController,
        TypeError,
    };
    sandbox.window.aiJsonPure = aiJsonPure.default || aiJsonPure;
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.runInNewContext(`${source}\nai;`, sandbox);
    sandbox.ai.run = async (options = {}) => {
        calls.push(options);
        if (!queue.length) throw new Error('unexpected call');
        const next = queue.shift();
        if (next?.throw) {
            const err = new Error(next.throw.message || 'fail');
            Object.assign(err, next.throw);
            sandbox.ai._attachAiAttempt(err, {
                taskId: options.taskId,
                profileId: 'p1',
                modelId: 'm1',
                provider: 'openai',
                reasoningDepth: options.routeOverride?.reasoningDepth || 'off',
            });
            throw err;
        }
        const text = typeof next === 'string' ? next : next.text;
        return options.returnMeta
            ? {
                  text,
                  meta: {
                      taskId: options.taskId,
                      profileId: options.routeOverride?.primary?.profileId || 'p1',
                      provider: 'openai',
                      modelId: options.routeOverride?.primary?.modelId || 'm1',
                      reasoningDepth: options.routeOverride?.reasoningDepth || 'off',
                      fallback: { used: false, index: 0, mode: 'manual' },
                  },
              }
            : text;
    };
    return { ai: sandbox.ai, calls };
}

test('parseFood retries truncated JSON then returns array', async () => {
    const good = JSON.stringify([{ name: '米饭', grams: 150, cal: 200, pro: 4, carb: 40, fat: 1 }]);
    const { ai, calls } = await loadAiApiWithRunJson(['[{"name":"米饭"', good]);
    const parsed = await ai.parseFood('一碗米饭');
    assert.equal(parsed[0].name, '米饭');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].taskId, 'food.text');
    assert.equal(calls[1].routeOverride.reasoningDepth, 'off');
});

test('parseFoodFromImage retry still returns resolved model meta', async () => {
    const good = JSON.stringify([{ name: '鸡蛋', grams: 50, cal: 70, pro: 6, carb: 1, fat: 5 }]);
    const { ai, calls } = await loadAiApiWithRunJson([
        { throw: { code: 'AI_OUTPUT_TRUNCATED', message: 'truncated', body: '[' } },
        good,
    ]);
    const metas = [];
    const progress = [];
    const parsed = await ai.parseFoodFromImage(
        { name: 'x.jpg' },
        {
            onResolvedMeta: (meta) => metas.push(meta),
            onProgress: (info) => progress.push(info),
        },
    );
    assert.equal(parsed[0].name, '鸡蛋');
    assert.equal(metas[0].modelId, 'm1');
    assert.equal(calls.length, 2);
    assert.ok(progress.some((p) => p.stage === 'retry'));
});
