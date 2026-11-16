import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView, renderCreateDialog } from '../assets/js/views.js';
import { start, getState, createTask, createEvent } from '../assets/js/data.js';
import { closeAccountDb } from '../assets/js/db.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

function detailRoute(id) {
  return { id: 'task-detail', path: `/task/${id}`, title: 'Work item', params: { id } };
}

function demoState() {
  return { ...buildDemoData().stores };
}

function panel(html, name) {
  const match = html.match(new RegExp(`data-create-panel="${name}"[\\s\\S]*?<\\/form>`));
  assert.ok(match, `${name} panel must exist`);
  return match[0];
}

test('task detail lists children and opens a parent-preset subtask dialog', () => {
  const state = demoState();
  const html = renderView(detailRoute('t4'), new URLSearchParams(), state);

  assert.match(html, /<h2>Subtasks<\/h2>/);
  assert.match(html, /data-action="new-subtask" data-id="t4" data-parent-id="t4"/);
  assert.match(html, /data-subtask-id="t5"/);
  assert.match(html, /data-subtask-id="t6"/);
  assert.match(html, /href="#\/task\/t5"/);
  assert.match(html, /href="#\/task\/t6"/);

  const taskPanel = panel(renderCreateDialog(state, { tab: 'task', parentId: 't1' }), 'task');
  assert.match(taskPanel, /name="parentId" value="t1"/);
  assert.match(taskPanel, /<option value="Sub-task" selected>Sub-task<\/option>/);
  assert.match(taskPanel, /subtask of T-1/);
  assert.match(taskPanel, /<option value="p3" selected>RSL Roselite<\/option>/);

  const dialog = renderCreateDialog(state, { tab: 'task', parentId: 't1' });
  assert.match(dialog, /aria-selected="true" data-create-tab="task"/);
  assert.match(dialog, /data-create-panel="task" data-form="create-task">/);
});

test('Schedule time for this opens the Event tab with the task preset', () => {
  const state = demoState();
  const html = renderView(detailRoute('t1'), new URLSearchParams(), state);

  assert.match(html, /<h2>Scheduled<\/h2>/);
  assert.match(html, /data-action="schedule-task" data-id="t1" data-task-id="t1"/);
  assert.match(html, />Schedule time for this<\/button>/);

  const eventPanel = panel(renderCreateDialog(state, { tab: 'event', taskId: 't1' }), 'event');
  assert.match(eventPanel, /name="taskId" value="t1"/);
  assert.match(eventPanel, /linked to T-1/);
  assert.match(eventPanel, /name="title" type="text" required value="T-1 · Feels slow in general scenario"/);

  const dialog = renderCreateDialog(state, { tab: 'event', taskId: 't1' });
  assert.match(dialog, /aria-selected="true" data-create-tab="event"/);
  assert.match(dialog, /data-create-panel="event" data-form="create-event">/);
  assert.match(renderCreateDialog(state, { taskId: 't1' }), /aria-selected="true" data-create-tab="event"/);
});

test('Depends on shows resolved links, missing refs and the editable Plan list', () => {
  const state = demoState();
  state.tasks = state.tasks.map((task) => (task.id === 't1' ? { ...task, depends_on: 'T-2, missing-key' } : task));
  const html = renderView(detailRoute('t1'), new URLSearchParams(), state);

  assert.match(html, /<h2>Depends on<\/h2>/);
  assert.match(html, /data-dependency-ref="T-2"/);
  assert.match(html, /href="#\/task\/t2"/);
  assert.match(html, /data-dependency-ref="missing-key"/);
  assert.match(html, /<span class="badge badge-warning">Missing<\/span>/);
  assert.match(html, /name="depends_on" type="text" value="T-2, missing-key"/);
  assert.match(html, /data-action="focus-dependencies" data-id="t1"/);
});

test('pages mentioning the task are listed by task link or by key in the body', () => {
  const state = demoState();
  state.pages = state.pages.map((page) => (page.id === 'pg3'
    ? { ...page, body: '## Follow-up\n\nRecheck T-1 on the next build.' }
    : page));
  const html = renderView(detailRoute('t1'), new URLSearchParams(), state);

  assert.match(html, /<h2>Pages mentioning this task<\/h2>/);
  assert.match(html, /data-page-id="pg1" href="#\/page\/pg1"/);
  assert.match(html, /data-page-id="pg3" href="#\/page\/pg3"/);
});

test('a created subtask keeps parentId and a linked event keeps taskId after reopen', async () => {
  accountId = tempAccountId('task-detail-links');
  const account = { id: accountId, name: 'Task detail links test', test: true };
  await start(account);

  const parent = await createTask({ title: 'Parent item' });
  const child = await createTask({ title: 'Child item', type: 'Sub-task', parentId: parent.id });
  await createEvent({ title: 'Work session', date: '2026-02-03', time: '10:00', taskId: parent.id });

  closeAccountDb();
  await start(account);

  const tasks = getState().tasks;
  const reloadedChild = tasks.find((task) => task.id === child.id);
  assert.equal(reloadedChild.parentId, parent.id);
  assert.equal(reloadedChild.type, 'Sub-task');

  const event = getState().events.find((row) => row.title === 'Work session');
  assert.equal(event.taskId, parent.id);
});
