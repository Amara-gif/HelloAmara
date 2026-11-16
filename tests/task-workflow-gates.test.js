import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import {
  start, getState, updateTask, transitionTask, reviewTask,
  workflowForStoredStatus, taskWorkflowTargets, checkTaskTransition, attachmentsFingerprint,
} from '../assets/js/data.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const detailRoute = { id: 'task-detail', path: '/task/t1', title: 'Work item', params: { id: 't1' } };

function workflowForm(html) {
  const match = html.match(/data-form="task-workflow"[\s\S]*?<\/form>/);
  assert.ok(match, 'workflow form must exist');
  return match[0];
}

async function startDemo(label) {
  accountId = tempAccountId(label);
  await start({ id: accountId, name: 'Workflow gate test', test: true });
}

test('workflow map derives the trusted status and only legal target options render', () => {
  const state = { ...buildDemoData().stores };
  assert.equal(workflowForStoredStatus('Waiting', 'Fixed'), 'Fixed');
  assert.equal(workflowForStoredStatus('Done', 'Fixed'), 'Closed', 'a mismatched workflow falls back to the stored status');
  assert.deepEqual(taskWorkflowTargets({ status: 'To do', workflow: 'New' }), ['Triaged', 'Duplicate', 'Rejected', 'Deferred']);

  const form = workflowForm(renderView(detailRoute, new URLSearchParams(), state));
  for (const target of ['Triaged', 'Duplicate', 'Rejected', 'Deferred']) assert.match(form, new RegExp(`value="${target}"`));
  for (const illegal of ['In progress', 'Fixed', 'Verified', 'Closed', 'Reopened', 'Wont fix']) {
    assert.doesNotMatch(form, new RegExp(`value="${illegal}"`), `${illegal} is not a legal target from New`);
  }
  assert.match(form, /name="as"/);
  assert.match(form, /name="reason"/);

  const waitingForm = workflowForm(renderView({ ...detailRoute, params: { id: 't3' } }, new URLSearchParams(), state));
  assert.match(waitingForm, /value="Verified"/);
  assert.match(waitingForm, /value="Reopened"/);
  assert.doesNotMatch(waitingForm, /value="New"/);
});

test('illegal moves are refused before any write', async () => {
  await startDemo('illegal-move');
  const before = getState().tasks.find((row) => row.id === 't1');
  const historyBefore = getState().taskHistory.filter((row) => row.taskId === 't1').length;

  await assert.rejects(
    () => transitionTask('t1', { to: 'Verified', as: 'QA' }),
    /Cannot move from New to Verified/
  );

  const after = getState().tasks.find((row) => row.id === 't1');
  assert.equal(after.status, before.status);
  assert.equal(after.workflow, before.workflow);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal(getState().taskHistory.filter((row) => row.taskId === 't1').length, historyBefore);
});

test('Verified and Closed need an acting QA, and waiver/reason gates apply', async () => {
  await startDemo('workflow-gates');

  await assert.rejects(
    () => transitionTask('t3', { to: 'Verified', as: 'Amara' }),
    /Only QA/
  );
  const verified = await transitionTask('t3', { to: 'Verified', as: 'QA' });
  assert.equal(verified.status, 'Done');
  assert.equal(verified.workflow, 'Verified');
  const closed = await transitionTask('t3', { to: 'Closed', as: 'Delphine Roth' });
  assert.equal(closed.workflow, 'Closed');

  await assert.rejects(
    () => transitionTask('t1', { to: 'Rejected', as: 'Amara' }),
    /reason is required/
  );
  await assert.rejects(
    () => transitionTask('t1', { to: 'Rejected', as: 'Worker A', reason: 'Duplicate report' }),
    /Amara, QA or Steward/
  );
  const rejected = await transitionTask('t1', { to: 'Rejected', as: 'Steward', reason: 'Duplicate report' });
  assert.equal(rejected.status, 'Done');
  assert.equal(rejected.workflow, 'Rejected');
  assert.match(rejected.notes, /\[免核 /);
  assert.match(rejected.workflowReason, /Duplicate report/);
});

test('a move keeps the stored status in step with the chosen workflow class', async () => {
  await startDemo('move-class');
  const moved = await transitionTask('t1', { to: 'Triaged', as: 'Amara' });
  assert.equal(moved.workflow, 'Triaged');
  assert.equal(moved.status, 'To do');

  const waiting = checkTaskTransition(
    { status: 'In progress', workflow: 'In progress' },
    'Fixed',
    { state: { team: [] }, as: 'Amara' }
  );
  assert.equal(waiting.ok, true);
  assert.equal(waiting.storedStatus, 'Waiting');
});

test('review decisions persist and become stale when the attachment list changes', async () => {
  await startDemo('review-fingerprint');
  const reviewed = await reviewTask('t1', 'approve', { comment: 'Checked the recording.' });
  assert.equal(reviewed.reviewed, true);
  assert.equal(reviewed.reviewDecision, 'approve');
  assert.equal(reviewed.review.comment, 'Checked the recording.');
  assert.equal(reviewed.reviewStale, false);
  assert.equal(reviewed.reviewFingerprint, attachmentsFingerprint(reviewed.attachments));

  const history = getState().taskHistory.filter((row) => row.taskId === 't1' && row.field === 'reviewDecision');
  assert.ok(history.length >= 1, 'the decision is written to history');

  const changed = await updateTask('t1', { attachments: [...reviewed.attachments, { name: 'new-recording.mp4', kind: 'video' }] });
  assert.equal(changed.reviewStale, true, 'changing deliverables marks the decision stale');
  assert.equal(changed.reviewDecision, 'approve', 'the old decision is kept for the stale notice');
  assert.equal(changed.reviewed, true);

  const changes = await reviewTask('t1', 'changes', { comment: 'Please shorten the clip.' });
  assert.equal(changes.reviewDecision, 'changes');
  assert.equal(changes.reviewed, false);
  assert.equal(changes.reviewStale, false);
  assert.equal(changes.review.comment, 'Please shorten the clip.');
});

test('the detail page exposes #tskComment for Ctrl+Enter comment posting', () => {
  const state = { ...buildDemoData().stores };
  const html = renderView(detailRoute, new URLSearchParams(), state);
  assert.match(html, /<textarea id="tskComment" name="body"/);
  assert.match(html, /data-form="task-comment"/);
});
