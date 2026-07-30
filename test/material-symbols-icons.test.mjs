// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractFromContent } from '../scripts/collect-icons.mjs';

test('Material Symbols collector captures dynamic status maps and order tuples', () => {
    const icons = extractFromContent(`
        const meta = value => ({
            official: ['account_tree', 'Official'],
            database: ['database', 'Database'],
            vision: ['photo_camera', 'Vision']
        }[value]?.reduce((out, value, index) => ({ ...out, [index ? 'label' : 'icon']: value }), {}));
        const icon = name => '<span class="material-symbols-rounded">' + name + '</span>';
        for (const [symbol, label, delta] of [['arrow_upward', 'Up', -1], ['arrow_downward', 'Down', 1]]) icon(symbol);
        icon('tune');
    `);
    for (const name of ['account_tree', 'database', 'photo_camera', 'arrow_upward', 'arrow_downward', 'tune']) {
        assert.equal(icons.has(name), true, name);
    }
});

test('committed Material Symbols lists are sorted, unique, and synchronized', () => {
    const lines = readFileSync(new URL('../build/icons.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);
    const csv = readFileSync(new URL('../build/icons.csv', import.meta.url), 'utf8').trim();
    const bundled = readFileSync(new URL('../assets/material-symbols-icons.txt', import.meta.url), 'utf8').trim();
    assert.deepEqual(lines, [...new Set(lines)].sort());
    assert.equal(csv, lines.join(','));
    assert.equal(bundled, csv);
    for (const name of ['account_tree', 'database', 'photo_camera', 'arrow_upward', 'arrow_downward']) assert.ok(lines.includes(name), name);
});
