import {
  DB_VERSION,
  STORES,
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

const STORAGE_PERSIST_META = {
  granted: 'storagePersist',
  supported: 'storagePersistSupported',
  checkedAt: 'storagePersistCheckedAt',
};
const DEVICE_ID_META = 'deviceId';
const LAST_EXPORT_META = 'lastExportAt';
export const EXPORT_REMINDER_DAYS = 7;

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

// Attachments are local-only. The row in the `attachments` store is the
// durable copy: metadata plus a Blob (or data URL) that IndexedDB can clone.
// The task/bug record keeps a small metadata list only, so rendering detail
// pages never needs to load every blob. Object URLs are made on demand for
// Open and revoked again; they are never stored, because they die on reload.
const ATTACHMENT_OWNERS = {
  task: { type: 'task', store: 'tasks', ownerKey: 'taskId', otherKey: 'bugId' },
  bug: { type: 'bug', store: 'bugs', ownerKey: 'bugId', otherKey: 'taskId' },
};

function attachmentOwner(ownerType) {
  const key = String(ownerType ?? '').trim().toLowerCase();
  const owner = ATTACHMENT_OWNERS[key] ?? ATTACHMENT_OWNERS[`${key}s`];
  if (!owner) throw new Error('Attachments belong to a task or a bug.');
  return owner;
}

function isBlob(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function attachmentName(file) {
  const name = String(file?.name ?? file?.filename ?? '').trim();
  if (name) return name;
  return `attachment-${Date.now()}.bin`;
}

function attachmentKind(file) {
  const explicit = String(file?.kind ?? '').trim().toLowerCase();
  if (explicit) return explicit;
  const type = String(file?.type ?? '').trim().toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'file';
}

function attachmentSize(file) {
  const size = Number(file?.size);
  return Number.isFinite(size) && size >= 0 ? size : 0;
}

// Keep the owner record's array free of the Blob. attachmentsFingerprint uses
// name/kind/size, so adding or detaching still marks a review stale.
function attachmentMetadata(record) {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    type: record.type,
    size: record.size,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function matchesAttachment(file, record) {
  if (typeof file === 'string') return file === record.id || file === record.name;
  const fileId = String(file?.id ?? '');
  if (fileId) return fileId === record.id;
  return String(file?.name ?? '') === record.name && attachmentSize(file) === record.size;
}

export async function addAttachment(ownerTypeOrInput, ownerIdOrFile, maybeFile) {
  let ownerType = ownerTypeOrInput;
  let ownerId = ownerIdOrFile;
  let file = maybeFile;
  if (ownerTypeOrInput && typeof ownerTypeOrInput === 'object') {
    const input = ownerTypeOrInput;
    ownerType = input.ownerType ?? input.owner ?? input.parentType ?? input.type;
    ownerId = input.ownerId ?? input.taskId ?? input.bugId ?? input.id;
    file = input.file ?? input.blob ?? input;
  }
  if (!file || typeof file !== 'object') throw new Error('Choose a file to attach.');
  const owner = attachmentOwner(ownerType);
  const ownerRecord = state?.[owner.store]?.find((row) => row.id === ownerId);
  if (!ownerRecord) throw new Error(`${owner.type === 'task' ? 'Task' : 'Bug'} not found.`);

  const now = nowIso();
  const name = attachmentName(file);
  const type = String(file?.type ?? '');
  const record = {
    id: newId('attachment'),
    ownerType: owner.type,
    ownerId: String(ownerId),
    [owner.ownerKey]: String(ownerId),
    [owner.otherKey]: null,
    name,
    kind: attachmentKind(file),
    type,
    size: attachmentSize(file),
    blob: isBlob(file) ? file : (isBlob(file?.blob) ? file.blob : null),
    dataUrl: typeof file?.dataUrl === 'string' ? file.dataUrl : '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await putRecord('attachments', record);
  const metadata = attachmentMetadata(record);

  if (owner.type === 'task') {
    await updateTask(ownerId, { attachments: [...(ownerRecord.attachments ?? []), metadata] });
  } else {
    await updateBug(ownerId, { attachments: [...(ownerRecord.attachments ?? []), metadata] });
  }
  state = await readState();
  return record;
}

export async function addTaskAttachment(taskId, file) {
  return addAttachment('task', taskId, file);
}

export async function addBugAttachment(bugId, file) {
  return addAttachment('bug', bugId, file);
}

export const attachFile = addAttachment;
export const attachTaskFile = addTaskAttachment;
export const attachBugFile = addBugAttachment;

export function listAttachments(ownerType, ownerId) {
  const owner = attachmentOwner(ownerType);
  return (state?.attachments ?? []).filter((row) => (
    !row.deletedAt
    && String(row[owner.ownerKey] ?? row.ownerId) === String(ownerId)
  ));
}

export async function getAttachment(attachmentId) {
  return getOne('attachments', attachmentId);
}

// Create a short-lived object URL for Open. The Blob itself stays in
// IndexedDB; callers must revoke the URL after the download/open starts.
export async function attachmentObjectUrl(attachmentId) {
  const record = await getOne('attachments', attachmentId);
  if (!record || record.deletedAt) return '';
  if (record.dataUrl) return record.dataUrl;
  if (!isBlob(record.blob) || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return '';
  return URL.createObjectURL(record.blob);
}

export const objectUrlForAttachment = attachmentObjectUrl;

export async function removeAttachment(attachmentId) {
  let id = attachmentId;
  if (attachmentId && typeof attachmentId === 'object') id = attachmentId.id;
  if (!id) return false;
  const record = await getOne('attachments', id);
  if (!record || record.deletedAt) return false;

  const now = nowIso();
  await putRecord('attachments', { ...record, deletedAt: now, updatedAt: now });

  const ownerType = record.ownerType ?? (record.bugId ? 'bug' : 'task');
  const owner = attachmentOwner(ownerType);
  const ownerId = String(record.ownerId ?? record[owner.ownerKey] ?? '');
  const ownerRecord = state?.[owner.store]?.find((row) => row.id === ownerId);
  if (ownerRecord) {
    const attachments = (ownerRecord.attachments ?? []).filter((file) => !matchesAttachment(file, record));
    if (owner.type === 'task') await updateTask(ownerId, { attachments });
    else await updateBug(ownerId, { attachments });
  }
  state = await readState();
  return { ...record, deletedAt: now, updatedAt: now };
}

export const detachAttachment = removeAttachment;

export async function removeTaskAttachment(taskId, attachmentIdOrFile) {
  const task = state?.tasks?.find((row) => row.id === taskId);
  const match = (task?.attachments ?? []).find((file) => matchesAttachment(attachmentIdOrFile, file));
  const id = attachmentIdOrFile?.id ?? match?.id ?? attachmentIdOrFile;
  return removeAttachment(id);
}

export async function removeBugAttachment(bugId, attachmentIdOrFile) {
  const bug = state?.bugs?.find((row) => row.id === bugId);
  const match = (bug?.attachments ?? []).find((file) => matchesAttachment(attachmentIdOrFile, file));
  const id = attachmentIdOrFile?.id ?? match?.id ?? attachmentIdOrFile;
  return removeAttachment(id);
}

export const detachTaskAttachment = removeTaskAttachment;
export const detachBugAttachment = removeBugAttachment;

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
  await ensureDeviceId();
  await requestPersistentStorage();
  state = await readState();
  return state;
}

// The device id is created once per local account database and reused for every
// export. It is not a user account or a server identifier.
async function ensureDeviceId() {
  const existing = await getOne('meta', DEVICE_ID_META);
  if (existing?.value) return existing.value;
  const deviceId = newId('device');
  await putRecord('meta', { key: DEVICE_ID_META, value: deviceId, updatedAt: nowIso() });
  return deviceId;
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
  const device = await getOne('meta', DEVICE_ID_META);
  await seedDemo(true);
  if (device?.value) await putRecord('meta', device);
  else await ensureDeviceId();
  state = await readState();
  return state;
}

export async function refresh() {
  state = await readState();
  return state;
}

async function readState() {
  const [tasks, taskHistory, taskComments, bugs, bugHistory, bugComments, attachments, events, projects, pages, aiCalls, team, orders, metaRows] = await Promise.all([
    getAll('tasks'), getAll('task_history'), getAll('task_comments'), getAll('bugs'),
    getAll('bug_history'), getAll('bug_comments'), getAll('attachments'), getAll('events'),
    getAll('projects'), getAll('pages'), getAll('ai_calls'), getAll('team'), getAll('orders'),
    getAll('meta'),
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
    attachments: live(attachments),
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
    deviceId: meta[DEVICE_ID_META] ?? null,
    lastExportAt: meta[LAST_EXPORT_META] ?? null,
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
  await putRecord('orders', { ...order, open: false, updatedAt: nowIso() });
  state = await readState();
}

// Build the one-file JSON backup: schema metadata plus every object store,
// including soft-deleted rows so a later import can merge without losing them.
export async function buildExport({ exportedAt = nowIso() } = {}) {
  const deviceId = await ensureDeviceId();
  await putRecord('meta', { key: LAST_EXPORT_META, value: exportedAt, updatedAt: nowIso() });
  const stores = {};
  for (const name of Object.keys(STORES)) stores[name] = await getAll(name);
  state = await readState();
  return { schemaVersion: DB_VERSION, exportedAt, deviceId, stores };
}

export const exportAllStores = buildExport;

export function exportStatus(currentState = state, now = new Date()) {
  const lastExportAt = currentState?.lastExportAt ?? null;
  const timestamp = lastExportAt ? Date.parse(lastExportAt) : NaN;
  if (!Number.isFinite(timestamp)) return { lastExportAt, daysSince: null, overdue: true };
  const daysSince = Math.floor(Math.max(0, now.getTime() - timestamp) / 86400000);
  return { lastExportAt, daysSince, overdue: now.getTime() - timestamp >= EXPORT_REMINDER_DAYS * 86400000 };
}

// ---------------------------------------------------------------- Import JSON
// An import is read-only until the summary is confirmed. These helpers are
// deliberately separate from the UI so the merge rules can be tested.
export const IMPORT_META_PROTECTED = Object.freeze([
  'deviceId',
  'lastExportAt',
  'seedVersion',
  'storagePersist',
  'storagePersistSupported',
  'storagePersistCheckedAt',
]);
const IMPORT_META_PROTECTED_SET = new Set(IMPORT_META_PROTECTED);

function importError(message) {
  const error = new Error(message);
  error.name = 'ImportValidationError';
  return error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTimestamp(value) {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

// Validate the full backup envelope and every row before any write happens.
// Rows are returned as shallow copies with a normalized deletedAt.
export function validateImportPayload(payload) {
  if (!isObject(payload)) throw importError('The selected file is not a My Platform backup object.');
  if (!Number.isInteger(payload.schemaVersion)) {
    throw importError('The backup has no numeric schemaVersion.');
  }
  if (payload.schemaVersion !== DB_VERSION) {
    throw importError(`Unsupported backup schema version ${payload.schemaVersion}. This app reads version ${DB_VERSION}.`);
  }
  if (!isTimestamp(payload.exportedAt)) {
    throw importError('The backup has an invalid exportedAt timestamp.');
  }
  if (typeof payload.deviceId !== 'string' || !payload.deviceId.trim()) {
    throw importError('The backup has no deviceId.');
  }
  if (!isObject(payload.stores)) {
    throw importError('The backup has no stores object.');
  }

  const unknown = Object.keys(payload.stores).filter((name) => !Object.prototype.hasOwnProperty.call(STORES, name));
  if (unknown.length) {
    throw importError(`The backup contains unknown stores: ${unknown.join(', ')}.`);
  }

  const stores = {};
  for (const [name, definition] of Object.entries(STORES)) {
    const rows = payload.stores[name];
    if (!Array.isArray(rows)) {
      throw importError(`The backup is missing the “${name}” store array.`);
    }
    const seen = new Set();
    stores[name] = rows.map((record) => {
      if (!isObject(record)) {
        throw importError(`The ${name} store contains a row that is not an object.`);
      }
      const keyPath = definition.keyPath;
      const rawKey = record[keyPath];
      if (rawKey === undefined || rawKey === null || String(rawKey).trim() === '') {
        throw importError(`A row in the ${name} store has no “${keyPath}”.`);
      }
      const key = String(rawKey);
      if (seen.has(key)) {
        throw importError(`The ${name} store contains duplicate ${keyPath} “${key}”.`);
      }
      seen.add(key);
      if (!isTimestamp(record.updatedAt)) {
        throw importError(`Row “${key}” in ${name} has an invalid updatedAt; imports need an ISO 8601 timestamp.`);
      }
      if (record.deletedAt !== undefined && record.deletedAt !== null && !isTimestamp(record.deletedAt)) {
        throw importError(`Row “${key}” in ${name} has an invalid deletedAt timestamp.`);
      }
      return { ...record, [keyPath]: key, deletedAt: record.deletedAt ?? null };
    });
  }

  return {
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    deviceId: payload.deviceId,
    stores,
  };
}

export function parseImportJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw importError('The selected file is empty.');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw importError('That file is not valid JSON. Choose a My Platform backup exported as .json.');
  }
  return validateImportPayload(parsed);
}

// Read the current database and decide, per store, which rows would be added,
// updated or skipped. This does not write anything.
export async function planImport(payload) {
  const backup = validateImportPayload(payload);
  const stores = {};
  const writes = {};
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let deleted = 0;

  for (const [name, definition] of Object.entries(STORES)) {
    const summary = { added: 0, updated: 0, skipped: 0, deleted: 0 };
    const existing = await getAll(name);
    const byKey = new Map(existing.map((row) => [String(row[definition.keyPath]), row]));
    const records = [];

    for (const record of backup.stores[name]) {
      const key = String(record[definition.keyPath]);
      // Device identity, storage status and export markers always stay local.
      if (name === 'meta' && IMPORT_META_PROTECTED_SET.has(key)) {
        summary.skipped += 1;
        continue;
      }
      const local = byKey.get(key);
      if (!local) {
        summary.added += 1;
        records.push(record);
        continue;
      }
      const localTime = Date.parse(local.updatedAt);
      if (!Number.isFinite(localTime) || Date.parse(record.updatedAt) > localTime) {
        summary.updated += 1;
        if (record.deletedAt) summary.deleted += 1;
        records.push(record);
      } else {
        summary.skipped += 1;
      }
    }

    stores[name] = summary;
    writes[name] = records;
    added += summary.added;
    updated += summary.updated;
    skipped += summary.skipped;
    deleted += summary.deleted;
  }

  return {
    ...backup,
    added,
    updated,
    skipped,
    deleted,
    totals: { added, updated, skipped, deleted },
    stores,
    rows: backup.stores,
    writes,
  };
}

// Merge is the default. `replace` is only reached from an explicit radio
// choice in the confirmation dialog; it clears the account before restoring
// the file, then puts the local device-only meta rows back.
export async function applyImportPlan(plan, { mode = 'merge' } = {}) {
  if (!plan || !plan.writes || !plan.stores) throw importError('Choose a backup to import first.');
  if (!['merge', 'replace'].includes(mode)) throw importError('Choose Merge or Replace all before importing.');
  if (mode === 'replace' && !plan.rows) {
    throw importError('The backup rows are no longer available; choose the file again.');
  }

  let localMeta = [];
  if (mode === 'replace') {
    localMeta = (await getAll('meta')).filter((row) => IMPORT_META_PROTECTED_SET.has(String(row.key)));
    await clearAllStores();
  }

  if (mode === 'replace') {
    // Replace all writes every file row, even when merge would have skipped it
    // because the local copy was newer.
    for (const [name, rows] of Object.entries(plan.rows)) {
      const records = name === 'meta'
        ? rows.filter((row) => !IMPORT_META_PROTECTED_SET.has(String(row.key)))
        : rows;
      if (records.length) await putRecords(name, records);
    }
    if (localMeta.length) await putRecords('meta', localMeta);
  } else {
    for (const [name, records] of Object.entries(plan.writes)) {
      if (records.length) await putRecords(name, records);
    }
  }

  if (currentAccount) state = await readState();

  if (mode === 'replace') {
    const source = plan.rows ?? {};
    const replaceRows = Object.entries(source).flatMap(([name, rows]) => (
      name === 'meta' ? rows.filter((row) => !IMPORT_META_PROTECTED_SET.has(String(row.key))) : rows
    ));
    const written = replaceRows.length;
    const deletedRows = replaceRows.filter((row) => row.deletedAt).length;
    const protectedCount = Object.values(source).flat().length - written;
    return {
      mode,
      added: written,
      updated: 0,
      skipped: protectedCount,
      deleted: deletedRows,
      totals: { added: written, updated: 0, skipped: protectedCount, deleted: deletedRows },
      stores: plan.stores,
    };
  }

  return {
    mode,
    added: plan.added,
    updated: plan.updated,
    skipped: plan.skipped,
    deleted: plan.deleted,
    totals: { ...plan.totals },
    stores: plan.stores,
  };
}

export async function importBackup(payload, options = {}) {
  const plan = await planImport(payload);
  return applyImportPlan(plan, options);
}

export const validateImport = validateImportPayload;
export const buildImportPlan = planImport;
export const applyImport = applyImportPlan;

export async function saveSettings(settings) {
  await putRecord('meta', { key: 'settings', value: settings, updatedAt: nowIso() });
  state = await readState();
}

export async function saveMeta(key, value) {
  await putRecord('meta', { key, value, updatedAt: nowIso() });
  state = await readState();
}
