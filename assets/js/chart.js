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
    svg.append(svgEl('rect', { class: index % 2 ? 'chart-bar-alt' : 'chart-bar', x, y, width: barW, height: barH, rx: 4 }));
    const valueLabel = svgEl('text', { class: 'chart-value', x: x + barW / 2, y: Math.max(y - 6, 12), 'text-anchor': 'middle' });
    valueLabel.textContent = String(value);
    svg.append(valueLabel);
    const label = svgEl('text', { class: 'chart-label', x: x + barW / 2, y: height - 8, 'text-anchor': 'middle' });
    label.textContent = labels[index] ?? '';
    svg.append(label);
  });
  return svg;
}

// Catmull-Rom control points keep the curve inside the data without adding a
// chart dependency. "straight" is the legacy polyline path.
export function buildLinePath(points, lineStyle = 'smooth') {
  if (!points.length) return '';
  if (lineStyle === 'straight' || points.length < 3) {
    return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  }
  const at = (index) => points[Math.max(0, Math.min(points.length - 1, index))];
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = at(index - 1);
    const start = at(index);
    const end = at(index + 1);
    const next = at(index + 2);
    const cp1x = start.x + (end.x - previous.x) / 6;
    const cp1y = start.y + (end.y - previous.y) / 6;
    const cp2x = end.x - (next.x - start.x) / 6;
    const cp2y = end.y - (next.y - start.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  }
  return path;
}

export function renderLineChart(container, { labels = [], series = [], title = 'Line chart', lineStyle = 'smooth', curve } = {}) {
  if (!container) throw new Error('renderLineChart: container is required');
  const pathStyle = curve === undefined ? (lineStyle === 'straight' ? 'straight' : 'smooth') : (curve ? 'smooth' : 'straight');
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
    const points = item.values.map((value, index) => ({ x: xAt(index), y: yAt(value) }));
    svg.append(svgEl('path', { class: `chart-line chart-line-${seriesIndex + 1}`, d: buildLinePath(points, pathStyle) }));
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

// Copy helpers keep chart export inside the only chart module. PNG through a
// canvas is tried first because more clipboards accept it; SVG is the fallback
// on browsers that expose image support but reject PNG write.
function chartSize(svg) {
  const viewBox = String(svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
  const width = Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : 620;
  const height = Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : 260;
  return { width, height };
}

function tokenValue(name) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return '';
  }
}

function copyPaint(source, target) {
  if (target.tagName.toLowerCase() === 'title') return;
  const computed = getComputedStyle(source);
  for (const name of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'opacity']) {
    const value = computed.getPropertyValue(name);
    if (value) target.setAttribute(name, value);
  }
  if (target.tagName.toLowerCase() === 'text') {
    for (const name of ['font-family', 'font-size', 'font-weight']) {
      const value = computed.getPropertyValue(name);
      if (value) target.setAttribute(name, value);
    }
  }
}

export function serializeChart(svg) {
  if (!svg) throw new Error('serializeChart: an SVG is required');
  const { width, height } = chartSize(svg);
  const clone = svg.cloneNode(true);
  const originals = [...svg.querySelectorAll('*')];
  const copies = [...clone.querySelectorAll('*')];
  originals.forEach((source, index) => copyPaint(source, copies[index]));
  const background = svgEl('rect', { x: 0, y: 0, width, height, fill: tokenValue('--color-surface') || 'white' });
  const firstGraphic = [...clone.children].find((child) => child.tagName !== 'title');
  clone.insertBefore(background, firstGraphic ?? null);
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return `<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(clone)}`;
}

function loadSvgImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The chart image could not be prepared.'));
    image.src = url;
  });
}

async function chartPngBlob(svg) {
  if (typeof XMLSerializer === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') return null;
  const { width, height } = chartSize(svg);
  const markup = serializeChart(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const image = await loadSvgImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyChartImage(container) {
  const svg = container?.tagName?.toLowerCase() === 'svg' ? container : container?.querySelector?.('svg');
  if (!svg) throw new Error('There is no chart to copy.');
  const clipboard = globalThis.navigator?.clipboard;
  const ClipboardItemType = globalThis.ClipboardItem;
  if (!clipboard?.write || typeof ClipboardItemType !== 'function') {
    throw new Error('Clipboard image copy is not available.');
  }

  try {
    // Pass the PNG promise to ClipboardItem so the write starts while the
    // click still counts as a user gesture.
    await clipboard.write([new ClipboardItemType({ 'image/png': chartPngBlob(svg) })]);
    return 'png';
  } catch {
    // Some browsers accept SVG clipboard items but not canvas PNG.
  }

  try {
    const markup = serializeChart(svg);
    const blob = new Blob([markup], { type: 'image/svg+xml' });
    await clipboard.write([new ClipboardItemType({ 'image/svg+xml': blob })]);
    return 'svg';
  } catch {
    throw new Error('Clipboard image copy is not available.');
  }
}
