import { renderBarChart, renderParetoChart, renderDonutChart } from './chart.js';
import { toast, openModal } from './ui.js';

const rootStyle = getComputedStyle(document.documentElement);
const valueOf = (name) => rootStyle.getPropertyValue(name).trim();

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function tokenRow(name, sample) {
  const row = el('div', 'token-row');
  const label = el('code', 'token-name');
  label.textContent = name;
  const value = el('span', 'swatch-value');
  value.textContent = valueOf(name) || '—';
  row.append(label, value);
  if (sample) row.append(sample);
  return row;
}

function fill(container, rows) {
  if (container) container.replaceChildren(...rows);
}

async function tokenNames() {
  // Read the token file itself so a newly added variable always shows up here.
  const css = await fetch('./assets/css/tokens.css').then((response) => response.text());
  return [...new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]))];
}

function renderColors(names) {
  fill(
    document.getElementById('sg-colors'),
    names.map((name) => {
      const item = el('div', 'swatch');
      const chip = el('span', 'swatch-chip');
      chip.style.setProperty('--swatch-color', `var(${name})`);
      const body = el('span', 'swatch-body');
      const label = el('code', 'swatch-name');
      label.textContent = name;
      const value = el('span', 'swatch-value');
      value.textContent = valueOf(name) || '—';
      body.append(label, value);
      item.append(chip, body);
      return item;
    })
  );
}

function sampleFor(name) {
  if (name.startsWith('--space-')) {
    const sample = el('span', 'token-sample');
    sample.style.setProperty('--sample-width', `var(${name})`);
    return sample;
  }
  if (name.startsWith('--radius-')) {
    const sample = el('span', 'radius-sample');
    sample.style.setProperty('--sample-radius', `var(${name})`);
    return sample;
  }
  if (name.startsWith('--shadow-')) {
    const sample = el('span', 'shadow-sample');
    sample.style.setProperty('--sample-shadow', `var(${name})`);
    return sample;
  }
  if (name.startsWith('--font-size-')) {
    const sample = el('span', 'type-sample');
    sample.textContent = 'Aa 123';
    sample.style.setProperty('--sample-size', `var(${name})`);
    return sample;
  }
  if (name.startsWith('--font-weight-')) {
    const sample = el('span', 'type-sample');
    sample.textContent = 'Medium text';
    sample.style.setProperty('--sample-weight', `var(${name})`);
    return sample;
  }
  if (name === '--font-sans' || name === '--font-mono') {
    const sample = el('span', 'type-sample');
    sample.textContent = 'The quick brown fox';
    sample.style.setProperty('--sample-font', `var(${name})`);
    return sample;
  }
  if (name.startsWith('--line-height')) {
    const sample = el('span', 'type-sample');
    sample.textContent = 'Two lines of sample text to show the line height.';
    sample.style.setProperty('--sample-line-height', `var(${name})`);
    return sample;
  }
  return null;
}

function renderTokenList(id, names) {
  fill(
    document.getElementById(id),
    names.map((name) => tokenRow(name, sampleFor(name)))
  );
}

function setupTabs() {
  const tablist = document.querySelector('[data-tabs]');
  if (!tablist) return;
  const tabs = [...tablist.querySelectorAll('.tab')];
  const panels = [...document.querySelectorAll('[data-tab-panel]')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== tab.dataset.tab;
      });
    });
  });
}

function setupDemos() {
  document.querySelector('[data-demo="toast"]')?.addEventListener('click', () => {
    toast('Saved on this device. Nothing was uploaded.', { tone: 'success' });
  });
  document.querySelector('[data-demo="print"]')?.addEventListener('click', () => window.print());

  document.querySelector('[data-demo="dialog"]')?.addEventListener('click', () => {
    openModal({
      title: 'Example dialog',
      message: 'Dialogs are created by assets/js/ui.js. Pages never build their own.',
      confirmLabel: 'Got it',
      onConfirm: () => toast('Dialog confirmed.', { tone: 'success' }),
    });
  });

  document.querySelector('[data-demo="danger"]')?.addEventListener('click', () => {
    openModal({
      title: 'Destructive action',
      message: 'This is a style demo, so nothing is deleted. Real destructive actions use the same dialog.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: () => toast('Nothing was deleted.', { tone: 'danger' }),
    });
  });
}

function drawChart() {
  const box = document.getElementById('sg-chart');
  if (box) {
    renderBarChart(box, {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      values: [12, 18, 9, 22, 15],
      title: 'Sample weekly task completions',
    });
  }
  const pareto = document.getElementById('sg-pareto');
  if (pareto) {
    renderParetoChart(pareto, {
      labels: ['Display', 'Battery', 'BFT', 'Supplier'],
      values: [18, 11, 8, 6],
      title: 'Sample issue Pareto with cumulative share',
    });
  }
  const donut = document.getElementById('sg-donut');
  if (donut) {
    renderDonutChart(donut, {
      labels: ['To do', 'In progress', 'Waiting', 'Done'],
      values: [7, 5, 3, 4],
      title: 'Sample work items by status',
    });
  }
}

export async function initStyleguide() {
  const names = await tokenNames();
  const pick = (...prefixes) => names.filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));

  renderColors(pick('--color-'));
  renderTokenList('sg-type', [...pick('--font-'), ...pick('--line-height')]);
  renderTokenList('sg-space', pick('--space-'));
  renderTokenList('sg-radius', pick('--radius-'));
  renderTokenList('sg-shadow', pick('--shadow-'));
  renderTokenList('sg-breakpoints', pick('--bp-'));
  renderTokenList('sg-layout', names.filter((name) => ['--tap-size', '--sidebar-width', '--topbar-height', '--content-max', '--timeline-track-min', '--border-width', '--size-', '--control-', '--btn-', '--range-', '--textarea-'].some((prefix) => name.startsWith(prefix))));
  renderTokenList('sg-motion', names.filter((name) => name === '--ease' || name === '--duration'));

  setupTabs();
  setupDemos();
  drawChart();
}

initStyleguide();
