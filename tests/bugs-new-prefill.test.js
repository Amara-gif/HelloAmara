import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView, renderCreateDialog, bugPrefill } from '../assets/js/views.js';
import { start, createBug, bugSlaDue } from '../assets/js/data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

function panel(html, name) {
  const match = html.match(new RegExp(`data-create-panel="${name}"[\\s\\S]*?<\\/form>`));
  assert.ok(match, `${name} panel must exist`);
  return match[0];
}

test('report-a-bug route is a short page with the form and back actions', () => {
  const html = renderView(
    { id: 'bug-new', path: '/bugs/new', title: 'Report a bug' },
    new URLSearchParams('t=Login+loops&d=After+sign-out&component=settings&severity=S2'),
    { bugs: [], team: [] },
  );
  assert.match(html, /Open the bug form/);
  assert.match(html, /data-action="open-bug-form"/);
  assert.match(html, /href="#\/bugs"[^>]*>Back to Bugs<\/a>/);
  assert.doesNotMatch(html, /data-form="bug-create"/, 'the full-page form is gone');
});

test('bugPrefill maps t, d, component and severity, defaulting severity to S3', () => {
  assert.deepEqual(
    bugPrefill(new URLSearchParams('t=Login+loops&d=After+sign-out&component=settings&severity=S2')),
    {
      tab: 'bug',
      title: 'Login loops',
      description: 'After sign-out',
      component: 'settings',
      severity: 'S2 Critical',
    },
  );
  const defaults = bugPrefill(new URLSearchParams());
  assert.equal(defaults.severity, 'S3 Major');
  assert.equal(defaults.component, 'other');
  assert.equal(defaults.title, '');
  assert.equal(defaults.description, '');
});

test('Create dialog opens on the Bug tab with every query prefill', () => {
  const html = renderCreateDialog(
    { projects: [] },
    bugPrefill(new URLSearchParams('t=Login+loops&d=After+sign-out&component=mobile+app&severity=S2')),
  );
  assert.match(html, /aria-selected="true" data-create-tab="bug"/);
  const bug = panel(html, 'bug');
  assert.match(bug, /id="create-bug-title" name="title" type="text" required value="Login loops"/);
  assert.match(bug, /<option value="S2 Critical" selected>S2 Critical<\/option>/);
  assert.match(bug, /<option value="mobile app" selected>mobile app<\/option>/);
  assert.match(bug, /name="description" rows="3">After sign-out<\/textarea>/);
});

test('bug SLA offsets are local calendar days', () => {
  const base = new Date(2026, 0, 15, 23, 30);
  assert.equal(bugSlaDue('S1 Blocker', base), '2026-01-15');
  assert.equal(bugSlaDue('S2 Critical', base), '2026-01-17');
  assert.equal(bugSlaDue('S3 Major', base), '2026-01-20');
  assert.equal(bugSlaDue('S4 Minor', base), '');
});

test('created bugs receive WD-n keys and the severity SLA due date', async () => {
  accountId = tempAccountId('bugs-new-prefill');
  await start({ id: accountId, name: 'Bugs new prefill', test: false });

  const first = await createBug({ title: 'Blocker', severity: 'S1 Blocker' });
  const second = await createBug({ title: 'Critical', severity: 'S2 Critical' });
  const third = await createBug({ title: 'Major', severity: 'S3 Major' });
  const fourth = await createBug({ title: 'Minor', severity: 'S4 Minor' });
  const fallback = await createBug({ title: 'No severity' });

  assert.deepEqual([first.key, second.key, third.key, fourth.key, fallback.key], ['WD-1', 'WD-2', 'WD-3', 'WD-4', 'WD-5']);
  assert.equal(first.due, bugSlaDue('S1 Blocker'));
  assert.equal(second.due, bugSlaDue('S2 Critical'));
  assert.equal(third.due, bugSlaDue('S3 Major'));
  assert.equal(fourth.due, '');
  assert.equal(fallback.severity, 'S3 Major');
  assert.equal(fallback.due, bugSlaDue('S3 Major'));
});
