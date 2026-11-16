// The only chart renderer. Pages pass data here and never draw SVG themselves.
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

export function renderBarChart(container, { labels = [], values = [], title = 'Bar chart' } = {}) {
  if (!container) throw new Error('renderBarChart: a container element is required');

  const data = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...data, 1);
  const width = 400;
  const height = 180;
  const padding = { top: 20, right: 8, bottom: 30, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(48, slot * 0.56);

  const svg = svgEl('svg', {
    class: 'chart-svg',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
  });
  svg.append(Object.assign(svgEl('title'), { textContent: title }));

  const baseline = svgEl('line', {
    class: 'chart-grid',
    x1: padding.left,
    y1: padding.top + plotHeight,
    x2: width - padding.right,
    y2: padding.top + plotHeight,
  });
  svg.append(baseline);

  data.forEach((value, index) => {
    const barHeight = (value / max) * plotHeight;
    const x = padding.left + slot * index + (slot - barWidth) / 2;
    const y = padding.top + plotHeight - barHeight;

    svg.append(
      svgEl('rect', {
        class: index % 2 === 0 ? 'chart-bar' : 'chart-bar-alt',
        x,
        y,
        width: barWidth,
        height: barHeight,
        rx: 4,
      })
    );

    const valueLabel = svgEl('text', {
      class: 'chart-value',
      x: x + barWidth / 2,
      y: Math.max(y - 6, 12),
      'text-anchor': 'middle',
    });
    valueLabel.textContent = String(value);
    svg.append(valueLabel);

    const axisLabel = svgEl('text', {
      class: 'chart-label',
      x: x + barWidth / 2,
      y: height - 8,
      'text-anchor': 'middle',
    });
    axisLabel.textContent = labels[index] ?? '';
    svg.append(axisLabel);
  });

  container.replaceChildren(svg);
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', title);
  return svg;
}
