import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demoState = () => {
  const demo = buildDemoData();
  return { ...demo.stores, aiCalls: demo.stores.ai_calls, ...demo.meta };
};

const SPECIAL_INPUT_TYPES = new Set(['hidden', 'checkbox', 'radio', 'range', 'color', 'file']);

const ROUTES = [
  ['home', '/'],
  ['pages', '/pages'],
  ['mywork', '/mywork'],
  ['tasks-list', '/tasks'],
  ['tasks-board', '/tasks', 'view=board'],
  ['calendar', '/calendar'],
  ['bugs', '/bugs'],
  ['chat', '/chat'],
  ['files', '/files'],
  ['settings', '/settings'],
  ['settings-ai', '/settings/ai'],
  ['settings-language', '/settings/language'],
  ['settings-snapshots', '/settings/snapshots'],
  ['settings-dispatch', '/settings/dispatch'],
  ['settings-areas', '/settings/areas'],
  ['settings-appearance', '/settings/appearance'],
];

// Read opening form-control tags without assuming a DOM. Quoted attribute
// values may contain ">" or "/" characters, so the scan tracks the quote.
function controlTags(html) {
  const tags = [];
  for (let index = 0; index < html.length; index += 1) {
    if (html[index] !== '<') continue;
    const kind = /^<(input|select|textarea)(?=[\s>])/.exec(html.slice(index, index + 12));
    if (!kind) continue;
    let quote = null;
    let end = -1;
    for (let cursor = index; cursor < html.length; cursor += 1) {
      const character = html[cursor];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        end = cursor;
        break;
      }
    }
    assert.ok(end >= 0, `unclosed <${kind[1]}> tag`);
    tags.push({ kind: kind[1], tag: html.slice(index, end + 1) });
    index = end;
  }
  return tags;
}

function attribute(tag, name) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1];
}

function classesOf(tag) {
  return (attribute(tag, 'class') ?? '').split(/\s+/).filter(Boolean);
}

function isExcludedInput({ kind, tag }) {
  return kind === 'input' && SPECIAL_INPUT_TYPES.has((attribute(tag, 'type') ?? 'text').toLowerCase());
}

function renderRoute([, path, query = '']) {
  const id = path === '/' ? 'home' : path.split('/').filter(Boolean).join('-').replace(/^tasks$/, 'tasks');
  return renderView({ id, path, title: path }, new URLSearchParams(query), demoState());
}

test('every text-like input, select and textarea in the main routes has the control class', () => {
  for (const route of ROUTES) {
    const html = renderRoute(route);
    const tags = controlTags(html);

    for (const control of tags) {
      if (isExcludedInput(control)) continue;
      const classes = classesOf(control.tag);
      assert.ok(
        classes.includes('control'),
        `${route[0]} renders <${control.kind}> without class="control": ${control.tag}`,
      );
      assert.ok(!classes.includes('input'), `${route[0]} still uses the old .input alias`);
      assert.ok(!classes.includes('select'), `${route[0]} still uses the old .select alias`);
    }
  }
});

test('the project-status select and every other select and textarea carry control', () => {
  const state = demoState();
  const projects = renderView({ id: 'projects', path: '/projects' }, new URLSearchParams(), state);
  const status = controlTags(projects).find(
    ({ kind, tag }) => kind === 'select' && attribute(tag, 'id') === 'project-status',
  );
  assert.ok(status, 'the Add project form renders #project-status');
  assert.ok(classesOf(status.tag).includes('control'), '#project-status uses the shared control class');

  for (const route of ROUTES) {
    for (const control of controlTags(renderRoute(route))) {
      if (control.kind === 'input') continue;
      assert.ok(
        classesOf(control.tag).includes('control'),
        `${route[0]} renders <${control.kind}> without class="control": ${control.tag}`,
      );
    }
  }
});

test('hidden, checkbox, radio, range, colour and file inputs are left outside the control rule', () => {
  const seenTypes = new Set();
  for (const route of ROUTES) {
    for (const control of controlTags(renderRoute(route))) {
      if (!isExcludedInput(control)) continue;
      const type = attribute(control.tag, 'type').toLowerCase();
      seenTypes.add(type);
      assert.ok(!classesOf(control.tag).includes('control'), `${route[0]} adds .control to a ${type} input`);
    }
  }

  for (const type of ['hidden', 'checkbox', 'range', 'color', 'file']) {
    assert.ok(seenTypes.has(type), `the route set renders a ${type} input to keep unchanged`);
  }
});

test('board Move-to and toolbar filters use the compact control size', () => {
  const state = demoState();
  const board = renderView(
    { id: 'tasks', path: '/tasks', title: 'All work items' },
    new URLSearchParams('view=board'),
    state,
  );
  const move = controlTags(board).find(({ tag }) => attribute(tag, 'data-move-task'));
  assert.ok(move, 'the board renders a Move-to select');
  assert.deepEqual(classesOf(move.tag), ['control', 'control-sm']);

  for (const [name, path] of [
    ['My work', '/mywork'],
    ['Pages', '/pages'],
    ['All work items', '/tasks'],
    ['Bugs', '/bugs'],
  ]) {
    const html = renderRoute([name, path]);
    const forms = [...html.matchAll(/<form[^>]*class="[^"]*\btoolbar\b[^"]*"[^>]*>[\s\S]*?<\/form>/g)].map((match) => match[0]);
    assert.ok(forms.length > 0, `${name} renders a toolbar filter form`);
    for (const form of forms) {
      for (const control of controlTags(form)) {
        if (isExcludedInput(control)) continue;
        const classes = classesOf(control.tag);
        assert.ok(classes.includes('control-sm'), `${name} toolbar filter is not compact: ${control.tag}`);
      }
    }
  }
});
