import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { buildDemoData, MARKET_REVIEW_DEMO } from '../assets/js/demo-data.js';

const demo = () => {
  const data = buildDemoData();
  return { ...data.stores, ...data.meta };
};
const routeFor = (key) => ({ id: 'project-detail', path: `/project/${key}`, title: 'Project', params: { key } });
const render = (key, query = '') => renderView(routeFor(key), new URLSearchParams(query), demo());
const labelsIn = (html) => [...html.matchAll(/<a class="tab"[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);

test('MR tab strip adds Products, Review Update, Issue Review and Analysis Report', () => {
  const labels = labelsIn(render('MR'));
  assert.deepEqual(labels, [
    'Overview', 'Work items', 'Modules', 'Pages',
    'Products', 'Review Update', 'Find user voices', 'Daily Digest', 'Issue Workbench',
    'PQA Tracker', 'Report Deck', 'Issue Review', 'Analysis Report',
  ]);
  assert.match(render('MR'), /<a class="tab" href="#\/project\/MR\?tab=products">Products<\/a>/);
  assert.match(render('MR'), /<a class="tab" href="#\/project\/MR\?tab=review-update">Review Update<\/a>/);
  assert.match(render('MR'), /<a class="tab" href="#\/project\/MR\?tab=issue-review">Issue Review<\/a>/);
  assert.match(render('MR'), /<a class="tab" href="#\/project\/MR\?tab=analysis-report">Analysis Report<\/a>/);
});

test('MR Products tab lists local demo products and makes no network request', () => {
  const html = render('MR', 'tab=products');
  assert.match(html, /href="#\/project\/MR\?tab=products" aria-current="page">Products<\/a>/);
  assert.match(html, /Local demo catalogue/);
  assert.match(html, /B0MR7RSL01/);
  assert.match(html, /Roselite/);
  assert.match(html, /data-mr-product="mrp1"/);
  assert.doesNotMatch(html, /\/api\//);
  assert.doesNotMatch(html, /fetch\(/);
});

test('MR Issue Review tab renders the local issue list and category chart', () => {
  const html = render('MR', 'tab=issue-review');
  assert.match(html, /href="#\/project\/MR\?tab=issue-review" aria-current="page">Issue Review<\/a>/);
  assert.match(html, /data-mr-issue="MRI-1"/);
  assert.match(html, /Fingerprint smudges after normal use/);
  assert.match(html, /id="mr-issue-chart"/);
  assert.match(html, /Issues by category/);
  assert.doesNotMatch(html, /\/api\//);
});

test('MR Analysis Report tab renders a local Pareto chart and issue mix', () => {
  const html = render('MR', 'tab=analysis-report');
  assert.match(html, /href="#\/project\/MR\?tab=analysis-report" aria-current="page">Analysis Report<\/a>/);
  assert.match(html, /id="mr-analysis-pareto"/);
  assert.match(html, /Issue Pareto/);
  assert.match(html, /Issue mix/);
  assert.match(html, /IndexedDB demo meta/);
  assert.doesNotMatch(html, /\/api\//);
  assert.doesNotMatch(html, /fetch\(/);
});

test('MR Review Update says the scraper is blocked on the owner decision with no fake run', () => {
  const html = render('MR', 'tab=review-update');
  assert.match(html, /href="#\/project\/MR\?tab=review-update" aria-current="page">Review Update<\/a>/);
  assert.match(html, /scraper is blocked on the owner's decision/i);
  assert.match(html, /Blocked on owner decision/);
  assert.match(html, /no fake run/i);
  assert.match(html, /Network requests<\/dt><dd>None/);
  assert.doesNotMatch(html, /data-action="\w*run/i);
  assert.doesNotMatch(html, /\/api\//);
});

test('other Market Review tool tabs are honest Not available placeholders', () => {
  for (const [tab, label] of [['find-user-voices', 'Find user voices'], ['daily-digest', 'Daily Digest'], ['issue-workbench', 'Issue Workbench'], ['pqa-tracker', 'PQA Tracker'], ['report-deck', 'Report Deck']]) {
    const html = render('MR', `tab=${tab}`);
    assert.match(html, new RegExp(`<h2>${label}</h2>`), `${label} heading missing`);
    assert.match(html, /Not available in My Platform yet/);
    assert.match(html, /no fake data or run action/i);
    assert.doesNotMatch(html, /\/api\//);
  }
});

test('only MR gets the Market Review tool tabs', () => {
  for (const key of ['TAG', 'MRM', 'RSL', 'WD2']) {
    const labels = labelsIn(render(key));
    for (const label of ['Products', 'Review Update', 'Issue Review', 'Analysis Report']) {
      assert.ok(!labels.includes(label), `${key} shows ${label}`);
    }
    const forced = render(key, 'tab=products');
    assert.doesNotMatch(forced, /Local demo catalogue/);
    assert.doesNotMatch(forced, /mr-analysis-pareto/);
  }
});

test('demo meta ships local products and issues for the Market Review tabs', () => {
  const data = buildDemoData();
  assert.equal(data.meta.marketReview, MARKET_REVIEW_DEMO);
  assert.ok(data.meta.marketReview.products.length >= 3);
  assert.ok(data.meta.marketReview.issues.length >= 3);
  assert.ok(data.meta.marketReview.products.every((row) => row.name && row.asin));
  assert.ok(data.meta.marketReview.issues.every((row) => row.key && row.product && row.summary));
});
