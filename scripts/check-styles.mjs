#!/usr/bin/env node
// Fails when a page or script bypasses the design system.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname, resolve } from 'node:path';

const scriptRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const root = resolve(process.argv[2] ?? scriptRoot);
const cssDir = join(root, 'assets/css');
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

// Custom properties written by JavaScript at runtime, so they are not expected
// to appear as declarations in tokens.css. Keep this list in sync with
// tests/token-references.test.js.
const runtimeProperties = new Set([
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

function walk(path, files = []) {
  for (const entry of readdirSync(path)) {
    if (['.git', 'node_modules', 'docs'].includes(entry)) continue;
    const full = join(path, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const files = [
  join(root, 'index.html'),
  join(root, 'styleguide.html'),
  ...walk(join(root, 'assets')),
].filter((file) => ['.html', '.css', '.js'].includes(extname(file)));

const problems = [];

function addProblem(file, line, message) {
  problems.push(`${relative(root, file)}:${line} ${message}`);
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

// Blank the comments but keep newlines, so positions still map to source lines.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function rootBlocks(source) {
  const clean = stripComments(source);
  const blocks = [];
  const blockPattern = /:root\s*\{([^{}]*)\}/g;
  let match;
  while ((match = blockPattern.exec(clean))) {
    blocks.push({
      body: match[1],
      line: lineNumberAt(source, match.index + match[0].indexOf('{')),
    });
  }
  return blocks;
}

function parseTokenBlock(file, block, label) {
  const declarations = new Map();
  const lines = block.body.split('\n');
  let pending = null;

  function record(text, lineNumber) {
    const colon = text.indexOf(':');
    const name = (colon === -1 ? text : text.slice(0, colon)).trim();
    const value = colon === -1 ? '' : text.slice(colon + 1).trim();

    if (!/^--[a-z0-9-]+$/i.test(name)) {
      addProblem(file, lineNumber, `${label}: malformed token name ${JSON.stringify(name)}`);
      return;
    }
    if (!value) addProblem(file, lineNumber, `${label}: ${name} has no value`);
    if (declarations.has(name)) {
      addProblem(file, lineNumber, `${label}: duplicate token ${name}`);
      return;
    }
    declarations.set(name, { value, line: lineNumber });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = block.line + index;
    const line = lines[index].trim();
    if (!line) continue;
    if (line === '{' || line === '}') continue;

    if (!pending) {
      if (!/^--/.test(line)) {
        addProblem(
          file,
          lineNumber,
          `${label}: expected a blank line, a comment or a "--name: value;" declaration`,
        );
        continue;
      }
      pending = { text: line, line: lineNumber };
    } else if (/^--/.test(line)) {
      addProblem(file, pending.line, `${label}: missing semicolon after ${pending.text.split(':')[0].trim()}`);
      pending = { text: line, line: lineNumber };
    } else {
      pending.text += `\n${line}`;
    }

    const semicolon = pending.text.indexOf(';');
    if (semicolon === -1) continue;

    const declaration = pending.text.slice(0, semicolon);
    const trailing = pending.text.slice(semicolon + 1).trim();
    if (trailing) {
      addProblem(file, lineNumber, `${label}: only one token declaration is allowed per line`);
    }
    record(declaration, pending.line);
    pending = null;
  }

  if (pending) {
    addProblem(file, pending.line, `${label}: unterminated declaration ${JSON.stringify(pending.text)}`);
  }

  return declarations;
}

function declaredCustomProperties(source) {
  const names = new Set();
  for (const match of stripComments(source).matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    names.add(match[1]);
  }
  return names;
}

function checkTokenReferences(file, source, definedNames) {
  const clean = stripComments(source);
  const referencePattern = /var\(\s*(--[a-z0-9-]+)/gi;
  let match;
  while ((match = referencePattern.exec(clean))) {
    const name = match[1];
    if (definedNames.has(name) || runtimeProperties.has(name)) continue;
    addProblem(
      file,
      lineNumberAt(source, match.index),
      `var(${name}) does not resolve to a token or a runtime property`,
    );
  }
}

for (const file of files) {
  const name = relative(root, file);
  const inTokensFile = name === 'assets/css/tokens.css';
  const text = readFileSync(file, 'utf8');

  // tokens.css is validated by the token rules below. Keep the line-level
  // markup/colour rules off it, exactly as the original checker did (it used
  // to skip the file entirely), so token-only files may still contain hex,
  // colour functions and font-family literals.
  if (inTokensFile) continue;

  text.split('\n').forEach((line, index) => {
    const lineNumber = index + 1;
    if (/\sstyle\s*=/i.test(line)) addProblem(file, lineNumber, 'inline style attribute');
    if (/#[0-9a-f]{3,8}\b/i.test(line)) {
      addProblem(file, lineNumber, 'hex colour literal');
    }
    if (/\b(?:rgb|rgba|hsl|hsla)\(/i.test(line)) {
      addProblem(file, lineNumber, 'colour function outside tokens.css');
    }
    if (/font-family\s*:\s*(?!\s*var\()/i.test(line)) {
      addProblem(file, lineNumber, 'font-family literal outside tokens.css');
    }
    if (/font-size\s*:\s*[^;]*\d+px/i.test(line)) {
      addProblem(file, lineNumber, 'px font size outside tokens.css');
    }
    if (/<style[\s>]/i.test(line)) addProblem(file, lineNumber, 'inline style block');
  });
}

const cssFiles = readdirSync(cssDir).filter((file) => file.endsWith('.css')).sort();
if (cssFiles.join(',') !== 'components.css,tokens.css') {
  problems.push(`assets/css must contain only components.css and tokens.css, found: ${cssFiles.join(', ')}`);
}

const tokensFile = join(cssDir, 'tokens.css');
const tokens = readFileSync(tokensFile, 'utf8');
const tokenBlocks = rootBlocks(tokens);
const allTokens = new Set();

if (!tokenBlocks.length) {
  problems.push('tokens.css has no :root block');
} else {
  const lightTokens = parseTokenBlock(tokensFile, tokenBlocks[0], 'light :root');
  for (const name of lightTokens.keys()) allTokens.add(name);

  for (let index = 1; index < tokenBlocks.length; index += 1) {
    const darkTokens = parseTokenBlock(tokensFile, tokenBlocks[index], `dark :root ${index}`);
    for (const [name, declaration] of darkTokens) {
      allTokens.add(name);
      if (!lightTokens.has(name)) {
        addProblem(
          tokensFile,
          declaration.line,
          `dark token ${name} is missing from the light :root block`,
        );
      }
    }
  }
}

const componentsFile = join(cssDir, 'components.css');
const styleguideFile = join(root, 'styleguide.html');
const components = readFileSync(componentsFile, 'utf8');
const styleguide = readFileSync(styleguideFile, 'utf8');

const definedNames = new Set([...allTokens, ...declaredCustomProperties(components)]);
checkTokenReferences(componentsFile, components, definedNames);
checkTokenReferences(styleguideFile, styleguide, definedNames);

for (const component of requiredComponents) {
  if (!new RegExp(`\\.${component}(?![\\w-])`).test(components)) {
    problems.push(`components.css does not define .${component}`);
  }
  if (!new RegExp(`class=["'][^"']*\\b${component}\\b`).test(styleguide)) {
    problems.push(`styleguide.html does not show .${component}`);
  }
}

if (problems.length) {
  console.error(`Style check failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Style check passed: ${files.length} files, ${requiredComponents.length} components, no inline styles or colour literals outside tokens.css.`);
