import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const route = { id: 'project-detail', path: '/project/RSL', title: 'Project', params: { key: 'RSL' } };
const demoState = () => ({ ...buildDemoData().stores });

const linksFor = (html, prefix = '#/project/RSL?') => [...html.matchAll(/href="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((href) => href.startsWith(prefix));
const paramsOf = (href) => new URLSearchParams(href.split('?')[1] ?? '');

test('project Work items embeds the shared tasks toolbar and all four views', () => {
  const html = renderView(route, new URLSearchParams('tab=work'), demoState());

  assert.match(html, /<a class="tab" href="#\/project\/RSL\?tab=work" aria-current="page">Work items<\/a>/);
  assert.match(html, /data-form="task-filters"/);
  assert.match(html, /data-path="\/project\/RSL"/);
  assert.match(html, /name="tab" value="work"/);
  assert.match(html, /Open 4<\/a>/);
  assert.match(html, /All 5<\/a>/);
  assert.match(html, /Search work items…/);
  assert.match(html, /name="status"/);
  assert.match(html, /name="priority"/);
  assert.match(html, /name="owner"/);
  assert.match(html, /name="severity"/);
  assert.match(html, /name="component"/);
  assert.match(html, /name="module"/);
  assert.match(html, /name="sort"/);

  const links = linksFor(html);
  for (const view of ['list', 'board', 'calendar', 'timeline']) {
    const link = links.find((href) => paramsOf(href).get('view') === view);
    assert.ok(link, `missing ${view} tab link`);
    assert.equal(paramsOf(link).get('tab'), 'work', `${view} link dropped tab=work`);
  }
});

test('project Work items is scoped to the project even when another project filter is in the URL', () => {
  const html = renderView(route, new URLSearchParams('tab=work&scope=all&view=board&project=p4'), demoState());

  for (const id of ['t1', 't2', 't3', 't12', 't13']) {
    assert.match(html, new RegExp(`href="#/task/${id}"`), `Roselite task ${id} is missing`);
  }
  for (const id of ['t4', 't5', 't10', 't11', 't17']) {
    assert.doesNotMatch(html, new RegExp(`href="#/task/${id}"`), `non-Roselite task ${id} leaked in`);
  }

  assert.match(html, /data-board-column="To Do"/);
  assert.match(html, /name="project" aria-label="Project" disabled/);
  assert.match(html, /<input type="hidden" name="project" value="p3" \/>/);
});

test('project view switches, filters, sort, scope and calendar month keep tab=work', () => {
  const params = new URLSearchParams('tab=work&view=board&q=battery&status=New&owner=Amara&priority=High&severity=S3+Major&component=work+desk&module=General&sort=due&scope=all&m=2026-02');
  const html = renderView(route, params, demoState());
  const links = linksFor(html);

  const expected = {
    q: 'battery', status: 'New', owner: 'Amara', priority: 'High', severity: 'S3 Major',
    component: 'work desk', module: 'General', sort: 'due', scope: 'all', m: '2026-02', tab: 'work',
  };
  for (const view of ['list', 'calendar', 'timeline']) {
    const link = links.find((href) => paramsOf(href).get('view') === view);
    assert.ok(link, `missing ${view} tab link`);
    const query = paramsOf(link);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(query.get(key), value, `${view} link dropped ${key}`);
    }
  }

  const calendarHtml = renderView(route, new URLSearchParams('tab=work&view=calendar&q=battery&status=New&owner=Amara&priority=High&severity=S3+Major&component=work+desk&module=General&sort=due&scope=all&m=2026-02'), demoState());
  const previous = linksFor(calendarHtml).find((href) => paramsOf(href).get('view') === 'calendar' && paramsOf(href).get('m') === '2026-01');
  assert.ok(previous, 'Previous month link is missing');
  for (const [key, value] of Object.entries({ ...expected, m: '2026-01' })) {
    assert.equal(paramsOf(previous).get(key), value, `Previous link dropped ${key}`);
  }

  const reset = links.find((href) => paramsOf(href).get('view') === 'board' && paramsOf(href).get('tab') === 'work' && !paramsOf(href).get('q'));
  assert.ok(reset, 'Reset link is missing');
  assert.equal(paramsOf(reset).get('status'), null);
  assert.equal(paramsOf(reset).get('project'), null);
});

test('project calendar and timeline views render the same task surfaces as #/tasks', () => {
  const state = demoState();
  const calendar = renderView(route, new URLSearchParams('tab=work&view=calendar&scope=all&m=2026-02'), state);
  assert.match(calendar, /data-task-view="calendar"/);
  assert.match(calendar, /calendar-grid/);
  const calendarLinks = linksFor(calendar);
  assert.ok(calendarLinks.some((href) => paramsOf(href).get('view') === 'calendar' && paramsOf(href).get('m') === '2026-01' && paramsOf(href).get('tab') === 'work'));

  const timeline = renderView(route, new URLSearchParams('tab=work&view=timeline&scope=all'), state);
  assert.match(timeline, /data-task-view="timeline"/);
  assert.match(timeline, /data-timeline-bar/);
  assert.match(timeline, /data-timeline-today/);
});

test('the global tasks page does not gain the project tab or project scoping', () => {
  const html = renderView({ id: 'tasks', path: '/tasks', title: 'All work items' }, new URLSearchParams('view=board&scope=all'), demoState());
  assert.match(html, /data-form="task-filters" data-path="\/tasks"/);
  assert.doesNotMatch(html, /name="tab" value="work"/);
  assert.match(html, /href="#\/task\/t10"/);
  assert.match(html, /href="#\/tasks\?[^"]*view=list/);
});
