import { SETTINGS_LINKS } from './routes.js';
import { icon } from './icons.js';
import { renderBarChart, renderLineChart, renderParetoChart } from './chart.js';
import { occurrences, occursOn } from './schedule.js';
import {
  TASK_WORKFLOW_STATUSES,
  TASK_WAIVER_STATUSES,
  TASK_REASON_REQUIRED_STATUSES,
  workflowForStoredStatus,
  taskWorkflowTargets,
  attachmentsFingerprint,
  taskReviewFingerprint,
} from './data.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');
const fmt = (value) => {
  if (!value) return '—';
  const date = new Date(`${dateOnly(value)}T12:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const fmtStamp = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const age = (createdAt) => {
  const days = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 86400000));
  return `${days}d`;
};
const projectOf = (state, id) => (state.projects ?? []).find((project) => project.id === id);
const pageUrl = (path, params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== '' && value !== undefined && value !== null) search.set(key, value);
  return `#${path}${search.toString() ? `?${search}` : ''}`;
};
const option = (value, current, label) => `<option value="${esc(value)}"${String(value) === String(current) ? ' selected' : ''}>${esc(label ?? value)}</option>`;
const initials = (name) => String(name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const avatar = (name, size = '') => `<span class="avatar ${size}" title="${esc(name)}">${esc(String(name).startsWith('Test') ? 'T' : initials(name))}</span>`;

const STATUS_TONE = {
  Done: 'success', Verified: 'success', Closed: 'success',
  'In progress': 'accent', Fixed: 'accent',
  Waiting: 'warning', Reopened: 'warning', Triaged: 'warning',
  'Wont fix': 'muted', Rejected: 'danger', Duplicate: 'muted', Deferred: 'muted',
  New: 'band', 'To do': 'band', 'To Do': 'band',
};
const statusBadge = (status) => `<span class="badge badge-${STATUS_TONE[status] ?? 'muted'}">${esc(status)}</span>`;
const STORAGE_TONE = { Granted: 'success', Denied: 'warning', Unsupported: 'muted' };
const storageBadge = (storage) => `<span class="badge badge-${STORAGE_TONE[storage?.status] ?? 'muted'}">${esc(storage?.status ?? 'Unsupported')}</span>`;
const priorityClass = { Highest: 'danger', High: 'danger', Medium: 'warning', Low: 'success', Lowest: 'muted' };
const priority = (value) => `<span class="priority priority-${priorityClass[value] ?? 'muted'}"><span class="priority-dot" aria-hidden="true"></span>${esc(value)}</span>`;

function pageHead(title, subtitle, actions = '') {
  return `<header class="page-head page-head-row"><div><h1>${esc(title)}</h1>${subtitle ? `<p class="lede">${esc(subtitle)}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
}

function empty(text) {
  return `<p class="empty-state">${esc(text)}</p>`;
}

function userRows(rows, emptyText) {
  return rows.length ? `<div class="row-list">${rows.join('')}</div>` : empty(emptyText);
}

export function renderAccountScreen(accounts) {
  return `
    <main class="auth-screen">
      <section class="auth-card">
        <div class="auth-brand">
          <span class="brand-mark" aria-hidden="true">${icon('layers', 22)}</span>
          <div><strong>My Platform</strong><span>Local-first workspace</span></div>
        </div>
        <h1>Choose an account</h1>
        <p class="lede">Every account has its own IndexedDB database on this device. Nothing is uploaded.</p>
        <div class="account-list">
          ${accounts.map((account) => `
            <button class="account-row" type="button" data-open-account="${esc(account.id)}">
              ${avatar(account.name, 'avatar-lg')}
              <span class="account-row-copy">
                <strong>${esc(account.name)}</strong>
                <span>${account.test ? 'Demo data included · opens directly' : 'Local account on this device'}</span>
              </span>
              ${account.test ? '<span class="badge badge-accent">Demo</span>' : ''}
              <span class="icon" aria-hidden="true">${icon('arrow', 18)}</span>
            </button>`).join('')}
        </div>
        <form class="auth-form" data-form="create-account">
          <div class="field">
            <label for="account-name">New account</label>
            <input id="account-name" name="name" type="text" autocomplete="off" placeholder="Account name" required />
            <p class="field-help">Creates an empty database for this account.</p>
          </div>
          <button class="btn btn-primary" type="submit">${icon('user', 16)}Create account</button>
        </form>
        <p class="auth-note">No sign-up and no server. Switching accounts never mixes their data.</p>
      </section>
    </main>`;
}

function miniCalendar(state) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const monthValue = `${year}-${String(month + 1).padStart(2, '0')}`;
  const marks = new Set();
  for (const occurrence of occurrences(state.events, `${monthValue}-01`, `${monthValue}-${pad2(days)}`)) {
    marks.add(Number(occurrence.date.slice(8, 10)));
  }
  for (const task of state.tasks) {
    if (!task.due || task.status === 'Done') continue;
    const d = new Date(`${task.due}T12:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) marks.add(d.getDate());
  }
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push('<span class="calendar-day is-outside"></span>');
  for (let day = 1; day <= days; day += 1) {
    const current = day === now.getDate();
    const date = `${monthValue}-${String(day).padStart(2, '0')}`;
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    cells.push(`<a class="calendar-day${current ? ' is-today' : ''}" href="#/calendar?m=${monthValue}" data-agenda-day="${date}" aria-label="Open ${esc(dateLabel)} in the calendar"><span class="calendar-date">${day}</span>${marks.has(day) ? '<span class="calendar-mark" aria-hidden="true"></span>' : ''}</a>`);
  }
  return `
    <div class="calendar-head"><h2>${monthName}</h2><a class="btn btn-ghost btn-sm" href="#/calendar">Open calendar</a></div>
    <div class="calendar calendar-mini">
      <div class="calendar-week">${['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((d) => `<span class="calendar-weekday">${d}</span>`).join('')}</div>
      <div class="calendar-grid">${cells.join('')}</div>
    </div>`;
}

function agendaRows(state) {
  const rows = [];
  const todayIso = today();
  for (const task of state.tasks) {
    if (task.status !== 'Done' && task.due) rows.push({ date: task.due, kind: 'Task', title: task.title, href: `#/task/${task.id}`, tone: 'task' });
  }
  for (const bug of state.bugs) {
    if (!['Closed', 'Verified', 'Wont fix'].includes(bug.status) && bug.due) rows.push({ date: bug.due, kind: 'Bug', title: bug.title, href: `#/bug/${bug.id}`, tone: 'bug' });
  }
  for (const project of state.projects) {
    if (project.status !== 'Done' && project.due && !project.archived) rows.push({ date: project.due, kind: 'Project', title: project.name, href: `#/project/${project.key}`, tone: 'project' });
  }
  for (const event of occurrences(state.events, addDays(todayIso, -31), addDays(todayIso, 366))) {
    rows.push({ date: event.date, time: event.time, kind: event.kind, title: event.title, href: event.taskId ? `#/task/${event.taskId}` : '', tone: 'event', link: event.link, eventId: event.seriesId || event.id, note: event.note });
  }
  rows.sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
  const overdueAll = rows.filter((row) => row.date < todayIso);
  const upcomingAll = rows.filter((row) => row.date >= todayIso);
  const overdue = overdueAll.slice(0, 2);
  const upcoming = upcomingAll.slice(0, 6);
  const shown = [...overdue, ...upcoming];
  if (!shown.length) return empty('Nothing due.');
  const remaining = (overdueAll.length - overdue.length) + (upcomingAll.length - upcoming.length);
  const items = shown.map((row) => {
    const day = row.date === todayIso ? 'Today' : row.date < todayIso ? `Overdue · ${fmt(row.date)}` : fmt(row.date);
    const href = row.href || `#/calendar?m=${row.date.slice(0, 7)}`;
    return `<a class="row-item" href="${esc(href)}" data-action="agenda-row" data-agenda-row data-agenda-kind="${esc(row.kind)}" data-agenda-title="${esc(row.title)}" data-agenda-href="${esc(href)}" data-agenda-link="${esc(row.link)}" data-agenda-event="${esc(row.eventId)}" data-agenda-date="${esc(row.date)}" data-agenda-time="${esc(row.time)}">
      <span class="row-date">${esc(day)}</span>
      <span class="row-main"><span class="row-title">${esc(row.title)}</span><span class="row-meta">${esc(row.kind)}${row.time ? ` · ${esc(row.time)}` : ''}</span></span>
      <span class="badge badge-muted">${esc(row.kind)}</span>
    </a>`;
  }).join('');
  return `<div class="row-list">${items}</div>${remaining ? `<a class="btn btn-ghost btn-sm" href="#/calendar" data-agenda-more>${remaining} more in the calendar</a>` : ''}`;
}

export function teamLoadSeries(state = {}) {
  const tasks = state.tasks ?? [];
  const orders = state.orders ?? [];
  const names = [...new Set([
    ...(state.team ?? []).map((agent) => agent.name),
    ...tasks.filter((task) => task.status !== 'Done').map((task) => task.owner),
    ...orders.filter((order) => order.open).map((order) => order.owner),
  ].filter(Boolean))];
  const firstNames = names.reduce((counts, name) => {
    const first = String(name).split(/\s+/)[0];
    counts.set(first, (counts.get(first) ?? 0) + 1);
    return counts;
  }, new Map());
  return names.map((name) => {
    const taskCount = tasks.filter((task) => task.owner === name && task.status !== 'Done').length;
    const orderCount = orders.filter((order) => order.owner === name && order.open).length;
    const first = String(name).split(/\s+/)[0];
    return {
      owner: name,
      label: firstNames.get(first) > 1 ? name : first,
      tasks: taskCount,
      orders: orderCount,
      value: taskCount + orderCount,
    };
  }).sort((a, b) => b.value - a.value || a.owner.localeCompare(b.owner));
}

// Demo/meta issue counts first, then task modules, then bug components so every
// account gets a useful Pareto even before it has any issue-like data.
export function paretoSeries(state = {}) {
  const counts = new Map();
  const add = (label, value = 1) => {
    const key = String(label ?? '').trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + value);
  };
  for (const row of Array.isArray(state.issueCounts) ? state.issueCounts : []) {
    const value = Number(row?.count ?? row?.value);
    if (Number.isFinite(value) && value > 0) add(row?.category ?? row?.label ?? row?.name, value);
  }
  if (!counts.size) for (const task of state.tasks ?? []) add(task.module || task.title || 'General');
  if (!counts.size) for (const bug of state.bugs ?? []) add(bug.component || 'Other');
  const ordered = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const top = ordered.slice(0, 6);
  const rest = ordered.slice(6);
  if (rest.length) {
    const other = top.find((row) => row.label === 'Other');
    const value = rest.reduce((sum, row) => sum + row.value, 0);
    if (other) other.value += value;
    else top.push({ label: 'Other', value });
  }
  return top;
}

function home(state) {
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, Amara`;
  const load = teamLoadSeries(state);
  return `
    ${pageHead(greeting, new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}
    <div class="home-layout">
      <div class="home-column">
        <section class="card"><div class="card-body">${miniCalendar(state)}</div></section>
        <section class="card" data-home-agenda>
          <div class="card-head"><h2>Today and coming up · next 6</h2><a class="card-link-small" href="#/calendar">Open calendar</a></div>
          <div class="card-body">${agendaRows(state)}</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Who has work · live</h2><a class="card-link-small" href="#/chat">Open team</a></div>
          <div class="card-body">
            <div class="chart-box" id="home-team-load"></div>
            <p class="row-meta">Open tasks plus open orders per owner.</p>
            <div class="chart-legend">${load.map((row) => `<span class="chart-legend-item">${esc(row.label)} · ${row.value}</span>`).join('')}</div>
          </div>
        </section>
      </div>
      <div class="home-column">
        <section class="card">
          <div class="card-head"><h2>Rating trend · live</h2><a class="card-link-small" href="#/rating-trend">Open big</a></div>
          <div class="card-body">
            <div class="chart-box" id="home-rating"></div>
            <div class="chart-legend">${(state.ratings?.series ?? []).slice(0, 4).map((item, index) => `<span class="chart-legend-item"><span class="chart-dot chart-line-${index + 1}"></span>${esc(item.name)}</span>`).join('')}</div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Market Review Pareto · saved default</h2><a class="card-link-small" href="#/project/MR">Open analysis</a></div>
          <div class="card-body">
            <div class="chart-box" id="home-pareto"></div>
            <p class="row-meta">Ordered high to low; the line is cumulative share.</p>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Recent AI calls</h2><a class="card-link-small" href="#/settings/ai">AI settings</a></div>
          <div class="card-body"><div class="row-list">${state.aiCalls.slice(0, 3).map((call) => `<div class="row-item"><span class="row-main"><span class="row-title">${esc(call.detail)}</span><span class="row-meta">${esc(call.model)} · ${call.chars} chars</span></span><span class="badge badge-${call.ok ? 'success' : 'danger'}">${call.ok ? 'OK' : 'Error'}</span></div>`).join('')}</div></div>
        </section>
      </div>
    </div>`;
}

const noteHas = (task, mark) => String(task?.notes ?? '').includes(mark);
const taskNumber = (task) => String(task?.key ?? task?.id ?? '');
const taskLabel = (task) => (task?.key ? `${task.key} · ${task.title}` : task?.title ?? 'Untitled');

function isQaChecked(task) {
  return noteHas(task, '[已核') || noteHas(task, '[免核') || ['Verified', 'Closed'].includes(task?.workflow);
}

function qaCheckDate(task) {
  const match = String(task?.notes ?? '').match(/\[(?:已核|免核)\s+(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export function qaOwnerName(state) {
  const owner = (state?.team ?? []).find((agent) => /^qa$/i.test(String(agent?.role ?? '').trim()));
  return String(owner?.name ?? '').trim() || 'QA';
}

export function isQaOwner(state, task) {
  const owner = String(task?.owner ?? '').trim();
  if (!owner) return false;
  if (/^qa$/i.test(owner)) return true;
  return (state?.team ?? []).some((agent) => (
    String(agent?.name ?? '').trim().toLowerCase() === owner.toLowerCase()
    && /^qa$/i.test(String(agent?.role ?? '').trim())
  ));
}

export function canSendToQa(state, task) {
  if (!task || task.status === 'Done') return false;
  if (['Verified', 'Closed'].includes(String(task?.workflow ?? ''))) return false;
  return !isQaOwner(state, task);
}

function hasQaRecord(state, task) {
  return noteHas(task, '[待核') || isQaChecked(task) || isQaOwner(state, task);
}

function dependencyRefs(task) {
  const raw = task?.dependsOn ?? task?.depends_on ?? task?.dependencies ?? task?.depends ?? task?.blockedBy ?? [];
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  return String(raw ?? '').split(/[,;|]/).map((value) => value.trim()).filter(Boolean);
}

function dependencyRows(state, task) {
  return dependencyRefs(task).map((ref) => {
    const dependency = (state.tasks ?? []).find((row) => row.id === ref || String(row.key ?? '').toUpperCase() === ref.toUpperCase());
    return { ref, dependency, missing: !dependency };
  });
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pagesMentioningTask(state, task) {
  const tokens = [task.id, task.key].map((value) => String(value ?? '').trim()).filter(Boolean);
  const title = String(task.title ?? '').trim().toLowerCase();
  return (state.pages ?? []).filter((page) => {
    if (page.taskId === task.id) return true;
    const haystack = `${page.title ?? ''}\n${page.body ?? ''}`;
    if (tokens.some((token) => new RegExp(`(^|[^a-z0-9-])${escapeRegExp(token)}([^a-z0-9-]|$)`, 'i').test(haystack))) return true;
    return title.length >= 12 && haystack.toLowerCase().includes(title);
  });
}

function unfinishedDependencies(state, task) {
  return dependencyRefs(task).map((ref) => {
    const dependency = (state.tasks ?? []).find((row) => row.id === ref || String(row.key ?? '').toUpperCase() === ref.toUpperCase());
    if (!dependency) return { ref, missing: true };
    if (dependency.status === 'Done') return null;
    return { ref, dependency };
  }).filter(Boolean);
}

function reasonForBlocked(state, task) {
  const dependencies = unfinishedDependencies(state, task);
  if (dependencies.length) {
    const labels = dependencies.map(({ ref, dependency, missing }) => missing
      ? `${ref} (not found, treated as unfinished)`
      : `${taskNumber(dependency)} (${dependency.status})`);
    return `Depends on unfinished ${labels.join(', ')}.`;
  }
  if (task.status === 'Waiting' && !hasQaRecord(state, task)) {
    return 'Waiting with no QA hand-over ([待核]); unknown is treated as blocked.';
  }
  return '';
}

function reasonForReview(task) {
  if (task.reviewStale) return 'The deliverables changed after your decision. Review this version again.';
  const checkedAt = qaCheckDate(task);
  if (checkedAt) return `QA checked on ${fmt(checkedAt)}. You have not reviewed it.`;
  if (isQaChecked(task)) return 'QA has recorded its check. You have not reviewed it.';
  return 'Done and not yet reviewed.';
}

export function myworkQueues(state, projectFilter = '') {
  const scoped = (state.tasks ?? []).filter((task) => !projectFilter || task.projectId === projectFilter);
  const open = scoped.filter((task) => task.status !== 'Done');
  const decisionRows = open
    .filter((task) => task.pendingDecision || noteHas(task, '[待确认]'))
    .map((task) => ({
      task,
      reason: noteHas(task, '[待确认]')
        ? 'The note asks for your decision ([待确认]).'
        : 'The row is marked as waiting for your decision.',
      next: 'Confirm the decision, then set the owner or close it.',
    }));
  const blockedRows = open
    .map((task) => ({ task, reason: reasonForBlocked(state, task) }))
    .filter((row) => row.reason)
    .map((row) => ({ ...row, next: row.reason.startsWith('Depends') ? 'Finish or unblock the dependency first.' : 'Send it to QA or record the missing hand-over.' }));
  const reviewRows = scoped
    .filter((task) => (task.reviewStale || !task.reviewed) && (task.status === 'Done' || isQaChecked(task)))
    .map((task) => ({ task, reason: reasonForReview(task), next: 'Approve or request changes.' }));
  return [
    { title: 'Needs your decision', description: 'Open work items whose note asks for you (it contains [待确认]) or says it waits for your call.', rows: decisionRows },
    { title: 'Blocked', description: 'Open work items that depend on an unfinished item, or are Waiting with no hand-over to QA. Unknown is shown as blocked, not as fine.', rows: blockedRows },
    { title: 'Ready for review', description: 'QA has recorded its check, and you have not approved this version. Your approval is separate from QA’s check.', rows: reviewRows },
  ];
}

function mywork(state, query) {
  const all = query.get('all') === '1';
  const projectFilter = query.get('project') ?? '';
  const scopedCount = (state.tasks ?? []).filter((task) => !projectFilter || task.projectId === projectFilter).length;
  const projectOptions = (state.projects ?? []).map((project) => option(project.id, projectFilter, `${project.key} ${project.name}`)).join('');
  const queues = myworkQueues(state, projectFilter);
  return `
    ${pageHead('My work', 'Each list is computed from the stored rows; the counts are rows, not estimates.')}
    <form class="toolbar" data-form="mywork-filters">
      <input type="hidden" name="all" value="${all ? '1' : ''}" />
      <select class="select" name="project" aria-label="Scope by project"><option value="">All projects</option>${projectOptions}</select>
      <button class="btn btn-sm btn-primary" type="submit">Apply</button>
      ${projectFilter ? `<a class="btn btn-ghost btn-sm" href="${pageUrl('/mywork', { all: all ? 1 : '' })}">All projects</a>` : ''}
      <span class="toolbar-count">${scopedCount} work items in scope</span>
    </form>
    <div class="card-grid three-up">
      ${queues.map((queue) => {
        const shown = all ? queue.rows : queue.rows.slice(0, 8);
        return `<section class="card">
          <div class="card-head"><h2>${queue.title}</h2><span class="badge badge-accent">${queue.rows.length}</span></div>
          <div class="card-body">
            <p class="row-meta">${esc(queue.description)}</p>
            ${shown.length ? `<div class="row-list">${shown.map(({ task, reason, next }) => `<div class="row-item" data-mywork-row="${esc(queue.title)}" data-task-id="${esc(task.id)}">
              <span class="row-main">
                <span class="row-title"><a href="#/task/${encodeURIComponent(task.id)}">${esc(taskLabel(task))}</a></span>
                <span class="row-meta">${esc(reason)}</span>
                <span class="row-meta"><strong>Next:</strong> ${esc(next)}</span>
              </span>
              <span class="row-owner">${avatar(task.owner)}<span>${esc(task.owner || 'Unassigned')}</span></span>
              <span class="row-date">${esc(fmt(task.due))}</span>
            </div>`).join('')}</div>` : empty('Nothing here.')}
            ${!all && queue.rows.length > 8 ? `<a class="btn btn-ghost btn-sm" href="${pageUrl('/mywork', { all: 1, project: projectFilter })}">Show all ${queue.rows.length}</a>` : ''}
          </div>
        </section>`;
      }).join('')}
    </div>`;
}

function pagesPage(state, query) {
  const q = (query.get('q') ?? '').toLowerCase();
  const projectFilter = query.get('project') ?? '';
  const rows = state.pages.filter((page) => {
    const project = projectOf(state, page.projectId);
    const haystack = `${page.title} ${page.body} ${project?.name ?? ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!projectFilter || page.projectId === projectFilter);
  });
  const projectOptions = state.projects.map((p) => option(p.id, projectFilter, `${p.key} ${p.name}`)).join('');
  return `
    ${pageHead('Pages', 'Names, links and dates only. Open a Page for its content.', `<a class="btn btn-primary" href="#/pages/new">${icon('page', 16)}New page</a>`)}
    <form class="toolbar" data-form="page-filters">
      <input class="input" type="search" name="q" value="${esc(query.get('q') ?? '')}" placeholder="Search Pages…" aria-label="Search pages" />
      <select class="select" name="project" aria-label="Filter by project"><option value="">All projects</option>${projectOptions}</select>
      <button class="btn btn-sm" type="submit">Search</button>
      <span class="toolbar-count">${rows.length} Pages</span>
    </form>
    <div class="table-wrap">
      <table class="table table-stack">
        <thead><tr><th>Page</th><th>Type</th><th>Linked to</th><th>Project</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.map((page) => {
            const task = state.tasks.find((row) => row.id === page.taskId);
            const project = projectOf(state, page.projectId);
            return `<tr>
              <td data-label="Page"><a class="table-title" href="#/page/${page.id}">${esc(page.title)}</a></td>
              <td data-label="Type"><span class="badge badge-${page.type === 'Snapshot' ? 'accent' : 'muted'}">${esc(page.type)}</span></td>
              <td data-label="Linked to">${task ? `<a class="mono-link" href="#/task/${task.id}">${esc(task.title)}</a>` : '—'}</td>
              <td data-label="Project">${project ? esc(`${project.key} ${project.name}`) : '—'}</td>
              <td data-label="Updated">${fmtStamp(page.updatedAt)}</td>
              <td data-label="Actions"><a class="btn btn-ghost btn-sm" href="#/page/${page.id}/edit">Edit</a> <button class="btn btn-ghost btn-sm" type="button" data-action="delete-page" data-id="${page.id}">Delete</button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="6">${empty('No Page matches. Start a new one.')}</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function projectsPage(state, query) {
  const archived = query.get('archived') === '1';
  const chips = [
    `<a class="chip${!archived ? ' is-active' : ''}" href="#/projects">All</a>`,
    ...state.projects.filter((p) => !p.archived).map((p) => `<a class="chip${!archived ? '' : ''}" href="${pageUrl('/projects', { project: p.id })}">${esc(p.key)} ${esc(p.name)}</a>`),
    `<a class="chip${archived ? ' is-active' : ''}" href="${pageUrl('/projects', { archived: 1 })}">Archived (${state.projects.filter((p) => p.archived).length})</a>`,
  ];
  const rows = state.projects.filter((project) => Boolean(project.archived) === archived);
  return `
    ${pageHead('Projects', 'The work in progress, archived work and the daily record.', `<button class="btn btn-primary" type="button" data-action="focus-add-project">${icon('folder', 16)}Add project</button>`)}
    <div class="chip-row">${chips.join('')}</div>
    <div class="table-wrap">
      <table class="table table-stack">
        <thead><tr><th>Project</th><th>Status</th><th>Start</th><th>Due</th><th>Open work items</th><th>Pages</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.map((project) => {
            const open = state.tasks.filter((task) => task.projectId === project.id && task.status !== 'Done').length;
            const pages = state.pages.filter((page) => page.projectId === project.id).length;
            return `<tr>
              <td data-label="Project"><span class="project-cell"><span class="badge badge-accent">${esc(project.key)}</span><a class="table-title" href="#/project/${esc(project.key)}">${esc(project.name)}</a></span><span class="row-meta">${esc(project.description)}</span></td>
              <td data-label="Status">${statusBadge(project.archived ? 'Archived' : project.status)}</td>
              <td data-label="Start">${fmt(project.start)}</td>
              <td data-label="Due">${fmt(project.due)}</td>
              <td data-label="Open work items"><a href="#/project/${esc(project.key)}?tab=work">${open} open</a></td>
              <td data-label="Pages">${pages}</td>
              <td data-label="Actions">
                ${project.archived
                  ? `<button class="btn btn-ghost btn-sm" type="button" data-action="project-archive" data-id="${project.id}">Restore</button>`
                  : `<button class="btn btn-ghost btn-sm" type="button" data-action="project-archive" data-id="${project.id}">Archive</button>`}
              </td>
            </tr>`;
          }).join('') || `<tr><td colspan="7">${empty('No projects here.')}</td></tr>`}
        </tbody>
      </table>
    </div>
    <form class="card inline-form" id="add-project-form" data-form="add-project">
      <div class="card-head"><h2>Add a project</h2></div>
      <div class="card-body form-grid">
        <div class="field"><label for="project-key">Key</label><input id="project-key" name="key" type="text" maxlength="6" placeholder="TAG" required /></div>
        <div class="field"><label for="project-name">Name</label><input id="project-name" name="name" type="text" placeholder="Project name" required /></div>
        <div class="field"><label for="project-status">Status</label><select id="project-status" name="status"><option>Active</option><option>On hold</option><option>Done</option></select></div>
        <div class="field"><label for="project-owner">Owner</label><input id="project-owner" name="owner" type="text" value="Amara" /></div>
        <button class="btn btn-primary" type="submit">Add project</button>
      </div>
    </form>
    <details class="card">
      <summary class="card-head"><h2>What got done, day by day</h2><span class="badge badge-muted">Last 14 days</span></summary>
      <div class="card-body">${empty('No completed actions recorded for this period yet.')}</div>
    </details>`;
}

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const WORKFLOW_STATUSES = TASK_WORKFLOW_STATUSES;

function queryValues(query, key) {
  return query.getAll(key).flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean);
}

function matchesFilter(values, value) {
  return !values.length || values.includes(String(value ?? ''));
}

function progressOf(task) {
  const candidates = [task.progress, task.progressText, task.progressSummary, task.progress_summary_en, task.progress_summary_zh, task.notes, task.note];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return task.status ?? '';
}

export function filterTasks(state, query, options = {}) {
  const forcedProject = options.projectId ?? '';
  const reset = query.get('reset') === '1';
  const scopeParam = query.get('scope');
  const scope = !reset && ['all', 'everything', '1', 'true', 'yes'].includes(scopeParam) ? 'all' : 'open';
  const q = reset ? '' : (query.get('q') ?? '').trim();
  const status = reset ? '' : queryValues(query, 'status').join(',');
  const owner = reset ? '' : queryValues(query, 'owner').join(',');
  const priorityFilter = reset ? '' : queryValues(query, 'priority').join(',');
  const severity = reset ? '' : queryValues(query, 'severity').join(',');
  const component = reset ? '' : queryValues(query, 'component').join(',');
  const module = reset ? '' : queryValues(query, 'module').join(',');
  const projectFilter = reset ? '' : queryValues(query, 'project').join(',');
  const sortParam = reset ? 'smart' : (query.get('sort') ?? 'smart');
  const sort = ['smart', 'due', 'priority', 'key'].includes(sortParam) ? sortParam : 'smart';

  const statuses = status.split(',').filter(Boolean);
  const owners = owner.split(',').filter(Boolean);
  const priorities = priorityFilter.split(',').filter(Boolean);
  const severities = severity.split(',').filter(Boolean);
  const components = component.split(',').filter(Boolean);
  const modules = module.split(',').filter(Boolean);
  // A project-scoped page owns the scope; another project= value must not hide its rows.
  const projects = forcedProject ? [] : projectFilter.split(',').filter(Boolean);
  const needle = q.toLowerCase();

  let rows = state.tasks.filter((task) => {
    const project = projectOf(state, task.projectId);
    const haystack = `${task.title} ${task.notes ?? ''} ${task.note ?? ''} ${task.owner} ${task.id} ${task.key} ${task.component ?? ''} ${task.description ?? ''} ${task.module ?? ''} ${project?.name ?? ''}`.toLowerCase();
    // An explicit workflow status filter overrides the open-only default (inventory §3.2).
    if (scope === 'open' && task.status === 'Done' && !statuses.length) return false;
    return (!needle || haystack.includes(needle))
      && (!forcedProject || task.projectId === forcedProject)
      && matchesFilter(statuses, task.workflow)
      && matchesFilter(owners, task.owner)
      && matchesFilter(priorities, task.priority)
      && matchesFilter(severities, task.severity)
      && matchesFilter(components, task.component)
      && matchesFilter(modules, task.module)
      && matchesFilter(projects, task.projectId);
  });
  const priorityRank = (value) => {
    const rank = PRIORITY_ORDER.indexOf(value);
    return rank === -1 ? PRIORITY_ORDER.length : rank;
  };
  const dueValue = (task) => task.due || '9999-12-31';
  rows = [...rows].sort((a, b) => {
    if (sort === 'due') return dueValue(a).localeCompare(dueValue(b)) || a.key.localeCompare(b.key, undefined, { numeric: true });
    if (sort === 'priority') return priorityRank(a.priority) - priorityRank(b.priority) || dueValue(a).localeCompare(dueValue(b)) || a.key.localeCompare(b.key, undefined, { numeric: true });
    if (sort === 'key') return a.key.localeCompare(b.key, undefined, { numeric: true });
    return (a.status === 'Done') - (b.status === 'Done')
      || dueValue(a).localeCompare(dueValue(b))
      || priorityRank(a.priority) - priorityRank(b.priority)
      || a.key.localeCompare(b.key, undefined, { numeric: true });
  });
  return { rows, scope, q, status, owner, priorityFilter, severity, component, module, projectFilter: forcedProject || projectFilter, sort };
}

function taskRow(state, task, depth, children = []) {
  const project = projectOf(state, task.projectId);
  const childCount = children.length;
  const childLabel = `${childCount} ${childCount === 1 ? 'subtask' : 'subtasks'}`;
  const controls = children.map((child) => `subtask-${child.id}`).join(' ');
  const toggle = childCount
    ? `<button class="btn btn-ghost btn-sm" type="button" data-action="toggle-subtasks" data-id="${task.id}" data-key="${esc(task.key)}" aria-expanded="false" aria-controls="${esc(controls)}" aria-label="Show subtasks for ${esc(task.key)}"><span aria-hidden="true" data-toggle-glyph>▸</span><span class="sr-only" data-toggle-label>Show subtasks for ${esc(task.key)}</span></button>`
    : '';
  return `<tr class="${depth ? 'is-subtask' : ''}" id="subtask-${task.id}" data-row-id="${task.id}"${depth ? ` data-parent-row="${task.parentId}" hidden` : ''}>
    <td data-label="Key">${toggle}<a class="key-link" href="#/task/${task.id}">${task.parentId ? '↳ ' : ''}${esc(task.key)}</a></td>
    <td data-label="Summary"><a class="table-title" href="#/task/${task.id}">${esc(task.title)}</a>${childCount ? `<span class="row-meta"> · ${childLabel}</span>` : ''}</td>
    <td data-label="Project">${project ? `<span class="badge badge-accent">${esc(project.key)}</span>` : '—'}</td>
    <td data-label="Progress"><span class="progress-text">${esc(progressOf(task))}</span></td>
    <td data-label="Status">${statusBadge(task.workflow)}</td>
    <td data-label="Assignee"><span class="assignee">${avatar(task.owner)}${esc(task.owner)}</span></td>
    <td data-label="Due">${task.start ? `${fmt(task.start)} → ` : ''}${fmt(task.due)}</td>
    <td data-label="Priority">${priority(task.priority)}</td>
    <td data-label="Severity">${esc(task.severity)}</td>
    <td data-label="Component">${esc(task.component)}</td>
    <td data-label="Age">${age(task.createdAt)}</td>
    <td data-label="Actions"><div class="row-actions">${canSendToQa(state, task) ? `<button class="btn btn-ghost btn-sm" type="button" data-action="task-toqa" data-id="${task.id}">Send to QA</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-action="task-brief" data-id="${task.id}">Brief</button></div></td>
  </tr>`;
}

function taskTable(state, rows) {
  const visible = new Set(rows.map((task) => task.id));
  const childrenByParent = new Map();
  for (const task of rows) {
    if (!task.parentId || !visible.has(task.parentId) || task.parentId === task.id) continue;
    if (!childrenByParent.has(task.parentId)) childrenByParent.set(task.parentId, []);
    childrenByParent.get(task.parentId).push(task);
  }
  const output = [];
  const rendered = new Set();
  const render = (task, depth) => {
    if (rendered.has(task.id)) return;
    rendered.add(task.id);
    const children = childrenByParent.get(task.id) ?? [];
    output.push(taskRow(state, task, depth, children));
    for (const child of children) render(child, depth + 1);
  };
  for (const task of rows) {
    if (!task.parentId || !visible.has(task.parentId) || task.parentId === task.id) render(task, 0);
  }
  return `<div class="table-wrap"><table class="table table-stack">
    <thead><tr><th>Key</th><th>Summary</th><th>Project</th><th>Progress</th><th>Status</th><th>Assignee</th><th>Due</th><th>Priority</th><th>Severity</th><th>Component</th><th>Age</th><th>Actions</th></tr></thead>
    <tbody>${output.join('') || `<tr><td colspan="12">${empty('No work items match these filters.')}</td></tr>`}</tbody>
  </table></div>`;
}

const DONE_QA_MARKS = ['[已核', '[免核'];

function doneWithoutQaMark(state) {
  return (state.tasks ?? []).filter((task) => (
    task.status === 'Done' && !DONE_QA_MARKS.some((mark) => noteHas(task, mark))
  ));
}

function lostHandoverMarks(state) {
  const tasks = new Map((state.tasks ?? []).map((task) => [task.id, task]));
  const lost = new Map();
  const hasHandover = (task) => noteHas(task, '[待核') || DONE_QA_MARKS.some((mark) => noteHas(task, mark));

  // A recorded hand-over that no longer appears in the row's note.
  for (const entry of state.taskHistory ?? []) {
    const field = String(entry?.field ?? '').toLowerCase();
    if (field !== 'note' && field !== 'notes') continue;
    const task = tasks.get(entry.taskId);
    if (!task || hasHandover(task)) continue;
    const match = String(entry.new ?? '').match(/\[待核(?:\s+(\d{4}-\d{2}-\d{2}))?/);
    if (!match) continue;
    lost.set(task.id, { task, mark: '待核', date: match[1] || today() });
  }

  // Rows that were handed to QA but lost the mark before it was written.
  for (const task of tasks.values()) {
    if (lost.has(task.id) || task.status !== 'Waiting' || hasHandover(task)) continue;
    lost.set(task.id, { task, mark: '待核', date: today() });
  }

  // Done rows whose workflow proves QA checked them, but whose note lost the mark.
  for (const task of tasks.values()) {
    if (lost.has(task.id) || task.status !== 'Done' || hasHandover(task)) continue;
    if (!['Verified', 'Closed'].includes(String(task.workflow ?? ''))) continue;
    lost.set(task.id, { task, mark: '已核', date: qaCheckDate(task) || today() });
  }

  return [...lost.values()].slice(0, 10);
}

function boardHealth(state) {
  const done = doneWithoutQaMark(state);
  const lost = lostHandoverMarks(state);
  const dropped = (state.tasks ?? []).filter((task) => noteHas(task, '[dropped'));
  if (!done.length && !lost.length && !dropped.length) return '';
  const doneShown = done.slice(0, 12);
  const healthRow = (task, kind, action = '') => `<div class="row-item" data-health-row="${esc(kind)}">
    <span class="row-main"><span class="row-title"><a href="#/task/${task.id}">${esc(task.key)} · ${esc(task.title)}</a></span><span class="row-meta">${esc(task.owner)} · ${esc(task.workflow)}${task.notes ? ` · ${esc(task.notes)}` : ''}</span></span>
    ${action}
  </div>`;
  const total = done.length + lost.length + (dropped.length ? 1 : 0);
  return `<details class="card">
    <summary class="card-head"><span class="card-title">Board health</span><span class="badge badge-warning">${total} to review</span></summary>
    <div class="card-body">
      ${done.length ? `<div class="stack" data-health-section="done"><h3 class="card-title">Done without a QA mark</h3><p class="row-meta">A Done note needs <code>[已核</code> or <code>[免核</code>. Showing ${doneShown.length} of ${done.length}.</p><div class="row-list">${doneShown.map((task) => healthRow(task, 'done')).join('')}</div></div>` : ''}
      ${lost.length ? `<div class="stack" data-health-section="lost"><h3 class="card-title">Lost hand-over marks</h3><p class="row-meta">These rows have evidence of a QA hand-over, but the mark is missing from the note.</p><div class="row-list">${lost.map(({ task, mark, date }) => healthRow(task, 'lost', `<button class="btn btn-ghost btn-sm" type="button" data-action="task-restore-mark" data-id="${task.id}">Restore mark</button><span class="sr-only">${esc(mark)} ${esc(date)}</span>`)).join('')}</div></div>` : ''}
      ${dropped.length ? `<p class="row-meta" data-health-section="dropped"><strong>${dropped.length} dropped ${dropped.length === 1 ? 'row stays' : 'rows stay'} in tasks.tsv.</strong> Their notes contain <code>[dropped</code>, so they are reported here instead of being deleted.</p>` : ''}
    </div>
  </details>`;
}

function taskBoard(state, rows) {
  const columns = ['To Do', 'In Progress', 'In Review', 'Done'];
  const bucket = (task) => {
    const status = String(task.status ?? '');
    if (status === 'To do') return 'To Do';
    if (status === 'Done') return 'Done';
    if (status === 'In Review' || status === 'In review') return 'In Review';
    if (status === 'Waiting') return isQaOwner(state, task) ? 'In Review' : 'In Progress';
    return 'In Progress';
  };
  const cards = (column) => rows.filter((task) => bucket(task) === column).map((task) => {
    const flagged = task.status === 'Waiting' && !isQaOwner(state, task);
    return `<article class="board-card" data-board-task="${task.id}">
      <a href="#/task/${task.id}">${esc(task.title)}</a>
      <span class="row-meta">${esc(task.key)} · ${esc(task.owner)}</span>
      ${flagged ? '<span class="badge badge-warning">Waiting · no QA owner</span>' : ''}
      <div class="board-card-foot">${statusBadge(task.workflow)}${priority(task.priority)}</div>
      <label class="board-move"><span>Move to…</span><select class="select select-sm" data-move-task="${task.id}" aria-label="Move ${esc(task.key)} to">${['To do', 'In progress', 'Waiting', 'Done'].map((status) => option(status, task.status)).join('')}</select></label>
      ${canSendToQa(state, task) ? `<div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-action="task-toqa" data-id="${task.id}">Send to QA</button></div>` : ''}
    </article>`;
  }).join('') || empty('No items.');
  return `<div class="board">${columns.map((column) => `<section class="board-column" data-board-column="${esc(column)}"><h2>${column}<span class="badge badge-muted">${rows.filter((task) => bucket(task) === column).length}</span></h2>${cards(column)}</section>`).join('')}</div>${boardHealth(state)}`;
}

const pad2 = (value) => String(value).padStart(2, '0');

function parseMonth(value) {
  const now = new Date();
  const match = /^(\d{4})-(\d{1,2})$/.exec(String(value ?? ''));
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Math.min(12, Math.max(1, Number(match[2]))) : now.getMonth() + 1;
  return { year, month, value: `${year}-${pad2(month)}` };
}

function shiftMonth(current, delta) {
  const date = new Date(current.year, current.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1, value: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}` };
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function daysBetween(from, to) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function milestoneDate(task) {
  const raw = task?.milestone;
  const candidates = [task?.milestoneAt, task?.milestoneDate];
  if (raw && typeof raw === 'object') candidates.unshift(raw.date ?? raw.at ?? raw.due);
  if (typeof raw === 'string') candidates.unshift(raw);
  for (const candidate of candidates) {
    const match = String(candidate ?? '').match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const flag = raw === true || raw === 1
    || (typeof raw === 'string' && !['', '0', 'false', 'no'].includes(raw.toLowerCase()))
    || task?.isMilestone
    || /^milestone$/i.test(String(task?.type ?? '').trim())
    || /^milestone$/i.test(String(task?.kind ?? '').trim());
  return flag ? dateOnly(task?.due || task?.start) : '';
}

function undatedSummary(rows, isUndated = (task) => !dateOnly(task.due)) {
  const undated = rows.filter(isUndated);
  const open = undated.filter((task) => task.status !== 'Done');
  return { undated, open };
}

function undatedCount(rows, isUndated) {
  const { undated, open } = undatedSummary(rows, isUndated);
  return `<p class="row-meta" data-undated-count="${open.length}" data-undated-total="${undated.length}">${open.length} open undated ${open.length === 1 ? 'item' : 'items'}</p>`;
}

function taskCalendarView(rows, query, base, path = '/tasks') {
  const current = parseMonth(query.get('m'));
  const monthStart = new Date(current.year, current.month - 1, 1);
  const daysInMonth = new Date(current.year, current.month, 0).getDate();
  const lead = (monthStart.getDay() + 6) % 7;
  const trailing = (7 - ((lead + daysInMonth) % 7)) % 7;
  const byDate = new Map();
  for (const task of rows) {
    const due = dateOnly(task.due);
    if (!due) continue;
    if (!byDate.has(due)) byDate.set(due, []);
    byDate.get(due).push(task);
  }
  const prev = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthTaskCount = [...byDate.entries()].filter(([date]) => date.startsWith(current.value)).reduce((sum, [, items]) => sum + items.length, 0);
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push('<span class="calendar-day is-outside"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${current.value}-${pad2(day)}`;
    const items = byDate.get(date) ?? [];
    const isToday = date === today();
    cells.push(`<div class="calendar-day${isToday ? ' is-today' : ''}${items.length ? ' has-items' : ''}" data-calendar-date="${date}">
      <span class="calendar-date">${day}</span>
      ${items.slice(0, 3).map((task) => `<a class="calendar-item calendar-item-task" href="#/task/${encodeURIComponent(task.id)}" data-task-id="${esc(task.id)}">${esc(task.key ? `${task.key} · ` : '')}${esc(task.title)}</a>`).join('')}
      ${items.length > 3 ? `<span class="calendar-more">+${items.length - 3}</span>` : ''}
    </div>`);
  }
  for (let i = 0; i < trailing; i += 1) cells.push('<span class="calendar-day is-outside"></span>');
  const openUndated = undatedSummary(rows).open;
  const undatedLinks = openUndated.slice(0, 6).map((task) => `<a class="row-item" href="#/task/${encodeURIComponent(task.id)}"><span class="row-main"><span class="row-title">${esc(task.key ? `${task.key} · ` : '')}${esc(task.title)}</span><span class="row-meta">No due date · ${esc(task.status)}</span></span><span class="badge badge-muted">${esc(task.owner || 'Unassigned')}</span></a>`).join('');
  return `<section class="card" data-task-view="calendar" data-view="calendar">
    <div class="card-head"><h2>Calendar</h2><span class="badge badge-muted">${monthTaskCount} in ${esc(monthName)}</span></div>
    <div class="card-body">
      <div class="calendar-toolbar">
        <a class="btn btn-ghost btn-sm" href="${pageUrl(path, { ...base, view: 'calendar', m: prev.value })}">Previous</a>
        <a class="btn btn-ghost btn-sm" href="${pageUrl(path, { ...base, view: 'calendar', m: thisMonth })}">This month</a>
        <a class="btn btn-ghost btn-sm" href="${pageUrl(path, { ...base, view: 'calendar', m: next.value })}">Next</a>
        <h2 class="calendar-month">${esc(monthName)}</h2>
      </div>
      <div class="calendar">
        <div class="calendar-week">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => `<span class="calendar-weekday">${day}</span>`).join('')}</div>
        <div class="calendar-grid">${cells.join('')}</div>
      </div>
      ${undatedCount(rows)}
      ${undatedLinks ? `<div class="row-list">${undatedLinks}</div>${openUndated.length > 6 ? `<p class="row-meta">${openUndated.length - 6} more open undated items.</p>` : ''}` : ''}
    </div>
  </section>`;
}

function taskTimelineView(rows, base) {
  const todayIso = today();
  const datedRows = rows.map((task) => {
    const milestone = milestoneDate(task);
    const start = dateOnly(task.start) || dateOnly(task.due) || milestone;
    const end = dateOnly(task.due) || start;
    return { task, start, end, milestone };
  }).filter((row) => row.start || row.end || row.milestone);
  const dates = [todayIso];
  for (const row of datedRows) {
    if (row.start) dates.push(row.start);
    if (row.end) dates.push(row.end);
    if (row.milestone) dates.push(row.milestone);
  }
  const sorted = dates.sort();
  const first = datedRows.length ? addDays(sorted[0], -1) : addDays(todayIso, -3);
  const last = datedRows.length ? addDays(sorted[sorted.length - 1], 1) : addDays(todayIso, 10);
  const totalDays = Math.max(1, daysBetween(first, last) + 1);
  const todayIndex = Math.max(0, Math.min(totalDays - 1, daysBetween(first, todayIso)));
  const isUndated = (task) => !dateOnly(task.start) && !dateOnly(task.due) && !milestoneDate(task);
  const undated = undatedSummary(rows, isUndated);
  const undatedLinks = undated.open.slice(0, 6).map((task) => `<a class="row-item" href="#/task/${encodeURIComponent(task.id)}"><span class="row-main"><span class="row-title">${esc(task.key ? `${task.key} · ` : '')}${esc(task.title)}</span><span class="row-meta">No dates · ${esc(task.status)}</span></span><span class="badge badge-muted">${esc(task.owner || 'Unassigned')}</span></a>`).join('');
  const rowHtml = datedRows.map(({ task, start, end, milestone }) => {
    const span = Math.max(1, daysBetween(start, end) + 1);
    const startIndex = Math.max(0, Math.min(totalDays - 1, daysBetween(first, start)));
    const milestoneIndex = milestone ? Math.max(0, Math.min(totalDays - 1, daysBetween(first, milestone))) : -1;
    const label = task.key ? `${task.key} · ${task.title}` : task.title;
    const range = start === end ? fmt(start) : `${fmt(start)} → ${fmt(end)}`;
    return `<div class="timeline-row" data-timeline-row data-task-id="${esc(task.id)}" data-start="${esc(start)}" data-end="${esc(end)}">
      <span class="timeline-label">
        <a class="table-title" href="#/task/${encodeURIComponent(task.id)}">${esc(label)}</a>
        <span class="row-meta">${esc(task.owner || 'Unassigned')} · ${esc(task.status)} · ${esc(range)}</span>
      </span>
      <span class="timeline-track">
        <a class="timeline-bar timeline-bar-${task.status === 'Done' ? 'done' : 'open'}" href="#/task/${encodeURIComponent(task.id)}" data-timeline-bar data-start-index="${startIndex}" data-span="${span}" data-start="${esc(start)}" data-end="${esc(end)}" aria-label="${esc(`${label}, ${range}`)}"></a>
        ${milestone ? `<a class="timeline-milestone" href="#/task/${encodeURIComponent(task.id)}" data-timeline-milestone data-date-index="${milestoneIndex}" data-date="${esc(milestone)}" title="Milestone: ${esc(milestone)}" aria-label="Milestone for ${esc(label)} on ${esc(fmt(milestone))}"></a>` : ''}
        <span class="timeline-today" data-timeline-today data-today-index="${todayIndex}" aria-hidden="true"></span>
      </span>
    </div>`;
  }).join('');
  return `<section class="card" data-task-view="timeline" data-view="timeline">
    <div class="card-head"><h2>Timeline</h2><span class="badge badge-muted">${datedRows.length} dated</span></div>
    <div class="card-body">
      <div class="timeline-legend">
        <span class="badge badge-accent">Dated bar</span>
        <span class="badge badge-muted">Today line</span>
        <span class="badge badge-band">Milestone</span>
      </div>
      <div class="timeline" data-timeline data-days="${totalDays}">
        <div class="timeline-head">
          <span class="timeline-label">Work item</span>
          <span class="timeline-axis"><span>${esc(fmt(first))}</span><span class="timeline-axis-today">Today · ${esc(fmt(todayIso))}</span><span>${esc(fmt(last))}</span></span>
        </div>
        ${rowHtml || `<div class="timeline-row" data-timeline-row><span class="timeline-label">${empty('No dated items match these filters.')}</span><span class="timeline-track"><span class="timeline-today" data-timeline-today data-today-index="${todayIndex}" aria-hidden="true"></span></span></div>`}
      </div>
      ${undatedCount(rows, isUndated)}
      ${undatedLinks ? `<div class="row-list">${undatedLinks}</div>${undated.open.length > 6 ? `<p class="row-meta">${undated.open.length - 6} more open undated items.</p>` : ''}` : ''}
    </div>
  </section>`;
}

function workItemsBody(state, query, options = {}) {
  const path = options.path ?? '/tasks';
  const projectId = options.projectId ?? '';
  const tab = options.tab ?? '';
  const allTasks = state.tasks ?? [];
  const tasks = projectId ? allTasks.filter((task) => task.projectId === projectId) : allTasks;
  const scopedState = tasks === allTasks ? state : { ...state, tasks };
  const { rows, scope, q, status, owner, priorityFilter, severity, component, module, projectFilter, sort } = filterTasks(scopedState, query, { projectId });
  const view = ['list', 'board', 'calendar', 'timeline'].includes(query.get('view')) ? query.get('view') : 'list';
  const openCount = tasks.filter((task) => task.status !== 'Done').length;
  const allCount = tasks.length;
  const overdue = tasks.filter((task) => task.due && task.due < today() && task.status !== 'Done').length;
  const monthParam = query.get('m') ?? '';
  const carried = { q, status, owner, priority: priorityFilter, severity, component, module, project: projectId || projectFilter, sort, scope, m: monthParam, tab };
  const url = (params) => pageUrl(path, { ...carried, ...params });
  const unique = (field) => [...new Set(tasks.map((task) => task[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const statusOptions = [...new Set([...WORKFLOW_STATUSES, ...unique('workflow')])];
  const severityOptions = [...new Set([...['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'], ...unique('severity')])];
  const componentOptions = unique('component');
  const moduleOptions = unique('module');
  const project = projectId ? (state.projects ?? []).find((row) => row.id === projectId) : null;
  const projectField = projectId
    ? `<select class="select" name="project" aria-label="Project" disabled><option selected>${esc([project?.key, project?.name].filter(Boolean).join(' ') || projectId)}</option></select><input type="hidden" name="project" value="${esc(projectId)}" />`
    : `<select class="select" name="project" aria-label="Project"><option value="">All projects</option>${(state.projects ?? []).map((p) => option(p.id, projectFilter, `${p.key} ${p.name}`)).join('')}</select>`;
  return `
    <div class="task-toolbar">
      <div class="tabs">${['list', 'board', 'calendar', 'timeline'].map((name) => `<a class="tab" href="${url({ view: name })}"${view === name ? ' aria-current="page"' : ''}>${name[0].toUpperCase() + name.slice(1)}</a>`).join('')}</div>
      <div class="scope-switch">
        <a class="chip${scope === 'open' ? ' is-active' : ''}" href="${url({ scope: 'open' })}">Open ${openCount}</a>
        <a class="chip${scope === 'all' ? ' is-active' : ''}" href="${url({ scope: 'all' })}">All ${allCount}</a>
      </div>
      <span class="toolbar-count">${tasks.filter((task) => task.status === 'In progress').length} in progress · ${tasks.filter((task) => task.status === 'Waiting').length} in review · ${overdue} overdue</span>
    </div>
    <form class="toolbar" data-form="task-filters" data-path="${esc(path)}">
      <input type="hidden" name="view" value="${view}" /><input type="hidden" name="scope" value="${scope}" /><input type="hidden" name="m" value="${esc(monthParam)}" />${tab ? `<input type="hidden" name="tab" value="${esc(tab)}" />` : ''}
      <input class="input" type="search" name="q" value="${esc(q)}" placeholder="Search work items…" aria-label="Search work items" />
      <select class="select" name="status" aria-label="Status"><option value="">All statuses</option>${statusOptions.map((value) => option(value, status)).join('')}</select>
      <select class="select" name="owner" aria-label="Owner"><option value="">All owners</option>${[...new Set(tasks.map((task) => task.owner).filter(Boolean))].map((value) => option(value, owner)).join('')}</select>
      <select class="select" name="priority" aria-label="Priority"><option value="">All priorities</option>${PRIORITY_ORDER.map((value) => option(value, priorityFilter)).join('')}</select>
      <select class="select" name="severity" aria-label="Severity"><option value="">All severities</option>${severityOptions.map((value) => option(value, severity)).join('')}</select>
      <select class="select" name="component" aria-label="Component"><option value="">All components</option>${componentOptions.map((value) => option(value, component)).join('')}</select>
      <select class="select" name="module" aria-label="Module"><option value="">All modules</option>${moduleOptions.map((value) => option(value, module)).join('')}</select>
      ${projectField}
      <select class="select" name="sort" aria-label="Sort"><option value="smart"${sort === 'smart' ? ' selected' : ''}>Smart order</option>${[['due', 'Due date'], ['priority', 'Priority'], ['key', 'Key']].map(([value, label]) => `<option value="${value}"${sort === value ? ' selected' : ''}>${label}</option>`).join('')}</select>
      <button class="btn btn-sm btn-primary" type="submit">Apply</button>
      <a class="btn btn-ghost btn-sm" href="${pageUrl(path, { view, ...(tab ? { tab } : {}) })}">Reset</a>
    </form>
    ${view === 'board' ? taskBoard(scopedState, rows) : view === 'calendar' ? taskCalendarView(rows, query, carried, path) : view === 'timeline' ? taskTimelineView(rows, carried) : taskTable(scopedState, rows)}`;
}

function tasksPage(state, query) {
  return `${pageHead('All work items', 'Everything you and your agents are working on, across projects.')}${workItemsBody(state, query)}`;
}

function calendarItems(state, date, projectFilter) {
  const items = [];
  for (const task of state.tasks) {
    if (task.due === date && task.status !== 'Done' && (!projectFilter || task.projectId === projectFilter)) items.push({ title: task.title, href: `#/task/${task.id}`, kind: 'Task', tone: 'task' });
  }
  for (const bug of state.bugs) {
    if (bug.due === date && !['Closed', 'Verified', 'Wont fix'].includes(bug.status) && !projectFilter) items.push({ title: bug.title, href: `#/bug/${bug.id}`, kind: 'Bug', tone: 'bug' });
  }
  for (const project of state.projects) {
    if (project.due === date && project.status !== 'Done' && !project.archived && (!projectFilter || project.id === projectFilter)) items.push({ title: project.name, href: `#/project/${project.key}`, kind: 'Project', tone: 'project' });
  }
  for (const event of state.events) {
    if (!occursOn(event, date) || (projectFilter && event.projectId !== projectFilter)) continue;
    items.push({ title: event.title, href: event.taskId ? `#/task/${event.taskId}` : '', kind: event.kind, tone: 'event', link: event.link, id: event.seriesId || event.id, time: event.time });
  }
  return items;
}

function calendarPage(state, query) {
  const now = new Date();
  const [year, month] = (query.get('m') ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (monthStart.getDay() + 6) % 7;
  const projectFilter = query.get('project') ?? '';
  const monthValue = `${year}-${String(month).padStart(2, '0')}`;
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push('<span class="calendar-day is-outside"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const items = calendarItems(state, date, projectFilter);
    const isToday = date === today();
    cells.push(`<div class="calendar-day${isToday ? ' is-today' : ''}${items.length ? ' has-items' : ''}" data-calendar-date="${date}"><span class="calendar-date">${day}</span>${items.slice(0, 3).map((item) => item.href ? `<a class="calendar-item calendar-item-${item.tone}" href="${item.href}">${esc(item.title)}</a>` : `<span class="calendar-item calendar-item-${item.tone}">${esc(item.title)}</span>`).join('')}${items.length > 3 ? `<span class="calendar-more">+${items.length - 3}</span>` : ''}</div>`);
  }
  const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const nextSeven = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const item of calendarItems(state, date, projectFilter)) nextSeven.push({ ...item, date });
  }
  return `
    ${pageHead('Calendar', 'Deadlines, project dues and events in one place.', `<button class="btn" type="button" data-action="enable-reminders">${icon('camera', 16)}Enable reminders</button>`)}
    <div class="calendar-toolbar">
      <a class="btn btn-ghost btn-sm" href="${pageUrl('/calendar', { m: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`, project: projectFilter })}">Previous</a>
      <a class="btn btn-ghost btn-sm" href="${pageUrl('/calendar', { m: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, project: projectFilter })}">This month</a>
      <a class="btn btn-ghost btn-sm" href="${pageUrl('/calendar', { m: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`, project: projectFilter })}">Next</a>
      <h2 class="calendar-month">${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
      <form data-form="calendar-project"><input type="hidden" name="m" value="${monthValue}" /><select class="select" name="project" aria-label="Project"><option value="">All projects</option>${state.projects.map((p) => option(p.id, projectFilter, `${p.key} ${p.name}`)).join('')}</select></form>
    </div>
    <section class="card">
      <div class="card-body">
        <div class="calendar">
          <div class="calendar-week">${week.map((d) => `<span class="calendar-weekday">${d}</span>`).join('')}</div>
          <div class="calendar-grid">${cells.join('')}</div>
        </div>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Next seven days</h2><span class="badge badge-muted">${nextSeven.length} items</span></div>
      <div class="card-body">${nextSeven.length ? `<div class="row-list">${nextSeven.map((item) => `<div class="row-item"><span class="row-date">${fmt(item.date)}</span><span class="row-main"><span class="row-title">${item.href ? `<a href="${item.href}">${esc(item.title)}</a>` : esc(item.title)}</span><span class="row-meta">${esc(item.kind)}${item.time ? ` · ${esc(item.time)}` : ''}</span></span><span class="badge badge-muted">${esc(item.kind)}</span>${item.link ? `<a class="btn btn-ghost btn-sm" href="${esc(item.link)}" target="_blank" rel="noreferrer">Join</a>` : ''}${item.id ? `<button class="btn btn-ghost btn-sm" type="button" data-action="delete-event" data-id="${esc(item.id)}" data-series-id="${esc(item.id)}">Delete</button>` : ''}</div>`).join('')}</div>` : empty('Nothing scheduled in the next seven days.')}</div>
    </section>`;
}

function bugsPage(state, query) {
  const q = (query.get('q') ?? '').toLowerCase();
  const status = query.get('status') ?? '';
  const assignee = query.get('assignee') ?? '';
  const severity = query.get('severity') ?? '';
  const rows = state.bugs.filter((bug) => (!q || `${bug.title} ${bug.key} ${bug.description}`.toLowerCase().includes(q)) && (!status || bug.status === status) && (!assignee || bug.assignee === assignee) && (!severity || bug.severity === severity));
  const open = state.bugs.filter((bug) => !['Closed', 'Verified', 'Wont fix'].includes(bug.status)).length;
  const waiting = state.bugs.filter((bug) => bug.status === 'Fixed').length;
  const past = state.bugs.filter((bug) => bug.due && bug.due < today() && !['Closed', 'Verified', 'Wont fix'].includes(bug.status)).length;
  return `
    ${pageHead('Bugs', 'Defects with the eleven-status workflow.', `<a class="btn btn-primary" href="#/bugs/new">${icon('bug', 16)}Report a bug</a>`)}
    <div class="stat-grid">
      <div class="stat"><strong>${open}</strong><span>Open</span></div>
      <div class="stat"><strong>${state.bugs.length}</strong><span>Total</span></div>
      <div class="stat"><strong>${waiting}</strong><span>Waiting for QA</span></div>
      <div class="stat"><strong>${past}</strong><span>Past due</span></div>
    </div>
    <form class="toolbar" data-form="bug-filters">
      <input class="input" type="search" name="q" value="${esc(query.get('q') ?? '')}" placeholder="Search bugs…" aria-label="Search bugs" />
      <select class="select" name="status"><option value="">All statuses</option>${['New', 'Triaged', 'In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Duplicate', 'Wont fix', 'Deferred', 'Rejected'].map((value) => option(value, status)).join('')}</select>
      <select class="select" name="assignee"><option value="">All assignees</option>${[...new Set(state.bugs.map((bug) => bug.assignee))].map((value) => option(value, assignee)).join('')}</select>
      <select class="select" name="severity"><option value="">All severities</option>${['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'].map((value) => option(value, severity)).join('')}</select>
      <button class="btn btn-sm btn-primary" type="submit">Apply</button><a class="btn btn-ghost btn-sm" href="#/bugs">Reset</a>
    </form>
    <div class="table-wrap"><table class="table table-stack">
      <thead><tr><th>Key</th><th>Summary</th><th>Status</th><th>Assignee</th><th>Due</th><th>Priority</th><th>Severity</th><th>Component</th><th>Age</th></tr></thead>
      <tbody>${rows.map((bug) => `<tr><td data-label="Key"><a class="key-link" href="#/bug/${bug.id}">${esc(bug.key)}</a></td><td data-label="Summary"><a class="table-title" href="#/bug/${bug.id}">${esc(bug.title)}</a></td><td data-label="Status">${statusBadge(bug.status)}</td><td data-label="Assignee"><span class="assignee">${avatar(bug.assignee)}${esc(bug.assignee)}</span></td><td data-label="Due">${fmt(bug.due)}</td><td data-label="Priority">${priority(bug.priority)}</td><td data-label="Severity">${esc(bug.severity)}</td><td data-label="Component">${esc(bug.component)}</td><td data-label="Age">${age(bug.createdAt)}</td></tr>`).join('') || `<tr><td colspan="9">${empty('No bugs match these filters.')}</td></tr>`}</tbody>
    </table></div>`;
}

function teamPage(state) {
  const openTasks = state.tasks.filter((task) => task.status !== 'Done');
  const stats = [
    ['Decisions waiting', openTasks.filter((task) => task.pendingDecision).length],
    ['Reviews ready', state.tasks.filter((task) => task.status === 'Done' && !task.reviewed).length],
    ['People working', state.team.filter((agent) => agent.status === 'Working').length],
    ['Open work items', openTasks.length],
    ['Actions today', state.events.filter((event) => event.date === today()).length],
  ];
  return `
    ${pageHead('Team', 'Decisions, blocked work and the agents who own it.', `<button class="btn" type="button" data-action="open-create">${icon('spark', 16)}New order</button>`)}
    <div class="stat-grid">${stats.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
    <div class="card-grid three-up">
      ${state.team.map((agent) => {
        const owned = openTasks.filter((task) => task.owner === agent.name);
        const openOrders = state.orders.filter((order) => order.owner === agent.name && order.open);
        return `<section class="card team-card">
          <div class="card-body">
            <div class="team-head">${avatar(agent.name, 'avatar-lg')}<div><a class="table-title" href="#/task/${owned[0]?.id ?? ''}">${esc(agent.name)}</a><span class="row-meta">${esc(agent.role)} · ${esc(agent.status)}</span></div><span class="badge badge-${agent.status === 'Working' ? 'accent' : 'muted'}">${esc(agent.status)}</span></div>
            <dl class="details compact"><div><dt>Focus</dt><dd>${esc(agent.focus)}</dd></div><div><dt>Workload</dt><dd>${owned.length} open${openOrders.length ? ` · ${openOrders.length} order` : ''}</dd></div><div><dt>Model</dt><dd>${esc(agent.model)}</dd></div><div><dt>Latest</dt><dd>${esc(agent.activity)}</dd></div></dl>
            <form class="order-form" data-form="order"><input type="hidden" name="owner" value="${esc(agent.name)}" /><div class="field"><label for="order-${agent.id}">Give ${esc(agent.name)} an order</label><input id="order-${agent.id}" name="text" type="text" placeholder="What should they do?" required /></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Send</button><button class="btn btn-ghost btn-sm" type="button" data-action="agent-todo" data-owner="${esc(agent.name)}">To-do list</button></div></form>
          </div>
        </section>`;
      }).join('')}
    </div>`;
}

function filesPage(state, query) {
  const tab = query.get('tab') === 'agents' ? 'agents' : 'charts';
  const run = query.get('run') === '1';
  return `
    ${pageHead('Tools & Files', 'Chart Studio and the agent configuration files.')}
    <div class="tabs"><a class="tab" href="#/files"${tab === 'charts' ? ' aria-current="page"' : ''}>Chart Studio</a><a class="tab" href="#/files?tab=agents"${tab === 'agents' ? ' aria-current="page"' : ''}>Agent Configuration</a></div>
    ${tab === 'charts' ? `<section class="card"><div class="card-head"><h2>Chart Studio</h2></div><div class="card-body"><div class="form-grid"><div class="field"><label for="chart-table">Target table</label><select id="chart-table" class="select"><option>Roselite_After_Sales.xlsx</option><option>Review_Master.xlsx</option><option>PQA_Tracker.xlsx</option></select></div><div class="field"><label for="chart-sheet">Sheet</label><select id="chart-sheet" class="select"><option>(first readable sheet)</option><option>Open issues</option><option>Weekly totals</option></select></div></div><div class="row-actions"><a class="btn btn-primary btn-sm" href="#/files?run=1">Open chart page</a><button class="btn btn-ghost btn-sm" type="button" data-action="open-folder">Open chart folder</button></div>${run ? `<div class="chart-box" id="files-chart"></div>` : ''}</div></section>` : `<section class="card"><div class="card-head"><h2>Agent Configuration</h2><span class="badge badge-muted">${state.team.length} files</span></div><div class="card-body"><div class="table-wrap"><table class="table table-stack"><thead><tr><th>Agent</th><th>Role</th><th>Model</th><th>Focus</th></tr></thead><tbody>${state.team.map((agent) => `<tr><td data-label="Agent">${esc(agent.name)}</td><td data-label="Role">${esc(agent.role)}</td><td data-label="Model">${esc(agent.model)}</td><td data-label="Focus">${esc(agent.focus)}</td></tr>`).join('')}</tbody></table></div></div></section>`}`;
}

function settingsTabs(route) {
  const tabs = [{ id: 'settings', path: '/settings', label: 'Settings' }, ...SETTINGS_LINKS];
  return `<nav class="tabs" aria-label="Settings sections">${tabs.map((tab) => `<a class="tab" href="#${tab.path}"${tab.id === route.id ? ' aria-current="page"' : ''}>${tab.label}</a>`).join('')}</nav>`;
}

function storagePersistCard(state) {
  const storage = state.persistentStorage;
  return `<section class="card"><div class="card-head"><h2>Persistent storage</h2>${storageBadge(storage)}</div><div class="card-body"><dl class="details"><div><dt>Status</dt><dd>${esc(storage?.status ?? 'Unsupported')}</dd></div><div><dt>Checked</dt><dd>${storage?.checkedAt ? fmtStamp(storage.checkedAt) : '—'}</dd></div></dl><p class="field-help">Granted means this browser will keep the account's IndexedDB data when the device is low on space. Unsupported means this browser has no <code>navigator.storage.persist()</code> API.</p></div></section>`;
}

function settingsPage(route, state) {
  const s = state.settings;
  const storage = state.persistentStorage ?? { status: 'Unsupported' };
  const body = (() => {
    if (route.id === 'settings') {
      return `${storagePersistCard(state)}<section class="card"><div class="card-head"><h2>AI connection</h2><span class="badge badge-${s.ai.status === 'Connected' ? 'success' : 'muted'}">${esc(s.ai.status)}</span></div><div class="card-body"><form class="form-grid" data-form="settings-ai"><div class="field"><label for="ai-key">API key</label><input id="ai-key" name="key" type="password" value="${esc(s.ai.key)}" /></div><div class="field"><label for="ai-model">Model</label><input id="ai-model" name="model" type="text" value="${esc(s.ai.model)}" /></div><div class="field"><label for="ai-timeout">Timeout (seconds)</label><input id="ai-timeout" name="timeout" type="number" value="${esc(s.ai.timeout)}" /></div><div class="row-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-ghost" type="button" data-action="test-key">Test the key</button><button class="btn btn-ghost" type="button" data-action="fill-gaps">Fill the gaps now</button></div></form></div></section>
        <section class="card"><div class="card-head"><h2>Demo data</h2><span class="badge badge-accent">Test account</span></div><div class="card-body"><p>Reset the Test account to the original demo rows. Changes in this account will be replaced.</p><button class="btn btn-danger" type="button" data-action="reset-demo">Reset demo data</button></div></section>`;
    }
    if (route.id === 'settings-ai') {
      return `<section class="card"><div class="card-head"><h2>AI inputs & limits</h2></div><div class="card-body"><form class="form-grid" data-form="settings-limits">${[['summary', 'Summary'], ['progress', 'Progress'], ['comment', 'Comment'], ['issue', 'Issue classification'], ['benchmark', 'Issue Benchmark']].map(([key, label]) => `<div class="field"><label for="limit-${key}">${label}</label><input id="limit-${key}" name="${key}" type="number" value="${esc(s.aiLimits[key])}" /></div>`).join('')}<button class="btn btn-primary" type="submit">Save changes</button></form></div></section>`;
    }
    if (route.id === 'settings-language') {
      return `<section class="card"><div class="card-head"><h2>Language rules</h2></div><div class="card-body"><form class="form-grid" data-form="settings-language"><div class="field"><label for="lang-primary">Primary language</label><select id="lang-primary" class="select" name="primary">${option('en', s.language.primary, 'English')}${option('zh', s.language.primary, 'Chinese')}</select></div><div class="field"><label for="lang-secondary">Secondary language</label><select id="lang-secondary" class="select" name="secondary">${option('en', s.language.secondary, 'English')}${option('zh', s.language.secondary, 'Chinese')}</select></div><div class="field field-wide"><label for="lang-rule">Natural-language rule</label><textarea id="lang-rule" name="rule" rows="5">${esc(s.language.rule)}</textarea></div><p class="field-help">Applies to the next AI call only.</p><button class="btn btn-primary" type="submit">Save changes</button></form></div></section>`;
    }
    if (route.id === 'settings-snapshots') {
      const snapshots = state.pages.filter((page) => page.type === 'Snapshot');
      return `<section class="card"><div class="card-head"><h2>Snapshots</h2><span class="badge badge-muted">${snapshots.length}</span></div><div class="card-body"><div class="table-wrap"><table class="table table-stack"><thead><tr><th>Date</th><th>Kind</th><th>Excerpt</th><th>Actions</th></tr></thead><tbody>${snapshots.map((page) => `<tr><td data-label="Date">${fmtStamp(page.updatedAt)}</td><td data-label="Kind">${esc(page.type)}</td><td data-label="Excerpt"><a class="table-title" href="#/page/${page.id}">${esc(page.title)}</a></td><td data-label="Actions"><button class="btn btn-ghost btn-sm" type="button" data-action="delete-page" data-id="${page.id}">Delete</button></td></tr>`).join('') || `<tr><td colspan="4">${empty('No snapshots yet.')}</td></tr>`}</tbody></table></div></div></section>`;
    }
    if (route.id === 'settings-dispatch') {
      return `<section class="card"><div class="card-head"><h2>Dispatch rules</h2></div><div class="card-body"><form data-form="settings-dispatch"><div class="field"><label for="dispatch-owner">Default owner</label><select id="dispatch-owner" class="select" name="defaultOwner">${state.team.map((agent) => option(agent.name, s.dispatch.defaultOwner, agent.name)).join('')}</select></div><div class="strip-list">${(s.dispatch.rules ?? []).map((rule, index) => `<div class="field-row"><div class="field"><label for="rule-key-${index}">Keyword</label><input id="rule-key-${index}" name="rule-key-${index}" type="text" value="${esc(rule.keyword)}" /></div><div class="field"><label for="rule-owner-${index}">Give it to</label><select id="rule-owner-${index}" class="select" name="rule-owner-${index}">${state.team.map((agent) => option(agent.name, rule.owner, agent.name)).join('')}</select></div></div>`).join('')}</div><p class="field-help">First matching rule wins; blank conditions are ignored.</p><button class="btn btn-primary" type="submit">Save changes</button></form></div></section>`;
    }
    if (route.id === 'settings-areas') {
      return `<section class="card"><div class="card-head"><h2>Responsibility areas</h2></div><div class="card-body"><form data-form="settings-areas"><div class="field"><label for="areas-list">Area names</label><input id="areas-list" name="options" type="text" value="${esc((s.areas.options ?? []).join(', '))}" /><p class="field-help">Separate names with commas.</p></div><div class="field"><label for="areas-fallback">Unknown owner</label><input id="areas-fallback" name="fallback" type="text" value="${esc(s.areas.fallback)}" /></div><button class="btn btn-primary" type="submit">Save changes</button></form></div></section>`;
    }
    if (route.id === 'settings-appearance') {
      return `<section class="card"><div class="card-head"><h2>Appearance & theme</h2></div><div class="card-body"><form class="form-grid" data-form="settings-appearance"><div class="field"><label for="theme-primary">Primary colour</label><input id="theme-primary" name="primary" type="color" value="${esc(s.appearance.primary)}" /></div><div class="field"><label for="theme-radius-btn">Button radius</label><input id="theme-radius-btn" name="radiusBtn" type="range" min="0" max="20" value="${esc(s.appearance.radiusBtn)}" /></div><div class="field"><label for="theme-radius-card">Card radius</label><input id="theme-radius-card" name="radiusCard" type="range" min="0" max="28" value="${esc(s.appearance.radiusCard)}" /></div><div class="field"><label for="theme-glass">Glass opacity</label><input id="theme-glass" name="glass" type="range" min="0.1" max="1" step="0.05" value="${esc(s.appearance.glass)}" /></div><label class="checkbox-row"><input name="enableGlass" type="checkbox"${s.appearance.enableGlass ? ' checked' : ''} /> Enable glass</label><div class="row-actions"><button class="btn btn-primary" type="submit">Save theme</button><button class="btn btn-ghost" type="button" data-action="reset-theme">Restore default look</button></div></form></div></section>`;
    }
    return '';
  })();
  return `${pageHead(route.title, 'Settings are stored on this device with the account.', `${storageBadge(storage)}<span class="badge badge-muted">${esc(state.account.name)}</span>`)}${settingsTabs(route)}${body}`;
}

function taskDetail(state, route) {
  const allTasks = state.tasks ?? [];
  const team = state.team ?? [];
  const task = allTasks.find((row) => row.id === route.params.id);
  const attachments = task?.attachments ?? [];
  if (!task) return notFound(`/task/${route.params.id}`);
  const project = projectOf(state, task.projectId);
  const comments = (state.taskComments ?? state.task_comments ?? []).filter((row) => row.taskId === task.id).map((row) => ({ ...row, kind: 'comment' }));
  const history = (state.taskHistory ?? state.task_history ?? []).filter((row) => row.taskId === task.id).map((row) => ({ ...row, kind: 'history' }));
  const feed = [...comments, ...history].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const subtasks = allTasks.filter((row) => row.parentId === task.id);
  const scheduled = (state.events ?? []).filter((row) => row.taskId === task.id);
  const dependencies = dependencyRows(state, task);
  const mentioning = pagesMentioningTask(state, task);
  const ownerOptions = [...new Set([...team.map((agent) => agent.name), task.owner, 'Amara', 'Steward', 'Dispatcher', 'QA', 'Worker A', 'Worker B', 'Worker C'].filter(Boolean))];
  const typeOptions = [...new Set([task.type, 'Task', 'Story', 'Epic', 'Sub-task', 'Bug', 'Improvement', 'Milestone', 'After Sales Top Items', 'HVT/EVT/DVT/PVT Build Report Issue'].filter(Boolean))];
  const priorityOptions = [...new Set([task.priority, ...PRIORITY_ORDER].filter(Boolean))];
  const severityOptions = [...new Set([task.severity, 'S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'].filter(Boolean))];
  const moduleOptions = [...new Set(allTasks.map((row) => row.module).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const componentOptions = [...new Set(allTasks.map((row) => row.component).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const planEnd = dateOnly(task.end) || dateOnly(task.due);
  const planDependencies = dependencyRefs(task).join(', ');
  const planMilestone = milestoneDate(task);
  const currentWorkflow = workflowForStoredStatus(task.status, task.workflow);
  const workflowTargets = taskWorkflowTargets(task);
  const actingOptions = [...new Set(['Amara', 'Steward', 'Dispatcher', 'QA', task.owner, ...team.map((agent) => agent.name)].filter(Boolean))];
  const defaultActor = isQaOwner(state, task) ? task.owner : 'Amara';
  const reviewStale = Boolean(task.reviewStale || (taskReviewFingerprint(task) && taskReviewFingerprint(task) !== attachmentsFingerprint(attachments)));
  const reviewDecision = task.reviewDecision || task.review?.decision || (task.reviewed ? 'approve' : '');
  const reviewLabel = reviewStale
    ? `Approval is stale — the deliverables changed. ${reviewDecision === 'changes' ? 'Changes were last requested.' : 'Approve this version again.'}`
    : reviewDecision === 'approve' ? 'You approved this version of the work.'
      : reviewDecision === 'changes' ? 'You requested changes on this version.'
        : 'Approve the deliverable or ask for changes.';
  const reasonHint = TASK_REASON_REQUIRED_STATUSES.join(', ');
  const waiverHint = TASK_WAIVER_STATUSES.join(', ');
  const allWorkflowHint = TASK_WORKFLOW_STATUSES.length;
  return `
    <nav class="breadcrumb"><a href="#/tasks">← All work items</a>${project ? `<span>/</span><a href="#/project/${project.key}">${esc(project.name)}</a>` : ''}</nav>
    ${pageHead('Work item', `${task.key} · ${project?.name ?? 'No project'} · updated ${fmtStamp(task.updatedAt)}`, `<span class="badge badge-accent">${esc(task.type)}</span>`)}
    <section class="detail-title card"><div class="card-body"><div class="detail-title-row"><span class="key-link">${esc(task.key)}</span><h2>${esc(task.title)}</h2></div><div class="detail-badges">${statusBadge(currentWorkflow)}${priority(task.priority)}<span class="badge badge-muted">${esc(task.severity)}</span><span class="assignee">${avatar(task.owner)}${esc(task.owner)}</span>${canSendToQa(state, task) ? `<button class="btn btn-primary btn-sm" type="button" data-action="task-toqa" data-id="${task.id}">Send to QA</button>` : ''}</div><form class="stack" data-form="task-title" data-history="title"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-title-${task.id}">Title</label><input id="task-title-${task.id}" name="title" type="text" value="${esc(task.title)}" required /></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Save title</button></div></form></div></section>
    <div class="detail-grid">
      <div class="detail-main">
        <section class="card"><div class="card-head"><h2>Where this stands</h2></div><div class="card-body"><dl class="details"><div><dt>Next action</dt><dd>${esc(task.status === 'Waiting' ? 'Wait for the QA check.' : task.status === 'Done' ? 'No further action.' : 'Continue the current step.')}</dd></div><div><dt>QA state</dt><dd>${task.notes?.includes('[已核') ? 'Checked' : task.notes?.includes('[待核') ? 'Waiting for QA' : 'Not sent yet'}</dd></div><div><dt>Review</dt><dd>${esc(reviewLabel)}</dd></div><div><dt>Note</dt><dd>${esc(task.notes || '—')}</dd></div></dl></div></section>
        <section class="card"><div class="card-head"><h2>Progress update</h2></div><div class="card-body"><form data-form="task-comment"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-progress-comment">Add a comment or progress update</label><textarea id="task-progress-comment" name="body" rows="3" placeholder="What changed?" required></textarea><p class="field-help">Ctrl+Enter saves the progress update.</p></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Save progress</button><label class="checkbox-row"><input name="real" type="checkbox" value="1" /> This is a real progress update</label></div></form></div></section>
        <section class="card"><div class="card-head"><h2>Details</h2><span class="badge badge-muted">Saved to this device</span></div><div class="card-body"><form class="stack" data-form="task-details" data-history="description,repro,expected,actual"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-description-${task.id}">Description</label><textarea id="task-description-${task.id}" name="description" rows="3">${esc(task.description)}</textarea></div><div class="field"><label for="task-repro-${task.id}">Steps / repro</label><textarea id="task-repro-${task.id}" name="repro" rows="3">${esc(task.repro ?? task.steps ?? '')}</textarea></div><div class="field"><label for="task-expected-${task.id}">Expected</label><textarea id="task-expected-${task.id}" name="expected" rows="2">${esc(task.expected)}</textarea></div><div class="field"><label for="task-actual-${task.id}">Actual</label><textarea id="task-actual-${task.id}" name="actual" rows="2">${esc(task.actual)}</textarea></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Save details</button></div></form></div></section>
        <section class="card"><div class="card-head"><h2>Attachments / deliverables</h2></div><div class="card-body">${attachments.length ? `<div class="row-list">${attachments.map((file) => `<div class="row-item"><span class="badge badge-muted">FILE</span><span class="row-main"><span class="row-title">${esc(file.name)}</span><span class="row-meta">${esc(file.kind)}</span></span><button class="btn btn-ghost btn-sm" type="button" data-action="fake-download">Open</button></div>`).join('')}</div>` : empty('No attachments yet.')}</div></section>
        <section class="card"><div class="card-head"><h2>Subtasks</h2><div class="row-actions"><span class="badge badge-muted">${subtasks.length}</span><button class="btn btn-ghost btn-sm" type="button" data-action="new-subtask" data-id="${task.id}" data-parent-id="${task.id}">New subtask</button></div></div><div class="card-body">${subtasks.length ? `<div class="row-list">${subtasks.map((row) => `<div class="row-item" data-subtask-id="${esc(row.id)}"><span class="key-link">↳ ${esc(row.key)}</span><span class="row-main"><span class="row-title"><a href="#/task/${row.id}">${esc(row.title)}</a></span></span>${statusBadge(row.workflow)}</div>`).join('')}</div>` : empty('No subtasks.')}</div></section>
        <section class="card"><div class="card-head"><h2>Depends on</h2><div class="row-actions"><span class="badge badge-muted">${dependencies.length}</span><button class="btn btn-ghost btn-sm" type="button" data-action="focus-dependencies" data-id="${task.id}">Edit in Plan</button></div></div><div class="card-body">${dependencies.length ? `<div class="row-list">${dependencies.map(({ ref, dependency, missing }) => missing ? `<div class="row-item" data-dependency-ref="${esc(ref)}"><span class="key-link">${esc(ref)}</span><span class="row-main"><span class="row-title">Dependency not found</span><span class="row-meta">Use a task key or ID in the Plan card.</span></span><span class="badge badge-warning">Missing</span></div>` : `<div class="row-item" data-dependency-ref="${esc(ref)}"><span class="key-link">${esc(dependency.key)}</span><span class="row-main"><span class="row-title"><a href="#/task/${dependency.id}">${esc(dependency.title)}</a></span><span class="row-meta">${esc(dependency.key)} · ${esc(dependency.status)}</span></span>${statusBadge(dependency.workflow ?? dependency.status)}</div>`).join('')}</div>` : empty('No dependencies.')}<p class="field-help">Edit this list in the Plan card using task keys or IDs, separated by commas.</p></div></section>
        <section class="card"><div class="card-head"><h2>Scheduled</h2><div class="row-actions"><span class="badge badge-muted">${scheduled.length}</span><button class="btn btn-ghost btn-sm" type="button" data-action="schedule-task" data-id="${task.id}" data-task-id="${task.id}">Schedule time for this</button></div></div><div class="card-body">${scheduled.length ? `<div class="row-list">${scheduled.map((event) => `<div class="row-item" data-event-id="${esc(event.id)}"><span class="row-date">${fmt(event.date)}</span><span class="row-main"><span class="row-title">${esc(event.title)}</span><span class="row-meta">${esc(event.kind)} ${esc(event.time)}</span></span></div>`).join('')}</div>` : empty('No scheduled time.')}</div></section>
        <section class="card"><div class="card-head"><h2>Comments and history</h2></div><div class="card-body"><div class="feed">${feed.map((row) => `<div class="feed-item"><div class="feed-head">${avatar(row.who ?? row.author ?? 'Amara')}<strong>${esc(row.who ?? row.author ?? 'Amara')}</strong><span>${fmtStamp(row.at)}</span>${row.kind === 'history' ? `<span class="badge badge-muted">${esc(row.field)}</span>` : ''}</div><p>${row.kind === 'comment' ? esc(row.body) : `${esc(row.field)}: ${esc(row.old || '—')} → ${esc(row.new || '—')}`}</p></div>`).join('') || empty('No activity yet.')}</div><form class="comment-form" data-form="task-comment"><input type="hidden" name="id" value="${task.id}" /><textarea id="tskComment" name="body" rows="2" placeholder="Add a comment… (Ctrl+Enter posts)" required></textarea><button class="btn btn-primary btn-sm" type="submit">Comment</button></form></div></section>
        <section class="card"><div class="card-head"><h2>Pages mentioning this task</h2><span class="badge badge-muted">${mentioning.length}</span></div><div class="card-body">${mentioning.length ? `<div class="row-list">${mentioning.map((page) => `<a class="row-item" data-page-id="${esc(page.id)}" href="#/page/${page.id}"><span class="row-main"><span class="row-title">${esc(page.title)}</span><span class="row-meta">${esc(page.type)}</span></span>${icon('arrow', 16)}</a>`).join('')}</div>` : empty('No pages mention this task yet.')}</div></section>
      </div>
      <aside class="detail-side">
        <section class="card"><div class="card-head"><h2>Workflow</h2><span class="badge badge-muted">${allWorkflowHint} statuses</span></div><div class="card-body"><form class="stack" data-form="task-workflow"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-move">Move to</label><select id="task-move" class="select" name="to" required><option value="" selected disabled>Choose a legal target…</option>${workflowTargets.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select><p class="field-help">From ${esc(currentWorkflow)}. Only legal targets are listed; QA-only and waiver rules apply.</p></div><div class="field"><label for="task-as">As</label><select id="task-as" class="select" name="as">${actingOptions.map((value) => option(value, defaultActor)).join('')}</select></div><div class="field"><label for="task-reason">Reason</label><input id="task-reason" name="reason" type="text" placeholder="Required for ${esc(reasonHint)}" /><p class="field-help">Waiver statuses (${esc(waiverHint)}) need Amara, QA or Steward.</p></div><button class="btn btn-primary btn-sm" type="submit">Apply move</button></form></div></section>
        <section class="card"><div class="card-head"><h2>Plan</h2><span class="badge badge-muted">Task record</span></div><div class="card-body"><form class="stack" data-form="task-plan" data-history="projectId,module,start,end,depends_on,milestone"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-plan-project-${task.id}">Project</label><select id="task-plan-project-${task.id}" class="select" name="projectId"><option value="">No project</option>${(state.projects ?? []).map((row) => option(row.id, task.projectId ?? '', `${row.key} ${row.name}`)).join('')}</select></div><div class="field"><label for="task-plan-module-${task.id}">Module</label><input id="task-plan-module-${task.id}" name="module" type="text" value="${esc(task.module)}" list="task-module-options-${task.id}" /><datalist id="task-module-options-${task.id}">${moduleOptions.map((value) => `<option value="${esc(value)}"></option>`).join('')}</datalist></div><div class="field"><label for="task-plan-start-${task.id}">Start</label><input id="task-plan-start-${task.id}" name="start" type="date" value="${esc(dateOnly(task.start))}" /></div><div class="field"><label for="task-plan-end-${task.id}">End</label><input id="task-plan-end-${task.id}" name="end" type="date" value="${esc(planEnd)}" /></div><div class="field"><label for="task-plan-depends-${task.id}">Depends on</label><input id="task-plan-depends-${task.id}" name="depends_on" type="text" value="${esc(planDependencies)}" placeholder="T-1, T-2" /><p class="field-help">Comma-separated task keys or IDs.</p></div><div class="field"><label for="task-plan-milestone-${task.id}">Milestone</label><input id="task-plan-milestone-${task.id}" name="milestone" type="date" value="${esc(planMilestone)}" /></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Save plan</button></div></form></div></section>
        <section class="card"><div class="card-head"><h2>Your review</h2>${reviewStale ? '<span class="badge badge-warning">Stale</span>' : reviewDecision === 'approve' ? '<span class="badge badge-success">Approved</span>' : reviewDecision === 'changes' ? '<span class="badge badge-warning">Changes requested</span>' : ''}</div><div class="card-body"><p class="text-sm text-muted">${esc(reviewLabel)}</p><div class="field"><label for="task-review-comment">Review comment (optional)</label><textarea id="task-review-comment" rows="2" placeholder="What did you check?">${esc(task.reviewComment ?? task.review?.comment ?? '')}</textarea></div><div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-action="task-review" data-id="${task.id}" data-decision="approve">Approve</button><button class="btn btn-ghost btn-sm" type="button" data-action="task-review" data-id="${task.id}" data-decision="changes">Request changes</button></div></div></section>
        <section class="card"><div class="card-head"><h2>Recommended model</h2></div><div class="card-body"><p><strong>${esc(team.find((agent) => agent.name === task.owner)?.model ?? 'deepseek-v4-flash')}</strong></p><p class="text-xs text-muted">Based on the current owner's agent definition.</p></div></section>
        <section class="card"><div class="card-head"><h2>Details</h2></div><div class="card-body"><form class="stack" data-form="task-fields" data-history="owner,priority,severity,type,component,module,due,start"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-owner-${task.id}">Assignee</label><select id="task-owner-${task.id}" class="select" name="owner">${ownerOptions.map((value) => option(value, task.owner)).join('')}</select></div><div class="field"><label for="task-priority-${task.id}">Priority</label><select id="task-priority-${task.id}" class="select" name="priority">${priorityOptions.map((value) => option(value, task.priority)).join('')}</select></div><div class="field"><label for="task-severity-${task.id}">Severity</label><select id="task-severity-${task.id}" class="select" name="severity">${severityOptions.map((value) => option(value, task.severity)).join('')}</select></div><div class="field"><label for="task-type-${task.id}">Type</label><select id="task-type-${task.id}" class="select" name="type">${typeOptions.map((value) => option(value, task.type)).join('')}</select></div><div class="field"><label for="task-component-${task.id}">Component</label><input id="task-component-${task.id}" name="component" type="text" value="${esc(task.component)}" list="task-component-options-${task.id}" /><datalist id="task-component-options-${task.id}">${componentOptions.map((value) => `<option value="${esc(value)}"></option>`).join('')}</datalist></div><div class="field"><label for="task-module-${task.id}">Module</label><input id="task-module-${task.id}" name="module" type="text" value="${esc(task.module)}" list="task-module-options-side-${task.id}" /><datalist id="task-module-options-side-${task.id}">${moduleOptions.map((value) => `<option value="${esc(value)}"></option>`).join('')}</datalist></div><div class="field"><label for="task-due-${task.id}">Due</label><input id="task-due-${task.id}" name="due" type="date" value="${esc(dateOnly(task.due))}" /></div><div class="field"><label for="task-start-${task.id}">Start</label><input id="task-start-${task.id}" name="start" type="date" value="${esc(dateOnly(task.start))}" /></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Save details</button></div></form><dl class="details compact"><div><dt>Reporter</dt><dd>Amara</dd></div><div><dt>Created</dt><dd>${fmtStamp(task.createdAt)}</dd></div><div><dt>ID</dt><dd>${esc(task.id)}</dd></div></dl></div></section>
      </aside>
    </div>`;
}

function bugDetail(state, route) {
  const bug = state.bugs.find((row) => row.id === route.params.id);
  if (!bug) return notFound(`/bug/${route.params.id}`);
  const comments = state.bugComments.filter((row) => row.bugId === bug.id).map((row) => ({ ...row, kind: 'comment', who: row.author }));
  const history = state.bugHistory.filter((row) => row.bugId === bug.id).map((row) => ({ ...row, kind: 'history' }));
  const feed = [...comments, ...history].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return `
    <nav class="breadcrumb"><a href="#/bugs">← Bugs</a></nav>
    ${pageHead('Bug', `${bug.key} · ${bug.component} · updated ${fmtStamp(bug.updatedAt)}`, `<span class="badge badge-muted">Bugs are never deleted</span>`)}
    <section class="detail-title card"><div class="card-body"><div class="detail-title-row"><span class="key-link">${esc(bug.key)}</span><h2>${esc(bug.title)}</h2></div><div class="detail-badges">${statusBadge(bug.status)}${priority(bug.priority)}<span class="badge badge-muted">${esc(bug.severity)}</span><span class="assignee">${avatar(bug.assignee)}${esc(bug.assignee)}</span></div></div></section>
    <div class="detail-grid">
      <div class="detail-main">
        <section class="card"><div class="card-head"><h2>Description</h2></div><div class="card-body"><dl class="details"><div><dt>Description</dt><dd>${esc(bug.description)}</dd></div><div><dt>Steps to reproduce</dt><dd>${esc(bug.repro)}</dd></div><div><dt>Expected</dt><dd>${esc(bug.expected)}</dd></div><div><dt>Actual</dt><dd>${esc(bug.actual)}</dd></div><div><dt>Environment</dt><dd>${esc(bug.environment)}</dd></div></dl></div></section>
        <section class="card"><div class="card-head"><h2>Comments and activity</h2></div><div class="card-body"><div class="feed">${feed.map((row) => `<div class="feed-item"><div class="feed-head">${avatar(row.who ?? 'Amara')}<strong>${esc(row.who ?? 'Amara')}</strong><span>${fmtStamp(row.at)}</span>${row.kind === 'history' ? `<span class="badge badge-muted">${esc(row.field)}</span>` : ''}</div><p>${row.kind === 'comment' ? esc(row.body) : `${esc(row.field)}: ${esc(row.old || '—')} → ${esc(row.new || '—')}`}</p></div>`).join('') || empty('No activity yet.')}</div><form class="comment-form" data-form="bug-comment"><input type="hidden" name="id" value="${bug.id}" /><textarea name="body" rows="2" placeholder="Add a comment…" required></textarea><button class="btn btn-primary btn-sm" type="submit">Comment</button></form></div></section>
      </div>
      <aside class="detail-side">
        <section class="card"><div class="card-head"><h2>Workflow</h2></div><div class="card-body"><form class="stack" data-form="bug-workflow"><input type="hidden" name="id" value="${bug.id}" /><div class="field"><label for="bug-move">Move to</label><select id="bug-move" class="select" name="to">${['New', 'Triaged', 'In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Duplicate', 'Wont fix', 'Deferred', 'Rejected'].map((value) => option(value, bug.status)).join('')}</select></div><div class="field"><label for="bug-reason">Reason</label><input id="bug-reason" name="reason" type="text" /></div><button class="btn btn-primary btn-sm" type="submit">Apply move</button></form></div></section>
        <section class="card"><div class="card-head"><h2>Details</h2></div><div class="card-body"><dl class="details compact"><div><dt>Assignee</dt><dd>${esc(bug.assignee)}</dd></div><div><dt>Priority</dt><dd>${esc(bug.priority)}</dd></div><div><dt>Severity</dt><dd>${esc(bug.severity)}</dd></div><div><dt>Component</dt><dd>${esc(bug.component)}</dd></div><div><dt>Reporter</dt><dd>${esc(bug.reporter)}</dd></div><div><dt>Due</dt><dd>${fmt(bug.due)}</dd></div><div><dt>Created</dt><dd>${fmtStamp(bug.createdAt)}</dd></div><div><dt>ID</dt><dd>${esc(bug.id)}</dd></div></dl></div></section>
      </aside>
    </div>`;
}

function projectPage(state, route, query) {
  const project = state.projects.find((row) => row.key === route.params.key || row.id === route.params.key);
  if (!project) return notFound(`/project/${route.params.key}`);
  const tab = ['overview', 'work', 'pages'].includes(query.get('tab')) ? query.get('tab') : 'overview';
  const tasks = state.tasks.filter((task) => task.projectId === project.id);
  const pages = state.pages.filter((page) => page.projectId === project.id);
  const open = tasks.filter((task) => task.status !== 'Done');
  const statuses = ['To do', 'In progress', 'Waiting', 'Done'];
  return `
    <nav class="breadcrumb"><a href="#/projects">← Projects</a></nav>
    ${pageHead(project.name, project.description, `<span class="badge badge-${project.archived ? 'muted' : 'accent'}">${esc(project.archived ? 'Archived' : project.status)}</span>`)}
    <div class="project-meta"><span class="badge badge-accent">${esc(project.key)}</span><span>Owner ${esc(project.owner)}</span><span>${fmt(project.start)} → ${fmt(project.due)}</span><span>${esc(project.keywords)}</span></div>
    <div class="tabs"><a class="tab" href="#/project/${project.key}"${tab === 'overview' ? ' aria-current="page"' : ''}>Overview</a><a class="tab" href="#/project/${project.key}?tab=work"${tab === 'work' ? ' aria-current="page"' : ''}>Work items</a><a class="tab" href="#/project/${project.key}?tab=modules"${tab === 'modules' ? ' aria-current="page"' : ''}>Modules</a><a class="tab" href="#/project/${project.key}?tab=pages"${tab === 'pages' ? ' aria-current="page"' : ''}>Pages</a></div>
    ${tab === 'work' ? workItemsBody(state, query, { path: `/project/${project.key}`, projectId: project.id, tab: 'work' }) : tab === 'pages' ? `<section class="card"><div class="card-head"><h2>Pages</h2><span class="badge badge-muted">${pages.length}</span></div><div class="card-body"><div class="row-list">${pages.map((page) => `<a class="row-item" href="#/page/${page.id}"><span class="row-main"><span class="row-title">${esc(page.title)}</span><span class="row-meta">${esc(page.type)} · ${fmtStamp(page.updatedAt)}</span></span>${icon('arrow', 16)}</a>`).join('') || empty('No pages.')}</div></div></section>` : `<div class="detail-grid"><div class="detail-main"><section class="card"><div class="card-head"><h2>Work by status</h2></div><div class="card-body"><div class="bar-list">${statuses.map((status) => `<div class="bar-row"><span>${status}</span><span class="bar-track"><span class="bar-fill" data-bar="${tasks.filter((task) => task.status === status).length}"></span></span><strong>${tasks.filter((task) => task.status === status).length}</strong></div>`).join('')}</div></div></section><section class="card"><div class="card-head"><h2>Coming up</h2></div><div class="card-body">${empty('No project schedule in the next 30 days.')}</div></section></div><aside class="detail-side"><section class="card"><div class="card-head"><h2>Snapshot</h2></div><div class="card-body"><dl class="details compact"><div><dt>Open items</dt><dd>${open.length}</dd></div><div><dt>All items</dt><dd>${tasks.length}</dd></div><div><dt>Pages</dt><dd>${pages.length}</dd></div><div><dt>Status</dt><dd>${esc(project.status)}</dd></div></dl></div></section><section class="card"><div class="card-head"><h2>Pages</h2></div><div class="card-body"><div class="row-list">${pages.slice(0, 4).map((page) => `<a class="row-item" href="#/page/${page.id}"><span class="row-main"><span class="row-title">${esc(page.title)}</span><span class="row-meta">${esc(page.type)}</span></span></a>`).join('') || empty('No pages.')}</div></div></section></aside></div>`}`;
}

function pageView(state, route) {
  const page = state.pages.find((row) => row.id === route.params.id);
  if (!page) return notFound(`/page/${route.params.id}`);
  const project = projectOf(state, page.projectId);
  const task = state.tasks.find((row) => row.id === page.taskId);
  return `
    <nav class="breadcrumb"><a href="#/pages">← Pages</a></nav>
    ${pageHead(page.title, `${page.type} · ${page.author} · ${fmtStamp(page.updatedAt)}${project ? ` · ${project.key} ${project.name}` : ''}${task ? ` · ${task.key}` : ''}`, `<div class="row-actions"><a class="btn btn-ghost btn-sm" href="#/page/${page.id}/edit">Edit</a><button class="btn btn-ghost btn-sm" type="button" data-action="print">Print</button></div>`)}
    <div class="page-workspace">
      <aside class="page-rail card"><div class="card-head"><h2>Pages</h2></div><div class="card-body"><div class="row-list">${state.pages.map((item) => `<a class="row-item${item.id === page.id ? ' is-active' : ''}" href="#/page/${item.id}"><span class="row-main"><span class="row-title">${esc(item.title)}</span><span class="row-meta">${esc(item.type)} · ${fmt(item.updatedAt)}</span></span></a>`).join('')}</div></div></aside>
      <article class="card"><div class="card-body"><div class="prose">${markdown(page.body)}</div></div></article>
    </div>`;
}

function pageEditor(state, route) {
  const isNew = route.id === 'page-new';
  const page = isNew ? null : state.pages.find((row) => row.id === route.params.id);
  if (!isNew && !page) return notFound(`/page/${route.params.id}/edit`);
  return `
    <nav class="breadcrumb"><a href="#/pages">← Pages</a></nav>
    ${pageHead(isNew ? 'New page' : 'Edit page', 'Stored in this account only. Blank titles are rejected.')}
    <div class="page-workspace">
      <aside class="page-rail card"><div class="card-head"><h2>Pages</h2></div><div class="card-body"><div class="row-list">${state.pages.map((item) => `<a class="row-item${item.id === page?.id ? ' is-active' : ''}" href="#/page/${item.id}"><span class="row-main"><span class="row-title">${esc(item.title)}</span><span class="row-meta">${esc(item.type)}</span></span></a>`).join('')}</div></div></aside>
      <section class="card"><div class="card-body"><form class="stack" data-form="page-save"><input type="hidden" name="id" value="${esc(page?.id ?? '')}" /><div class="field"><label for="page-title">Title</label><input id="page-title" name="title" type="text" value="${esc(page?.title ?? '')}" required /></div><div class="field"><label for="page-project">Project</label><select id="page-project" class="select" name="projectId"><option value="">No project</option>${state.projects.map((p) => option(p.id, page?.projectId ?? '', `${p.key} ${p.name}`)).join('')}</select></div><div class="field"><label for="page-body">Body</label><textarea id="page-body" name="body" rows="16" placeholder="Write markdown…">${esc(page?.body ?? '')}</textarea></div><div class="row-actions"><button class="btn btn-primary" type="submit">${isNew ? 'Create page' : 'Save page'}</button><a class="btn btn-ghost" href="${page ? `#/page/${page.id}` : '#/pages'}">Cancel</a></div></form></div></section>
    </div>`;
}

function bugNew(state) {
  return `${pageHead('Report a bug', 'A short report is enough. The key and SLA due date are added automatically.')}
    <section class="card"><div class="card-body"><form class="form-grid" data-form="bug-create"><div class="field field-wide"><label for="bug-title">Title</label><input id="bug-title" name="title" type="text" required /></div><div class="field"><label for="bug-severity">Severity</label><select id="bug-severity" class="select" name="severity">${['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'].map((value) => option(value, 'S3 Major')).join('')}</select></div><div class="field"><label for="bug-priority">Priority</label><select id="bug-priority" class="select" name="priority">${['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((value) => option(value, 'Medium')).join('')}</select></div><div class="field"><label for="bug-component">Component</label><select id="bug-component" class="select" name="component">${['work desk', 'tasks page', 'bugs page', 'calendar', 'settings', 'chart studio', 'other'].map((value) => option(value, 'other')).join('')}</select></div><div class="field"><label for="bug-assignee">Assignee</label><select id="bug-assignee" class="select" name="assignee">${state.team.map((agent) => option(agent.name, 'Dispatcher', agent.name)).join('')}</select></div><div class="field field-wide"><label for="bug-repro">Steps to reproduce</label><textarea id="bug-repro" name="repro" rows="3" required></textarea></div><div class="field field-wide"><label for="bug-description">Description</label><textarea id="bug-description" name="description" rows="3"></textarea></div><div class="field"><label for="bug-expected">Expected</label><input id="bug-expected" name="expected" type="text" /></div><div class="field"><label for="bug-actual">Actual</label><input id="bug-actual" name="actual" type="text" /></div><div class="field field-wide"><label for="bug-environment">Environment</label><input id="bug-environment" name="environment" type="text" /></div><button class="btn btn-primary" type="submit">Create bug</button></form></div></section>`;
}

function ratingPage(state) {
  return `
    ${pageHead('Rating trend', 'Full-page product rating trend.', `<button class="btn" type="button" data-action="toast-copy">Copy image</button>`)}
    <section class="card"><div class="card-head"><h2>Rating trend · live</h2><span class="badge badge-muted">14 days</span></div><div class="card-body"><div class="chart-box" id="rating-chart"></div><div class="chart-legend">${(state.ratings?.series ?? []).map((item, index) => `<span class="chart-legend-item"><span class="chart-dot chart-line-${index + 1}"></span>${esc(item.name)}</span>`).join('')}</div></div></section>
    <section class="card"><div class="card-head"><h2>Choose products</h2></div><div class="card-body"><div class="row-actions">${(state.ratings?.series ?? []).map((item) => `<span class="badge badge-muted">${esc(item.name)}</span>`).join('')}<button class="btn btn-ghost btn-sm" type="button" data-action="toast-copy">Everything</button><button class="btn btn-ghost btn-sm" type="button" data-action="toast-copy">Smooth curve</button></div></div></section>`;
}

function notFound(path) {
  return `${pageHead('Page not found', `There is no screen at ${path}.`)}<p><a class="btn btn-primary" href="#/">${icon('arrow', 16)}Back to Home</a></p>`;
}

function markdown(body) {
  const lines = esc(body || '').split('\n');
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('- ')) {
      if (!inList) out.push('<ul>');
      inList = true;
      out.push(`<li>${line.slice(2)}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (!line) continue;
    if (line.startsWith('## ')) out.push(`<h2>${line.slice(3)}</h2>`);
    else out.push(`<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

export function renderView(route, query, state) {
  switch (route.id) {
    case 'home': return home(state);
    case 'mywork': return mywork(state, query);
    case 'pages': return pagesPage(state, query);
    case 'projects': return projectsPage(state, query);
    case 'tasks': return tasksPage(state, query);
    case 'calendar': return calendarPage(state, query);
    case 'bugs': return bugsPage(state, query);
    case 'chat': return teamPage(state);
    case 'files': return filesPage(state, query);
    case 'settings':
    case 'settings-ai':
    case 'settings-language':
    case 'settings-snapshots':
    case 'settings-dispatch':
    case 'settings-areas':
    case 'settings-appearance': return settingsPage(route, state);
    case 'task-detail': return taskDetail(state, route);
    case 'bug-detail': return bugDetail(state, route);
    case 'project-detail': return projectPage(state, route, query);
    case 'page-view': return pageView(state, route);
    case 'page-edit':
    case 'page-new': return pageEditor(state, route);
    case 'bug-new': return bugNew(state);
    case 'rating-trend': return ratingPage(state);
    case 'go': return notFound(route.path);
    default: return notFound(route.path);
  }
}

export function mountView(route, query, state) {
  if (route.id === 'home') {
    const rating = document.getElementById('home-rating');
    if (rating && state.ratings) renderLineChart(rating, { labels: state.ratings.labels, series: state.ratings.series.slice(0, 4), title: 'Rating trend' });
    const team = document.getElementById('home-team-load');
    if (team) {
      const rows = teamLoadSeries(state);
      renderBarChart(team, {
        labels: rows.map((row) => row.label),
        values: rows.map((row) => row.value),
        title: 'Team load: open tasks plus open orders by owner',
      });
    }
    const pareto = document.getElementById('home-pareto');
    if (pareto) {
      const rows = paretoSeries(state);
      renderParetoChart(pareto, {
        labels: rows.map((row) => row.label),
        values: rows.map((row) => row.value),
        title: 'Issue Pareto: ordered categories with cumulative share',
      });
    }
  }
  if (route.id === 'rating-trend' && state.ratings) {
    const chart = document.getElementById('rating-chart');
    if (chart) renderLineChart(chart, { labels: state.ratings.labels, series: state.ratings.series, title: 'Rating trend' });
  }
  if (route.id === 'files' && query.get('run') === '1') {
    const chart = document.getElementById('files-chart');
    if (chart) renderBarChart(chart, { labels: ['To do', 'In progress', 'Waiting', 'Done'], values: [6, 4, 3, 5], title: 'Work items by status' });
  }
  if (route.id === 'project-detail') {
    document.querySelectorAll('[data-bar]').forEach((bar) => {
      const max = Math.max(...[...document.querySelectorAll('[data-bar]')].map((item) => Number(item.dataset.bar)), 1);
      bar.style.setProperty('--bar-width', `${(Number(bar.dataset.bar) / max) * 100}%`);
    });
  }
  if ((route.id === 'tasks' || (route.id === 'project-detail' && query.get('tab') === 'work')) && query.get('view') === 'timeline') {
    const timeline = document.querySelector('[data-timeline]');
    if (timeline) {
      const days = Math.max(1, Number(timeline.dataset.days) || 1);
      const clampedIndex = (value) => Math.max(0, Math.min(days - 1, Number(value) || 0));
      const percent = (value) => `${(Math.max(0, Math.min(days, value)) / days) * 100}%`;
      timeline.querySelectorAll('[data-timeline-bar]').forEach((bar) => {
        const startIndex = clampedIndex(bar.dataset.startIndex);
        const span = Math.max(1, Math.min(days - startIndex, Number(bar.dataset.span) || 1));
        bar.style.setProperty('--timeline-left', percent(startIndex));
        bar.style.setProperty('--timeline-width', percent(span));
      });
      timeline.querySelectorAll('[data-timeline-milestone]').forEach((mark) => {
        mark.style.setProperty('--timeline-left', percent(clampedIndex(mark.dataset.dateIndex)));
      });
      timeline.querySelectorAll('[data-timeline-today]').forEach((line) => {
        line.style.setProperty('--timeline-left', percent(clampedIndex(line.dataset.todayIndex)));
      });
    }
  }
  if (route.id === 'settings-appearance') {
    const input = document.getElementById('theme-primary');
    if (input && !state.settings.appearance.primary) {
      input.value = getComputedStyle(document.documentElement).getPropertyValue('--color-card-header').trim();
    }
  }
}

export function renderCreateDialog(state, preset = {}) {
  const options = typeof preset === 'string' ? { tab: preset } : (preset ?? {});
  const requestedTab = options.tab || (options.taskId ? 'event' : 'task');
  const activeTab = ['task', 'bug', 'event'].includes(requestedTab) ? requestedTab : 'task';
  const tasks = state.tasks ?? [];
  const parent = options.parentId ? tasks.find((row) => row.id === options.parentId || String(row.key ?? '').toUpperCase() === String(options.parentId).toUpperCase()) : null;
  const linked = options.taskId ? tasks.find((row) => row.id === options.taskId || String(row.key ?? '').toUpperCase() === String(options.taskId).toUpperCase()) : null;
  const parentId = parent?.id ?? options.parentId ?? '';
  const taskId = linked?.id ?? options.taskId ?? '';
  const taskType = options.type || (parentId ? 'Sub-task' : 'Task');
  const taskProject = options.projectId || parent?.projectId || '';
  const eventProject = options.projectId || linked?.projectId || '';
  const eventTitle = options.title || (linked ? `${linked.key} · ${linked.title}` : '');
  const eventDate = options.date || dateOnly(linked?.due) || today();
  const tabButton = (name, label) => `<button class="tab" type="button" role="tab" aria-selected="${activeTab === name}" data-create-tab="${name}">${label}</button>`;
  const panelHidden = (name) => (activeTab === name ? '' : ' hidden');
  return `<div class="create-dialog">
    <div class="tabs" role="tablist" data-create-tabs>
      ${tabButton('task', 'Task')}
      ${tabButton('bug', 'Bug')}
      ${tabButton('event', 'Event')}
    </div>
    <form class="form-grid create-panel" data-create-panel="task" data-form="create-task"${panelHidden('task')}>
      <div class="field field-wide"><label for="create-task-title">Title</label><input id="create-task-title" name="title" type="text" required /></div>
      ${parentId ? `<input type="hidden" name="parentId" value="${esc(parentId)}" /><div class="field field-wide" data-create-parent="${esc(parentId)}"><label>Parent work item</label><p class="field-help" id="create-task-parent-help">This will be created as a subtask of ${esc(parent?.key ?? parentId)}${parent ? ` · ${esc(parent.title)}` : ''}.</p></div>` : ''}
      <div class="field"><label for="create-task-type">Type</label><select id="create-task-type" class="select" name="type">${['Task', 'Story', 'Epic', 'Sub-task', 'Improvement', 'Bug'].map((value) => option(value, taskType)).join('')}</select></div>
      <div class="field"><label for="create-task-project">Project</label><select id="create-task-project" class="select" name="projectId"><option value="">(Dispatcher picks)</option>${state.projects.filter((p) => !p.archived).map((p) => option(p.id, taskProject, `${p.key} ${p.name}`)).join('')}</select></div>
      <div class="field"><label for="create-task-priority">Priority</label><select id="create-task-priority" class="select" name="priority">${['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((value) => option(value, 'Medium')).join('')}</select></div>
      <div class="field"><label for="create-task-start">Start</label><input id="create-task-start" name="start" type="date" /></div>
      <div class="field"><label for="create-task-due">Due</label><input id="create-task-due" name="due" type="date" /></div>
      <div class="field"><label for="create-task-expected">Expected</label><input id="create-task-expected" name="expected" type="text" /></div>
      <div class="field"><label for="create-task-actual">Actual</label><input id="create-task-actual" name="actual" type="text" /></div>
      <div class="field field-wide"><label for="create-task-description">Description</label><textarea id="create-task-description" name="description" rows="3"></textarea></div>
    </form>
    <form class="form-grid create-panel" data-create-panel="bug" data-form="create-bug"${panelHidden('bug')}>
      <div class="field field-wide"><label for="create-bug-title">Title</label><input id="create-bug-title" name="title" type="text" required /></div>
      <div class="field"><label for="create-bug-severity">Severity</label><select id="create-bug-severity" class="select" name="severity" required>${['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'].map((value) => option(value, 'S3 Major')).join('')}</select></div>
      <div class="field"><label for="create-bug-priority">Priority</label><select id="create-bug-priority" class="select" name="priority">${['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((value) => option(value, 'Medium')).join('')}</select></div>
      <div class="field"><label for="create-bug-component">Component</label><select id="create-bug-component" class="select" name="component">${['work desk', 'tasks page', 'bugs page', 'calendar', 'settings', 'chart studio', 'other'].map((value) => option(value, 'other')).join('')}</select></div>
      <div class="field field-wide"><label for="create-bug-repro">Steps to reproduce</label><textarea id="create-bug-repro" name="repro" rows="3" required></textarea></div>
      <div class="field field-wide"><label for="create-bug-description">Description</label><textarea id="create-bug-description" name="description" rows="3"></textarea></div>
    </form>
    <form class="form-grid create-panel" data-create-panel="event" data-form="create-event"${panelHidden('event')}>
      <div class="field field-wide"><label for="create-event-title">What</label><input id="create-event-title" name="title" type="text" required${eventTitle ? ` value="${esc(eventTitle)}"` : ''} /></div>
      ${taskId ? `<input type="hidden" name="taskId" value="${esc(taskId)}" /><div class="field field-wide" data-create-task="${esc(taskId)}"><label>Linked work item</label><p class="field-help" id="create-event-task-help">This event will be linked to ${esc(linked?.key ?? taskId)}${linked ? ` · ${esc(linked.title)}` : ''}.</p></div>` : ''}
      <div class="field"><label for="create-event-date">Date</label><input id="create-event-date" name="date" type="date" value="${esc(eventDate)}" required /></div>
      <div class="field"><label for="create-event-time">Start time</label><input id="create-event-time" name="time" type="time" /></div>
      <div class="field"><label for="create-event-kind">Kind</label><select id="create-event-kind" class="select" name="kind">${['Meeting', 'Reminder', 'Task', 'Deadline', 'Other'].map((value) => option(value, 'Reminder')).join('')}</select></div>
      <div class="field"><label for="create-event-link">Meeting link</label><input id="create-event-link" name="link" type="url" /></div>
      <div class="field"><label for="create-event-repeat">Repeat</label><select id="create-event-repeat" class="select" name="repeat">${[['', 'Does not repeat'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([value, label]) => option(value, '', label)).join('')}</select></div>
      <div class="field"><label for="create-event-until">Repeat until</label><input id="create-event-until" name="until" type="date" /><p class="field-help">Optional. The last day this event repeats.</p></div>
      <div class="field"><label for="create-event-remind">Remind</label><select id="create-event-remind" class="select" name="remind">${[['0', 'At start time'], ['5', '5 minutes before'], ['15', '15 minutes before'], ['30', '30 minutes before'], ['60', '1 hour before'], ['1440', '1 day before']].map(([value, label]) => option(value, '5', label)).join('')}</select></div>
      <div class="field"><label for="create-event-project">Project</label><select id="create-event-project" class="select" name="projectId"><option value="">No project</option>${state.projects.filter((p) => !p.archived).map((p) => option(p.id, eventProject, `${p.key} ${p.name}`)).join('')}</select></div>
      <div class="field field-wide"><label for="create-event-note">Note</label><textarea id="create-event-note" name="note" rows="2"></textarea></div>
    </form>
  </div>`;
}
