import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { start, getState } from '../assets/js/data.js';
import { getOne } from '../assets/js/db.js';
import { renderView } from '../assets/js/views.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let accountId;

function setNavigatorStorage(storage) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: storage === undefined ? {} : { storage },
  });
}

async function startAccount() {
  await start({ id: accountId, name: 'Storage persist test', test: false });
  return getState();
}

beforeEach(() => {
  accountId = tempAccountId('storage-persist');
});

afterEach(async () => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
  await deleteAccountDb(accountId);
});

test('account boot calls persist() and stores a granted boolean in meta', async () => {
  let calls = 0;
  setNavigatorStorage({
    persist: async () => {
      calls += 1;
      return true;
    },
  });

  const state = await startAccount();

  assert.equal(calls, 1, 'persist() is called once on account boot');
  assert.equal((await getOne('meta', 'storagePersist')).value, true);
  assert.equal((await getOne('meta', 'storagePersistSupported')).value, true);
  assert.equal(state.persistentStorage.status, 'Granted');
  assert.equal(state.persistentStorage.granted, true);
  assert.equal(state.persistentStorage.supported, true);
});

test('a denied persist() request is stored and shown as Denied', async () => {
  setNavigatorStorage({ persist: async () => false });

  const state = await startAccount();

  assert.equal((await getOne('meta', 'storagePersist')).value, false);
  assert.equal(state.persistentStorage.status, 'Denied');
  assert.equal(state.persistentStorage.granted, false);
  assert.match(renderView({ id: 'settings', title: 'Settings' }, new URLSearchParams(), state), /Denied/);
});

test('a browser without storage.persist is stored and shown as Unsupported', async () => {
  setNavigatorStorage(undefined);

  const state = await startAccount();

  assert.equal((await getOne('meta', 'storagePersist')).value, false);
  assert.equal((await getOne('meta', 'storagePersistSupported')).value, false);
  assert.equal(state.persistentStorage.status, 'Unsupported');
  const html = renderView({ id: 'settings', title: 'Settings' }, new URLSearchParams(), state);
  assert.match(html, /Persistent storage/);
  assert.match(html, /Unsupported/);
});
