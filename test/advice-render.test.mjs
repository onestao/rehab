import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadAdvicePanel() {
    const code = readFileSync(path.join(process.cwd(), 'advice-render.js'), 'utf8');
    const context = {
        advicePanel: {
            escapeHtml(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }
        },
        window: {
            matchMedia() {
                return { matches: false };
            }
        }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.__advicePanel = advicePanel;`, context);
    return context.__advicePanel;
}

test('renderAdviceMarkdown keeps converted comparison table details and raw preview', () => {
    const panel = loadAdvicePanel();
    const input = [
        '### 软组织放松（10分钟）',
        '| 时间/组 | 动作A | 动作B | 更优 |',
        '| --- | --- | --- | --- |',
        '| 3组 | 泡沫轴大腿前外侧 | 泡沫轴阔筋膜张肌 | 动作A更优 |',
        '| 要点 | 外侧链放松 | TFL定点放松 | 动作B更优 |',
        '',
        '---'
    ].join('\n');

    const html = panel.renderAdviceMarkdown(input);

    assert.match(html, /ai-cmp-winner/);
    assert.match(html, /泡沫轴大腿前外侧/);
    assert.match(html, /泡沫轴阔筋膜张肌/);
    assert.match(html, /外侧链放松/);
    assert.match(html, /TFL定点放松/);
    assert.match(html, /动作A更优/);
    assert.match(html, /动作B更优/);
    assert.match(html, /查看原始表格/);
    assert.match(html, /ai-raw-table-preview/);
    assert.match(html, /\| 时间\/组 \| 动作A \| 动作B \| 更优 \|/);
});

test('renderAdviceMarkdown does not treat action tables with safety notes as comparison tables', () => {
    const panel = loadAdvicePanel();
    const input = [
        '### 软组织放松（10分钟）',
        '| 动作 | 时间/组 | 要点 | 安全红线 |',
        '|------|----------|------|----------|',
        '| 泡沫轴大腿前外侧 | 60-90秒/侧 | 找压痛点轻滚 | 疼痛≤3/10 |',
        '| 泡沫轴阔筋膜张肌 | 60-90秒/侧 | 放松髂胫束，注意膝盖轻微屈曲 | 避免髋前夹挤感 |',
        '| 泡沫轴臀大肌/大腿后侧 | 60-90秒/侧 | 释放臀后和腘绳肌 | 避免压到坐骨结节或髋部疼痛 |'
    ].join('\n');

    const html = panel.renderAdviceMarkdown(input);

    assert.doesNotMatch(html, /ai-cmp-winner/);
    assert.doesNotMatch(html, /完胜/);
    assert.match(html, /泡沫轴大腿前外侧/);
    assert.match(html, /安全红线/);
    assert.match(html, /避免髋前夹挤感/);
    assert.match(html, /查看原始表格/);
    assert.match(html, /\| 动作 \| 时间\/组 \| 要点 \| 安全红线 \|/);
});

test('renderAdviceMarkdown renders small two-column metric tables as compact key-value grids', () => {
    const panel = loadAdvicePanel();
    const input = [
        '| 项目 | 数值 |',
        '|---|---:|',
        '| 热量 | **529 kcal** |',
        '| 蛋白质 | **46g** |',
        '| 碳水 | **46g** |',
        '| 脂肪 | **16g** |'
    ].join('\n');

    const html = panel.renderAdviceMarkdown(input);

    assert.match(html, /ai-kv-grid/);
    assert.doesNotMatch(html, /ai-cmp-card/);
    assert.match(html, /热量/);
    assert.match(html, /<strong>529 kcal<\/strong>/);
    assert.match(html, /蛋白质/);
    assert.match(html, /查看原始表格/);
});
