import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView, projectModuleRows, projectStatusRows } from '../assets/js/views.js';
import { renderDonutChart } from '../assets/js/chart.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demoState = () => ({ ...buildDemoData().stores });
const routeFor = (key) => ({ id: 'project-detail', path: `/project/${key}`, title: 'Project', params: { key } });
const links = (html, prefix) => [...html.matchAll(/href="([^"]+)"/g)]
  .map((match) => match[1].replaceAll('&amp;', '&'))
  .filter((href) => href.startsWith(prefix));

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

test('module rows count done and total work items per project module', () => {
  const state = demoState();
  const rows = projectModuleRows(state.tasks.filter((task) => task.projectId === 'p4'));
  assert.deepEqual(rows.map((row) => [row.name, row.done, row.total]), [
    ['Battery', 0, 1],
    ['BFT', 0, 1],
    ['General', 1, 2],
  ]);
  assert.equal(projectModuleRows([]).length, 0);
  assert.deepEqual(projectStatusRows([{ status: 'Done' }, { status: 'To do' }, { status: 'Done' }]), [
    { status: 'To do', count: 1 },
    { status: 'Done', count: 2 },
  ]);
});

test('?tab=modules renders done/total bars that link into filtered Work items', () => {
  const html = renderView(routeFor('MRM'), new URLSearchParams('tab=modules'), demoState());
  assert.match(html, /<a class="tab" href="#\/project\/MRM\?tab=modules" aria-current="page">Modules<\/a>/);
  assert.match(html, /data-module="Battery"/);
  assert.match(html, /data-module="BFT"/);
  assert.match(html, /data-module="General"/);
  assert.match(html, /<strong>1\/2<\/strong>/);
  assert.match(html, /data-bar="1" data-total="2"/);

  const battery = links(html, '#/project/MRM?').find((href) => href.includes('module=Battery'));
  assert.ok(battery, 'Battery module link is missing');
  const params = new URLSearchParams(battery.split('?')[1]);
  assert.equal(params.get('tab'), 'work');
  assert.equal(params.get('module'), 'Battery');
  assert.equal(params.get('scope'), 'all');

  const work = renderView(routeFor('MRM'), new URLSearchParams('tab=work&module=Battery&scope=all'), demoState());
  assert.match(work, /href="#\/task\/t10"/);
  assert.doesNotMatch(work, /href="#\/task\/t11"/);
  assert.doesNotMatch(work, /href="#\/task\/t14"/);
});

test('project overview renders the status chart, Coming up and Schedule, pages and daily record', () => {
  const html = renderView(routeFor('MR'), new URLSearchParams(), demoState());
  assert.match(html, /id="project-status-chart"/);
  assert.match(html, /Work by status/);
  assert.match(html, /class="chart-legend"/);
  assert.match(html, /Coming up/);
  assert.match(html, /data-action="project-schedule" data-id="p2"/);
  assert.match(html, /class="row-date"/);
  assert.match(html, /Daily record/);
  assert.match(html, /History and comments/);
  assert.match(html, /Worker C/);
  assert.match(html, /status: To do → In progress/);
  assert.match(html, /href="#\/page\/pg5"/);
});

test('Edit project disclosure renders every editable field and saves from the detail page', () => {
  const html = renderView(routeFor('TAG'), new URLSearchParams(), demoState());
  assert.match(html, /<details class="card" id="project-edit">/);
  assert.match(html, /<form class="form-grid" data-form="project-edit">/);
  assert.match(html, /<input type="hidden" name="id" value="p1"/);
  assert.match(html, /<input type="hidden" name="from" value="detail"/);
  for (const field of ['key', 'name', 'description', 'owner', 'status', 'start', 'due', 'keywords']) {
    assert.match(html, new RegExp(`name="${field}"`), `missing ${field} field`);
  }
  assert.match(html, /<button class="btn btn-primary btn-sm" type="submit">Save project<\/button>/);
});

test('an unknown project key renders Project not found', () => {
  const html = renderView(routeFor('NOPE'), new URLSearchParams(), demoState());
  assert.match(html, /<h1>Project not found<\/h1>/);
  assert.match(html, /href="#\/projects"/);
  assert.doesNotMatch(html, /project-status-chart/);
});

test('renderDonutChart draws one ring segment per positive value plus the total', () => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new FakeNode(tag) };
  try {
    const container = new FakeNode('div');
    renderDonutChart(container, { labels: ['To do', 'Done'], values: [3, 1], title: 'Work by status' });
    const svg = container.children[0];
    const segments = svg.children.filter((node) => node.tag === 'circle' && node.attributes.class?.includes('chart-donut-segment'));
    assert.equal(segments.length, 2);
    assert.match(segments[0].attributes['stroke-dasharray'], /^\d+\.\d{2} \d+\.\d{2}$/);
    assert.equal(segments[1].attributes.class, 'chart-donut-segment chart-donut-2');
    const total = svg.children.find((node) => node.tag === 'text' && node.attributes.class === 'chart-donut-total');
    assert.equal(total.textContent, '4');
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
