import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyState } from '../storage/migrate-pure.js';

test('migrateLegacyState backfills required arrays and meta', () => {
    const next = migrateLegacyState({ health: { profile: { gender: 'female' } } }, 1000);
    assert.ok(Array.isArray(next.actions));
    assert.ok(Array.isArray(next.health.weights));
    assert.equal(next.health.profile.id, 'profile-1000');
    assert.equal(next.health.profile.updatedAt, 1000);
    assert.equal(next.health.profile.deleted, false);
});
