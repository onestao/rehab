import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('diet photo browser assets are wired for offline use', async () => {
    const [html, sw, healthDiet, heicBundle] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../sw.js', import.meta.url), 'utf8'),
        readFile(new URL('../health-diet.js', import.meta.url), 'utf8'),
        readFile(new URL('../assets/heic2any.min.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /ai-vision-pure/);
    assert.match(sw, /ai-vision-pure\.mjs\?v=/);
    assert.match(sw, /assets\/vision-models\.json/);
    assert.match(sw, /assets\/heic2any\.min\.js/);
    assert.match(healthDiet, /image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif/);
    assert.match(heicBundle, /heic2any/);
});
