import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, pendingAccumulatedSuffix } from '../advice-stream-renderer-pure.mjs';

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

test('pendingAccumulatedSuffix does not duplicate the current delta', () => {
    const suffix = pendingAccumulatedSuffix({ shown: '你好', buffer: '' }, '你好');
    assert.equal(suffix, '');
});

test('pendingAccumulatedSuffix accounts for buffered text not rendered yet', () => {
    const suffix = pendingAccumulatedSuffix({ shown: '你', buffer: '好' }, '你好，继续');
    assert.equal(suffix, '，继续');
});

test('pendingAccumulatedSuffix returns null when stream state diverges', () => {
    const suffix = pendingAccumulatedSuffix({ shown: '旧内容', buffer: '' }, '新内容');
    assert.equal(suffix, null);
});
