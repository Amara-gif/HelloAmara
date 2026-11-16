// The nav badge is rebuilt by every render, so it must be refreshed from live state
// on every route, not only on tasks routes.
import { openTaskCount } from './work-counts.js';

// The nav badge and the tasks page "Open" chip share one definition of open work:
// a live task whose stored status is not Done.
export { openTaskCount };

export function updateTaskBadge(badge, tasks = []) {
  if (!badge) return;
  const count = openTaskCount(tasks);
  const label = `${count} open work items`;
  badge.textContent = String(count);
  badge.hidden = count === 0;
  if (typeof badge.setAttribute === 'function') badge.setAttribute('aria-label', label);
  badge.title = label;
}
