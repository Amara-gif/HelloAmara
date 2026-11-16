import test from 'node:test';
import assert from 'node:assert/strict';
import { inProgressCount, updateTaskBadge } from '../assets/js/nav-badge.js';

const tasks = [
  { key: 'T-1', status: 'In progress' },
  { key: 'T-2', status: 'To do' },
  { key: 'T-3', status: 'In progress' },
  { key: 'T-4', status: 'Waiting' },
  { key: 'T-5', status: 'Done' },
];

function badge() {
  return { textContent: '', hidden: false };
}

test('counts only tasks whose stored status is In progress', () => {
  assert.equal(inProgressCount(tasks), 2);
  assert.equal(inProgressCount([]), 0);
});

test('badge shows the count and becomes visible', () => {
  const node = badge();
  updateTaskBadge(node, tasks);
  assert.equal(node.textContent, '2');
  assert.equal(node.hidden, false);
});

test('badge hides when no task is In progress', () => {
  const node = badge();
  updateTaskBadge(node, tasks.filter((task) => task.status !== 'In progress'));
  assert.equal(node.textContent, '0');
  assert.equal(node.hidden, true);
});

test('badge follows task changes on later renders', () => {
  const node = badge();
  updateTaskBadge(node, [{ status: 'To do' }]);
  assert.equal(node.hidden, true);
  updateTaskBadge(node, [{ status: 'To do' }, { status: 'In progress' }]);
  assert.equal(node.textContent, '1');
  assert.equal(node.hidden, false);
  updateTaskBadge(node, [{ status: 'In progress' }, { status: 'In progress' }]);
  assert.equal(node.textContent, '2');
});

test('missing badge or task list does not throw', () => {
  assert.doesNotThrow(() => updateTaskBadge(null, tasks));
  const node = badge();
  updateTaskBadge(node, undefined);
  assert.equal(node.textContent, '0');
  assert.equal(node.hidden, true);
});
