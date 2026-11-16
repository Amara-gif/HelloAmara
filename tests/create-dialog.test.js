import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderCreateDialog } from '../assets/js/views.js';
import { start, getState, createTask, createBug, createEvent } from '../assets/js/data.js';
import { closeAccountDb } from '../assets/js/db.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const state = {
  projects: [
    { id: 'p1', key: 'ABC', name: 'Alpha project', archived: false },
  ],
};

function panel(html, name) {
  const match = html.match(new RegExp(`data-create-panel="${name}"[\\s\\S]*?<\\/form>`));
  assert.ok(match, `${name} panel must exist`);
  return match[0];
}

function assertFields(html, names) {
  for (const name of names) {
    assert.match(html, new RegExp(`name="${name}"`), `${name} field must be present`);
  }
}

test('Task panel exposes every inventory field', () => {
  const task = panel(renderCreateDialog(state), 'task');
  assert.match(task, /name="title" type="text" required/);
  assertFields(task, ['type', 'projectId', 'priority', 'start', 'due', 'expected', 'actual', 'description']);
});

test('Bug panel requires title, severity and steps, and offers priority/component/description', () => {
  const bug = panel(renderCreateDialog(state), 'bug');
  assert.match(bug, /name="title" type="text" required/);
  assert.match(bug, /name="severity"[^>]*required/);
  assert.match(bug, /name="repro"[^>]*required/);
  assertFields(bug, ['priority', 'component', 'description']);
});

test('Event panel exposes what, date, time, kind, link, repeat, remind and project', () => {
  const event = panel(renderCreateDialog(state), 'event');
  assert.match(event, /name="title" type="text" required/);
  assertFields(event, ['date', 'time', 'kind', 'link', 'repeat', 'remind', 'projectId']);
  assert.match(event, /name="repeat"[\s\S]*?<option value="weekly">Weekly<\/option>/);
});

test('created rows keep their dialog fields after the database is reopened', async () => {
  accountId = tempAccountId('create-dialog');
  const account = { id: accountId, name: 'Create dialog test', test: false };
  await start(account);

  await createTask({
    title: 'Task from the dialog',
    type: 'Story',
    projectId: 'p1',
    priority: 'High',
    start: '2026-02-01',
    due: '2026-02-10',
    expected: 'The dialog saves',
    actual: 'The dialog saves after reload',
    description: 'Task description',
  });
  await createBug({
    title: 'Bug from the dialog',
    severity: 'S2 Critical',
    priority: 'Highest',
    component: 'calendar',
    repro: 'Open the Create dialog',
    description: 'Bug description',
  });
  await createEvent({
    title: 'Event from the dialog',
    date: '2026-02-03',
    time: '09:30',
    kind: 'Meeting',
    link: 'https://meet.example.com/demo',
    repeat: 'weekly',
    remind: '15',
    projectId: 'p1',
  });

  closeAccountDb();
  await start(account);
  const reloaded = getState();

  const task = reloaded.tasks.find((row) => row.title === 'Task from the dialog');
  assert.ok(task);
  assert.equal(task.key, 'T-1');
  assert.deepEqual(
    [task.type, task.projectId, task.priority, task.start, task.due, task.expected, task.actual, task.description],
    ['Story', 'p1', 'High', '2026-02-01', '2026-02-10', 'The dialog saves', 'The dialog saves after reload', 'Task description'],
  );

  const bug = reloaded.bugs.find((row) => row.title === 'Bug from the dialog');
  assert.ok(bug);
  assert.deepEqual(
    [bug.severity, bug.priority, bug.component, bug.repro, bug.description],
    ['S2 Critical', 'Highest', 'calendar', 'Open the Create dialog', 'Bug description'],
  );

  const event = reloaded.events.find((row) => row.title === 'Event from the dialog');
  assert.ok(event);
  assert.deepEqual(
    [event.date, event.time, event.kind, event.link, event.repeat, event.remind, event.projectId],
    ['2026-02-03', '09:30', 'Meeting', 'https://meet.example.com/demo', 'weekly', '15', 'p1'],
  );
});
