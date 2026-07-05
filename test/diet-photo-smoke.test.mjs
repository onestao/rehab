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
    const precacheAssets = sw.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1] || '';
    assert.doesNotMatch(precacheAssets, /assets\/heic2any\.min\.js/);
    assert.doesNotMatch(precacheAssets, /ai-vision-pure\.mjs|assets\/vision-models\.json/);
    assert.match(sw, /RUNTIME_CACHE_FIRST_ASSETS[\s\S]*assets\/heic2any\.min\.js/);
    assert.match(sw, /fetchRuntimeCacheFirst/);
    assert.match(healthDiet, /image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif/);
    assert.match(heicBundle, /heic2any/);
});

test('diet photo button remains clickable when support checks fail', async () => {
    const healthDiet = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');

    assert.doesNotMatch(healthDiet, /id="dietPhotoButton"[^>]*disabled/);
    assert.match(healthDiet, /setDietPhotoStatus\('blocked', info\.reason \|\| '当前 AI 配置不可用'\)/);
});

test('diet photo file picker is bound with event listeners and fallback statuses', async () => {
    const healthDiet = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');

    assert.doesNotMatch(healthDiet, /onchange="data\.handleDietPhoto/);
    assert.doesNotMatch(healthDiet, /addEventListener\('cancel'/);
    assert.doesNotMatch(healthDiet, /capture="environment"/);
    assert.match(healthDiet, /bindDietPhotoControls\(\)/);
    assert.match(healthDiet, /addEventListener\('change'/);
    assert.match(healthDiet, /setDietPhotoStatus\('waiting', '请选择或拍摄一张照片'\)/);
    assert.match(healthDiet, /setDietPhotoStatus\('empty', '没有收到照片，请重新选择'\)/);
});

test('diet photo file input accepts images without forcing camera capture', async () => {
    const healthDiet = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');

    assert.match(healthDiet, /accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif"/);
    assert.doesNotMatch(healthDiet, /capture=/);
    assert.match(healthDiet, /图片识别/);
});
