// PWA registration, update hand-off and the browser install prompt.
// Kept free of DOM work so the lifecycle can be tested with plain Node.
export const SW_URL = './sw.js';
export const UPDATE_MESSAGE = 'New version available, reload to update My Platform.';

export async function registerServiceWorker({ serviceWorker = globalThis.navigator?.serviceWorker, url = SW_URL } = {}) {
  if (!serviceWorker?.register) return null;
  try {
    return await serviceWorker.register(url);
  } catch {
    return null;
  }
}

// Announce one update per page load. A waiting worker only counts when this page
// is already controlled, so the first install never shows an update toast.
export function watchForUpdate(registration, { getController = () => null, onUpdate = () => {} } = {}) {
  if (!registration) return () => {};
  let announced = false;

  const announce = () => {
    if (announced || !getController()) return;
    announced = true;
    onUpdate(registration);
  };

  const track = (worker) => {
    if (!worker) return;
    if (worker.state === 'installed') announce();
    worker.addEventListener?.('statechange', () => {
      if (worker.state === 'installed') announce();
    });
  };

  if (registration.waiting) announce();
  track(registration.installing);

  const onUpdateFound = () => track(registration.installing);
  registration.addEventListener?.('updatefound', onUpdateFound);

  return () => registration.removeEventListener?.('updatefound', onUpdateFound);
}

export async function startPwa({
  serviceWorker = globalThis.navigator?.serviceWorker,
  url = SW_URL,
  onUpdate = () => {},
  onError = () => {},
} = {}) {
  if (!serviceWorker?.register) return null;
  try {
    const registration = await serviceWorker.register(url);
    watchForUpdate(registration, {
      getController: () => serviceWorker.controller,
      onUpdate,
    });
    return registration;
  } catch (error) {
    onError(error);
    return null;
  }
}

// Ask a waiting worker to activate, then reload when it takes control. Data is
// untouched because IndexedDB belongs to the browser, not to the cache.
export function applyUpdate(registration, {
  serviceWorker = globalThis.navigator?.serviceWorker,
  reload = () => globalThis.location?.reload?.(),
} = {}) {
  const waiting = registration?.waiting;
  if (!waiting?.postMessage) {
    reload();
    return false;
  }
  serviceWorker?.addEventListener?.('controllerchange', () => reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

// Capture beforeinstallprompt so the Appearance button can call prompt() later.
export function setupInstallPrompt({ win = globalThis.window, onChange = () => {} } = {}) {
  let promptEvent = null;

  const notify = () => onChange(Boolean(promptEvent));
  const onBeforeInstall = (event) => {
    event.preventDefault?.();
    promptEvent = event;
    notify();
  };
  const onInstalled = () => {
    promptEvent = null;
    notify();
  };

  win?.addEventListener?.('beforeinstallprompt', onBeforeInstall);
  win?.addEventListener?.('appinstalled', onInstalled);

  return {
    get available() {
      return Boolean(promptEvent);
    },
    async prompt() {
      if (!promptEvent) return null;
      const event = promptEvent;
      promptEvent = null;
      notify();
      await event.prompt?.();
      return event.userChoice ?? null;
    },
    dispose() {
      win?.removeEventListener?.('beforeinstallprompt', onBeforeInstall);
      win?.removeEventListener?.('appinstalled', onInstalled);
    },
  };
}
