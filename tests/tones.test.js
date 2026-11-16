import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TONES,
  badge,
  priorityTone,
  severityTone,
  statusTone,
  storageTone,
} from '../assets/js/tones.js';
import { BUG_SEVERITIES, BUG_STATUSES, TASK_WORKFLOW_CLASS } from '../assets/js/data.js';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const css = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const styleguide = readFileSync(new URL('../styleguide.html', import.meta.url), 'utf8');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stripComments(source).match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^{}]*)\\}`));
  return match?.[1] ?? '';
}

function classesOf(value) {
  return String(value ?? '').split(/\s+/).filter(Boolean);
}

function hasClass(markup, ...names) {
  return [...markup.matchAll(/class="([^"]*)"/g)].some(([, value]) => {
    const classes = classesOf(value);
    return names.every((name) => classes.includes(name));
  });
}

function priorityPills(html) {
  return [...html.matchAll(/<span class="([^"]*\bpriority\b[^"]*)"[^>]*><span class="([^"]*)"[^>]*><\/span>([^<]*)<\/span>/g)]
    .map(([, outer, dot, label]) => ({ outer: classesOf(outer), dot: classesOf(dot), label }));
}

function hasBadge(html, label, tone) {
  return [...html.matchAll(/<span class="([^"]*)"[^>]*>([^<]*)<\/span>/g)].some(([, value, text]) => {
    const classes = classesOf(value);
    return text === label && classes.includes('badge') && classes.includes(`badge-${tone}`);
  });
}

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


test('priority renders a badge with the shared tone and dot on every surface', () => {
  const state = { ...buildDemoData().stores };
  const surfaces = [
    ['list', { id: 'tasks', path: '/tasks', title: 'All work items' }, 'scope=all'],
    ['board', { id: 'tasks', path: '/tasks', title: 'All work items' }, 'view=board&scope=all'],
    ['task detail', { id: 'task-detail', path: '/task/t1', title: 'Work item', params: { id: 't1' } }, ''],
    ['Bugs', { id: 'bugs', path: '/bugs', title: 'Bugs' }, ''],
    ['bug detail', { id: 'bug-detail', path: '/bug/b2', title: 'Bug', params: { id: 'b2' } }, ''],
  ];

  assert.ok(hasClass(styleguide, 'badge', 'priority'), 'styleguide shows the priority badge shape');
  assert.ok(hasClass(styleguide, 'calendar-item', 'calendar-item-bug'), 'styleguide shows the bug calendar pill');

  for (const [name, route, query] of surfaces) {
    const html = renderView(route, new URLSearchParams(query), state);
    const pills = priorityPills(html);
    assert.ok(pills.length, `${name} renders a priority pill`);
    for (const pill of pills) {
      assert.ok(pill.outer.includes('badge'), `${name} priority uses .badge`);
      assert.ok(pill.outer.includes('priority'), `${name} priority keeps .priority`);
      assert.ok(
        pill.outer.includes(`badge-${priorityTone(pill.label)}`),
        `${name} priority ${pill.label} uses its tone`,
      );
      assert.ok(pill.dot.includes('badge-dot'), `${name} priority uses .badge-dot`);
      assert.ok(pill.dot.includes('priority-dot'), `${name} priority keeps .priority-dot`);
    }
  }
});

test('severity renders as a badge with its shared tone on every surface', () => {
  const state = { ...buildDemoData().stores };
  const surfaces = [
    ['list', { id: 'tasks', path: '/tasks', title: 'All work items' }, 'scope=all', 'S3 Major'],
    ['task detail', { id: 'task-detail', path: '/task/t1', title: 'Work item', params: { id: 't1' } }, '', 'S3 Major'],
    ['Bugs', { id: 'bugs', path: '/bugs', title: 'Bugs' }, '', 'S2 Critical'],
    ['bug detail', { id: 'bug-detail', path: '/bug/b2', title: 'Bug', params: { id: 'b2' } }, '', 'S2 Critical'],
  ];

  for (const [name, route, query, severity] of surfaces) {
    const html = renderView(route, new URLSearchParams(query), state);
    assert.ok(
      hasBadge(html, severity, severityTone(severity)),
      `${name} renders ${severity} with its badge tone`,
    );
  }
});

test('priority-dot and calendar pills use token sizes and tone colours', () => {
  const dot = ruleBody(css, '.priority-dot');
  assert.match(dot, /(?:^|\n)\s*width:\s*var\(--size-badge-dot\)\s*;/);
  assert.match(dot, /(?:^|\n)\s*height:\s*var\(--size-badge-dot\)\s*;/);
  assert.doesNotMatch(dot, /(?:^|\n)\s*(?:width|height):\s*\d+px\s*;/);

  const item = ruleBody(css, '.calendar-item');
  assert.match(item, /(?:^|\n)\s*border-radius:\s*var\(--radius-sm\)\s*;/);
  assert.doesNotMatch(item, /(?:^|\n)\s*border-radius:\s*\d+px\s*;/);

  const bug = ruleBody(css, '.calendar-item-bug');
  assert.match(bug, /(?:^|\n)\s*background:\s*var\(--color-danger-soft\)\s*;/);
  assert.match(bug, /(?:^|\n)\s*color:\s*var\(--color-danger\)\s*;/);
  assert.doesNotMatch(bug, /(?:^|\n)\s*background:\s*var\(--color-danger\)\s*;/);
  assert.doesNotMatch(bug, /(?:^|\n)\s*color:\s*var\(--color-on-danger\)\s*;/);

  for (const [selector, tone] of [
    ['.calendar-item-task', 'accent'],
    ['.calendar-item-project', 'band'],
    ['.calendar-item-event', 'success'],
  ]) {
    const body = ruleBody(css, selector);
    assert.ok(body.trim(), `${selector} keeps its tone rule`);
    const expected = {
      accent: ['--color-accent-soft', '--color-accent-strong'],
      band: ['--color-band', '--color-text-secondary'],
      success: ['--color-success-soft', '--color-success'],
    }[tone];
    assert.match(body, new RegExp(`background:\\s*var\\(${expected[0]}\\)\\s*;`));
    assert.match(body, new RegExp(`color:\\s*var\\(${expected[1]}\\)\\s*;`));
  }
});
