import test from 'node:test';
import assert from 'node:assert/strict';
import { takeQueueBatch } from '../sync-pure.js';

test('takeQueueBatch enforces max batch size', () => {
    const queue = Array.from({ length: 25 }, (_, i) => ({ i }));
    const { batch, tail } = takeQueueBatch(queue, 20);
    assert.equal(batch.length, 20);
    assert.equal(tail.length, 5);
    assert.equal(batch[0].i, 0);
    assert.equal(tail[0].i, 20);
});
