import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { start, getState, restoreQaMark } from '../assets/js/data.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const route = { id: 'tasks', path: '/tasks', title: 'All work items' };
const demoState = () => ({ ...buildDemoData().stores });
let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

test('board shows the four columns and buckets Waiting by the team QA role', () => {
  const state = demoState();
  const html = renderView(route, new URLSearchParams('view=board&scope=all'), state);
  for (const column of ['To Do', 'In Progress', 'In Review', 'Done']) {
    assert.match(html, new RegExp(`data-board-column="${column}"`));
  }

  const review = html.match(/data-board-column="In Review"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(review, /T-3/);
  assert.doesNotMatch(review, /T-9/);
  const progress = html.match(/data-board-column="In Progress"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(progress, /T-9/);
  assert.match(progress, /Waiting · no QA owner/);
});

test('board cards expose Move to and conditional Send to QA', () => {
  const state = demoState();
  const html = renderView(route, new URLSearchParams('view=board&scope=all'), state);
  assert.match(html, /Move to…/);
  assert.match(html, /data-move-task="t1"/);

  assert.match(html, /data-action="task-toqa" data-id="t1"/);
  assert.doesNotMatch(html, /data-action="task-toqa" data-id="t4"/);
  assert.doesNotMatch(html, /data-action="task-toqa" data-id="t3"/);
});

test('board health caps Done rows, reports lost marks and dropped rows', () => {
  const state = demoState();
  const html = renderView(route, new URLSearchParams('view=board'), state);
  assert.match(html, /Board health/);
  assert.match(html, /Done without a QA mark/);
  assert.match(html, /Restore mark/);
  assert.match(html, /data-health-row="done"/);
  assert.match(html, /data-health-section="lost"/);
  assert.doesNotMatch(html, /data-health-section="dropped"/);

  const many = {
    team: [],
    projects: [],
    tasks: Array.from({ length: 20 }, (_, index) => ({
      id: `d${index}`, key: `T-${index + 1}`, title: `Done ${index + 1}`, status: 'Done',
      workflow: 'Wont fix', owner: 'Amara', notes: '',
    })),
  };
  const capped = renderView(route, new URLSearchParams('view=board&scope=all'), many);
  assert.equal((capped.match(/data-health-row="done"/g) ?? []).length, 12);
  assert.match(capped, /Showing 12 of 20/);

  const dropped = {
    team: [],
    projects: [],
    tasks: [{ id: 'x', key: 'T-1', title: 'Dropped row', status: 'To do', workflow: 'New', owner: 'Amara', notes: '[dropped 2026-01-01]' }],
  };
  assert.match(renderView(route, new URLSearchParams('view=board'), dropped), /data-health-section="dropped"/);

  const clean = {
    team: [{ name: 'QA Person', role: 'QA' }],
    projects: [],
    tasks: [{ id: 'c', key: 'T-1', title: 'Checked', status: 'Done', workflow: 'Closed', owner: 'QA Person', notes: '[已核 2026-01-01]' }],
  };
  assert.doesNotMatch(renderView(route, new URLSearchParams('view=board&scope=all'), clean), /Board health/);
});

test('restoreQaMark writes the missing mark back to the note', async () => {
  accountId = tempAccountId('board-health');
  await start({ id: accountId, name: 'Board health test', test: true });
  const before = getState().tasks.find((task) => task.id === 't7');
  assert.ok(!before.notes.includes('[已核'));

  const result = await restoreQaMark('t7');
  assert.equal(result.ok, true);
  assert.match(result.snapshot.notes, /\[已核 \d{4}-\d{2}-\d{2}\]/);
  assert.match(getState().tasks.find((task) => task.id === 't7').notes, /\[已核/);
});
