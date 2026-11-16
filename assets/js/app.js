import { listAccounts, getAccount, getActiveAccountId, setActiveAccount, clearActiveAccount, createAccount } from './accounts.js';
import {
  start, getState, refresh, resetDemo, createTask, updateTask, addTaskComment,
  transitionTask, reviewTask,
  createBug, updateBug, addBugComment, createEvent, deleteEvent, createPage,
  updatePage, softDeletePage, createProject, updateProject, createOrder,
  closeOrder, saveSettings, restoreQaMark, buildExport,
} from './data.js';
import { readLocation, routeForPath, groupRoutes, SETTINGS_LINKS } from './routes.js';
import { renderView, mountView, renderAccountScreen, renderCreateDialog, canSendToQa, qaOwnerName } from './views.js';
import { icon } from './icons.js';
import { updateTaskBadge } from './nav-badge.js';
import { openModal, toast } from './ui.js';
import { taskFormPatch } from './task-form.js';
import { dueReminders, notificationText } from './schedule.js';

const shell = document.getElementById('shell');
const authScreen = document.getElementById('auth-screen');
const nav = document.getElementById('nav');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');
const menuToggle = document.getElementById('menu-toggle');
const menuLabel = menuToggle?.querySelector('.sr-only');
const foldButton = document.getElementById('sidebar-fold');
const pinButton = document.getElementById('sidebar-pin');
const reopenButton = document.getElementById('sidebar-reopen');
const main = document.getElementById('view');
const fab = document.getElementById('fab');
const todayEl = document.getElementById('today-date');
const storageStatus = document.getElementById('storage-status');
const accountButton = document.getElementById('account-name');
const desktopQuery = window.matchMedia('(min-width: 900px)');
const SIDEBAR_FOLD_KEY = 'my-platform.sidebar.folded';
const SIDEBAR_PIN_KEY = 'my-platform.sidebar.pinned';
let sidebarFolded = readPreference(SIDEBAR_FOLD_KEY);
let sidebarPinned = readPreference(SIDEBAR_PIN_KEY);
let lastFocused = null;
let createTab = 'task';
let createClose = null;
let reminderTimer = null;
const notifiedReminders = new Set();

// Pin always wins if an older session somehow stored a folded, pinned sidebar.
if (sidebarPinned && sidebarFolded) {
  sidebarFolded = false;
  writePreference(SIDEBAR_FOLD_KEY, false);
}

function readPreference(key) {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be unavailable in private or embedded contexts; keep the session state.
  }
}

function pollReminders() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return [];
  const current = getState();
  const now = new Date();
  const due = dueReminders(current.events ?? [], now, new Date(now.getTime() + 3600000), { sent: notifiedReminders });
  for (const reminder of due) {
    notifiedReminders.add(reminder.reminderKey);
    try {
      new Notification(`Reminder · ${reminder.title}`, { body: notificationText(reminder), tag: reminder.reminderKey });
    } catch {
      // A browser may deny the constructor even after permission; polling stays quiet.
    }
  }
  return due;
}

function startReminderTimer() {
  if (reminderTimer) return;
  pollReminders();
  reminderTimer = setInterval(pollReminders, 60000);
}

function settingsSublist() {
  return `<li><ul class="nav-sublist" data-settings-nav hidden>${SETTINGS_LINKS.map((route) => `<li><a class="nav-sublink" href="#${route.path}" data-route="${route.id}">${route.label}</a></li>`).join('')}</ul></li>`;
}

function projectSublist(state) {
  const projects = state.projects.filter((project) => !project.archived);
  if (!projects.length) return '';
  return `<li><ul class="nav-sublist" data-project-nav>${projects.map((project) => `<li><a class="nav-sublink" href="#/project/${escAttr(project.key)}" data-project-key="${escAttr(project.key)}"><span class="nav-key">${escAttr(project.key)}</span>${escAttr(project.name)}</a></li>`).join('')}</ul></li>`;
}

const escAttr = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function buildNav(state) {
  nav.innerHTML = groupRoutes().map((group) => `
    <div class="nav-group">
      ${group.label ? `<p class="nav-label">${group.label}</p>` : ''}
      <ul class="nav-list">
        ${group.routes.map((route) => `
          <li>
            <a class="nav-link" href="#${route.path}" data-route="${route.id}">
              ${icon(route.icon)}
              <span>${route.label}</span>
              ${route.id === 'tasks' ? '<span class="badge badge-accent nav-count" data-task-count hidden>0</span>' : ''}
            </a>
          </li>
          ${route.id === 'projects' ? projectSublist(state) : ''}
          ${route.id === 'settings' ? settingsSublist() : ''}`).join('')}
      </ul>
    </div>`).join('');
}

function isDrawerMode() {
  return !desktopQuery.matches;
}

function setDrawer(open) {
  const shouldOpen = open && isDrawerMode();
  if (!shouldOpen && lastFocused) {
    lastFocused.focus();
    lastFocused = null;
  }
  document.body.classList.toggle('nav-open', shouldOpen);
  menuToggle?.setAttribute('aria-expanded', String(shouldOpen));
  menuToggle?.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
  if (menuLabel) menuLabel.textContent = shouldOpen ? 'Close navigation' : 'Open navigation';
  sidebar.toggleAttribute('inert', isDrawerMode() && !shouldOpen);
  if (shouldOpen) {
    lastFocused = document.activeElement;
    nav.querySelector('a')?.focus();
  }
}

function syncSidebarMode() {
  if (desktopQuery.matches) {
    document.body.classList.remove('nav-open');
    sidebar.removeAttribute('inert');
  } else if (!document.body.classList.contains('nav-open')) {
    sidebar.setAttribute('inert', '');
  }
  applySidebarState();
}

function applySidebarState({ focus = null } = {}) {
  const folded = sidebarFolded && !isDrawerMode();
  document.body.classList.toggle('sidebar-folded', folded);
  document.body.classList.toggle('sidebar-pinned', sidebarPinned);

  if (foldButton) {
    foldButton.setAttribute('aria-expanded', String(!folded));
    const label = folded ? 'Unfold sidebar' : 'Fold sidebar';
    foldButton.setAttribute('aria-label', label);
    foldButton.title = label;
  }

  if (pinButton) {
    pinButton.setAttribute('aria-pressed', String(sidebarPinned));
    const label = sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open';
    pinButton.setAttribute('aria-label', label);
    pinButton.title = label;
  }

  if (reopenButton) {
    reopenButton.hidden = !folded;
    reopenButton.setAttribute('aria-expanded', String(!folded));
  }

  if (focus === 'reopen') reopenButton?.focus();
  else if (focus === 'fold') foldButton?.focus();
}

function setSidebarFolded(folded) {
  if (folded && sidebarPinned) {
    toast('The sidebar is pinned open. Unpin it before folding.', { tone: 'danger' });
    pinButton?.focus();
    return false;
  }
  sidebarFolded = Boolean(folded);
  writePreference(SIDEBAR_FOLD_KEY, sidebarFolded);
  applySidebarState({ focus: sidebarFolded ? 'reopen' : 'fold' });
  return true;
}

function toggleSidebarPin() {
  sidebarPinned = !sidebarPinned;
  writePreference(SIDEBAR_PIN_KEY, sidebarPinned);
  if (sidebarPinned && sidebarFolded) {
    sidebarFolded = false;
    writePreference(SIDEBAR_FOLD_KEY, false);
  }
  applySidebarState();
  toast(
    sidebarPinned ? 'Sidebar pinned open. It will not fold.' : 'Sidebar unpinned. You can fold it again.',
    { tone: sidebarPinned ? 'success' : 'info' }
  );
}

function trapTab(event) {
  const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function updateNav(route) {
  const isSettings = route.id === 'settings' || route.id.startsWith('settings-');
  nav.querySelectorAll('[data-route]').forEach((link) => {
    if (link.dataset.route === route.nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const settingsLink = nav.querySelector('[data-route="settings"]');
  settingsLink?.classList.toggle('is-section', isSettings && route.id !== 'settings');
  const settingsNav = nav.querySelector('[data-settings-nav]');
  if (settingsNav) settingsNav.hidden = !isSettings;
  if (isSettings) {
    const current = nav.querySelector(`[data-route="${route.id}"]`);
    if (current) current.setAttribute('aria-current', 'page');
    if (route.id === 'settings') settingsLink?.setAttribute('aria-current', 'page');
  }
  if (route.id === 'project-detail') {
    nav.querySelector('[data-route="projects"]')?.classList.add('is-section');
    nav.querySelector(`[data-project-key="${escAttr(route.params.key)}"]`)?.setAttribute('aria-current', 'page');
  }
  updateTaskBadge(nav.querySelector('[data-task-count]'), getState().tasks);
}

function applyAppearance(settings) {
  const root = document.documentElement;
  root.style.removeProperty('--color-card-header');
  root.style.removeProperty('--color-accent-strong');
  root.style.removeProperty('--color-focus');
  const primary = settings?.appearance?.primary;
  if (primary) {
    root.style.setProperty('--color-card-header', primary);
    root.style.setProperty('--color-focus', primary);
  }
}

function render() {
  const { path, query } = readLocation();
  const state = getState();
  const route = routeForPath(path, state);
  if (route.redirectFrom) window.history.replaceState(null, '', `#${route.path}`);
  main.innerHTML = renderView(route, query, state);
  document.title = `${route.title} · My Platform`;
  buildNav(state);
  updateNav(route);
  applyAppearance(state.settings);
  mountView(route, query, state);
  setDrawer(false);
  if (accountButton) accountButton.textContent = state.account.name;
  if (storageStatus) storageStatus.textContent = state.persistentStorage?.status ?? 'Unsupported';
  if (todayEl) todayEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  window.scrollTo(0, 0);
}

async function rerender() {
  await refresh();
  render();
}

function showAuth() {
  shell.hidden = true;
  authScreen.hidden = false;
  if (fab) fab.hidden = true;
  authScreen.innerHTML = renderAccountScreen(listAccounts());
}

async function boot() {
  const activeId = getActiveAccountId();
  const account = activeId ? getAccount(activeId) : null;
  if (!account) {
    showAuth();
    return;
  }
  try {
    await start(account);
    shell.hidden = false;
    authScreen.hidden = true;
    if (fab) fab.hidden = false;
    startReminderTimer();
    render();
  } catch (error) {
    console.error(error);
    clearActiveAccount();
    showAuth();
    toast('The local database could not be opened. Choose an account again.', { tone: 'danger' });
  }
}

function navigate(path, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== '' && value !== undefined && value !== null) search.set(key, value);
  const next = `#${path}${search.toString() ? `?${search}` : ''}`;
  if (window.location.hash === next) render();
  else window.location.hash = next;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function openCreateDialog(preset = {}) {
  const options = typeof preset === 'string' ? { tab: preset } : (preset ?? {});
  const state = getState();
  const content = document.createElement('div');
  content.innerHTML = renderCreateDialog(state, options);
  const requestedTab = options.tab || (options.taskId ? 'event' : 'task');
  createTab = ['task', 'bug', 'event'].includes(requestedTab) ? requestedTab : 'task';
  const tabs = [...content.querySelectorAll('[data-create-tab]')];
  const panels = [...content.querySelectorAll('[data-create-panel]')];
  const selectTab = (name) => {
    createTab = name;
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.createTab === name)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.createPanel !== name; });
  };
  selectTab(createTab);
  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.createTab)));
  const dialog = openModal({
    title: 'Create',
    content,
    confirmLabel: 'Create',
    size: 'lg',
    onConfirm: () => submitCreate(),
  });
  createClose = dialog.close;
}

async function submitCreate() {
  const root = document.querySelector('.create-dialog');
  if (!root) return false;
  const form = root.querySelector(`[data-create-panel="${createTab}"]`);
  if (!form) return false;
  if (!form.reportValidity()) return false;
  const data = formData(form);
  try {
    if (createTab === 'task') {
      const task = await createTask(data);
      createClose?.();
      await rerender();
      toast(`Task ${task.key} created on this device.`, { tone: 'success' });
    } else if (createTab === 'bug') {
      const bug = await createBug(data);
      createClose?.();
      await rerender();
      toast(`Bug ${bug.key} reported.`, { tone: 'success' });
    } else {
      const event = await createEvent(data);
      createClose?.();
      navigate('/calendar', { m: String(event.date).slice(0, 7) });
      toast(`Event "${event.title}" added to the calendar.`, { tone: 'success' });
    }
    return true;
  } catch (error) {
    toast(error.message, { tone: 'danger' });
    return false;
  }
}

async function sendToQA(id) {
  const current = getState();
  const task = current.tasks.find((row) => row.id === id);
  if (!task || !canSendToQa(current, task)) return;
  const existing = String(task.notes ?? '').trim();
  const notes = existing.includes('[待核') ? existing : `${existing} [待核 ${new Date().toISOString().slice(0, 10)}]`.trim();
  await updateTask(id, { status: 'Waiting', workflow: 'Fixed', owner: qaOwnerName(current), notes }, 'status');
  render();
  toast(`${task.key} sent to QA.`, { tone: 'success' });
}

async function briefTask(id) {
  const task = getState().tasks.find((row) => row.id === id);
  if (!task) return;
  const text = `${task.key} · ${task.title}\nOwner: ${task.owner}\nPriority: ${task.priority}\nDue: ${task.due || 'none'}\n\n${task.description || ''}`;
  try { await navigator.clipboard.writeText(text); toast('Brief copied to the clipboard.', { tone: 'success' }); }
  catch { toast('Clipboard access is not available.', { tone: 'danger' }); }
}

function toggleSubtasks(button) {
  const rowId = button.dataset.id;
  const next = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(next));
  const glyph = button.querySelector('[data-toggle-glyph]');
  const label = button.querySelector('[data-toggle-label]');
  if (glyph) glyph.textContent = next ? '▾' : '▸';
  const nextLabel = `${next ? 'Hide' : 'Show'} subtasks for ${button.dataset.key}`;
  button.setAttribute('aria-label', nextLabel);
  if (label) label.textContent = nextLabel;

  const rows = [...main.querySelectorAll('tr[data-row-id]')];
  const childrenOf = (id) => rows.filter((row) => row.dataset.parentRow === id);
  const hideDescendants = (id) => {
    for (const child of childrenOf(id)) {
      child.hidden = true;
      hideDescendants(child.dataset.rowId);
    }
  };
  const revealChildren = (id) => {
    for (const child of childrenOf(id)) {
      child.hidden = false;
      const childToggle = main.querySelector(`[data-action="toggle-subtasks"][data-id="${child.dataset.rowId}"]`);
      if (childToggle?.getAttribute('aria-expanded') === 'true') revealChildren(child.dataset.rowId);
    }
  };
  if (next) revealChildren(rowId);
  else hideDescendants(rowId);
}

async function resetDemoData() {
  try {
    await resetDemo();
    render();
    toast('Demo data restored.', { tone: 'success' });
  } catch (error) {
    toast(error.message, { tone: 'danger' });
  }
}

function backupFilename(exportedAt) {
  const stamp = String(exportedAt).replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `my-platform-backup-${stamp}.json`;
}

// Build the JSON entirely in the browser, then hand it to the browser's normal
// download flow. Nothing is fetched or uploaded.
async function exportJsonBackup() {
  try {
    const payload = await buildExport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFilename(payload.exportedAt);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    render();
    toast('Backup downloaded. Keep the JSON file somewhere safe.', { tone: 'success' });
  } catch (error) {
    toast(error.message || 'The backup could not be exported.', { tone: 'danger' });
  }
}

function isHttpLink(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function openAgendaDialog(rowEl) {
  const kind = rowEl.dataset.agendaKind || 'Item';
  const title = rowEl.dataset.agendaTitle || '';
  const href = rowEl.dataset.agendaHref || '#/calendar';
  const link = rowEl.dataset.agendaLink || '';
  const eventId = rowEl.dataset.agendaEvent || '';
  const date = rowEl.dataset.agendaDate || '';
  const time = rowEl.dataset.agendaTime || '';
  const content = document.createElement('div');
  content.className = 'stack';

  const meta = document.createElement('p');
  const badge = document.createElement('span');
  badge.className = 'badge badge-muted';
  badge.textContent = kind;
  meta.append(badge);
  content.append(meta);

  const heading = document.createElement('p');
  heading.className = 'row-title';
  heading.textContent = title;
  content.append(heading);

  const when = document.createElement('p');
  when.className = 'row-meta';
  when.textContent = [date, time].filter(Boolean).join(' · ');
  if (when.textContent) content.append(when);

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const open = document.createElement('a');
  open.className = 'btn btn-primary';
  open.href = href;
  open.textContent = 'Open full page';
  actions.append(open);

  if (isHttpLink(link)) {
    const join = document.createElement('a');
    join.className = 'btn';
    join.href = link;
    join.target = '_blank';
    join.rel = 'noopener noreferrer';
    join.textContent = 'Join meeting';
    actions.append(join);
  }

  let dialog;
  if (eventId) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-danger';
    remove.textContent = 'Delete event';
    remove.dataset.action = 'delete-event';
    remove.dataset.id = eventId;
    remove.addEventListener('click', () => dialog?.close());
    actions.append(remove);
  }
  content.append(actions);

  dialog = openModal({
    title: title || 'Agenda item',
    content,
    confirmLabel: 'Close',
    cancelLabel: 'Dismiss',
  });
  open.addEventListener('click', () => dialog.close());
}

function openAgentTodo(owner) {
  const state = getState();
  const body = document.createElement('div');
  const orders = state.orders.filter((order) => order.owner === owner);
  const tasks = state.tasks.filter((task) => task.owner === owner && task.status !== 'Done').slice(0, 12);
  body.innerHTML = `<div class="stack">
    <h3>Open orders</h3>
    <div class="row-list">${orders.map((order) => `<div class="row-item"><span class="row-main"><span class="row-title">${escAttr(order.text)}</span><span class="row-meta">${order.open ? 'Open' : 'Closed'}</span></span>${order.open ? `<button class="btn btn-ghost btn-sm" type="button" data-action="close-order" data-id="${order.id}">Done</button>` : ''}</div>`).join('') || '<p class="empty-state">No orders.</p>'}</div>
    <h3>Owned work items</h3>
    <div class="row-list">${tasks.map((task) => `<a class="row-item" href="#/task/${task.id}"><span class="row-main"><span class="row-title">${escAttr(task.title)}</span><span class="row-meta">${escAttr(task.key)} · ${escAttr(task.status)}</span></span></a>`).join('') || '<p class="empty-state">No owned work items.</p>'}</div>
  </div>`;
  openModal({ title: `${owner} · to-do list`, content: body, confirmLabel: 'Close' });
}

document.addEventListener('click', async (event) => {
  const openAccount = event.target.closest('[data-open-account]');
  if (openAccount) { setActiveAccount(openAccount.dataset.openAccount); window.location.reload(); return; }
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;
  if (action === 'agenda-row') { event.preventDefault(); openAgendaDialog(actionEl); }
  else if (action === 'switch-account') { clearActiveAccount(); window.location.reload(); }
  else if (action === 'open-create') openCreateDialog();
  else if (action === 'new-subtask') {
    const parent = getState().tasks.find((row) => row.id === id);
    openCreateDialog({ tab: 'task', parentId: id, projectId: parent?.projectId || '', type: 'Sub-task' });
  } else if (action === 'schedule-task' || action === 'task-schedule') {
    const task = getState().tasks.find((row) => row.id === id);
    openCreateDialog({ tab: 'event', taskId: id, projectId: task?.projectId || '' });
  } else if (action === 'focus-dependencies') {
    const input = document.getElementById(`task-plan-depends-${id}`);
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus();
  }
  else if (action === 'reset-demo') {
    openModal({ title: 'Reset demo data?', message: 'All changes in the Test account will be replaced by the original demo rows.', confirmLabel: 'Reset', tone: 'danger', onConfirm: () => { resetDemoData(); } });
  } else if (action === 'export-json') exportJsonBackup();
  else if (action === 'task-toqa') sendToQA(id);
  else if (action === 'task-restore-mark') {
    try {
      const result = await restoreQaMark(id);
      render();
      toast(`${result.snapshot.key} QA mark restored.`, { tone: 'success' });
    } catch (error) {
      toast(error.message, { tone: 'danger' });
    }
  } else if (action === 'task-brief') briefTask(id);
  else if (action === 'toggle-subtasks') toggleSubtasks(actionEl);
  else if (action === 'task-review') {
    const decision = actionEl.dataset.decision;
    const comment = document.getElementById('task-review-comment')?.value ?? '';
    try {
      await reviewTask(id, decision, { comment });
      render();
      toast(decision === 'approve' ? 'Work approved.' : 'Changes requested.', { tone: 'success' });
    } catch (error) {
      toast(error.message, { tone: 'danger' });
    }
  } else if (action === 'project-archive') {
    const project = getState().projects.find((row) => row.id === id);
    if (project) { await updateProject(id, { archived: project.archived ? 0 : 1, status: project.archived ? 'Active' : 'Archived' }); render(); toast(project.archived ? 'Project restored.' : 'Project archived.'); }
  } else if (action === 'delete-page') {
    openModal({ title: 'Delete this page?', message: 'The page is soft-deleted on this device. Other versions stay in the account.', confirmLabel: 'Delete', tone: 'danger', onConfirm: async () => { await softDeletePage(id); render(); toast('Page deleted.', { tone: 'success' }); } });
  } else if (action === 'delete-event') {
    openModal({ title: 'Delete this event?', message: 'This removes the event from this device.', confirmLabel: 'Delete', tone: 'danger', onConfirm: async () => { await deleteEvent(id); render(); toast('Event deleted.', { tone: 'success' }); } });
  } else if (action === 'enable-reminders') {
    if (typeof Notification !== 'undefined') {
      let result = Notification.permission;
      if (result === 'default') {
        try {
          result = await Notification.requestPermission();
        } catch {
          result = 'denied';
        }
      }
      if (result === 'granted') {
        startReminderTimer();
        const due = pollReminders();
        toast(due.length ? `${due.length} reminder${due.length === 1 ? '' : 's'} due soon.` : 'Reminders enabled. The app checks due reminders every minute.', { tone: 'success' });
      } else {
        toast('Notification permission was not granted.', { tone: 'danger' });
      }
    } else toast('This browser does not support notifications.', { tone: 'danger' });
  } else if (action === 'print') window.print();
  else if (action === 'open-folder') toast('Folder access is not available in a browser.', { tone: 'danger' });
  else if (action === 'fake-download') toast('Attachment placeholder — file storage is a later phase.');
  else if (action === 'toast-copy') toast('Copied actions are placeholders in this build.');
  else if (action === 'test-key') toast('Demo key is valid for preview.', { tone: 'success' });
  else if (action === 'fill-gaps') toast('Backfill is not connected to an AI service yet.');
  else if (action === 'agent-todo') openAgentTodo(actionEl.dataset.owner);
  else if (action === 'close-order') { await closeOrder(id); render(); document.querySelector('.modal-backdrop')?.remove(); }
  else if (action === 'focus-add-project') document.getElementById('add-project-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  else if (action === 'reset-theme') {
    const settings = structuredClone(getState().settings);
    settings.appearance = { primary: '', radiusBtn: 8, radiusCard: 16, glass: 0.25, enableGlass: true };
    await saveSettings(settings);
    applyAppearance(settings);
    render();
    toast('Default look restored.', { tone: 'success' });
  }
});

document.addEventListener('change', async (event) => {
  const move = event.target.closest('[data-move-task]');
  if (move) {
    const status = move.value;
    const workflow = status === 'Waiting' ? 'Fixed' : status === 'Done' ? 'Closed' : status === 'In progress' ? 'In progress' : 'New';
    await updateTask(move.dataset.moveTask, { status, workflow }, 'status');
    render();
    toast('Task moved.', { tone: 'success' });
  }
  const calendarProject = event.target.closest('[data-form="calendar-project"] select');
  if (calendarProject) {
    const form = calendarProject.form;
    navigate('/calendar', { m: form.elements.m.value, project: calendarProject.value });
  }
  const chartTable = event.target.closest('[data-chart-table]');
  if (chartTable) {
    navigate('/files', { run: '1', table: chartTable.value });
    return;
  }
  const chartFilter = event.target.closest('[data-chart-filter]');
  if (chartFilter) {
    navigate('/files', { run: '1', table: chartFilter.dataset.chartFilter, filter: chartFilter.value });
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const data = formData(form);
  try {
    if (form.dataset.form === 'create-account') {
      const account = createAccount(data.name);
      setActiveAccount(account.id);
      window.location.reload();
    } else if (form.dataset.form === 'task-filters') {
      navigate(form.dataset.path || '/tasks', data);
    } else if (form.dataset.form === 'bug-filters') {
      navigate('/bugs', data);
    } else if (form.dataset.form === 'page-filters') {
      navigate('/pages', data);
    } else if (form.dataset.form === 'mywork-filters') {
      navigate('/mywork', { project: data.project, all: data.all });
    } else if (form.dataset.form === 'add-project') {
      await createProject(data);
      await rerender();
      toast('Project added.', { tone: 'success' });
    } else if (form.dataset.form === 'task-title' || form.dataset.form === 'task-details' || form.dataset.form === 'task-fields' || form.dataset.form === 'task-plan') {
      const fields = (form.dataset.history || '').split(',').map((field) => field.trim()).filter(Boolean);
      const patch = taskFormPatch(form.dataset.form, fields, data);
      await updateTask(data.id, patch, fields);
      await rerender();
      toast('Task saved on this device.', { tone: 'success' });
    } else if (form.dataset.form === 'task-comment') {
      await addTaskComment(data.id, data.body);
      await rerender();
      toast('Comment saved on this device.', { tone: 'success' });
    } else if (form.dataset.form === 'bug-comment') {
      await addBugComment(data.id, data.body);
      await rerender();
      toast('Comment saved on this device.', { tone: 'success' });
    } else if (form.dataset.form === 'task-workflow') {
      const moved = await transitionTask(data.id, { to: data.to, as: data.as, reason: data.reason });
      await rerender();
      toast(`${moved.key} moved to ${moved.workflow}.`, { tone: 'success' });
    } else if (form.dataset.form === 'bug-workflow') {
      await updateBug(data.id, { status: data.to }, 'status');
      await rerender();
      toast('Bug moved.', { tone: 'success' });
    } else if (form.dataset.form === 'order') {
      await createOrder(data.owner, data.text);
      await rerender();
      toast('Order sent.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-ai') {
      const settings = structuredClone(getState().settings);
      settings.ai = { ...settings.ai, key: data.key, model: data.model, timeout: Number(data.timeout), status: 'Connected' };
      await saveSettings(settings); applyAppearance(settings); await rerender(); toast('Settings saved.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-limits') {
      const settings = structuredClone(getState().settings);
      settings.aiLimits = { summary: Number(data.summary), progress: Number(data.progress), comment: Number(data.comment), issue: Number(data.issue), benchmark: Number(data.benchmark) };
      await saveSettings(settings); await rerender(); toast('AI limits saved.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-language') {
      const settings = structuredClone(getState().settings);
      settings.language = { primary: data.primary, secondary: data.secondary, rule: data.rule };
      await saveSettings(settings); await rerender(); toast('Language rules saved.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-dispatch') {
      const settings = structuredClone(getState().settings);
      const rules = [];
      for (let i = 0; i < 2; i += 1) if (data[`rule-key-${i}`]) rules.push({ keyword: data[`rule-key-${i}`], owner: data[`rule-owner-${i}`] });
      settings.dispatch = { defaultOwner: data.defaultOwner, rules };
      await saveSettings(settings); await rerender(); toast('Dispatch rules saved.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-areas') {
      const settings = structuredClone(getState().settings);
      settings.areas = { options: data.options.split(',').map((value) => value.trim()).filter(Boolean), fallback: data.fallback };
      await saveSettings(settings); await rerender(); toast('Areas saved.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-appearance') {
      const settings = structuredClone(getState().settings);
      settings.appearance = { primary: data.primary, radiusBtn: Number(data.radiusBtn), radiusCard: Number(data.radiusCard), glass: Number(data.glass), enableGlass: Boolean(data.enableGlass) };
      await saveSettings(settings); applyAppearance(settings); await rerender(); toast('Theme saved.', { tone: 'success' });
    } else if (form.dataset.form === 'page-save') {
      const page = data.id ? await updatePage(data.id, { title: data.title, projectId: data.projectId, body: data.body }) : await createPage(data);
      navigate(`/page/${page.id}`);
      toast('Page saved.', { tone: 'success' });
    } else if (form.dataset.form === 'bug-create') {
      const bug = await createBug(data);
      navigate(`/bug/${bug.id}`);
      toast(`Bug ${bug.key} created.`, { tone: 'success' });
    } else if (form.dataset.form === 'create-task' || form.dataset.form === 'create-bug' || form.dataset.form === 'create-event') {
      await submitCreate();
    }
  } catch (error) {
    toast(error.message || 'Something went wrong.', { tone: 'danger' });
  }
});

menuToggle?.addEventListener('click', () => setDrawer(!document.body.classList.contains('nav-open')));
foldButton?.addEventListener('click', () => {
  if (isDrawerMode()) return;
  setSidebarFolded(!sidebarFolded);
});
pinButton?.addEventListener('click', toggleSidebarPin);
reopenButton?.addEventListener('click', () => setSidebarFolded(false));
backdrop.addEventListener('click', () => setDrawer(false));
nav.addEventListener('click', (event) => { if (event.target.closest('a')) setDrawer(false); });
document.getElementById('skip-link')?.addEventListener('click', (event) => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
document.addEventListener('keydown', (event) => {
  const commentBox = event.target.closest?.('#tskComment, #task-progress-comment');
  if (commentBox && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (typeof commentBox.form?.requestSubmit === 'function') commentBox.form.requestSubmit();
    else commentBox.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return;
  }
  if (!document.body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
  else if (event.key === 'Tab') trapTab(event);
});
document.addEventListener('contextmenu', (event) => event.preventDefault());
desktopQuery.addEventListener('change', syncSidebarMode);
window.addEventListener('hashchange', render);

accountButton?.addEventListener('click', () => { clearActiveAccount(); window.location.reload(); });

applySidebarState();
boot();
