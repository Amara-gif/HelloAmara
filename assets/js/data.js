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
import { buildDemoData, demoSettings, DEMO_VERSION, AI_LIMIT_DEFAULTS } from './demo-data.js';

// The seeded demo and Restore defaults read the same frozen limit object.
export { AI_LIMIT_DEFAULTS };

export const BUG_SEVERITIES = ['S1 Blocker', 'S2 Critical', 'S3 Major', 'S4 Minor'];
const BUG_SLA_DAYS = { 'S1 Blocker': 0, 'S2 Critical': 2, 'S3 Major': 5, 'S4 Minor': null };

// Bug detail uses the eleven workflow statuses directly on the bug row. The
// transition map is the inventory's TRANSITIONS table, shared by the bug and
// task detail workflows.
export const BUG_STATUSES = ['New', 'Triaged', 'In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Duplicate', 'Wont fix', 'Deferred', 'Rejected'];
export const BUG_TRANSITIONS = {
  New: ['Triaged', 'Duplicate', 'Rejected', 'Deferred'],
  Triaged: ['In progress', 'Duplicate', 'Rejected', 'Deferred', 'Wont fix'],
  'In progress': ['Fixed', 'Duplicate', 'Deferred', 'Wont fix'],
  Fixed: ['Verified', 'Reopened'],
  Verified: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['Triaged', 'In progress', 'Fixed', 'Duplicate', 'Wont fix', 'Deferred'],
  Duplicate: ['Reopened'],
  'Wont fix': ['Reopened'],
  Deferred: ['Reopened'],
  Rejected: ['Reopened'],
};
export const BUG_WORKFLOW_TRANSITIONS = BUG_TRANSITIONS;
export const TRANSITIONS = BUG_TRANSITIONS;
export const BUG_WORKFLOW_STATUSES = BUG_STATUSES;
export const BUG_QA_ONLY_STATUSES = ['Verified', 'Closed'];
export const BUG_WAIVER_STATUSES = ['Duplicate', 'Wont fix', 'Rejected'];
export const BUG_REASON_REQUIRED_STATUSES = ['Wont fix', 'Rejected', 'Deferred', 'Reopened'];

const BUG_STATUS_ALIASES = {
  open: 'New',
  'to do': 'New',
  todo: 'New',
  'to-do': 'New',
  'in progress': 'In progress',
  'in-progress': 'In progress',
  'in review': 'Fixed',
  'to qa': 'Fixed',
  waiting: 'Fixed',
  resolved: 'Verified',
  done: 'Closed',
  'won\'t fix': 'Wont fix',
  'won’t fix': 'Wont fix',
  'wont fix': 'Wont fix',
  wontfix: 'Wont fix',
};

export function normalizeBugStatus(status) {
  const raw = String(status ?? '').trim();
  if (!raw) return '';
  const exact = BUG_STATUSES.find((value) => value.toLowerCase() === raw.toLowerCase());
  return exact ?? BUG_STATUS_ALIASES[raw.toLowerCase()] ?? raw;
}

export function bugWorkflowTargets(bugOrStatus) {
  const current = typeof bugOrStatus === 'string'
    ? normalizeBugStatus(bugOrStatus)
    : normalizeBugStatus(bugOrStatus?.status);
  return [...(BUG_TRANSITIONS[current] ?? [])];
}

export const bugTransitionTargets = bugWorkflowTargets;
export const bugTransitionsFor = bugWorkflowTargets;

function bugFixer(bug, state) {
  const explicit = String(bug?.fixer ?? bug?.fixedBy ?? bug?.fixed_by ?? '').trim();
  if (explicit) return explicit;
  const history = state?.bugHistory ?? state?.bug_history ?? [];
  const fixedMoves = history
    .filter((row) => row.bugId === bug?.id && normalizeBugStatus(row.new) === 'Fixed')
    .sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
  return String(fixedMoves[fixedMoves.length - 1]?.who ?? bug?.assignee ?? '').trim();
}

export function checkBugTransition(bug, to, options = {}) {
  if (!bug) return { ok: false, reason: 'Bug not found.' };
  const opts = typeof options === 'string' ? { as: options } : options;
  const target = normalizeBugStatus(to);
  const current = normalizeBugStatus(bug.status);
  const allowed = bugWorkflowTargets(bug);
  if (!BUG_STATUSES.includes(target)) {
    return { ok: false, current, target, allowed, reason: `Unknown bug status “${String(to ?? '')}”.` };
  }
  if (!allowed.includes(target)) {
    return {
      ok: false, current, target, allowed,
      reason: `Cannot move from ${current} to ${target}. Legal targets: ${allowed.join(', ') || 'none'}.`,
    };
  }
  const actor = String(opts.as ?? opts.actingAs ?? opts.who ?? '').trim();
  const fixer = bugFixer(bug, opts.state);
  if (target === 'Verified' && actor && fixer && actorMatches(actor, [fixer])) {
    return {
      ok: false, current, target, allowed, actor, fixer,
      reason: 'A fixer cannot Verify their own fix; only QA can set Verified. Ask another QA to verify it.',
    };
  }
  if (BUG_QA_ONLY_STATUSES.includes(target) && !isQaActor(opts.state, actor)) {
    return { ok: false, current, target, allowed, actor, reason: `Only QA can move a bug to ${target}. Set As to QA.` };
  }
  if (BUG_WAIVER_STATUSES.includes(target) && !isWaiverActor(opts.state, actor)) {
    return { ok: false, current, target, allowed, actor, reason: `${target} needs Amara, QA or Steward acting on the move.` };
  }
  const reason = String(opts.reason ?? '').trim();
  if (BUG_REASON_REQUIRED_STATUSES.includes(target) && !reason) {
    return { ok: false, current, target, allowed, actor, reason: `A reason is required to move to ${target}.` };
  }
  return { ok: true, current, target, allowed, actor, reason, storedStatus: target };
}

// Accept both the stored label ("S2 Critical") and the short form ("S2") that
// report-a-bug links use. Unknown values fall back to the S3 default.
export function normalizeBugSeverity(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'S3 Major';
  const short = /^S([1-4])\b/i.exec(raw);
  if (short) return BUG_SEVERITIES[Number(short[1]) - 1];
  return BUG_SEVERITIES.find((severity) => severity.toLowerCase() === raw.toLowerCase()) ?? 'S3 Major';
}

// SLA due dates are calendar-day offsets from the local day, not UTC timestamps.
export function bugSlaDue(severity, baseDate = new Date()) {
  const days = BUG_SLA_DAYS[normalizeBugSeverity(severity)];
  if (days === null) return '';
  const due = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  due.setDate(due.getDate() + days);
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

export const DEFAULT_SETTINGS = {
  ...structuredClone(demoSettings),
  ai: { status: 'Not configured', model: 'deepseek-v4-pro', timeout: 90, key: '' },
  dispatch: { defaultOwner: 'Dispatcher', rules: [] },
};

const STORAGE_PERSIST_META = {
  granted: 'storagePersist',
  supported: 'storagePersistSupported',
  checkedAt: 'storagePersistCheckedAt',
};

// The task detail page exposes the eleven workflow statuses while the task row
// still stores one of the four board statuses. Only a workflow whose class
// matches the stored status is trusted; otherwise the stored status wins.
export const TASK_WORKFLOW_STATUSES = ['New', 'Triaged', 'In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Deferred', 'Wont fix', 'Duplicate', 'Rejected'];
export const TASK_WORKFLOW_CLASS = {
  New: 'To do',
  Triaged: 'To do',
  Reopened: 'To do',
  Deferred: 'To do',
  'In progress': 'In progress',
  Fixed: 'Waiting',
  Verified: 'Done',
  Closed: 'Done',
  Duplicate: 'Done',
  'Wont fix': 'Done',
  Rejected: 'Done',
};
export const TASK_WORKFLOW_TRANSITIONS = {
  New: ['Triaged', 'Duplicate', 'Rejected', 'Deferred'],
  Triaged: ['In progress', 'Duplicate', 'Rejected', 'Deferred', 'Wont fix'],
  'In progress': ['Fixed', 'Duplicate', 'Deferred', 'Wont fix'],
  Fixed: ['Verified', 'Reopened'],
  Verified: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['Triaged', 'In progress', 'Fixed', 'Duplicate', 'Wont fix', 'Deferred'],
  Duplicate: ['Reopened'],
  'Wont fix': ['Reopened'],
  Deferred: ['Reopened'],
  Rejected: ['Reopened'],
};
export const TASK_QA_ONLY_STATUSES = ['Verified', 'Closed'];
export const TASK_WAIVER_STATUSES = ['Duplicate', 'Wont fix', 'Rejected'];
export const TASK_REASON_REQUIRED_STATUSES = ['Wont fix', 'Rejected', 'Deferred', 'Reopened'];
export const TASK_WAIVER_ACTORS = ['Amara', 'QA', 'Steward'];

const DEFAULT_WORKFLOW_BY_STATUS = {
  'To do': 'New',
  'In progress': 'In progress',
  Waiting: 'Fixed',
  Done: 'Closed',
};
const STORED_STATUS_ALIASES = {
  'to do': 'To do',
  todo: 'To do',
  'to-do': 'To do',
  'in progress': 'In progress',
  'in-progress': 'In progress',
  waiting: 'Waiting',
  done: 'Done',
};
const WORKFLOW_ALIASES = {
  open: 'New',
  'to qa': 'Fixed',
  'in review': 'Fixed',
  resolved: 'Verified',
  'won\'t fix': 'Wont fix',
};

function normalizeStoredStatus(status) {
  const raw = String(status ?? '').trim();
  if (!raw) return '';
  if (DEFAULT_WORKFLOW_BY_STATUS[raw]) return raw;
  return STORED_STATUS_ALIASES[raw.toLowerCase()] ?? '';
}

export function normalizeWorkflowStatus(status) {
  const raw = String(status ?? '').trim();
  if (!raw) return '';
  const exact = TASK_WORKFLOW_STATUSES.find((value) => value.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const alias = WORKFLOW_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const stored = normalizeStoredStatus(raw);
  return stored ? DEFAULT_WORKFLOW_BY_STATUS[stored] : raw;
}

export function workflowForStoredStatus(status, workflow) {
  const stored = normalizeStoredStatus(status);
  const candidate = normalizeWorkflowStatus(workflow);
  if (candidate && (!stored || TASK_WORKFLOW_CLASS[candidate] === stored)) return candidate;
  return DEFAULT_WORKFLOW_BY_STATUS[stored] ?? 'New';
}

export function workflowForTask(task) {
  return workflowForStoredStatus(task?.status, task?.workflow);
}

export function taskWorkflowTargets(taskOrWorkflow, maybeWorkflow) {
  let current;
  if (typeof taskOrWorkflow === 'string' && maybeWorkflow === undefined) {
    const stored = normalizeStoredStatus(taskOrWorkflow);
    current = stored ? workflowForStoredStatus(stored, '') : normalizeWorkflowStatus(taskOrWorkflow);
  } else if (typeof taskOrWorkflow === 'string') {
    current = workflowForStoredStatus(taskOrWorkflow, maybeWorkflow);
  } else {
    current = workflowForTask(taskOrWorkflow);
  }
  return [...(TASK_WORKFLOW_TRANSITIONS[current] ?? [])];
}

function actorMatches(actor, allowed) {
  const value = String(actor ?? '').trim().toLowerCase();
  return Boolean(value) && allowed.some((entry) => entry.toLowerCase() === value);
}

export function isQaActor(state, actor) {
  const value = String(actor ?? '').trim();
  if (!value) return false;
  if (/^qa$/i.test(value)) return true;
  return (state?.team ?? []).some((agent) => (
    String(agent?.name ?? '').trim().toLowerCase() === value.toLowerCase()
    && /^qa$/i.test(String(agent?.role ?? '').trim())
  ));
}

export function isWaiverActor(state, actor) {
  const value = String(actor ?? '').trim();
  if (!value) return false;
  if (actorMatches(value, TASK_WAIVER_ACTORS)) return true;
  return (state?.team ?? []).some((agent) => (
    String(agent?.name ?? '').trim().toLowerCase() === value.toLowerCase()
    && TASK_WAIVER_ACTORS.some((role) => role.toLowerCase() === String(agent?.role ?? '').trim().toLowerCase())
  ));
}

export function attachmentsFingerprint(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  return JSON.stringify(list.map((file) => {
    if (typeof file === 'string') return { name: file, kind: '', size: '' };
    return {
      name: String(file?.name ?? ''),
      kind: String(file?.kind ?? file?.type ?? ''),
      size: String(file?.size ?? ''),
      url: String(file?.url ?? file?.href ?? ''),
    };
  }));
}

export function taskReviewFingerprint(task) {
  return String(task?.reviewFingerprint ?? task?.review?.fingerprint ?? '');
}

export function checkTaskTransition(task, to, options = {}) {
  if (!task) return { ok: false, reason: 'Task not found.' };
  const opts = typeof options === 'string' ? { as: options } : options;
  const target = normalizeWorkflowStatus(to);
  const current = workflowForTask(task);
  const allowed = taskWorkflowTargets(task);
  if (!TASK_WORKFLOW_STATUSES.includes(target)) {
    return { ok: false, current, target, allowed, reason: `Unknown workflow status “${String(to ?? '')}”.` };
  }
  if (!allowed.includes(target)) {
    return {
      ok: false, current, target, allowed,
      reason: `Cannot move from ${current} to ${target}. Legal targets: ${allowed.join(', ') || 'none'}.`,
    };
  }
  const actor = opts.as ?? opts.actingAs ?? opts.who ?? '';
  if (TASK_QA_ONLY_STATUSES.includes(target) && !isQaActor(opts.state, actor)) {
    return { ok: false, current, target, allowed, reason: `Only QA can move a work item to ${target}. Set As to QA.` };
  }
  if (TASK_WAIVER_STATUSES.includes(target) && !isWaiverActor(opts.state, actor)) {
    return { ok: false, current, target, allowed, reason: `${target} needs Amara, QA or Steward acting on the move.` };
  }
  const reason = String(opts.reason ?? '').trim();
  if (TASK_REASON_REQUIRED_STATUSES.includes(target) && !reason) {
    return { ok: false, current, target, allowed, reason: `A reason is required to move to ${target}.` };
  }
  return { ok: true, current, target, allowed, reason, storedStatus: TASK_WORKFLOW_CLASS[target] };
}

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
  await requestPersistentStorage();
  state = await readState();
  return state;
}

// Ask the browser for exempt-from-eviction storage and keep the answer per account.
async function requestPersistentStorage() {
  const storage = globalThis.navigator?.storage;
  const supported = typeof storage?.persist === 'function';
  let granted = false;
  if (supported) {
    try {
      granted = (await storage.persist()) === true;
    } catch {
      granted = false;
    }
  }
  const checkedAt = nowIso();
  await putRecord('meta', { key: STORAGE_PERSIST_META.granted, value: granted, updatedAt: checkedAt });
  await putRecord('meta', { key: STORAGE_PERSIST_META.supported, value: supported, updatedAt: checkedAt });
  await putRecord('meta', { key: STORAGE_PERSIST_META.checkedAt, value: checkedAt, updatedAt: checkedAt });
  return { supported, granted, checkedAt };
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
  const supported = meta[STORAGE_PERSIST_META.supported] === true;
  const granted = meta[STORAGE_PERSIST_META.granted] === true;
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
    issueCounts: meta.issueCounts ?? null,
    seeded: meta.seedVersion ?? null,
    persistentStorage: {
      supported,
      granted,
      checkedAt: meta[STORAGE_PERSIST_META.checkedAt] ?? null,
      status: supported ? (granted ? 'Granted' : 'Denied') : 'Unsupported',
    },
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
    description: input.description || '', repro: input.repro || '', expected: input.expected || '',
    actual: input.actual || '', attachments: [], notes: input.notes || '', parentId: input.parentId || null,
    end: input.end || input.due || '', depends_on: input.depends_on || input.dependsOn || '', milestone: input.milestone || '',
    reviewed: false, pendingDecision: false, review: null, reviewDecision: '', reviewBy: '',
    reviewAt: '', reviewFingerprint: '', reviewStale: false, reviewComment: '',
    createdAt: now, updatedAt: now, deletedAt: null,
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

  // A review covers the exact deliverables it was recorded against. If the
  // attachment list changes, keep the decision but mark the approval stale.
  const reviewedFingerprint = taskReviewFingerprint(task);
  const nextFingerprint = attachmentsFingerprint(updated.attachments);
  const attachmentsChanged = attachmentsFingerprint(task.attachments) !== nextFingerprint;
  if (reviewedFingerprint && attachmentsChanged && patch.reviewFingerprint === undefined) {
    updated.reviewStale = reviewedFingerprint !== nextFingerprint;
    if (task.review && typeof task.review === 'object') {
      updated.review = { ...task.review, stale: updated.reviewStale };
    }
  }

  await putRecord('tasks', updated);
  const requested = Array.isArray(historyField) ? historyField : String(historyField || '').split(/[,;]/);
  const fields = [...new Set(requested.map((field) => field.trim()).filter(Boolean))];
  for (const field of fields) {
    if (patch[field] === undefined) continue;
    const previous = task[field] ?? '';
    const next = patch[field] ?? '';
    if (String(previous) === String(next)) continue;
    await putRecord('task_history', {
      id: newId('th'), taskId: id, at: now, who: 'Amara', field,
      old: String(previous), new: String(next),
      updatedAt: now, deletedAt: null,
    });
  }
  state = await readState();
  return updated;
}

export async function transitionTask(id, input = {}, maybeAs, maybeReason) {
  const task = state.tasks.find((row) => row.id === id);
  if (!task) throw new Error('Task not found.');
  const payload = typeof input === 'string'
    ? { to: input, ...(maybeAs && typeof maybeAs === 'object' ? maybeAs : { as: maybeAs, reason: maybeReason }) }
    : input;
  const check = checkTaskTransition(task, payload.to ?? payload.target ?? payload.workflow ?? payload.status, {
    ...payload,
    state,
  });
  if (!check.ok) throw new Error(check.reason);

  const patch = { status: check.storedStatus, workflow: check.target };
  const history = ['status', 'workflow'];

  if (check.target === 'Duplicate') {
    const duplicateOf = payload.duplicateOf ?? payload.duplicate_of ?? '';
    if (duplicateOf) {
      patch.duplicateOf = duplicateOf;
      patch.duplicate_of = duplicateOf;
      history.push('duplicateOf');
    }
  }

  if (check.reason) {
    patch.workflowReason = check.reason;
    history.push('workflowReason');
  }

  if (TASK_WAIVER_STATUSES.includes(check.target)) {
    const notes = String(task.notes ?? '').trim();
    if (!notes.includes('[免核')) {
      patch.notes = `${notes} [免核 ${nowIso().slice(0, 10)}]`.trim();
      history.push('notes');
    }
  }

  if (TASK_QA_ONLY_STATUSES.includes(check.target)) {
    const notes = String(task.notes ?? '').trim();
    if (!/\[(?:已核|免核)/.test(notes)) {
      patch.notes = `${notes} [已核 ${nowIso().slice(0, 10)}]`.trim();
      history.push('notes');
    }
  }

  return updateTask(id, patch, history);
}

export async function reviewTask(id, decision, options = {}) {
  const task = state.tasks.find((row) => row.id === id);
  if (!task) throw new Error('Task not found.');
  const normalized = String(decision ?? '').trim().toLowerCase();
  if (!['approve', 'changes'].includes(normalized)) {
    throw new Error('Review decision must be Approve or Request changes.');
  }
  const settings = typeof options === 'string' ? { comment: options } : options;
  const by = String(settings.by ?? settings.as ?? 'Amara').trim() || 'Amara';
  if (!/^amara$/i.test(by)) throw new Error('Only Amara can decide this review.');
  const now = nowIso();
  const fingerprint = attachmentsFingerprint(task.attachments);
  const comment = String(settings.comment ?? '').trim();
  return updateTask(id, {
    reviewed: normalized === 'approve',
    review: { decision: normalized, by, at: now, fingerprint, comment, stale: false },
    reviewDecision: normalized,
    reviewBy: by,
    reviewAt: now,
    reviewFingerprint: fingerprint,
    reviewStale: false,
    reviewComment: comment,
  }, 'reviewDecision');
}

export async function addTaskComment(id, body) {
  const now = nowIso();
  await putRecord('task_comments', { id: newId('tc'), taskId: id, at: now, who: 'Amara', body, real: false, updatedAt: now, deletedAt: null });
  state = await readState();
}

// Board health: put a missing QA hand-over mark back on the row's note.
export async function restoreQaMark(id) {
  const task = state.tasks.find((row) => row.id === id);
  if (!task) throw new Error('Task not found.');
  const notes = String(task.notes ?? '').trim();
  if (/\[(?:待核|已核|免核)/.test(notes)) return { ok: true, snapshot: task };

  const recorded = (state.taskHistory ?? [])
    .filter((entry) => entry.taskId === id && ['note', 'notes'].includes(String(entry.field ?? '').toLowerCase()))
    .sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')))
    .map((entry) => String(entry.new ?? '').match(/\[待核(?:\s+(\d{4}-\d{2}-\d{2}))?/))
    .filter(Boolean);

  const historyDate = recorded[recorded.length - 1]?.[1];
  const mark = (recorded.length || task.status === 'Waiting') ? '待核' : '已核';
  const date = historyDate || nowIso().slice(0, 10);
  const snapshot = await updateTask(id, { notes: `${notes} [${mark} ${date}]`.trim() }, 'notes');
  return { ok: true, snapshot };
}

export async function createBug(input) {
  const number = nextNumber(state.bugs, 'key');
  const now = nowIso();
  const severity = normalizeBugSeverity(input.severity);
  const bug = {
    id: newId('bug'), key: `WD-${number}`, title: input.title, status: 'New',
    severity, priority: input.priority || 'Medium',
    assignee: input.assignee || 'Dispatcher', component: input.component || 'other',
    due: bugSlaDue(severity),
    type: input.type || 'Bug', reporter: input.reporter || 'Amara', description: input.description || '',
    repro: input.repro || '', expected: input.expected || '', actual: input.actual || '',
    labels: input.labels || '', found_in: input.found_in || '', fix_in: input.fix_in || '',
    environment: input.environment || '', links: input.links || '', linked_task: input.linked_task || '',
    resolution: input.resolution || '', note: input.note || '', workflowReason: '',
    attachments: [], createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('bugs', bug);
  await putRecord('bug_history', { id: newId('bh'), bugId: bug.id, at: now, who: 'Amara', field: 'created', old: '', new: bug.key, updatedAt: now, deletedAt: null });
  state = await readState();
  return bug;
}

// A bug save can touch many fields at once. Each changed field gets its own
// history row, the same contract the task detail uses.
export async function updateBug(id, patch, historyField = '', options = {}) {
  const bug = state.bugs.find((row) => row.id === id);
  if (!bug) throw new Error('Bug not found.');
  const now = nowIso();
  const updated = { ...bug, ...patch, updatedAt: now };
  await putRecord('bugs', updated);
  const requested = Array.isArray(historyField) ? historyField : String(historyField || '').split(/[,;]/);
  const fields = [...new Set(requested.map((field) => field.trim()).filter(Boolean))];
  const who = String(options?.who ?? options?.as ?? 'Amara').trim() || 'Amara';
  for (const field of fields) {
    if (patch[field] === undefined) continue;
    const previous = bug[field] ?? '';
    const next = patch[field] ?? '';
    if (String(previous) === String(next)) continue;
    await putRecord('bug_history', {
      id: newId('bh'), bugId: id, at: now, who, field,
      old: String(previous), new: String(next),
      updatedAt: now, deletedAt: null,
    });
  }
  state = await readState();
  return updated;
}

// Apply a bug workflow move only after every gate passes. On a refused move
// nothing is written: the caller shows the returned reason as a toast.
export async function transitionBug(id, input = {}, maybeAs, maybeReason) {
  const bug = state.bugs.find((row) => row.id === id);
  if (!bug) throw new Error('Bug not found.');
  const payload = typeof input === 'string'
    ? { to: input, ...(maybeAs && typeof maybeAs === 'object' ? maybeAs : { as: maybeAs, reason: maybeReason }) }
    : input;
  const check = checkBugTransition(bug, payload.to ?? payload.target ?? payload.status, {
    ...payload,
    state,
  });
  if (!check.ok) throw new Error(check.reason);

  const patch = { status: check.target };
  const history = ['status'];
  if (check.target === 'Duplicate') {
    const duplicateOf = String(payload.duplicateOf ?? payload.duplicate_of ?? '').trim();
    if (duplicateOf) {
      patch.duplicateOf = duplicateOf;
      patch.duplicate_of = duplicateOf;
      history.push('duplicateOf');
    }
  }
  if (check.reason) {
    patch.workflowReason = check.reason;
    history.push('workflowReason');
  }
  return updateBug(id, patch, history, { who: payload.as ?? payload.actingAs ?? payload.who ?? 'Amara' });
}

export async function addBugComment(id, body, who = 'Amara') {
  const now = nowIso();
  await putRecord('bug_comments', { id: newId('bc'), bugId: id, at: now, author: who, body, updatedAt: now, deletedAt: null });
  state = await readState();
}

// The bugs list offers multi-select delete, but a bug is never hard-deleted:
// selected rows get a deletedAt tombstone and disappear from the live list only.
// The bug detail page keeps its "Bugs are never deleted" statement because the
// stored record and its key/history remain in IndexedDB.
export async function softDeleteBugs(ids) {
  const selected = new Set((ids ?? []).map((id) => String(id)));
  if (!selected.size) return 0;
  const rows = state.bugs.filter((bug) => selected.has(bug.id));
  if (!rows.length) return 0;
  const now = nowIso();
  await Promise.all(rows.map((bug) => putRecord('bugs', { ...bug, deletedAt: now, updatedAt: now })));
  state = await readState();
  return rows.length;
}

export async function createEvent(input) {
  const now = nowIso();
  const id = newId('event');
  const event = {
    id, seriesId: input.seriesId || id,
    date: input.date, time: input.time || '', end: input.end || '',
    title: input.title, kind: input.kind || 'Reminder', note: input.note || '',
    link: input.link || '', repeat: input.repeat || '', until: input.until || '',
    remind: input.remind ?? '5', projectId: input.projectId || '', taskId: input.taskId || '',
    createdAt: now, updatedAt: now, deletedAt: null,
  };
  await putRecord('events', event);
  state = await readState();
  return event;
}

// Delete every live occurrence row for a series. Expanded occurrences always
// point back at the anchor row, so soft-deleting the series id hides the whole
// repeat without touching other events.
export async function deleteEvent(id) {
  const key = String(id ?? '');
  const target = state.events.find((row) => row.id === key) ?? state.events.find((row) => row.seriesId === key);
  if (!target) return;
  const seriesId = target.seriesId || target.id;
  const rows = state.events.filter((row) => row.id === target.id || row.id === seriesId || (row.seriesId && row.seriesId === seriesId));
  const now = nowIso();
  await Promise.all(rows.map((row) => putRecord('events', { ...row, deletedAt: now, updatedAt: now })));
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
  const updated = { ...order, open: false, updatedAt: nowIso() };
  await putRecord('orders', updated);
  state = await readState();
  return updated;
}

export async function reopenOrder(id) {
  const order = state.orders.find((row) => row.id === id);
  if (!order) return;
  const updated = { ...order, open: true, updatedAt: nowIso() };
  await putRecord('orders', updated);
  state = await readState();
  return updated;
}

export async function saveSettings(settings) {
  await putRecord('meta', { key: 'settings', value: settings, updatedAt: nowIso() });
  state = await readState();
}

export async function saveMeta(key, value) {
  await putRecord('meta', { key, value, updatedAt: nowIso() });
  state = await readState();
}
