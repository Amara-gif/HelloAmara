import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { start, getState, updateTask } from '../assets/js/data.js';
import { closeAccountDb } from '../assets/js/db.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { taskFormPatch } from '../assets/js/task-form.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const detailRoute = { id: 'task-detail', path: '/task/t1', title: 'Work item', params: { id: 't1' } };

test('task detail renders editable content, side fields and Plan controls', () => {
  const state = { ...buildDemoData().stores };
  const html = renderView(detailRoute, new URLSearchParams(), state);

  assert.match(html, /data-form="task-title" data-history="title"/);
  assert.match(html, /data-form="task-details" data-history="description,repro,expected,actual"/);
  assert.match(html, /data-form="task-fields" data-history="owner,priority,severity,type,component,module,due,start"/);
  assert.match(html, /data-form="task-plan" data-history="projectId,module,start,end,depends_on,milestone"/);
  assert.match(html, /<h2>Plan<\/h2>/);

  for (const name of ['title', 'description', 'repro', 'expected', 'actual', 'owner', 'priority', 'severity', 'type', 'component', 'module', 'due', 'start', 'projectId', 'end', 'depends_on', 'milestone']) {
    assert.match(html, new RegExp(`name="${name}"`), `missing editable field ${name}`);
  }

  assert.match(html, /name="title" type="text" value="Feels slow in general scenario"/);
  assert.match(html, /name="description" rows="3">The screen feels slow when scrolling in the general scenario\. QA confirmed it on two units\.<\/textarea>/);
  assert.match(html, /name="projectId"[^>]*><option value="">No project<\/option>[\s\S]*?<option value="p3" selected>/);
});

test('multi-field updateTask writes history lines and values survive a database reopen', async () => {
  accountId = tempAccountId('task-detail-edit');
  const account = { id: accountId, name: 'Task detail edit test', test: true };
  await start(account);

  const patch = {
    title: 'T-1 edited inline',
    description: 'Edited description',
    repro: 'Open the detail page',
    expected: 'Fields save',
    actual: 'Fields save after reload',
    owner: 'Worker A',
    priority: 'High',
    severity: 'S2 Critical',
    type: 'Bug',
    component: 'battery',
    module: 'Power',
    due: '2026-04-10',
    start: '2026-04-01',
    projectId: 'p2',
    end: '2026-04-10',
    depends_on: 'T-4, T-7',
    milestone: '2026-04-08',
  };
  await updateTask('t1', patch, Object.keys(patch));

  const historyFields = new Set(getState().taskHistory.filter((row) => row.taskId === 't1').map((row) => row.field));
  for (const field of Object.keys(patch)) assert.ok(historyFields.has(field), `history is missing ${field}`);

  closeAccountDb();
  await start(account);
  const task = getState().tasks.find((row) => row.id === 't1');
  for (const [field, value] of Object.entries(patch)) assert.equal(task[field], value, `${field} did not persist`);

  const html = renderView(detailRoute, new URLSearchParams(), getState());
  for (const field of Object.keys(patch)) assert.match(html, new RegExp(`(?:${field}: |badge-muted">${field}<)`), `feed does not show ${field}`);
});

test('saving task-details leaves Plan end untouched', async () => {
  accountId = tempAccountId('task-detail-end');
  const account = { id: accountId, name: 'Task detail end test', test: true };
  await start(account);
  await updateTask('t1', { end: '2026-05-01' });

  const fields = ['description', 'repro', 'expected', 'actual'];
  const values = { description: 'New description', repro: 'New repro', expected: 'New expected', actual: 'New actual' };
  const patch = taskFormPatch('task-details', fields, values);
  assert.equal(Object.hasOwn(patch, 'end'), false, 'task-details must not patch Plan end');

  await updateTask('t1', patch, fields);
  const task = getState().tasks.find((row) => row.id === 't1');
  assert.equal(task.end, '2026-05-01', 'saving details must not clear Plan end');
  assert.equal(task.description, values.description);
  assert.equal(getState().taskHistory.filter((row) => row.taskId === 't1' && row.field === 'end').length, 0);
});

test('saving task-fields with a new due mirrors Plan end', async () => {
  accountId = tempAccountId('task-detail-due');
  const account = { id: accountId, name: 'Task detail due test', test: true };
  await start(account);

  const fields = ['owner', 'priority', 'severity', 'type', 'component', 'module', 'due', 'start'];
  const values = {
    owner: 'Worker B', priority: 'High', severity: 'S2 Critical', type: 'Bug',
    component: 'battery', module: 'Power', due: '2026-06-12', start: '2026-06-01',
  };
  const patch = taskFormPatch('task-fields', fields, values);
  assert.equal(patch.end, values.due, 'Details Due must mirror Plan end');

  await updateTask('t1', patch, fields);
  const task = getState().tasks.find((row) => row.id === 't1');
  assert.equal(task.due, values.due);
  assert.equal(task.end, values.due);
});

test('saving task-plan mirrors due and keeps dependsOn in step', () => {
  const fields = ['projectId', 'module', 'start', 'end', 'depends_on', 'milestone'];
  const values = {
    projectId: 'p2', module: 'Power', start: '2026-07-01', end: '2026-07-20',
    depends_on: 'T-2, T-3', milestone: '2026-07-15',
  };
  const patch = taskFormPatch('task-plan', fields, values);
  assert.equal(patch.due, values.end);
  assert.equal(patch.dependsOn, values.depends_on);
});
