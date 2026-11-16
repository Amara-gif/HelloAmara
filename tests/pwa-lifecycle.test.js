import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SW_URL,
  UPDATE_MESSAGE,
  applyUpdate,
  setupInstallPrompt,
  startPwa,
  watchForUpdate,
} from '../assets/js/pwa.js';

class FakeWorker extends EventTarget {
  constructor(state = 'installing') {
    super();
    this.state = state;
    this.messages = [];
    this.postMessage = (message) => this.messages.push(message);
  }

  setState(state) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget {
  constructor() {
    super();
    this.installing = null;
    this.waiting = null;
    this.active = null;
  }
}

test('first install never shows an update prompt', () => {
  const registration = new FakeRegistration();
  const installing = new FakeWorker();
  registration.installing = installing;
  let updates = 0;

  watchForUpdate(registration, { getController: () => null, onUpdate: () => { updates += 1; } });
  installing.setState('installed');

  assert.equal(updates, 0);
});

test('a controlled page is told once when a new worker finishes installing', () => {
  const registration = new FakeRegistration();
  const installing = new FakeWorker();
  registration.installing = installing;
  let updates = 0;

  watchForUpdate(registration, { getController: () => ({}), onUpdate: () => { updates += 1; } });
  installing.setState('installed');
  installing.setState('installed');

  assert.equal(updates, 1);
});

test('a waiting worker found at page load offers the update', () => {
  const registration = new FakeRegistration();
  registration.waiting = new FakeWorker('installed');
  let updates = 0;

  watchForUpdate(registration, { getController: () => ({}), onUpdate: () => { updates += 1; } });

  assert.equal(updates, 1);
});

test('updatefound starts tracking the newly installing worker', () => {
  const registration = new FakeRegistration();
  let updates = 0;
  watchForUpdate(registration, { getController: () => ({}), onUpdate: () => { updates += 1; } });

  const installing = new FakeWorker();
  registration.installing = installing;
  registration.dispatchEvent(new Event('updatefound'));
  installing.setState('installed');

  assert.equal(updates, 1);
});

test('applyUpdate messages the waiting worker and reloads on controllerchange', () => {
  const serviceWorker = new EventTarget();
  const waiting = new FakeWorker('installed');
  let reloads = 0;

  const activated = applyUpdate({ waiting }, { serviceWorker, reload: () => { reloads += 1; } });
  assert.equal(activated, true);
  assert.deepEqual(waiting.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(reloads, 0);

  serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(reloads, 1);
});

test('applyUpdate reloads when there is no waiting worker', () => {
  let reloads = 0;
  assert.equal(applyUpdate({}, { serviceWorker: new EventTarget(), reload: () => { reloads += 1; } }), false);
  assert.equal(reloads, 1);
});

test('setupInstallPrompt captures beforeinstallprompt and uses it once', async () => {
  const win = new EventTarget();
  const changes = [];
  const prompt = setupInstallPrompt({ win, onChange: (available) => changes.push(available) });

  const event = new Event('beforeinstallprompt', { cancelable: true });
  let prompted = 0;
  event.prompt = async () => { prompted += 1; };
  event.userChoice = { outcome: 'accepted', platform: 'web' };
  win.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true, 'the browser default banner is suppressed');
  assert.equal(prompt.available, true);
  assert.deepEqual(changes, [true]);

  const choice = await prompt.prompt();
  assert.equal(prompted, 1);
  assert.equal(choice.outcome, 'accepted');
  assert.equal(prompt.available, false);
  assert.deepEqual(changes, [true, false]);
  assert.equal(await prompt.prompt(), null, 'the captured prompt cannot be reused');
});

test('appinstalled clears install availability', () => {
  const win = new EventTarget();
  let available = null;
  const prompt = setupInstallPrompt({ win, onChange: (value) => { available = value; } });
  const event = new Event('beforeinstallprompt', { cancelable: true });
  win.dispatchEvent(event);
  assert.equal(available, true);

  win.dispatchEvent(new Event('appinstalled'));
  assert.equal(available, false);
  assert.equal(prompt.available, false);
});

test('startPwa registers the local worker and watches it', async () => {
  const registration = new FakeRegistration();
  const serviceWorker = new EventTarget();
  serviceWorker.controller = null;
  let registeredUrl = null;
  serviceWorker.register = async (url) => {
    registeredUrl = url;
    return registration;
  };
  let updates = 0;

  const result = await startPwa({
    serviceWorker,
    onUpdate: () => { updates += 1; },
  });

  assert.equal(result, registration);
  assert.equal(registeredUrl, SW_URL);
  assert.equal(SW_URL, './sw.js');
  assert.equal(updates, 0, 'first registration is not an update');
});

test('the update message tells the user to reload', () => {
  assert.match(UPDATE_MESSAGE, /^New version available, reload/);
});
