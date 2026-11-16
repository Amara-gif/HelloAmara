import { checkTaskTransition, isQaActor } from './data.js';

// The four board columns are the only names the board exposes. Stored task
// statuses stay on their four-value vocabulary and are translated here.
export const BOARD_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done'];

const STORED_STATUS_BY_COLUMN = {
  'To Do': 'To do',
  'In Progress': 'In progress',
  'In Review': 'Waiting',
  Done: 'Done',
};

const WORKFLOW_BY_COLUMN = {
  'To Do': 'New',
  'In Progress': 'In progress',
  'In Review': 'Fixed',
  Done: 'Closed',
};

function canonicalColumn(column) {
  const value = String(column ?? '').trim().toLowerCase();
  return BOARD_COLUMNS.find((name) => name.toLowerCase() === value) ?? '';
}

function qaOwned(state, task) {
  return isQaActor(state, task?.owner);
}

// Waiting lands in In Review only for a QA owner; every other Waiting row
// stays visible in In Progress and is flagged by the board.
export function columnForTask(state, task) {
  const status = String(task?.status ?? '').trim().toLowerCase();
  if (status === 'to do' || status === 'todo' || status === 'to-do') return 'To Do';
  if (status === 'done') return 'Done';
  if (status === 'in review' || status === 'in-review') return 'In Review';
  if (status === 'waiting') return qaOwned(state, task) ? 'In Review' : 'In Progress';
  return 'In Progress';
}

export function statusForColumn(column) {
  const name = canonicalColumn(column);
  return name ? STORED_STATUS_BY_COLUMN[name] : '';
}

export function canMoveToColumn(state, task, column, options = {}) {
  const targetColumn = canonicalColumn(column);
  if (!targetColumn) {
    return { ok: false, reason: `Unknown board column “${String(column ?? '')}”.` };
  }
  if (!task) return { ok: false, reason: 'Task not found.' };

  const storedStatus = STORED_STATUS_BY_COLUMN[targetColumn];
  const workflow = WORKFLOW_BY_COLUMN[targetColumn];
  const currentColumn = columnForTask(state, task);

  // In Review is a QA-owned column. Refuse the move before touching the row so
  // the card cannot look as if it moved and then silently drift back.
  if (targetColumn === 'In Review' && !qaOwned(state, task)) {
    return {
      ok: false,
      column: targetColumn,
      currentColumn,
      status: storedStatus,
      storedStatus,
      workflow,
      reason: 'Only a QA owner can have items In Review. Use Send to QA.',
    };
  }

  // Re-selecting the current column is a no-op rather than an illegal move.
  if (currentColumn === targetColumn) {
    return {
      ok: true,
      noop: true,
      column: targetColumn,
      currentColumn,
      status: storedStatus,
      storedStatus,
      workflow,
    };
  }

  const actor = options.as ?? options.actingAs ?? options.who ?? (qaOwned(state, task) ? String(task.owner ?? '').trim() : 'Amara');
  const check = checkTaskTransition(task, workflow, {
    ...options,
    state,
    as: actor,
  });
  if (!check.ok) {
    return {
      ...check,
      column: targetColumn,
      currentColumn,
      status: storedStatus,
      storedStatus,
      workflow,
      actor,
    };
  }
  return {
    ...check,
    column: targetColumn,
    currentColumn,
    status: storedStatus,
    storedStatus,
    workflow: check.target,
    actor,
  };
}
