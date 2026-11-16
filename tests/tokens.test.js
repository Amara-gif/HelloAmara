import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');
const styleguide = readFileSync(new URL('../styleguide.html', import.meta.url), 'utf8');

const DECLARATION = /^--[a-z0-9-]+\s*:\s*\S(?:[\s\S]*\S)?\s*;$/i;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function rootBlocks(source) {
  return [...stripComments(source).matchAll(/:root\s*\{([^{}]*)\}/g)].map((match) => match[1]);
}

// Turns the contents of one :root block into a name -> value map. A declaration
// may wrap across lines (the font stack does), so keep accumulating until the
// terminating semicolon instead of validating raw physical lines.
function parseBlock(block, label) {
  const declarations = new Map();
  let pending = '';
  let pendingLine = 0;

  block.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNumber = index + 1;

    if (pending) {
      if (/^--/.test(line)) {
        assert.fail(`${label} line ${pendingLine}: missing semicolon before ${JSON.stringify(line)}`);
      }
      pending += ` ${line}`;
    } else {
      assert.match(
        line,
        /^--[a-z0-9-]+\s*:/i,
        `${label} line ${lineNumber}: expected a "--name: value;" declaration, found ${JSON.stringify(line)}`,
      );
      pending = line;
      pendingLine = lineNumber;
    }

    if (pending.endsWith(';')) {
      assert.match(
        pending,
        DECLARATION,
        `${label} line ${pendingLine}: malformed declaration ${JSON.stringify(pending)}`,
      );
      const [name, ...valueParts] = pending.slice(0, -1).split(':');
      const token = name.trim();
      const value = valueParts.join(':').trim();
      assert.ok(value, `${label} line ${pendingLine}: ${token} has no value`);
      assert.ok(!declarations.has(token), `${label} line ${pendingLine}: duplicate token ${token}`);
      declarations.set(token, value);
      pending = '';
    }
  });

  assert.equal(pending, '', `${label} ends with an unterminated declaration: ${JSON.stringify(pending)}`);
  return declarations;
}

const blocks = rootBlocks(css);

test('tokens.css has a light :root block and a dark :root block', () => {
  assert.equal(blocks.length, 2, `expected two :root blocks, found ${blocks.length}`);
});

test('every non-comment declaration inside each :root block is well formed', () => {
  for (const [index, block] of blocks.entries()) {
    assert.ok(parseBlock(block, `:root block ${index + 1}`).size > 0);
  }
});

test('a token name is never declared twice inside one :root block', () => {
  for (const [index, block] of blocks.entries()) {
    parseBlock(block, `:root block ${index + 1}`);
  }
});

test('every token in the dark :root block also exists in the light :root block', () => {
  const lightTokens = parseBlock(blocks[0] ?? '', 'light :root');
  const darkTokens = parseBlock(blocks[1] ?? '', 'dark :root');

  for (const name of darkTokens.keys()) {
    assert.ok(lightTokens.has(name), `dark token ${name} is missing from the light :root block`);
  }
});

test('the dark theme restores the overlay, series 3 and nav-active tokens', () => {
  const darkTokens = parseBlock(blocks[1] ?? '', 'dark :root');

  assert.equal(darkTokens.get('--color-overlay'), 'rgba(3, 5, 9, 0.62)');
  assert.equal(darkTokens.get('--color-chart-series-3'), '#f0a3c8');
  assert.equal(darkTokens.get('--color-nav-active'), '#242138');
  assert.equal(darkTokens.get('--color-chart-grid'), '#2a2a31');
});

test('styleguide colour swatches do not expose the corrupt token name', () => {
  assert.doesNotMatch(css, /--color-overlaseries-3/);
  assert.doesNotMatch(styleguide, /--color-overlaseries-3/);
});
