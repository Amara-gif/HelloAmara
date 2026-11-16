import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demoState = () => ({ ...buildDemoData().stores });
const routeFor = (key) => ({ id: 'project-detail', path: `/project/${key}`, title: 'Project', params: { key } });
const render = (key, query = '') => renderView(routeFor(key), new URLSearchParams(query), demoState());

test('TAG tab strip adds Rule Book and xBuild Report after the shared tabs', () => {
  const html = render('TAG');
  const labels = [...html.matchAll(/<a class="tab"[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ['Overview', 'Work items', 'Modules', 'Pages', 'Rule Book', 'xBuild Report']);
  assert.match(html, /<a class="tab" href="#\/project\/TAG\?tab=xbuild-standard">Rule Book<\/a>/);
  assert.match(html, /<a class="tab" href="#\/project\/TAG\?tab=xbuild-report">xBuild Report<\/a>/);
});

test('TAG Rule Book tab lists local markdown pages and makes no API call', () => {
  const html = render('TAG', 'tab=xbuild-standard');
  assert.match(html, /href="#\/project\/TAG\?tab=xbuild-standard" aria-current="page">Rule Book<\/a>/);
  assert.match(html, /The xBuild Rule Book is not ported to My Platform yet/);
  assert.match(html, /Local markdown pages/);
  assert.match(html, /href="#\/page\/pg6"/);
  assert.doesNotMatch(html, /\/api\//);
});

test('TAG xBuild Report tab is an honest not-ported placeholder', () => {
  const html = render('TAG', 'tab=xbuild-report');
  assert.match(html, /href="#\/project\/TAG\?tab=xbuild-report" aria-current="page">xBuild Report<\/a>/);
  assert.match(html, /The xBuild Report tool is not ported to My Platform yet/);
  assert.match(html, /Outlook\/email actions are unavailable/);
  assert.doesNotMatch(html, /\/api\//);
});

test('other projects never show the TAG-only tabs or their placeholder bodies', () => {
  for (const key of ['MR', 'MRM', 'RSL', 'WD2']) {
    const overview = render(key);
    assert.doesNotMatch(overview, />Rule Book<\/a>/, `${key} shows Rule Book`);
    assert.doesNotMatch(overview, />xBuild Report<\/a>/, `${key} shows xBuild Report`);
    const forced = render(key, 'tab=xbuild-report');
    assert.doesNotMatch(forced, /xBuild Report tool is not ported/, `${key} forced xBuild body`);
    assert.doesNotMatch(forced, /Rule Book is not ported/, `${key} forced Rule Book body`);
  }
});
