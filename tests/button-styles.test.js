import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');
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

function buttonRules() {
  return componentRules.filter((rule) =>
    splitSelectors(rule.selector).some((selector) => /^\.btn(?:$|[-:.[#\s])/.test(selector)),
  );
}

function ruleWithSelector(selector) {
  return componentRules.find((rule) => splitSelectors(rule.selector).includes(selector));
}

function phoneRules() {
  const clean = stripComments(css);
  const blocks = [...clean.matchAll(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/g)];
  assert.ok(blocks.length > 0, 'components.css keeps the phone breakpoint');
  return blocks.flatMap((block) => rules(block[1]));
}

test('the button size tokens alias the control scale', () => {
  assert.match(tokens, /--btn-height\s*:\s*var\(--control-height\)\s*;/);
  assert.match(tokens, /--btn-height-sm\s*:\s*var\(--control-height-sm\)\s*;/);
  assert.match(tokens, /--btn-pad-x\s*:\s*var\(--space-4\)\s*;/);
  assert.match(tokens, /--btn-font-weight\s*:\s*var\(--font-weight-semibold\)\s*;/);
});

test('.btn and the .btn-md alias use the default button tokens', () => {
  const base = ruleWithSelector('.btn');
  assert.ok(base, 'components.css defines .btn');
  assert.ok(
    splitSelectors(base.selector).includes('.btn-md'),
    '.btn-md is an alias of the default button',
  );

  assert.match(base.body, /(?:^|\n)\s*min-height:\s*var\(--btn-height\)\s*;/);
  assert.match(base.body, /(?:^|\n)\s*padding:\s*0\s+var\(--btn-pad-x\)\s*;/);
  assert.match(base.body, /(?:^|\n)\s*border-radius:\s*var\(--radius-btn\)\s*;/);
  assert.match(base.body, /(?:^|\n)\s*font-weight:\s*var\(--btn-font-weight\)\s*;/);

  const alias = ruleWithSelector('.btn-md');
  assert.ok(alias, 'components.css defines .btn-md');
  assert.equal(alias.body.trim(), base.body.trim(), '.btn-md equals the default button size');
});

test('.btn-sm uses the compact button height with no raw pixel height', () => {
  const small = ruleWithSelector('.btn-sm');
  assert.ok(small, 'components.css defines .btn-sm');
  assert.match(small.body, /(?:^|\n)\s*min-height:\s*var\(--btn-height-sm\)\s*;/);
  assert.match(small.body, /(?:^|\n)\s*border-radius:\s*var\(--radius-btn\)\s*;/);
  assert.doesNotMatch(small.body, /\b(?:34|44)px\b/, '.btn-sm has no raw compact height');
});

test('.btn-icon uses the button height and the live button radius', () => {
  const icon = ruleWithSelector('.btn-icon');
  assert.ok(icon, 'components.css defines .btn-icon');
  assert.match(icon.body, /(?:^|\n)\s*width:\s*var\(--btn-height\)\s*;/);
  assert.match(icon.body, /(?:^|\n)\s*min-width:\s*var\(--btn-height\)\s*;/);
  assert.match(icon.body, /(?:^|\n)\s*border-radius:\s*var\(--radius-btn\)\s*;/);
});

test('every button rule avoids raw 34px and 44px heights', () => {
  const all = buttonRules();
  assert.ok(all.length > 0, 'found the button rules');

  for (const rule of all) {
    assert.doesNotMatch(rule.body, /\b(?:34|44)px\b/, `${rule.selector} has a raw button height`);
    assert.doesNotMatch(
      rule.body,
      /(?:^|\n)\s*(?:min-)?height:\s*\d+px\s*;/,
      `${rule.selector} has a raw pixel height`,
    );
  }
});

test('coarse pointers and the phone breakpoint keep a 44px .btn-sm hit area', () => {
  assert.match(tokens, /--tap-size\s*:\s*44px\s*;/);

  const clean = stripComments(css);
  const coarse = clean.match(/@media \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(coarse, 'components.css has a coarse-pointer media query');

  const coarseSmall = rules(coarse[1]).find((rule) =>
    splitSelectors(rule.selector).includes('.btn-sm'),
  );
  assert.ok(coarseSmall, 'the coarse-pointer media query targets .btn-sm');
  assert.match(coarseSmall.body, /(?:^|\n)\s*min-height:\s*var\(--tap-size\)\s*;/);

  const phoneSmall = phoneRules().find((rule) => splitSelectors(rule.selector).includes('.btn-sm'));
  assert.ok(phoneSmall, 'the phone breakpoint targets .btn-sm');
  assert.match(phoneSmall.body, /(?:^|\n)\s*min-height:\s*var\(--tap-size\)\s*;/);
});

test('styleguide.html shows default, -sm, -md and icon buttons', () => {
  assert.match(styleguide, /class="btn"/, 'default button example');
  assert.match(styleguide, /class="[^"]*\bbtn-sm\b[^"]*"/, 'small button example');
  assert.match(styleguide, /class="[^"]*\bbtn-md\b[^"]*"/, 'medium button alias example');
  assert.match(styleguide, /class="[^"]*\bbtn-icon\b[^"]*"/, 'icon button example');
});

const variants = [
  ['default', '.btn'],
  ['secondary', '.btn-secondary'],
  ['primary', '.btn-primary'],
  ['ghost', '.btn-ghost'],
  ['danger', '.btn-danger'],
];

function hasSelectorStarting(prefix) {
  return componentRules.some((rule) =>
    splitSelectors(rule.selector).some((selector) => selector.startsWith(prefix)),
  );
}

test('every variant has a hover rule guarded by :not(:disabled) and disabled rules', () => {
  for (const [name, selector] of variants) {
    assert.ok(
      hasSelectorStarting(`${selector}:hover:not(:disabled)`),
      `${name} has :hover:not(:disabled)`,
    );
    assert.ok(hasSelectorStarting(`${selector}:active:not(:disabled)`), `${name} has :active:not(:disabled)`);
    assert.ok(hasSelectorStarting(`${selector}:focus-visible`), `${name} has :focus-visible`);
    assert.ok(hasSelectorStarting(`${selector}:disabled`), `${name} has a :disabled rule`);
    assert.ok(
      hasSelectorStarting(`${selector}[aria-disabled="true"]`),
      `${name} has an [aria-disabled="true"] rule`,
    );
    assert.ok(
      hasSelectorStarting(`${selector}[aria-pressed="true"]`),
      `${name} has an [aria-pressed="true"] rule`,
    );
    assert.ok(
      hasSelectorStarting(`${selector}[aria-busy="true"]`),
      `${name} has an [aria-busy="true"] rule`,
    );
  }
});

test('no hover rule targets an unguarded button', () => {
  const unguarded = componentRules.flatMap((rule) =>
    splitSelectors(rule.selector).filter(
      (selector) =>
        /^\.(?:btn(?:-[a-z]+)?|link-button):hover/.test(selector) &&
        !selector.includes(':not(:disabled)'),
    ),
  );
  assert.deepEqual(unguarded, []);
});

test('.btn-secondary is a named alias for the default button', () => {
  const base = ruleWithSelector('.btn');
  assert.ok(base, 'components.css defines .btn');
  assert.ok(
    splitSelectors(base.selector).includes('.btn-secondary'),
    '.btn-secondary is an alias of the default button',
  );
  assert.equal(
    ruleWithSelector('.btn-secondary').body.trim(),
    base.body.trim(),
    '.btn-secondary equals the default button',
  );
});

test('.btn-link and .link-button share one look and all states', () => {
  const base = componentRules.find((rule) =>
    splitSelectors(rule.selector).includes('.btn-link'),
  );
  assert.ok(base, 'components.css defines .btn-link');
  assert.ok(
    splitSelectors(base.selector).includes('.link-button'),
    '.btn-link and .link-button share the base rule',
  );

  for (const state of [':hover:not(:disabled)', ':active:not(:disabled)', ':focus-visible']) {
    assert.ok(
      componentRules.some((rule) => {
        const selectors = splitSelectors(rule.selector);
        return (
          selectors.some((selector) => selector.startsWith(`.btn-link${state}`)) &&
          selectors.some((selector) => selector.startsWith(`.link-button${state}`))
        );
      }),
      `.btn-link and .link-button share ${state}`,
    );
  }

  assert.ok(hasSelectorStarting('.btn-link:disabled'), '.btn-link has :disabled');
  assert.ok(hasSelectorStarting('.link-button:disabled'), '.link-button has :disabled');
  assert.ok(
    hasSelectorStarting('.btn-link[aria-pressed="true"]'),
    '.btn-link has [aria-pressed="true"]',
  );
  assert.ok(
    hasSelectorStarting('.link-button[aria-pressed="true"]'),
    '.link-button has [aria-pressed="true"]',
  );
  assert.ok(hasSelectorStarting('.btn-link[aria-busy="true"]'), '.btn-link has [aria-busy="true"]');
  assert.ok(
    hasSelectorStarting('.link-button[aria-busy="true"]'),
    '.link-button has [aria-busy="true"]',
  );
});

test('the busy spinner uses a token colour and reduced motion stops it', () => {
  const spinner = componentRules.find((rule) =>
    splitSelectors(rule.selector).includes('.btn[aria-busy="true"]::before'),
  );
  assert.ok(spinner, 'components.css styles the busy spinner');
  assert.match(
    spinner.body,
    /border:\s*calc\(var\(--border-width\)\s*\*\s*2\)\s*solid\s+var\(--color-[a-z0-9-]+\)/,
    'the spinner border uses a colour token',
  );
  assert.match(spinner.body, /animation:\s*btn-spin\s+calc\(var\(--duration\)\s*\*\s*5\)/, 'the spinner animates');

  const reduced = stripComments(css).match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(reduced, 'components.css keeps the reduced-motion block');
  assert.match(reduced[1], /\.btn\[aria-busy="true"\]::before/, 'reduced motion targets the spinner');
  assert.match(reduced[1], /animation:\s*none/, 'reduced motion stops the spinner animation');
});

test('styleguide.html documents all button variants and states', () => {
  assert.match(styleguide, /id="sg-button-states-title"[^>]*>Button states</);
  for (const state of ['Default', 'Hover', 'Active', 'Focus-visible', 'Disabled', 'Pressed', 'Busy']) {
    assert.match(styleguide, new RegExp(`<th scope="col">${state}</th>`), `${state} column`);
  }
  for (const variant of ['btn-secondary', 'btn-primary', 'btn-ghost', 'btn-danger', 'btn-link', 'link-button']) {
    assert.match(
      styleguide,
      new RegExp(`class="[^"]*\\b${variant}\\b[^"]*"`),
      `${variant} example`,
    );
  }
});

const buttonLikeClasses = [
  '.fab',
  '.chip-remove',
  '.palette-card',
  '.account-row',
  '.sidebar-tool',
  '.link-button',
];

test('every button-like class takes its height from a token', () => {
  for (const selector of buttonLikeClasses) {
    const rule = ruleWithSelector(selector);
    assert.ok(rule, `components.css defines ${selector}`);
    assert.match(
      rule.body,
      /(?:^|\n)\s*(?:min-)?height:\s*var\(--[a-z0-9-]+\)\s*;/,
      `${selector} sets a token height`,
    );
  }
});

test('button-like classes contain no raw pixel height or hex colour', () => {
  const matching = componentRules.filter((rule) =>
    splitSelectors(rule.selector).some((selector) =>
      buttonLikeClasses.some((name) =>
        new RegExp(`^${name.replace('.', '\\.')}(?:$|[-:.[\\s])`).test(selector),
      ),
    ),
  );
  assert.ok(matching.length > 0, 'found the button-like rules');

  for (const rule of matching) {
    assert.doesNotMatch(
      rule.body,
      /(?:^|\n)\s*(?:min-)?height:\s*\d+(?:\.\d+)?px\s*;/,
      `${rule.selector} has a raw pixel height`,
    );
    assert.doesNotMatch(rule.body, /#[0-9a-f]{3,8}\b/i, `${rule.selector} has a hex colour`);
  }
});

test('every button-like class shares the .btn focus-visible ring', () => {
  const btnFocus = ruleWithSelector('.btn:focus-visible');
  assert.ok(btnFocus, 'components.css defines the .btn focus-visible ring');
  const expected = btnFocus.body.replace(/\s+/g, ' ').trim();

  for (const selector of buttonLikeClasses) {
    const focus = ruleWithSelector(`${selector}:focus-visible`);
    assert.ok(focus, `${selector} has a focus-visible rule`);
    assert.equal(
      focus.body.replace(/\s+/g, ' ').trim(),
      expected,
      `${selector} uses the same focus-visible ring as .btn`,
    );
  }
});

test('every button-like class shares the .btn disabled state', () => {
  for (const selector of buttonLikeClasses) {
    assert.ok(
      hasSelectorStarting(`${selector}:disabled`),
      `${selector} has a :disabled rule`,
    );
    assert.ok(
      hasSelectorStarting(`${selector}[aria-disabled="true"]`),
      `${selector} has an [aria-disabled="true"] rule`,
    );
  }
});

test('.chip-remove keeps a small glyph inside a tap-sized hit area', () => {
  const hitArea = ruleWithSelector('.chip-remove::before');
  assert.ok(hitArea, 'components.css gives .chip-remove a pseudo-element hit area');
  assert.match(hitArea.body, /(?:^|\n)\s*width:\s*var\(--tap-size\)\s*;/);
  assert.match(hitArea.body, /(?:^|\n)\s*height:\s*var\(--tap-size\)\s*;/);

  const base = ruleWithSelector('.chip-remove');
  assert.match(base.body, /(?:^|\n)\s*width:\s*var\(--space-5\)\s*;/);
  assert.match(base.body, /(?:^|\n)\s*height:\s*var\(--space-5\)\s*;/);
});

test('styleguide.html shows every button-like class', () => {
  for (const selector of buttonLikeClasses) {
    const className = selector.slice(1);
    assert.match(
      styleguide,
      new RegExp(`class="[^"]*\\b${className}\\b`),
      `${className} example`,
    );
  }
});
