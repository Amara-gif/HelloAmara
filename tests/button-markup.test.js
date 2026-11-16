import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demoState = () => {
  const demo = buildDemoData();
  return { ...demo.stores, aiCalls: demo.stores.ai_calls, ...demo.meta };
};

const VARIANTS = ['btn-primary', 'btn-secondary', 'btn-ghost', 'btn-danger'];
const SIZES = ['btn-sm', 'btn-md'];

const ROUTES = [
  { id: 'home', path: '/' },
  { id: 'mywork', path: '/mywork' },
  { id: 'pages', path: '/pages' },
  { id: 'projects', path: '/projects' },
  { id: 'tasks', path: '/tasks' },
  { id: 'tasks-board', path: '/tasks', query: 'view=board' },
  { id: 'calendar', path: '/calendar' },
  { id: 'bugs', path: '/bugs' },
  { id: 'chat', path: '/chat' },
  { id: 'files', path: '/files' },
  { id: 'settings', path: '/settings' },
  { id: 'settings-ai', path: '/settings/ai' },
  { id: 'settings-language', path: '/settings/language' },
  { id: 'settings-snapshots', path: '/settings/snapshots' },
  { id: 'settings-dispatch', path: '/settings/dispatch' },
  { id: 'settings-areas', path: '/settings/areas' },
  { id: 'settings-appearance', path: '/settings/appearance' },
  { id: 'bug-new', path: '/bugs/new' },
  { id: 'rating-trend', path: '/rating-trend' },
  { id: 'page-new', path: '/pages/new' },
  { id: 'task-detail', path: '/task/t1', params: { id: 't1' } },
  { id: 'bug-detail', path: '/bug/b1', params: { id: 'b1' } },
  { id: 'project-detail', path: '/project/TAG', params: { key: 'TAG' } },
  { id: 'page-edit', path: '/page/pg1/edit', params: { id: 'pg1' } },
  { id: 'page-view', path: '/page/pg1', params: { id: 'pg1' } },
];

const SOURCE_FILES = ['assets/js/views.js', 'assets/js/app.js', 'assets/js/ui.js', 'index.html'];

function classAttributes(html) {
  return [...html.matchAll(/\bclass="([^"]*)"/g)].map((match) => match[1]);
}

function renderRoute(route) {
  return renderView(
    { id: route.id, path: route.path, title: route.id, ...(route.params ? { params: route.params } : {}) },
    new URLSearchParams(route.query ?? ''),
    demoState(),
  );
}

function assertCanonicalButtonClasses(html, label) {
  assert.doesNotMatch(html, /\blink-button\b/, `${label} still emits the retired link-button class`);

  for (const classes of classAttributes(html)) {
    const tokens = classes.split(/\s+/).filter(Boolean);
    if (!tokens.includes('btn')) continue;

    const variantIndex = tokens.findIndex((token) => VARIANTS.includes(token));
    assert.ok(variantIndex !== -1, `${label} renders a button without a variant: class="${classes}"`);
    assert.equal(tokens[0], 'btn', `${label} must start a button class with btn: class="${classes}"`);

    const sizeIndex = tokens.findIndex((token) => SIZES.includes(token));
    if (sizeIndex !== -1) {
      assert.ok(
        variantIndex < sizeIndex,
        `${label} puts the size before the variant: class="${classes}"`,
      );
    }
  }
}

test('every button on the main routes has a variant in canonical order', () => {
  for (const route of ROUTES) {
    assertCanonicalButtonClasses(renderRoute(route), route.path);
  }
});

test('index.html static buttons use a variant in canonical order', () => {
  assertCanonicalButtonClasses(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), 'index.html');
});

test('button sources do not regress to bare btn, size-first order or link-button', () => {
  for (const file of SOURCE_FILES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bclass=["']btn["']/, `${file} still has a bare btn class`);
    assert.doesNotMatch(source, /\bclassName\s*=\s*['"]btn['"]/, `${file} still has a bare btn className`);
    assert.doesNotMatch(source, /\bclass=["']btn btn-(?:sm|md) btn-/, `${file} puts a size before a variant`);
    assert.doesNotMatch(source, /\blink-button\b/, `${file} still emits link-button`);
  }
});
