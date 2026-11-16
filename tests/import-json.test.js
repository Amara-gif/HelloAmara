import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DB_VERSION, STORES, getAll, getOne, putRecord } from '../assets/js/db.js';
import {
  start,
  getState,
  buildExport,
  parseImportJson,
  validateImportPayload,
  planImport,
  applyImportPlan,
  importBackup,
} from '../assets/js/data.js';
import { renderView } from '../assets/js/views.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const accounts = [];

function accountId(label) {
  const id = tempAccountId(label);
  accounts.push(id);
  return id;
}

beforeEach(() => {
  accounts.length = 0;
});

afterEach(async () => {
  for (const id of accounts) await deleteAccountDb(id);
});

function backup(stores = {}) {
  return {
    schemaVersion: DB_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'device-source',
    stores: {
      ...Object.fromEntries(Object.keys(STORES).map((name) => [name, []])),
      ...stores,
    },
  };
}

function task(id, title, updatedAt, deletedAt = null) {
  return { id, key: id.toUpperCase(), title, updatedAt, deletedAt };
}

test('a backup exported from one account merges into an empty account data row for row', async () => {
  const sourceId = accountId('import-source');
  const targetId = accountId('import-target');

  await start({ id: sourceId, name: 'Import source', test: true });
  const payload = await buildExport();
  const sourceCounts = {};
  for (const name of Object.keys(STORES)) sourceCounts[name] = (await getAll(name)).length;
  const sourceSettings = (await getOne('meta', 'settings')).value;

  await start({ id: targetId, name: 'Import target', test: false });
  const targetDevice = (await getOne('meta', 'deviceId')).value;
  assert.equal((await getAll('tasks')).length, 0, 'the target account starts empty');

  const plan = await planImport(payload);
  assert.ok(plan.added > 0, 'the source rows are additions in the empty account');
  assert.equal(plan.updated, 0);
  assert.ok(plan.skipped > 0, 'local device-only meta rows are kept, not overwritten');

  await applyImportPlan(plan);
  for (const name of Object.keys(STORES).filter((name) => name !== 'meta')) {
    assert.equal((await getAll(name)).length, sourceCounts[name], `${name} row count matches the export`);
  }
  assert.deepEqual((await getOne('meta', 'settings')).value, sourceSettings, 'settings move with the backup');
  assert.equal((await getOne('meta', 'deviceId')).value, targetDevice, 'the target device id stays local');
  assert.equal((await getOne('meta', 'seedVersion')), undefined, 'the source demo seed marker is not copied');
});

test('merge by id lets the newer updatedAt win and skips equal or older rows', async () => {
  const id = accountId('import-merge');
  await start({ id, name: 'Import merge', test: false });
  const older = '2026-01-01T00:00:00.000Z';
  const newer = '2026-02-01T00:00:00.000Z';

  await putRecord('tasks', task('t-local-new', 'Local newer', newer));
  await putRecord('tasks', task('t-local-old', 'Local older', older));

  const plan = await planImport(backup({
    tasks: [
      task('t-local-new', 'Incoming older', older),
      task('t-local-old', 'Incoming newer', newer),
      task('t-added', 'Incoming new', newer),
    ],
  }));
  assert.deepEqual(plan.totals, { added: 1, updated: 1, skipped: 1, deleted: 0 });

  const result = await applyImportPlan(plan);
  assert.equal(result.mode, 'merge');
  const rows = Object.fromEntries((await getAll('tasks')).map((row) => [row.id, row]));
  assert.equal(rows['t-local-new'].title, 'Local newer', 'older incoming row does not overwrite');
  assert.equal(rows['t-local-old'].title, 'Incoming newer', 'newer incoming row overwrites');
  assert.equal(rows['t-added'].title, 'Incoming new');
  assert.equal(getState().tasks.length, 3);
});

test('soft-deleted rows follow the same updatedAt rule and stay hidden from state', async () => {
  const id = accountId('import-soft-delete');
  await start({ id, name: 'Import soft delete', test: false });
  const older = '2026-01-01T00:00:00.000Z';
  const newer = '2026-02-01T00:00:00.000Z';

  await putRecord('tasks', task('t-tombstone-wins', 'Local live', older));
  await putRecord('tasks', task('t-local-tombstone-wins', 'Local tombstone', older, older));

  const plan = await planImport(backup({
    tasks: [
      task('t-tombstone-wins', 'Incoming deleted', newer, newer),
      task('t-local-tombstone-wins', 'Incoming live', older),
    ],
  }));
  assert.equal(plan.updated, 1);
  assert.equal(plan.skipped, 1);
  assert.equal(plan.deleted, 1, 'updated count records the incoming tombstone');

  await applyImportPlan(plan);
  assert.ok((await getOne('tasks', 't-tombstone-wins')).deletedAt, 'a newer tombstone is written');
  assert.ok((await getOne('tasks', 't-local-tombstone-wins')).deletedAt, 'an older live row cannot resurrect a local tombstone');
  const stateIds = getState().tasks.map((row) => row.id);
  assert.ok(!stateIds.includes('t-tombstone-wins'));
  assert.ok(!stateIds.includes('t-local-tombstone-wins'));
});

test('invalid JSON, schema and structure are rejected with clear messages', () => {
  assert.throws(() => parseImportJson(''), /empty/i);
  assert.throws(() => parseImportJson('{not json'), /not valid JSON/i);
  assert.throws(() => parseImportJson('[]'), /not a My Platform backup object/i);

  const wrongVersion = backup();
  wrongVersion.schemaVersion = DB_VERSION + 1;
  assert.throws(() => validateImportPayload(wrongVersion), /Unsupported backup schema version/i);

  const noExportedAt = backup();
  noExportedAt.exportedAt = 'not-a-date';
  assert.throws(() => validateImportPayload(noExportedAt), /invalid exportedAt/i);

  const noDevice = backup();
  delete noDevice.deviceId;
  assert.throws(() => validateImportPayload(noDevice), /no deviceId/i);

  const noStores = backup();
  noStores.stores = [];
  assert.throws(() => validateImportPayload(noStores), /no stores object/i);

  const missingStore = backup();
  delete missingStore.stores.bugs;
  assert.throws(() => validateImportPayload(missingStore), /missing the .*bugs.* store array/i);

  const unknownStore = backup({ extra: [] });
  assert.throws(() => validateImportPayload(unknownStore), /unknown stores: extra/i);

  const missingId = backup({ tasks: [{ key: 'T-1', updatedAt: '2026-01-01T00:00:00.000Z' }] });
  assert.throws(() => validateImportPayload(missingId), /tasks.*no .*id/i);

  const badUpdatedAt = backup({ tasks: [task('t-bad', 'Bad', 'yesterday')] });
  assert.throws(() => validateImportPayload(badUpdatedAt), /invalid updatedAt/i);

  const duplicateId = backup({ tasks: [task('t-dup', 'One', '2026-01-01T00:00:00.000Z'), task('t-dup', 'Two', '2026-01-02T00:00:00.000Z')] });
  assert.throws(() => validateImportPayload(duplicateId), /duplicate id/i);
});

test('replace all is explicit, clears local-only rows and keeps the local device id', async () => {
  const id = accountId('import-replace');
  await start({ id, name: 'Import replace', test: false });
  const deviceId = (await getOne('meta', 'deviceId')).value;
  await putRecord('tasks', task('t-local-only', 'Local only', '2026-01-01T00:00:00.000Z'));
  await putRecord('tasks', task('t-from-file', 'Local newer', '2026-06-01T00:00:00.000Z'));

  const payload = backup({
    tasks: [
      task('t-from-file', 'From file older', '2026-01-01T00:00:00.000Z'),
      task('t-from-file-new', 'From file new', '2026-01-01T00:00:00.000Z'),
    ],
  });

  const mergePlan = await planImport(payload);
  assert.equal(mergePlan.added, 1, 'the merge plan is read-only');
  assert.equal(mergePlan.skipped, 1, 'merge would keep the newer local copy');
  assert.equal((await getAll('tasks')).length, 2, 'planning does not write');

  const result = await applyImportPlan(mergePlan, { mode: 'replace' });
  assert.equal(result.mode, 'replace');
  assert.deepEqual(result.totals, { added: 2, updated: 0, skipped: 0, deleted: 0 });
  const replaced = await getAll('tasks');
  assert.deepEqual(replaced.map((row) => row.id).sort(), ['t-from-file', 't-from-file-new']);
  assert.equal(replaced.find((row) => row.id === 't-from-file').title, 'From file older', 'replace writes every file row, even an older one');
  assert.equal((await getOne('meta', 'deviceId')).value, deviceId);

  await putRecord('tasks', task('t-local-only-again', 'Local only again', '2026-01-01T00:00:00.000Z'));
  const defaultPlan = await planImport(payload);
  const mergeResult = await applyImportPlan(defaultPlan);
  assert.equal(mergeResult.mode, 'merge');
  const merged = (await getAll('tasks')).map((row) => row.id);
  assert.ok(merged.includes('t-local-only-again'), 'merge never removes local-only rows');
  assert.ok(merged.includes('t-from-file'));
  await assert.rejects(() => applyImportPlan(defaultPlan, { mode: 'overwrite' }), /Choose Merge or Replace all/i);
});

test('importBackup combines planning and applying and settings backup card exposes the picker', async () => {
  const id = accountId('import-entry');
  await start({ id, name: 'Import entry', test: false });
  const result = await importBackup(backup({
    tasks: [task('t-imported', 'Imported', '2026-01-01T00:00:00.000Z')],
  }));
  assert.equal(result.added, 1);
  assert.ok(getState().tasks.some((row) => row.id === 't-imported'));

  const html = renderView({ id: 'settings', title: 'Settings' }, new URLSearchParams(), getState());
  assert.match(html, /data-import-file/);
  assert.match(html, /accept="application\/json,\.json"/);
  assert.match(html, /Import a backup/);
  assert.match(html, /added, updated and skipped counts/);
  assert.match(html, /Replace all/);
});
