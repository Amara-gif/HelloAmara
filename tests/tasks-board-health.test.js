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

  const moveFor = (id) => html.match(new RegExp(`<select[^>]*data-move-task="${id}"[^>]*>[\\s\\S]*?</select>`))?.[0] ?? '';
  const labelsFor = (id) => [...moveFor(id).matchAll(/<option value="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  for (const id of ['t1', 't3', 't9']) {
    assert.deepEqual(labelsFor(id), ['To Do', 'In Progress', 'In Review', 'Done']);
  }
  assert.match(moveFor('t1'), /value="To Do" selected/);
  assert.match(moveFor('t3'), /value="In Review" selected/);
  assert.match(moveFor('t9'), /value="In Progress" selected/);

  assert.match(html, /data-action="task-toqa" data-id="t1"/);
  assert.doesNotMatch(html, /data-action="task-toqa" data-id="t4"/);
  assert.doesNotMatch(html, /data-action="task-toqa" data-id="t3"/);
});

const boardColumn = (html, name) => html.match(new RegExp(`data-board-column="${name}"[\\s\\S]*?</section>`))?.[0] ?? '';

test('board defaults to all statuses so the Done column shows the demo Done tasks', () => {
  const state = demoState();
  const html = renderView(route, new URLSearchParams('view=board'), state);
  const done = boardColumn(html, 'Done');

  for (const key of ['T-4', 'T-7', 'T-12', 'T-14', 'T-18']) {
    assert.match(done, new RegExp(`>${key} ·`), `${key} is missing from the default Done column`);
  }
  assert.match(done, /<span class="badge badge-muted">5<\/span>/);
  assert.match(html, /<a class="chip is-active" href="[^"]*scope=all">All \d+<\/a>/);

  assert.match(boardColumn(html, 'In Review'), />T-3 ·/);
  const progress = boardColumn(html, 'In Progress');
  assert.match(progress, />T-9 ·/);
  assert.match(progress, /Waiting · no QA owner/);
});

test('board scope=open hides Done and makes the Open chip active', () => {
  const state = demoState();
  const html = renderView(route, new URLSearchParams('view=board&scope=open'), state);
  const done = boardColumn(html, 'Done');

  assert.match(done, /<span class="badge badge-muted">0<\/span>/);
  assert.match(done, /No items\./);
  for (const key of ['T-4', 'T-7', 'T-12', 'T-14', 'T-18']) {
    assert.doesNotMatch(done, new RegExp(`>${key} ·`));
  }
  assert.match(html, /<a class="chip is-active" href="[^"]*scope=open">Open \d+<\/a>/);
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
