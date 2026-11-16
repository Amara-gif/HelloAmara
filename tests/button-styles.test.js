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
