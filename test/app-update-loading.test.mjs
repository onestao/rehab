import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('app update adapter is loaded once through the idle lazy path', () => {
    assert.doesNotMatch(indexSource, /<script[^>]+src="app-update\.js\?v=\d+"/);
    assert.match(indexSource, /loadScript\('app-update'\)/);
    assert.match(indexSource, /appUpdate\.registerServiceWorker/);
});
