import test from 'node:test';
import assert from 'node:assert/strict';
import { routeForPath } from '../assets/js/routes.js';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';

const demo = buildDemoData().stores;
const state = { tasks: demo.tasks, bugs: demo.bugs };

test('#/go/T-1 opens the demo task detail', () => {
  const route = routeForPath('/go/T-1', state);
  assert.equal(route.id, 'task-detail');
  assert.equal(route.params.id, 't1');
  assert.equal(route.path, '/task/t1');
  assert.equal(route.redirectFrom, '/go/T-1');
});

test('#/go/WD-1 opens the demo bug detail', () => {
  const route = routeForPath('/go/WD-1', state);
  assert.equal(route.id, 'bug-detail');
  assert.equal(route.params.id, 'b1');
  assert.equal(route.path, '/bug/b1');
  assert.equal(route.redirectFrom, '/go/WD-1');
});

test('the key prefix is case-insensitive', () => {
  assert.equal(routeForPath('/go/t-1', state).id, 'task-detail');
  assert.equal(routeForPath('/go/T-1', state).params.id, 't1');
  assert.equal(routeForPath('/go/wd-1', state).id, 'bug-detail');
  assert.equal(routeForPath('/go/Wd-1', state).params.id, 'b1');
});

test('an unknown key renders the existing Not found page with a Home link', () => {
  const route = routeForPath('/go/ZZ-42', state);
  assert.equal(route.id, 'not-found');
  assert.equal(route.path, '/go/ZZ-42');

  const html = renderView(route, new URLSearchParams(), state);
  assert.match(html, /Page not found/);
  assert.match(html, /Back to Home/);
  assert.match(html, /href="#\/"/);
});

test('a well-formed prefix with no matching row is Not found', () => {
  assert.equal(routeForPath('/go/T-999', state).id, 'not-found');
  assert.equal(routeForPath('/go/WD-999', state).id, 'not-found');
  assert.equal(routeForPath('/go/ABC-1', state).id, 'not-found');
});
