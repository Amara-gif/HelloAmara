#!/usr/bin/env node
// Fails when a page or script bypasses the design system.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
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

for (const file of files) {
  const name = relative(root, file);
  if (name === 'assets/css/tokens.css') continue;

  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, index) => {
    const lineNumber = index + 1;
    if (/\sstyle\s*=/i.test(line)) addProblem(file, lineNumber, 'inline style attribute');
    if (/#[0-9a-f]{3,8}\b/i.test(line)) addProblem(file, lineNumber, 'hex colour literal');
    if (/\b(?:rgb|rgba|hsl|hsla)\(/i.test(line)) addProblem(file, lineNumber, 'colour function outside tokens.css');
    if (/font-family\s*:\s*(?!\s*var\()/i.test(line)) addProblem(file, lineNumber, 'font-family literal outside tokens.css');
    if (/font-size\s*:\s*[^;]*\d+px/i.test(line)) addProblem(file, lineNumber, 'px font size outside tokens.css');
    if (/<style[\s>]/i.test(line)) addProblem(file, lineNumber, 'inline style block');
  });
}

const cssFiles = readdirSync(cssDir).filter((file) => file.endsWith('.css')).sort();
if (cssFiles.join(',') !== 'components.css,tokens.css') {
  problems.push(`assets/css must contain only components.css and tokens.css, found: ${cssFiles.join(', ')}`);
}

const components = readFileSync(join(cssDir, 'components.css'), 'utf8');
const styleguide = readFileSync(join(root, 'styleguide.html'), 'utf8');

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
