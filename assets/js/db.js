// One IndexedDB database per account: my-platform-<accountId>.
const DB_VERSION = 1;

const STORES = {
  tasks: { keyPath: 'id', indexes: ['status', 'projectId', 'owner', 'due'] },
  task_history: { keyPath: 'id', indexes: ['taskId'] },
  task_comments: { keyPath: 'id', indexes: ['taskId'] },
  bugs: { keyPath: 'id', indexes: ['status', 'assignee', 'due'] },
  bug_history: { keyPath: 'id', indexes: ['bugId'] },
  bug_comments: { keyPath: 'id', indexes: ['bugId'] },
  events: { keyPath: 'id', indexes: ['date', 'projectId', 'taskId'] },
  projects: { keyPath: 'id', indexes: ['key'] },
  pages: { keyPath: 'id', indexes: ['projectId', 'taskId'] },
  ai_calls: { keyPath: 'id' },
  team: { keyPath: 'id' },
  orders: { keyPath: 'id', indexes: ['owner'] },
  meta: { keyPath: 'key' },
};

let db = null;

export function dbNameFor(accountId) {
  return `my-platform-${accountId}`;
}

export async function openAccountDb(accountId) {
  if (db) {
    db.close();
    db = null;
  }
  db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbNameFor(accountId), DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const [name, definition] of Object.entries(STORES)) {
        if (database.objectStoreNames.contains(name)) continue;
        const store = database.createObjectStore(name, { keyPath: definition.keyPath });
        for (const index of definition.indexes ?? []) store.createIndex(index, index, { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database is blocked by another tab.'));
  });
  return db;
}

function store(name, mode = 'readonly') {
  if (!db) throw new Error('Database is not open.');
  return db.transaction(name, mode).objectStore(name);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(name) {
  return requestToPromise(store(name).getAll());
}

export async function getOne(name, key) {
  return requestToPromise(store(name).get(key));
}

export async function putRecord(name, record) {
  return requestToPromise(store(name, 'readwrite').put(record));
}

export async function putRecords(name, records) {
  if (!records.length) return;
  const objectStore = store(name, 'readwrite');
  await Promise.all(records.map((record) => requestToPromise(objectStore.put(record))));
}

export async function clearStore(name) {
  return requestToPromise(store(name, 'readwrite').clear());
}

export async function clearAllStores() {
  const names = Object.keys(STORES);
  const transaction = db.transaction(names, 'readwrite');
  await Promise.all(
    names.map((name) => requestToPromise(transaction.objectStore(name).clear()))
  );
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}
