import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView, agentBrief, renderAgentTodo } from '../assets/js/views.js';
import { start, getState, createOrder, closeOrder, reopenOrder } from '../assets/js/data.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const route = { id: 'chat', path: '/chat', title: 'Team' };
const demoState = () => ({ ...buildDemoData().stores });

test('Team renders the Amara lead strip with the five inventory stat labels', () => {
  const html = renderView(route, new URLSearchParams(), demoState());

  assert.match(html, /class="card team-lead"/);
  assert.match(html, /id="team-lead-name">Amara</);
  assert.match(html, /You lead this team/);
  assert.equal((html.match(/class="stat"/g) ?? []).length, 5);
  for (const label of [
    'Decisions awaiting the lead',
    'Reviews ready',
    'People working',
    'Open work items',
    "Today's actions",
  ]) {
    assert.match(html, new RegExp(label));
  }
});

test('every agent card shows status, focus, workload counts, latest activity, composer and To-do', () => {
  const state = demoState();
  const html = renderView(route, new URLSearchParams(), state);

  assert.equal((html.match(/class="card team-card"/g) ?? []).length, state.team.length);
  for (const agent of state.team) {
    assert.match(html, new RegExp(`data-team-agent="${agent.name}"`));
    assert.match(html, new RegExp(`data-action="agent-todo" data-owner="${agent.name}"`));
    assert.match(html, new RegExp(`value="${agent.name}"`));
  }
  assert.match(html, /<dt>Focus<\/dt>/);
  assert.match(html, /<dt>Latest activity<\/dt>/);
  assert.match(html, /data-team-count="on-list"/);
  assert.match(html, /data-team-count="new-orders"/);
  assert.match(html, /data-team-count="today"/);
  assert.match(html, /data-form="order"/);
  assert.match(html, /<textarea[^>]+name="text"/);
  assert.match(html, />Send<\/button>/);
  assert.match(html, />To-do list<\/button>/);
  assert.match(html, />Copy brief<\/button>/);
  assert.match(html, />Open queue file<\/button>/);
});

test('the agent brief is plain text and the To-do panel offers copy, queue and reopen actions', () => {
  const state = demoState();
  const brief = agentBrief(state, 'Delphine Roth');
  assert.match(brief, /^Brief for Delphine Roth/);
  assert.match(brief, /Role: QA/);
  assert.match(brief, /Workload: \d+ open work item/);
  assert.match(brief, /Open orders:/);
  assert.match(brief, /Verify T-3 and T-9/);

  const panel = renderAgentTodo(state, 'Delphine Roth');
  assert.match(panel, /data-action="copy-brief" data-owner="Delphine Roth">Copy brief</);
  assert.match(panel, /data-action="open-queue-file" data-owner="Delphine Roth">Open queue file</);
  assert.match(panel, /data-action="close-order" data-id="o1">Close</);
  assert.match(panel, /href="#\/task\/t3"/);

  const closedPanel = renderAgentTodo(state, 'Ezra Boone');
  assert.match(closedPanel, /data-action="reopen-order" data-id="o3">Reopen</);
});

test('send, close and reopen an order on the Test account', async () => {
  accountId = tempAccountId('team-order');
  await start({ id: accountId, name: 'Team order test', test: true });

  await createOrder('Amara', 'Check the reopen flow end to end.');
  const created = getState().orders.find((order) => order.text === 'Check the reopen flow end to end.');
  assert.ok(created);
  assert.equal(created.open, true);

  const closed = await closeOrder(created.id);
  assert.equal(closed.open, false);
  assert.equal(getState().orders.find((order) => order.id === created.id).open, false);

  const reopened = await reopenOrder(created.id);
  assert.equal(reopened.open, true);
  assert.equal(getState().orders.find((order) => order.id === created.id).open, true);
});
