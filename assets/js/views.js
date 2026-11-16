import { SETTINGS_LINKS } from './routes.js';
import { icon } from './icons.js';
import { renderBarChart, renderLineChart, renderParetoChart } from './chart.js';

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
const projectOf = (state, id) => state.projects.find((project) => project.id === id);
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
  const marks = new Set();
  for (const event of state.events) {
    const d = new Date(`${event.date}T12:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) marks.add(d.getDate());
  }
  for (const task of state.tasks) {
    if (!task.due || task.status === 'Done') continue;
    const d = new Date(`${task.due}T12:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) marks.add(d.getDate());
  }
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push('<span class="calendar-day is-outside"></span>');
  for (let day = 1; day <= days; day += 1) {
    const current = day === now.getDate();
    cells.push(`<span class="calendar-day${current ? ' is-today' : ''}"><span class="calendar-date">${day}</span>${marks.has(day) ? '<span class="calendar-mark" aria-hidden="true"></span>' : ''}</span>`);
  }
  return `
    <div class="calendar-head"><h2>${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><a class="btn btn-ghost btn-sm" href="#/calendar">Open calendar</a></div>
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
  for (const event of state.events) rows.push({ date: event.date, time: event.time, kind: event.kind, title: event.title, href: event.taskId ? `#/task/${event.taskId}` : '', tone: 'event', link: event.link, id: event.id });
  rows.sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
  const overdue = rows.filter((row) => row.date < todayIso).slice(0, 2);
  const upcoming = rows.filter((row) => row.date >= todayIso).slice(0, 6);
  return [...overdue, ...upcoming].slice(0, 8).map((row) => {
    const day = row.date === todayIso ? 'Today' : row.date < todayIso ? `Overdue · ${fmt(row.date)}` : fmt(row.date);
    return `<div class="row-item">
      <span class="row-date">${esc(day)}</span>
      <span class="row-main"><span class="row-title">${row.href ? `<a href="${row.href}">${esc(row.title)}</a>` : esc(row.title)}</span><span class="row-meta">${esc(row.kind)}${row.time ? ` · ${esc(row.time)}` : ''}</span></span>
      <span class="badge badge-muted">${esc(row.kind)}</span>
    </div>`;
  });
}

function teamLoad(state) {
  const active = state.tasks.filter((task) => task.status !== 'Done');
  return state.team.map((agent) => {
    const count = active.filter((task) => task.owner === agent.name).length;
    const orders = state.orders.filter((order) => order.owner === agent.name && order.open).length;
    return `<div class="row-item">
      ${avatar(agent.name)}
      <span class="row-main"><span class="row-title">${esc(agent.name)}</span><span class="row-meta">${esc(agent.role)}</span></span>
      <span class="row-count">${count}<small>${orders ? ` +${orders} order` : ' rows'}</small></span>
      <a class="btn btn-ghost btn-sm" href="#/chat">Go</a>
    </div>`;
  }).join('');
}

function home(state) {
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, Amara`;
  return `
    ${pageHead(greeting, new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}
    <div class="home-layout">
      <div class="home-column">
        <section class="card"><div class="card-body">${miniCalendar(state)}</div></section>
        <section class="card">
          <div class="card-head"><h2>Today and coming up · next 6</h2><a class="card-link-small" href="#/calendar">Open calendar</a></div>
          <div class="card-body">${userRows(agendaRows(state), 'Nothing due.')}</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Who has work · live</h2><a class="card-link-small" href="#/chat">Open team</a></div>
          <div class="card-body"><div class="row-list">${teamLoad(state)}</div></div>
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
          <div class="card-head"><h2>Roselite Pareto · saved default</h2><a class="card-link-small" href="#/project/MR">Open analysis</a></div>
          <div class="card-body"><div class="chart-box" id="home-pareto"></div></div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Recent AI calls</h2><a class="card-link-small" href="#/settings/ai">AI settings</a></div>
          <div class="card-body"><div class="row-list">${state.aiCalls.slice(0, 3).map((call) => `<div class="row-item"><span class="row-main"><span class="row-title">${esc(call.detail)}</span><span class="row-meta">${esc(call.model)} · ${call.chars} chars</span></span><span class="badge badge-${call.ok ? 'success' : 'danger'}">${call.ok ? 'OK' : 'Error'}</span></div>`).join('')}</div></div>
        </section>
      </div>
    </div>`;
}

function mywork(state, query) {
  const all = query.get('all') === '1';
  const queues = [
    { title: 'Needs your decision', rows: state.tasks.filter((task) => task.pendingDecision), reason: 'Decision pending', next: 'Choose an owner or close it' },
    { title: 'Blocked', rows: state.tasks.filter((task) => task.status === 'Waiting' && task.owner !== 'Delphine Roth'), reason: 'Waiting for QA or supplier', next: 'Unblock the next step' },
    { title: 'Ready for review', rows: state.tasks.filter((task) => task.status === 'Done' && !task.reviewed), reason: 'Deliverable finished', next: 'Review the result' },
  ];
  return `
    ${pageHead('My work', 'Each list is computed from the stored rows; the counts are rows, not estimates.')}
    <div class="card-grid three-up">
      ${queues.map((queue) => {
        const shown = all ? queue.rows : queue.rows.slice(0, 8);
        return `<section class="card">
          <div class="card-head"><h2>${queue.title}</h2><span class="badge badge-accent">${queue.rows.length}</span></div>
          <div class="card-body">
            ${shown.length ? `<div class="row-list">${shown.map((task) => `<div class="row-item"><span class="row-main"><span class="row-title"><a href="#/task/${task.id}">${esc(task.title)}</a></span><span class="row-meta">${esc(queue.reason)} · ${esc(queue.next)}</span></span><span class="row-owner">${avatar(task.owner)}<span>${esc(task.owner)}</span></span><span class="row-date">${fmt(task.due)}</span></div>`).join('')}</div>` : empty('Nothing here.')}
            ${!all && queue.rows.length > 8 ? `<a class="btn btn-ghost btn-sm" href="${pageUrl('/mywork', { all: 1 })}">Show all ${queue.rows.length}</a>` : ''}
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

function filterTasks(state, query) {
  const scope = query.get('scope') === 'all' ? 'all' : 'open';
  const q = (query.get('q') ?? '').toLowerCase();
  const status = query.get('status') ?? '';
  const owner = query.get('owner') ?? '';
  const priorityFilter = query.get('priority') ?? '';
  const projectFilter = query.get('project') ?? '';
  const sort = query.get('sort') ?? 'smart';
  let rows = state.tasks.filter((task) => {
    const project = projectOf(state, task.projectId);
    const haystack = `${task.title} ${task.key} ${task.owner} ${task.description} ${task.module} ${project?.name ?? ''}`.toLowerCase();
    if (scope === 'open' && task.status === 'Done' && !status) return false;
    return (!q || haystack.includes(q))
      && (!status || task.workflow === status)
      && (!owner || task.owner === owner)
      && (!priorityFilter || task.priority === priorityFilter)
      && (!projectFilter || task.projectId === projectFilter);
  });
  rows = [...rows].sort((a, b) => {
    if (sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999');
    if (sort === 'priority') return ['Highest', 'High', 'Medium', 'Low', 'Lowest'].indexOf(a.priority) - ['Highest', 'High', 'Medium', 'Low', 'Lowest'].indexOf(b.priority);
    if (sort === 'key') return a.key.localeCompare(b.key, undefined, { numeric: true });
    return (a.status === 'Done') - (b.status === 'Done') || (a.due || '9999').localeCompare(b.due || '9999');
  });
  return { rows, scope, q, status, owner, priorityFilter, projectFilter, sort };
}

function taskTable(state, rows) {
  return `<div class="table-wrap"><table class="table table-stack">
    <thead><tr><th>Key</th><th>Summary</th><th>Project</th><th>Progress</th><th>Status</th><th>Assignee</th><th>Due</th><th>Priority</th><th>Severity</th><th>Component</th><th>Age</th><th>Actions</th></tr></thead>
    <tbody>${rows.map((task) => {
      const project = projectOf(state, task.projectId);
      return `<tr class="${task.parentId ? 'is-subtask' : ''}">
        <td data-label="Key"><a class="key-link" href="#/task/${task.id}">${task.parentId ? '↳ ' : ''}${esc(task.key)}</a></td>
        <td data-label="Summary"><a class="table-title" href="#/task/${task.id}">${esc(task.title)}</a></td>
        <td data-label="Project">${project ? `<span class="badge badge-accent">${esc(project.key)}</span>` : '—'}</td>
        <td data-label="Progress"><span class="progress-text">${esc(task.status)}</span></td>
        <td data-label="Status">${statusBadge(task.workflow)}</td>
        <td data-label="Assignee"><span class="assignee">${avatar(task.owner)}${esc(task.owner)}</span></td>
        <td data-label="Due">${task.start ? `${fmt(task.start)} → ` : ''}${fmt(task.due)}</td>
        <td data-label="Priority">${priority(task.priority)}</td>
        <td data-label="Severity">${esc(task.severity)}</td>
        <td data-label="Component">${esc(task.component)}</td>
        <td data-label="Age">${age(task.createdAt)}</td>
        <td data-label="Actions"><div class="row-actions">${task.status !== 'Done' && task.owner !== 'Delphine Roth' && task.status !== 'Waiting' ? `<button class="btn btn-ghost btn-sm" type="button" data-action="task-toqa" data-id="${task.id}">Send to QA</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-action="task-brief" data-id="${task.id}">Brief</button></div></td>
      </tr>`;
    }).join('') || `<tr><td colspan="12">${empty('No work items match these filters.')}</td></tr>`}</tbody>
  </table></div>`;
}

function taskBoard(state, rows) {
  const columns = ['To Do', 'In Progress', 'In Review', 'Done'];
  const bucket = (task) => task.status === 'To do' ? 'To Do' : task.status === 'Waiting' ? (task.owner === 'Delphine Roth' ? 'In Review' : 'In Progress') : task.status === 'Done' ? 'Done' : 'In Progress';
  return `<div class="board">${columns.map((column) => `<section class="board-column"><h2>${column}<span class="badge badge-muted">${rows.filter((task) => bucket(task) === column).length}</span></h2>${rows.filter((task) => bucket(task) === column).map((task) => `<article class="board-card"><a href="#/task/${task.id}">${esc(task.title)}</a><span class="row-meta">${esc(task.key)} · ${esc(task.owner)}</span><div class="board-card-foot">${statusBadge(task.workflow)}${priority(task.priority)}</div><label class="board-move">Move to<select class="select select-sm" data-move-task="${task.id}">${['To do', 'In progress', 'Waiting', 'Done'].map((status) => option(status, task.status)).join('')}</select></label></article>`).join('') || empty('No items.')}</section>`).join('')}</div>`;
}

function tasksPage(state, query) {
  const { rows, scope, q, status, owner, priorityFilter, projectFilter, sort } = filterTasks(state, query);
  const view = ['list', 'board', 'calendar', 'timeline'].includes(query.get('view')) ? query.get('view') : 'list';
  const openCount = state.tasks.filter((task) => task.status !== 'Done').length;
  const allCount = state.tasks.length;
  const overdue = state.tasks.filter((task) => task.due && task.due < today() && task.status !== 'Done').length;
  const base = { q, status, owner, priority: priorityFilter, project: projectFilter, sort, scope };
  return `
    ${pageHead('All work items', 'Everything you and your agents are working on, across projects.')}
    <div class="task-toolbar">
      <div class="tabs">${['list', 'board', 'calendar', 'timeline'].map((name) => `<a class="tab" href="${pageUrl('/tasks', { ...base, view: name })}"${view === name ? ' aria-current="page"' : ''}>${name[0].toUpperCase() + name.slice(1)}</a>`).join('')}</div>
      <div class="scope-switch">
        <a class="chip${scope === 'open' ? ' is-active' : ''}" href="${pageUrl('/tasks', { ...base, scope: 'open' })}">Open ${openCount}</a>
        <a class="chip${scope === 'all' ? ' is-active' : ''}" href="${pageUrl('/tasks', { ...base, scope: 'all' })}">All ${allCount}</a>
      </div>
      <span class="toolbar-count">${state.tasks.filter((task) => task.status === 'In progress').length} in progress · ${state.tasks.filter((task) => task.status === 'Waiting').length} in review · ${overdue} overdue</span>
    </div>
    <form class="toolbar" data-form="task-filters">
      <input type="hidden" name="view" value="${view}" /><input type="hidden" name="scope" value="${scope}" />
      <input class="input" type="search" name="q" value="${esc(q)}" placeholder="Search work items…" aria-label="Search work items" />
      <select class="select" name="status" aria-label="Status"><option value="">All statuses</option>${['New', 'Triaged', 'In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Deferred', 'Wont fix', 'Duplicate', 'Rejected'].map((value) => option(value, status)).join('')}</select>
      <select class="select" name="owner" aria-label="Assignee"><option value="">All assignees</option>${[...new Set(state.tasks.map((task) => task.owner))].map((value) => option(value, owner)).join('')}</select>
      <select class="select" name="priority" aria-label="Priority"><option value="">All priorities</option>${['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((value) => option(value, priorityFilter)).join('')}</select>
      <select class="select" name="project" aria-label="Project"><option value="">All projects</option>${state.projects.map((p) => option(p.id, projectFilter, `${p.key} ${p.name}`)).join('')}</select>
      <select class="select" name="sort" aria-label="Sort"><option value="smart"${sort === 'smart' ? ' selected' : ''}>Smart order</option>${['due', 'priority', 'key'].map((value) => option(value, sort)).join('')}</select>
      <button class="btn btn-sm btn-primary" type="submit">Apply</button>
      <a class="btn btn-ghost btn-sm" href="${pageUrl('/tasks', { view })}">Reset</a>
    </form>
    ${view === 'board' ? taskBoard(state, rows) : view === 'calendar' || view === 'timeline' ? `<section class="card"><div class="card-body">${empty(`${view === 'calendar' ? 'Calendar' : 'Timeline'} view is wired to the same rows. Use Board or List for the demo data.`)}</div></section>` : taskTable(state, rows)}`;
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
    if (event.date === date && (!projectFilter || event.projectId === projectFilter)) items.push({ title: event.title, href: event.taskId ? `#/task/${event.taskId}` : '', kind: event.kind, tone: 'event', link: event.link, id: event.id, time: event.time });
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
    cells.push(`<div class="calendar-day${isToday ? ' is-today' : ''}${items.length ? ' has-items' : ''}"><span class="calendar-date">${day}</span>${items.slice(0, 3).map((item) => item.href ? `<a class="calendar-item calendar-item-${item.tone}" href="${item.href}">${esc(item.title)}</a>` : `<span class="calendar-item calendar-item-${item.tone}">${esc(item.title)}</span>`).join('')}${items.length > 3 ? `<span class="calendar-more">+${items.length - 3}</span>` : ''}</div>`);
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
      <div class="card-body">${nextSeven.length ? `<div class="row-list">${nextSeven.map((item) => `<div class="row-item"><span class="row-date">${fmt(item.date)}</span><span class="row-main"><span class="row-title">${item.href ? `<a href="${item.href}">${esc(item.title)}</a>` : esc(item.title)}</span><span class="row-meta">${esc(item.kind)}${item.time ? ` · ${esc(item.time)}` : ''}</span></span><span class="badge badge-muted">${esc(item.kind)}</span>${item.link ? `<a class="btn btn-ghost btn-sm" href="${esc(item.link)}" target="_blank" rel="noreferrer">Join</a>` : ''}${item.id ? `<button class="btn btn-ghost btn-sm" type="button" data-action="delete-event" data-id="${item.id}">Delete</button>` : ''}</div>`).join('')}</div>` : empty('Nothing scheduled in the next seven days.')}</div>
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

function settingsPage(route, state) {
  const s = state.settings;
  const body = (() => {
    if (route.id === 'settings') {
      return `<section class="card"><div class="card-head"><h2>AI connection</h2><span class="badge badge-${s.ai.status === 'Connected' ? 'success' : 'muted'}">${esc(s.ai.status)}</span></div><div class="card-body"><form class="form-grid" data-form="settings-ai"><div class="field"><label for="ai-key">API key</label><input id="ai-key" name="key" type="password" value="${esc(s.ai.key)}" /></div><div class="field"><label for="ai-model">Model</label><input id="ai-model" name="model" type="text" value="${esc(s.ai.model)}" /></div><div class="field"><label for="ai-timeout">Timeout (seconds)</label><input id="ai-timeout" name="timeout" type="number" value="${esc(s.ai.timeout)}" /></div><div class="row-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-ghost" type="button" data-action="test-key">Test the key</button><button class="btn btn-ghost" type="button" data-action="fill-gaps">Fill the gaps now</button></div></form></div></section>
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
  return `${pageHead(route.title, 'Settings are stored on this device with the account.', `<span class="badge badge-muted">${esc(state.account.name)}</span>`)}${settingsTabs(route)}${body}`;
}

function taskDetail(state, route) {
  const task = state.tasks.find((row) => row.id === route.params.id);
  if (!task) return notFound(`/task/${route.params.id}`);
  const project = projectOf(state, task.projectId);
  const comments = state.taskComments.filter((row) => row.taskId === task.id).map((row) => ({ ...row, kind: 'comment' }));
  const history = state.taskHistory.filter((row) => row.taskId === task.id).map((row) => ({ ...row, kind: 'history' }));
  const feed = [...comments, ...history].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const subtasks = state.tasks.filter((row) => row.parentId === task.id);
  const scheduled = state.events.filter((row) => row.taskId === task.id);
  const mentioning = state.pages.filter((row) => row.taskId === task.id);
  return `
    <nav class="breadcrumb"><a href="#/tasks">← All work items</a>${project ? `<span>/</span><a href="#/project/${project.key}">${esc(project.name)}</a>` : ''}</nav>
    ${pageHead('Work item', `${task.key} · ${project?.name ?? 'No project'} · updated ${fmtStamp(task.updatedAt)}`, `<span class="badge badge-accent">${esc(task.type)}</span>`)}
    <section class="detail-title card"><div class="card-body"><div class="detail-title-row"><span class="key-link">${esc(task.key)}</span><h2>${esc(task.title)}</h2></div><div class="detail-badges">${statusBadge(task.workflow)}${priority(task.priority)}<span class="badge badge-muted">${esc(task.severity)}</span><span class="assignee">${avatar(task.owner)}${esc(task.owner)}</span>${task.status !== 'Done' && task.owner !== 'Delphine Roth' ? `<button class="btn btn-primary btn-sm" type="button" data-action="task-toqa" data-id="${task.id}">Send to QA</button>` : ''}</div></div></section>
    <div class="detail-grid">
      <div class="detail-main">
        <section class="card"><div class="card-head"><h2>Where this stands</h2></div><div class="card-body"><dl class="details"><div><dt>Next action</dt><dd>${esc(task.status === 'Waiting' ? 'Wait for the QA check.' : task.status === 'Done' ? 'No further action.' : 'Continue the current step.')}</dd></div><div><dt>QA state</dt><dd>${task.notes?.includes('[已核') ? 'Checked' : task.notes?.includes('[待核') ? 'Waiting for QA' : 'Not sent yet'}</dd></div><div><dt>Review</dt><dd>${task.reviewed ? 'Reviewed' : 'Not reviewed'}</dd></div><div><dt>Note</dt><dd>${esc(task.notes || '—')}</dd></div></dl></div></section>
        <section class="card"><div class="card-head"><h2>Progress update</h2></div><div class="card-body"><form data-form="task-comment"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-comment">Add a comment or progress update</label><textarea id="task-comment" name="body" rows="3" placeholder="What changed?" required></textarea></div><div class="row-actions"><button class="btn btn-primary btn-sm" type="submit">Save progress</button><label class="checkbox-row"><input name="real" type="checkbox" value="1" /> This is a real progress update</label></div></form></div></section>
        <section class="card"><div class="card-head"><h2>Details</h2></div><div class="card-body"><dl class="details"><div><dt>Description</dt><dd>${esc(task.description || '—')}</dd></div><div><dt>Steps</dt><dd>${esc(task.expected || '—')}</dd></div><div><dt>Expected</dt><dd>${esc(task.expected || '—')}</dd></div><div><dt>Actual</dt><dd>${esc(task.actual || '—')}</dd></div></dl></div></section>
        <section class="card"><div class="card-head"><h2>Attachments / deliverables</h2></div><div class="card-body">${task.attachments.length ? `<div class="row-list">${task.attachments.map((file) => `<div class="row-item"><span class="badge badge-muted">FILE</span><span class="row-main"><span class="row-title">${esc(file.name)}</span><span class="row-meta">${esc(file.kind)}</span></span><button class="btn btn-ghost btn-sm" type="button" data-action="fake-download">Open</button></div>`).join('')}</div>` : empty('No attachments yet.')}</div></section>
        <section class="card"><div class="card-head"><h2>Subtasks</h2><span class="badge badge-muted">${subtasks.length}</span></div><div class="card-body">${subtasks.length ? `<div class="row-list">${subtasks.map((row) => `<div class="row-item"><span class="key-link">↳ ${esc(row.key)}</span><span class="row-main"><span class="row-title"><a href="#/task/${row.id}">${esc(row.title)}</a></span></span>${statusBadge(row.workflow)}</div>`).join('')}</div>` : empty('No subtasks.')}</div></section>
        <section class="card"><div class="card-head"><h2>Scheduled</h2></div><div class="card-body">${scheduled.length ? `<div class="row-list">${scheduled.map((event) => `<div class="row-item"><span class="row-date">${fmt(event.date)}</span><span class="row-main"><span class="row-title">${esc(event.title)}</span><span class="row-meta">${esc(event.kind)} ${esc(event.time)}</span></span></div>`).join('')}</div>` : empty('No scheduled time.')}</div></section>
        <section class="card"><div class="card-head"><h2>Comments and history</h2></div><div class="card-body"><div class="feed">${feed.map((row) => `<div class="feed-item"><div class="feed-head">${avatar(row.who ?? row.author ?? 'Amara')}<strong>${esc(row.who ?? row.author ?? 'Amara')}</strong><span>${fmtStamp(row.at)}</span>${row.kind === 'history' ? `<span class="badge badge-muted">${esc(row.field)}</span>` : ''}</div><p>${row.kind === 'comment' ? esc(row.body) : `${esc(row.field)}: ${esc(row.old || '—')} → ${esc(row.new || '—')}`}</p></div>`).join('') || empty('No activity yet.')}</div><form class="comment-form" data-form="task-comment"><input type="hidden" name="id" value="${task.id}" /><textarea name="body" rows="2" placeholder="Add a comment…" required></textarea><button class="btn btn-primary btn-sm" type="submit">Comment</button></form></div></section>
        ${mentioning.length ? `<section class="card"><div class="card-head"><h2>Pages mentioning this task</h2></div><div class="card-body"><div class="row-list">${mentioning.map((page) => `<a class="row-item" href="#/page/${page.id}"><span class="row-main"><span class="row-title">${esc(page.title)}</span><span class="row-meta">${esc(page.type)}</span></span>${icon('arrow', 16)}</a>`).join('')}</div></div></section>` : ''}
      </div>
      <aside class="detail-side">
        <section class="card"><div class="card-head"><h2>Workflow</h2></div><div class="card-body"><form class="stack" data-form="task-workflow"><input type="hidden" name="id" value="${task.id}" /><div class="field"><label for="task-move">Move to</label><select id="task-move" class="select" name="to">${['To do', 'In progress', 'Waiting', 'Done'].map((value) => option(value, task.status)).join('')}</select></div><div class="field"><label for="task-reason">Reason</label><input id="task-reason" name="reason" type="text" placeholder="Required for some moves" /></div><button class="btn btn-primary btn-sm" type="submit">Apply move</button></form></div></section>
        <section class="card"><div class="card-head"><h2>Your review</h2></div><div class="card-body"><p class="text-sm text-muted">${task.reviewed ? 'You have reviewed this work.' : 'Approve the deliverable or ask for changes.'}</p><div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-action="task-review" data-id="${task.id}" data-decision="approve">Approve</button><button class="btn btn-ghost btn-sm" type="button" data-action="task-review" data-id="${task.id}" data-decision="changes">Request changes</button></div></div></section>
        <section class="card"><div class="card-head"><h2>Recommended model</h2></div><div class="card-body"><p><strong>${esc(state.team.find((agent) => agent.name === task.owner)?.model ?? 'deepseek-v4-flash')}</strong></p><p class="text-xs text-muted">Based on the current owner's agent definition.</p></div></section>
        <section class="card"><div class="card-head"><h2>Details</h2></div><div class="card-body"><dl class="details compact"><div><dt>Assignee</dt><dd>${esc(task.owner)}</dd></div><div><dt>Priority</dt><dd>${esc(task.priority)}</dd></div><div><dt>Severity</dt><dd>${esc(task.severity)}</dd></div><div><dt>Type</dt><dd>${esc(task.type)}</dd></div><div><dt>Component</dt><dd>${esc(task.component)}</dd></div><div><dt>Module</dt><dd>${esc(task.module)}</dd></div><div><dt>Reporter</dt><dd>Amara</dd></div><div><dt>Due</dt><dd>${fmt(task.due)}</dd></div><div><dt>Start</dt><dd>${fmt(task.start)}</dd></div><div><dt>Created</dt><dd>${fmtStamp(task.createdAt)}</dd></div><div><dt>ID</dt><dd>${esc(task.id)}</dd></div></dl></div></section>
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
    ${tab === 'work' ? `<section class="card"><div class="card-head"><h2>Work items</h2><span class="badge badge-muted">${tasks.length}</span></div><div class="card-body"><div class="table-wrap"><table class="table table-stack"><thead><tr><th>Key</th><th>Summary</th><th>Status</th><th>Assignee</th><th>Due</th></tr></thead><tbody>${tasks.map((task) => `<tr><td data-label="Key"><a class="key-link" href="#/task/${task.id}">${esc(task.key)}</a></td><td data-label="Summary"><a class="table-title" href="#/task/${task.id}">${esc(task.title)}</a></td><td data-label="Status">${statusBadge(task.workflow)}</td><td data-label="Assignee">${esc(task.owner)}</td><td data-label="Due">${fmt(task.due)}</td></tr>`).join('') || `<tr><td colspan="5">${empty('No work items.')}</td></tr>`}</tbody></table></div></div></section>` : tab === 'pages' ? `<section class="card"><div class="card-head"><h2>Pages</h2><span class="badge badge-muted">${pages.length}</span></div><div class="card-body"><div class="row-list">${pages.map((page) => `<a class="row-item" href="#/page/${page.id}"><span class="row-main"><span class="row-title">${esc(page.title)}</span><span class="row-meta">${esc(page.type)} · ${fmtStamp(page.updatedAt)}</span></span>${icon('arrow', 16)}</a>`).join('') || empty('No pages.')}</div></div></section>` : `<div class="detail-grid"><div class="detail-main"><section class="card"><div class="card-head"><h2>Work by status</h2></div><div class="card-body"><div class="bar-list">${statuses.map((status) => `<div class="bar-row"><span>${status}</span><span class="bar-track"><span class="bar-fill" data-bar="${tasks.filter((task) => task.status === status).length}"></span></span><strong>${tasks.filter((task) => task.status === status).length}</strong></div>`).join('')}</div></div></section><section class="card"><div class="card-head"><h2>Coming up</h2></div><div class="card-body">${empty('No project schedule in the next 30 days.')}</div></section></div><aside class="detail-side"><section class="card"><div class="card-head"><h2>Snapshot</h2></div><div class="card-body"><dl class="details compact"><div><dt>Open items</dt><dd>${open.length}</dd></div><div><dt>All items</dt><dd>${tasks.length}</dd></div><div><dt>Pages</dt><dd>${pages.length}</dd></div><div><dt>Status</dt><dd>${esc(project.status)}</dd></div></dl></div></section><section class="card"><div class="card-head"><h2>Pages</h2></div><div class="card-body"><div class="row-list">${pages.slice(0, 4).map((page) => `<a class="row-item" href="#/page/${page.id}"><span class="row-main"><span class="row-title">${esc(page.title)}</span><span class="row-meta">${esc(page.type)}</span></span></a>`).join('') || empty('No pages.')}</div></div></section></aside></div>`}`;
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
    default: return notFound(route.path);
  }
}

export function mountView(route, query, state) {
  if (route.id === 'home') {
    const rating = document.getElementById('home-rating');
    if (rating && state.ratings) renderLineChart(rating, { labels: state.ratings.labels, series: state.ratings.series.slice(0, 4), title: 'Rating trend' });
    const pareto = document.getElementById('home-pareto');
    if (pareto) {
      const counts = {};
      state.bugs.forEach((bug) => { counts[bug.component] = (counts[bug.component] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      renderBarChart(pareto, { labels: sorted.map(([name]) => name.split(' ')[0]), values: sorted.map(([, value]) => value), title: 'Issues by component' });
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
  if (route.id === 'settings-appearance') {
    const input = document.getElementById('theme-primary');
    if (input && !state.settings.appearance.primary) {
      input.value = getComputedStyle(document.documentElement).getPropertyValue('--color-card-header').trim();
    }
  }
}

export function renderCreateDialog(state) {
  return `<div class="create-dialog">
    <div class="tabs" role="tablist" data-create-tabs>
      <button class="tab" type="button" role="tab" aria-selected="true" data-create-tab="task">Task</button>
      <button class="tab" type="button" role="tab" aria-selected="false" data-create-tab="bug">Bug</button>
      <button class="tab" type="button" role="tab" aria-selected="false" data-create-tab="event">Event</button>
    </div>
    <form class="form-grid create-panel" data-create-panel="task" data-form="create-task">
      <div class="field field-wide"><label for="create-task-title">Title</label><input id="create-task-title" name="title" type="text" required /></div>
      <div class="field"><label for="create-task-project">Project</label><select id="create-task-project" class="select" name="projectId"><option value="">(Dispatcher picks)</option>${state.projects.filter((p) => !p.archived).map((p) => option(p.id, '', `${p.key} ${p.name}`)).join('')}</select></div>
      <div class="field"><label for="create-task-type">Type</label><select id="create-task-type" class="select" name="type">${['Task', 'Story', 'Epic', 'Sub-task', 'Improvement', 'Bug'].map((value) => option(value, 'Task')).join('')}</select></div>
      <div class="field"><label for="create-task-priority">Priority</label><select id="create-task-priority" class="select" name="priority">${['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((value) => option(value, 'Medium')).join('')}</select></div>
      <div class="field"><label for="create-task-due">Due</label><input id="create-task-due" name="due" type="date" /></div>
      <div class="field field-wide"><label for="create-task-description">Description</label><textarea id="create-task-description" name="description" rows="3"></textarea></div>
    </form>
    <form class="form-grid create-panel" data-create-panel="bug" data-form="create-bug" hidden>
      <div class="field field-wide"><label for="create-bug-title">Title</label><input id="create-bug-title" name="title" type="text" required /></div>
      <div class="field"><label for="create-bug-severity">Severity</label><select id="create-bug-severity" class="select" name="severity">${['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'].map((value) => option(value, 'S3 Major')).join('')}</select></div>
      <div class="field"><label for="create-bug-component">Component</label><select id="create-bug-component" class="select" name="component">${['work desk', 'tasks page', 'bugs page', 'calendar', 'settings', 'chart studio', 'other'].map((value) => option(value, 'other')).join('')}</select></div>
      <div class="field field-wide"><label for="create-bug-repro">Steps to reproduce</label><textarea id="create-bug-repro" name="repro" rows="3" required></textarea></div>
    </form>
    <form class="form-grid create-panel" data-create-panel="event" data-form="create-event" hidden>
      <div class="field field-wide"><label for="create-event-title">What</label><input id="create-event-title" name="title" type="text" required /></div>
      <div class="field"><label for="create-event-date">Date</label><input id="create-event-date" name="date" type="date" value="${today()}" required /></div>
      <div class="field"><label for="create-event-time">Start time</label><input id="create-event-time" name="time" type="time" /></div>
      <div class="field"><label for="create-event-kind">Kind</label><select id="create-event-kind" class="select" name="kind">${['Meeting', 'Reminder', 'Task', 'Deadline', 'Other'].map((value) => option(value, 'Reminder')).join('')}</select></div>
      <div class="field"><label for="create-event-link">Meeting link</label><input id="create-event-link" name="link" type="url" /></div>
      <div class="field field-wide"><label for="create-event-note">Note</label><textarea id="create-event-note" name="note" rows="2"></textarea></div>
    </form>
  </div>`;
}
