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
            },
            logicalDateKey(date = new Date('2026-05-30T00:00:00.000Z')) { return new Date(date).toISOString().slice(0, 10); },
            parseHistoryDate(value) { return new Date(value || '2026-05-30T00:00:00.000Z'); },
            isCollapsed() { return false; }
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

test('renderAdviceMessage previews very long historical assistant replies', () => {
    const panel = loadAdvicePanel();
    const longText = `${'一'.repeat(5000)}TAIL${'二'.repeat(8000)}`;

    const html = panel.renderAdviceMessage({ id: 'long-1', role: 'assistant', content: longText, at: '2026-05-30T00:00:00.000Z' }, false, '');

    assert.match(html, /展开完整回复/);
    assert.doesNotMatch(html, /TAIL/);
});

test('renderAdviceMessage keeps latest or searched long assistant replies complete', () => {
    const panel = loadAdvicePanel();
    const longText = `${'一'.repeat(5000)}TAIL${'二'.repeat(8000)}`;

    const latestHtml = panel.renderAdviceMessage({ id: 'long-1', role: 'assistant', content: longText, at: '2026-05-30T00:00:00.000Z' }, true, '');
    const searchHtml = panel.renderAdviceMessage({ id: 'long-1', role: 'assistant', content: longText, at: '2026-05-30T00:00:00.000Z' }, false, 'TAIL');

    assert.match(latestHtml, /TAIL/);
    assert.doesNotMatch(latestHtml, /展开完整回复/);
    assert.match(searchHtml, /TAIL/);
    assert.doesNotMatch(searchHtml, /展开完整回复/);
});

test('renderAdviceMessage marks stopped assistant replies without error state', () => {
    const panel = loadAdvicePanel();

    const html = panel.renderAdviceMessage({ id: 'stop-1', role: 'assistant', content: 'partial answer', stopped: true, at: '2026-05-30T00:00:00.000Z' }, true, '');

    assert.match(html, /advice-bubble assistant stopped/);
    assert.match(html, /已停止生成/);
    assert.match(html, /partial answer/);
    assert.doesNotMatch(html, /advice-error-recovery/);
});

test('renderAdviceMessage renders escaped safe failure details', () => {
    const panel = loadAdvicePanel();
    panel.renderAdviceErrorRecovery = function renderAdviceErrorRecovery(msg) {
        const safe = this.escapeHtml.bind(this);
        const info = msg.errorInfo || {};
        return `<details class="advice-error-details"><summary>查看失败详情</summary><pre>${safe(info.body || info.message || '')}</pre></details>`;
    };

    const html = panel.renderAdviceMessage({
        id: 'err-1',
        role: 'assistant',
        content: 'AI 请求失败',
        error: true,
        at: '2026-05-30T00:00:00.000Z',
        provider: 'openai',
        model: 'gpt-test',
        errorInfo: { type: 'auth', status: 401, body: '<script>secret</script>' }
    }, true, '');

    assert.match(html, /advice-error-details/);
    assert.match(html, /&lt;script&gt;secret&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>secret<\/script>/);
});
