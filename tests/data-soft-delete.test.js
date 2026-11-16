import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  start,
  refresh,
  getState,
  createPage,
  softDeletePage,
  createEvent,
  deleteEvent,
} from '../assets/js/data.js';
import { putRecord, getOne } from '../assets/js/db.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

beforeEach(() => {
  accountId = tempAccountId('soft-delete');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

const now = '2026-01-01T00:00:00.000Z';

const storeRows = {
  tasks: { key: 'T-1', status: 'To do', projectId: null, owner: 'Amara', due: '' },
  task_history: { taskId: 'live-task' },
  task_comments: { taskId: 'live-task' },
  bugs: { key: 'WD-1', status: 'New', assignee: 'Amara', due: '' },
  bug_history: { bugId: 'live-bug' },
  bug_comments: { bugId: 'live-bug' },
  events: { date: '2026-01-01', time: '09:00' },
  projects: { key: 'LIVE', sort: 1 },
  pages: { projectId: 'live-project', updatedAt: now },
  ai_calls: { time: now },
  team: { role: 'QA' },
  orders: { owner: 'Amara', open: true },
};

const stateKeys = {
  tasks: 'tasks',
  task_history: 'taskHistory',
  task_comments: 'taskComments',
  bugs: 'bugs',
  bug_history: 'bugHistory',
  bug_comments: 'bugComments',
  events: 'events',
  projects: 'projects',
  pages: 'pages',
  ai_calls: 'aiCalls',
  team: 'team',
  orders: 'orders',
};

test('data.js exposes live rows only for every soft-deletable store', async () => {
  await start({ id: accountId, name: 'Soft delete test', test: false });

  const ids = {};
  for (const [storeName, fields] of Object.entries(storeRows)) {
    const live = { id: `${storeName}-live`, ...fields, updatedAt: now, deletedAt: null };
    const deleted = { id: `${storeName}-deleted`, ...fields, updatedAt: now, deletedAt: now };
    await putRecord(storeName, live);
    await putRecord(storeName, deleted);
    ids[storeName] = { live: live.id, deleted: deleted.id };
  }

  await refresh();
  const state = getState();
  for (const [storeName, expected] of Object.entries(ids)) {
    const rows = state[stateKeys[storeName]];
    assert.ok(
      rows.some((row) => row.id === expected.live),
      `${stateKeys[storeName]} should include live rows`
    );
    assert.ok(
      !rows.some((row) => row.id === expected.deleted),
      `${stateKeys[storeName]} should hide rows with deletedAt set`
    );
  }
});

test('softDeletePage and deleteEvent hide a row but keep its tombstone in IndexedDB', async () => {
  await start({ id: accountId, name: 'Soft delete helpers', test: false });

  const page = await createPage({ title: 'Page to delete' });
  assert.ok(getState().pages.some((row) => row.id === page.id));
  await softDeletePage(page.id);
  assert.ok(!getState().pages.some((row) => row.id === page.id), 'deleted page is hidden from state');
  const storedPage = await getOne('pages', page.id);
  assert.ok(storedPage.deletedAt, 'page row keeps a deletedAt tombstone');
  assert.equal(storedPage.title, 'Page to delete');

  const event = await createEvent({ date: '2026-01-02', title: 'Event to delete' });
  assert.ok(getState().events.some((row) => row.id === event.id));
  await deleteEvent(event.id);
  assert.ok(!getState().events.some((row) => row.id === event.id), 'deleted event is hidden from state');
  const storedEvent = await getOne('events', event.id);
  assert.ok(storedEvent.deletedAt, 'event row keeps a deletedAt tombstone');
  assert.equal(storedEvent.title, 'Event to delete');
});
