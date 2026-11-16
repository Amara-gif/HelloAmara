import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DB_VERSION, STORES, getAll, getOne } from '../assets/js/db.js';
import { start, getState, buildExport, exportStatus, saveMeta } from '../assets/js/data.js';
import { renderView } from '../assets/js/views.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

beforeEach(() => {
  accountId = tempAccountId('export-json');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

test('backup JSON carries the schema, export time, device id and every store', async () => {
  await start({ id: accountId, name: 'Export test', test: true });
  const payload = await buildExport();

  assert.equal(payload.schemaVersion, DB_VERSION);
  assert.ok(Number.isFinite(Date.parse(payload.exportedAt)));
  assert.match(payload.deviceId, /^device-/);
  assert.deepEqual(Object.keys(payload.stores).sort(), Object.keys(STORES).sort());
  for (const name of Object.keys(STORES)) {
    assert.ok(Array.isArray(payload.stores[name]), `${name} is an array`);
    assert.equal(payload.stores[name].length, (await getAll(name)).length, `${name} has every row`);
  }
  assert.equal(payload.stores.tasks.length, getState().tasks.length);
  assert.equal(payload.deviceId, (await getOne('meta', 'deviceId')).value);

  const parsed = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(Object.keys(parsed).sort(), ['deviceId', 'exportedAt', 'schemaVersion', 'stores']);
  assert.equal(parsed.stores.tasks.length, payload.stores.tasks.length);
});

test('export updates meta.lastExportAt and clears the seven-day reminder', async () => {
  await start({ id: accountId, name: 'Export test', test: true });

  assert.equal(exportStatus(getState()).overdue, true, 'a new account needs a backup');
  const payload = await buildExport();
  const lastExport = await getOne('meta', 'lastExportAt');
  assert.equal(lastExport.value, payload.exportedAt);
  assert.equal(getState().lastExportAt, payload.exportedAt);
  assert.equal(exportStatus(getState()).overdue, false);

  const settings = renderView({ id: 'settings', title: 'Settings' }, new URLSearchParams(), getState());
  assert.match(settings, /data-action="export-json"/);
  assert.match(settings, /Export a file/);
  assert.doesNotMatch(settings, /data-export-reminder/);
});

test('an export older than seven days shows a reminder on Home and Settings', async () => {
  await start({ id: accountId, name: 'Export test', test: true });
  await saveMeta('lastExportAt', new Date(Date.now() - 8 * 86400000).toISOString());

  const current = getState();
  assert.equal(exportStatus(current).overdue, true);
  for (const route of [{ id: 'home', title: 'Home' }, { id: 'settings', title: 'Settings' }]) {
    const html = renderView(route, new URLSearchParams(), current);
    assert.match(html, /data-export-reminder/, `${route.id} shows the reminder`);
    assert.match(html, /Export a file/);
  }
});

test('the same device id is reused by later exports', async () => {
  await start({ id: accountId, name: 'Export test', test: true });
  const first = await buildExport();
  const second = await buildExport();

  assert.equal(second.deviceId, first.deviceId);
  assert.ok(Date.parse(second.exportedAt) >= Date.parse(first.exportedAt));
  assert.equal((await getOne('meta', 'lastExportAt')).value, second.exportedAt);
});
