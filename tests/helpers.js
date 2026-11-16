import { STORES, closeAccountDb, dbNameFor } from '../assets/js/db.js';

let sequence = 0;

export function tempAccountId(label) {
  sequence += 1;
  return `test-${label}-${process.pid}-${Date.now()}-${sequence}`;
}

export function recordFor(storeName) {
  const definition = STORES[storeName];
  const updatedAt = new Date().toISOString();
  if (definition.keyPath === 'key') {
    return {
      key: `key-${storeName}`,
      value: { store: storeName },
      updatedAt,
      deletedAt: null,
    };
  }
  return {
    id: `id-${storeName}`,
    name: `row-${storeName}`,
    updatedAt,
    deletedAt: null,
  };
}

export function keyFor(storeName, record) {
  return record[STORES[storeName].keyPath];
}

export function openRawDb(name, version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => onUpgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`Opening ${name} was blocked.`));
  });
}

export function expectStoreShape(database, storeName, definition) {
  const transaction = database.transaction(storeName);
  const objectStore = transaction.objectStore(storeName);
  if (objectStore.keyPath !== definition.keyPath) {
    throw new Error(`${storeName} uses keyPath ${objectStore.keyPath}, expected ${definition.keyPath}`);
  }
  for (const index of definition.indexes ?? []) {
    if (!objectStore.indexNames.contains(index)) {
      throw new Error(`${storeName} is missing index ${index}`);
    }
  }
}

export async function deleteAccountDb(accountId) {
  closeAccountDb();
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbNameFor(accountId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`Deleting ${dbNameFor(accountId)} was blocked.`));
  });
}
