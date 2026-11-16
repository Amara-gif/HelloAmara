// The only chart renderer. Pages pass data here and never draw SVG themselves.
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function prepare(container, title, width = 420, height = 180) {
  const svg = svgEl('svg', { class: 'chart-svg', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet' });
  const titleNode = svgEl('title');
  titleNode.textContent = title;
  svg.append(titleNode);
  container.replaceChildren(svg);
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', title);
  return svg;
}

export function renderBarChart(container, { labels = [], values = [], title = 'Bar chart' } = {}) {
  if (!container) throw new Error('renderBarChart: container is required');
  const data = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...data, 1);
  const width = 420;
  const height = 180;
  const pad = { top: 22, right: 8, bottom: 30, left: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.min(44, slot * 0.58);
  const svg = prepare(container, title, width, height);

  svg.append(svgEl('line', { class: 'chart-grid', x1: pad.left, y1: pad.top + plotH, x2: width - pad.right, y2: pad.top + plotH }));
  data.forEach((value, index) => {
    const barH = (value / max) * plotH;
    const x = pad.left + slot * index + (slot - barW) / 2;
    const y = pad.top + plotH - barH;
    const bar = svgEl('rect', { class: index % 2 ? 'chart-bar-alt' : 'chart-bar', x, y, width: barW, height: barH, rx: 4 });
    const barTitle = svgEl('title');
    barTitle.textContent = `${labels[index] ?? 'Unlabelled'}: ${value}`;
    bar.append(barTitle);
    svg.append(bar);
    const valueLabel = svgEl('text', { class: 'chart-value', x: x + barW / 2, y: Math.max(y - 6, 12), 'text-anchor': 'middle' });
    valueLabel.textContent = String(value);
    svg.append(valueLabel);
    const label = svgEl('text', { class: 'chart-label', x: x + barW / 2, y: height - 8, 'text-anchor': 'middle' });
    label.textContent = labels[index] ?? '';
    svg.append(label);
  });
  return svg;
}

export function renderLineChart(container, { labels = [], series = [], title = 'Line chart' } = {}) {
  if (!container) throw new Error('renderLineChart: container is required');
  const width = 620;
  const height = 260;
  const pad = { top: 20, right: 16, bottom: 30, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = series.flatMap((item) => item.values);
  const min = Math.floor(Math.min(...all, 3));
  const max = Math.ceil(Math.max(...all, 5));
  const range = Math.max(max - min, 1);
  const xAt = (index) => pad.left + (plotW * index) / Math.max(labels.length - 1, 1);
  const yAt = (value) => pad.top + plotH - ((value - min) / range) * plotH;
  const svg = prepare(container, title, width, height);

  for (let step = 0; step <= 4; step += 1) {
    const value = min + (range * step) / 4;
    const y = yAt(value);
    svg.append(svgEl('line', { class: 'chart-grid', x1: pad.left, y1: y, x2: width - pad.right, y2: y }));
    const label = svgEl('text', { class: 'chart-label', x: pad.left - 6, y: y + 4, 'text-anchor': 'end' });
    label.textContent = value.toFixed(1);
    svg.append(label);
  }

  labels.forEach((label, index) => {
    if (index % 2 !== 0 && index !== labels.length - 1) return;
    const text = svgEl('text', { class: 'chart-label', x: xAt(index), y: height - 8, 'text-anchor': 'middle' });
    text.textContent = label;
    svg.append(text);
  });

  series.forEach((item, seriesIndex) => {
    const path = item.values.map((value, index) => `${index ? 'L' : 'M'} ${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`).join(' ');
    svg.append(svgEl('path', { class: `chart-line chart-line-${seriesIndex + 1}`, d: path }));
    item.values.forEach((value, index) => {
      svg.append(svgEl('circle', { class: `chart-point chart-line-${seriesIndex + 1}`, cx: xAt(index), cy: yAt(value), r: 2.3 }));
    });
  });
  return svg;
}

export function renderParetoChart(container, { labels = [], values = [], title = 'Pareto chart' } = {}) {
  if (!container) throw new Error('renderParetoChart: container is required');
  const data = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const width = 420;
  const height = 220;
  const pad = { top: 20, right: 28, bottom: 38, left: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(...data, 1);
  const total = data.reduce((sum, value) => sum + value, 0) || 1;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.min(34, slot * 0.56);
  const svg = prepare(container, title, width, height);

  svg.append(svgEl('line', { class: 'chart-grid', x1: pad.left, y1: pad.top + plotH, x2: width - pad.right, y2: pad.top + plotH }));
  const points = [];
  let cumulative = 0;
  data.forEach((value, index) => {
    const barH = (value / max) * plotH;
    const x = pad.left + slot * index + (slot - barW) / 2;
    const y = pad.top + plotH - barH;
    svg.append(svgEl('rect', { class: 'chart-bar', x, y, width: barW, height: barH, rx: 3 }));
    cumulative += value;
    points.push([x + barW / 2, pad.top + plotH - (cumulative / total) * plotH]);
    const label = svgEl('text', { class: 'chart-label', x: x + barW / 2, y: height - 8, 'text-anchor': 'middle' });
    label.textContent = labels[index] ?? '';
    svg.append(label);
  });

  if (points.length) {
    const path = points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    svg.append(svgEl('path', { class: 'chart-line chart-line-2', d: path }));
    points.forEach(([cx, cy]) => {
      svg.append(svgEl('circle', { class: 'chart-point chart-line-2', cx, cy, r: 2.5 }));
    });
  }
  return svg;
}

export function renderDonutChart(container, { labels = [], values = [], title = 'Donut chart' } = {}) {
  if (!container) throw new Error('renderDonutChart: container is required');
  const data = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = data.reduce((sum, value) => sum + value, 0);
  const width = 220;
  const height = 220;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 76;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const svg = prepare(container, title, width, height);

  svg.append(svgEl('circle', {
    class: 'chart-donut-track',
    cx, cy, r: radius, 'stroke-width': strokeWidth,
  }));

  let offset = 0;
  data.forEach((value, index) => {
    if (value <= 0) return;
    const fraction = value / (total || 1);
    svg.append(svgEl('circle', {
      class: `chart-donut-segment chart-donut-${(index % 6) + 1}`,
      cx, cy, r: radius, 'stroke-width': strokeWidth,
      'stroke-dasharray': `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`,
      'stroke-dashoffset': `${(-offset * circumference).toFixed(2)}`,
      transform: `rotate(-90 ${cx} ${cy})`,
    }));
    offset += fraction;
  });

  const totalLabel = svgEl('text', { class: 'chart-donut-total', x: cx, y: cy + 3, 'text-anchor': 'middle' });
  totalLabel.textContent = String(total);
  svg.append(totalLabel);
  const caption = svgEl('text', { class: 'chart-donut-caption', x: cx, y: cy + 22, 'text-anchor': 'middle' });
  caption.textContent = labels.length === 1 ? 'item' : 'items';
  svg.append(caption);
  return svg;
}
