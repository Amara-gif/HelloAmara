import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { myworkQueues, renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const queueByTitle = (state, project = '') => Object.fromEntries(
  myworkQueues(state, project).map((queue) => [queue.title, queue.rows])
);

test('demo queues follow the inventory rules and scope by project', () => {
  const demo = buildDemoData();
  const state = { ...demo.stores };
  const all = queueByTitle(state);
  assert.deepEqual(all['Needs your decision'].map((row) => row.task.key), ['T-10', 'T-16']);
  assert.deepEqual(all.Blocked, []);
  assert.deepEqual(all['Ready for review'].map((row) => row.task.key), ['T-7', 'T-14']);

  const byProject = queueByTitle(state, 'p4');
  assert.deepEqual(byProject['Needs your decision'].map((row) => row.task.key), ['T-10']);
  assert.deepEqual(byProject.Blocked, []);
  assert.deepEqual(byProject['Ready for review'].map((row) => row.task.key), ['T-14']);
});

test('queues apply decision notes, QA hand-over, dependencies and review state', () => {
  const state = {
    team: [{ name: 'QA Person', role: 'QA' }],
    tasks: [
      { id: 'd1', key: 'T-1', title: 'Note decision', status: 'To do', notes: '[待确认]', owner: 'Amara', due: '2026-01-01' },
      { id: 'd2', key: 'T-2', title: 'Flagged decision', status: 'In progress', pendingDecision: true, owner: 'Amara', due: '2026-01-02' },
      { id: 'd3', key: 'T-3', title: 'Closed decision', status: 'Done', pendingDecision: true, reviewed: true, owner: 'Amara', due: '2026-01-03' },
      { id: 'b1', key: 'T-4', title: 'Waiting without hand-over', status: 'Waiting', notes: 'Waiting on a supplier', owner: 'Worker A', due: '2026-01-04' },
      { id: 'b2', key: 'T-5', title: 'Waiting after hand-over', status: 'Waiting', notes: '[待核 2026-01-02]', owner: 'Amara', due: '2026-01-05' },
      { id: 'b3', key: 'T-6', title: 'Unfinished dependency', status: 'In progress', dependsOn: ['T-7'], owner: 'Worker A', due: '2026-01-06' },
      { id: 'b4', key: 'T-7', title: 'Dependency', status: 'To do', owner: 'Worker A', due: '2026-01-07' },
      { id: 'b5', key: 'T-8', title: 'Unknown dependency', status: 'To do', depends_on: 'T-99', owner: 'Worker A', due: '2026-01-08' },
      { id: 'r1', key: 'T-9', title: 'QA checked', status: 'Done', reviewed: false, notes: '[已核 2026-01-03]', owner: 'QA Person', due: '2026-01-09' },
      { id: 'r2', key: 'T-10', title: 'Already approved', status: 'Done', reviewed: true, notes: '[已核 2026-01-03]', owner: 'QA Person', due: '2026-01-10' },
      { id: 'r3', key: 'T-11', title: 'QA status without stored Done', status: 'In progress', workflow: 'Verified', reviewed: false, owner: 'QA Person', due: '2026-01-11' },
    ],
  };
  const queues = queueByTitle(state);
  assert.deepEqual(queues['Needs your decision'].map((row) => row.task.key), ['T-1', 'T-2']);
  assert.deepEqual(queues.Blocked.map((row) => row.task.key), ['T-4', 'T-6', 'T-8']);
  assert.match(queues.Blocked[1].reason, /Depends on unfinished T-7/);
  assert.match(queues.Blocked[2].reason, /not found, treated as unfinished/);
  assert.deepEqual(queues['Ready for review'].map((row) => row.task.key), ['T-9', 'T-11']);
});

test('My work defaults to eight rows, keeps project scope and all=1 expands', () => {
  const tasks = Array.from({ length: 10 }, (_, index) => ({
    id: `t${index}`,
    key: `T-${index + 1}`,
    title: `Decision ${index + 1}`,
    projectId: index < 9 ? 'p1' : 'p2',
    status: 'To do',
    notes: '[待确认]',
    owner: 'Amara',
    due: '2026-01-01',
    reviewed: false,
  }));
  const state = { tasks, team: [], projects: [{ id: 'p1', key: 'ONE', name: 'One' }, { id: 'p2', key: 'TWO', name: 'Two' }] };
  const route = { id: 'mywork', path: '/mywork' };

  const short = renderView(route, new URLSearchParams(), state);
  assert.equal((short.match(/data-mywork-row=/g) ?? []).length, 8);
  assert.match(short, /href="#\/task\/t0"/);
  assert.match(short, /\[待确认\]/);
  assert.match(short, /<strong>Next:<\/strong>/);
  assert.match(short, /Amara/);
  assert.match(short, /href="#\/mywork\?all=1"/);

  const expanded = renderView(route, new URLSearchParams('all=1'), state);
  assert.equal((expanded.match(/data-mywork-row=/g) ?? []).length, 10);
  assert.doesNotMatch(expanded, /Show all/);

  const scoped = renderView(route, new URLSearchParams('project=p1'), state);
  assert.equal((scoped.match(/data-mywork-row=/g) ?? []).length, 8);
  assert.equal(scoped.match(/data-mywork-row=/g).length, 8);
  assert.doesNotMatch(scoped, /href="#\/task\/t9"/);
  assert.match(scoped, /href="#\/mywork\?all=1&project=p1"/);
});
