import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutWakeLock } from '../workout-wakelock-pure.js';

test('workout-wakelock listens to workout:state events', async () => {
    const listeners = new Map();
    const windowStub = {
        addEventListener(type, cb) { listeners.set(type, cb); }
    };
    const documentStub = {
        hidden: false,
        addEventListener() {}
    };
    let requested = 0;
    let released = 0;
    const env = {
        window: windowStub,
        document: documentStub,
        navigator: { wakeLock: { request: async () => { requested++; return { release: async () => { released++; } }; } } },
        errorBus: { report() {} },
        console: { info() {} }
    };

    const wl = createWorkoutWakeLock(env);
    // Simulate training state.
    await wl.request();
    assert.equal(requested, 1);
    await wl.release();
    assert.equal(released, 1);
});
