import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadDataUiState(navStack) {
    const code = readFileSync(new URL('../data-ui-state.js', import.meta.url), 'utf8');
    const sandbox = { window: { navStack }, console };
    vm.runInNewContext(code, sandbox);
    return sandbox.window.dataUiState;
}

test('routine subpages push one back-stack level and close to home', () => {
    const calls = [];
    const navStack = {
        replaceOrPush(entry) {
            calls.push(['replaceOrPush', entry.type, entry.id]);
            this.entry = entry;
        },
        popType(type) {
            calls.push(['popType', type]);
        }
    };
    const api = loadDataUiState(navStack);
    const data = {
        ...api,
        routineView: 'home',
        renderRoutinesCount: 0,
        captureAdviceDraft() {},
        renderRoutines() { this.renderRoutinesCount += 1; }
    };

    data.setRoutineView('library');
    assert.equal(data.routineView, 'library');
    assert.deepEqual(calls[0], ['replaceOrPush', 'subtab', 'routine']);

    assert.equal(navStack.entry.close(), true);
    assert.equal(data.routineView, 'home');
    assert.equal(data.renderRoutinesCount, 2);
    assert.deepEqual(calls, [['replaceOrPush', 'subtab', 'routine']]);

    data.setRoutineView('home');
    assert.deepEqual(calls[1], ['popType', 'subtab']);
});
