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

function selectorsOf(rule) {
  return splitSelectors(rule.selector);
}

function ruleWithSelector(fragment) {
  return componentRules.find((rule) => selectorsOf(rule).some((selector) => selector.includes(fragment)));
}

function sharedBaseRule() {
  return componentRules.find((rule) => {
    const selectors = selectorsOf(rule);
    return (
      selectors.includes('.control') &&
      selectors.includes('.input') &&
      selectors.includes('.select') &&
      selectors.some((selector) => selector.startsWith('.field ') && /\binput\b/.test(selector))
    );
  });
}

test('one declaration block covers .control, .input, .select and .field controls', () => {
  const rule = sharedBaseRule();
  assert.ok(rule, 'components.css has one shared declaration block for every control alias');

  assert.match(rule.body, /(?:^|\n)\s*min-height:\s*var\(--control-height\)\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*padding:\s*var\(--control-pad-y\)\s+var\(--control-pad-x\)\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*border:\s*var\(--border-width\)\s+solid\s+var\(--color-divider\)\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*border-radius:\s*var\(--radius-sm\)\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*font-size:\s*var\(--control-font-size\)\s*;/);
});

test('the field selector excludes every non-text input type', () => {
  const rule = sharedBaseRule();
  const fieldSelector = selectorsOf(rule).find(
    (selector) => selector.startsWith('.field ') && /\binput\b/.test(selector),
  );

  assert.ok(fieldSelector, 'the shared block targets inputs inside .field');
  for (const type of ['checkbox', 'radio', 'range', 'color', 'file', 'hidden']) {
    assert.match(
      fieldSelector,
      new RegExp(`\\[type="${type}"\\]`),
      `the field selector excludes [type="${type}"]`,
    );
  }
});

test('.field keeps only layout, including width: 100%', () => {
  const widthRule = componentRules.find(
    (rule) =>
      selectorsOf(rule).some((selector) => selector.startsWith('.field ')) &&
      /(?:^|\n)\s*width:\s*100%\s*;/.test(rule.body),
  );
  assert.ok(widthRule, '.field makes its text-like controls full width');

  const fieldRule = componentRules.find((rule) => rule.selector === '.field');
  assert.ok(fieldRule, 'components.css defines .field');
  assert.doesNotMatch(fieldRule.body, /min-height|border-radius|font-size/);
});

test('.select-sm and .control-sm are shorter than the base control', () => {
  const smRule = ruleWithSelector('.select-sm');
  assert.ok(smRule, 'components.css defines .select-sm');
  assert.match(smRule.body, /(?:^|\n)\s*min-height:\s*var\(--control-height-sm\)\s*;/);
  assert.match(smRule.body, /(?:^|\n)\s*font-size:\s*var\(--control-font-size-sm\)\s*;/);
  assert.ok(selectorsOf(smRule).includes('.control-sm'), '.control-sm shares the compact rule');

  const base = sharedBaseRule();
  assert.match(base.body, /(?:^|\n)\s*min-height:\s*var\(--control-height\)\s*;/);
  assert.notEqual(base.body.trim(), smRule.body.trim());
});

test('hover, focus-visible, disabled, read-only, invalid and placeholder states exist', () => {
  const hover = ruleWithSelector('.input:hover');
  assert.ok(hover, 'the hover state targets the shared aliases');
  assert.match(hover.body, /border-color:\s*var\(--color-divider-strong\)/);

  const focus = ruleWithSelector('.input:focus-visible');
  assert.ok(focus, 'the focus-visible state targets the shared aliases');
  assert.match(focus.body, /outline:\s*[^;]*var\(--color-focus\)/);

  const disabled = ruleWithSelector('.input:disabled');
  assert.ok(disabled, 'the disabled state targets the shared aliases');
  assert.match(disabled.body, /background:\s*var\(--color-surface-muted\)/);

  const readOnly = ruleWithSelector('.input:read-only');
  assert.ok(readOnly, 'the read-only state targets the shared aliases');
  assert.match(readOnly.body, /background:\s*var\(--color-surface-muted\)/);

  const invalid = ruleWithSelector('.input[aria-invalid="true"]');
  assert.ok(invalid, 'the aria-invalid state targets the shared aliases');
  assert.match(invalid.body, /border-color:\s*var\(--color-danger\)/);

  const userInvalid = ruleWithSelector('.input:user-invalid');
  assert.ok(userInvalid, 'the user-invalid state targets the shared aliases');
  assert.match(userInvalid.body, /border-color:\s*var\(--color-danger\)/);

  const placeholder = ruleWithSelector('.input::placeholder');
  assert.ok(placeholder, 'the placeholder state targets the shared aliases');
  assert.match(placeholder.body, /color:\s*var\(--color-text-faint\)/);
});

test('the control rules add no raw px, hex or colour functions', () => {
  const controlRules = componentRules.filter((rule) =>
    selectorsOf(rule).some(
      (selector) =>
        /^\.(?:control|input|select)(?:$|[-:.\[])/.test(selector) ||
        /^\.field(?:$|\s|>|:)/.test(selector),
    ),
  );

  assert.ok(controlRules.length > 0, 'found the control rules');
  for (const rule of controlRules) {
    assert.doesNotMatch(rule.body, /#[0-9a-f]{3,8}\b/i, `${rule.selector} has a hex literal`);
    assert.doesNotMatch(rule.body, /\b(?:rgb|rgba|hsl|hsla)\(/i, `${rule.selector} has a colour function`);
    assert.doesNotMatch(rule.body, /\b\d+px\b/, `${rule.selector} has a raw pixel value`);
  }
});

test('styleguide.html shows every control alias, size and state', () => {
  assert.match(styleguide, /class="control"/, 'bare .control example');
  assert.match(styleguide, /class="input"/, 'bare .input example');
  assert.match(styleguide, /class="select"/, 'bare .select example');
  assert.match(styleguide, /class="[^"]*control-sm[^"]*"/, 'compact .control example');
  assert.match(styleguide, /class="[^"]*select-sm[^"]*"/, 'compact .select example');
  assert.match(styleguide, /\bdisabled\b/, 'disabled example');
  assert.match(styleguide, /\breadonly\b/, 'read-only example');
  assert.match(styleguide, /aria-invalid="true"/, 'invalid example');
  assert.match(styleguide, /\bautofocus\b/, 'focus-visible example');
  assert.match(styleguide, /placeholder=/, 'placeholder example');
  assert.match(styleguide, /focus-visible/i, 'focus-visible state is described');
});
