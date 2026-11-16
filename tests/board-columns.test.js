import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_COLUMNS,
  columnForTask,
  statusForColumn,
  canMoveToColumn,
} from '../assets/js/board-columns.js';
import { checkTaskTransition, start, getState, updateTask, transitionTask } from '../assets/js/data.js';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const qaState = { team: [{ name: 'QA Person', role: 'QA' }], tasks: [], taskHistory: [] };
const nonQaState = { team: [{ name: 'QA Person', role: 'QA' }], tasks: [], taskHistory: [] };

test('BOARD_COLUMNS is the four column vocabulary in board order', () => {
  assert.deepEqual(BOARD_COLUMNS, ['To Do', 'In Progress', 'In Review', 'Done']);
});

test('every column maps back to exactly one stored status', () => {
  assert.deepEqual(
    BOARD_COLUMNS.map((column) => [column, statusForColumn(column)]),
    [
      ['To Do', 'To do'],
      ['In Progress', 'In progress'],
      ['In Review', 'Waiting'],
      ['Done', 'Done'],
    ]
  );
  assert.equal(statusForColumn('not a column'), '');
});

test('every stored status maps to a column for QA and non-QA owners', () => {
  const expected = {
    'To do': ['To Do', 'To Do'],
    'In progress': ['In Progress', 'In Progress'],
    Waiting: ['In Review', 'In Progress'],
    Done: ['Done', 'Done'],
  };
  for (const [status, [qaColumn, nonQaColumn]] of Object.entries(expected)) {
    assert.equal(
      columnForTask(qaState, { status, owner: 'QA Person' }),
      qaColumn,
      `${status} with a QA owner belongs in ${qaColumn}`
    );
    assert.equal(
      columnForTask(nonQaState, { status, owner: 'Amara' }),
      nonQaColumn,
      `${status} without a QA owner belongs in ${nonQaColumn}`
    );
  }
});

test('legacy In Review rows stay In Review and unknown statuses fall back to In Progress', () => {
  assert.equal(columnForTask(nonQaState, { status: 'In Review', owner: 'Amara' }), 'In Review');
  assert.equal(columnForTask(nonQaState, { status: 'In review', owner: 'Amara' }), 'In Review');
  assert.equal(columnForTask(nonQaState, { status: '', owner: 'Amara' }), 'In Progress');
  assert.equal(columnForTask(nonQaState, { status: 'Something else', owner: 'Amara' }), 'In Progress');
});

test('a non-QA-owned task cannot move to In Review', () => {
  const task = { id: 'x', status: 'In progress', workflow: 'In progress', owner: 'Amara' };
  const check = canMoveToColumn(nonQaState, task, 'In Review');
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'Only a QA owner can have items In Review. Use Send to QA.');
  assert.equal(check.status, 'Waiting');
  assert.equal(task.status, 'In progress', 'the refused move leaves the task untouched');
  assert.equal(task.workflow, 'In progress');
});

test('a QA-owned task moved to In Review becomes Waiting', () => {
  const task = { id: 'x', status: 'In progress', workflow: 'In progress', owner: 'QA Person' };
  const check = canMoveToColumn(qaState, task, 'In Review');
  assert.equal(check.ok, true);
  assert.equal(check.status, 'Waiting');
  assert.equal(check.workflow, 'Fixed');
  assert.equal(columnForTask(qaState, { ...task, status: check.status }), 'In Review');
});

test('board moves use the detail page transition validation and message', () => {
  const task = { id: 'x', status: 'To do', workflow: 'New', owner: 'Amara' };
  const detail = checkTaskTransition(task, 'Closed', { state: nonQaState, as: 'Amara' });
  const board = canMoveToColumn(nonQaState, task, 'Done');

  assert.equal(board.ok, false);
  assert.equal(board.reason, detail.reason);
  assert.match(board.reason, /Cannot move from New to Closed/);
});

test('re-selecting the current column is a no-op', () => {
  const task = { id: 'x', status: 'Waiting', workflow: 'Fixed', owner: 'QA Person' };
  const check = canMoveToColumn(qaState, task, 'In Review');
  assert.equal(check.ok, true);
  assert.equal(check.noop, true);
  assert.equal(check.status, 'Waiting');
});

test('board cards and list rows reconcile the badge with the stored status', () => {
  const state = { ...buildDemoData().stores };

  const board = renderView({ id: 'tasks', path: '/tasks', title: 'All work items' }, new URLSearchParams('view=board&scope=all'), state);
  const card = board.match(/data-board-task="t14"[\s\S]*?<\/article>/)?.[0] ?? '';
  assert.match(card, /badge-success">Closed/);
  assert.doesNotMatch(card, />Reopened</);

  const list = renderView({ id: 'tasks', path: '/tasks', title: 'All work items' }, new URLSearchParams('scope=all'), state);
  const row = list.match(/data-row-id="t14"[\s\S]*?<\/tr>/)?.[0] ?? '';
  assert.match(row, /badge-success">Closed/);
  assert.doesNotMatch(row, />Reopened</);
});

test('a QA-owned In Review move persists as Waiting and a non-QA move leaves the row alone', async () => {
  accountId = tempAccountId('board-columns');
  await start({ id: accountId, name: 'Board columns test', test: true });

  const before = getState().tasks.find((task) => task.id === 't2');
  const refused = canMoveToColumn(getState(), before, 'In Review');
  assert.equal(refused.ok, false);
  assert.equal(getState().tasks.find((task) => task.id === 't2').status, 'In progress');

  const qaTask = await updateTask('t2', { owner: 'Delphine Roth' });
  const allowed = canMoveToColumn(getState(), qaTask, 'In Review');
  assert.equal(allowed.ok, true);

  const moved = await transitionTask('t2', { to: allowed.target ?? allowed.workflow, as: allowed.actor });
  assert.equal(moved.status, 'Waiting');
  assert.equal(moved.workflow, 'Fixed');
  assert.equal(columnForTask(getState(), getState().tasks.find((task) => task.id === 't2')), 'In Review');
});
