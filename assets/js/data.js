import {
  openAccountDb,
  getAll,
  getOne,
  putRecord,
  putRecords,
  clearAllStores,
  nowIso,
  newId,
} from './db.js';
import { buildDemoData, demoSettings, DEMO_VERSION } from './demo-data.js';

const DEFAULT_SETTINGS = {
  ...structuredClone(demoSettings),
  ai: { status: 'Not configured', model: 'deepseek-v4-pro', timeout: 90, key: '' },
  dispatch: { defaultOwner: 'Dispatcher', rules: [] },
};

let currentAccount = null;
let state = null;

function live(rows) {
  return rows.filter((row) => !row.deletedAt);
}

function nextNumber(rows, field) {
  return rows.reduce((max, row) => {
    const value = Number(String(row[field] ?? '').replace(/\D/g, ''));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

export async function start(account) {
  currentAccount = account;
  await openAccountDb(account.id);
  if (account.test) await seedDemo(false);
  state = await readState();
  return state;
}

async function seedDemo(force) {
  const version = await getOne('meta', 'seedVersion');
  if (!force && version?.value === DEMO_VERSION) return;
  const demo = buildDemoData();
  await clearAllStores();
  for (const [storeName, records] of Object.entries(demo.stores)) {
    await putRecords(
      storeName,
      structuredClone(records).map((record) => ({ ...record, updatedAt: record.updatedAt ?? nowIso(), deletedAt: record.deletedAt ?? null }))
    );
  }
  for (const [key, value] of Object.entries(demo.meta)) {
    await putRecord('meta', { key, value: structuredClone(value), updatedAt: nowIso() });
  }
}

export async function resetDemo() {
  if (!currentAccount?.test) throw new Error('Only the Test account has demo data.');
  await seedDemo(true);
  state = await readState();
  return state;
}

export async function refresh() {
  state = await readState();
  return state;
}

async function readState() {
  const [tasks, taskHistory, taskComments, bugs, bugHistory, bugComments, events, projects, pages, aiCalls, team, orders, metaRows] = await Promise.all([
    getAll('tasks'), getAll('task_history'), getAll('task_comments'), getAll('bugs'),
    getAll('bug_history'), getAll('bug_comments'), getAll('events'), getAll('projects'),
    getAll('pages'), getAll('ai_calls'), getAll('team'), getAll('orders'), getAll('meta'),
  ]);
  const meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
  return {
    account: currentAccount,
    tasks: live(tasks).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    taskHistory: live(taskHistory),
    taskComments: live(taskComments),
    bugs: live(bugs).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    bugHistory: live(bugHistory),
    bugComments: live(bugComments),
    events: live(events).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    projects: live(projects).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
    pages: live(pages).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    aiCalls: live(aiCalls).sort((a, b) => b.time.localeCompare(a.time)),
    team: live(team),
    orders: live(orders),
    settings: meta.settings ?? structuredClone(DEFAULT_SETTINGS),
    ratings: meta.ratings ?? null,
    seeded: meta.seedVersion ?? null,
  };
}

export function getState() {
  return state;
}

export function getAccount() {
  return currentAccount;
}

export async function createTask(input) {
  const number = nextNumber(state.tasks, 'key');
  const now = nowIso();
  const task = {
    id: newId('task'), key: `T-${number}`, title: input.title, projectId: input.projectId || null,
    status: input.status || 'To do', workflow: input.workflow || 'New', priority: input.priority || 'Medium',
    owner: input.owner || 'Dispatcher', due: input.due || '', start: input.start || '',
    module: input.module || 'General', component: input.component || 'work desk',
    severity: input.severity || 'S3 Major', type: input.type || 'Task',
    description: input.description || '', expected: input.expected || '', actual: input.actual || '',
    attachments: [], notes: input.notes || '', parentId: input.parentId || null,
    reviewed: false, pendingDecision: false, createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('tasks', task);
  await putRecord('task_history', { id: newId('th'), taskId: task.id, at: now, who: 'Amara', field: 'created', old: '', new: task.key, updatedAt: now, deletedAt: null });
  state = await readState();
  return task;
}

export async function updateTask(id, patch, historyField = '') {
  const task = state.tasks.find((row) => row.id === id);
  if (!task) throw new Error('Task not found.');
  const now = nowIso();
  const updated = { ...task, ...patch, updatedAt: now };
  await putRecord('tasks', updated);
  if (historyField && patch[historyField] !== undefined && patch[historyField] !== task[historyField]) {
    await putRecord('task_history', {
      id: newId('th'), taskId: id, at: now, who: 'Amara', field: historyField,
      old: String(task[historyField] ?? ''), new: String(patch[historyField] ?? ''),
      updatedAt: now, deletedAt: null,
    });
  }
  state = await readState();
  return updated;
}

export async function addTaskComment(id, body) {
  const now = nowIso();
  await putRecord('task_comments', { id: newId('tc'), taskId: id, at: now, who: 'Amara', body, real: false, updatedAt: now, deletedAt: null });
  state = await readState();
}

export async function createBug(input) {
  const number = nextNumber(state.bugs, 'key');
  const now = nowIso();
  const due = new Date();
  if (input.severity === 'S1 Blocker') due.setDate(due.getDate() + 0);
  else if (input.severity === 'S2 Critical') due.setDate(due.getDate() + 2);
  else if (input.severity === 'S3 Major') due.setDate(due.getDate() + 5);
  const bug = {
    id: newId('bug'), key: `WD-${number}`, title: input.title, status: 'New',
    severity: input.severity || 'S3 Major', priority: input.priority || 'Medium',
    assignee: input.assignee || 'Dispatcher', component: input.component || 'other',
    due: input.severity === 'S4 Minor' ? '' : due.toISOString().slice(0, 10),
    type: 'Bug', reporter: 'Amara', description: input.description || '',
    repro: input.repro || '', expected: input.expected || '', actual: input.actual || '',
    labels: input.labels || '', found_in: input.found_in || '', fix_in: '',
    environment: input.environment || '', links: '', linked_task: '', resolution: '',
    attachments: [], createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('bugs', bug);
  await putRecord('bug_history', { id: newId('bh'), bugId: bug.id, at: now, who: 'Amara', field: 'created', old: '', new: bug.key, updatedAt: now, deletedAt: null });
  state = await readState();
  return bug;
}

export async function updateBug(id, patch, historyField = '') {
  const bug = state.bugs.find((row) => row.id === id);
  if (!bug) throw new Error('Bug not found.');
  const now = nowIso();
  const updated = { ...bug, ...patch, updatedAt: now };
  await putRecord('bugs', updated);
  if (historyField && patch[historyField] !== undefined && patch[historyField] !== bug[historyField]) {
    await putRecord('bug_history', {
      id: newId('bh'), bugId: id, at: now, who: 'Amara', field: historyField,
      old: String(bug[historyField] ?? ''), new: String(patch[historyField] ?? ''),
      updatedAt: now, deletedAt: null,
    });
  }
  state = await readState();
  return updated;
}

export async function addBugComment(id, body) {
  const now = nowIso();
  await putRecord('bug_comments', { id: newId('bc'), bugId: id, at: now, author: 'Amara', body, updatedAt: now, deletedAt: null });
  state = await readState();
}

export async function createEvent(input) {
  const now = nowIso();
  const event = {
    id: newId('event'), date: input.date, time: input.time || '', end: input.end || '',
    title: input.title, kind: input.kind || 'Reminder', note: input.note || '',
    link: input.link || '', repeat: input.repeat || '', until: input.until || '',
    remind: input.remind || '5', projectId: input.projectId || '', taskId: input.taskId || '',
    createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('events', event);
  state = await readState();
  return event;
}

export async function deleteEvent(id) {
  const event = state.events.find((row) => row.id === id);
  if (!event) return;
  await putRecord('events', { ...event, deletedAt: nowIso(), updatedAt: nowIso() });
  state = await readState();
}

export async function createPage(input) {
  const now = nowIso();
  const page = {
    id: newId('page'), title: input.title, type: input.type || 'Page',
    projectId: input.projectId || '', taskId: input.taskId || '', author: 'Amara',
    body: input.body || '', createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('pages', page);
  state = await readState();
  return page;
}

export async function updatePage(id, input) {
  const page = state.pages.find((row) => row.id === id);
  if (!page) throw new Error('Page not found.');
  const updated = { ...page, ...input, updatedAt: nowIso() };
  await putRecord('pages', updated);
  state = await readState();
  return updated;
}

export async function softDeletePage(id) {
  const page = state.pages.find((row) => row.id === id);
  if (!page) return;
  await putRecord('pages', { ...page, deletedAt: nowIso(), updatedAt: nowIso() });
  state = await readState();
}

export async function createProject(input) {
  const now = nowIso();
  const project = {
    id: newId('project'), key: (input.key || 'NEW').toUpperCase(), name: input.name,
    description: input.description || '', owner: input.owner || 'Amara',
    status: input.status || 'Active', start: input.start || '', due: input.due || '',
    keywords: input.keywords || '', archived: 0, sort: state.projects.length + 1,
    createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('projects', project);
  state = await readState();
  return project;
}

export async function updateProject(id, patch) {
  const project = state.projects.find((row) => row.id === id);
  if (!project) throw new Error('Project not found.');
  const updated = { ...project, ...patch, updatedAt: nowIso() };
  await putRecord('projects', updated);
  state = await readState();
  return updated;
}

export async function createOrder(owner, text) {
  const now = nowIso();
  await putRecord('orders', { id: newId('order'), owner, text, open: true, createdAt: now, updatedAt: now, deletedAt: null });
  state = await readState();
}

export async function closeOrder(id) {
  const order = state.orders.find((row) => row.id === id);
  if (!order) return;
  await putRecord('orders', { ...order, open: false, updatedAt: nowIso() });
  state = await readState();
}

export async function saveSettings(settings) {
  await putRecord('meta', { key: 'settings', value: settings, updatedAt: nowIso() });
  state = await readState();
}

export async function saveMeta(key, value) {
  await putRecord('meta', { key, value, updatedAt: nowIso() });
  state = await readState();
}
