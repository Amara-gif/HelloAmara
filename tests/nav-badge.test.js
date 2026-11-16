import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from '../assets/js/demo-data.js';
import { openTaskCount, updateTaskBadge } from '../assets/js/nav-badge.js';

const tasks = [
  { key: 'T-1', status: 'In progress' },
  { key: 'T-2', status: 'To do' },
  { key: 'T-3', status: 'In progress' },
  { key: 'T-4', status: 'Waiting' },
  { key: 'T-5', status: 'Done' },
];

function badge() {
  const attributes = {};
  return {
    textContent: '',
    hidden: false,
    title: '',
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return attributes[name] ?? null;
    },
  };
}

test('counts open (non-Done) tasks', () => {
  assert.equal(openTaskCount(tasks), 4);
  assert.equal(openTaskCount([]), 0);
  assert.equal(openTaskCount(tasks.filter((task) => task.status === 'Done')), 0);
  assert.equal(openTaskCount(tasks.filter((task) => task.status !== 'Done')), 4);
});

test('badge shows the open count and becomes visible', () => {
  const node = badge();
  updateTaskBadge(node, tasks);
  assert.equal(node.textContent, '4');
  assert.equal(node.hidden, false);
  assert.match(node.getAttribute('aria-label'), /open work items/);
  assert.match(node.title, /4 open work items/);
});

test('badge hides when every task is Done or the list is empty', () => {
  const node = badge();
  updateTaskBadge(node, tasks.filter((task) => task.status === 'Done'));
  assert.equal(node.textContent, '0');
  assert.equal(node.hidden, true);
  updateTaskBadge(node, []);
  assert.equal(node.textContent, '0');
  assert.equal(node.hidden, true);
});

test('badge follows open/Done changes on later renders', () => {
  const node = badge();
  updateTaskBadge(node, [{ status: 'To do' }]);
  assert.equal(node.textContent, '1');
  assert.equal(node.hidden, false);
  updateTaskBadge(node, [{ status: 'To do' }, { status: 'In progress' }]);
  assert.equal(node.textContent, '2');
  assert.equal(node.hidden, false);
  updateTaskBadge(node, [{ status: 'Done' }, { status: 'Done' }]);
  assert.equal(node.textContent, '0');
  assert.equal(node.hidden, true);
  updateTaskBadge(node, [{ status: 'Open' }]);
  assert.equal(node.textContent, '1');
  assert.equal(node.hidden, false);
});

test('demo data badge matches the tasks page Open chip count', () => {
  const { tasks: demoTasks } = buildDemoData().stores;
  const node = badge();
  updateTaskBadge(node, demoTasks);
  assert.equal(node.textContent, '13');
  assert.equal(node.hidden, false);
  assert.equal(node.getAttribute('aria-label'), '13 open work items');
});

test('missing badge or task list does not throw', () => {
  assert.doesNotThrow(() => updateTaskBadge(null, tasks));
  const node = badge();
  updateTaskBadge(node, undefined);
  assert.equal(node.textContent, '0');
  assert.equal(node.hidden, true);
});
