import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { STORES, DB_VERSION, getOne, closeAccountDb } from '../assets/js/db.js';
import {
  start,
  getState,
  createTask,
  createBug,
  addTaskAttachment,
  addBugAttachment,
  removeAttachment,
  removeTaskAttachment,
  attachmentObjectUrl,
  listAttachments,
} from '../assets/js/data.js';
import { renderView } from '../assets/js/views.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

beforeEach(() => {
  accountId = tempAccountId('attachments');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });

test('the schema has a local attachments store with task and bug indexes', () => {
  assert.ok(DB_VERSION >= 2);
  assert.equal(STORES.attachments.keyPath, 'id');
  assert.deepEqual(STORES.attachments.indexes, ['taskId', 'bugId']);
});

test('a pasted task attachment stores its Blob and survives reopening the account', async () => {
  await start({ id: accountId, name: 'Attachment task', test: false });
  const task = await createTask({ title: 'Paste a screenshot' });
  const file = new File([png()], 'pasted.png', { type: 'image/png' });
  const meta = await addTaskAttachment(task.id, file);

  assert.match(meta.id, /^attachment-/);
  assert.equal(meta.name, 'pasted.png');
  assert.equal(meta.kind, 'image');
  const stored = await getOne('attachments', meta.id);
  assert.ok(stored.blob instanceof Blob, 'the file is kept as a Blob in IndexedDB');
  assert.equal(stored.taskId, task.id);
  assert.equal(stored.deletedAt, null);

  const afterAdd = getState();
  assert.equal(afterAdd.tasks.find((row) => row.id === task.id).attachments.length, 1);
  assert.equal(afterAdd.attachments.length, 1);
  assert.equal(listAttachments('task', task.id).length, 1);

  // Close and reopen the same account database to model a page reload.
  closeAccountDb();
  await start({ id: accountId, name: 'Attachment task', test: false });
  const reloaded = getState();
  assert.equal(reloaded.tasks.find((row) => row.id === task.id).attachments[0].name, 'pasted.png');
  assert.ok((await getOne('attachments', meta.id)).blob instanceof Blob);
});

test('a bug attachment is listed on the detail page and Remove soft-detaches it', async () => {
  await start({ id: accountId, name: 'Attachment bug', test: true });
  const bug = await createBug({ title: 'Dropped screenshot', severity: 'S3 Major', repro: 'Drop a file' });
  const blob = png();
  const meta = await addBugAttachment(bug.id, { name: 'dropped.png', type: 'image/png', size: blob.size, blob });

  const html = renderView({ id: 'bug-detail', title: 'Bug', params: { id: bug.id } }, new URLSearchParams(), getState());
  assert.match(html, /data-attachments/);
  assert.match(html, /data-attachment-owner="bug"/);
  assert.match(html, /data-attachment-dropzone/);
  assert.match(html, /data-attachment-input/);
  assert.match(html, new RegExp(meta.id));
  assert.match(html, /attachments never uploaded|never uploaded|never upload/i);

  assert.equal(listAttachments('bug', bug.id).length, 1);
  const removed = await removeAttachment(meta.id);
  assert.equal(removed.deletedAt !== null, true);

  const tombstone = await getOne('attachments', meta.id);
  assert.ok(tombstone.deletedAt, 'Remove keeps the row as a soft-detached tombstone');
  assert.equal(tombstone.name, 'dropped.png');
  assert.equal(getState().bugs.find((row) => row.id === bug.id).attachments.length, 0);
  assert.equal(listAttachments('bug', bug.id).length, 0);
  assert.equal(getState().attachments.length, 0);
});

test('task Remove can resolve the attachment by id or by its metadata name', async () => {
  await start({ id: accountId, name: 'Attachment remove', test: false });
  const task = await createTask({ title: 'Remove by name' });
  const first = await addTaskAttachment(task.id, { name: 'one.txt', type: 'text/plain', blob: new Blob(['one']) });
  const second = await addTaskAttachment(task.id, { name: 'two.txt', type: 'text/plain', blob: new Blob(['two']) });

  await removeTaskAttachment(task.id, 'one.txt');
  assert.equal(getState().tasks.find((row) => row.id === task.id).attachments.length, 1);
  assert.ok((await getOne('attachments', first.id)).deletedAt);
  assert.equal((await getOne('attachments', second.id)).deletedAt, null);
});

test('object URLs are created on demand for local blobs', async () => {
  await start({ id: accountId, name: 'Attachment URL', test: false });
  const task = await createTask({ title: 'Open a file' });
  const blob = png();
  const meta = await addTaskAttachment(task.id, { name: 'open.png', type: 'image/png', size: blob.size, blob });
  const url = await attachmentObjectUrl(meta.id);
  assert.match(url, /^blob:/);
  URL.revokeObjectURL(url);
});
