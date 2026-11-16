import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const styleguide = readFileSync(new URL('../styleguide.html', import.meta.url), 'utf8');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function rules(source) {
  return [...stripComments(source).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.replace(/\s+/g, ' ').trim(),
    body,
  }));
}

// Split on commas that are not nested inside :is(), :not() or :where().
function splitSelectors(selector) {
  const selectors = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ',' && depth === 0) {
      selectors.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selector.slice(start).trim());
  return selectors;
}

const componentRules = rules(css);
const pillBases = ['.tab', '.chip', '.nav-link'];
const selectedSuffixes = [
  '[aria-selected="true"]',
  '[aria-current]',
  '[aria-pressed="true"]',
  '.is-active',
];
const selectedSelectors = pillBases.flatMap((base) =>
  selectedSuffixes.map((suffix) => `${base}${suffix}`),
);

function ruleWithSelector(selector) {
  return componentRules.find((rule) => splitSelectors(rule.selector).includes(selector));
}

test('tabs, chips and nav links share one selected fill, text colour and weight', () => {
  const selectedRules = selectedSelectors.map((selector) => {
    const rule = ruleWithSelector(selector);
    assert.ok(rule, `components.css has a selected rule for ${selector}`);
    return rule;
  });

  for (const rule of selectedRules) {
    assert.match(
      rule.body,
      /(?:^|\n)\s*background:\s*var\(--color-nav-active\)\s*;/,
      `${rule.selector} uses the shared selected fill`,
    );
    assert.match(
      rule.body,
      /(?:^|\n)\s*color:\s*var\(--color-text\)\s*;/,
      `${rule.selector} uses the shared selected text colour`,
    );
    assert.match(
      rule.body,
      /(?:^|\n)\s*font-weight:\s*var\(--font-weight-semibold\)\s*;/,
      `${rule.selector} uses the shared selected weight`,
    );
  }

  assert.equal(
    new Set(selectedRules.map((rule) => rule.selector)).size,
    1,
    'the selected state lives in one shared selector list',
  );
});

test('a hovered chip uses a separate rule from the selected chip', () => {
  const hover = ruleWithSelector('.chip:hover');
  const selected = ruleWithSelector('.chip[aria-pressed="true"]');

  assert.ok(hover, 'components.css has a .chip:hover rule');
  assert.ok(selected, 'components.css has a selected chip rule');
  assert.notEqual(hover.selector, selected.selector, 'hover and selected are not combined');
  assert.doesNotMatch(hover.selector, /:is-active|\[aria-pressed|\[aria-selected|\[aria-current/);
  assert.doesNotMatch(selected.selector, /:hover/);
  assert.doesNotMatch(
    hover.body,
    /var\(--color-nav-active\)/,
    'hover must not reuse the selected fill',
  );
  assert.match(
    selected.body,
    /var\(--color-nav-active\)/,
    'the selected chip still uses the shared fill',
  );
});

test('styleguide shows tabs, chips and nav links in all four states', () => {
  for (const base of ['tab', 'chip', 'nav-link']) {
    assert.match(
      styleguide,
      new RegExp(`class="${base} is-hover"`),
      `styleguide shows the hovered ${base}`,
    );
    assert.match(
      styleguide,
      new RegExp(`class="${base} is-focus-visible"`),
      `styleguide shows the focus-visible ${base}`,
    );
  }

  assert.match(styleguide, /class="tab"[^>]*aria-selected="true"/, 'styleguide shows a selected tab');
  assert.match(styleguide, /class="chip"[^>]*aria-pressed="true"/, 'styleguide shows a selected chip');
  assert.match(
    styleguide,
    /class="nav-link"[^>]*aria-current="page"/,
    'styleguide shows a selected nav link',
  );
});

test('work-items toolbar and scope switch are defined', () => {
  const toolbar = ruleWithSelector('.task-toolbar');
  const scope = ruleWithSelector('.scope-switch');

  assert.ok(toolbar, 'components.css defines .task-toolbar');
  assert.ok(scope, 'components.css defines .scope-switch');

  for (const [name, rule] of [
    ['.task-toolbar', toolbar],
    ['.scope-switch', scope],
  ]) {
    assert.match(rule.body, /(?:^|\n)\s*display:\s*flex\s*;/, `${name} is a flex row`);
    assert.match(rule.body, /(?:^|\n)\s*flex-wrap:\s*wrap\s*;/, `${name} wraps`);
    assert.match(rule.body, /(?:^|\n)\s*align-items:\s*center\s*;/, `${name} centres its items`);
    assert.match(rule.body, /(?:^|\n)\s*gap:\s*var\(--space-/, `${name} uses spacing tokens`);
  }

  assert.match(
    scope.body,
    /(?:^|\n)\s*margin-left:\s*auto\s*;/,
    '.scope-switch sits at the end of the toolbar on desktop',
  );
  assert.match(styleguide, /class="task-toolbar"/, 'styleguide shows the work-items toolbar');
  assert.match(styleguide, /class="scope-switch"/, 'styleguide shows the scope switch');
});
