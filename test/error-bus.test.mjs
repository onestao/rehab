import test from 'node:test';
import assert from 'node:assert/strict';
import { createErrorBus, isIgnorableBrowserError, mapFriendlyMessage } from '../error-bus-pure.js';

test('error bus caps queue at 100', () => {
    const bus = createErrorBus(100);
    for (let i = 0; i < 105; i++) bus.report('test', new Error(`e${i}`));
    assert.equal(bus.list().length, 100);
    assert.equal(bus.list()[0].message, 'e5');
});

test('network errors map to friendly message', () => {
    assert.equal(mapFriendlyMessage(new Error('Failed to fetch')), '网络异常，请稍后再试');
});

test('report does not throw on weird input', () => {
    const bus = createErrorBus();
    assert.doesNotThrow(() => bus.report('scope', { foo: 'bar' }));
});

test('resize observer loop browser warnings are ignored', () => {
    const bus = createErrorBus();
    const warning = new Error('ResizeObserver loop completed with undelivered notifications.');
    assert.equal(isIgnorableBrowserError(warning), true);
    assert.equal(bus.report('global', warning), null);
    assert.equal(bus.list().length, 0);
});
