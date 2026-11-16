import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDemoData } from '../assets/js/demo-data.js';
import {
  allTaskCount,
  inProgressTaskCount,
  openTaskCount,
  openTasks,
} from '../assets/js/work-counts.js';

const { tasks } = buildDemoData().stores;

test('demo data uses the shared open-work definition', () => {
  assert.equal(openTaskCount(tasks), 13);
  assert.equal(allTaskCount(tasks), 18);
  assert.equal(inProgressTaskCount(tasks), 4);

  const open = openTasks(tasks);
  assert.equal(open.length, 13);
  assert.ok(open.every((task) => task.status !== 'Done'));
  assert.ok(!open.some((task) => task.deletedAt));
});

test('open work includes subtasks and excludes every live Done row', () => {
  const open = openTasks(tasks);
  const done = tasks.filter((task) => task.status === 'Done');
  const subtasks = tasks.filter((task) => task.parentId);

  assert.ok(done.length > 0);
  assert.ok(subtasks.length > 0);
  assert.ok(subtasks.every((task) => open.some((row) => row.id === task.id)));
  assert.ok(done.every((task) => !open.some((row) => row.id === task.id)));
});

test('projectId and owner options filter both counts', () => {
  assert.equal(openTaskCount(tasks, { projectId: 'p3' }), 4);
  assert.equal(allTaskCount(tasks, { projectId: 'p3' }), 5);
  assert.equal(openTaskCount(tasks, { owner: 'Amara' }), 5);
  assert.equal(allTaskCount(tasks, { owner: 'Amara' }), 7);
  assert.equal(openTaskCount(tasks, { projectId: 'p5', owner: 'Amara' }), 2);
  assert.equal(allTaskCount(tasks, { projectId: 'p5', owner: 'Amara' }), 3);
  assert.deepEqual(openTasks(tasks, { projectId: 'missing-project' }), []);
  assert.equal(allTaskCount(tasks, { owner: 'Missing owner' }), 0);
});

test('missing or empty input returns zero without throwing', () => {
  for (const input of [undefined, null, [], {}, 'not a list', 42]) {
    assert.equal(openTaskCount(input), 0);
    assert.equal(allTaskCount(input), 0);
    assert.equal(inProgressTaskCount(input), 0);
    assert.deepEqual(openTasks(input), []);
  }
  assert.doesNotThrow(() => openTaskCount(tasks, null));
  assert.equal(openTaskCount(tasks, null), 13);
  assert.equal(openTaskCount(tasks, { projectId: '', owner: '' }), 13);
});

test('soft-deleted rows are not counted by any helper', () => {
  const rows = [
    { id: 'live-open', projectId: 'p1', owner: 'A', status: 'To do' },
    { id: 'deleted-open', projectId: 'p1', owner: 'A', status: 'To do', deletedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'live-progress', projectId: 'p2', owner: 'B', status: 'In progress' },
    { id: 'deleted-progress', projectId: 'p2', owner: 'B', status: 'In progress', deletedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'live-done', projectId: 'p1', owner: 'A', status: 'Done' },
  ];

  assert.deepEqual(openTasks(rows).map((task) => task.id), ['live-open', 'live-progress']);
  assert.deepEqual(openTasks(rows, { projectId: 'p1' }).map((task) => task.id), ['live-open']);
  assert.deepEqual(openTasks(rows, { owner: 'B' }).map((task) => task.id), ['live-progress']);
  assert.equal(openTaskCount(rows), 2);
  assert.equal(allTaskCount(rows), 3);
  assert.equal(inProgressTaskCount(rows), 1);
});

test('the module has no DOM or IndexedDB imports', () => {
  const source = readFileSync(new URL('../assets/js/work-counts.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\b(indexedDB|document|window|localStorage|sessionStorage)\b/);
});
