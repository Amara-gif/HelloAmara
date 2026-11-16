import { listAccounts, getAccount, getActiveAccountId, setActiveAccount, clearActiveAccount, createAccount } from './accounts.js';
import {
  start, getState, refresh, resetDemo, createTask, updateTask, addTaskComment,
  transitionTask, reviewTask,
  createBug, updateBug, transitionBug, addBugComment, softDeleteBugs, createEvent, deleteEvent, createPage,
  updatePage, softDeletePage, softDeletePages, createProject, updateProject, softDeleteProject,
  reorderProjects, createOrder, closeOrder, reopenOrder, saveSettings, saveMeta, restoreQaMark, buildExport,
  parseImportJson, planImport, applyImportPlan,
  addAttachment, removeAttachment, attachmentObjectUrl, AI_LIMIT_DEFAULTS,
} from './data.js';
import { readLocation, routeForPath, groupRoutes, SETTINGS_LINKS } from './routes.js';
import { renderView, mountView, renderAccountScreen, renderCreateDialog, bugPrefill, canSendToQa, qaOwnerName, markdown, agentBrief, renderAgentTodo, PALETTE_PRESETS, ratingPreferences } from './views.js';
import { icon } from './icons.js';
import { copyChartImage } from './chart.js';
import { updateTaskBadge } from './nav-badge.js';
import { openModal, toast } from './ui.js';
import { taskFormPatch } from './task-form.js';
import { canMoveToColumn } from './board-columns.js';
import { dueReminders, notificationText } from './schedule.js';
import { startPwa, applyUpdate, setupInstallPrompt, UPDATE_MESSAGE } from './pwa.js';

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
let openedBugNewHash = null;
let reminderTimer = null;
const notifiedReminders = new Set();
const installPrompt = setupInstallPrompt({ onChange: () => syncInstallUi() });

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
              ${route.id === 'tasks' ? '<span class="badge badge-accent nav-count" data-task-count aria-label="0 open work items" title="0 open work items" hidden>0</span>' : ''}
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

const PALETTE_BY_ID = new Map(PALETTE_PRESETS.map((preset) => [preset.id, preset]));
const DEFAULT_APPEARANCE = { preset: 'soft', primary: '', radiusBtn: 8, radiusCard: 16, glass: 0.25, enableGlass: true };
const APPEARANCE_VARS = [
  '--color-card-header',
  '--color-accent',
  '--color-accent-strong',
  '--color-accent-strong-hover',
  '--color-accent-soft',
  '--color-nav-active',
  '--color-focus',
  '--color-on-accent',
  '--color-on-card-header',
];

function appearanceNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function applyPaletteTokens(root, preset) {
  const primary = `var(${preset.primary})`;
  const strong = `var(${preset.strong})`;
  root.style.setProperty('--color-card-header', primary);
  root.style.setProperty('--color-accent', primary);
  root.style.setProperty('--color-accent-strong', strong);
  root.style.setProperty('--color-accent-strong-hover', `var(${preset.hover})`);
  root.style.setProperty('--color-accent-soft', `color-mix(in srgb, ${primary} 14%, var(--color-surface))`);
  root.style.setProperty('--color-nav-active', `color-mix(in srgb, ${primary} 11%, var(--color-surface))`);
  root.style.setProperty('--color-focus', strong);
  root.style.setProperty('--color-on-accent', `var(${preset.on})`);
  root.style.setProperty('--color-on-card-header', `var(${preset.on})`);
}

function applyCustomPrimary(root, primary) {
  root.style.setProperty('--color-card-header', primary);
  root.style.setProperty('--color-accent', primary);
  root.style.setProperty('--color-accent-strong', primary);
  root.style.setProperty('--color-accent-strong-hover', primary);
  root.style.setProperty('--color-accent-soft', `color-mix(in srgb, ${primary} 14%, var(--color-surface))`);
  root.style.setProperty('--color-nav-active', `color-mix(in srgb, ${primary} 11%, var(--color-surface))`);
  root.style.setProperty('--color-focus', primary);
}

function applyAppearance(settings) {
  const root = document.documentElement;
  for (const property of APPEARANCE_VARS) root.style.removeProperty(property);
  const appearance = settings?.appearance ?? {};
  const preset = PALETTE_BY_ID.get(String(appearance.preset ?? ''));
  const primary = String(appearance.primary ?? '').trim();
  if (preset) applyPaletteTokens(root, preset);
  else if (primary) applyCustomPrimary(root, primary);
  root.style.setProperty('--radius-btn', `${appearanceNumber(appearance.radiusBtn, 8, 0, 20)}px`);
  root.style.setProperty('--radius-card', `${appearanceNumber(appearance.radiusCard, 16, 0, 28)}px`);
  root.style.setProperty('--glass-opacity', appearance.enableGlass === false ? '1' : String(appearanceNumber(appearance.glass, 0.25, 0.1, 1)));
}

function appearanceFromForm(form) {
  const data = formData(form);
  return {
    preset: String(data.preset ?? ''),
    primary: String(data.primary ?? '').trim(),
    radiusBtn: numericSetting(data.radiusBtn, 8),
    radiusCard: numericSetting(data.radiusCard, 16),
    glass: numericSetting(data.glass, 0.25),
    enableGlass: Boolean(form.elements.enableGlass?.checked),
  };
}

function cssColourToInputValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^#[0-9a-f]{6}$/i.test(text)) return text;
  const probe = document.createElement('span');
  probe.style.color = text;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(computed);
  if (!match) return '';
  return `#${[1, 2, 3].map((index) => Number(match[index]).toString(16).padStart(2, '0')).join('')}`;
}

function syncAppearanceForm(form) {
  if (!form) return;
  const appearance = appearanceFromForm(form);
  const root = document.documentElement;
  applyAppearance({ appearance });
  const preset = PALETTE_BY_ID.get(appearance.preset);
  form.querySelectorAll('[data-palette]').forEach((card) => {
    card.setAttribute('aria-pressed', String(card.dataset.palette === appearance.preset));
  });
  form.querySelectorAll('[data-theme-value]').forEach((output) => {
    const key = output.dataset.themeValue;
    if (key === 'glass') output.textContent = appearance.enableGlass ? `${Math.round(appearance.glass * 100)}%` : 'Off';
    else if (key === 'radiusBtn') output.textContent = `${appearance.radiusBtn}px`;
    else if (key === 'radiusCard') output.textContent = `${appearance.radiusCard}px`;
  });
  const primaryInput = form.querySelector('#theme-primary');
  if (primaryInput && preset) {
    const resolved = cssColourToInputValue(getComputedStyle(root).getPropertyValue(preset.primary));
    if (resolved) primaryInput.value = resolved;
  }
}

function syncInstallUi() {
  const status = document.getElementById('install-status');
  if (!status) return;
  const available = installPrompt.available;
  status.textContent = available ? 'Ready to install' : 'Use browser menu';
  status.className = `badge badge-${available ? 'success' : 'muted'}`;
}

function offerUpdate(registration) {
  toast(UPDATE_MESSAGE, {
    tone: 'info',
    duration: 0,
    action: {
      label: 'Reload',
      onClick: () => applyUpdate(registration, { reload: () => window.location.reload() }),
    },
  });
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
  syncInstallUi();
  if (route.id === 'bug-new') {
    const hash = window.location.hash;
    if (openedBugNewHash !== hash) {
      openedBugNewHash = hash;
      openCreateDialog(bugPrefill(query));
    }
  } else {
    openedBugNewHash = null;
  }
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

function syncPageSelection() {
  const boxes = [...main.querySelectorAll('[data-page-select]')];
  const selected = boxes.filter((box) => box.checked).length;
  const selectAll = main.querySelector('[data-select-all-pages]');
  if (selectAll) {
    selectAll.checked = boxes.length > 0 && selected === boxes.length;
    selectAll.indeterminate = selected > 0 && selected < boxes.length;
  }
  const button = main.querySelector('[data-action="delete-selected-pages"]');
  if (button) button.disabled = selected === 0;
  const count = main.querySelector('[data-page-selection-count]');
  if (count) count.textContent = `${selected} selected`;
}

function numericSetting(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function setSettingsFormState(form, dirty) {
  const status = form?.querySelector('[data-save-state]');
  if (!status) return;
  status.textContent = dirty
    ? (status.dataset.dirtyText || 'Unsaved changes. Save before leaving.')
    : (status.dataset.savedText || 'All changes saved.');
  status.classList.toggle('is-dirty', dirty);
}

function markSettingsDirty(form) {
  setSettingsFormState(form, true);
}

async function commitSettings(settings, message, { appearance = false } = {}) {
  await saveSettings(settings);
  if (appearance) applyAppearance(settings);
  await rerender();
  toast(message, { tone: 'success' });
}

function addDispatchRule(form) {
  if (!form) return;
  const list = form.querySelector('[data-dispatch-rules]');
  const template = form.querySelector('template[data-dispatch-rule-template]');
  if (!list || !template) return;
  const index = `new-${Date.now()}-${list.querySelectorAll('[data-dispatch-rule]').length}`;
  const fragment = template.content.cloneNode(true);
  for (const node of fragment.querySelectorAll('[name], [id], [for]')) {
    for (const attribute of ['name', 'id', 'for']) {
      const value = node.getAttribute(attribute);
      if (value) node.setAttribute(attribute, value.split('__index__').join(index));
    }
  }
  list.append(fragment);
  const empty = form.querySelector('[data-dispatch-empty]');
  if (empty) empty.hidden = true;
  markSettingsDirty(form);
  list.querySelector('[data-dispatch-rule]:last-child input[name^="rule-key-"]')?.focus();
}

function removeDispatchRule(button) {
  const row = button.closest('[data-dispatch-rule]');
  const form = button.closest('form');
  if (!row) return;
  row.remove();
  const empty = form?.querySelector('[data-dispatch-empty]');
  if (empty) empty.hidden = Boolean(form.querySelector('[data-dispatch-rule]'));
  markSettingsDirty(form);
}

function syncAreaField(form) {
  const field = form?.querySelector('[data-areas-value]');
  if (!field) return;
  field.value = [...form.querySelectorAll('[data-area-chip]')].map((chip) => chip.dataset.areaChip).filter(Boolean).join(', ');
  const empty = form.querySelector('[data-area-empty]');
  if (empty) empty.hidden = Boolean(form.querySelector('[data-area-chip]'));
}

function addAreaChip(form) {
  if (!form) return;
  const input = form.querySelector('#areas-new');
  const name = input?.value.trim() ?? '';
  if (!name) {
    toast('Type an area name first.', { tone: 'danger' });
    input?.focus();
    return;
  }
  const existing = [...form.querySelectorAll('[data-area-chip]')].some((chip) => String(chip.dataset.areaChip).toLowerCase() === name.toLowerCase());
  if (existing) {
    toast('That area is already on the list.', { tone: 'danger' });
    return;
  }
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.dataset.areaChip = name;
  chip.append(document.createTextNode(name));
  const remove = document.createElement('button');
  remove.className = 'chip-remove';
  remove.type = 'button';
  remove.dataset.action = 'remove-area';
  remove.dataset.area = name;
  remove.setAttribute('aria-label', `Remove ${name}`);
  remove.textContent = '×';
  chip.append(remove);
  form.querySelector('[data-area-chips]')?.append(chip);
  input.value = '';
  syncAreaField(form);
  markSettingsDirty(form);
  input.focus();
}

function removeAreaChip(button) {
  const form = button.closest('form');
  button.closest('[data-area-chip]')?.remove();
  syncAreaField(form);
  markSettingsDirty(form);
}

function parseAreaNames(value) {
  return String(value ?? '').split(',').map((name) => name.trim()).filter(Boolean);
}

function selectedBugIds() {
  return [...document.querySelectorAll('[data-bug-select]:checked')].map((input) => input.value);
}

function syncBugSelection() {
  const selected = selectedBugIds();
  const boxes = [...document.querySelectorAll('[data-bug-select]')];
  const selection = document.querySelector('[data-bug-selection]');
  const bulkDelete = document.querySelector('[data-action="delete-selected-bugs"]');
  const selectAll = document.querySelector('[data-select-all-bugs]');
  if (selection) selection.textContent = `${selected.length} selected`;
  if (bulkDelete) bulkDelete.disabled = selected.length === 0;
  if (selectAll) {
    selectAll.checked = boxes.length > 0 && selected.length === boxes.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < boxes.length;
  }
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
      // The report-a-bug route auto-opens this dialog; leave it so a re-render
      // cannot open the dialog again before the new bug is shown.
      if (readLocation().path === '/bugs/new') navigate(`/bug/${bug.id}`);
      else await rerender();
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

function importCountsText(plan) {
  const total = plan.totals ?? plan;
  return `${total.added} added, ${total.updated} updated, ${total.skipped} skipped`;
}

function importTableRow(cells, tagName = 'td') {
  const row = document.createElement('tr');
  for (const value of cells) {
    const cell = document.createElement(tagName);
    cell.textContent = String(value);
    row.append(cell);
  }
  return row;
}

function importModeChoice(value, label, help, checked) {
  const wrap = document.createElement('label');
  wrap.className = 'checkbox-row';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'import-mode';
  input.value = value;
  input.checked = checked;
  const text = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = label;
  const detail = document.createElement('span');
  detail.className = 'field-help';
  detail.textContent = ` ${help}`;
  text.append(strong, detail);
  wrap.append(input, text);
  return wrap;
}

// Build the confirmation dialog from a read-only plan. The DB is only touched
// after the user presses Import and the selected mode is read from the form.
function openImportDialog(plan, filename) {
  const content = document.createElement('div');
  content.className = 'stack';

  const intro = document.createElement('p');
  intro.textContent = `${filename || 'Backup file'} · exported ${plan.exportedAt} from ${plan.deviceId}.`;
  content.append(intro);

  const totals = document.createElement('p');
  totals.textContent = `Merge summary: ${importCountsText(plan)}.`;
  content.append(totals);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  thead.append(importTableRow(['Store', 'Added', 'Updated', 'Skipped'], 'th'));
  const tbody = document.createElement('tbody');
  let tableWasEmpty = true;
  for (const [name, summary] of Object.entries(plan.stores)) {
    if (!summary.added && !summary.updated && !summary.skipped) continue;
    tableWasEmpty = false;
    tbody.append(importTableRow([name, summary.added, summary.updated, summary.skipped]));
  }
  if (tableWasEmpty) tbody.append(importTableRow(['No rows would be written', 0, 0, 0]));
  const tfoot = document.createElement('tfoot');
  tfoot.append(importTableRow([
    'Total',
    plan.added,
    plan.updated,
    plan.skipped,
  ]));
  table.append(thead, tbody, tfoot);
  tableWrap.append(table);
  content.append(tableWrap);

  const deletedNote = document.createElement('p');
  deletedNote.className = 'field-help';
  deletedNote.textContent = `Soft-deleted rows in the file only replace a local row when their updatedAt is newer (${plan.deleted} incoming tombstone${plan.deleted === 1 ? '' : 's'} would be written). The local device id and storage status are always kept.`;
  content.append(deletedNote);

  content.append(
    importModeChoice('merge', 'Merge', 'Keep newer local rows and add or update the rest. This is the safe default.', true),
    importModeChoice('replace', 'Replace all', 'Clear this account first, then write every row from the file. Local-only rows are removed.', false),
  );

  const warning = document.createElement('div');
  warning.className = 'note';
  warning.textContent = 'Nothing is written yet. Merge never removes local-only rows. Replace all only runs when you select it and press Import.';
  content.append(warning);

  openModal({
    title: 'Import backup',
    content,
    confirmLabel: 'Import backup',
    cancelLabel: 'Cancel',
    onConfirm: async () => {
      const selected = content.querySelector('input[name="import-mode"]:checked');
      const mode = selected?.value === 'replace' ? 'replace' : 'merge';
      try {
        const result = await applyImportPlan(plan, { mode });
        render();
        if (mode === 'replace') {
          toast(`Local data replaced from ${filename || 'the backup'}.`, { tone: 'success' });
        } else {
          toast(`Import complete: ${importCountsText(result)}.`, { tone: 'success' });
        }
      } catch (error) {
        toast(error.message || 'The backup could not be imported.', { tone: 'danger' });
        return false;
      }
      return true;
    },
  });
}

async function importJsonFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size === 0) throw new Error('The selected file is empty.');
    const text = typeof file.text === 'function' ? await file.text() : await new Response(file).text();
    const payload = parseImportJson(text);
    const plan = await planImport(payload);
    openImportDialog(plan, file.name);
  } catch (error) {
    toast(error.message || 'The backup could not be read.', { tone: 'danger' });
  } finally {
    input.value = '';
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

function attachmentZone(node) {
  return node?.closest?.('[data-attachments]') ?? null;
}

function filesFromTransfer(transfer) {
  if (!transfer) return [];
  if (transfer.files?.length) return [...transfer.files];
  return [...(transfer.items ?? [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

async function addAttachmentFiles(zone, fileList, label = 'Attached') {
  const files = [...(fileList ?? [])].filter((file) => file && (file.size > 0 || file.name));
  if (!zone || !files.length) return 0;
  const ownerType = zone.dataset.attachmentOwner;
  const ownerId = zone.dataset.attachmentId;
  let added = 0;
  let failed = 0;
  for (const file of files) {
    try {
      await addAttachment(ownerType, ownerId, file);
      added += 1;
    } catch (error) {
      failed += 1;
      toast(error.message || 'That file could not be attached.', { tone: 'danger' });
    }
  }
  if (added) {
    render();
    toast(`${label} ${added} file${added === 1 ? '' : 's'} on this device.`, { tone: 'success' });
  } else if (failed) {
    toast('No files were attached.', { tone: 'danger' });
  }
  return added;
}

function downloadAttachment(url, name) {
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = name || 'attachment';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  if (url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function openAgentTodo(owner) {
  const body = document.createElement('div');
  body.innerHTML = renderAgentTodo(getState(), owner);
  openModal({ title: `${owner} · to-do list`, content: body, confirmLabel: 'Close' });
}

async function copyAgentBrief(owner) {
  try {
    await navigator.clipboard.writeText(agentBrief(getState(), owner));
    toast(`${owner}'s brief copied to the clipboard.`, { tone: 'success' });
  } catch {
    toast('Clipboard access is not available.', { tone: 'danger' });
  }
}

function openRatingProductsDialog() {
  const ratings = getState().ratings;
  const all = ratings?.series ?? [];
  if (!all.length) {
    toast('No rating products are available in this account yet.', { tone: 'danger' });
    return;
  }
  const { hidden } = ratingPreferences(ratings);
  const body = document.createElement('div');
  body.className = 'stack';
  body.innerHTML = `<p class="field-help">Tick the products to show on the chart. Everything selects all products; Save keeps the choice in this account on this device.</p>
    <div class="row-list" data-rating-product-list>${all.map((item) => `<label class="checkbox-row"><input type="checkbox" name="ratingProduct" value="${escAttr(item.name)}"${hidden.has(String(item.name)) ? '' : ' checked'} /><span>${escAttr(item.name)}</span></label>`).join('')}</div>
    <div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-rating-everything>Everything</button><span class="field-help" data-rating-selected aria-live="polite"></span></div>`;
  const boxes = [...body.querySelectorAll('input[name="ratingProduct"]')];
  const count = body.querySelector('[data-rating-selected]');
  const sync = () => {
    if (count) count.textContent = `${boxes.filter((box) => box.checked).length} of ${boxes.length} selected`;
  };
  boxes.forEach((box) => box.addEventListener('change', sync));
  body.querySelector('[data-rating-everything]')?.addEventListener('click', () => {
    boxes.forEach((box) => { box.checked = true; });
    sync();
    boxes[0]?.focus();
  });
  sync();
  openModal({
    title: 'Choose products',
    content: body,
    confirmLabel: 'Save',
    cancelLabel: 'Close',
    onConfirm: async () => {
      const selected = new Set(boxes.filter((box) => box.checked).map((box) => box.value));
      const nextHidden = all.map((item) => String(item.name)).filter((name) => !selected.has(name));
      await saveMeta('ratings', { ...ratings, hidden: nextHidden });
      render();
      toast(`${selected.size} of ${all.length} product${all.length === 1 ? '' : 's'} on the chart.`, { tone: 'success' });
    },
  });
}

async function setRatingLineStyle(value) {
  const ratings = getState().ratings;
  if (!ratings) return;
  const lineStyle = value === 'straight' ? 'straight' : 'smooth';
  if (ratings.lineStyle === lineStyle) return;
  await saveMeta('ratings', { ...ratings, lineStyle });
  render();
  toast(lineStyle === 'straight' ? 'Straight line style saved.' : 'Smooth curve style saved.', { tone: 'success' });
}

async function copyRatingImage() {
  const chart = document.getElementById('rating-chart');
  try {
    const format = await copyChartImage(chart);
    toast(format === 'svg' ? 'Chart SVG copied to the clipboard.' : 'Chart image copied to the clipboard.', { tone: 'success' });
  } catch {
    toast('Copy image is not available in this browser.', { tone: 'danger' });
  }
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
  else if (action === 'open-bug-form') openCreateDialog(bugPrefill(readLocation().query));
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
  else if (action === 'install-app') {
    const choice = await installPrompt.prompt();
    if (!choice) {
      toast('This browser has not offered an install prompt yet. Use the browser menu to install My Platform.', { tone: 'info' });
    } else if (choice.outcome === 'accepted') {
      toast('My Platform was installed on this device.', { tone: 'success' });
    } else {
      toast('Install was dismissed. You can try again from Appearance.', { tone: 'info' });
    }
  } else if (action === 'reset-demo') {
    openModal({ title: 'Reset demo data?', message: 'All changes in the Test account will be replaced by the original demo rows.', confirmLabel: 'Reset', tone: 'danger', onConfirm: () => { resetDemoData(); } });
  } else if (action === 'export-json') exportJsonBackup();
  else if (action === 'import-json') document.querySelector('[data-import-file]')?.click();
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
  } else if (action === 'project-edit') {
    navigate('/projects', { ...(actionEl.dataset.archived === '1' ? { archived: 1 } : {}), edit: id });
  } else if (action === 'project-schedule') {
    const project = getState().projects.find((row) => row.id === id);
    openCreateDialog({ tab: 'event', projectId: project?.id ?? '' });
  } else if (action === 'project-archive') {
    const project = getState().projects.find((row) => row.id === id);
    if (!project) return;
    if (project.archived) {
      await updateProject(id, { archived: 0, status: 'Active' });
      render();
      toast('Project restored.', { tone: 'success' });
    } else {
      openModal({
        title: 'Archive this project?',
        message: 'The project leaves the sidebar and the active list. You can restore it from the Archived tab at any time.',
        confirmLabel: 'Archive',
        onConfirm: async () => {
          await updateProject(id, { archived: 1, status: 'Archived' });
          render();
          toast('Project archived.', { tone: 'success' });
        },
      });
    }
  } else if (action === 'project-delete') {
    openModal({
      title: 'Delete this project?',
      message: 'Only archived projects can be deleted. The project is soft-deleted on this device and stays recoverable in the local database.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        await softDeleteProject(id);
        render();
        toast('Project deleted.', { tone: 'success' });
      },
    });
  } else if (action === 'delete-page') {
    const isSnapshot = actionEl.dataset.snapshot === '1';
    openModal({
      title: isSnapshot ? 'Delete this snapshot?' : 'Delete this page?',
      message: isSnapshot
        ? 'The snapshot page is soft-deleted on this device. Other versions stay in the account. Nothing is deleted automatically.'
        : 'The page is soft-deleted on this device. Other versions stay in the account.',
      confirmLabel: isSnapshot ? 'Delete snapshot' : 'Delete',
      tone: 'danger',
      onConfirm: async () => { await softDeletePage(id); render(); toast(isSnapshot ? 'Snapshot deleted.' : 'Page deleted.', { tone: 'success' }); },
    });
  } else if (action === 'delete-selected-pages') {
    const ids = [...main.querySelectorAll('[data-page-select]:checked')].map((box) => box.value);
    if (!ids.length) {
      syncPageSelection();
      toast('Select at least one page first.', { tone: 'danger' });
      return;
    }
    openModal({
      title: `Delete ${ids.length} page${ids.length === 1 ? '' : 's'}?`,
      message: 'The selected pages are soft-deleted on this device. Their rows stay recoverable in the local database.',
      confirmLabel: `Delete ${ids.length}`,
      tone: 'danger',
      onConfirm: async () => {
        await softDeletePages(ids);
        render();
        toast(`${ids.length} page${ids.length === 1 ? '' : 's'} deleted.`, { tone: 'success' });
      },
    });
  } else if (action === 'delete-event') {
    openModal({ title: 'Delete this event?', message: 'This removes the event from this device.', confirmLabel: 'Delete', tone: 'danger', onConfirm: async () => { await deleteEvent(id); render(); toast('Event deleted.', { tone: 'success' }); } });
  } else if (action === 'delete-selected-bugs') {
    const ids = selectedBugIds();
    if (!ids.length) {
      toast('Select at least one bug first.', { tone: 'danger' });
    } else {
      const count = ids.length;
      openModal({
        title: `Delete ${count} selected bug${count === 1 ? '' : 's'}?`,
        message: 'Selected bugs are soft-deleted on this device: they disappear from the list and its counters, but the stored rows and their history remain in IndexedDB. There is no hard delete.',
        confirmLabel: 'Delete selected',
        tone: 'danger',
        onConfirm: async () => {
          const deleted = await softDeleteBugs(ids);
          render();
          toast(`${deleted} bug${deleted === 1 ? '' : 's'} hidden from the list.`, { tone: 'success' });
        },
      });
    }
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
  } else if (action === 'ai-polish') toast('AI Polish is not connected in this build. No external AI was called.', { tone: 'danger' });
  else if (action === 'print') window.print();
  else if (action === 'open-folder') toast('Folder access is not available in a browser.', { tone: 'danger' });
  else if (action === 'attachment-open') {
    try {
      const url = await attachmentObjectUrl(id);
      if (!url) {
        toast('This attachment has no local file data to open.', { tone: 'danger' });
        return;
      }
      const row = actionEl.closest('[data-attachment-row]');
      const name = row?.querySelector('.row-title')?.textContent ?? 'attachment';
      downloadAttachment(url, name);
    } catch (error) {
      toast(error.message || 'That attachment could not be opened.', { tone: 'danger' });
    }
  } else if (action === 'attachment-remove') {
    try {
      const removed = await removeAttachment(id);
      render();
      toast(removed ? 'Attachment detached. The local file stays in this account.' : 'Attachment was already detached.', { tone: removed ? 'success' : 'info' });
    } catch (error) {
      toast(error.message || 'That attachment could not be removed.', { tone: 'danger' });
    }
  } else if (action === 'fake-download') toast('Attachment placeholder — file storage is a later phase.');
  else if (action === 'fake-download') toast('Attachment placeholder — file storage is a later phase.');
  else if (action === 'rating-choose') openRatingProductsDialog();
  else if (action === 'rating-line-style') await setRatingLineStyle(actionEl.dataset.style);
  else if (action === 'rating-copy') await copyRatingImage();
  else if (action === 'toast-copy') toast('Copied actions are placeholders in this build.');
  else if (action === 'add-dispatch-rule') addDispatchRule(actionEl.closest('form'));
  else if (action === 'remove-dispatch-rule') removeDispatchRule(actionEl);
  else if (action === 'add-area') addAreaChip(actionEl.closest('form'));
  else if (action === 'remove-area') removeAreaChip(actionEl);
  else if (action === 'restore-ai-defaults') {
    const settings = structuredClone(getState().settings);
    settings.aiLimits = { ...AI_LIMIT_DEFAULTS };
    await commitSettings(settings, 'AI limits restored to defaults.');
  } else if (action === 'test-key') toast('Key test is local in this build. No network AI is connected.', { tone: 'success' });
  else if (action === 'fill-gaps') toast('Fill gaps is a local preview. No network AI is connected.');
  else if (action === 'agent-todo') openAgentTodo(actionEl.dataset.owner);
  else if (action === 'close-order') { await closeOrder(id); render(); document.querySelector('.modal-backdrop')?.remove(); toast('Order closed. Reopen it from the agent to-do list.', { tone: 'success' }); }
  else if (action === 'reopen-order') { await reopenOrder(id); render(); document.querySelector('.modal-backdrop')?.remove(); toast('Order reopened and back on the agent To-do list.', { tone: 'success' }); }
  else if (action === 'copy-brief') await copyAgentBrief(actionEl.dataset.owner);
  else if (action === 'open-queue-file') toast('Queue files are not available in browser. Orders stay in this account on this device.', { tone: 'danger' });
  else if (action === 'focus-add-project') document.getElementById('add-project-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  else if (action === 'apply-palette') {
    const card = actionEl.closest('[data-palette]');
    const form = actionEl.closest('form[data-form="settings-appearance"]');
    if (card && form && PALETTE_BY_ID.has(card.dataset.palette)) {
      form.querySelector('[data-theme-preset]').value = card.dataset.palette;
      markSettingsDirty(form);
      syncAppearanceForm(form);
    }
  } else if (action === 'reset-theme') {
    const settings = structuredClone(getState().settings);
    settings.appearance = { ...DEFAULT_APPEARANCE };
    await saveSettings(settings);
    applyAppearance(settings);
    render();
    toast('Default look restored.', { tone: 'success' });
  }
});

document.addEventListener('input', (event) => {
  const source = event.target.closest?.('[data-page-preview-source]');
  if (source) {
    const preview = main.querySelector('[data-page-preview]');
    if (preview) preview.innerHTML = markdown(source.value);
  }
  const form = event.target.closest('form[data-settings-form]');
  if (form) markSettingsDirty(form);
  if (form?.dataset.form === 'settings-appearance') {
    if (event.target.name === 'primary') form.querySelector('[data-theme-preset]').value = '';
    syncAppearanceForm(form);
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.closest('[data-select-all-pages]')) {
    for (const box of main.querySelectorAll('[data-page-select]')) box.checked = event.target.checked;
    syncPageSelection();
    return;
  }
  if (event.target.closest('[data-page-select]')) {
    syncPageSelection();
    return;
  }
  const attachmentInput = event.target.closest('[data-attachment-input]');
  if (attachmentInput) {
    await addAttachmentFiles(attachmentZone(attachmentInput), attachmentInput.files, 'Attached');
    attachmentInput.value = '';
    return;
  }
  const importFile = event.target.closest('[data-import-file]');
  if (importFile) {
    await importJsonFile(importFile);
    return;
  }
  const settingsForm = event.target.closest('form[data-settings-form]');
  if (settingsForm) markSettingsDirty(settingsForm);
  if (settingsForm?.dataset.form === 'settings-appearance') syncAppearanceForm(settingsForm);
  const selectAllBugs = event.target.closest('[data-select-all-bugs]');
  if (selectAllBugs) {
    document.querySelectorAll('[data-bug-select]').forEach((box) => { box.checked = selectAllBugs.checked; });
    syncBugSelection();
  }
  const oneBug = event.target.closest('[data-bug-select]');
  if (oneBug) syncBugSelection();
  const move = event.target.closest('[data-move-task]');
  if (move) {
    const state = getState();
    const task = state.tasks.find((row) => row.id === move.dataset.moveTask);
    const check = canMoveToColumn(state, task, move.value);
    if (!check.ok) {
      render();
      toast(check.reason, { tone: 'danger' });
      return;
    }
    if (check.noop) {
      render();
      return;
    }
    try {
      await transitionTask(task.id, { to: check.target ?? check.workflow, as: check.actor });
      render();
      toast('Task moved.', { tone: 'success' });
    } catch (error) {
      render();
      toast(error.message, { tone: 'danger' });
    }
    return;
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

document.addEventListener('dragover', (event) => {
  const zone = event.target.closest?.('[data-attachment-dropzone]');
  if (!zone) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  zone.classList.add('is-dragover');
});

document.addEventListener('dragleave', (event) => {
  const zone = event.target.closest?.('[data-attachment-dropzone]');
  if (!zone || zone.contains(event.relatedTarget)) return;
  zone.classList.remove('is-dragover');
});

document.addEventListener('drop', async (event) => {
  const zone = event.target.closest?.('[data-attachment-dropzone]');
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove('is-dragover');
  await addAttachmentFiles(attachmentZone(zone), filesFromTransfer(event.dataTransfer), 'Dropped');
});

// Paste anywhere on a task/bug detail page. Files found on the clipboard are
// saved to IndexedDB; plain text pasting keeps its normal textarea behaviour.
document.addEventListener('paste', async (event) => {
  const files = filesFromTransfer(event.clipboardData);
  if (!files.length) return;
  const zone = attachmentZone(event.target) ?? document.querySelector('[data-attachments]');
  if (!zone) return;
  event.preventDefault();
  await addAttachmentFiles(zone, files, 'Pasted');
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
    } else if (form.dataset.form === 'project-edit') {
      const updated = await updateProject(data.id, {
        key: String(data.key ?? '').trim().toUpperCase(),
        name: String(data.name ?? '').trim(),
        description: String(data.description ?? '').trim(),
        owner: String(data.owner ?? '').trim(),
        status: data.status || 'Active',
        start: data.start || '',
        due: data.due || '',
        keywords: String(data.keywords ?? '').trim(),
      });
      if (data.from === 'detail') navigate(`/project/${updated.key}`);
      else navigate('/projects', data.archived === '1' ? { archived: 1 } : {});
      toast('Project saved on this device.', { tone: 'success' });
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
    } else if (form.dataset.form === 'bug-title' || form.dataset.form === 'bug-details' || form.dataset.form === 'bug-fields') {
      const fields = (form.dataset.history || '').split(',').map((field) => field.trim()).filter(Boolean);
      const patch = {};
      for (const field of fields) patch[field] = data[field] ?? '';
      await updateBug(data.id, patch, fields);
      await rerender();
      toast('Bug saved on this device.', { tone: 'success' });
    } else if (form.dataset.form === 'bug-comment') {
      await addBugComment(data.id, data.body);
      await rerender();
      toast('Comment saved on this device.', { tone: 'success' });
    } else if (form.dataset.form === 'task-workflow') {
      const moved = await transitionTask(data.id, { to: data.to, as: data.as, reason: data.reason });
      await rerender();
      toast(`${moved.key} moved to ${moved.workflow}.`, { tone: 'success' });
    } else if (form.dataset.form === 'bug-workflow') {
      const moved = await transitionBug(data.id, {
        to: data.to,
        as: data.as,
        reason: data.reason,
        duplicate_of: data.duplicate_of,
      });
      await rerender();
      toast(`${moved.key} moved to ${moved.status}.`, { tone: 'success' });
    } else if (form.dataset.form === 'order') {
      await createOrder(data.owner, data.text);
      await rerender();
      toast('Order sent.', { tone: 'success' });
    } else if (form.dataset.form === 'settings-ai') {
      const settings = structuredClone(getState().settings);
      settings.ai = { ...settings.ai, key: data.key, model: data.model, timeout: numericSetting(data.timeout, 90), status: 'Connected' };
      setSettingsFormState(form, false);
      await commitSettings(settings, 'AI settings saved on this device.');
    } else if (form.dataset.form === 'settings-limits') {
      const settings = structuredClone(getState().settings);
      settings.aiLimits = Object.fromEntries(Object.keys(AI_LIMIT_DEFAULTS).map((key) => [key, numericSetting(data[key], AI_LIMIT_DEFAULTS[key])]));
      setSettingsFormState(form, false);
      await commitSettings(settings, 'AI limits saved on this device.');
    } else if (form.dataset.form === 'settings-language') {
      const settings = structuredClone(getState().settings);
      settings.language = { primary: data.primary, secondary: data.secondary, rule: data.rule };
      setSettingsFormState(form, false);
      await commitSettings(settings, 'Language rules saved on this device.');
    } else if (form.dataset.form === 'settings-dispatch') {
      const settings = structuredClone(getState().settings);
      const rules = [...form.querySelectorAll('[data-dispatch-rule]')].map((row) => ({
        keyword: (row.querySelector('input[name^="rule-key-"]')?.value ?? '').trim(),
        owner: row.querySelector('select[name^="rule-owner-"]')?.value || data.defaultOwner,
      })).filter((rule) => rule.keyword);
      settings.dispatch = { defaultOwner: data.defaultOwner, rules };
      setSettingsFormState(form, false);
      await commitSettings(settings, 'Dispatch rules saved on this device.');
    } else if (form.dataset.form === 'settings-areas') {
      const settings = structuredClone(getState().settings);
      settings.areas = { options: parseAreaNames(data.options), fallback: String(data.fallback ?? '').trim() || 'NA' };
      setSettingsFormState(form, false);
      await commitSettings(settings, 'Areas saved on this device.');
    } else if (form.dataset.form === 'settings-appearance') {
      const settings = structuredClone(getState().settings);
      settings.appearance = appearanceFromForm(form);
      setSettingsFormState(form, false);
      await commitSettings(settings, 'Theme saved on this device.', { appearance: true });
    } else if (form.dataset.form === 'page-save') {
      const title = String(data.title ?? '').trim();
      if (!title) {
        toast('A page title is required.', { tone: 'danger' });
        form.elements.title?.focus();
        return;
      }
      data.title = title;
      const page = data.id ? await updatePage(data.id, { title, projectId: data.projectId, tags: data.tags, body: data.body }) : await createPage(data);
      navigate(`/page/${page.id}`);
      toast('Page saved. The previous version is in the revision history.', { tone: 'success' });
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

let draggedProjectId = null;
let projectDropRow = null;
let projectDropAfter = false;

function clearProjectDragState() {
  main.querySelectorAll('.project-row.is-dragging, .project-row.is-drop-target, .project-row.is-drop-after').forEach((row) => {
    row.classList.remove('is-dragging', 'is-drop-target', 'is-drop-after');
  });
  draggedProjectId = null;
  projectDropRow = null;
  projectDropAfter = false;
}

document.addEventListener('dragstart', (event) => {
  const row = event.target.closest?.('[data-project-row][draggable="true"]');
  if (!row) return;
  draggedProjectId = row.dataset.projectId;
  row.classList.add('is-dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    try { event.dataTransfer.setData('text/plain', draggedProjectId); } catch { /* Drag data is optional. */ }
  }
});

document.addEventListener('dragover', (event) => {
  if (!draggedProjectId) return;
  const row = event.target.closest?.('[data-project-row][draggable="true"]');
  if (!row || row.dataset.projectId === draggedProjectId) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const rect = row.getBoundingClientRect();
  projectDropAfter = event.clientY > rect.top + rect.height / 2;
  if (projectDropRow && projectDropRow !== row) projectDropRow.classList.remove('is-drop-target', 'is-drop-after');
  projectDropRow = row;
  row.classList.toggle('is-drop-target', !projectDropAfter);
  row.classList.toggle('is-drop-after', projectDropAfter);
});

document.addEventListener('dragleave', (event) => {
  const row = event.target.closest?.('[data-project-row]');
  if (!row || row !== projectDropRow) return;
  row.classList.remove('is-drop-target', 'is-drop-after');
  projectDropRow = null;
});

document.addEventListener('drop', async (event) => {
  if (!draggedProjectId) return;
  const row = event.target.closest?.('[data-project-row][draggable="true"]');
  if (!row) return;
  event.preventDefault();
  const movedId = draggedProjectId;
  const targetId = row.dataset.projectId;
  const dropAfter = projectDropAfter;
  const ids = [...main.querySelectorAll('[data-project-row][draggable="true"]')].map((item) => item.dataset.projectId);
  clearProjectDragState();
  if (movedId === targetId) return;
  const from = ids.indexOf(movedId);
  if (from < 0 || !ids.includes(targetId)) return;
  ids.splice(from, 1);
  const insertAt = ids.indexOf(targetId) + (dropAfter ? 1 : 0);
  ids.splice(insertAt, 0, movedId);
  try {
    await reorderProjects(ids);
    render();
    toast('Project order saved on this device.', { tone: 'success' });
  } catch (error) {
    toast(error.message || 'Could not save the project order.', { tone: 'danger' });
  }
});

document.addEventListener('dragend', clearProjectDragState);

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
  const commentBox = event.target.closest?.('#tskComment, #task-progress-comment, #bgComment');
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
startPwa({ onUpdate: offerUpdate });
boot();
