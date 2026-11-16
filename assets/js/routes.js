// Route table and sidebar order. Sidebar groups and page order come from
// docs/FEATURE-INVENTORY.md §1; do not reorder or rename without updating the inventory.
export const NAV_GROUPS = [
  { label: '', routes: ['home', 'mywork', 'pages'] },
  { label: 'Projects', routes: ['projects'] },
  { label: 'Work', routes: ['tasks', 'calendar'] },
  { label: 'System', routes: ['bugs', 'chat', 'files', 'settings'] },
];

export const ROUTES = {
  home: {
    path: '/',
    label: 'Home',
    title: 'Home',
    group: '',
    icon: 'home',
    description: 'Your day at a glance: month calendar, agenda, team load, rating trend and Pareto.',
    contract: [
      'Current-month mini calendar with marked days; a day opens the calendar for that month.',
      'Today and coming up: up to six entries plus two overdue, from events, tasks, projects and bugs.',
      'Team-load card from the local agent data.',
      'Rating-trend and Pareto cards linking to their full pages.',
    ],
  },
  mywork: {
    path: '/mywork',
    label: 'My work',
    title: 'My work',
    group: '',
    icon: 'inbox',
    description: 'Decision, blocked and review queues computed from work items.',
    contract: [
      'Needs your decision, Blocked and Ready for review queues with counts.',
      'Each row shows the task link, reason, next step, owner and due date.',
      'Eight rows per queue by default; Show all expands it.',
      'A project filter scopes all three queues.',
    ],
  },
  pages: {
    path: '/pages',
    label: 'Pages',
    title: 'Pages',
    group: '',
    icon: 'page',
    description: 'Notes with markdown, revisions, print and export.',
    contract: [
      'Search by title, body and tags; filter by project.',
      'Create a page, select several and delete after confirmation.',
      'Rendered view with author, date, project links, tags and a page rail.',
      'Version history, print view and PDF/image export.',
      'Editor with live preview, AI polish and revision history; blank titles are rejected.',
    ],
  },
  projects: {
    path: '/projects',
    label: 'Projects',
    title: 'Projects',
    group: 'Projects',
    icon: 'folder',
    description: 'Project list, archive, ordering and the daily record.',
    contract: [
      'All / project / Archived chips filter the table.',
      'Table: acronym, project, status, start, due, open work items, pages.',
      'Inline add, edit/save, archive, restore and delete with confirmation.',
      'Drag rows to reorder projects persistently.',
      'What got done, day by day: last 14 dates, filterable by project.',
    ],
  },
  tasks: {
    path: '/tasks',
    label: 'All work items',
    title: 'All work items',
    group: 'Work',
    icon: 'tasks',
    description: 'Every work item with list, board, calendar and timeline views.',
    contract: [
      'Open by default; All shows everything; explicit status filters override the default.',
      'Filters: status, priority, owner, severity, component, module, project and text search.',
      'List columns: key, summary, project, progress, status, assignee, due, priority, severity, component, age, actions.',
      'Board, calendar and timeline views with the same filters.',
      'Send to QA, Brief, board-health checks and restore for lost QA marks.',
    ],
  },
  calendar: {
    path: '/calendar',
    label: 'Calendar',
    title: 'Calendar',
    group: 'Work',
    icon: 'calendar',
    description: 'Tasks, bugs, project dues and events in one calendar.',
    contract: [
      'Monday-first month grid with up to three items per day and +n overflow.',
      'Previous / This month / Next navigation; project selector keeps the month.',
      'Items include task deadlines, open bug deadlines, project dues and repeating events.',
      'Next seven days agenda with Join and Delete for real events.',
      'Enable reminders for browser notifications.',
    ],
  },
  bugs: {
    path: '/bugs',
    label: 'Bugs',
    title: 'Bugs',
    group: 'System',
    icon: 'bug',
    description: 'Bug tracking with the eleven-status workflow.',
    contract: [
      'Counters for open/total, waiting for QA and past due.',
      'Filters: text, status, severity, priority, component, assignee; several sort orders.',
      'Table columns: key, summary, status, assignee, due, priority, severity, component, age.',
      'Multi-select delete from the list; detail pages state that bugs are never deleted.',
      'Report a bug at /bugs/new with title, severity and steps to reproduce.',
    ],
  },
  chat: {
    path: '/chat',
    label: 'Team',
    title: 'Team',
    group: 'System',
    icon: 'users',
    description: 'Agent cards, workload and orders.',
    contract: [
      'Summary tiles: decisions pending, reviews ready, people working, open items, today’s actions.',
      'One card per agent with status, focus, workload and latest activity.',
      'Send an order, close it from the to-do list, reopen it from the data layer.',
      'Agent panel shows owned work items, role description and base model.',
      'Copy brief and open the local queue file.',
    ],
  },
  files: {
    path: '/files',
    label: 'Tools & Files',
    title: 'Tools & Files',
    group: 'System',
    icon: 'tools',
    description: 'Chart Studio and Agent Configuration.',
    contract: [
      'Two tabs: Chart Studio and Agent Configuration, switchable by tab state.',
      'Choose a report workbook and sheet, then generate an interactive chart page.',
      'Generated charts offer filters, axes, chart types, pivots and six palettes.',
      'Agent Configuration manages the agent definition files.',
    ],
  },
  settings: {
    path: '/settings',
    label: 'Settings',
    title: 'Settings',
    group: 'Settings',
    icon: 'settings',
    description: 'AI connection, models, timeouts and the shared save bar.',
    contract: [
      'Shows connection status with a masked key, model and timeout.',
      'Test the key, fill missing English fields, reset polish instructions.',
      'Save connection settings, then polish instructions and never-send terms.',
      'Every settings screen shares the same section tabs and dirty-state text.',
    ],
  },
  'settings-ai': {
    path: '/settings/ai',
    label: 'AI inputs & limits',
    title: 'AI inputs & limits',
    group: 'Settings',
    icon: 'spark',
    description: 'Limits and toggles for every AI surface.',
    contract: [
      'Sections for Summary, Progress, Comment, Issue classification and Issue Benchmark.',
      'Shows the input-surface table and configuration sources.',
      'Save changes or restore the defaults.',
    ],
  },
  'settings-language': {
    path: '/settings/language',
    label: 'Language rules',
    title: 'Language rules',
    group: 'Settings',
    icon: 'globe',
    description: 'Primary/secondary language and the natural-language rule.',
    contract: [
      'Choose primary and secondary language; both are always kept.',
      'Edit the natural-language rule sent to every AI surface.',
      'Live preview mirrors the rule text.',
      'Changes apply to the next AI call.',
    ],
  },
  'settings-snapshots': {
    path: '/settings/snapshots',
    label: 'Snapshots',
    title: 'Snapshots',
    group: 'Settings',
    icon: 'camera',
    description: 'Saved product and task snapshots.',
    contract: [
      'Choose a product or After Sales task and a date range.',
      'Refresh the list; each row shows date, kind and excerpt.',
      'Open a snapshot or delete it after confirmation.',
      'Nothing is ever deleted automatically.',
    ],
  },
  'settings-dispatch': {
    path: '/settings/dispatch',
    label: 'Dispatch rules',
    title: 'Dispatch rules',
    group: 'Settings',
    icon: 'route',
    description: 'Default owner and first-match dispatch rules.',
    contract: [
      'Default owner select used as the fallback.',
      'Rules match keyword, product, issue, severity and area, and assign an owner.',
      'First matching rule wins; blank conditions are ignored.',
      'Add and remove rules, then save.',
    ],
  },
  'settings-areas': {
    path: '/settings/areas',
    label: 'Responsibility areas',
    title: 'Responsibility areas',
    group: 'Settings',
    icon: 'layers',
    description: 'Extra responsibility areas and the unknown-owner fallback.',
    contract: [
      'Add and remove responsibility-area names.',
      'Set the unknown-owner fallback; the default is NA.',
      'After Sales responsible teams stay on their customization page.',
      'Save changes.',
    ],
  },
  'settings-appearance': {
    path: '/settings/appearance',
    label: 'Appearance & theme',
    title: 'Appearance & theme',
    group: 'Settings',
    icon: 'palette',
    description: 'Primary colour, radii, glass and PWA install.',
    contract: [
      'Primary colour with six palette presets.',
      'Button radius, card radius, glass opacity and enable-glass controls.',
      'Live preview strip with buttons and a selected chip.',
      'Install as an app when the browser allows it.',
      'Save theme or restore the default look.',
    ],
  },
  'bug-new': {
    path: '/bugs/new',
    label: 'Report a bug',
    title: 'Report a bug',
    group: 'System',
    icon: 'bug',
    description: 'Opens the bug form with optional prefills.',
    contract: [
      'Title, severity (default S3) and steps to reproduce are required.',
      'Query prefills: t, d, component, severity.',
      'The global Create dialog opens on the Bug tab.',
      'A new bug gets a WD-n key and an SLA due date from its severity.',
    ],
  },
  'rating-trend': {
    path: '/rating-trend',
    label: 'Rating trend',
    title: 'Rating trend',
    group: 'Home',
    icon: 'chart',
    description: 'Full-page product rating trend chart.',
    contract: [
      'Chart loads with product and day-window parameters.',
      'Choose products or Everything, then save the selection.',
      'Toggle a smooth curve or straight line and persist it.',
      'Copy the chart image.',
    ],
  },
};

export const SETTINGS_LINKS = [
  'settings-ai',
  'settings-language',
  'settings-snapshots',
  'settings-dispatch',
  'settings-areas',
  'settings-appearance',
].map((id) => ({ id, ...ROUTES[id] }));

export const ROUTE_LIST = Object.entries(ROUTES).map(([id, route]) => ({ id, ...route }));

export function groupRoutes() {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    routes: group.routes.map((id) => ({ id, ...ROUTES[id] })),
  }));
}

// Accepts "#/tasks", "/tasks/", "#/tasks?filter=open" and bare hashes.
export function readPath() {
  const raw = window.location.hash.replace(/^#/, '');
  let path = (raw.split('?')[0] || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

export function routeForPath(path) {
  const match = ROUTE_LIST.find((route) => route.path === path);
  if (match) return match;
  return {
    id: 'not-found',
    path,
    label: 'Not found',
    title: 'Page not found',
    group: '',
    icon: 'info',
    description: 'That screen does not exist.',
  };
}
