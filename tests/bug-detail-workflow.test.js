import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import {
  start, getState, updateBug, transitionBug, addBugComment,
  bugWorkflowTargets, checkBugTransition, normalizeBugStatus,
} from '../assets/js/data.js';
import { closeAccountDb } from '../assets/js/db.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const detailRoute = (id) => ({ id: 'bug-detail', path: `/bug/${id}`, title: 'Bug', params: { id } });
const demoState = () => ({ ...buildDemoData().stores });

async function startDemo(label) {
  accountId = tempAccountId(label);
  await start({ id: accountId, name: 'Bug detail workflow test', test: true });
}

function form(html, name) {
  const match = html.match(new RegExp(`data-form="${name}"[\\s\\S]*?<\\/form>`));
  assert.ok(match, `${name} form must exist`);
  return match[0];
}

test('bug detail renders inline title, description blocks, details and read-only stamps', () => {
  const html = renderView(detailRoute('b2'), new URLSearchParams(), demoState());

  assert.match(html, /data-form="bug-title" data-history="title"/);
  assert.match(html, /data-form="bug-details" data-history="description,repro,expected,actual,environment"/);
  assert.match(html, /data-form="bug-fields" data-history="assignee,reporter,priority,severity,type,component,found_in,fix_in,due,labels,links,linked_task,resolution,note"/);
  assert.match(html, /name="title" type="text" value="Create dialog loses focus after paste"/);
  assert.match(html, /name="description" rows="3">Reported from the weekly quality review\.<\/textarea>/);
  assert.match(html, /name="environment" type="text" value="Windows 11 · Edge"/);

  for (const name of ['assignee', 'reporter', 'priority', 'severity', 'type', 'component', 'found_in', 'fix_in', 'due', 'labels', 'links', 'linked_task', 'resolution', 'note']) {
    assert.match(html, new RegExp(`name="${name}"`), `missing editable field ${name}`);
  }
  assert.match(html, /<dt>Created<\/dt>/);
  assert.match(html, /<dt>Updated<\/dt>/);
  assert.match(html, /<dt>ID<\/dt>/);
  assert.doesNotMatch(html, /name="created"/);
  assert.doesNotMatch(html, /name="updated"/);
  assert.match(html, /<textarea id="bgComment" name="body"/);
});

test('the move target list only offers TRANSITIONS targets', () => {
  const state = demoState();
  const newForm = form(renderView(detailRoute('b2'), new URLSearchParams(), state), 'bug-workflow');
  for (const target of ['Triaged', 'Duplicate', 'Rejected', 'Deferred']) assert.match(newForm, new RegExp(`value="${target}"`));
  for (const illegal of ['In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Wont fix']) {
    assert.doesNotMatch(newForm, new RegExp(`value="${illegal}"`), `${illegal} must not be offered from New`);
  }
  assert.match(newForm, /name="as"/);
  assert.match(newForm, /name="reason"/);

  const fixedForm = form(renderView(detailRoute('b5'), new URLSearchParams(), state), 'bug-workflow');
  assert.match(fixedForm, /value="Verified"/);
  assert.match(fixedForm, /value="Reopened"/);
  assert.doesNotMatch(fixedForm, /value="New"/);

  assert.deepEqual(bugWorkflowTargets({ status: 'New' }), ['Triaged', 'Duplicate', 'Rejected', 'Deferred']);
  assert.equal(normalizeBugStatus('to qa'), 'Fixed');
  assert.equal(normalizeBugStatus('resolved'), 'Verified');
});

test('multi-field bug edits write history lines and persist after a database reopen', async () => {
  await startDemo('bug-inline-edit');
  const patch = {
    title: 'WD-2 edited inline',
    description: 'Edited description',
    repro: 'Open the bug detail page',
    expected: 'Fields save',
    actual: 'Fields save after reload',
    environment: 'macOS · Safari',
    assignee: 'Worker A',
    reporter: 'Steward',
    priority: 'Lowest',
    severity: 'S4 Minor',
    type: 'Improvement',
    component: 'inbox',
    found_in: 'DVT build 2',
    fix_in: 'PVT build 1',
    due: '2026-04-10',
    labels: 'regression, ui',
    links: 'docs/repro.md',
    linked_task: 'T-2',
    resolution: 'fixed',
    note: 'checked inline',
  };
  await updateBug('b2', patch, Object.keys(patch));

  const historyFields = new Set(getState().bugHistory.filter((row) => row.bugId === 'b2').map((row) => row.field));
  for (const field of Object.keys(patch)) assert.ok(historyFields.has(field), `history is missing ${field}`);

  closeAccountDb();
  await start({ id: accountId, name: 'Bug detail workflow test', test: true });
  const bug = getState().bugs.find((row) => row.id === 'b2');
  for (const [field, value] of Object.entries(patch)) assert.equal(bug[field], value, `${field} did not persist`);

  const html = renderView(detailRoute('b2'), new URLSearchParams(), getState());
  for (const field of Object.keys(patch)) assert.match(html, new RegExp(`(?:${field}: |badge-muted">${field}<)`), `feed does not show ${field}`);
});

test('illegal moves are refused before any write', async () => {
  await startDemo('bug-illegal-move');
  const before = getState().bugs.find((row) => row.id === 'b2');
  const historyBefore = getState().bugHistory.filter((row) => row.bugId === 'b2').length;

  await assert.rejects(
    () => transitionBug('b2', { to: 'Verified', as: 'QA' }),
    /Cannot move from New to Verified/,
  );

  const after = getState().bugs.find((row) => row.id === 'b2');
  assert.equal(after.status, before.status);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal(getState().bugHistory.filter((row) => row.bugId === 'b2').length, historyBefore);
});

test('a fixer cannot verify their own fix, only QA verifies, and a reason is required', async () => {
  await startDemo('bug-gates');

  await assert.rejects(
    () => transitionBug('b5', { to: 'Verified', as: 'Delphine Roth' }),
    /fixer cannot Verify their own fix/,
  );
  await assert.rejects(
    () => transitionBug('b5', { to: 'Verified', as: 'Amara' }),
    /Only QA/,
  );
  const verified = await transitionBug('b5', { to: 'Verified', as: 'QA' });
  assert.equal(verified.status, 'Verified');

  await assert.rejects(
    () => transitionBug('b2', { to: 'Rejected', as: 'Amara' }),
    /reason is required/,
  );
  await assert.rejects(
    () => transitionBug('b2', { to: 'Rejected', as: 'Worker A', reason: 'Duplicate report' }),
    /Amara, QA or Steward/,
  );
  const rejected = await transitionBug('b2', { to: 'Rejected', as: 'Steward', reason: 'Duplicate report' });
  assert.equal(rejected.status, 'Rejected');
  assert.equal(rejected.workflowReason, 'Duplicate report');

  const legal = checkBugTransition(
    { id: 'x', status: 'Fixed', assignee: 'Someone' },
    'Verified',
    { as: 'QA', state: { team: [] } },
  );
  assert.equal(legal.ok, true);
});

test('the activity feed interleaves comments and history', async () => {
  await startDemo('bug-feed');
  const before = getState().bugComments.filter((row) => row.bugId === 'b2').length;
  await addBugComment('b2', 'A fresh comment for the feed.');
  await updateBug('b2', { title: 'Feed title edit' }, 'title');

  const state = getState();
  assert.equal(state.bugComments.filter((row) => row.bugId === 'b2').length, before + 1);
  const html = renderView(detailRoute('b2'), new URLSearchParams(), state);
  const feed = html.match(/<div class="feed">[\s\S]*?<\/div><form class="comment-form"/)?.[0] ?? '';
  assert.match(feed, /A fresh comment for the feed\./);
  assert.match(feed, /title: .* → Feed title edit/);
});
