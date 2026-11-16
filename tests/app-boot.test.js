import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_ACCOUNT,
  listAccounts,
  getAccount,
  setActiveAccount,
  getActiveAccountId,
} from '../assets/js/accounts.js';
import { start, getState } from '../assets/js/data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

test('Test account is always registered and boots with seeded live data', async () => {
  const accounts = listAccounts();
  assert.ok(
    accounts.some((account) => account.id === TEST_ACCOUNT.id && account.test),
    'the Test account must be present even on a clean LocalStorage'
  );
  assert.deepEqual(getAccount(TEST_ACCOUNT.id), TEST_ACCOUNT);
  setActiveAccount(TEST_ACCOUNT.id);
  assert.equal(getActiveAccountId(), TEST_ACCOUNT.id);

  accountId = tempAccountId('test-account');
  await start({ ...TEST_ACCOUNT, id: accountId });
  const state = getState();

  assert.equal(state.account.id, accountId);
  assert.equal(state.account.test, true);
  assert.ok(state.tasks.length > 0, 'Test account seeds tasks');
  assert.ok(state.bugs.length > 0, 'Test account seeds bugs');
  assert.ok(state.projects.length > 0, 'Test account seeds projects');
  assert.ok(state.tasks.every((row) => !row.deletedAt), 'state only contains live tasks');
  assert.ok(state.bugs.every((row) => !row.deletedAt), 'state only contains live bugs');
  assert.ok(state.settings?.ai?.model, 'meta settings are readable');
  assert.ok(state.seeded, 'the seed version is stored in meta');
});
