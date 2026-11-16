import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DB_VERSION,
  STORES,
  dbNameFor,
  openAccountDb,
  putRecord,
  getOne,
} from '../assets/js/db.js';
import {
  tempAccountId,
  openRawDb,
  expectStoreShape,
  deleteAccountDb,
} from './helpers.js';

let accountId;

beforeEach(() => {
  accountId = tempAccountId('schema');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

test(`version ${DB_VERSION} create path creates every store and index`, async () => {
  const database = await openAccountDb(accountId, DB_VERSION);
  assert.equal(database.version, DB_VERSION);
  assert.deepEqual(
    [...database.objectStoreNames].sort(),
    Object.keys(STORES).sort(),
    'a new database must contain every store declared in db.js'
  );
  for (const [storeName, definition] of Object.entries(STORES)) {
    expectStoreShape(database, storeName, definition);
  }
});

test(`reopening at version ${DB_VERSION + 1} keeps rows from the version ${DB_VERSION} database`, async () => {
  const created = await openAccountDb(accountId, DB_VERSION);
  assert.equal(created.version, DB_VERSION);
  const task = {
    id: 'pre-upgrade-task',
    key: 'T-2',
    title: 'Survives a normal upgrade',
    status: 'To do',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  };
  await putRecord('tasks', task);

  const upgraded = await openAccountDb(accountId, DB_VERSION + 1);
  assert.equal(upgraded.version, DB_VERSION + 1);
  assert.deepEqual([...upgraded.objectStoreNames].sort(), Object.keys(STORES).sort());
  assert.deepEqual(await getOne('tasks', task.id), task, 'the upgrade must not drop existing rows');
});

test('upgrade from version 1 to version 2 adds missing stores and keeps existing rows', async () => {
  const existingTask = {
    id: 'existing-task',
    key: 'T-1',
    title: 'Created before the upgrade',
    status: 'To do',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  };

  // Simulate an older install: version 1 with only one store.
  const versionOne = await openRawDb(dbNameFor(accountId), 1, (database) => {
    const tasks = database.createObjectStore('tasks', { keyPath: 'id' });
    tasks.createIndex('status', 'status', { unique: false });
  });
  assert.deepEqual([...versionOne.objectStoreNames], ['tasks']);
  await new Promise((resolve, reject) => {
    const transaction = versionOne.transaction('tasks', 'readwrite');
    transaction.objectStore('tasks').put(existingTask);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  versionOne.close();

  const upgraded = await openAccountDb(accountId, DB_VERSION + 1);
  assert.equal(upgraded.version, DB_VERSION + 1);
  assert.deepEqual(
    [...upgraded.objectStoreNames].sort(),
    Object.keys(STORES).sort(),
    'the upgrade must add stores introduced after version 1'
  );
  for (const [storeName, definition] of Object.entries(STORES)) {
    expectStoreShape(upgraded, storeName, definition);
  }
  assert.deepEqual(
    await getOne('tasks', existingTask.id),
    existingTask,
    'rows written before the upgrade must survive it'
  );
});
