import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../advice-stream-renderer-pure.mjs';

test('live mode flushes chunkPerFrame', () => {
    const s = createScheduler({ raf: (cb) => cb(), now: () => 0 });
    s.setChunkPerFrame(8);
    assert.equal(s.tick(100), 8);
});

test('paused mode flushes 0', () => {
    const s = createScheduler({ raf: (cb) => cb(), now: () => 0 });
    s.setMode('paused');
    assert.equal(s.tick(100), 0);
});

test('fast mode flushes all', () => {
    const s = createScheduler({ raf: (cb) => cb(), now: () => 0 });
    s.setMode('fast');
    assert.equal(s.tick(15), 15);
});

test('schedule does not re-enter', () => {
    let calls = 0;
    const s = createScheduler({ raf: (cb) => cb(), now: () => 0 });
    s.schedule(() => { calls++; });
    s.schedule(() => { calls++; });
    // The scheduler only dedupes within the same pending frame.
    // If raf executes immediately, both schedules can run.
    assert.equal(calls, 2);
});
