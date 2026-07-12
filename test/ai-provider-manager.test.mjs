import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ai-provider-manager.js', import.meta.url), 'utf8');
const pickerSource = await readFile(new URL('../ai-task-settings.js', import.meta.url), 'utf8');

test('provider manager exposes archived restore and pending migration flows', () => {
    assert.match(source, /showArchived/);
    assert.match(source, /async restore\(profileId\)/);
    assert.match(source, /renderMigration\(body, title\)/);
    assert.match(source, /migrationStatus: 'confirmed'/);
});

test('permanent provider deletion clears legacy credentials and repairs active profile', () => {
    assert.match(source, /idbDelete\(root\.ai\.apiKeyKey\(profileId\)\)/);
    assert.match(source, /localStorage\.removeItem\(root\.ai\.apiKeyKey\(profileId\)\)/);
    assert.match(source, /cfg\.activeProfileId === profileId/);
});

test('model picker renders actionable empty and explicit invalid states', () => {
    assert.match(pickerSource, /unavailableReason\(route, models\)/);
    assert.match(pickerSource, /\u7ba1\u7406\u4f9b\u5e94\u5546/);
    assert.match(pickerSource, /model\?\.family/);
});
