import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from '../assets/js/demo-data.js';
import { TASK_WORKFLOW_CLASS, TASK_WORKFLOW_TRANSITIONS } from '../assets/js/data.js';

test('every demo task workflow belongs to its stored status class', () => {
  const { tasks } = buildDemoData().stores;
  assert.ok(tasks.length > 0, 'demo data has no tasks');

  for (const task of tasks) {
    assert.equal(
      TASK_WORKFLOW_CLASS[task.workflow],
      task.status,
      `${task.key} (${task.id}) stores ${task.status} but workflow ${task.workflow} is in the ${TASK_WORKFLOW_CLASS[task.workflow] ?? 'unknown'} class`
    );
  }
});

test('the T-14 history row records a normal transition into its final workflow', () => {
  const { tasks, task_history: taskHistory } = buildDemoData().stores;
  const task = tasks.find((row) => row.id === 't14');
  const history = taskHistory.find((row) => row.taskId === 't14' && row.field === 'status');

  assert.ok(task, 'T-14 is missing');
  assert.ok(history, 'T-14 has no status history row');
  assert.equal(history.new, task.workflow);
  assert.ok(
    (TASK_WORKFLOW_TRANSITIONS[history.old] ?? []).includes(history.new),
    `${history.old} -> ${history.new} is not a legal task workflow transition`
  );
});
