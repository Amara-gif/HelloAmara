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

test('.control-range drops the text box and keeps a 44px hit area', () => {
  const rule = ruleWithSelector('.control-range');
  assert.ok(rule, 'components.css defines .control-range');

  assert.match(rule.body, /(?:^|\n)\s*min-height:\s*var\(--tap-size\)\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*border:\s*0\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*background:\s*transparent\s*;/);
  assert.match(rule.body, /(?:^|\n)\s*appearance:\s*none\s*;/);
  assert.doesNotMatch(rule.body, /border:\s*var\(--border-width\)/);
});

test('the range track and thumb sizes come from tokens', () => {
  const track = ruleWithSelector('::-webkit-slider-runnable-track');
  assert.ok(track, 'the WebKit range track has a rule');
  assert.match(track.body, /height:\s*var\(--range-track-height\)/);
  assert.match(track.body, /border-radius:\s*var\(--radius-pill\)/);

  const thumb = ruleWithSelector('::-webkit-slider-thumb');
  assert.ok(thumb, 'the WebKit range thumb has a rule');
  assert.match(thumb.body, /width:\s*var\(--range-thumb-size\)/);
  assert.match(thumb.body, /height:\s*var\(--range-thumb-size\)/);

  const mozThumb = componentRules.find((rule) =>
    selectorsOf(rule).some((selector) => selector.endsWith('::-moz-range-thumb')),
  );
  assert.ok(mozThumb, 'the Firefox range thumb has a rule');
  assert.match(mozThumb.body, /width:\s*var\(--range-thumb-size\)/);
});

test('.control-color adopts the tap-sized colour swatch', () => {
  const rule = ruleWithSelector('.control-color');
  assert.ok(rule, 'components.css defines .control-color');
  assert.match(rule.body, /width:\s*var\(--tap-size\)/);
  assert.match(rule.body, /height:\s*var\(--tap-size\)/);
  assert.match(rule.body, /min-height:\s*var\(--control-height\)/);
  assert.match(rule.body, /border:\s*var\(--border-width\)\s+solid\s+var\(--color-divider\)/);

  const swatch = componentRules.find((rule) =>
    selectorsOf(rule).some((selector) => selector.endsWith('::-webkit-color-swatch')),
  );
  assert.ok(swatch, 'the colour swatch keeps the DS-09 reset');
  assert.match(swatch.body, /border:\s*0\s*;/);
});

test('the file button matches the compact ghost button and the box stays on the base', () => {
  const file = ruleWithSelector('input[type="file"]');
  assert.ok(file, 'components.css styles file inputs');
  assert.match(file.body, /min-height:\s*var\(--control-height\)/);
  assert.match(file.body, /border:\s*var\(--border-width\)\s+solid\s+var\(--color-divider\)/);

  const button = ruleWithSelector('::file-selector-button');
  assert.ok(button, 'the native choose-file button is styled');
  assert.match(button.body, /min-height:\s*var\(--control-height-sm\)/);
  assert.match(button.body, /padding:\s*0\s+var\(--space-3\)/);
  assert.match(button.body, /font-size:\s*var\(--font-size-xs\)/);
});

test('date, time and number keep the base box with a normal picker area', () => {
  const typed = ruleWithSelector('input[type="date"]');
  assert.ok(typed, 'components.css keeps date/time/number on the shared control rule');

  const picker = ruleWithSelector('::-webkit-calendar-picker-indicator');
  assert.ok(picker, 'the native date/time picker icon is normalised');
  assert.match(picker.body, /width:\s*var\(--space-5\)/);
  assert.match(picker.body, /height:\s*var\(--space-5\)/);
});

test('checkbox and radio use the accent colour and a --size-* box', () => {
  const checkbox = ruleWithSelector('input[type="checkbox"]');
  assert.ok(checkbox, 'components.css styles checkboxes');
  assert.match(checkbox.body, /accent-color:\s*var\(--color-accent\)/);
  assert.match(checkbox.body, /width:\s*var\(--size-checkbox\)/);
  assert.match(checkbox.body, /height:\s*var\(--size-checkbox\)/);

  const radio = componentRules.find((rule) =>
    selectorsOf(rule).includes('input[type="radio"]'),
  );
  assert.ok(radio, 'components.css styles radios');
  assert.match(radio.body, /accent-color:\s*var\(--color-accent\)/);
  assert.match(radio.body, /width:\s*var\(--size-checkbox\)/);

  const radioSize = componentRules.find((rule) =>
    selectorsOf(rule).includes('input[type="radio"]') && /--size-radio/.test(rule.body),
  );
  assert.ok(radioSize, 'the radio size comes from its own --size-* token');
  assert.match(radioSize.body, /width:\s*var\(--size-radio\)/);

  const labelRow = componentRules.find((rule) => rule.selector === '.checkbox-row');
  assert.ok(labelRow, 'components.css defines the checkbox label row');
  assert.match(labelRow.body, /align-items:\s*center/);
  assert.match(labelRow.body, /min-height:\s*var\(--tap-size\)/);
});

test('textarea heights come from tokens and only resize vertically', () => {
  assert.doesNotMatch(css, /\b(?:72px|24rem|16rem)\b/, 'components.css has no raw textarea height');
  assert.match(tokens, /--textarea-min\s*:/);
  assert.match(tokens, /--textarea-tall\s*:/);

  const fieldTextarea = componentRules.find((rule) => rule.selector === '.field textarea');
  assert.ok(fieldTextarea, 'components.css defines the field textarea');
  assert.match(fieldTextarea.body, /min-height:\s*var\(--textarea-min\)/);
  assert.match(fieldTextarea.body, /resize:\s*vertical/);

  const tall = componentRules.find((rule) => rule.selector === '.textarea-tall');
  assert.ok(tall, 'components.css defines the tall textarea size');
  assert.match(tall.body, /min-height:\s*var\(--textarea-tall\)/);
});

test('styleguide.html samples every special input type', () => {
  for (const type of ['date', 'time', 'number', 'file', 'range', 'color', 'checkbox', 'radio']) {
    assert.match(styleguide, new RegExp(`type="${type}"`), `styleguide samples [type="${type}"]`);
  }
  assert.match(styleguide, /class="[^"]*control-range[^"]*"/, 'styleguide samples .control-range');
  assert.match(styleguide, /class="[^"]*control-color[^"]*"/, 'styleguide samples .control-color');
  assert.match(styleguide, /class="[^"]*textarea-tall[^"]*"/, 'styleguide samples the tall textarea');
});
