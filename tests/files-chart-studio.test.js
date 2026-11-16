import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChartSeries, chartDatasets, chartFilters, renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const state = buildDemoData().stores;
const sum = (values) => values.reduce((total, value) => total + value, 0);

test('Chart Studio lists only local datasets, not OS workbook paths', () => {
  const html = renderView({ id: 'files', path: '/files' }, new URLSearchParams(), state);
  assert.match(html, /data-chart-table/);
  assert.match(html, /Work items by status/);
  assert.match(html, /Bugs by severity/);
  assert.doesNotMatch(html, /\.xlsx/i);
  assert.doesNotMatch(html, /[A-Za-z]:\\/);
  assert.deepEqual(chartDatasets().map((dataset) => dataset.label), [
    'Work items by status',
    'Work items by priority',
    'Bugs by severity',
    'Bugs by component',
  ]);
});

test('work items by status counts every local task in board order', () => {
  const series = buildChartSeries(state, 'work-status');
  assert.deepEqual(series.labels, ['To do', 'In progress', 'Waiting', 'Done']);
  assert.equal(series.total, state.tasks.length);
  assert.equal(sum(series.values), state.tasks.length);
  assert.equal(series.filterLabel, 'All projects');
});

test('the project filter scopes the work item chart', () => {
  const filters = chartFilters(state, 'work-status');
  assert.equal(filters.field, 'projectId');
  assert.ok(filters.options.some((option) => option.label === 'RSL · Roselite'));

  const project = state.projects.find((row) => row.key === 'RSL');
  const series = buildChartSeries(state, 'work-status', project.id);
  assert.equal(series.total, state.tasks.filter((task) => task.projectId === project.id).length);
  assert.equal(sum(series.values), series.total);
  assert.match(series.title, /Work items by status/);
});

test('bugs by severity counts every local bug and filters by status', () => {
  const filters = chartFilters(state, 'bug-severity');
  assert.equal(filters.field, 'status');

  const all = buildChartSeries(state, 'bug-severity');
  assert.deepEqual(all.labels, ['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor']);
  assert.equal(all.total, state.bugs.length);
  assert.equal(sum(all.values), state.bugs.length);

  const reopened = buildChartSeries(state, 'bug-severity', 'Reopened');
  assert.equal(reopened.total, state.bugs.filter((bug) => bug.status === 'Reopened').length);
  assert.equal(reopened.filterLabel, 'Reopened');
});

test('opening the chart page renders the local chart and its filter legend', () => {
  const html = renderView(
    { id: 'files', path: '/files' },
    new URLSearchParams('run=1&table=bug-severity&filter=Reopened'),
    state
  );
  assert.match(html, /id="files-chart"/);
  assert.match(html, /chart-legend/);
  assert.match(html, /<option value="Reopened" selected>Reopened<\/option>/);
  assert.match(html, /Open chart folder/);
});

test('Agent Configuration lists the team agents read-only', () => {
  const html = renderView({ id: 'files', path: '/files' }, new URLSearchParams('tab=agents'), state);
  assert.match(html, /Agent Configuration/);
  assert.doesNotMatch(html, /id="files-chart"/);
  for (const agent of state.team) assert.match(html, new RegExp(agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
