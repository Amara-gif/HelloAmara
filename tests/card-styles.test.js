import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { ROUTES } from '../assets/js/routes.js';

const css = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');
const styleguide = readFileSync(new URL('../styleguide.html', import.meta.url), 'utf8');

const FLAT_SURFACES = ['.stat', '.board-card', '.toolbar', '.note', '.chart-box'];

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

function ruleWithSelector(selector) {
  return componentRules.find((rule) => splitSelectors(rule.selector).includes(selector));
}

function hasClass(markup, name) {
  return [...markup.matchAll(/class="([^"]*)"/g)].some(([, value]) =>
    value.split(/\s+/).includes(name),
  );
}

function declarations(body) {
  return new Map(
    [...body.matchAll(/(?:^|\n)\s*([a-z-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

test('tokens.css defines one flat radius and one dialog radius', () => {
  assert.match(tokens, /--surface-flat-radius\s*:\s*var\(--radius-md\)\s*;/);
  assert.match(tokens, /--surface-dialog-radius\s*:\s*var\(--radius-lg\)\s*;/);
});

test('.stat, .board-card, .toolbar, .note and .chart-box share one surface block', () => {
  const shared = componentRules.find((rule) => {
    const selectors = splitSelectors(rule.selector);
    return FLAT_SURFACES.every((selector) => selectors.includes(selector));
  });

  assert.ok(shared, 'the five flat boxes share one declaration block');

  const body = declarations(shared.body);
  assert.equal(body.get('padding'), 'var(--space-4)');
  assert.equal(body.get('border'), 'var(--border-width) solid var(--color-divider)');
  assert.equal(body.get('background'), 'var(--color-surface)');
  assert.equal(body.get('border-radius'), 'var(--surface-flat-radius)');
});

test('the card uses the live card radius and the flat aliases use the flat radius', () => {
  const card = ruleWithSelector('.card');
  assert.ok(card, 'components.css defines .card');
  assert.equal(declarations(card.body).get('border-radius'), 'var(--radius-card)');

  for (const selector of ['.card-flat', '.card-stat', ...FLAT_SURFACES]) {
    const rule = ruleWithSelector(selector);
    assert.ok(rule, `components.css defines ${selector}`);
    const body = declarations(rule.body);
    assert.ok(
      body.get('border-radius') === 'var(--surface-flat-radius)' ||
        body.get('border-radius') === undefined,
      `${selector} uses the flat surface radius`,
    );
  }
});

test('flat surface rules contain no raw pixel radii', () => {
  const targetRules = componentRules.filter((rule) =>
    splitSelectors(rule.selector).some((selector) =>
      ['.card', '.card-flat', '.card-stat', ...FLAT_SURFACES].includes(selector),
    ),
  );

  assert.ok(targetRules.length > 0, 'found the card and flat surface rules');
  for (const rule of targetRules) {
    assert.doesNotMatch(rule.body, /border-radius\s*:[^;]*\d+px/, `${rule.selector} has a raw radius`);
  }
});

test('.card-interactive owns the hover lift and the dead .card-link alias is gone', () => {
  const interactive = componentRules.find((rule) =>
    splitSelectors(rule.selector).includes('.card-interactive'),
  );
  assert.ok(interactive, 'components.css defines .card-interactive');

  const hover = componentRules.find(
    (rule) =>
      splitSelectors(rule.selector).includes('.card-interactive:hover') &&
      /transform\s*:\s*translateY\(-2px\)\s*;/.test(rule.body),
  );
  assert.ok(hover, '.card-interactive lifts on hover');
  assert.match(hover.body, /box-shadow\s*:\s*var\(--shadow-lg\)\s*;/);

  assert.equal(
    ruleWithSelector('.card-link'),
    undefined,
    '.card-link is not kept as a dead compatibility alias',
  );
});

test('.modal, .auth-card and .toast use the dialog radius', () => {
  for (const selector of ['.modal', '.auth-card', '.toast']) {
    const rule = ruleWithSelector(selector);
    assert.ok(rule, `components.css defines ${selector}`);
    assert.equal(
      declarations(rule.body).get('border-radius'),
      'var(--surface-dialog-radius)',
      `${selector} uses the dialog radius`,
    );
    assert.doesNotMatch(rule.body, /border-radius\s*:[^;]*\d+px/, `${selector} has a raw radius`);
  }
});

const MAIN_ROUTES = ['home', 'mywork', 'pages', 'tasks', 'calendar', 'bugs', 'chat', 'files', 'settings'];
const demoState = () => {
  const { stores, meta } = buildDemoData();
  return {
    ...stores,
    ...meta,
    aiCalls: stores.ai_calls,
    bugHistory: stores.bug_history,
    bugComments: stores.bug_comments,
    taskHistory: stores.task_history,
    taskComments: stores.task_comments,
  };
};

function cardHeadMarkup(html) {
  const heads = [];
  const marker = 'class="card-head"';
  let cursor = 0;

  while ((cursor = html.indexOf(marker, cursor)) !== -1) {
    const start = html.lastIndexOf('<', cursor);
    const body = html.indexOf('class="card-body"', cursor);
    const summaryEnd = html.indexOf('</summary>', cursor);
    const ends = [body, summaryEnd].filter((index) => index !== -1);
    const stop = ends.length ? Math.min(...ends) : html.indexOf('>', cursor) + 1;
    heads.push(html.slice(start, stop));
    cursor = stop;
  }

  return heads;
}

test('every card head title on the main routes carries the one card-title class', () => {
  let renderedHeads = 0;

  for (const id of MAIN_ROUTES) {
    const html = renderView({ id, ...ROUTES[id] }, new URLSearchParams(), demoState());
    const heads = cardHeadMarkup(html);
    renderedHeads += heads.length;

    for (const head of heads) {
      assert.doesNotMatch(
        head,
        /<h2(?![^>]*\bclass="[^"]*\bcard-title\b)/,
        `${id} has an unclassed h2 inside a card head`,
      );
      assert.match(
        head,
        /<(?:h[1-6]|span)\b[^>]*\bclass="[^"]*\bcard-title\b/,
        `${id} card head title carries card-title`,
      );
    }
  }

  assert.ok(renderedHeads > 0, 'the main routes render card heads to check');
});

test('the styleguide shows a card, flat card, interactive card, stat card and dialog', () => {
  assert.ok(hasClass(styleguide, 'card'), 'styleguide shows .card');
  assert.ok(hasClass(styleguide, 'card-flat'), 'styleguide shows .card-flat');
  assert.ok(hasClass(styleguide, 'card-interactive'), 'styleguide shows .card-interactive');
  assert.ok(hasClass(styleguide, 'card-stat'), 'styleguide shows .card-stat');
  assert.ok(hasClass(styleguide, 'modal'), 'styleguide shows a .modal dialog');
});
