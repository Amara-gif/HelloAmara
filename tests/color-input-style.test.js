import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const components = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const styleguide = readFileSync(new URL('../styleguide.html', import.meta.url), 'utf8');

function rules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.replace(/\s+/g, ' ').trim(),
    body,
  }));
}

const componentRules = rules(components);

function baseColorRule() {
  return componentRules.find((rule) =>
    rule.selector.split(',').some((selector) => /(?:^|\s)input\[type="color"\]$/.test(selector.trim()))
  );
}

function pseudoRule(pseudo) {
  return componentRules.find((rule) =>
    rule.selector.split(',').some((selector) => selector.trim().endsWith(pseudo))
  );
}

test('the colour input is a fixed square swatch from tokens', () => {
  const rule = baseColorRule();
  assert.ok(rule, 'components.css has a base input[type="color"] rule');
  assert.match(rule.body, /(?:^|\n)\s*width:\s*var\(--tap-size\)\s*;/);
  assert.doesNotMatch(rule.body, /width:\s*100%/);
  assert.match(rule.body, /(?:^|\n)\s*height:\s*var\(--tap-size\)\s*;/);
  assert.match(rule.body, /border:\s*var\(--border-width\)\s+solid\s+var\(--color-divider\)/);
  assert.match(rule.body, /border-radius:\s*var\(--radius-sm\)/);
  assert.match(rule.body, /padding:\s*(?:var\(--space-\d+\)|calc\(var\(--space-\d+\)[^)]*\))/);
});

test('the native colour swatch is reset so it fills the box', () => {
  const wrapper = pseudoRule('::-webkit-color-swatch-wrapper');
  assert.ok(wrapper, 'WebKit swatch wrapper is reset');
  assert.match(wrapper.body, /padding:\s*0\s*;/);

  const webkit = pseudoRule('::-webkit-color-swatch');
  assert.ok(webkit, 'WebKit swatch is reset');
  assert.match(webkit.body, /border:\s*0\s*;/);

  const moz = pseudoRule('::-moz-color-swatch');
  assert.ok(moz, 'Firefox swatch is reset');
  assert.match(moz.body, /border:\s*0\s*;/);
});

test('the colour input has a visible focus style', () => {
  const focus = pseudoRule('input[type="color"]:focus-visible');
  assert.ok(focus, 'the colour input has a focus-visible rule');
  assert.match(focus.body, /outline:\s*[^;]*var\(--color-focus\)/);
});

test('styleguide.html shows the colour input', () => {
  assert.match(styleguide, /<input[^>]*type="color"/);
});
