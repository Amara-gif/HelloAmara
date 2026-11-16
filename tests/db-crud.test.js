import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DB_VERSION,
  STORES,
  dbNameFor,
  openAccountDb,
  putRecord,
  putRecords,
  getOne,
  getAll,
  clearStore,
  clearAllStores,
} from '../assets/js/db.js';
import {
  tempAccountId,
  recordFor,
  keyFor,
  expectStoreShape,
  deleteAccountDb,
} from './helpers.js';

let accountId;

beforeEach(() => {
  accountId = tempAccountId('crud');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

test('opens a temporary database with the full current schema', async () => {
  const database = await openAccountDb(accountId);
  assert.equal(database.name, dbNameFor(accountId));
  assert.equal(database.version, DB_VERSION);
  assert.deepEqual(
    [...database.objectStoreNames].sort(),
    Object.keys(STORES).sort(),
    'every store in db.js must exist after the version 1 create path'
  );
  for (const [storeName, definition] of Object.entries(STORES)) {
    expectStoreShape(database, storeName, definition);
  }
});

for (const storeName of Object.keys(STORES)) {
  test(`put/get/getAll/clear round trip for ${storeName}`, async () => {
    await openAccountDb(accountId);
    const record = recordFor(storeName);
    const key = keyFor(storeName, record);

    await putRecord(storeName, record);
    assert.deepEqual(await getOne(storeName, key), record, `${storeName} get returns the put row`);

    const updated = { ...record, marker: 'updated' };
    await putRecord(storeName, updated);
    assert.deepEqual(await getOne(storeName, key), updated, `${storeName} put updates an existing key`);
    assert.deepEqual(await getAll(storeName), [updated], `${storeName} getAll returns the current rows`);

    await clearStore(storeName);
    assert.deepEqual(await getAll(storeName), [], `${storeName} clear removes all rows`);
    assert.equal(await getOne(storeName, key), undefined, `${storeName} get is empty after clear`);
  });
}

test('putRecords writes a batch and skips an empty batch', async () => {
  await openAccountDb(accountId);
  const rows = [
    { ...recordFor('tasks'), id: 'bulk-1', key: 'T-1' },
    { ...recordFor('tasks'), id: 'bulk-2', key: 'T-2' },
  ];

  await putRecords('tasks', rows);
  assert.deepEqual(
    (await getAll('tasks')).map((row) => row.id).sort(),
    ['bulk-1', 'bulk-2']
  );

  await putRecords('tasks', []);
  assert.equal((await getAll('tasks')).length, 2, 'an empty batch leaves existing rows alone');
});

test('clearAllStores empties every store in one transaction', async () => {
  await openAccountDb(accountId);
  for (const storeName of Object.keys(STORES)) {
    await putRecord(storeName, recordFor(storeName));
  }

  await clearAllStores();
  for (const storeName of Object.keys(STORES)) {
    assert.deepEqual(await getAll(storeName), [], `${storeName} should be empty`);
  }
});
