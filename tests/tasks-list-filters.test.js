import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTasks, renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demoState = () => {
  const demo = buildDemoData();
  return { ...demo.stores };
};

test('tasks default to open scope, All shows everything, and an explicit status overrides open', () => {
  const state = demoState();

  const open = filterTasks(state, new URLSearchParams());
  assert.equal(open.scope, 'open');
  assert.ok(open.rows.length > 0);
  assert.ok(open.rows.every((task) => task.status !== 'Done'), 'open scope excludes stored Done rows');
  assert.ok(!open.rows.some((task) => task.key === 'T-4'), 'Done parent T-4 is hidden by default');

  const all = filterTasks(state, new URLSearchParams('scope=all'));
  assert.equal(all.rows.length, state.tasks.length, 'All shows every live row');
  assert.ok(all.rows.some((task) => task.key === 'T-4'));

  const closed = filterTasks(state, new URLSearchParams('status=Closed'));
  assert.ok(closed.rows.length > 0);
  assert.ok(closed.rows.every((task) => task.workflow === 'Closed'));
  assert.ok(closed.rows.some((task) => task.key === 'T-4'), 'a status filter may return Done rows');
});

test('task filters cover status, priority, owner, severity, component, module, project and q', () => {
  const tasks = [
    {
      id: 'a', key: 'T-1', title: 'Battery leak at the seam', projectId: 'p1', status: 'To do', workflow: 'New',
      priority: 'High', owner: 'Amara', severity: 'S2 Critical', component: 'battery', module: 'Power',
      notes: 'supplier ledger attached', description: 'Battery cell allocation is blocked.', due: '2026-01-03',
    },
    {
      id: 'b', key: 'T-2', title: 'Calendar repeats one day late', projectId: 'p2', status: 'In progress', workflow: 'In progress',
      priority: 'Low', owner: 'Worker A', severity: 'S4 Minor', component: 'calendar', module: 'Calendar',
      notes: '', description: 'Weekday repeat after DST.', due: '2026-01-02',
    },
    {
      id: 'c', key: 'T-3', title: 'Closed follow-up', projectId: 'p1', status: 'Done', workflow: 'Closed',
      priority: 'High', owner: 'Amara', severity: 'S2 Critical', component: 'battery', module: 'Power',
      notes: 'archived', description: '', due: '2026-01-01',
    },
  ];
  const state = { tasks, projects: [{ id: 'p1', key: 'ONE', name: 'One' }, { id: 'p2', key: 'TWO', name: 'Two' }] };

  const params = new URLSearchParams({
    status: 'New', priority: 'High', owner: 'Amara', severity: 'S2 Critical',
    component: 'battery', module: 'Power', project: 'p1', q: 'ledger',
  });
  assert.deepEqual(filterTasks(state, params).rows.map((task) => task.key), ['T-1']);

  assert.deepEqual(filterTasks(state, new URLSearchParams('q=calendar%20repeats')).rows.map((task) => task.key), ['T-2']);
  assert.deepEqual(filterTasks(state, new URLSearchParams('severity=S4%20Minor')).rows.map((task) => task.key), ['T-2']);
  assert.deepEqual(filterTasks(state, new URLSearchParams('status=New,Fixed')).rows.map((task) => task.key), ['T-1']);
  assert.deepEqual(filterTasks(state, new URLSearchParams('reset=1&q=ledger&status=Closed')).rows.map((task) => task.key), ['T-2', 'T-1']);
});

test('task sort supports smart, due, priority and key', () => {
  const tasks = [
    { id: 'a', key: 'T-10', title: 'Later low', status: 'To do', workflow: 'New', priority: 'Low', owner: 'Amara', due: '2026-02-01' },
    { id: 'b', key: 'T-2', title: 'Sooner highest', status: 'To do', workflow: 'New', priority: 'Highest', owner: 'Amara', due: '2026-01-01' },
    { id: 'c', key: 'T-1', title: 'Done item', status: 'Done', workflow: 'Closed', priority: 'Highest', owner: 'Amara', due: '2026-01-02' },
    { id: 'd', key: 'T-3', title: 'No due', status: 'In progress', workflow: 'In progress', priority: 'Medium', owner: 'Amara', due: '' },
  ];
  const state = { tasks, projects: [] };

  assert.deepEqual(filterTasks(state, new URLSearchParams('scope=all&sort=due')).rows.map((task) => task.key), ['T-2', 'T-1', 'T-10', 'T-3']);
  assert.deepEqual(filterTasks(state, new URLSearchParams('scope=all&sort=priority')).rows.map((task) => task.key), ['T-2', 'T-1', 'T-3', 'T-10']);
  assert.deepEqual(filterTasks(state, new URLSearchParams('scope=all&sort=key')).rows.map((task) => task.key), ['T-1', 'T-2', 'T-3', 'T-10']);
  assert.deepEqual(filterTasks(state, new URLSearchParams('scope=all&sort=smart')).rows.map((task) => task.key), ['T-2', 'T-10', 'T-3', 'T-1']);
});

test('the list renders parent disclosures, hidden subtasks, task links and progress notes', () => {
  const state = demoState();
  const route = { id: 'tasks', path: '/tasks', title: 'All work items' };

  const all = renderView(route, new URLSearchParams('scope=all&sort=key'), state);
  assert.match(all, /data-action="toggle-subtasks" data-id="t4"/);
  assert.match(all, /aria-label="Show subtasks for T-4"/);
  assert.match(all, /2 subtasks/);
  assert.match(all, /data-row-id="t4"/);
  assert.match(all, /data-row-id="t5" data-parent-row="t4" hidden/);
  assert.match(all, /data-row-id="t6" data-parent-row="t4" hidden/);
  assert.match(all, /href="#\/task\/t4"/);
  assert.match(all, /href="#\/task\/t5"/);
  assert.match(all, /HQ SWQA confirmed this on the latest build\./);

  const open = renderView(route, new URLSearchParams(), state);
  assert.doesNotMatch(open, /href="#\/task\/t4"/);
  assert.match(open, /href="#\/task\/t5"/);
});

test('Reset clears every task filter and returns to the default scope', () => {
  const state = demoState();
  const route = { id: 'tasks', path: '/tasks', title: 'All work items' };
  const html = renderView(route, new URLSearchParams('scope=all&q=battery&status=New&priority=High&owner=Amara&severity=S2%20Critical&component=battery&module=Power&project=p4&sort=due&view=board'), state);
  assert.match(html, /href="#\/tasks\?view=board">Reset<\/a>/);
  assert.doesNotMatch(html, /href="#\/tasks\?view=board[^"]*(q=|status=|priority=|owner=|severity=|component=|module=|project=|sort=|scope=)/);
});
