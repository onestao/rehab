import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadDebugAi() {
    const code = readFileSync(new URL('../debug-ai.js', import.meta.url), 'utf8');
    const events = [];
    const ai = {
        async call(..._args) {
            return '{"items":[{"name":"米饭"}]}';
        },
        _parseAiJsonPayload(raw, _opts = {}) {
            return JSON.parse(raw).items;
        }
    };
    const sandbox = {
        window: {
            ai,
            errorBus: {
                event(scope, type, meta) {
                    events.push({ scope, type, meta });
                }
            }
        },
        console
    };
    vm.runInNewContext(code, sandbox);
    return { sandbox, events, ai };
}

test('AI debug stays inert until enabled', async () => {
    const { sandbox, ai, events } = loadDebugAi();
    const originalCall = ai.call;

    await ai.call([]);
    sandbox.window.aiDebug.patch();

    assert.equal(events.length, 0);
    assert.equal(ai.call, originalCall);
});

test('AI debug patches calls and JSON parsing only when enabled', async () => {
    const { sandbox, ai, events } = loadDebugAi();

    sandbox.window.aiDebug.enable();
    assert.equal('__aiDebugPatched' in ai.call, true);

    await ai.call([{ role: 'user', content: 'hidden prompt' }], 500);
    const parsed = ai._parseAiJsonPayload('{"items":[{"name":"米饭"}]}', { expected: 'array' });

    assert.equal(parsed.length, 1);
    assert.deepEqual(events.map(event => event.type), [
        'runtime:patched',
        'debug:enabled',
        'call:start',
        'call:done',
        'json:parse:done'
    ]);
    assert.equal(events[2].scope, 'ai');
    assert.deepEqual(events[2].meta.roles, ['user']);
    assert.equal('content' in events[2].meta, false);

    sandbox.window.aiDebug.disable();
    assert.equal('__aiDebugPatched' in ai.call, false);
    sandbox.window.aiDebug.patch();
    assert.equal('__aiDebugPatched' in ai.call, false);
});
