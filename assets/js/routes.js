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

export function routeForPath(path) {
  const exact = ROUTE_LIST.find((route) => route.path === path);
  if (exact) return exact;
  const dynamic = ROUTE_LIST.filter((route) => route.pattern).sort((a, b) => b.pattern.length - a.pattern.length);
  for (const route of dynamic) {
    const params = matchPattern(route.pattern, path);
    if (params) return { ...route, params, path };
  }
  return { id: 'not-found', path, label: 'Not found', title: 'Page not found', group: '', icon: 'info', nav: '' };
}
