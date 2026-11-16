import { SETTINGS_LINKS } from './routes.js';
import { icon } from './icons.js';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

function greeting() {
  const hour = new Date().getHours();
  const word = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${word}, Amara`;
}

function pageHead(route) {
  return `
    <header class="page-head">
      ${route.group ? `<p class="eyebrow">${route.group}</p>` : ''}
      <h1>${route.title}</h1>
      <p class="lede">${route.description}</p>
    </header>`;
}

function home() {
  return `
    <header class="page-head">
      <p class="eyebrow">Home</p>
      <h1>${greeting()}</h1>
      <p class="lede">
        Today at a glance. The layout matches the Home screen in the feature inventory; records
        arrive with the local data layer.
      </p>
    </header>

    <div class="home-grid">
      <div class="home-column">
        <section class="card">
          <div class="card-head"><h2>This month</h2></div>
          <div class="card-body">
            <p>Mini calendar with marked days arrives with the calendar screen.</p>
            <div><a class="btn btn-ghost" href="#/calendar">Open calendar</a></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Today and coming up · next 6</h2></div>
          <div class="card-body">
            <p>Nothing due.</p>
            <p class="text-xs text-muted">
              Merges events, task due dates, project due dates and open-bug due dates, plus up
              to two overdue entries.
            </p>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Team load</h2></div>
          <div class="card-body">
            <p>No workload yet.</p>
          </div>
        </section>
      </div>

      <div class="home-column">
        <section class="card">
          <div class="card-head"><h2>Rating trend</h2></div>
          <div class="card-body">
            <p>No rating data yet.</p>
            <div><a class="btn btn-ghost" href="#/rating-trend">Open rating trend</a></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Pareto</h2></div>
          <div class="card-body">
            <p>No issue data yet.</p>
            <div><a class="btn btn-ghost" href="#/projects">Open projects</a></div>
          </div>
        </section>
      </div>
    </div>

    <aside class="note">
      ${icon('info', 18)}
      <p>
        No records are shown because storage is not connected yet. My Platform never displays
        sample data that could be mistaken for real records.
      </p>
    </aside>`;
}

function mywork(route) {
  const queues = ['Needs your decision', 'Blocked', 'Ready for review'];
  return `
    ${pageHead(route)}
    <div class="card-grid">
      ${queues
        .map(
          (title) => `
            <section class="card">
              <div class="card-head">
                <h2>${title}</h2>
                <span class="badge badge-on-accent">0</span>
              </div>
              <div class="card-body">
                <p>Nothing here.</p>
              </div>
            </section>`
        )
        .join('')}
    </div>
    <aside class="note">
      ${icon('info', 18)}
      <p>
        These queues are computed from work items. They stay empty until the local data layer
        and the task rules exist.
      </p>
    </aside>`;
}

function settingsTabs(route) {
  const tabs = [{ id: 'settings', path: '/settings', label: 'Settings' }, ...SETTINGS_LINKS];
  return `
    <nav class="tabs" aria-label="Settings sections">
      ${tabs
        .map(
          (tab) => `
            <a class="tab" href="#${tab.path}"${tab.id === route.id ? ' aria-current="page"' : ''}>
              ${tab.label}
            </a>`
        )
        .join('')}
    </nav>`;
}

function planned(route) {
  return `
    ${pageHead(route)}
    ${route.group === 'Settings' ? settingsTabs(route) : ''}
    <section class="card">
      <div class="card-head">
        <h2>Screen contract</h2>
        <span class="badge badge-on-accent">Not built yet</span>
      </div>
      <div class="card-body">
        <p>
          The route and navigation entry match the feature inventory. Behaviour and data arrive
          in a later phase; this page does not invent a different layout.
        </p>
        <ul class="list list-check">
          ${route.contract.map((item) => `<li>${icon('check', 16)}<span>${item}</span></li>`).join('')}
        </ul>
      </div>
    </section>
    <aside class="note">
      ${icon('info', 18)}
      <p>
        API endpoints from the old server app become operations on the local IndexedDB data
        layer, with the same page behaviour and data fields.
      </p>
    </aside>`;
}

function notFound(path) {
  return `
    <header class="page-head">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p class="lede">
        There is no screen at <code>${escapeHtml(path)}</code>. It may be planned for a later
        phase, or the link may be wrong.
      </p>
    </header>
    <p><a class="btn btn-primary" href="#/">${icon('arrow', 16)}Back to Home</a></p>`;
}

export function renderView(route, path) {
  switch (route.id) {
    case 'home':
      return home();
    case 'mywork':
      return mywork(route);
    case 'not-found':
      return notFound(path);
    default:
      return planned(route);
  }
}
