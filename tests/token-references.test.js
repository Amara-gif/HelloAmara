import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const tokenUrl = new URL('../assets/css/tokens.css', import.meta.url);
const componentUrl = new URL('../assets/css/components.css', import.meta.url);
const jsUrl = new URL('../assets/js/', import.meta.url);

const tokensCss = readFileSync(tokenUrl, 'utf8');
const componentsCss = readFileSync(componentUrl, 'utf8');

// Custom properties written by JavaScript at runtime, so they are not expected
// to appear as declarations in tokens.css. Every entry must still be set in assets/js.
const RUNTIME_PROPERTIES = new Set([
  '--bar-width',
  '--timeline-left',
  '--timeline-width',
  '--swatch-color',
  '--sample-width',
  '--sample-radius',
  '--sample-shadow',
  '--sample-size',
  '--sample-weight',
  '--sample-font',
  '--sample-line-height',
  '--radius-btn',
  '--radius-card',
  '--glass-opacity',
  '--color-card-header',
  '--color-accent',
  '--color-accent-strong',
  '--color-accent-strong-hover',
  '--color-accent-soft',
  '--color-nav-active',
  '--color-focus',
  '--color-on-accent',
  '--color-on-card-header',
]);

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function declaredProperties(source) {
  const names = new Set();
  for (const match of stripComments(source).matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    names.add(match[1]);
  }
  return names;
}

function referencedProperties(source) {
  const names = new Set();
  for (const match of stripComments(source).matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    names.add(match[1]);
  }
  return names;
}

function javaScriptSource(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const path = new URL(entry.name, directory);
      if (entry.isDirectory()) return javaScriptSource(new URL(`${entry.name}/`, directory));
      return entry.name.endsWith('.js') ? readFileSync(path, 'utf8') : '';
    })
    .join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const tokenDeclarations = declaredProperties(tokensCss);
const componentDeclarations = declaredProperties(componentsCss);
const js = javaScriptSource(jsUrl);

test('tokens.css defines --font-size-display once, in the light :root block', () => {
  const css = stripComments(tokensCss);
  const matches = [...css.matchAll(/--font-size-display\s*:/g)];
  assert.equal(matches.length, 1, 'expected exactly one --font-size-display declaration');

  const lightRoot = css.match(/:root\s*\{([^{}]*)\}/);
  assert.ok(lightRoot, 'expected a light :root block');
  assert.match(
    lightRoot[1],
    /--font-size-display\s*:\s*clamp\(2rem, 1\.5rem \+ 2vw, 3rem\)\s*;/,
    '--font-size-display must be declared in the light :root block',
  );
});

test('the styleguide type section includes every --font- token', () => {
  const styleguide = readFileSync(new URL('../assets/js/styleguide.js', import.meta.url), 'utf8');
  assert.match(
    styleguide,
    /renderTokenList\(\s*['"]sg-type['"]\s*,\s*\[\.\.\.pick\(\s*['"]--font-['"]\s*\)/,
    'styleguide.js must render the --font-* tokens in the type section',
  );
});

test('every var(--x) in tokens.css and components.css resolves', () => {
  const files = [
    ['tokens.css', tokensCss],
    ['components.css', componentsCss],
  ];
  const unresolved = [];

  for (const [file, source] of files) {
    for (const name of referencedProperties(source)) {
      const known =
        tokenDeclarations.has(name) ||
        componentDeclarations.has(name) ||
        RUNTIME_PROPERTIES.has(name);
      if (!known) unresolved.push(`${file}: var(${name})`);
    }
  }

  assert.deepEqual(unresolved, [], `unresolved custom properties:\n${unresolved.join('\n')}`);
});

test('the runtime-property allowlist is explicit and every entry is set in assets/js', () => {
  for (const name of RUNTIME_PROPERTIES) {
    const setter = new RegExp(`setProperty\\(\\s*['"]${escapeRegExp(name)}['"]`);
    assert.match(js, setter, `${name} is allowlisted but never set in assets/js`);
  }
});

test('every custom property set by assets/js is in the runtime allowlist', () => {
  const setInJs = new Set(
    [...js.matchAll(/setProperty\(\s*['"](--[a-z0-9-]+)['"]/gi)].map((match) => match[1]),
  );

  for (const name of setInJs) {
    assert.ok(RUNTIME_PROPERTIES.has(name), `${name} is set in assets/js but missing from the allowlist`);
  }
});
