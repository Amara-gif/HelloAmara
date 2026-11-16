import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TONES,
  badge,
  priorityTone,
  severityTone,
  statusTone,
  storageTone,
} from '../assets/js/tones.js';
import { BUG_SEVERITIES, BUG_STATUSES, TASK_WORKFLOW_CLASS } from '../assets/js/data.js';

const STORED_TONES = {
  'To do': 'band',
  'In progress': 'accent',
  Waiting: 'warning',
  Done: 'success',
};

const WORKFLOW_TONES = {
  New: 'band',
  Triaged: 'warning',
  'In progress': 'accent',
  Fixed: 'accent',
  Verified: 'success',
  Closed: 'success',
  Reopened: 'warning',
  Deferred: 'muted',
  'Wont fix': 'muted',
  Duplicate: 'muted',
  Rejected: 'danger',
};

const PRIORITY_TONES = {
  Highest: 'danger',
  High: 'danger',
  Medium: 'warning',
  Low: 'success',
  Lowest: 'muted',
};

const SEVERITY_TONES = {
  'S1 Blocker': 'danger',
  'S2 Critical': 'warning',
  'S3 Major': 'accent',
  'S4 Minor': 'muted',
};

test('TONES is the shared tone vocabulary', () => {
  assert.deepEqual([...TONES], [
    'neutral', 'accent', 'success', 'warning', 'danger', 'info', 'band', 'muted',
  ]);
});

test('every stored status has a tone', () => {
  const storedStatuses = [...new Set(Object.values(TASK_WORKFLOW_CLASS))];
  assert.deepEqual(storedStatuses.sort(), Object.keys(STORED_TONES).sort());
  for (const [status, tone] of Object.entries(STORED_TONES)) {
    assert.equal(statusTone(status), tone, status);
  }
});

test('every workflow in TASK_WORKFLOW_CLASS has a tone', () => {
  for (const status of Object.keys(TASK_WORKFLOW_CLASS)) {
    assert.equal(statusTone(status), WORKFLOW_TONES[status], status);
  }
});

test('every bug status has a tone', () => {
  assert.deepEqual([...BUG_STATUSES].sort(), Object.keys(WORKFLOW_TONES).sort());
  for (const status of BUG_STATUSES) {
    assert.equal(statusTone(status), WORKFLOW_TONES[status], status);
  }
});

test('every priority has a tone', () => {
  for (const [priority, tone] of Object.entries(PRIORITY_TONES)) {
    assert.equal(priorityTone(priority), tone, priority);
  }
});

test('every severity has a tone', () => {
  assert.deepEqual([...BUG_SEVERITIES].sort(), Object.keys(SEVERITY_TONES).sort());
  for (const severity of BUG_SEVERITIES) {
    assert.equal(severityTone(severity), SEVERITY_TONES[severity], severity);
  }
  assert.equal(severityTone('S1'), 'danger');
  assert.equal(severityTone('S2'), 'warning');
  assert.equal(severityTone('S3'), 'accent');
  assert.equal(severityTone('S4'), 'muted');
});

test('storage statuses keep their tones', () => {
  assert.equal(storageTone('Granted'), 'success');
  assert.equal(storageTone('Denied'), 'warning');
  assert.equal(storageTone('Unsupported'), 'muted');
});

test('unknown status, priority, severity and storage values are muted', () => {
  for (const value of [undefined, null, '', 'Blocked', 'new', 'S9 Blocker', 'Urgent', 'Unknown']) {
    assert.equal(statusTone(value), 'muted', `status ${String(value)}`);
    assert.equal(priorityTone(value), 'muted', `priority ${String(value)}`);
    assert.equal(severityTone(value), 'muted', `severity ${String(value)}`);
    assert.equal(storageTone(value), 'muted', `storage ${String(value)}`);
  }
});

test('badge returns the existing badge markup and escapes its label', () => {
  assert.equal(badge('New', 'band'), '<span class="badge badge-band">New</span>');
  assert.equal(
    badge('A & <B>', 'danger'),
    '<span class="badge badge-danger">A &amp; &lt;B&gt;</span>',
  );
  assert.equal(badge(undefined, 'muted'), '<span class="badge badge-muted"></span>');
  assert.equal(badge('Unknown tone', 'bogus'), '<span class="badge badge-muted">Unknown tone</span>');
});
