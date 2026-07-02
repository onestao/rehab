import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function loadHealthDiet() {
    const source = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');
    /** @type {any} */
    const context = {
        window: {},
        document: {
            getElementById() {
                return null;
            },
            querySelectorAll() {
                return [];
            }
        }
    };
    vm.runInNewContext(source, context);
    return { api: context.window.dataHealthDiet, context };
}

test('diet meal defaults follow local clock ranges', async () => {
    const { api } = await loadHealthDiet();

    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T05:00:00')), 'breakfast');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T10:29:00')), 'breakfast');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T10:30:00')), 'lunch');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T14:59:00')), 'lunch');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T17:00:00')), 'dinner');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T21:59:00')), 'dinner');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T22:00:00')), 'snack');
    assert.equal(api.defaultDietMealForTime(new Date('2026-07-02T04:59:00')), 'snack');
});

test('manual diet meal selection overrides the clock default for the active entry', async () => {
    const { api, context } = await loadHealthDiet();
    const activeByLabel = {};
    context.document = {
        getElementById() {
            return null;
        },
        querySelectorAll() {
            return ['早餐', '午餐', '晚餐', '加餐'].map(label => ({
                textContent: label,
                classList: {
                    toggle(_className, active) {
                        activeByLabel[label] = active;
                    }
                }
            }));
        }
    };

    const target = { ...api };
    target.applyClockDietMealDefault(new Date('2026-07-02T12:00:00'));
    assert.equal(target._dietMeal, 'lunch');

    target.setDietMeal('breakfast');
    assert.equal(target._dietMeal, 'breakfast');
    assert.equal(activeByLabel['早餐'], true);
    assert.equal(activeByLabel['午餐'], false);
});
