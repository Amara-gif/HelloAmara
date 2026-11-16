// Sidebar order comes from docs/FEATURE-INVENTORY.md §1.
export const NAV_GROUPS = [
  { label: '', routes: ['home', 'mywork', 'pages'] },
  { label: 'Projects', routes: ['projects'] },
  { label: 'Work', routes: ['tasks', 'calendar'] },
  { label: 'System', routes: ['bugs', 'chat', 'files', 'settings'] },
];

export const ROUTES = {
  home: { path: '/', label: 'Home', title: 'Home', group: '', icon: 'home', nav: 'home' },
  mywork: { path: '/mywork', label: 'My work', title: 'My work', group: '', icon: 'inbox', nav: 'mywork' },
  pages: { path: '/pages', label: 'Pages', title: 'Pages', group: '', icon: 'page', nav: 'pages' },
  projects: { path: '/projects', label: 'Projects', title: 'Projects', group: 'Projects', icon: 'folder', nav: 'projects' },
  tasks: { path: '/tasks', label: 'All work items', title: 'All work items', group: 'Work', icon: 'tasks', nav: 'tasks' },
  calendar: { path: '/calendar', label: 'Calendar', title: 'Calendar', group: 'Work', icon: 'calendar', nav: 'calendar' },
  bugs: { path: '/bugs', label: 'Bugs', title: 'Bugs', group: 'System', icon: 'bug', nav: 'bugs' },
  chat: { path: '/chat', label: 'Team', title: 'Team', group: 'System', icon: 'users', nav: 'chat' },
  files: { path: '/files', label: 'Tools & Files', title: 'Tools & Files', group: 'System', icon: 'tools', nav: 'files' },
  settings: { path: '/settings', label: 'Settings', title: 'Settings', group: 'System', icon: 'settings', nav: 'settings' },
  'settings-ai': { path: '/settings/ai', label: 'AI inputs & limits', title: 'AI inputs & limits', group: 'Settings', icon: 'spark', nav: 'settings' },
  'settings-language': { path: '/settings/language', label: 'Language rules', title: 'Language rules', group: 'Settings', icon: 'globe', nav: 'settings' },
  'settings-snapshots': { path: '/settings/snapshots', label: 'Snapshots', title: 'Snapshots', group: 'Settings', icon: 'camera', nav: 'settings' },
  'settings-dispatch': { path: '/settings/dispatch', label: 'Dispatch rules', title: 'Dispatch rules', group: 'Settings', icon: 'route', nav: 'settings' },
  'settings-areas': { path: '/settings/areas', label: 'Responsibility areas', title: 'Responsibility areas', group: 'Settings', icon: 'layers', nav: 'settings' },
  'settings-appearance': { path: '/settings/appearance', label: 'Appearance & theme', title: 'Appearance & theme', group: 'Settings', icon: 'palette', nav: 'settings' },
  'bug-new': { path: '/bugs/new', label: 'Report a bug', title: 'Report a bug', group: 'Bugs', icon: 'bug', nav: 'bugs' },
  'rating-trend': { path: '/rating-trend', label: 'Rating trend', title: 'Rating trend', group: 'Home', icon: 'chart', nav: 'home' },
  'page-new': { path: '/pages/new', label: 'New page', title: 'New page', group: 'Pages', icon: 'page', nav: 'pages' },
  'task-detail': { pattern: '/task/:id', title: 'Work item', group: 'Work', icon: 'tasks', nav: 'tasks' },
  'bug-detail': { pattern: '/bug/:id', title: 'Bug', group: 'Bugs', icon: 'bug', nav: 'bugs' },
  'project-detail': { pattern: '/project/:key', title: 'Project', group: 'Projects', icon: 'folder', nav: 'projects' },
  'page-edit': { pattern: '/page/:id/edit', title: 'Page editor', group: 'Pages', icon: 'page', nav: 'pages' },
  'page-view': { pattern: '/page/:id', title: 'Page', group: 'Pages', icon: 'page', nav: 'pages' },
  go: { pattern: '/go/:key', title: 'Redirect', group: '', icon: 'arrow', nav: '' },
};

export const SETTINGS_LINKS = [
  'settings-ai', 'settings-language', 'settings-snapshots', 'settings-dispatch', 'settings-areas', 'settings-appearance',
].map((id) => ({ id, ...ROUTES[id] }));

export const ROUTE_LIST = Object.entries(ROUTES).map(([id, route]) => ({ id, ...route }));

export function groupRoutes() {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    routes: group.routes.map((id) => ({ id, ...ROUTES[id] })),
  }));
}

export function readLocation() {
  const raw = window.location.hash.replace(/^#/, '');
  const [rawPath, rawQuery = ''] = raw.split('?');
  let path = (rawPath || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return { path: path || '/', query: new URLSearchParams(rawQuery) };
}

function matchPattern(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(':')) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    else if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

function notFoundRoute(path, params) {
  return { id: 'not-found', path, label: 'Not found', title: 'Page not found', group: '', icon: 'info', nav: '', ...(params ? { params } : {}) };
}

// Readable keys are case-insensitive for the T-/WD- prefix (inventory §7).
export function findReadableKeyTarget(state, rawKey) {
  const match = /^(T|WD)-(\d+)$/i.exec(String(rawKey ?? '').trim());
  if (!match || !state) return null;
  const prefix = match[1].toUpperCase();
  const key = `${prefix}-${match[2]}`;
  const rows = prefix === 'T' ? state.tasks : state.bugs;
  const row = (rows ?? []).find((item) => String(item.key ?? '').toUpperCase() === key);
  if (!row) return null;
  return {
    routeId: prefix === 'T' ? 'task-detail' : 'bug-detail',
    path: `/${prefix === 'T' ? 'task' : 'bug'}/${encodeURIComponent(row.id)}`,
    params: { id: row.id },
  };
}

function goRoute(path, key, state) {
  const target = findReadableKeyTarget(state, key);
  if (!target) return notFoundRoute(path, { key });
  return { ...ROUTES[target.routeId], id: target.routeId, ...target, path: target.path, redirectFrom: path };
}

export function routeForPath(path, state) {
  const exact = ROUTE_LIST.find((route) => route.path === path);
  if (exact) return exact;
  // Legacy /note/:id links are aliases of the Pages view.
  const noteParams = matchPattern('/note/:id', path);
  if (noteParams) {
    return {
      ...ROUTES['page-view'],
      id: 'page-view',
      params: noteParams,
      path: `/page/${encodeURIComponent(noteParams.id)}`,
      redirectFrom: path,
    };
  }
  const goParams = matchPattern(ROUTES.go.pattern, path);
  if (goParams) return goRoute(path, goParams.key, state);
  const dynamic = ROUTE_LIST.filter((route) => route.pattern && route.id !== 'go').sort((a, b) => b.pattern.length - a.pattern.length);
  for (const route of dynamic) {
    const params = matchPattern(route.pattern, path);
    if (params) return { ...route, params, path };
  }
  return notFoundRoute(path);
}
