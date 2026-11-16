import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderView, ratingPreferences, visibleRatingSeries } from '../assets/js/views.js';
import { buildLinePath, renderLineChart } from '../assets/js/chart.js';

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = nodes;
  }
}

const ratings = {
  labels: ['27', '28', '29'],
  series: [
    { name: 'Roselite', values: [4.1, 4.3, 4.2] },
    { name: 'Miramar', values: [3.8, 3.9, 4.0] },
  ],
  hidden: [],
  lineStyle: 'smooth',
};

test('rating preferences default to smooth and honour saved hidden products', () => {
  assert.deepEqual(visibleRatingSeries(ratings).map((item) => item.name), ['Roselite', 'Miramar']);
  assert.equal(ratingPreferences(ratings).lineStyle, 'smooth');

  const saved = { ...ratings, hidden: ['Miramar'], lineStyle: 'straight' };
  assert.deepEqual(visibleRatingSeries(saved).map((item) => item.name), ['Roselite']);
  assert.equal(ratingPreferences(saved).lineStyle, 'straight');
  assert.equal(ratingPreferences({ ...ratings, lineStyle: 'unknown' }).lineStyle, 'smooth');
});

test('rating page exposes Back to Home, product picker and line-style controls', () => {
  const state = { ratings: { ...ratings, hidden: ['Miramar'], lineStyle: 'straight' } };
  const html = renderView({ id: 'rating-trend', path: '/rating-trend' }, new URLSearchParams(), state);
  assert.match(html, /href="#\/"[^>]*>.*Back to Home/s);
  assert.match(html, /data-action="rating-copy"[^>]*>Copy image/);
  assert.match(html, /data-action="rating-choose"[^>]*>Choose products/);
  assert.match(html, /data-action="rating-line-style" data-style="smooth" aria-pressed="false"[^>]*>Smooth curve/);
  assert.match(html, /data-action="rating-line-style" data-style="straight" aria-pressed="true"[^>]*>Straight line/);
  assert.match(html, /data-rating-count>1 of 2 products on the chart/);
  assert.match(html, /Roselite/);
  assert.doesNotMatch(html, /Miramar/);
});

test('buildLinePath draws a Catmull-Rom curve or a straight polyline', () => {
  const points = [{ x: 0, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 5 }, { x: 30, y: 15 }];
  const smooth = buildLinePath(points, 'smooth');
  const straight = buildLinePath(points, 'straight');
  assert.match(smooth, /^M 0\.0 10\.0 C /);
  assert.equal(straight, 'M 0.0 10.0 L 10.0 20.0 L 20.0 5.0 L 30.0 15.0');
  assert.equal(buildLinePath([], 'smooth'), '');
});

test('renderLineChart passes the saved line style to the SVG paths', () => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new FakeNode(tag) };
  try {
    const straightBox = new FakeNode('div');
    renderLineChart(straightBox, { labels: ratings.labels, series: ratings.series, lineStyle: 'straight', title: 'Rating trend' });
    const straightPath = straightBox.children[0].children.find((node) => node.tag === 'path');
    assert.doesNotMatch(straightPath.attributes.d, /C /);

    const smoothBox = new FakeNode('div');
    renderLineChart(smoothBox, { labels: ratings.labels, series: ratings.series, lineStyle: 'smooth', title: 'Rating trend' });
    const smoothPath = smoothBox.children[0].children.find((node) => node.tag === 'path');
    assert.match(smoothPath.attributes.d, / C /);
    assert.equal(smoothPath.attributes.class, 'chart-line chart-line-1');
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
