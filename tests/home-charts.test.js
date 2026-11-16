import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView, homeTeamTotals, mountView, paretoSeries, teamLoadSeries } from '../assets/js/views.js';
import { renderParetoChart } from '../assets/js/chart.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { updateTaskBadge } from '../assets/js/nav-badge.js';

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = nodes;
  }
}

const emptyState = {
  team: [],
  tasks: [],
  orders: [],
  bugs: [],
  events: [],
  projects: [],
  aiCalls: [],
  ratings: null,
  issueCounts: null,
};

const demoState = () => {
  const demo = buildDemoData();
  return { ...demo.stores, aiCalls: demo.stores.ai_calls, ...demo.meta };
};

test('team load counts open tasks plus open orders per owner', () => {
  const rows = teamLoadSeries({
    team: [{ name: 'Amara' }, { name: 'Worker A' }, { name: 'Idle Person' }],
    tasks: [
      { owner: 'Amara', status: 'To do' },
      { owner: 'Amara', status: 'Done' },
      { owner: 'Worker A', status: 'Waiting' },
      { owner: 'Worker A', status: 'Done' },
    ],
    orders: [
      { owner: 'Amara', open: true },
      { owner: 'Amara', open: false },
      { owner: 'Worker A', open: true },
    ],
  });

  const byOwner = Object.fromEntries(rows.map((row) => [row.owner, row]));
  assert.deepEqual([byOwner.Amara.tasks, byOwner.Amara.orders, byOwner.Amara.value], [1, 1, 2]);
  assert.deepEqual([byOwner['Worker A'].tasks, byOwner['Worker A'].orders, byOwner['Worker A'].value], [1, 1, 2]);
  assert.equal(byOwner['Idle Person'].value, 0);
  assert.deepEqual(rows.map((row) => row.value).sort((a, b) => b - a), [2, 2, 0]);
});

test('team load labels use full names when first names collide', () => {
  const rows = teamLoadSeries({
    team: [{ name: 'Alex Smith' }, { name: 'Alex Jones' }],
    tasks: [{ owner: 'Alex Smith', status: 'To do' }],
    orders: [{ owner: 'Alex Jones', open: true }],
  });
  assert.deepEqual(new Set(rows.map((row) => row.label)), new Set(['Alex Smith', 'Alex Jones']));
});

test('Home shows open work items and open orders as separate totals', () => {
  const state = demoState();
  const html = renderView({ id: 'home', path: '/' }, new URLSearchParams(), state);

  assert.deepEqual(homeTeamTotals(state), { tasks: 13, orders: 2 });
  assert.match(html, /<a href="#\/tasks" data-home-work-items>13 open work items<\/a>/);
  assert.match(html, /13 open work items<\/a> · <span data-home-open-orders>2 open orders<\/span>/);

  const rows = teamLoadSeries(state);
  assert.equal(rows.reduce((sum, row) => sum + row.tasks, 0), 13);
  assert.equal(rows.reduce((sum, row) => sum + row.orders, 0), 2);
});

test('Home team-load chart title names the shared task and order totals', () => {
  const state = demoState();
  const previous = globalThis.document;
  const team = new FakeNode('div');
  globalThis.document = {
    createElementNS: (_namespace, tag) => new FakeNode(tag),
    getElementById: (id) => (id === 'home-team-load' ? team : null),
  };
  try {
    mountView({ id: 'home', path: '/' }, new URLSearchParams(), state);
    const svg = team.children[0];
    const title = svg.children.find((node) => node.tag === 'title');
    assert.equal(title.textContent, 'Team load: 13 open work items · 2 open orders by owner');
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('the shared open count is 13 on the badge, task chip, Team, Projects, Home and My work', () => {
  const state = demoState();
  const badge = {
    textContent: '',
    hidden: false,
    title: '',
    setAttribute() {},
  };
  updateTaskBadge(badge, state.tasks);

  const tasksHtml = renderView({ id: 'tasks', path: '/tasks' }, new URLSearchParams(), state);
  const teamHtml = renderView({ id: 'chat', path: '/chat' }, new URLSearchParams(), state);
  const projectsHtml = renderView({ id: 'projects', path: '/projects' }, new URLSearchParams(), state);
  const homeHtml = renderView({ id: 'home', path: '/' }, new URLSearchParams(), state);
  const myworkHtml = renderView({ id: 'mywork', path: '/mywork' }, new URLSearchParams(), state);

  const counts = {
    sidebarBadge: Number(badge.textContent),
    taskChip: Number(tasksHtml.match(/>Open (\d+)<\/a>/)?.[1]),
    team: Number(teamHtml.match(/<strong>(\d+)<\/strong><span>Open work items<\/span>/)?.[1]),
    projects: Number(projectsHtml.match(/data-projects-open-count>(\d+) open work items/)?.[1]),
    home: Number(homeHtml.match(/data-home-work-items>(\d+) open work items/)?.[1]),
    mywork: Number(myworkHtml.match(/data-mywork-count>(\d+) open work items/)?.[1]),
  };
  assert.deepEqual(counts, {
    sidebarBadge: 13,
    taskChip: 13,
    team: 13,
    projects: 13,
    home: 13,
    mywork: 13,
  });
  assert.match(homeHtml, /href="#\/tasks" data-home-work-items>13 open work items/);
});

test('Pareto uses meta issue counts, ordered high to low', () => {
  const rows = paretoSeries({
    issueCounts: [
      { category: 'Display', count: 4 },
      { category: 'Battery', count: 9 },
      { category: 'BFT', count: 6 },
    ],
    tasks: [{ module: 'Ignored when meta counts exist' }],
  });
  assert.deepEqual(rows, [
    { label: 'Battery', value: 9 },
    { label: 'BFT', value: 6 },
    { label: 'Display', value: 4 },
  ]);
});

test('Pareto falls back to task modules, then bug components', () => {
  const byModule = paretoSeries({
    tasks: [{ module: 'Display' }, { module: 'Display' }, { module: 'Battery' }],
    bugs: [{ component: 'settings' }],
  });
  assert.deepEqual(byModule, [
    { label: 'Display', value: 2 },
    { label: 'Battery', value: 1 },
  ]);

  const byComponent = paretoSeries({ bugs: [{ component: 'calendar' }, { component: 'calendar' }, { component: 'settings' }] });
  assert.deepEqual(byComponent, [
    { label: 'calendar', value: 2 },
    { label: 'settings', value: 1 },
  ]);
});

test('Pareto keeps the top six categories and folds the rest into Other', () => {
  const rows = paretoSeries({
    issueCounts: Array.from({ length: 8 }, (_, index) => ({ category: `Category ${index}`, count: 8 - index })),
  });
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.slice(0, 6).map((row) => row.value), [8, 7, 6, 5, 4, 3]);
  assert.deepEqual(rows[6], { label: 'Other', value: 3 });
});

test('Home renders both chart boxes and the rating/Pareto links', () => {
  const state = {
    ...emptyState,
    team: [{ name: 'Amara', role: 'Lead' }],
    tasks: [{ owner: 'Amara', status: 'To do', module: 'Display' }],
    issueCounts: [{ category: 'Display', count: 3 }],
  };
  const html = renderView({ id: 'home', path: '/' }, new URLSearchParams(), state);
  assert.match(html, /id="home-team-load"/);
  assert.match(html, /id="home-pareto"/);
  assert.match(html, /href="#\/rating-trend"/);
  assert.match(html, /href="#\/project\/MR"/);
});

test('renderParetoChart draws bars and a cumulative line', () => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new FakeNode(tag) };
  try {
    const container = new FakeNode('div');
    renderParetoChart(container, { labels: ['Display', 'Battery'], values: [6, 4], title: 'Issue Pareto' });
    const svg = container.children[0];
    const bars = svg.children.filter((node) => node.tag === 'rect');
    const path = svg.children.find((node) => node.tag === 'path');
    assert.equal(bars.length, 2);
    assert.ok(Number(bars[0].attributes.height) > Number(bars[1].attributes.height));
    assert.match(path.attributes.d, /^M .+L /);
    assert.equal(path.attributes.class, 'chart-line chart-line-2');
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('demo meta ships ordered issue counts for the Pareto card', () => {
  const demo = buildDemoData();
  assert.ok(Array.isArray(demo.meta.issueCounts));
  assert.ok(demo.meta.issueCounts.length >= 4);
  assert.ok(demo.meta.issueCounts.every((row) => row.category && row.count > 0));
});
