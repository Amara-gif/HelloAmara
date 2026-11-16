import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { start, getState, saveSettings, AI_LIMIT_DEFAULTS } from '../assets/js/data.js';
import { closeAccountDb } from '../assets/js/db.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

async function boot() {
  accountId = tempAccountId('settings-depth');
  const account = { id: accountId, name: 'Settings depth test', test: true };
  await start(account);
  return account;
}

function htmlFor(id, path, state = getState()) {
  return renderView({ id, path, title: id }, new URLSearchParams(), state);
}

const FORM_ROUTES = [
  ['settings', '/settings'],
  ['settings-ai', '/settings/ai'],
  ['settings-language', '/settings/language'],
  ['settings-dispatch', '/settings/dispatch'],
  ['settings-areas', '/settings/areas'],
  ['settings-appearance', '/settings/appearance'],
];

test('every settings form uses the shared dirty and saved save pattern', async () => {
  await boot();
  for (const [id, path] of FORM_ROUTES) {
    const html = htmlFor(id, path);
    assert.match(html, /data-settings-form/, `${id} is marked as a settings form`);
    assert.match(html, /data-save-state/, `${id} has a save-state line`);
    assert.match(html, /Unsaved changes\. Save before leaving\./, `${id} carries the shared dirty text`);
    assert.match(html, /All changes saved\./, `${id} starts saved`);
    assert.match(html, /<button class="btn btn-primary" type="submit">Save (?:changes|theme)<\/button>/, `${id} has one primary Save button`);
  }
});

test('/settings/ai has sectioned limits and a Restore defaults control', async () => {
  await boot();
  const html = htmlFor('settings-ai', '/settings/ai');
  for (const section of ['summary', 'progress', 'comment', 'issue', 'benchmark']) {
    assert.match(html, new RegExp(`data-limit-section="${section}"`), `missing ${section} section`);
    assert.match(html, new RegExp(`name="${section}"`), `missing ${section} input`);
  }
  assert.match(html, /Restore defaults/);
  assert.match(html, /data-action="restore-ai-defaults"/);
  assert.match(html, /href="#\/settings\/language"/);
  assert.deepEqual(AI_LIMIT_DEFAULTS, { summary: 12, progress: 8, comment: 6, issue: 40, benchmark: 10 });
});

test('Language rules show primary, secondary, rule and a preview note', async () => {
  await boot();
  const html = htmlFor('settings-language', '/settings/language');
  assert.match(html, /name="primary"/);
  assert.match(html, /name="secondary"/);
  assert.match(html, /name="rule"/);
  assert.match(html, /Preview note/);
  assert.match(html, /English is written first and Chinese is kept beside it/);
  assert.match(html, /Applies to the next AI call only/);
});

test('Dispatch renders default owner, add and remove controls, and documents first match', async () => {
  await boot();
  const html = htmlFor('settings-dispatch', '/settings/dispatch');
  assert.match(html, /name="defaultOwner"/);
  assert.match(html, /data-action="add-dispatch-rule"/);
  assert.match(html, /data-action="remove-dispatch-rule"/);
  assert.match(html, /data-dispatch-rules/);
  assert.match(html, /name="rule-key-0"/);
  assert.match(html, /name="rule-owner-0"/);
  assert.match(html, /first matching rule wins/i);
  assert.match(html, /keywords match the work item title plus description/i);
});

test('Responsibility areas use removable chips plus a fallback owner', async () => {
  await boot();
  const html = htmlFor('settings-areas', '/settings/areas');
  assert.match(html, /data-area-chip="Battery"/);
  assert.match(html, /data-action="remove-area"/);
  assert.match(html, /data-action="add-area"/);
  assert.match(html, /name="fallback"/);
  assert.match(html, /value="NA"/);
});

test('Snapshots list Snapshot pages with Open and a Delete confirm hook', async () => {
  await boot();
  const html = htmlFor('settings-snapshots', '/settings/snapshots');
  assert.match(html, /data-snapshot-row="pg1"/);
  assert.match(html, /href="#\/page\/pg1">Open<\/a>/);
  assert.match(html, /data-action="delete-page" data-id="pg1" data-snapshot="1"/);
  assert.match(html, /Nothing is deleted automatically/);
  assert.doesNotMatch(html, /href="#\/page\/pg1"[^>]*>Open<\/a>[\s\S]*?data-snapshot-row="t1"/);
});

test('AI key test and Fill gaps stay local in the settings view text', async () => {
  await boot();
  const html = htmlFor('settings', '/settings');
  assert.match(html, /data-action="test-key"/);
  assert.match(html, /data-action="fill-gaps"/);
  assert.match(html, /local previews/i);
  assert.match(html, /No network AI request is sent/);
});

test('Appearance offers six palette presets, live preview and the PWA install card', async () => {
  await boot();
  const html = htmlFor('settings-appearance', '/settings/appearance');
  const presets = [...html.matchAll(/data-palette="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(presets, ['soft', 'apple', 'ocean', 'sunset', 'candy', 'graphite']);
  assert.match(html, /Live preview/);
  assert.match(html, /<span class="btn btn-primary btn-sm"[^>]*>Primary<\/span>/);
  assert.match(html, /<span class="btn btn-sm"[^>]*>Secondary<\/span>/);
  assert.match(html, /Selected chip/);
  assert.match(html, /name="preset"/);
  assert.match(html, /name="radiusBtn"/);
  assert.match(html, /name="radiusCard"/);
  assert.match(html, /name="glass"/);
  assert.match(html, /data-action="reset-theme"/);
  assert.match(html, /data-install-card/);
  assert.match(html, /data-action="install-app"/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /Save theme/);
});

test('a saved appearance preset survives a database reopen', async () => {
  const account = await boot();
  const settings = structuredClone(getState().settings);
  settings.appearance = { preset: 'ocean', primary: '', radiusBtn: 12, radiusCard: 20, glass: 0.5, enableGlass: false };
  await saveSettings(settings);

  closeAccountDb();
  await start(account);

  assert.deepEqual(getState().settings.appearance, settings.appearance);
  const html = htmlFor('settings-appearance', '/settings/appearance');
  assert.match(html, /data-palette="ocean" data-action="apply-palette" aria-pressed="true"/);
  assert.match(html, /name="radiusBtn" type="range" min="0" max="20" step="1" value="12"/);
});

test('a changed dispatch rule survives closing and reopening the account database', async () => {
  const account = await boot();
  const settings = structuredClone(getState().settings);
  settings.dispatch = {
    defaultOwner: 'QA',
    rules: [
      { keyword: 'battery', owner: 'Worker A' },
      { keyword: 'release', owner: 'QA' },
    ],
  };
  settings.language = { primary: 'zh', secondary: 'en', rule: 'Keep quoted English.' };
  settings.areas = { options: ['Battery', 'Display', 'Firmware', 'Supplier', 'Packaging'], fallback: 'Unassigned' };
  await saveSettings(settings);

  closeAccountDb();
  await start(account);

  const reloaded = getState().settings;
  assert.deepEqual(reloaded.dispatch, settings.dispatch);
  assert.deepEqual(reloaded.language, settings.language);
  assert.deepEqual(reloaded.areas, settings.areas);
  const html = htmlFor('settings-dispatch', '/settings/dispatch');
  assert.match(html, /value="battery"/);
  assert.match(html, /<option value="QA" selected>QA<\/option>/);
});
