import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const route = { id: 'tasks', path: '/tasks', title: 'All work items' };
const demoState = () => ({ ...buildDemoData().stores });

const datedState = () => ({
  projects: [{ id: 'p1', key: 'ONE', name: 'One' }],
  tasks: [
    {
      id: 'a', key: 'T-1', title: 'Dated task', projectId: 'p1', status: 'To do', workflow: 'New',
      priority: 'High', owner: 'Amara', start: '2026-02-02', due: '2026-02-06',
    },
    {
      id: 'b', key: 'T-2', title: 'Milestone task', projectId: 'p1', status: 'In progress', workflow: 'In progress',
      priority: 'Medium', owner: 'Worker A', start: '2026-02-04', due: '2026-02-12', milestone: '2026-02-10',
    },
    {
      id: 'c', key: 'T-3', title: 'Undated open task', projectId: 'p1', status: 'To do', workflow: 'New',
      priority: 'Low', owner: 'Amara', start: '', due: '',
    },
    {
      id: 'd', key: 'T-4', title: 'Undated done task', projectId: 'p1', status: 'Done', workflow: 'Closed',
      priority: 'Low', owner: 'Amara', start: '', due: '',
    },
  ],
});

test('calendar view renders a month grid, navigation, task links and the open undated count', () => {
  const html = renderView(route, new URLSearchParams('view=calendar&scope=all&m=2026-02'), datedState());

  assert.match(html, /data-task-view="calendar"/);
  assert.match(html, /calendar-grid/);
  assert.match(html, /calendar-month">February 2026/);
  assert.match(html, />Previous<\/a>/);
  assert.match(html, />This month<\/a>/);
  assert.match(html, />Next<\/a>/);
  assert.match(html, /m=2026-01/);
  assert.match(html, /m=2026-03/);
  assert.match(html, /href="#\/task\/a"/);
  assert.match(html, /href="#\/task\/b"/);
  assert.match(html, /data-calendar-date="2026-02-06"/);
  assert.match(html, /data-undated-count="1" data-undated-total="2"/);
  assert.match(html, /1 open undated item/);
});

test('switch tabs preserve all filter query parameters and the calendar month', () => {
  const params = new URLSearchParams('view=calendar&q=battery&status=New&owner=Amara&priority=High&severity=S2%20Critical&component=battery&module=Power&project=p1&sort=due&scope=all&m=2026-02');
  const html = renderView(route, params, demoState());
  const links = [...html.matchAll(/href="(#\/tasks\?[^"]+)"/g)].map((match) => match[1]);

  for (const view of ['list', 'board', 'timeline']) {
    const link = links.find((value) => value.includes(`view=${view}`));
    assert.ok(link, `missing ${view} tab link`);
    for (const part of ['q=battery', 'status=New', 'owner=Amara', 'priority=High', 'severity=S2+Critical', 'component=battery', 'module=Power', 'project=p1', 'sort=due', 'scope=all', 'm=2026-02']) {
      assert.ok(link.includes(part), `${view} link dropped ${part}`);
    }
  }

  const previous = links.find((value) => value.includes('view=calendar') && value.includes('m=2026-01'));
  assert.ok(previous, 'Previous month link is missing');
  for (const part of ['q=battery', 'status=New', 'owner=Amara', 'project=p1', 'sort=due', 'scope=all']) {
    assert.ok(previous.includes(part), `Previous link dropped ${part}`);
  }
});

test('timeline view draws dated bars, a today line, milestone marks and the undated count', () => {
  const html = renderView(route, new URLSearchParams('view=timeline&scope=all'), datedState());

  assert.match(html, /data-task-view="timeline"/);
  assert.match(html, /data-timeline-bar/);
  assert.match(html, /data-start="2026-02-02" data-end="2026-02-06"/);
  assert.match(html, /data-start="2026-02-04" data-end="2026-02-12"/);
  assert.match(html, /timeline-today/);
  assert.match(html, /Today line/);
  assert.match(html, /timeline-milestone/);
  assert.match(html, /data-date="2026-02-10"/);
  assert.match(html, /data-undated-count="1" data-undated-total="2"/);
  assert.match(html, /1 open undated item/);
  assert.match(html, /href="#\/task\/a"/);
  assert.match(html, /href="#\/task\/b"/);
});

test('a boolean milestone or Milestone type marks the task due date on the timeline', () => {
  const booleanMilestone = {
    projects: [],
    tasks: [{ id: 'm1', key: 'T-1', title: 'Boolean milestone', status: 'To do', due: '2026-03-15', milestone: true }],
  };
  assert.match(renderView(route, new URLSearchParams('view=timeline'), booleanMilestone), /data-date="2026-03-15"/);

  const typedMilestone = {
    projects: [],
    tasks: [{ id: 'm2', key: 'T-2', title: 'Typed milestone', status: 'To do', due: '2026-04-01', type: 'Milestone' }],
  };
  assert.match(renderView(route, new URLSearchParams('view=timeline'), typedMilestone), /timeline-milestone/);
});

test('invalid view values still fall back to the list', () => {
  const html = renderView(route, new URLSearchParams('view=nonsense'), datedState());
  assert.match(html, /<table class="table table-stack">/);
  assert.doesNotMatch(html, /data-task-view="timeline"/);
});
