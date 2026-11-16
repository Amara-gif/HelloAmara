import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderCreateDialog, renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demoState = () => {
  const demo = buildDemoData();
  return { ...demo.stores, aiCalls: demo.stores.ai_calls, ...demo.meta };
};

const ROUTES = [
  ['tasks list', 'tasks', '/tasks', ''],
  ['tasks board', 'tasks', '/tasks', 'view=board'],
  ['tasks calendar', 'tasks', '/tasks', 'view=calendar'],
  ['tasks timeline', 'tasks', '/tasks', 'view=timeline'],
  ['tasks all scope', 'tasks', '/tasks', 'view=list&scope=all'],
  ['projects', 'projects', '/projects', ''],
  ['projects archived', 'projects', '/projects', 'archived=1'],
  ['files charts', 'files', '/files', ''],
  ['files agents', 'files', '/files', 'tab=agents'],
  ['settings', 'settings', '/settings', ''],
  ['settings AI', 'settings-ai', '/settings/ai', ''],
  ['settings language', 'settings-language', '/settings/language', ''],
  ['settings snapshots', 'settings-snapshots', '/settings/snapshots', ''],
  ['settings dispatch', 'settings-dispatch', '/settings/dispatch', ''],
  ['settings areas', 'settings-areas', '/settings/areas', ''],
  ['settings appearance', 'settings-appearance', '/settings/appearance', ''],
  ['project TAG', 'project-detail', '/project/TAG', '', { key: 'TAG' }],
  ['project TAG Rule Book', 'project-detail', '/project/TAG', 'tab=xbuild-standard', { key: 'TAG' }],
  ['project MR Products', 'project-detail', '/project/MR', 'tab=products', { key: 'MR' }],
  ['project RSL Work items', 'project-detail', '/project/RSL', 'tab=work', { key: 'RSL' }],
  ['project RSL calendar', 'project-detail', '/project/RSL', 'tab=work&view=calendar', { key: 'RSL' }],
];

const GROUP_CLASSES = new Set(['tabs', 'chip-row', 'scope-switch']);

function attribute(tag, name) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1];
}

// Return each tabs/chip-row/scope-switch block. The blocks used for selection
// contain only links, buttons and spans, so the first matching close tag ends it.
function selectionGroups(html) {
  const groups = [];
  const tagPattern = /<(div|nav)\b([^>]*)>/g;
  let match;
  while ((match = tagPattern.exec(html))) {
    const classValue = attribute(match[2], 'class') ?? '';
    const classes = classValue.split(/\s+/).filter(Boolean);
    if (!classes.some((name) => GROUP_CLASSES.has(name))) continue;

    const close = `</${match[1]}>`;
    const start = tagPattern.lastIndex;
    const end = html.indexOf(close, start);
    assert.ok(end >= 0, `unclosed ${match[1]} group`);
    groups.push({ classes, content: html.slice(start, end) });
    tagPattern.lastIndex = end + close.length;
  }
  return groups;
}

function selectionItems(group) {
  return [...group.content.matchAll(/<(a|button)\b([^>]*)>/g)]
    .map((match) => {
      const tag = match[1];
      const attributes = match[2];
      const classes = (attribute(attributes, 'class') ?? '').split(/\s+/).filter(Boolean);
      if (!classes.includes('tab') && !classes.includes('chip')) return null;
      if (tag === 'a') {
        const current = attribute(attributes, 'aria-current');
        return { tag, classes, kind: 'link', selected: current === 'page', current };
      }
      const role = attribute(attributes, 'role');
      if (role === 'tab') {
        const selectedValue = attribute(attributes, 'aria-selected');
        return { tag, classes, kind: 'tab', role, selected: selectedValue === 'true', selectedValue };
      }
      const pressed = attribute(attributes, 'aria-pressed');
      return { tag, classes, kind: 'toggle', selected: pressed === 'true', pressed };
    })
    .filter(Boolean);
}

function renderRoute([, id, path, query, params]) {
  return renderView(
    { id, path, title: id, ...(params ? { params } : {}) },
    new URLSearchParams(query),
    demoState(),
  );
}

function assertSelectedGroup(label, group) {
  const items = selectionItems(group);
  if (!items.length) return;
  const selected = items.filter((item) => item.selected);
  assert.equal(
    selected.length,
    1,
    `${label} ${group.classes.join('.')} has ${selected.length} selected items; expected exactly one`,
  );

  for (const item of items) {
    if (item.kind === 'tab') {
      assert.equal(item.role, 'tab', `${label} tab button is missing role="tab"`);
      assert.match(item.selectedValue ?? '', /^(true|false)$/, `${label} tab button is missing aria-selected`);
    } else if (item.kind === 'toggle') {
      assert.match(item.pressed ?? '', /^(true|false)$/, `${label} toggle button is missing aria-pressed`);
    } else if (item.selected) {
      assert.equal(item.current, 'page', `${label} selected link is missing aria-current="page"`);
    } else {
      assert.equal(item.current, undefined, `${label} unselected link still has aria-current`);
    }
  }
}

test('every rendered tab and chip group marks exactly one item selected with ARIA', () => {
  for (const route of ROUTES) {
    const html = renderRoute(route);
    const groups = selectionGroups(html).filter((group) => selectionItems(group).length);
    assert.ok(groups.length, `${route[0]} renders no tab or chip group`);
    for (const group of groups) assertSelectedGroup(route[0], group);
  }
});

test('the create dialog is a real tab widget with one aria-selected tab', () => {
  const html = renderCreateDialog(demoState(), { tab: 'bug' });
  const groups = selectionGroups(html).filter((group) => group.classes.includes('tabs'));
  assert.equal(groups.length, 1);
  const items = selectionItems(groups[0]);
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.kind === 'tab' && item.role === 'tab'));
  assert.deepEqual(items.map((item) => item.selected), [false, true, false]);
});

test('rating line-style toggles use aria-pressed without swapping button variants', () => {
  const ratings = {
    labels: ['27', '28'],
    series: [{ name: 'Roselite', values: [4.1, 4.2] }],
    hidden: [],
  };
  const buttonsFor = (lineStyle) => {
    const html = renderView(
      { id: 'rating-trend', path: '/rating-trend', title: 'Rating trend' },
      new URLSearchParams(),
      { ratings: { ...ratings, lineStyle } },
    );
    return [...html.matchAll(/<button[^>]*data-action="rating-line-style"[^>]*>/g)].map((match) => match[0]);
  };

  const smooth = buttonsFor('smooth');
  const straight = buttonsFor('straight');
  assert.equal(smooth.length, 2);
  assert.deepEqual(
    smooth.map((tag) => attribute(tag, 'class')),
    straight.map((tag) => attribute(tag, 'class')),
    'the active line style must not change a button variant',
  );
  for (const tag of [...smooth, ...straight]) {
    assert.doesNotMatch(tag, /\bbtn-(?:primary|ghost)\b/, 'selected state must not swap btn-primary/btn-ghost');
    assert.equal(attribute(tag, 'class'), 'chip');
  }
  assert.deepEqual(smooth.map((tag) => attribute(tag, 'aria-pressed')), ['true', 'false']);
  assert.deepEqual(straight.map((tag) => attribute(tag, 'aria-pressed')), ['false', 'true']);

  const source = readFileSync(new URL('../assets/js/views.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /active\s*\?\s*'btn-primary'\s*:\s*'btn-ghost'/);
});

test('the sidebar current route is marked with aria-current, not a selected class', () => {
  const source = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const updateNav = /function updateNav\(route\) \{[\s\S]*?\n\}/.exec(source)?.[0] ?? '';
  assert.match(updateNav, /setAttribute\('aria-current', 'page'\)/);
  assert.doesNotMatch(updateNav, /classList\.(?:add|toggle)\('(?:active|is-active)'/);
});
