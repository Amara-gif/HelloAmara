import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
const views = readFileSync(new URL('../assets/js/views.js', import.meta.url), 'utf8');
const styleguide = readFileSync(new URL('../styleguide.html', import.meta.url), 'utf8');

const TONES = ['neutral', 'accent', 'success', 'warning', 'danger', 'info', 'band', 'muted'];
const COUNTED_TONES = ['neutral', 'accent', 'success', 'warning', 'danger', 'info', 'band', 'muted'];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stripComments(source).match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^{}]*)\\}`));
  return match?.[1] ?? '';
}

function hasClass(markup, ...names) {
  return [...markup.matchAll(/class="([^"]*)"/g)].some(([, value]) => {
    const classes = value.split(/\s+/);
    return names.every((name) => classes.includes(name));
  });
}

test('one .badge base owns the tokenized size, radius and type', () => {
  const base = ruleBody(css, '.badge');

  assert.match(base, /(?:^|\n)\s*min-height:\s*var\(--size-badge-height\)\s*;/);
  assert.match(base, /(?:^|\n)\s*border-radius:\s*var\(--radius-pill\)\s*;/);
  assert.match(base, /(?:^|\n)\s*font-size:\s*var\(--font-size-xs\)\s*;/);
  assert.match(base, /(?:^|\n)\s*font-weight:\s*var\(--font-weight-semibold\)\s*;/);
});

test('all tone rules live in one contiguous region', () => {
  const start = css.indexOf('.badge-neutral {');
  const end = css.indexOf('.badge-on-accent {');
  assert.ok(start !== -1, 'components.css defines .badge-neutral');
  assert.ok(end > start, 'components.css defines .badge-on-accent after the tones');
  const region = css.slice(start, end + '.badge-on-accent {'.length + 200);

  for (const tone of TONES) {
    assert.match(region, new RegExp(`\\.badge-${tone}\\s*\\{`), `.badge-${tone} sits in the shared tone region`);
  }
  assert.match(region, /\.badge-on-accent\s*\{/, '.badge-on-accent sits with the tones');

  for (const selector of ['.badge-accent', '.badge-success', '.badge-warning', '.badge-danger', '.badge-band']) {
    assert.equal(
      stripComments(css).match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{`, 'g'))?.length,
      1,
      `${selector} is defined once`,
    );
  }
});

test('danger is a soft tint, and the solid look is opt-in', () => {
  const danger = ruleBody(css, '.badge-danger');
  const solid = ruleBody(css, '.badge-solid');

  assert.match(danger, /(?:^|\n)\s*background:\s*var\(--color-danger-soft\)\s*;/);
  assert.match(danger, /(?:^|\n)\s*color:\s*var\(--color-danger\)\s*;/);
  assert.doesNotMatch(danger, /(?:^|\n)\s*background:\s*var\(--color-danger\)\s*;/);
  assert.doesNotMatch(danger, /(?:^|\n)\s*color:\s*var\(--color-on-danger\)\s*;/);

  assert.match(danger, /--badge-solid:\s*var\(--color-danger\)\s*;/);
  assert.match(danger, /--badge-solid-ink:\s*var\(--color-on-danger\)\s*;/);
  assert.match(solid, /(?:^|\n)\s*background:\s*var\(--badge-solid\)\s*;/);
  assert.match(solid, /(?:^|\n)\s*color:\s*var\(--badge-solid-ink\)\s*;/);
});

test('the tone rules use soft backgrounds and their matching ink tokens', () => {
  const expected = {
    accent: ['--color-accent-soft', '--color-accent-strong'],
    success: ['--color-success-soft', '--color-success'],
    warning: ['--color-warning-soft', '--color-warning'],
    danger: ['--color-danger-soft', '--color-danger'],
    band: ['--color-band', '--color-text-secondary'],
  };

  for (const [tone, [background, ink]] of Object.entries(expected)) {
    const body = ruleBody(css, `.badge-${tone}`);
    assert.match(body, new RegExp(`background:\\s*var\\(${background}\\)\\s*;`), `${tone} uses its soft tint`);
    assert.match(body, new RegExp(`color:\\s*var\\(${ink}\\)\\s*;`), `${tone} uses its ink token`);
  }
});

test('badge-muted is not a copy of the base rule', () => {
  const base = ruleBody(css, '.badge');
  const muted = ruleBody(css, '.badge-muted');

  assert.ok(muted.trim(), 'components.css keeps an explicit .badge-muted rule');
  assert.notEqual(muted.replace(/\s+/g, ' ').trim(), base.replace(/\s+/g, ' ').trim());
  assert.doesNotMatch(muted, /(?:^|\n)\s*background:\s*var\(--color-surface-muted\)\s*;/);
  assert.doesNotMatch(muted, /(?:^|\n)\s*font-size:/);
  assert.match(muted, /(?:^|\n)\s*background:\s*var\(--color-bg\)\s*;/);
});

test('badge-count uses one height, one font and tabular figures', () => {
  const count = ruleBody(css, '.badge-count');

  assert.match(count, /(?:^|\n)\s*min-height:\s*var\(--size-badge-height\)\s*;/);
  assert.match(count, /(?:^|\n)\s*font-size:\s*var\(--font-size-xs\)\s*;/);
  assert.match(count, /(?:^|\n)\s*font-weight:\s*var\(--font-weight-semibold\)\s*;/);
  assert.match(count, /(?:^|\n)\s*font-variant-numeric:\s*tabular-nums\s*;/);

  assert.ok(hasClass(app, 'badge', 'badge-accent', 'badge-count', 'nav-count'), 'sidebar count uses the shared badge classes');
  assert.ok(hasClass(views, 'badge', 'badge-count', 'toolbar-count'), 'toolbar count uses the shared badge classes');
  assert.ok(hasClass(views, 'badge', 'badge-muted', 'badge-count'), 'board count uses the shared badge classes');
});

test('the styleguide shows every tone, solid and count variant', () => {
  for (const tone of TONES) {
    assert.ok(
      hasClass(styleguide, 'badge', `badge-${tone}`),
      `styleguide shows the ${tone} tone`,
    );
  }
  for (const tone of COUNTED_TONES) {
    assert.ok(
      hasClass(styleguide, 'badge', `badge-${tone}`, 'badge-solid'),
      `styleguide shows the solid ${tone} variant`,
    );
  }
  assert.ok(hasClass(styleguide, 'badge', 'badge-count'), 'styleguide shows a count badge');
  assert.ok(hasClass(styleguide, 'badge', 'badge-muted', 'badge-count'), 'styleguide shows a muted count badge');
  assert.ok(hasClass(styleguide, 'badge', 'badge-accent', 'badge-count', 'nav-count'), 'styleguide shows a nav count');
  assert.ok(hasClass(styleguide, 'badge', 'badge-count', 'toolbar-count'), 'styleguide shows a toolbar count');
});
