import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { start, getState, createPage, updatePage } from '../assets/js/data.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const demoState = () => ({ ...buildDemoData().stores });
const pageViewRoute = (id) => ({ id: 'page-view', path: `/page/${id}`, title: 'Page', params: { id } });
const pageEditRoute = (id) => ({ id: 'page-edit', path: `/page/${id}/edit`, title: 'Page editor', params: { id } });

let accountId;

beforeEach(() => {
  accountId = tempAccountId('page-editor');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

test('the page editor pairs the markdown textarea with a live preview and an AI Polish button', () => {
  const html = renderView(pageEditRoute('pg1'), new URLSearchParams(), demoState());
  assert.match(html, /<textarea[^>]*data-page-preview-source>/);
  assert.match(html, /<div class="prose" data-page-preview aria-live="polite"><h2>What changed<\/h2>/);
  assert.match(html, /data-action="ai-polish">AI Polish<\/button>/);
  assert.match(html, /title="[^"]*"|name="title"/);
  assert.match(html, /required aria-required="true"/);
});

test('blank and whitespace-only titles are rejected before a write', async () => {
  await start({ id: accountId, name: 'Page editor test', test: false });
  await assert.rejects(createPage({ title: '   ', body: 'Body' }), /title is required/i);
  const page = await createPage({ title: 'Real title' });
  await assert.rejects(updatePage(page.id, { title: '   ' }), /title is required/i);
  assert.equal(getState().pages.length, 1);
});

test('saving appends the previous row as a revision and increments rev', async () => {
  await start({ id: accountId, name: 'Page revision test', test: false });
  const created = await createPage({ title: 'Draft', body: '## One', tags: 'first' });
  assert.equal(created.rev, 1);
  assert.equal(created.revisions.length, 0);

  const second = await updatePage(created.id, { title: 'Final', body: '## Two', tags: 'first, second' });
  assert.equal(second.rev, 2);
  assert.equal(second.revisions.length, 1);
  assert.equal(second.revisions[0].rev, 1);
  assert.equal(second.revisions[0].body, '## One');
  assert.equal(second.revisions[0].title, 'Draft');
  assert.ok(second.revisions[0].id.startsWith('rev-'), 'every snapshot has its own id');
  assert.equal(getState().pages.find((row) => row.id === created.id).revisions.length, 1);

  const third = await updatePage(created.id, { body: '## Three' });
  assert.equal(third.rev, 3);
  assert.deepEqual(third.revisions.map((revision) => revision.rev), [1, 2]);
  assert.equal(third.revisions[0].title, 'Draft');
  assert.equal(third.revisions[1].title, 'Final');
});

test('an older revision opens read-only in the page view and can be selected by rev or id', async () => {
  await start({ id: accountId, name: 'Page view revision test', test: false });
  const created = await createPage({ title: 'Draft', body: '## One' });
  const current = await updatePage(created.id, { title: 'Final', body: '## Two' });
  const revision = current.revisions[0];

  for (const rev of [String(revision.rev), revision.id]) {
    const html = renderView(pageViewRoute(created.id), new URLSearchParams({ rev }), getState());
    assert.match(html, /<h2>One<\/h2>/, `revision ${rev} renders its body`);
    assert.doesNotMatch(html, /<h2>Two<\/h2>/);
    assert.match(html, /read-only/i);
    assert.match(html, /Current version/);
    assert.doesNotMatch(html, /href="#\/page\/[^"]+\/edit">Edit<\/a>/);
    assert.match(html, /data-revision-history/);
  }

  const latest = renderView(pageViewRoute(created.id), new URLSearchParams(), getState());
  assert.match(latest, /<h2>Two<\/h2>/);
  assert.match(latest, /href="#\/page\/[^"]+\/edit">Edit<\/a>/);
  assert.match(latest, /href="#\/page\/[^"]+\?rev=1"[^>]*>Revision 1/);
  assert.doesNotMatch(latest, /read-only/i);
});

test('the edit URL cannot open an older revision in the editable form', async () => {
  await start({ id: accountId, name: 'Read-only edit test', test: false });
  const created = await createPage({ title: 'Draft', body: '## One' });
  await updatePage(created.id, { body: '## Two' });
  const html = renderView(pageEditRoute(created.id), new URLSearchParams({ rev: '1' }), getState());
  assert.doesNotMatch(html, /data-page-preview-source/);
  assert.match(html, /<h2>One<\/h2>/);
  assert.match(html, /read-only/i);
});
