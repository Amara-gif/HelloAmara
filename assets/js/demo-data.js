// Demo rows for the Test account. Dates are relative to the day the demo is seeded.
export const DEMO_VERSION = '2026-11-16.2';

const pad = (n) => String(n).padStart(2, '0');
const dayIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const offsetDate = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dayIso(date);
};
const at = (days, time = '09:00') => `${offsetDate(days)}T${time}:00`;
const stamp = (days, hour = 9) => new Date(`${offsetDate(days)}T${pad(hour)}:00:00`).toISOString();
const monthDate = (day) => {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return dayIso(new Date(now.getFullYear(), now.getMonth(), Math.min(day, last)));
};

const projects = [
  { id: 'p1', key: 'TAG', name: 'Hello Amara', description: 'The parent workspace for Amara’s own planning and build records.', owner: 'Amara', status: 'Active', start: offsetDate(-40), due: offsetDate(40), keywords: 'General stuff, Personal Memo', archived: 0, sort: 1 },
  { id: 'p2', key: 'MR', name: 'Market Review', description: 'Review analysis, issue tracking and the Market Review report deck.', owner: 'Amara', status: 'Active', start: offsetDate(-25), due: offsetDate(25), keywords: 'Review, Amazon, Report', archived: 0, sort: 2 },
  { id: 'p3', key: 'RSL', name: 'Roselite', description: 'After Sales top items and quality follow-up for Roselite.', owner: 'Delphine Roth', status: 'Active', start: offsetDate(-18), due: offsetDate(12), keywords: 'Roselite, After Sales, Screen', archived: 0, sort: 3 },
  { id: 'p4', key: 'MRM', name: 'Miramar', description: 'Build-phase issue tracking and supplier follow-up.', owner: 'Marlowe Quinn', status: 'Active', start: offsetDate(-14), due: offsetDate(20), keywords: 'Miramar, DVT, Supplier', archived: 0, sort: 4 },
  { id: 'p5', key: 'WD2', name: 'Work Desk 2', description: 'Design and data work for the rebuilt local-first workspace.', owner: 'Cordell Nash', status: 'Archived', start: offsetDate(-90), due: offsetDate(-10), keywords: 'Rebuild, Dashboard, Charts', archived: 1, sort: 5 },
].map((p, i) => ({ ...p, createdAt: stamp(-60 + i), updatedAt: stamp(-i), deletedAt: null }));

const task = (id, n, title, projectId, status, workflow, priority, owner, due, extra = {}) => ({
  id,
  key: `T-${n}`,
  title,
  projectId,
  status,
  workflow,
  priority,
  owner,
  due,
  start: extra.start ?? offsetDate(-5),
  module: extra.module ?? 'General',
  component: extra.component ?? 'work desk',
  severity: extra.severity ?? 'S3 Major',
  type: extra.type ?? 'Task',
  description: extra.description ?? '',
  expected: extra.expected ?? '',
  actual: extra.actual ?? '',
  attachments: extra.attachments ?? [],
  notes: extra.notes ?? '',
  parentId: extra.parentId ?? null,
  reviewed: extra.reviewed ?? false,
  pendingDecision: extra.pendingDecision ?? false,
  createdAt: stamp(extra.created ?? -14),
  updatedAt: stamp(extra.updated ?? -1),
  deletedAt: null,
});

const tasks = [
  task('t1', 1, 'Feels slow in general scenario', 'p3', 'To do', 'New', 'Medium', 'Amara', offsetDate(2), {
    created: -12, attachments: [{ name: 'scroll-recording.mp4', kind: 'video' }],
    description: 'The screen feels slow when scrolling in the general scenario. QA confirmed it on two units.',
    notes: 'HQ SWQA confirmed this on the latest build.',
  }),
  task('t2', 2, 'Fingerprint smudges on screen', 'p3', 'In progress', 'In progress', 'High', 'Worker A', offsetDate(0), {
    start: offsetDate(-5), created: -10, notes: 'Waiting for supplier response.',
    description: 'Visible fingerprint residue after normal use.',
  }),
  task('t3', 3, 'Screen showing low resolution', 'p3', 'Waiting', 'Fixed', 'Medium', 'Delphine Roth', offsetDate(-1), {
    created: -9, attachments: [{ name: 'low-resolution.png', kind: 'image' }],
    description: 'The panel reports a lower resolution after resume.',
    notes: '[待核 2026-11-15]',
  }),
  task('t4', 4, 'Dashboard update', 'p5', 'Done', 'Closed', 'Highest', 'Delphine Roth', offsetDate(-5), {
    created: -30, reviewed: true, module: 'Dashboard', notes: '[已核 2026-11-10]',
  }),
  task('t5', 5, 'Save version action next to Summary', 'p5', 'In progress', 'In progress', 'High', 'Worker B', offsetDate(4), {
    created: -8, parentId: 't4', module: 'Pages',
  }),
  task('t6', 6, 'Rating trend card, last 30 days', 'p5', 'To do', 'New', 'Low', 'Amara', offsetDate(6), {
    created: -6, parentId: 't4', module: 'Dashboard',
  }),
  task('t7', 7, 'Pareto card pinned beside Team load', 'p5', 'Done', 'Verified', 'Medium', 'Delphine Roth', offsetDate(-3), {
    created: -20, module: 'Dashboard', reviewed: false,
  }),
  task('t8', 8, 'Stack charts in the right column', 'p5', 'To do', 'Triaged', 'Low', 'Worker C', offsetDate(8), {
    created: -4, module: 'Dashboard',
  }),
  task('t9', 9, 'Calendar and coming up share a date filter', 'p5', 'Waiting', 'Fixed', 'Low', 'Amara', offsetDate(1), {
    created: -11, module: 'Calendar', notes: '[待核 2026-11-14]',
  }),
  task('t10', 10, 'Jira-1639: supplier blocks the battery line', 'p4', 'To do', 'New', 'High', 'Amara', offsetDate(-2), {
    created: -13, module: 'Battery', attachments: [{ name: 'supplier-thread.pdf', kind: 'file' }],
    description: 'Supplier cannot confirm the battery cell allocation for the DVT build.',
    pendingDecision: true, notes: '[待确认]',
  }),
  task('t11', 11, 'Jira-1639: BFT station block', 'p4', 'In progress', 'In progress', 'Highest', 'Worker A', offsetDate(0), {
    created: -5, module: 'BFT',
  }),
  task('t12', 12, 'No memory card slot on the sample', 'p3', 'Done', 'Closed', 'Lowest', 'Delphine Roth', offsetDate(-7), {
    created: -24, reviewed: true,
  }),
  task('t13', 13, 'Difficult or long setup', 'p3', 'Waiting', 'Fixed', 'Medium', 'Worker B', offsetDate(3), {
    created: -15, notes: '[待核 2026-11-13]',
  }),
  task('t14', 14, 'Cloth-cover ironing yield', 'p4', 'Done', 'Reopened', 'High', 'Amara', offsetDate(1), {
    created: -7, reviewed: false,
  }),
  task('t15', 15, 'Mic FPC scrap cost', 'p4', 'To do', 'New', 'Medium', 'Amara', offsetDate(5), {
    created: -3,
  }),
  task('t16', 16, 'Hello Amara onboarding checklist', 'p1', 'To do', 'Deferred', 'Low', 'Steward', offsetDate(15), {
    created: -2, pendingDecision: true, notes: '[待确认]',
  }),
  task('t17', 17, 'Market review issue dictionary', 'p2', 'In progress', 'In progress', 'Medium', 'Worker C', offsetDate(7), {
    created: -9, module: 'Review', description: 'Align the issue dictionary with the new review export.',
  }),
  task('t18', 18, 'Archived project follow-up', 'p5', 'Done', 'Wont fix', 'Lowest', 'Amara', offsetDate(-12), {
    created: -40, reviewed: true,
  }),
];

const bug = (id, n, title, status, severity, priority, assignee, component, due, extra = {}) => ({
  id, key: `WD-${n}`, title, status, severity, priority, assignee, component, due,
  type: extra.type ?? 'Bug', reporter: extra.reporter ?? 'Amara',
  description: extra.description ?? 'Reported from the weekly quality review.',
  repro: extra.repro ?? 'Open the screen, repeat the action, observe the result.',
  expected: extra.expected ?? 'The screen should follow the documented behaviour.',
  actual: extra.actual ?? 'The screen does not follow the documented behaviour.',
  labels: extra.labels ?? 'ui, review', found_in: 'DVT build', fix_in: '',
  environment: 'Windows 11 · Edge', links: '', linked_task: extra.linked_task ?? '',
  resolution: '', attachments: extra.attachments ?? [],
  createdAt: stamp(extra.created ?? -8), updatedAt: stamp(extra.updated ?? -1), deletedAt: null,
});

const bugs = [
  bug('b1', 1, 'AI settings key test returns a timeout', 'Verified', 'S3 Major', 'Medium', 'Delphine Roth', 'settings', offsetDate(0), { created: -6 }),
  bug('b2', 2, 'Create dialog loses focus after paste', 'New', 'S2 Critical', 'High', 'Amara', 'tasks page', offsetDate(2), { created: -2 }),
  bug('b3', 3, 'Calendar repeats shift one day', 'Triaged', 'S3 Major', 'Medium', 'Worker A', 'calendar', offsetDate(4), { created: -5 }),
  bug('b4', 4, 'Chart tooltip clipped at the right edge', 'In progress', 'S4 Minor', 'Low', 'Worker B', 'chart studio', offsetDate(6), { created: -4 }),
  bug('b5', 5, 'Import creates duplicate rows', 'Fixed', 'S1 Blocker', 'Highest', 'Delphine Roth', 'pipeline', offsetDate(-1), { created: -9 }),
  bug('b6', 6, 'Folded sidebar state is lost on reload', 'Reopened', 'S2 Critical', 'High', 'Amara', 'settings', offsetDate(1), { created: -12 }),
  bug('b7', 7, 'Bugs page open counter is stale', 'Closed', 'S3 Major', 'Medium', 'QA', 'bugs page', offsetDate(-3), { created: -15 }),
  bug('b8', 8, 'Wont-fix reason is not shown in the feed', 'Wont fix', 'S4 Minor', 'Low', 'Steward', 'other', offsetDate(-5), { created: -18 }),
];

const taskHistory = [
  { id: 'th1', taskId: 't1', at: at(-10, '09:12'), who: 'Amara', field: 'created', old: '', new: 'T-1' },
  { id: 'th2', taskId: 't1', at: at(-9, '15:20'), who: 'Steward', field: 'owner', old: 'Dispatcher', new: 'Amara' },
  { id: 'th3', taskId: 't2', at: at(-5, '11:40'), who: 'Worker A', field: 'status', old: 'To do', new: 'In progress' },
  { id: 'th4', taskId: 't3', at: at(-1, '10:05'), who: 'Delphine Roth', field: 'status', old: 'In progress', new: 'Waiting' },
  { id: 'th5', taskId: 't4', at: at(-6, '16:30'), who: 'Delphine Roth', field: 'status', old: 'Waiting', new: 'Done' },
  { id: 'th6', taskId: 't5', at: at(-3, '09:50'), who: 'Worker B', field: 'status', old: 'To do', new: 'In progress' },
  { id: 'th7', taskId: 't10', at: at(-2, '14:12'), who: 'Amara', field: 'note', old: '', new: '[待确认]' },
  { id: 'th8', taskId: 't11', at: at(-4, '08:30'), who: 'Worker A', field: 'status', old: 'To do', new: 'In progress' },
  { id: 'th9', taskId: 't14', at: at(-1, '11:10'), who: 'Amara', field: 'status', old: 'Done', new: 'Reopened' },
  { id: 'th10', taskId: 't17', at: at(-3, '13:45'), who: 'Worker C', field: 'status', old: 'To do', new: 'In progress' },
].map((row) => ({ ...row, updatedAt: row.at, deletedAt: null }));

const taskComments = [
  { id: 'tc1', taskId: 't1', at: at(-9, '10:22'), who: 'Amara', body: 'Tracked with the supplier. QA confirmed it on two units.', real: true },
  { id: 'tc2', taskId: 't1', at: at(-8, '16:05'), who: 'Steward', body: 'Owner set to Amara; next action is a supplier call.', real: false },
  { id: 'tc3', taskId: 't2', at: at(-4, '09:40'), who: 'Worker A', body: 'Reproduced. Waiting on the new coating sample.', real: true },
  { id: 'tc4', taskId: 't3', at: at(-1, '10:15'), who: 'Delphine Roth', body: 'Fix is in the DVT build. Ready for verification.', real: true },
  { id: 'tc5', taskId: 't10', at: at(-2, '14:10'), who: 'Amara', body: 'Supplier allocation is the blocker for the line.', real: false },
  { id: 'tc6', taskId: 't11', at: at(-1, '09:05'), who: 'Worker A', body: 'BFT station re-tested; one block remains.', real: true },
].map((row) => ({ ...row, updatedAt: row.at, deletedAt: null }));

const bugHistory = [
  { id: 'bh1', bugId: 'b1', at: at(-5, '10:00'), who: 'Amara', field: 'status', old: 'New', new: 'Triaged' },
  { id: 'bh2', bugId: 'b1', at: at(-2, '15:30'), who: 'Delphine Roth', field: 'status', old: 'Fixed', new: 'Verified' },
  { id: 'bh3', bugId: 'b2', at: at(-2, '09:20'), who: 'Amara', field: 'status', old: '', new: 'New' },
  { id: 'bh4', bugId: 'b3', at: at(-4, '11:00'), who: 'Steward', field: 'status', old: 'New', new: 'Triaged' },
  { id: 'bh5', bugId: 'b5', at: at(-2, '16:40'), who: 'Delphine Roth', field: 'status', old: 'In progress', new: 'Fixed' },
  { id: 'bh6', bugId: 'b6', at: at(-3, '14:10'), who: 'Amara', field: 'status', old: 'Closed', new: 'Reopened' },
  { id: 'bh7', bugId: 'b7', at: at(-4, '10:25'), who: 'QA', field: 'status', old: 'Verified', new: 'Closed' },
  { id: 'bh8', bugId: 'b8', at: at(-6, '12:00'), who: 'Steward', field: 'status', old: 'Triaged', new: 'Wont fix' },
].map((row) => ({ ...row, updatedAt: row.at, deletedAt: null }));

const bugComments = [
  { id: 'bc1', bugId: 'b1', at: at(-5, '10:05'), author: 'Amara', body: 'Timeout happens after 90 seconds; the key itself is valid.' },
  { id: 'bc2', bugId: 'b1', at: at(-2, '15:35'), author: 'Delphine Roth', body: 'Verified against the new model endpoint.' },
  { id: 'bc3', bugId: 'b2', at: at(-2, '09:30'), author: 'Amara', body: 'Focus moves to the page after pasting an image.' },
  { id: 'bc4', bugId: 'b3', at: at(-4, '11:10'), author: 'Steward', body: 'Weekday repeat is one day early after DST.' },
  { id: 'bc5', bugId: 'b5', at: at(-2, '16:45'), author: 'Delphine Roth', body: 'Fix is in the import merge path; added a regression test.' },
  { id: 'bc6', bugId: 'b6', at: at(-3, '14:15'), author: 'Amara', body: 'Still reproducible after a hard reload.' },
  { id: 'bc7', bugId: 'b7', at: at(-4, '10:30'), author: 'QA', body: 'Counter now refreshes after delete.' },
  { id: 'bc8', bugId: 'b8', at: at(-6, '12:05'), author: 'Steward', body: 'Reason captured in the waiver note.' },
].map((row) => ({ ...row, updatedAt: row.at, deletedAt: null }));

const events = [
  { id: 'e1', date: monthDate(16), time: '10:00', end: '10:45', title: 'Sprint review · Roselite', kind: 'Meeting', note: 'Walk through the open after-sales items.', link: 'https://meet.example.com/roselite-sprint', repeat: 'weekly', until: '', remind: '15', projectId: 'p3', taskId: '' },
  { id: 'e2', date: monthDate(18), time: '14:00', end: '14:30', title: 'Supplier sync · Miramar', kind: 'Meeting', note: 'Battery allocation and BFT station block.', link: 'https://meet.example.com/miramar-supplier', repeat: '', until: '', remind: '30', projectId: 'p4', taskId: '' },
  { id: 'e3', date: monthDate(17), time: '09:00', end: '', title: 'QA handover', kind: 'Reminder', note: 'Hand T-3 and T-9 to QA.', link: '', repeat: 'weekdays', until: '', remind: '5', projectId: 'p3', taskId: 't3' },
  { id: 'e4', date: monthDate(20), time: '18:00', end: '', title: 'Release window opens', kind: 'Deadline', note: 'Cut the DVT build.', link: '', repeat: '', until: '', remind: '60', projectId: 'p4', taskId: '' },
  { id: 'e5', date: monthDate(19), time: '11:00', end: '', title: 'Retest WD-5 import merge', kind: 'Task', note: 'Confirm duplicate rows are gone.', link: '', repeat: '', until: '', remind: '10', projectId: 'p2', taskId: '' },
  { id: 'e6', date: monthDate(14), time: '15:00', end: '15:30', title: '1:1 with Steward', kind: 'Other', note: 'Weekly queue review.', link: '', repeat: 'weekly', until: '', remind: '5', projectId: 'p1', taskId: '' },
  { id: 'e7', date: monthDate(11), time: '16:00', end: '', title: 'Demo preparation', kind: 'Reminder', note: 'Seed the test account and check every page.', link: '', repeat: '', until: '', remind: '15', projectId: 'p1', taskId: '' },
  { id: 'e8', date: monthDate(13), time: '10:30', end: '', title: 'Board review', kind: 'Other', note: 'Review open work items by owner.', link: '', repeat: 'weekly', until: '', remind: '10', projectId: 'p5', taskId: '' },
  { id: 'e9', date: monthDate(21), time: '08:30', end: '', title: 'Export a JSON backup', kind: 'Reminder', note: 'Last export is more than seven days old.', link: '', repeat: 'monthly', until: '', remind: '30', projectId: '', taskId: '' },
  { id: 'e10', date: monthDate(23), time: '09:30', end: '', title: 'Weekly planning', kind: 'Other', note: 'Set priorities for next week.', link: '', repeat: 'weekly', until: '', remind: '10', projectId: 'p1', taskId: '' },
  { id: 'e11', date: monthDate(12), time: '13:00', end: '', title: 'Customer follow-up', kind: 'Task', note: 'Reply to the Roselite after-sales thread.', link: '', repeat: '', until: '', remind: '0', projectId: 'p3', taskId: '' },
  { id: 'e12', date: monthDate(27), time: '17:00', end: '', title: 'Month close', kind: 'Deadline', note: 'Archive finished projects.', link: '', repeat: 'monthly', until: '', remind: '1440', projectId: '', taskId: '' },
].map((row, i) => ({ ...row, createdAt: stamp(-20 + i), updatedAt: stamp(-i), deletedAt: null }));

const pages = [
  {
    id: 'pg1', title: 'Summary · Roselite', type: 'Snapshot', projectId: 'p3', taskId: 't1', author: 'Amara', updatedAt: stamp(-1, 16),
    body: '## What changed\n\n- Screen feels slow in the general scenario.\n- QA confirmed two units.\n- Supplier asked for a scroll capture.\n\n## Next\n\nWait for the supplier reply, then retest on the DVT build.',
  },
  {
    id: 'pg2', title: 'Roselite · T-3 low resolution', type: 'Snapshot', projectId: 'p3', taskId: 't3', author: 'Delphine Roth', updatedAt: stamp(-2, 11),
    body: '## Evidence\n\n- Low-resolution mode after resume.\n- Fix is in the DVT build.\n\n## Verification\n\nCheck the panel report and the screenshot after resume.',
  },
  {
    id: 'pg3', title: 'Roselite after-sales report', type: 'Page', projectId: 'p3', taskId: '', author: 'Amara', updatedAt: stamp(-4, 10),
    body: '## Open items\n\n1. Slow scrolling\n2. Fingerprint smudges\n3. Long setup\n\n## Notes\n\nThe responsible team is the display quality group. Keep the issue benchmark attached to every progress update.',
  },
  {
    id: 'pg4', title: 'Miramar DVT build report', type: 'Page', projectId: 'p4', taskId: '', author: 'Marlowe Quinn', updatedAt: stamp(-6, 14),
    body: '## Build status\n\n- Battery allocation is blocked.\n- BFT station still has one block.\n\n## Decision needed\n\nChoose a fallback supplier before the release window.',
  },
  {
    id: 'pg5', title: 'Market review issue dictionary', type: 'Page', projectId: 'p2', taskId: 't17', author: 'Worker C', updatedAt: stamp(-3, 9),
    body: '## Dictionary\n\n- **Thermal** — heat, warm case, throttling.\n- **Display** — flicker, resolution, colour.\n- **Battery** — run time, charging, swelling.\n\nKeep the labels aligned with the review export.',
  },
  {
    id: 'pg6', title: 'Weekly decisions', type: 'Page', projectId: 'p1', taskId: 't16', author: 'Steward', updatedAt: stamp(-1, 18),
    body: '## Decisions\n\n- Keep the static shell free of sample data outside the Test account.\n- Use JSON export for device-to-device moves.\n\n## Follow-up\n\nConfirm the onboarding checklist with Amara.',
  },
].map((p) => ({ ...p, createdAt: p.updatedAt, deletedAt: null }));

const aiCalls = [
  { id: 'ai1', time: stamp(-1, 10), chars: 1840, placeholders: 2, model: 'deepseek-v4-pro', ok: 1, detail: 'issue classification' },
  { id: 'ai2', time: stamp(-1, 14), chars: 920, placeholders: 1, model: 'deepseek-v4-pro', ok: 1, detail: 'progress parse' },
  { id: 'ai3', time: stamp(-2, 9), chars: 430, placeholders: 0, model: 'deepseek-v4-flash', ok: 0, detail: 'timeout' },
  { id: 'ai4', time: stamp(-3, 16), chars: 2100, placeholders: 3, model: 'deepseek-v4-pro', ok: 1, detail: 'comment analysis' },
  { id: 'ai5', time: stamp(-4, 11), chars: 760, placeholders: 1, model: 'deepseek-v4-flash', ok: 1, detail: 'polish' },
].map((row) => ({ ...row, updatedAt: row.time, deletedAt: null }));

const team = [
  { id: 'a1', name: 'Amara', role: 'Lead / owner', status: 'Working', focus: 'Roselite after-sales and the Market Review report', model: 'deepseek-v4-pro', activity: 'Moved T-10 to needs your decision' },
  { id: 'a2', name: 'Marlowe Quinn', role: 'Steward', status: 'Working', focus: 'Queue health and owner routing', model: 'deepseek-v4-flash', activity: 'Routed two new work items' },
  { id: 'a3', name: 'Delphine Roth', role: 'QA', status: 'Reviewing', focus: 'T-3 and T-9 verification', model: 'deepseek-v4-pro', activity: 'Verified WD-1' },
  { id: 'a4', name: 'Cordell Nash', role: 'Dispatcher', status: 'Idle', focus: 'Dispatch rules and intake', model: 'deepseek-v4-flash', activity: 'No open orders' },
  { id: 'a5', name: 'Sloane Whitaker', role: 'Worker B', status: 'Working', focus: 'Pages editor and chart tooltips', model: 'deepseek-v4-flash', activity: 'Commented on T-5' },
  { id: 'a6', name: 'Ezra Boone', role: 'Worker C', status: 'Working', focus: 'Market review issue dictionary', model: 'deepseek-v4-flash', activity: 'Updated T-17' },
].map((row, i) => ({ ...row, createdAt: stamp(-30 + i), updatedAt: stamp(-i), deletedAt: null }));

const orders = [
  { id: 'o1', owner: 'Delphine Roth', text: 'Verify T-3 and T-9 on the DVT build, then report the result.', open: true, createdAt: stamp(-2, 9), updatedAt: stamp(-2, 9), deletedAt: null },
  { id: 'o2', owner: 'Sloane Whitaker', text: 'Check the Pages editor save flow with a long body.', open: true, createdAt: stamp(-1, 10), updatedAt: stamp(-1, 10), deletedAt: null },
  { id: 'o3', owner: 'Ezra Boone', text: 'Align the issue dictionary with the new export.', open: false, createdAt: stamp(-5, 15), updatedAt: stamp(-3, 15), deletedAt: null },
];

const seriesNames = ['Roselite', 'Miramar', 'Hello Amara', 'Market Review', 'Work Desk 2', 'Accessory'];
const ratings = {
  labels: Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    return String(date.getDate());
  }),
  series: seriesNames.map((name, s) => ({
    name,
    values: Array.from({ length: 14 }, (_, i) => Number((3.7 + ((i * (s + 2)) % 9) / 10 + (s % 2) * 0.2).toFixed(2))),
  })),
};

// Issue-like counts saved with the demo meta. The Home Pareto card orders these
// high to low; a fresh account falls back to its task modules instead.
const issueCounts = [
  { category: 'Display', count: 18 },
  { category: 'Battery', count: 11 },
  { category: 'BFT', count: 8 },
  { category: 'Supplier', count: 6 },
  { category: 'Firmware', count: 4 },
  { category: 'Packaging', count: 2 },
];

export const AI_LIMIT_DEFAULTS = Object.freeze({
  summary: 12,
  progress: 8,
  comment: 6,
  issue: 40,
  benchmark: 10,
});

export const demoSettings = {
  ai: { status: 'Connected', model: 'deepseek-v4-pro', timeout: 90, key: 'sk-demo-••••-2c13' },
  aiLimits: { ...AI_LIMIT_DEFAULTS },
  language: { primary: 'en', secondary: 'zh', rule: 'Use plain English. Keep Chinese product names and quoted customer words unchanged.' },
  dispatch: { defaultOwner: 'Dispatcher', rules: [{ keyword: 'battery', owner: 'Worker A' }, { keyword: 'release', owner: 'QA' }] },
  areas: { options: ['Battery', 'Display', 'Firmware', 'Supplier'], fallback: 'NA' },
  appearance: { preset: 'soft', primary: '', radiusBtn: 8, radiusCard: 16, glass: 0.25, enableGlass: true },
};

export function buildDemoData() {
  return {
    stores: { projects, tasks, task_history: taskHistory, task_comments: taskComments, bugs, bug_history: bugHistory, bug_comments: bugComments, events, pages, ai_calls: aiCalls, team, orders },
    meta: { seedVersion: DEMO_VERSION, settings: demoSettings, ratings, issueCounts },
  };
}
