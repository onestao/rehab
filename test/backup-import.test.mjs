import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';

function loadBackup(overrides = {}) {
  const code = readFileSync(new URL('../backup.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {},
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
