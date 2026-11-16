import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDemoData } from '../assets/js/demo-data.js';
import { renderView } from '../assets/js/views.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

test('manifest is named My Platform and points only at self-hosted icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'My Platform');
  assert.equal(manifest.short_name, 'My Platform');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.scope, './');
  assert.doesNotMatch(JSON.stringify(manifest), /https?:\/\//i);

  const sizes = new Set();
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\.\/assets\/icons\//, 'icons must be self-hosted under assets/icons');
    assert.equal(icon.type, 'image/png');
    sizes.add(icon.sizes);
    const bytes = readFileSync(join(root, icon.src.replace(/^\.\//, '')));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${icon.src} is a PNG`);
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16), width, `${icon.src} width`);
    assert.equal(bytes.readUInt32BE(20), height, `${icon.src} height`);
  }
  assert.ok(sizes.has('192x192'), 'manifest offers a 192 px icon');
  assert.ok(sizes.has('512x512'), 'manifest offers a 512 px icon');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'manifest offers a maskable icon');
});

test('index.html advertises the manifest and a local touch icon', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/assets\/icons\/icon-192\.png" \/>/);
  assert.match(html, /<meta name="application-name" content="My Platform" \/>/);
});

test('service worker precaches every app-shell HTML, CSS and JS file', () => {
  const source = read('sw.js');
  const block = source.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, 'sw.js defines APP_SHELL');
  const entries = [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const shell = new Set(entries.map((entry) => entry.replace(/^\.\//, '')));

  for (const required of ['index.html', 'styleguide.html', 'manifest.webmanifest', 'assets/css/tokens.css', 'assets/css/components.css']) {
    assert.ok(shell.has(required), `APP_SHELL includes ${required}`);
  }
  for (const file of readdirSync(join(root, 'assets/js')).filter((name) => name.endsWith('.js'))) {
    assert.ok(shell.has(`assets/js/${file}`), `APP_SHELL includes assets/js/${file}`);
  }
  for (const file of readdirSync(join(root, 'assets/css')).filter((name) => name.endsWith('.css'))) {
    assert.ok(shell.has(`assets/css/${file}`), `APP_SHELL includes assets/css/${file}`);
  }
  for (const entry of shell) {
    if (!entry) continue;
    assert.ok(existsSync(join(root, entry)), `precached file exists: ${entry}`);
  }
});

test('service worker is versioned, cleans old caches and never uses third-party URLs', () => {
  const source = read('sw.js');
  assert.match(source, /const CACHE_VERSION = '[^']+'/);
  assert.match(source, /const CACHE_NAME = `\$\{CACHE_PREFIX\}\$\{CACHE_VERSION\}`/);
  assert.match(source, /caches\.keys\(\)/);
  assert.match(source, /\.filter\(\(key\) => key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME\)/);
  assert.match(source, /caches\.delete\(key\)/);
  assert.match(source, /request\.mode === 'navigate'/);
  assert.match(source, /SKIP_WAITING/);
  assert.doesNotMatch(source, /https?:\/\//i);
});

test('Appearance page renders the install affordance', () => {
  const demo = buildDemoData();
  const state = {
    ...demo.stores,
    settings: demo.meta.settings,
    account: { name: 'Amara' },
    persistentStorage: { status: 'Granted' },
  };
  const html = renderView(
    { id: 'settings-appearance', path: '/settings/appearance' },
    new URLSearchParams(),
    state
  );
  assert.match(html, /id="install-status"/);
  assert.match(html, /data-action="install-app"/);
  assert.match(html, /Install My Platform/);
  assert.match(html, /beforeinstallprompt/);
});
