import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const components = read('../assets/css/components.css');
const tokens = read('../assets/css/tokens.css');
const tokenSourceFiles = [
  tokens,
  components,
  read('../index.html'),
  read('../styleguide.html'),
  ...readdirSync(fileURLToPath(new URL('../assets/js/', import.meta.url)))
    .filter((name) => name.endsWith('.js'))
    .map((name) => read(`../assets/js/${name}`)),
];

// These families are assembled from a runtime value, so the full class name
// never appears next to the selector. Enumerate every known member instead of
// allowing the whole prefix: a genuinely new unused .badge-* or .priority-*
// class must fail this test just like any other unused class.
const DYNAMIC_CLASS_NAMES = Object.freeze({
  'badge-': [
    'badge-neutral',
    'badge-accent',
    'badge-success',
    'badge-warning',
    'badge-danger',
    'badge-info',
    'badge-band',
    'badge-muted',
  ],
  'calendar-item-': [
    'calendar-item-task',
    'calendar-item-bug',
    'calendar-item-project',
    'calendar-item-event',
  ],
  'priority-': [
    'priority-danger',
    'priority-warning',
    'priority-success',
    'priority-muted',
  ],
  'chart-line-': [
    'chart-line-1',
    'chart-line-2',
    'chart-line-3',
    'chart-line-4',
    'chart-line-5',
    'chart-line-6',
  ],
  'chart-donut-': [
    'chart-donut-1',
    'chart-donut-2',
    'chart-donut-3',
    'chart-donut-4',
    'chart-donut-5',
    'chart-donut-6',
  ],
  'timeline-bar-': ['timeline-bar-open', 'timeline-bar-done'],
});

const DYNAMIC_CLASSES = new Set(Object.values(DYNAMIC_CLASS_NAMES).flat());

const SOURCES = [
  ['assets/js/views.js', read('../assets/js/views.js'), true],
  ['assets/js/app.js', read('../assets/js/app.js'), false],
  ['assets/js/ui.js', read('../assets/js/ui.js'), true],
  ['assets/js/chart.js', read('../assets/js/chart.js'), false],
  ['assets/js/styleguide.js', read('../assets/js/styleguide.js'), true],
  ['index.html', read('../index.html'), false],
  ['styleguide.html', read('../styleguide.html'), false],
];

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssClasses() {
  const classes = new Set();
  const clean = stripCssComments(components);

  // Class selectors only: the prelude before each block, never declarations.
  for (const match of clean.matchAll(/([^{}]+)\{/g)) {
    const prelude = match[1];
    if (/^\s*@/.test(prelude)) continue;
    for (const name of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(name[1]);
  }

  return classes;
}

// Return the literal slices of a class value, dropping every ${...} expression.
// A fragment ending in a hyphen is a prefix for a computed class name, so it is
// not a class of its own.
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

// Pull class literals out of the result arms of a ${...} expression. A
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

function addQuotedClasses(source, classes) {
  for (const literal of source.matchAll(/(["'`])([\s\S]*?)\1/g)) {
    addValueClasses(literal[2], classes);
  }
}

// chart.js creates SVG nodes through svgEl(tag, { class: ... }). The value may
// be a literal or a two-arm condition, so read the literal arms of the object.
function addClassPropertyClasses(source, classes) {
  for (const match of source.matchAll(/\bclass\s*:\s*/g)) {
    const rest = source.slice(match.index + match[0].length);
    const quote = rest[0];

    if (quote === "'" || quote === '"' || quote === '`') {
      let index = 1;
      let value = '';
      while (index < rest.length) {
        if (rest[index] === '\\') {
          value += rest[index] + (rest[index + 1] ?? '');
          index += 2;
          continue;
        }
        if (rest[index] === quote) break;
        value += rest[index];
        index += 1;
      }
      addValueClasses(value, classes);
      continue;
    }

    let index = 0;
    let depth = 0;
    while (index < rest.length) {
      const character = rest[index];
      if (character === '(' || character === '[' || character === '{') depth += 1;
      else if (character === ')' || character === ']' || character === '}') {
        if (depth === 0) break;
        depth -= 1;
      } else if (character === ',' && depth === 0) break;
      index += 1;
    }
    addQuotedClasses(rest.slice(0, index), classes);
  }
}

// ui.js and styleguide.js create every node through their el(tag, className)
// helper. Read the second argument and ignore comparison strings in ternaries.
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

function referencedClasses() {
  const classes = new Set();

  for (const [, source, usesElementHelper] of SOURCES) {
    for (const match of source.matchAll(/\bclass\s*=\s*(["'])([\s\S]*?)\1/g)) {
      addValueClasses(match[2], classes);
    }
    for (const match of source.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
      for (const literal of match[1].matchAll(/(["'])([\s\S]*?)\1/g)) {
        addValueClasses(literal[2], classes);
      }
    }
    for (const match of source.matchAll(/\.className\s*=\s*(["'`])([\s\S]*?)\1/g)) {
      addValueClasses(match[2], classes);
    }
    addClassPropertyClasses(source, classes);
    if (usesElementHelper) addElementHelperClasses(source, classes);
  }

  return classes;
}

function isDynamic(name) {
  return DYNAMIC_CLASSES.has(name);
}

test('every class selector has a reference or is an explicit dynamic family', () => {
  const defined = cssClasses();
  const referenced = referencedClasses();

  const unreferenced = [...defined]
    .filter((name) => !referenced.has(name) && !isDynamic(name))
    .sort();

  assert.deepEqual(
    unreferenced,
    [],
    `These class selectors are defined in components.css but never used by the app:\n${unreferenced.join('\n')}`,
  );
});

test('dynamic class families stay allowlisted and keep their rules', () => {
  const defined = cssClasses();

  for (const [prefix, names] of Object.entries(DYNAMIC_CLASS_NAMES)) {
    assert.ok(names.length > 0, `${prefix} has at least one allowlisted class`);
    for (const name of names) {
      assert.ok(name.startsWith(prefix), `${name} belongs to the ${prefix} family`);
      assert.ok(defined.has(name), `${name} is still styled by components.css`);
    }
  }
});

test('the listed shared selectors are defined once at the top level', () => {
  const clean = stripCssComments(components);

  for (const selector of ['.stack', '.timeline-head', '.timeline-row', '.home-column', '.chart-value', '.field textarea']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = [...clean.matchAll(new RegExp(`(?:^|\\n)${escaped}[ \\t]*\\{`, 'g'))].length;
    assert.equal(count, 1, `${selector} has one top-level definition, found ${count}`);
  }
});

// Kept on purpose even though no selector reads them. Palette presets are not
// listed here because the settings page reads their names from JavaScript.
const KEPT_ON_PURPOSE = new Set([
  '--bp-sm',
  '--bp-md',
  '--bp-lg',
  '--bp-xl',
  '--font-size-display',
  '--line-height-display',
]);

test('tokens.css has no unused custom properties outside the intentional keep list', () => {
  const declared = new Set(
    [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]),
  );
  const used = new Set();

  for (const source of tokenSourceFiles) {
    for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) used.add(match[1]);
    for (const match of source.matchAll(/setProperty\(\s*['"](--[a-z0-9-]+)['"]/gi)) used.add(match[1]);
    for (const match of source.matchAll(/getPropertyValue\(\s*['"](--[a-z0-9-]+)['"]/gi)) used.add(match[1]);
    for (const match of source.matchAll(/['"](--[a-z0-9-]+)['"]/g)) used.add(match[1]);
  }

  for (const name of KEPT_ON_PURPOSE) {
    assert.ok(declared.has(name), `${name} is intentionally kept but missing from tokens.css`);
  }

  const unused = [...declared]
    .filter((name) => !used.has(name) && !KEPT_ON_PURPOSE.has(name))
    .sort();

  assert.deepEqual(
    unused,
    [],
    `These tokens are declared but never used:\n${unused.join('\n')}`,
  );
});
