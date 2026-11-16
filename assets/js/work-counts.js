// One definition of "work" shared by every page: a live task whose stored
// status is not Done. Subtasks count like any other task because they are rows
// in the same store. This module stays free of DOM and IndexedDB imports so it
// can be tested directly under `node --test`.

const isLive = (task) => Boolean(task) && !task.deletedAt;

function matchesFilter(task, key, value) {
  if (value === undefined || value === null || value === '') return true;
  return String(task[key] ?? '') === String(value);
}

function filteredLiveTasks(tasks, options = {}) {
  if (!Array.isArray(tasks)) return [];
  const { projectId, owner } = options ?? {};
  return tasks.filter((task) => (
    isLive(task)
    && matchesFilter(task, 'projectId', projectId)
    && matchesFilter(task, 'owner', owner)
  ));
}

// Open work items, optionally scoped to one project and/or one owner.
export function openTasks(tasks, options = {}) {
  return filteredLiveTasks(tasks, options).filter((task) => task.status !== 'Done');
}

export function openTaskCount(tasks, options = {}) {
  return openTasks(tasks, options).length;
}

// The toolbar and nav badge show how many live rows are In progress.
export function inProgressTaskCount(tasks, options = {}) {
  return filteredLiveTasks(tasks, options).filter((task) => task.status === 'In progress').length;
}

// All live tasks, including Done, for "open of total" labels.
export function allTaskCount(tasks, options = {}) {
  return filteredLiveTasks(tasks, options).length;
}
