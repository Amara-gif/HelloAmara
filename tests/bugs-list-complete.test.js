import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { filterBugs, renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { start, getState, createBug, softDeleteBugs } from '../assets/js/data.js';
import { getOne } from '../assets/js/db.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const demoState = () => {
  const stores = buildDemoData().stores;
  return { ...stores, bugHistory: stores.bug_history, bugComments: stores.bug_comments };
};

const sortState = {
  bugs: [
    { id: 'a', key: 'WD-10', title: 'Later low', status: 'New', severity: 'S4 Minor', priority: 'Low', component: 'ui', assignee: 'Amara', due: '2026-02-01', createdAt: '2026-01-04T00:00:00.000Z' },
    { id: 'b', key: 'WD-2', title: 'Sooner blocker', status: 'New', severity: 'S1 Blocker', priority: 'Highest', component: 'backend', assignee: 'Delphine Roth', due: '2026-01-01', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'c', key: 'WD-1', title: 'Closed item', status: 'Closed', severity: 'S2 Critical', priority: 'High', component: 'ui', assignee: 'Amara', due: '2026-01-03', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'd', key: 'WD-3', title: 'No due calendar item', status: 'In progress', severity: 'S3 Major', priority: 'Medium', component: 'calendar', assignee: 'Worker A', due: '', createdAt: '2026-01-03T00:00:00.000Z' },
  ],
};

test('bug filters cover q, status, severity, priority, component and assignee', () => {
  const filtered = (params) => filterBugs(sortState, new URLSearchParams(`${params}&sort=key`)).rows.map((bug) => bug.key);
  assert.deepEqual(filtered('q=later'), ['WD-10']);
  assert.deepEqual(filtered('status=New'), ['WD-2', 'WD-10']);
  assert.deepEqual(filtered('severity=S1%20Blocker'), ['WD-2']);
  assert.deepEqual(filtered('priority=High'), ['WD-1']);
  assert.deepEqual(filtered('component=ui'), ['WD-1', 'WD-10']);
  assert.deepEqual(filtered('assignee=Worker%20A'), ['WD-3']);

  const combined = new URLSearchParams('q=later&status=New&severity=S4%20Minor&priority=Low&component=ui&assignee=Amara');
  assert.deepEqual(filterBugs(sortState, combined).rows.map((bug) => bug.key), ['WD-10']);
});

test('bug sort supports smart, newest, oldest, severity, due and key', () => {
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=smart')).rows.map((bug) => bug.key), ['WD-2', 'WD-3', 'WD-10', 'WD-1']);
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=newest')).rows.map((bug) => bug.key), ['WD-10', 'WD-3', 'WD-2', 'WD-1']);
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=oldest')).rows.map((bug) => bug.key), ['WD-1', 'WD-2', 'WD-3', 'WD-10']);
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=severity')).rows.map((bug) => bug.key), ['WD-2', 'WD-1', 'WD-3', 'WD-10']);
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=due')).rows.map((bug) => bug.key), ['WD-2', 'WD-1', 'WD-10', 'WD-3']);
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=key')).rows.map((bug) => bug.key), ['WD-1', 'WD-2', 'WD-3', 'WD-10']);
  assert.deepEqual(filterBugs(sortState, new URLSearchParams('sort=bogus')).rows.map((bug) => bug.key), ['WD-2', 'WD-3', 'WD-10', 'WD-1']);
});

test('bugs list renders full columns, filters, sort choices, counters and multi-select controls', () => {
  const state = demoState();
  const html = renderView({ id: 'bugs', path: '/bugs', title: 'Bugs' }, new URLSearchParams(), state);
  for (const heading of ['Key', 'Summary', 'Status', 'Assignee', 'Due', 'Priority', 'Severity', 'Component', 'Age']) {
    assert.match(html, new RegExp(`<th[^>]*>.*${heading}.*</th>`), `${heading} column is rendered`);
  }
  for (const name of ['q', 'status', 'severity', 'priority', 'component', 'assignee', 'sort']) {
    assert.match(html, new RegExp(`name="${name}"`), `${name} filter is rendered`);
  }
  for (const sort of ['smart', 'newest', 'oldest', 'severity', 'due', 'key']) {
    assert.match(html, new RegExp(`<option value="${sort}"`), `${sort} sort is offered`);
  }
  assert.match(html, /href="#\/bugs">Reset<\/a>/);
  assert.match(html, /data-select-all-bugs/);
  assert.match(html, /data-bug-select value="b2"/);
  assert.match(html, /data-action="delete-selected-bugs" disabled/);

  const open = state.bugs.filter((bug) => !['Closed', 'Verified', 'Wont fix'].includes(bug.status)).length;
  assert.ok(html.includes(`<strong>${open}</strong><span>Open</span>`), 'open counter matches live rows');
  assert.ok(html.includes(`<strong>${state.bugs.length}</strong><span>Total</span>`), 'total counter matches live rows');
  assert.ok(html.includes(`<strong>${state.bugs.filter((bug) => bug.status === 'Fixed').length}</strong><span>Waiting for QA</span>`));
  assert.match(html, /<strong>\d+<\/strong><span>Past due<\/span>/);
});

test('bug detail still states that bugs are never deleted', () => {
  const state = demoState();
  const bug = state.bugs.find((row) => row.id === 'b2');
  const html = renderView({ id: 'bug-detail', path: `/bug/${bug.id}`, title: 'Bug', params: { id: bug.id } }, new URLSearchParams(), state);
  assert.match(html, /Bugs are never deleted/);
});

test('softDeleteBugs hides selected rows but keeps their tombstones in IndexedDB', async () => {
  accountId = tempAccountId('bugs-list-delete');
  await start({ id: accountId, name: 'Bugs list delete', test: false });

  const first = await createBug({ title: 'First bug', severity: 'S3 Major' });
  const second = await createBug({ title: 'Second bug', severity: 'S3 Major' });
  assert.equal(getState().bugs.length, 2);

  assert.equal(await softDeleteBugs([first.id]), 1);
  assert.deepEqual(getState().bugs.map((bug) => bug.id), [second.id], 'deleted bug is hidden from live state');
  const storedFirst = await getOne('bugs', first.id);
  assert.ok(storedFirst.deletedAt, 'bug keeps a deletedAt tombstone');
  assert.equal(storedFirst.title, 'First bug');
  assert.equal((await getOne('bugs', second.id)).deletedAt, null, 'unselected bug is untouched');

  assert.equal(await softDeleteBugs([]), 0, 'empty selection is a no-op');
  assert.equal(getState().bugs.length, 1);
});
