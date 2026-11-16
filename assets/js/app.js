import { groupRoutes, readPath, routeForPath, SETTINGS_LINKS } from './routes.js';
import { renderView } from './views.js';
import { icon } from './icons.js';

const nav = document.getElementById('nav');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');
const menuToggle = document.getElementById('menu-toggle');
const menuLabel = menuToggle.querySelector('.sr-only');
const main = document.getElementById('view');
const crumbs = document.getElementById('crumbs');
const skipLink = document.querySelector('.skip-link');
const todayEl = document.getElementById('today-date');
const desktopQuery = window.matchMedia('(min-width: 900px)');
let lastFocused = null;
let firstRender = true;

function settingsSublist() {
  return `
    <li>
      <ul class="nav-sublist" data-settings-nav hidden>
        ${SETTINGS_LINKS.map(
          (route) => `<li><a class="nav-sublink" href="#${route.path}" data-route="${route.id}">${route.label}</a></li>`
        ).join('')}
      </ul>
    </li>`;
}

function buildNav() {
  nav.innerHTML = groupRoutes()
    .map(
      (group) => `
        <div class="nav-group">
          ${group.label ? `<p class="nav-label">${group.label}</p>` : ''}
          <ul class="nav-list">
            ${group.routes
              .map(
                (route) => `
                  <li>
                    <a class="nav-link" href="#${route.path}" data-route="${route.id}">
                      ${icon(route.icon)}
                      <span>${route.label}</span>
                      ${
                        route.id === 'tasks'
                          ? '<span class="badge badge-accent nav-count" data-task-count hidden>0</span>'
                          : ''
                      }
                    </a>
                  </li>
                  ${route.id === 'settings' ? settingsSublist() : ''}`
              )
              .join('')}
          </ul>
        </div>`
    )
    .join('');
}

function isDrawerMode() {
  return !desktopQuery.matches;
}

function setDrawer(open) {
  const shouldOpen = open && isDrawerMode();
  if (!shouldOpen && lastFocused) {
    lastFocused.focus();
    lastFocused = null;
  }
  document.body.classList.toggle('nav-open', shouldOpen);
  menuToggle.setAttribute('aria-expanded', String(shouldOpen));
  menuToggle.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
  menuLabel.textContent = shouldOpen ? 'Close navigation' : 'Open navigation';
  // Off-canvas links must not be reachable by keyboard while the drawer is closed.
  sidebar.toggleAttribute('inert', isDrawerMode() && !shouldOpen);
  if (shouldOpen) {
    lastFocused = document.activeElement;
    nav.querySelector('a')?.focus();
  }
}

function syncSidebarMode() {
  if (desktopQuery.matches) {
    document.body.classList.remove('nav-open');
    sidebar.removeAttribute('inert');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    menuLabel.textContent = 'Open navigation';
  } else if (!document.body.classList.contains('nav-open')) {
    sidebar.setAttribute('inert', '');
  }
}

function trapTab(event) {
  const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderCrumbs(route) {
  const group = route.group && route.group !== route.title
    ? `<span>${route.group}</span><span class="crumbs-sep" aria-hidden="true">/</span>`
    : '';
  crumbs.innerHTML = `${group}<span class="crumbs-current">${route.title}</span>`;
}

function updateNavigation(route) {
  const settingsActive = route.id === 'settings' || route.id.startsWith('settings-');
  const settingsLink = nav.querySelector('[data-route="settings"]');
  settingsLink?.classList.toggle('is-section', settingsActive && route.id !== 'settings');

  const settingsNav = nav.querySelector('[data-settings-nav]');
  if (settingsNav) settingsNav.hidden = !settingsActive;

  nav.querySelectorAll('[data-route]').forEach((link) => {
    if (link.dataset.route === route.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // P1 replaces this with the IndexedDB count of In progress tasks.
  const taskCount = 0;
  const countBadge = nav.querySelector('[data-task-count]');
  if (countBadge) {
    countBadge.textContent = String(taskCount);
    countBadge.hidden = taskCount === 0;
  }
}

function render() {
  const path = readPath();
  const route = routeForPath(path);

  main.innerHTML = renderView(route, path);
  document.title = `${route.title} · My Platform`;
  renderCrumbs(route);
  updateNavigation(route);
  setDrawer(false);

  if (!firstRender) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  firstRender = false;
}

menuToggle.addEventListener('click', () => {
  setDrawer(!document.body.classList.contains('nav-open'));
});

backdrop.addEventListener('click', () => setDrawer(false));

nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setDrawer(false);
});

skipLink.addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: 'start' });
});

document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setDrawer(false);
  } else if (event.key === 'Tab') {
    trapTab(event);
  }
});

// Inventory §7 Shell: the context menu is disabled on every page.
document.addEventListener('contextmenu', (event) => event.preventDefault());

desktopQuery.addEventListener('change', syncSidebarMode);
window.addEventListener('hashchange', render);

if (todayEl) {
  todayEl.textContent = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

buildNav();
syncSidebarMode();
render();
