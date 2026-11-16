import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { routeForPath } from '../assets/js/routes.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import {
  start,
  getState,
  createPage,
  updatePage,
  softDeletePages,
} from '../assets/js/data.js';
import { getOne } from '../assets/js/db.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const demoState = () => ({ ...buildDemoData().stores });
const pagesRoute = () => ({ id: 'pages', path: '/pages', title: 'Pages' });
const pageRoute = (id) => ({ id: 'page-view', path: `/page/${id}`, title: 'Page', params: { id } });

let accountId;

beforeEach(() => {
  accountId = tempAccountId('pages-view');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

test('pages list has select-all, per-row checkboxes and a guarded Delete selected action', () => {
  const html = renderView(pagesRoute(), new URLSearchParams(), demoState());
  assert.match(html, /<input type="checkbox" data-select-all-pages aria-label="Select all pages"/);
  assert.match(html, /data-page-select value="pg1"/);
  assert.match(html, /data-page-select value="pg6"/);
  assert.match(html, /data-action="delete-selected-pages" disabled>Delete selected<\/button>/);
  assert.match(html, /data-page-selection-count>0 selected</);
});

test('pages search also matches a comma-separated tags field', () => {
  const state = demoState();
  state.pages = state.pages.map((page) => (page.id === 'pg1' ? { ...page, tags: 'alpha, beta' } : page));
  const html = renderView(pagesRoute(), new URLSearchParams('q=alpha'), state);
  assert.match(html, /Summary · Roselite/);
  assert.doesNotMatch(html, /Weekly decisions/);
});

test('page view shows author, date, project, optional tags, markdown body, Edit and Print', () => {
  const state = demoState();
  state.pages = state.pages.map((page) => (page.id === 'pg1' ? { ...page, tags: 'alpha, beta' } : page));
  const html = renderView(pageRoute('pg1'), new URLSearchParams(), state);
  assert.match(html, /<dt>Author<\/dt><dd>Amara<\/dd>/);
  assert.match(html, /<dt>Date<\/dt>/);
  assert.match(html, /<dt>Project<\/dt><dd><a class="mono-link" href="#\/project\/RSL\?tab=pages">RSL Roselite<\/a><\/dd>/);
  assert.match(html, /<dt>Tags<\/dt><dd><span class="badge badge-muted">alpha<\/span> <span class="badge badge-muted">beta<\/span><\/dd>/);
  assert.match(html, /<h2>What changed<\/h2>/);
  assert.match(html, /href="#\/page\/pg1\/edit">Edit<\/a>/);
  assert.match(html, /data-action="print">Print<\/button>/);
  assert.match(html, /<article class="card print-friendly" data-print-region>/);
});

test('a page without tags omits the optional Tags row', () => {
  const html = renderView(pageRoute('pg2'), new URLSearchParams(), demoState());
  assert.doesNotMatch(html, /<dt>Tags<\/dt>/);
  assert.match(html, /<dt>Author<\/dt>/);
});

test('/note/:id is a redirect alias for /page/:id', () => {
  const route = routeForPath('/note/pg1', demoState());
  assert.equal(route.id, 'page-view');
  assert.deepEqual(route.params, { id: 'pg1' });
  assert.equal(route.path, '/page/pg1');
  assert.equal(route.redirectFrom, '/note/pg1');
});

test('page tags normalize on save and softDeletePages tombstones every selected row', async () => {
  await start({ id: accountId, name: 'Pages view test', test: false });
  const first = await createPage({ title: 'Tagged page', tags: ' alpha, beta ,, ' });
  assert.equal(first.tags, 'alpha, beta');
  const updated = await updatePage(first.id, { tags: ['Gamma', ' delta '] });
  assert.equal(updated.tags, 'Gamma, delta');
  const second = await createPage({ title: 'No tags page' });
  assert.equal(second.tags, '');

  await softDeletePages([first.id, second.id]);
  assert.ok(!getState().pages.some((page) => page.id === first.id || page.id === second.id), 'deleted pages leave live state');
  assert.ok((await getOne('pages', first.id)).deletedAt, 'first page keeps its tombstone');
  assert.ok((await getOne('pages', second.id)).deletedAt, 'second page keeps its tombstone');
});
