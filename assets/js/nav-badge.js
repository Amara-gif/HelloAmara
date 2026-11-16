// The nav badge is rebuilt by every render, so it must be refreshed from live state
// on every route, not only on tasks routes.
export function inProgressCount(tasks = []) {
  return tasks.filter((task) => task.status === 'In progress').length;
}

export function updateTaskBadge(badge, tasks = []) {
  if (!badge) return;
  const count = inProgressCount(tasks);
  badge.textContent = String(count);
  badge.hidden = count === 0;
}
