/**
 * Phase C: ensureDeps must stay pure; page side effects only after navigation token.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function readIndex() {
    return readFileSync(path.join(root, 'index.html'), 'utf8');
}

test('source contract: ensureDeps no longer embeds workout/page side effects', () => {
    const source = readIndex();
    const ensureStart = source.indexOf('async function ensureDeps');
    const activateStart = source.indexOf('function activatePageSideEffects');
    assert.ok(ensureStart > 0, 'ensureDeps must exist');
    assert.ok(activateStart > ensureStart, 'activatePageSideEffects must follow ensureDeps');
    const ensureBody = source.slice(ensureStart, activateStart);
    assert.doesNotMatch(ensureBody, /workoutState\.init/);
    assert.doesNotMatch(ensureBody, /setMode\(/);
    assert.doesNotMatch(ensureBody, /swipeActions\.init/);
    assert.doesNotMatch(ensureBody, /bindHotkeys/);
    assert.doesNotMatch(ensureBody, /advicePanel\.attach/);
    assert.match(ensureBody, /loadScript|pending\.map/);
    assert.match(source.slice(activateStart, activateStart + 1200), /workoutState\.init/);
    assert.match(source.slice(activateStart, activateStart + 1200), /setMode\('strength'\)/);
});

test('source contract: _activateTab gates side effects behind navigation token', () => {
    const source = readIndex();
    const activateTab = source.indexOf('async _activateTab');
    assert.ok(activateTab > 0);
    const body = source.slice(activateTab, activateTab + 1800);
    assert.match(body, /await ensureDeps\(id\)/);
    assert.match(body, /if \(!this\.isCurrentNavigation\(navigationToken\)\) return false;/);
    assert.match(body, /activatePageSideEffects\(id\)/);
    // Side effects must appear AFTER the first token check following ensureDeps.
    const depsCall = body.indexOf('await ensureDeps(id)');
    const tokenCheck = body.indexOf('if (!this.isCurrentNavigation(navigationToken)) return false;', depsCall);
    const effectsCall = body.indexOf('activatePageSideEffects(id)', depsCall);
    assert.ok(tokenCheck > depsCall, 'token check after ensureDeps');
    assert.ok(effectsCall > tokenCheck, 'side effects after token check');
});

test('C-T1 unit: cancelled navigation loads modules but skips workout side effects', async () => {
    // Lightweight harness mirroring the split contract without full PAGE_DEPS network.
    const state = {
        loaded: new Set(),
        /** @type {string | null} */
        mode: null,
        workoutStateInit: false,
        swipeInit: false,
        token: 0
    };
    async function ensureDeps(page) {
        // pure: only mark modules loaded
        state.loaded.add(`${page}:scripts`);
        await Promise.resolve();
    }
    function activatePageSideEffects(page) {
        if (page !== 'workout') return;
        state.workoutStateInit = true;
        state.mode = 'strength';
        state.swipeInit = true;
    }
    async function activateTab(id) {
        const navigationToken = ++state.token;
        await ensureDeps(id);
        // Simulate superseding navigation while deps resolve.
        state.token += 1;
        if (navigationToken !== state.token) return false;
        activatePageSideEffects(id);
        return true;
    }
    const cancelled = await activateTab('workout');
    assert.equal(cancelled, false);
    assert.ok(state.loaded.has('workout:scripts'), 'module warm may remain');
    assert.equal(state.workoutStateInit, false);
    assert.equal(state.mode, null);
    assert.equal(state.swipeInit, false);

    // Winning navigation still activates once.
    const ok = await (async () => {
        const navigationToken = ++state.token;
        await ensureDeps('workout');
        if (navigationToken !== state.token) return false;
        activatePageSideEffects('workout');
        return true;
    })();
    assert.equal(ok, true);
    assert.equal(state.mode, 'strength');
    assert.equal(state.workoutStateInit, true);
});
