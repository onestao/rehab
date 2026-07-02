import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { backupImportPure, buildBackupImportPlan } from '../backup-import-pure.js';
import { planBackupRingPrune, sortSnapshotsNewestFirst } from '../backup-ring-pure.js';

function loadBackup(overrides = {}) {
  const code = readFileSync(new URL('../backup.js', import.meta.url), 'utf8');
  const sandbox = {
    window: { backupImportPure },
    Blob,
    Response,
    TextDecoder,
    TextEncoder,
    DecompressionStream,
    CompressionStream,
    crypto: globalThis.crypto,
    console,
    navigator: {},
    indexedDB: {},
    data: {}
  };
  Object.assign(sandbox, overrides);
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.backup;
}

test('backup import detects gzip by magic bytes when Android omits .gz filename', async () => {
  const backup = loadBackup();
  const payload = JSON.stringify({ app: '训练助手', db: { schemaVersion: 1, actions: [] } });
  const gz = gzipSync(Buffer.from(payload));
  const file = new File([gz], 'rehab-backup', { type: 'application/octet-stream' });

  assert.equal(backup.isGzipBackupFile(file, new Uint8Array(gz.subarray(0, 2))), true);
  assert.equal(await backup.readBackupFileText(file), payload);
});

test('backup import still accepts plain json files', async () => {
  const backup = loadBackup();
  const payload = JSON.stringify({ db: { schemaVersion: 1 } });
  const file = new File([payload], 'rehab.json', { type: 'application/json' });

  assert.equal(backup.isGzipBackupFile(file, new Uint8Array(await file.arrayBuffer()).subarray(0, 2)), false);
  assert.equal(await backup.readBackupFileText(file), payload);
});

test('backup checksum works when crypto.subtle is unavailable on insecure Android HTTP', async () => {
  const backup = loadBackup({ crypto: {} });

  assert.equal(
    await backup.sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('backup import plan reports schema and count risks before mutation', () => {
  const plan = buildBackupImportPlan({
    nextDb: { schemaVersion: 5, actions: [] },
    meta: { schemaVersion: 5, itemCounts: { actions: 1, history: 2 } },
    localDb: { actions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], history: Array.from({ length: 8 }) },
    localSchemaVersion: 3,
    checksumStatus: 'verified'
  });

  assert.equal(plan.checksumStatus, 'verified');
  assert.deepEqual(plan.schemaRisk, {
    remote: 5,
    local: 3,
    message: '备份文件 schemaVersion(5) 高于本地(3)，导入可能导致兼容问题，是否继续？'
  });
  assert.deepEqual(plan.countRisks.map((risk) => risk.key), ['actions', 'history']);
  assert.equal(plan.needsSchemaConfirm, true);
  assert.equal(plan.needsCountConfirm, true);
});

test('backup import rejects bad checksum after creating pre-import snapshot', async () => {
  const alerts = [];
  const confirms = [];
  const snapshots = [];
  const localDb = { actions: [{ id: 'local' }], health: {} };
  const data = {
    SCHEMA_VERSION: 3,
    db: localDb,
    normalizeDb() {},
    save() {},
    async flush() {},
    render() {}
  };
  const backup = loadBackup({
    data,
    confirm(message) { confirms.push(message); return true; },
    alert(message) { alerts.push(message); }
  });
  backup.buildArchive = async () => ({ blob: new Blob(['before']), filename: 'before.json.gz' });
  backup.snapshotToRing = async (_blob, _filename, source) => { snapshots.push(source); };

  const file = new File([JSON.stringify({ db: { actions: [] }, checksum: 'bad' })], 'bad.json', { type: 'application/json' });
  const target = { files: [file], value: 'selected' };
  await backup.importFile({ target });

  assert.deepEqual(snapshots, ['pre-import']);
  assert.equal(confirms.length, 0);
  assert.match(alerts.at(-1), /checksum 不匹配/);
  assert.equal(data.db, localDb);
  assert.equal(target.value, '');
});

test('backup import count drop asks for confirmation and preserves local data when declined', async () => {
  const confirms = [];
  const snapshots = [];
  const localDb = { history: Array.from({ length: 10 }, (_, id) => ({ id })), health: {} };
  const data = {
    SCHEMA_VERSION: 3,
    db: localDb,
    normalizeDb() {},
    save() {},
    async flush() {},
    render() {}
  };
  const backup = loadBackup({
    data,
    confirm(message) {
      confirms.push(message);
      return confirms.length === 1;
    },
    alert() {}
  });
  backup.buildArchive = async () => ({ blob: new Blob(['before']), filename: 'before.json.gz' });
  backup.snapshotToRing = async (_blob, _filename, source) => { snapshots.push(source); };

  const remoteDb = { schemaVersion: 3, history: [{ id: 'remote' }], health: {} };
  const file = new File([JSON.stringify({ db: remoteDb, schemaVersion: 3, itemCounts: { history: 1 } })], 'drop.json', { type: 'application/json' });
  const target = { files: [file], value: 'selected' };
  await backup.importFile({ target });

  assert.deepEqual(snapshots, ['pre-import']);
  assert.match(confirms[0], /导入前已自动创建本地回滚快照/);
  assert.match(confirms[1], /远端 history 数量\(1\)远小于本地\(10\)/);
  assert.equal(data.db, localDb);
  assert.equal(target.value, '');
});

test('backup ring prune keeps newest critical pre-import and pre-pull snapshots', () => {
  const snapshots = Array.from({ length: 12 }, (_, index) => ({
    id: `manual-${index}`,
    source: 'manual',
    createdAt: 1000 + index,
    size: 1
  }));
  snapshots.push(
    { id: 'pre-import-old', source: 'pre-import', createdAt: 900, size: 1 },
    { id: 'pre-import-new', source: 'pre-import', createdAt: 1005, size: 1 },
    { id: 'pre-pull-only', source: 'pre-pull', createdAt: 850, size: 1 }
  );

  const plan = planBackupRingPrune(snapshots, { maxCount: 10 });

  assert.equal(plan.deleteIds.includes('pre-import-new'), false);
  assert.equal(plan.deleteIds.includes('pre-pull-only'), false);
  assert.equal(plan.deleteIds.includes('pre-import-old'), true);
  assert.ok(plan.keepItems.length >= 10);
});

test('backup ring prune keeps a minimum recovery set when quota is low', () => {
  const snapshots = [
    { id: 'manual-old', source: 'manual', createdAt: 1, size: 1024 },
    { id: 'pre-pull', source: 'pre-pull', createdAt: 2, size: 1024 },
    { id: 'pre-import', source: 'pre-import', createdAt: 3, size: 1024 },
    { id: 'manual-new', source: 'manual', createdAt: 4, size: 1024 },
    { id: 'manual-newer', source: 'manual', createdAt: 5, size: 1024 }
  ];

  const plan = planBackupRingPrune(snapshots, { quotaLow: true, quotaLowCount: 3, maxBytes: 1 });
  const keptIds = plan.keepItems.map((item) => item.id);

  assert.deepEqual(keptIds, ['manual-newer', 'pre-import', 'pre-pull']);
  assert.deepEqual(plan.deleteIds, ['manual-new', 'manual-old']);
});

test('backup ring snapshot list sorts newest first', () => {
  const sorted = sortSnapshotsNewestFirst([
    { id: 'old', createdAt: 1 },
    { id: 'new', createdAt: 3 },
    { id: 'middle', createdAt: 2 }
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['new', 'middle', 'old']);
});
