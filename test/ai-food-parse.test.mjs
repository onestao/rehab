import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

async function loadFoodLog() {
    const source = await readFile(new URL('../food-log.js', import.meta.url), 'utf8');
    return vm.runInNewContext(`${source}\nfoodLog;`, {});
}

async function loadAiApi(raw) {
    const source = await readFile(new URL('../ai-api.js', import.meta.url), 'utf8');
    const sandbox = {
        ai: {},
        window: {
            dataAiTemplates: null,
            data: { db: {} }
        },
        console
    };
    vm.runInNewContext(`${source}\nai;`, sandbox);
    sandbox.ai.call = async () => raw;
    return sandbox.ai;
}

test('normalizes Chinese AI food fields into app nutrition fields', async () => {
    const foodLog = await loadFoodLog();

    const items = foodLog.normalizeAiFoodItems(JSON.parse(JSON.stringify([
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
            备注: '蛋白较高'
        }
    ])));

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
        note: '蛋白较高'
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
                    fat: 2.2
                }
            }
        }
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

    const [item1] = foodLog.normalizeAiFoodItems([{ name: '能量棒', grams: 50, energy: '836 kJ', protein: 10 }]);
    assert.equal(item1.cal, 199.8);
    assert.equal(item1.pro, 10);

    const [item2] = foodLog.normalizeAiFoodItems([{ name: '牛奶', energy: { value: 836, unit: 'kJ' } }]);
    assert.equal(item2.cal, 199.8);
});

test('parseFood accepts fenced, wrapped, and noisy model JSON responses', async () => {
    const cases = [
        {
            raw: '```json\n[{"name":"鸡胸肉","grams":120}]\n```',
            name: '鸡胸肉'
        },
        {
            raw: '识别结果：{"foods":[{"name":"米饭","grams":150}]}',
            name: '米饭'
        },
        {
            raw: '{"name":"鸡蛋","grams":50,"cal":70}',
            name: '鸡蛋'
        },
        {
            raw: '结果：[{"name":"豆浆","grams":300}]\n备注：[完成]',
            name: '豆浆'
        }
    ];

    for (const item of cases) {
        const ai = await loadAiApi(item.raw);
        const parsed = await ai.parseFood('早餐');
        assert.equal(parsed[0].name, item.name);
    }
});
