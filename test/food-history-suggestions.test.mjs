import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

async function loadFoodLog() {
    const source = await readFile(new URL('../food-log.js', import.meta.url), 'utf8');
    return vm.runInNewContext(`${source}\nfoodLog;`, {});
}

function attachFoodLog(foodLog, ctx) {
    Object.assign(ctx, {
        normalizeFoodAlias: foodLog.normalizeFoodAlias,
        foodLogNutritionPer100g: foodLog.foodLogNutritionPer100g,
        buildFoodAliasLookup: foodLog.buildFoodAliasLookup,
        groupHistoricalFoods: foodLog.groupHistoricalFoods,
        parseFoodAliasGroups: foodLog.parseFoodAliasGroups,
        requestFoodAliasGroups: foodLog.requestFoodAliasGroups
    });
    return ctx;
}

test('historical food suggestions prefer recent deduplicated per-100g entries', async () => {
    const foodLog = await loadFoodLog();
    const ctx = attachFoodLog(foodLog, {
        db: {
            health: {
                foodAliasGroups: [],
                foodLogs: [
                    { name: '鸡胸肉', grams: 100, cal: 133, pro: 31, carb: 0, fat: 1.2, date: '2026-05-29' },
                    { name: '牛肉', grams: 100, calPer100g: 125, proPer100g: 20.2, carbPer100g: 0, fatPer100g: 4.2, date: '2026-05-30' },
                    { name: '香煎鸡胸肉', grams: 120, calPer100g: 180, proPer100g: 28, carbPer100g: 2, fatPer100g: 6, date: '2026-05-31' },
                    { name: '鸡胸肉', grams: 150, calPer100g: 133.2, proPer100g: 31, carbPer100g: 0, fatPer100g: 1.2, date: '2026-06-01' },
                    { name: '鸡胸肉', grams: 150, cal: 0, pro: 0, carb: 0, fat: 0, deleted: true, date: '2026-06-02' }
                ]
            }
        },
        activeRecords(items) {
            return items.filter(item => !item.deleted);
        }
    });

    const results = foodLog.historicalFoodSuggestions.call(ctx, '鸡胸');

    assert.equal(results.length, 2);
    assert.equal(results[0].name, '鸡胸肉');
    assert.equal(results[0].grams, 150);
    assert.equal(results[0].cal, 133.2);
    assert.equal(results[1].name, '香煎鸡胸肉');
    assert.equal(results[1].cal, 180);
});

test('historical food suggestions derive per-100g nutrition from older totals', async () => {
    const foodLog = await loadFoodLog();
    const ctx = attachFoodLog(foodLog, {
        db: {
            health: {
                foodAliasGroups: [],
                foodLogs: [
                    { name: '自制饭团', grams: 200, cal: 300, pro: 8, carb: 60, fat: 3, date: '2026-06-01' }
                ]
            }
        },
        activeRecords(items) {
            return items.filter(item => !item.deleted);
        }
    });

    const [result] = foodLog.historicalFoodSuggestions.call(ctx, '饭团');

    assert.equal(result.name, '自制饭团');
    assert.equal(result.cal, 150);
    assert.equal(result.pro, 4);
    assert.equal(result.carb, 30);
    assert.equal(result.fat, 1.5);
});

test('historical food suggestions merge AI alias groups into one candidate', async () => {
    const foodLog = await loadFoodLog();
    const ctx = attachFoodLog(foodLog, {
        db: {
            health: {
                foodAliasGroups: [
                    { canonical: '鸡胸肉', aliases: ['鸡胸肉', '煎鸡胸', '鸡胸肉煎'] }
                ],
                foodLogs: [
                    { name: '鸡胸肉', grams: 100, calPer100g: 133, proPer100g: 31, carbPer100g: 0, fatPer100g: 1.2, date: '2026-05-29' },
                    { name: '煎鸡胸', grams: 120, calPer100g: 180, proPer100g: 28, carbPer100g: 2, fatPer100g: 6, date: '2026-05-31' },
                    { name: '鸡胸肉煎', grams: 150, calPer100g: 170, proPer100g: 29, carbPer100g: 1, fatPer100g: 5, date: '2026-06-01' }
                ]
            }
        },
        activeRecords(items) {
            return items.filter(item => !item.deleted);
        }
    });

    const results = foodLog.historicalFoodSuggestions.call(ctx, '鸡胸');

    assert.equal(results.length, 1);
    assert.equal(results[0].name, '鸡胸肉');
    assert.equal(results[0].grams, 150);
    assert.equal(results[0].mergedCount, 3);
    assert.equal(results[0].entryCount, 3);
    assert.equal(results[0].cal, 161);
    assert.equal(results[0].pro, 29.3);
});

test('AI food name dedupe parser keeps only aliases from input', async () => {
    const foodLog = await loadFoodLog();

    const groups = foodLog.parseFoodAliasGroups('[{"canonical":"鸡胸肉","aliases":["鸡胸肉","煎鸡胸","不存在的名称"]}]', ['鸡胸肉', '煎鸡胸', '牛肉']);

    assert.deepEqual(JSON.parse(JSON.stringify(groups)), [{ canonical: '鸡胸肉', aliases: ['鸡胸肉', '煎鸡胸'] }]);
});
