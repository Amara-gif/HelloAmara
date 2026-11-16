import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-styles.mjs', import.meta.url));

const requiredComponents = [
  'btn',
  'btn-primary',
  'btn-ghost',
  'btn-danger',
  'card',
  'card-head',
  'card-body',
  'field',
  'table',
  'badge',
  'tabs',
  'nav',
  'chart-box',
];

function cleanTokens() {
  return `:root {
  /* Every value below is a token. */
  --color-text: #1d1d1f;
  --color-surface: #ffffff;
  --color-accent: #4a90d9;
  --font-sans: "Fixture Sans", sans-serif;
  --font-size-base: 1rem;
  --space-2: 0.5rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-text: #f2f2f4;
    --color-surface: #18181d;
    --color-accent: #7fb8e8;
  }
}
`;
}

function cleanComponents() {
  return [
    '/* Fixture components. */',
    ...requiredComponents.map((name) => `.${name} { color: var(--color-text); }`),
    '.fixture-runtime { width: var(--bar-width, 0%); }',
    '',
  ].join('\n');
}

function cleanStyleguide() {
  return `<!doctype html>
<html lang="en">
  <head><title>Fixture style guide</title></head>
  <body>
    <main class="page">
${requiredComponents.map((name) => `      <div class="${name}">${name}</div>`).join('\n')}
    </main>
  </body>
</html>
`;
}

function makeFixture(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'check-styles-'));
  mkdirSync(join(directory, 'assets/css'), { recursive: true });
  writeFileSync(join(directory, 'index.html'), '<!doctype html><html><body><main class="page">Fixture</main></body></html>\n');
  writeFileSync(join(directory, 'styleguide.html'), overrides.styleguide ?? cleanStyleguide());
  writeFileSync(join(directory, 'assets/css/tokens.css'), overrides.tokens ?? cleanTokens());
  writeFileSync(join(directory, 'assets/css/components.css'), overrides.components ?? cleanComponents());
  return directory;
}

function runChecker(directory) {
  return spawnSync(process.execPath, [script, directory], { encoding: 'utf8' });
}

function checkFailure(t, overrides, expected) {
  const directory = makeFixture(overrides);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const result = runChecker(directory);
  assert.equal(result.status, 1, `expected the fixture to fail\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stderr, expected);
}

test('a clean fixture passes', (t) => {
  const directory = makeFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const result = runChecker(directory);
  assert.equal(result.status, 0, `expected the fixture to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /Style check passed/);
});

test('a merged token declaration fails', (t) => {
  const tokens = cleanTokens().replace(
    '  --color-text: #1d1d1f;',
    '  --color-text: #1d1d1f; --fixture-merged: 1;',
  );
  checkFailure(t, { tokens }, /only one token declaration is allowed per line/);
});

test('a dark-only token fails', (t) => {
  const tokens = cleanTokens().replace(
    '    --color-text: #f2f2f4;',
    '    --color-text: #f2f2f4;\n    --fixture-dark-only: #ffffff;',
  );
  checkFailure(t, { tokens }, /--fixture-dark-only is missing from the light :root block/);
});

test('a duplicate token in one block fails', (t) => {
  const tokens = cleanTokens().replace(
    '  --color-text: #1d1d1f;',
    '  --color-text: #1d1d1f;\n  --color-text: #222222;',
  );
  checkFailure(t, { tokens }, /duplicate token --color-text/);
});

test('an unresolved var() in components.css fails', (t) => {
  const components = `${cleanComponents()}\n.fixture-missing { color: var(--fixture-missing); }\n`;
  checkFailure(t, { components }, /var\(--fixture-missing\) does not resolve/);
});

test('the existing hex-colour rule still rejects a literal outside tokens.css', (t) => {
  const components = `${cleanComponents()}\n.fixture-hex { color: #123456; }\n`;
  checkFailure(t, { components }, /hex colour literal/);
});

test('tokens.css keeps its line-scan exemption for px font sizes and hex', (t) => {
  // The original checker skipped tokens.css in the line scan entirely. The
  // token rules are stricter, but they must not make the old px/hex rules fire
  // on this file.
  const tokens = `${cleanTokens()}\n.fixture-utility { font-size: 16px; color: #123456; }\n`;
  const directory = makeFixture({ tokens });
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const result = runChecker(directory);
  assert.equal(result.status, 0, `expected the fixture to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
