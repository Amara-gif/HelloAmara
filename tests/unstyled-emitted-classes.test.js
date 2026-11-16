import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const sources = [
  ['assets/js/views.js', read('../assets/js/views.js')],
  ['assets/js/app.js', read('../assets/js/app.js')],
  ['assets/js/ui.js', read('../assets/js/ui.js')],
  ['index.html', read('../index.html')],
];

const components = read('../assets/css/components.css');
const tokens = read('../assets/css/tokens.css');
const styleguide = read('../styleguide.html');

// Classes used only to find or mutate nodes in JS may stay unstyled. Prefer a
// data-* attribute for a new hook; add the class here only when the DOM state
// itself must be observable as a class.
const JS_HOOKS = new Set([]);

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssClasses(source) {
  const classes = new Set();
  const clean = stripComments(source);
  for (const match of clean.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(match[1]);
  return classes;
}

// Return the literal slices of a class value, dropping every ${...} expression.
// A class fragment that ends in a hyphen is only a prefix for a computed class
// name (for example badge-${tone}), so it is not a class of its own.
function literalSegments(value) {
  const segments = [];
  let segment = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '$' || value[index + 1] !== '{') {
      segment += value[index];
      continue;
    }

    segments.push(segment);
    segment = '';
    let depth = 1;
    index += 2;

    while (index < value.length && depth > 0) {
      const character = value[index];
      if (character === "'" || character === '"' || character === '`') {
        const quote = character;
        index += 1;
        while (index < value.length) {
          if (value[index] === '\\') index += 2;
          else if (value[index] === quote) {
            index += 1;
            break;
          } else index += 1;
        }
        continue;
      }
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      index += 1;
    }
    index -= 1;
  }

  segments.push(segment);
  return segments;
}

// Pull the class literals out of the result arms of a ${...} expression. A
// comparison string such as page.type === 'Snapshot' is before the ? and is not
// a class name; a prefix such as badge- is joined to the selected arm.
function conditionalClassValues(value) {
  const values = [];

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '$' || value[index + 1] !== '{') continue;

    let cursor = index + 2;
    let depth = 1;
    let expression = '';

    while (cursor < value.length && depth > 0) {
      const character = value[cursor];
      if (character === "'" || character === '"' || character === '`') {
        const quote = character;
        expression += character;
        cursor += 1;
        while (cursor < value.length) {
          expression += value[cursor];
          if (value[cursor] === '\\') {
            expression += value[cursor + 1] ?? '';
            cursor += 2;
            continue;
          }
          if (value[cursor] === quote) {
            cursor += 1;
            break;
          }
          cursor += 1;
        }
        continue;
      }
      if (character === '{') depth += 1;
      if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      }
      expression += character;
      cursor += 1;
    }

    let prefixStart = index - 1;
    let prefix = '';
    while (prefixStart >= 0 && !/\s/.test(value[prefixStart])) {
      prefix = value[prefixStart] + prefix;
      prefixStart -= 1;
    }

    for (const literal of expression.matchAll(/(["'])([\s\S]*?)\1/g)) {
      let before = literal.index - 1;
      while (before >= 0 && /\s/.test(expression[before])) before -= 1;
      if (expression[before] !== '?' && expression[before] !== ':') continue;

      let text = literal[2];
      if (!text) continue;
      if (prefix.endsWith('-') && !/^\s/.test(text)) text = `${prefix}${text}`;
      values.push(text);
    }

    index = cursor - 1;
  }

  return values;
}

function addTokens(text, classes) {
  for (const token of text.split(/\s+/)) {
    if (!token || token.endsWith('-') || token.startsWith('-')) continue;
    if (!/^[_a-zA-Z][\w-]*$/.test(token)) continue;
    classes.add(token);
  }
}

function addValueClasses(value, classes) {
  for (const segment of literalSegments(value)) addTokens(segment, classes);
  for (const conditional of conditionalClassValues(value)) addTokens(conditional, classes);
}

function addClassAttributeClasses(source, classes) {
  for (const match of source.matchAll(/\bclass\s*=\s*(["'])([\s\S]*?)\1/g)) {
    addValueClasses(match[2], classes);
  }
}

function addClassListClasses(source, classes) {
  for (const match of source.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
    for (const literal of match[1].matchAll(/(["'])([\s\S]*?)\1/g)) {
      addValueClasses(literal[2], classes);
    }
  }
}

function addClassNameClasses(source, classes) {
  for (const match of source.matchAll(/\.className\s*=\s*(["'`])([\s\S]*?)\1/g)) {
    addValueClasses(match[2], classes);
  }
}

// ui.js creates every node through its el(tag, className) helper. Return the
// class literals from the second argument without treating comparison strings
// such as size === 'lg' as class names.
function addElementHelperClasses(source, classes) {
  for (const match of source.matchAll(/\bel\(([^\n]*)\)/g)) {
    const args = match[1];
    let quote = '';
    let depth = 0;
    let comma = -1;

    for (let index = 0; index < args.length; index += 1) {
      const character = args[index];
      if (quote) {
        if (character === '\\') index += 1;
        else if (character === quote) quote = '';
        continue;
      }
      if (character === "'" || character === '"' || character === '`') quote = character;
      else if (character === '(') depth += 1;
      else if (character === ')') depth -= 1;
      else if (character === ',' && depth === 0) {
        comma = index;
        break;
      }
    }
    if (comma === -1) continue;

    const expression = args.slice(comma + 1);
    const hasTernary = expression.includes('?');
    for (const literal of expression.matchAll(/(["'])([\s\S]*?)\1/g)) {
      if (hasTernary) {
        let before = literal.index - 1;
        while (before >= 0 && /\s/.test(expression[before])) before -= 1;
        if (expression[before] !== '?' && expression[before] !== ':') continue;
      }
      addValueClasses(literal[2], classes);
    }
  }
}

function emittedClasses() {
  const classes = new Map();

  function record(name, file) {
    if (!classes.has(name)) classes.set(name, new Set());
    classes.get(name).add(file);
  }

  for (const [file, source] of sources) {
    const found = new Set();
    addClassAttributeClasses(source, found);
    addClassListClasses(source, found);
    addClassNameClasses(source, found);
    if (file.endsWith('ui.js')) addElementHelperClasses(source, found);
    for (const name of found) record(name, file);
  }

  return classes;
}

function ruleWithSelector(selector) {
  const clean = stripComments(components);
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selectors, body]) => ({
      selectors: selectors.split(',').map((value) => value.trim()),
      body,
    }))
    .find((rule) => rule.selectors.includes(selector));
}

test('every class emitted by views, app, ui or index.html has a CSS rule or is an allowlisted hook', () => {
  const defined = cssClasses(`${components}\n${tokens}`);
  const emitted = emittedClasses();

  const missing = [...emitted.keys()]
    .filter((name) => !defined.has(name) && !JS_HOOKS.has(name))
    .sort();

  const detail = missing
    .map((name) => `${name} (${[...emitted.get(name)].sort().join(', ')})`)
    .join('\n');
  assert.deepEqual(
    missing,
    [],
    `These emitted classes have no CSS rule and are not on the JS_HOOKS allowlist:\n${detail}`,
  );
});

test('the toast close button has an explicit size and hover/focus treatment', () => {
  const close = ruleWithSelector('.toast-close');
  assert.ok(close, 'components.css defines .toast-close');
  assert.match(close.body, /(?:^|\n)\s*width:\s*var\(--tap-size\)\s*;/);
  assert.match(close.body, /(?:^|\n)\s*height:\s*var\(--tap-size\)\s*;/);
  assert.match(close.body, /(?:^|\n)\s*min-width:\s*var\(--tap-size\)\s*;/);

  assert.ok(
    [...stripComments(components).matchAll(/([^{}]+)\{/g)].some(([, selectors]) =>
      selectors.includes('.toast-close:hover'),
    ),
    'components.css defines a .toast-close:hover state',
  );
  assert.ok(
    [...stripComments(components).matchAll(/([^{}]+)\{/g)].some(([, selectors]) =>
      selectors.includes('.toast-close:focus-visible'),
    ),
    'components.css defines a .toast-close:focus-visible state',
  );
});

test('styleguide shows the progress, create dialog and toast close examples', () => {
  for (const name of ['progress-text', 'create-dialog', 'toast-close']) {
    assert.match(
      styleguide,
      new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`),
      `styleguide shows .${name}`,
    );
  }
});
