# My Platform — Progress

Updated: 2026-11-16 (re-assessed against current code + `docs/Screen/` references)

## What this app is

**My Platform** is a local-first static single-page workspace for tasks, calendar, bugs,
events, pages and projects. It is HTML, CSS and plain JS modules only. There is no backend
database, no installer and no third-party CDN. Business data lives in the browser
(IndexedDB per local account; account registry in LocalStorage). Export/import JSON is the
only way to move data between devices.

Target site: <https://amara-gif.github.io/HelloAmara/> — GitHub Pages is **not enabled** yet
(owner action in repository Settings → Pages).

Standards:

- [BRIEF.md](BRIEF.md) — architecture, privacy, phases, design-system rules
- [FEATURE-INVENTORY.md](FEATURE-INVENTORY.md) — routes, fields, acceptance checklist
- [Screen/README.md](Screen/README.md) — old WorkDesk screenshots (reference, not pixel spec)

## Conventions

- `docs/FEATURE-INVENTORY.md` is the single feature standard. Checklist items are ticked in the
  same commit that completes them.
- Prefer small, independently verifiable commits. Track remaining work in [TASKS.md](TASKS.md).
- `assets/css/tokens.css` and `assets/css/components.css` are the only style files. New or
  changed components must appear on `styleguide.html` in the same commit.
- `node scripts/check-styles.mjs` is the design-system guard.
- Phone layout is a **fresh** responsive design (drawer sidebar, stacked cards, ≥44 px targets).
  Narrow screenshots in `docs/Screen/` show only the broken old sidebar — do not copy them.

## Bugs list delete semantics (task 22)

`#/bugs` supports multi-select delete, but only as a **soft delete**. Selected rows get
`deletedAt` + `updatedAt` timestamps, so `data.js` hides them from the live list, its counters
and the detail route while the record, key and history stay in IndexedDB. Nothing is
hard-deleted, which is why the bug detail page still says “Bugs are never deleted”. The
confirmation dialog states the same choice before the write.

## Phase status (re-assessed)

| Phase | Scope | Status |
|---|---|---|
| P0 | Static shell, design system, inventory navigation | **Done** (evidence retained below) |
| P1 | IndexedDB wrapper, schema versioning, `meta`, tests | **Done** — wrapper + demo seed + accounts + fake-IDB CRUD/schema/soft-delete/boot tests + per-account persistent-storage request/status (meta, sidebar, Settings) |
| P2 | Tasks, Home, My work, Calendar, Projects, Pages | **Partial** — rich shells + demo data; many inventory interactions still incomplete |
| P3 | Bugs and events | **Partial** — bugs list filters/sorts/multi-select soft delete complete; detail workflow gates and inline edits incomplete |
| P4 | Export and import | **Not started** |
| P5 | PWA and offline | **Not started** |
| P6 | Scraper | **Blocked** on owner (BRIEF §7 / §11) |
| P7 | Release automation and rollback proof | **Not started** (also blocked on Pages enablement) |

**Note:** `docs/PROGRESS.md` previously marked P1–P7 as not started after P0. Commit
`dfc5389` ("initial changes") added `db.js`, `data.js`, `demo-data.js`, `accounts.js` and a
much richer `views.js`/`app.js`. The table above reflects that work honestly.

## Architecture snapshot (current code)

```
index.html + styleguide.html
assets/css/tokens.css, components.css
assets/js/
  accounts.js   local account registry (LocalStorage); Test account + empty accounts
  db.js         IndexedDB open/CRUD; DB name my-platform-<accountId>; version 1
  data.js       domain ops (tasks/bugs/events/pages/projects/orders/settings)
                + per-account navigator.storage.persist() status in meta
  demo-data.js  seed rows for the Test account
  app.js        hash router, drawer, create FAB, form handlers
  nav-badge.js  In-progress task count + nav badge visibility
  routes.js     inventory §1 nav + detail patterns
  views.js      screen renderers
  chart.js, ui.js, icons.js, styleguide.js
```

No build step. Preview: `python3 -m http.server 4173` then open `/` and `/styleguide.html`.

## Per-screen progress

Statuses: **done** (substantially matches inventory + useful parts of the reference),
**partial** (shell / some layout / some data, important gaps), **missing** (no meaningful UI).

Phone/tablet PNGs are listed for completeness; they are not a layout target.

| Screenshot | Route | Status | Gaps / notes |
|---|---|---|---|
| `01-home.png` | `#/` | partial | Greeting, mini calendar, agenda, team load, rating + Pareto charts render from IndexedDB/demo. Missing: day click → calendar month, agenda row dialog (Open / Join / Delete), true team-load chart, issue Pareto (current Pareto uses bug components), “more in the calendar” truncation link. Extra “Recent AI calls” card is fine for local-first. |
| `02-mywork.png` | `#/mywork` | partial | Three queue cards with counts, links, Show all. Queue rules are simplified (`pendingDecision` / Waiting / Done+unreviewed). Missing: inventory note-based decision rules, per-row reason/next copy matching old app, `project=` scope. |
| `03-pages.png` | `#/pages` | partial | Search, project filter, table, New page, per-row Edit/Delete. Missing: select-all + Delete selected, Open as primary action, richer empty/select chrome. |
| `04-projects.png` | `#/projects` | partial | Chips, table, Add form, Archive/Restore, empty daily-feed disclosure. Missing: inline Edit/Save, drag reorder, open-count deep links with status filters, delete archived, real “What got done” feed, chip active state for per-project filter. |
| `05-tasks.png` | `#/tasks` | partial | List view, Open/All scope, filters, Send to QA, Brief, key columns. Missing: multi-value filters, parent expand/collapse, board health, Delete shown, severity/component/module filters, Progress column from real progress text. |
| `06-tasks-all.png` | `#/tasks?scope=all` | partial | Scope=all works on the same list. Same gaps as `05`. |
| `07-calendar.png` | `#/calendar` | partial | Month grid (≤3 + overflow), Prev/This/Next, project filter, next-seven agenda, Join/Delete, Enable reminders permission. Missing: repeat occurrence expansion, reminder polling/notifications payload, click-day detail dialog. |
| `08-bugs.png` | `#/bugs` | done for task 22 | Open/total/QA/past-due stats, full columns, q/status/severity/priority/component/assignee filters, smart/newest/oldest/severity/due/key sorts, multi-select soft delete, table → detail, Report a bug. Missing: “More fields”. |
| `09-chat.png` | `#/chat` | partial | Summary tiles, agent cards, Send order, To-do modal, close order. Missing: lead (Amara) summary strip, Copy brief, reopen closed orders, richer per-agent counters. “Open queue file” has no static equivalent (toast). |
| `10-files.png` | `#/files` | partial | Chart Studio + Agent Configuration tabs; stub chart when “opened”. Missing: real local chart builder UX (no OS folder), pivots/palettes, agent-file edit. Folder open correctly refused for browser. |
| `11-settings.png` | `#/settings` | partial | AI connection fields, Save, Test/Fill toasts, demo reset for Test account. Missing: dirty-state save bar, advanced polish instructions / never-send terms, real key test (no network AI yet — keep local-only). Shared secret file path does not apply. |
| `12-task-detail.png` | `#/task/:id` | partial | Breadcrumb, badges, stands/progress/details/attachments/subtasks/scheduled/feed, workflow + review side cards. Mostly read-only field blocks. Missing: inline edits, Plan card save, Depends on, New subtask / Schedule presets into Create, Ctrl+V attachments, 11-status transition map + QA gates, Ctrl+Enter comment, Analyze / real progress parse. |
| `13-bug-detail.png` | `#/bug/:id` | partial | Description blocks, activity feed, workflow, details. Missing: inline edits, TRANSITIONS map + fixer≠verifier, attachments paste/drop, Ctrl+Enter. |
| `14-project-hello-amara.png` | `#/project/TAG` | partial | Overview bars/snapshot, Work items + Pages tabs. Modules tab link falls back to Overview. Missing: Edit project, donut, 14-day actions, Coming up + Schedule, daily record, Modules page, Rule Book / xBuild tabs for TAG, tab reorder. |
| `15-project-market-review.png` | `#/project/MR` | partial | Same overview shell as other projects. **Market Review tool tabs** (Products, Review Update, Find user voices, Daily Digest, Issue Workbench, PQA Tracker, Report Deck, Issue Review, Analysis Report) are **missing**. P6 scraper-related tabs stay blocked. |
| `16-bugs-new.png` | `#/bugs/new` | partial | Dedicated create form with SLA due on create. Inventory expects auto-open of Create dialog Bug tab + “Open the bug form”. Prefill query params incomplete. |
| `17-settings-ai.png` | `#/settings/ai` | partial | Flat numeric limits form. Missing: Summary/Progress/Comment/Benchmark section layout, toggles, Restore defaults. |
| `18-settings-appearance.png` | `#/settings/appearance` | partial | Primary colour (applied), radius/glass fields, Save/Restore. Missing: palette presets, live preview strip, applying radius/glass tokens, Install-as-app (needs P5). |
| `19-rating-trend.png` | `#/rating-trend` | partial | Full-page line chart from `meta.ratings`. Copy / Choose products / Smooth are placeholders. |
| `20-page-editor.png` | `#/pages/new`, `#/page/:id/edit` | partial | Title/project/body save + pages rail. Missing: formatting toolbar, live preview, AI polish, attachments, revision history, print/PDF/Image. |
| `21-tasks-board.png` | `#/tasks?view=board` | partial | Four columns, cards, Move to select. Missing: Send to QA on cards, board health disclosure, Waiting→In Review only when owner is QA (uses Delphine Roth name today). |
| `t01-tasks-768.png` | (narrow ref) | n/a | Old app: sidebar overlay hides content. **Do not copy.** My Platform already uses a drawer ≥900 px breakpoint. |
| `t02-home-390.png` | (narrow ref) | n/a | Same — colour/type reference only. |
| `m01-home.png` … `m04-task-detail.png` | (phone refs) | n/a | Old phone layout unusable. Drawer + `table-stack` exist; further phone polish (stacked detail, 44 px audit) remains. |

### Related routes without a dedicated screenshot

| Route | Status | Notes |
|---|---|---|
| Account picker (pre-shell) | done | Local accounts; Test account seeds demo data; empty accounts get empty DBs. |
| `#/page/:id` | partial | View + rail + simple markdown; no revisions/export. |
| `#/settings/language` etc. | partial | Forms save to `meta.settings`; depth below inventory §3.15. |
| `#/go/T-n`, `#/go/WD-n` | done | Resolves case-insensitive `T-`/`WD-` keys to task/bug detail; unknown keys show Not found. |
| Tasks `view=calendar` / `timeline` | missing | Placeholder empty cards only. |
| Export / import JSON | missing | Sidebar copy mentions export; no implementation. |
| PWA (`manifest`, `sw.js`) | missing | |

## What is already working

- Design system: tokens, components, styleguide, `check-styles.mjs`, self-hosted charts/toasts/dialogs
- Hash router + inventory §1 sidebar order; Settings sub-links expand on `/settings*`
- Project sub-links under Projects (non-archived); In-progress badge recomputed on every route
- Mobile drawer (inert when closed, focus trap, Escape, backdrop)
- Desktop sidebar fold/pin with LocalStorage persistence, a pinned-state toast and a floating
  reopen control; the drawer below 900 px is unchanged
- Context menu disabled; Create FAB → Task/Bug/Event dialogs persist to IndexedDB
- Per-account IndexedDB (`my-platform-<id>`) with soft deletes (`deletedAt`) and `updatedAt`
- Node tests (`npm test`, fake-indexeddb): CRUD for every store, version 1 → 2 schema upgrade,
  live-only soft-delete filtering through `data.js`, Test-account seeding,
  persistent-storage Granted / Denied / Unsupported status, and nav In-progress badge
  count/show/hide through `nav-badge.js`
- Per-account persistent storage: `navigator.storage.persist()` is called on account boot,
  its boolean result is stored in that account's `meta`, and the status appears in the
  sidebar note and Settings
- Demo seed for Test account (projects, tasks, bugs, events, pages, team, orders, ratings)
- CRUD paths for tasks/bugs/events/pages/projects/orders/settings used by the shells
- Home/My work/Tasks/Bugs/Calendar/Team/Projects/Pages/Settings screens render with live local data

## Acceptance checklist

- Previously checked in P0: **3 of 161** (sidebar order, settings sub-links, context menu).
- Additional shell behaviours now present but **not yet reticked** in the inventory file:
  create FAB, project sub-links, drawer (phone), demo Test account (not `--demo` CLI).
- Remaining checklist items: still the large majority; tick in FEATURE-INVENTORY.md when a
  task’s acceptance criteria land.

## Known blockers / owner decisions

1. **GitHub Pages not enabled** — cannot publish or complete P7 deploy verification until the
   owner turns on Pages (branch `main`, `/`).
2. **P6 scraper** — blocked until the owner approves Option A and/or a no-install Option B
   method (BRIEF §7). Do not schedule scraper implementation tasks.
3. **UI language** — Chinese, English, or both (BRIEF §11). Current UI is English.
4. **“Stop server”** — no static equivalent; leave unchecked. Sidebar shows date + Switch account.
5. **AI network calls** — default is no third-party receipt of user data. Settings/Test key and
   Analyze/Polish stay local stubs until the owner decides otherwise.
6. **OS folder open / Excel Chart Studio / CoreMail** — Windows desktop features; replace with
   browser-safe alternatives or explicit “not available” messaging (already partly done).

## P0 — Static shell (evidence retained)

### Inventory alignment

- Sidebar groups and order match inventory §1.
- Six Settings sub-links on every `/settings*` page.
- Invented Overview / Data & backup / About pages were removed in P0; later commit wired real
  inventory-shaped shells with local data.
- Context menu disabled on every page.
- “Stop server” left unchecked (static app).

### Design system

- `tokens.css` holds colour, type, spacing, radius, shadow, layout, breakpoints, motion.
- `components.css` is the only layout/component stylesheet.
- `chart.js` / `ui.js` are the only chart and toast/dialog modules.
- `styleguide.html` shows tokens and required components.
- `scripts/check-styles.mjs` rejects inline styles, colour literals outside tokens, px font
  sizes, literal font families, extra CSS files; checks required components.

### Verification evidence (P0)

- Browser: Chromium (Playwright), local static server.
- 19 routes × 4 viewport widths (360, 390, 768, 1280) = **76 combinations** — no page-level
  horizontal scroll; interactive targets ≥ 44 px; no console/page errors.
- Network: same-origin only (HTML, CSS, JS, favicon). No third-party request.
- Legacy palette computed: text `rgb(29, 29, 31)`, secondary `rgb(110, 110, 115)`,
  divider `rgb(217, 217, 222)`, card head `rgb(74, 144, 217)`, band `rgb(251, 243, 213)`.
- Mobile drawer: closed with `inert`, opens focusing first nav link, Escape returns focus.
- Screenshots under `docs/evidence/p0-*.png`.

### Publishing

- P0 was pushed to `main`. Pages still not enabled (`403` for integration token).
- Owner action: Settings → Pages → Deploy from branch `main`, folder `/ (root)`.

## Next

Ordered backlog: [TASKS.md](TASKS.md). P1 leftovers (persistent-storage status) are done; start
with screen/feature slices that stay independently verifiable. Skip Pages enablement, deploy,
P6 scraper, and any spend/delete-remote-data work.
