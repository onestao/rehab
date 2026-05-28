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

test('diet photo button remains clickable when support checks fail', async () => {
    const healthDiet = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');

    assert.doesNotMatch(healthDiet, /id="dietPhotoButton"[^>]*disabled/);
    assert.match(healthDiet, /setDietPhotoStatus\('blocked', info\.reason \|\| '当前 AI 配置不可用'\)/);
});

test('diet photo file picker is bound with event listeners and fallback statuses', async () => {
    const healthDiet = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');

    assert.doesNotMatch(healthDiet, /onchange="data\.handleDietPhoto/);
    assert.doesNotMatch(healthDiet, /addEventListener\('cancel'/);
    assert.match(healthDiet, /bindDietPhotoControls\(\)/);
    assert.match(healthDiet, /addEventListener\('change'/);
    assert.match(healthDiet, /setDietPhotoStatus\('waiting', '请选择或拍摄一张照片'\)/);
    assert.match(healthDiet, /setDietPhotoStatus\('empty', '没有收到照片，请重新选择'\)/);
});

test('diet photo has Android camera poll fallback', async () => {
    const healthDiet = await readFile(new URL('../health-diet.js', import.meta.url), 'utf8');

    assert.match(healthDiet, /_startDietPhotoPoll\(input\)/);
    assert.match(healthDiet, /_stopDietPhotoPoll\(\)/);
    assert.match(healthDiet, /_dietPhotoPollTimer/);
    assert.match(healthDiet, /input\.files && input\.files\[0\]/);
    assert.match(healthDiet, /等待照片超时，请重试/);
});
