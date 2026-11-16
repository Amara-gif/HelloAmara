// Account registry. Records live in localStorage; each account's data lives in
// its own IndexedDB database, so accounts never read each other's rows.
const REGISTRY_KEY = 'my-platform-accounts';
const ACTIVE_KEY = 'my-platform-active-account';

export const TEST_ACCOUNT = {
  id: 'test',
  name: 'Test 测试账号',
  test: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function readRegistry() {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const accounts = Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.name) : [];
    if (!accounts.some((item) => item.id === TEST_ACCOUNT.id)) accounts.unshift(TEST_ACCOUNT);
    return accounts;
  } catch {
    return [TEST_ACCOUNT];
  }
}

function writeRegistry(accounts) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(accounts));
  } catch {
    // Private browsing may reject storage; the Test account still works for this session.
  }
}

export function listAccounts() {
  return readRegistry().sort((a, b) => (a.test === b.test ? a.createdAt.localeCompare(b.createdAt) : a.test ? -1 : 1));
}

export function getAccount(id) {
  return listAccounts().find((account) => account.id === id) ?? null;
}

export function createAccount(name) {
  const clean = String(name ?? '').trim().slice(0, 48);
  if (!clean) throw new Error('Account name is required.');
  const accounts = readRegistry();
  const account = {
    id: `acct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: clean,
    test: false,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  writeRegistry(accounts);
  return account;
}

export function setActiveAccount(id) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Ignore storage failures.
  }
}

export function getActiveAccountId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function clearActiveAccount() {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
