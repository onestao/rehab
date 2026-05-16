import test from 'node:test';
import assert from 'node:assert/strict';
import {
    countActionReferences,
    mergeLibraryTags,
    nextLibraryView,
    clampSwipeProgress
} from '../data-utils-pure.js';

test('countActionReferences counts sourceActionId hits', () => {
    const routines = [
        { actions: [{ sourceActionId: 'a1' }, { sourceActionId: 'a2' }] },
        { actions: [{ sourceActionId: 'a1' }] }
    ];
    assert.equal(countActionReferences('a1', routines), 2);
    assert.equal(countActionReferences('a2', routines), 1);
    assert.equal(countActionReferences('a3', routines), 0);
});

test('mergeLibraryTags merges and sorts unique tags', () => {
    const actions = [{ tags: ['推', '拉', '  核心'] }, { tags: ['拉'] }];
    const routines = [{ tags: ['增肌', '核心'] }, { tags: [] }];
    const out = mergeLibraryTags(actions, routines);
    assert.deepEqual(out, ['核心', '拉', '推', '增肌']);
});

test('nextLibraryView shifts with boundaries', () => {
    assert.equal(nextLibraryView('actions', 1), 'routines');
    assert.equal(nextLibraryView('routines', 1), 'routines');
    assert.equal(nextLibraryView('routines', -1), 'actions');
    assert.equal(nextLibraryView('actions', -1), 'actions');
});

test('clampSwipeProgress applies rubber-band at edges', () => {
    const width = 320;
    assert.equal(clampSwipeProgress(64, width, 0, 2), 0.2 * 0.35);
    assert.equal(clampSwipeProgress(-64, width, 1, 2), -0.2 * 0.35);
    assert.equal(clampSwipeProgress(-64, width, 0, 2), -0.2);
});
