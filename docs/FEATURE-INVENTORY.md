# Work Desk — Complete Feature Inventory (rebuild specification)

Source: `D:\Hello Amara\WorkDesk\App\work_app.py` (~12,000 lines) plus ~40 modules. Compiled 2026-11-16 from the live code. All line references are to `work_app.py` unless another file is named. Everything here was derived from code, not guesses; "unresolved" notes are flagged inline and summarized at the end.

## 0. Runtime and platform behavior

- Single-process Python stdlib HTTP app: `ThreadingHTTPServer` subclass `DeskServer` + `BaseHTTPRequestHandler` subclass `Handler` (`server_version = "WorkDesk/5.0"`). Each request thread gets a COM apartment (`pythoncom.CoInitialize`) so Excel/Outlook/SendKeys automation works on any worker thread.
- Host `127.0.0.1`, base port from env `WORK_DESK_PORT` (default **8777**); if busy, tries ports BASE..BASE+11. Refuses to start if another Work Desk install owns the port (detects via `data-source-root="` marker in the served homepage) or if started from a `\backups\` / `\payload\` folder. `--open` opens the browser; `--demo` (+`--rebuild-demo`) switches to a demo workspace (`_work` demo root) with its own AI/config files and `DEMO_MODE=True`.
- Startup side effects: data migrations (v1 bugs, Chinese legacy values, Note→Page wording), backfill of After Sales notes, product-report page retitling, Top Issues sync, queue-watcher thread, analysis warm-up thread, console line reporting AI key state + key file path.
- All pages are server-rendered HTML with inline JS. No external assets; fonts are local `HONOR Sans CN` (`FONT_FACES`), palette tokens INK `#1D1D1F`, SECONDARY `#6E6E73`, HAIRLINE `#D9D9DE`, CARD_HEAD `#4A90D9`, BAND `#FBF3D5`.
- PWA: `/brand/workdesk.webmanifest` manifest, `/sw.js` no-cache service worker (exists only so the browser offers "install as app"), `beforeinstallprompt` captured into `window.__wdInstallPrompt`, `html.can-install` class highlights the install button on the Appearance page.
- Auto-reload contracts (in every page via `layout()`):
  - every 15 s fetch `/api/build`; if build stamp differs from the page's `meta[name=wd-build]`, reload (code changed).
  - every 3 s (shared SCRIPT) fetch `/api/rev`; if the data revision changed, reload the page — but never while the user is typing.
- Browser context menu is suppressed on every page (`contextmenu` preventDefault).
- Sidebar can be folded (`wdNavFold`) and pinned (`wdNavPin`); state in `localStorage` (`wdNav`, `wdNavPin`), applied before first paint. A floating `#navOpen` button re-opens a folded sidebar. Sidebar footer: **Stop server** button (`quitApp()` → POST `/api/quit`) and today's date. Brand row shows logo + "Work Desk" + environment badge pill (`env_badge_html`, line 4117).
- `DEMO_MODE` shows a demo banner on every page and blocks settings writes; `HIDE_BOARD_DATA` (normally False) replaces task/bug pages with a "Hidden, not deleted" placeholder card (`hidden_page`).
- Keyboard shortcuts (global script, line 4027): **Ctrl/Cmd+Enter** in `#bgComment` posts a bug comment; **Ctrl/Cmd+Enter** in `#tskComment` posts a task comment; **Alt+←/→** while a project tab link is focused moves the tab (tab reorder); **Esc** closes the create dialog. **Ctrl+V** paste of images is handled on task/bug description fields and the create dialog (upload via `/api/attach`).
- `head_block(page, subtitle, search, title)` renders the H1 + subtitle; the `search` flag is **accepted and ignored** — "there is no Search page any more". Searching is per-list `q=` filters (tasks, bugs, pages) plus the review-content search tool ("Find user voices", backed by `voice_search.py`).

## 1. Navigation (PAGE_META lines 335–353, NAV_GROUPS 355–360)

Sidebar groups and order (group label → pages, with route and title):

| Group | Route | Title |
|---|---|---|
| *(no label)* | `/` | Home |
| | `/mywork` | My work |
| | `/pages` | Pages |
| **Projects** | `/projects` | Projects |
| | *(then one nav link per non-archived project: `KEY` + name → `/project/<name>`; this sub-list is drag-reorderable, persisting via `/api/projects/reorder`)* | |
| **Work** | `/tasks` | All work items |
| | `/calendar` | Calendar |
| **System** | `/bugs` | Bugs |
| | `/chat` | Team |
| | `/files` | Tools & Files |
| | `/settings` | Settings |

- The `/tasks` nav link shows a count badge of tasks with stored status `In progress`.
- When any `/settings*` page is active, sub-links appear under Settings: **AI inputs & limits** `/settings/ai`, **Language rules** `/settings/language`, **Snapshots** `/settings/snapshots`, **Dispatch rules** `/settings/dispatch`, **Responsibility areas** `/settings/areas`, **Appearance & theme** `/settings/appearance`.
- Other PAGE_META entries not in nav: `/bugs/new` ("Report a bug"), `/settings/template` (302 → `/settings/ai`).
- A floating **＋ Create** FAB (create_dialog, every page) opens the global Create dialog.

## 2. Full route list (from `render()` line 8854, `ROUTES` 8825, `do_GET` 9356, `do_POST` 9784)

HTML/page routes: `/`, `/pages`, `/page/new/edit`, `/page/<id>`, `/page/<id>/edit`, `/page/<id>/print`, `/note/<id>` (302→`/page/<id>`), `/?note=<id>` (302→ page edit), `/calendar`, `/after-sales/customize`, `/issue-review/customize`, `/product/<name>`, `/task/<id>`, `/tasks`, `/mywork`, `/analysis/customize`, `/review-update/customize`, `/customize/xbuild-report`, `/customize/<tab>`, `/analysis/print`, `/analysis/grid` (JSON), `/projects`, `/project/<id-or-name>`, `/bugs/new`, `/rating-trend`, `/files`, `/bugs`, `/bug/<id>`, `/go/<T-n|WD-n>` (302 to task/bug by readable key; 404 page otherwise), `/chat`, `/settings`, `/settings/ai`, `/settings/language`, `/settings/snapshots`, `/settings/dispatch`, `/settings/areas`, `/settings/appearance`, `/settings/template` (302). Unknown → 404.
GET API/file routes: 30 (section 4). POST API routes: 95 (section 4). **Total distinct routes: ~163.**

## 3. Page inventory

### 3.1 `/` — Home (`page_home` 5070)

Greeting header (time-of-day + "Amara"). Two columns:
- **Left:** current-month mini calendar (Monday-first; days with occurrences marked; click a date → `/calendar?m=YYYY-MM`); **Open calendar** link; **Today and coming up · next 6** agenda (merges upcoming events, active work-item due dates, non-Done project due dates, open-bug due dates; includes up to 2 overdue entries; max 6 rows + "more in the calendar" link; empty texts "Nothing due." / "Nothing due in the next seven days."); team-load card (donut/bars from `/api/team/load`).
- **Right:** rating-trend card (SVG chart from `/api/trend/live`; links to `/rating-trend`) and Pareto card (`/api/pareto/live`; links to the Market Review project's Analysis Report tab, else `/projects`).
- Agenda row click opens a dialog: kind, title, details, **Open full page**, conditional **Join meeting** (only for recognized meeting URLs, new tab), conditional **Delete event** (only for real event series; confirm → POST `/api/event/delete`).
- Chart cards come from `home_charts.py`: rating trend line chart (products × days window, smoothing band), team load, Pareto of issues.

### 3.2 `/tasks` — All work items (`page_tasks` 5747; shared renderer `work_items_body` 5375, also used by project Work-items tab and shared filters)

- Summary/switch bar + **view switch**: `view=list|board|calendar|timeline` (invalid → list).
- **Scope:** default shows open rows only (stored status ≠ Done); `scope=all|everything|1|true|yes` shows everything; explicit `status=` filters override the default. **Open** / **All** links.
- **Filters** (multi-value query params): `status`, `priority`, `owner`, `severity`, `component`, `module`, `project`; `q=` text search over title, note, owner, id, key, component, description, module; `sort=smart|due|priority|key`; `m=YYYY-MM` for the embedded calendar view; `reset=1` clears filters.
- **List view** table columns: Key, Summary, Project, Progress, Status, Assignee, Due, Priority, Severity, Component, Age, Actions. Row link → `/task/<id>`. Parent rows expand/collapse subtasks. Row actions: **Send to QA** (when eligible; shared QA action → `/api/task/toqa`), **Brief** (copies a hand-off text to clipboard).
- **Board view**: 4 columns To Do / In Progress / In Review / Done (`JIRA_STATUSES`; Waiting maps to In Review only when owner = QA, else flagged In Progress); cards with link + **Move to…** selector (→ `/api/task/transition`), conditional Send to QA.
- **Calendar view**: month grid, Previous / This month / Next links, task links, count of open undated items.
- **Timeline view**: dated bars, today line, milestone marks, undated count.
- **Board health** disclosure (only when problems exist): up to 12 Done-without-QA-mark rows (a Done note must contain `[已核` or `[免核` to count as checked); up to 10 lost hand-over marks with **Restore mark** button (→ POST `/api/task/restore`); dropped-row notice (notes containing `[dropped`) saying rows stay in `tasks.tsv`.
- Shown statuses are the 11 bug statuses (`task_status()`); stored statuses are only To do / In progress / Waiting / Done; the fine status lives in `task_details.workflow` and is trusted only while consistent with the stored value.

### 3.3 `/task/<id>` — Work item detail (`page_task` 7054)

- Breadcrumb (+ project link). After Sales Top Items tasks get an **Open After Sales customization** card. Header: task key (T-n), editable title, status/priority/severity/type badges, conditional **Send to QA** (hidden when Done or owner already QA).
- Main column:
  - **Where this stands**: next action, QA state, review state, note/details.
  - After-Sales-only: Issue picker (choose product → `/api/task/field` field=`product`, reload; choose issue → field=`issue`) and Top Issue order (`top_rank`).
  - **Progress update** editor + checkbox **This is a real progress update** + **Save progress** (real updates go through `/api/task/progress/parse` first, then `/api/task/comment`); AI suggestion review block when AI produced values (apply/dismiss).
  - Editable blocks **Description**, **Steps**, **Expected**, **Actual** (each saves via `/api/task/field`; Ctrl+V screenshot paste supported → `/api/attach`).
  - **Attachments / deliverables**: drop/click/paste upload (`/api/attach` then field update); remove via `/api/task/detach`.
  - **Subtasks** list + **New subtask** (opens Create dialog with parent preset).
  - **Depends on** list.
  - **Scheduled** list + **Schedule time for this** (opens Create dialog Event tab with task preset).
  - Pages that mention this task.
  - **Comments** feed (history + comments merged from `task_activity.feed`); comment box `#tskComment`, Ctrl+Enter posts; optional **Analyze** via `/api/task/comment/analyze` (returns `ai_comment`), post via `/api/task/comment`.
- Sidebar:
  - **Workflow** card: `As` (acting role), `Move to` (target status constrained by bug-style transitions), `Reason` (required for Wont fix/Rejected/Deferred/Reopened), `Duplicate of`, **Apply move** → `/api/task/transition`. QA-only rule: only QA sets Verified/Closed; Duplicate/Wont fix/Rejected closures by Amara/QA/Steward record a waiver.
  - **Your review**: optional comment + **Approve** / **Request changes** → `/api/task/review` (only Amara may decide; decision stored with deliverable fingerprint, goes stale if deliverables change).
  - **Recommended model** (from auto_dispatch agent defs).
  - **Plan**: Project, Module, Start, End, Depends on, Milestone → `/api/task/plan`.
  - **Details** (all inline-editable unless noted): Assignee (with suggested-owner **Assign** button), Priority, Severity, Type, Product, Component, After-Sales extras, Reporter, Due, ETA, Found in, Fix in, Environment, Labels, Duplicate of, Linked bug, Resolution, Links, Deliverables, Note, Created/Updated/ID (read-only). Field saves → `/api/task/field`; owner change → `/api/task/route`.

### 3.4 `/mywork` — My work (`page_mywork` 6431)

Three queue cards computed from rows: **Needs your decision**, **Blocked**, **Ready for review** — each with count, task links, reason, next step, owner, due. Shows first 8 rows; **Show all n** → `all=1` (keeps `project=` param). `project=<id>` scopes it. Empty card text "Nothing here." No mutations on this page.

### 3.5 `/projects` — Projects (`page_projects` 5831)

- Chips: **All**, one per active project, **Archived (n)** (`archived=1`); `project=<id>` filters the feed.
- Table: Acronym, Project, Status, Start, Due, Open work items, Pages + actions. Name → `/project/<name>`; open-count → project items tab pre-filtered `status=To Do,In Progress,In Review`; page count → project pages tab.
- Inline **Add** row (new project) → POST `/api/project/add`. **Edit** opens inline fields → **Save** `/api/project/save` / **Cancel**. **Archive** (confirm) → `/api/project/archive`; archived rows: **Restore** (same endpoint) and **Delete** (confirm) → `/api/project/delete`. Drag rows to reorder → `/api/projects/reorder`.
- Collapsible **What got done, day by day** feed (last 14 dates, per-project filterable); file chips open local paths via POST `/api/open`.

### 3.6 `/project/<id-or-name>` — Project page (`page_project` 6199)

- Accepts id or case-insensitive name; unknown → 404 "Project not found".
- Header: breadcrumb, description, status/owner/due/keywords, **Edit project** disclosure (Name, Status, Owner, Start, Due, Keywords, About) → `/api/project/save` (`saveProject`). Tab strip: tabs are reorderable (double-click to arm, drag, release saves per-project `tab_order` via `/api/project/tabs`; Alt+←/→ also moves a focused tab).
- Tabs (`?tab=`):
  - **Overview**: review-queue counts + **Open My work** link; **Work by status** donut; module completion bars; **Actions per day, last 14 days** chart; **Coming up** (next 30 days, max 8, project due row when applicable) with **Schedule** button (opens Create dialog Event tab, project preset); Pages list; daily record.
  - **Work items**: the shared list/board/calendar/timeline UI scoped to the project (all `/tasks` filters/actions apply; extra `tab` param carried in filter form).
  - **Modules**: per-module done/total + progress bar; module name links to Work items tab with `module=<name>`.
  - **Pages**: list + **New Page**; `page=<id>` 302→`/page/<id>`; `page=<id>&edit=1` 302→ editor; `new=1` 302→ `/page/new/edit?project=<id>`.
  - **Market Review project only** (`tool_tabs.TABS` line 2910): **Products**, **Review Update**, **Find user voices**, **Daily Digest**, **Issue Workbench**, **PQA Tracker**, **Report Deck** (details in §5.6); plus **Issue Review** and **Analysis Report** tabs (issue_workbench / market_analysis_ui modules).
  - **Projects with key in `xbuild_report.PROJECT_KEYS` (`("TAG",)`, the "Hello Amara" project)**: **Rule Book** (`xbuild-standard`) and **xBuild Report** (`xbuild-report`) tabs (§5.7).
- `/product/<name>` renders a product detail page (product_detail_page.py) framed under the Market Review Products tab; failure shows "Product unavailable" + back link.

### 3.7 `/calendar` — Calendar (`page_calendar` 6508)

- Controls: **Enable reminders** (requests browser Notification permission; reminder polling hits `/api/reminders` via `reminder_ui`), month heading, project selector (`p=<project-id>`), **Previous / This month / Next** (`m=YYYY-MM`, month preserved/reset with filter kept).
- Month grid (Monday-first): up to 3 items per day + `+n` overflow. Items = active work-item deadlines, open bug deadlines (only when no project filter), non-Done project due dates, scheduled events (expanded via `schedule.occurrences` incl. repeats).
- **Next seven days** agenda with kind badges; **Join** (safe meeting links, new tab); **Delete** (events with a series id only; confirm → `/api/event/delete`). Empty: "Nothing scheduled in the next seven days."
- Subtitle points to global **＋ → Event** for adding events.

### 3.8 Pages / Notes (`page_pages` 4917, `page_view` 4855, `page_edit` 4954; print via `note_export`)

- `/pages`: search `q` (title/body/tags) + `project` filter; **Search** (GET form); **New Page** → `/page/new/edit`; selection checkboxes + **Delete selected** → POST `/api/page/delete`. Empty: "No Page matches. Start a new one."
- `/page/<id>`: left rail of pages (filter box), breadcrumbs, title, author/date, project links, tags, rendered body (markdown_lite), version selector (`?rev=<n>`, older revs flagged). Buttons: **Edit** → `/page/<id>/edit`, **Print** → `/page/<id>/print` (print-ready HTML via `note_export.print_html`), **PDF** / **Image** → `/api/page/export?id=..&fmt=pdf|png`. 404 "No such Page."
- `/page/<id>/edit`, `/page/new/edit` (`?project=` preselect): embeds the `home_notes` editor (toolbar, markdown body, live preview `/api/page/preview`, **AI polish** `/api/page/polish`, save `/api/page/save` with `project_id, page_id, title, body`, delete `/api/page/delete`, attachments `/api/attach`). Legacy manual pages show simple Title/Body + **Save Page**. Blank title rejected client-side. `/api/note/*` are aliases of `/api/page/*`.
- Saves write `project_pages.tsv`; a history row (revision) is appended so versions survive.

### 3.9 `/bugs` — Bugs (`page_bugs` 7724)

- Counters: open/total, waiting for QA, past due. Filter bar: `q`, multi-value `status`, `severity`, `priority`, `component`, `assignee`; `sort=smart|newest|oldest|severity|due|key`; `reset=1` clears.
- Table: Key (WD-n), Summary, Status, Assignee, Due, Priority, Severity, Component, Age; row → `/bug/<id>`; selection + delete control (POST `/api/bug/delete`). Empty state links to reset and `/bugs/new`. Hidden-board mode shows the not-released notice.

### 3.10 `/bugs/new` — Report a bug (`page_bug_new` 7813)

Minimal page: **Open the bug form** + **Back to Bugs**; the global Create dialog's Bug tab opens automatically on load. Prefill query params: `t` (title), `d` (description), `component`, `severity` (default S3).

### 3.11 `/bug/<id>` — Bug detail (`page_bug` 7830)

- Editable title; blocks **Description** ("Paste a screenshot straight in - Ctrl+V."), **Steps to reproduce**, **Expected**, **Actual** → `/api/bug/update`.
- **Attachments**: paste/drop/file chooser → `/api/attach` then `/api/bug/attach`; remove → `/api/bug/detach`.
- **Comments / activity** feed (comments + per-field change log from bug_tracker); comment box `#bgComment` + **Comment** button (Ctrl+Enter posts) → `/api/bug/comment`.
- **Workflow** card: `As`, `Move to` (only transitions allowed by `TRANSITIONS`), `Reason`, `Duplicate of`, **Apply move** → `/api/bug/transition`. Gate: a fixer never verifies their own fix; **QA alone sets Verified**; stated policy "bugs are never deleted" on this page.
- **Recommended model**; **Details** card inline edits: assignee, reporter, priority, severity, type, component, found_in, fix_in, due, labels, links, linked_task, resolution, note → `/api/bug/update`; created/updated/id read-only. 404 for missing id.

### 3.12 `/chat` — Team (`page_team` 7540 → `team_page.py`)

- Summary tiles: decisions awaiting the lead, reviews ready, people working, open work items, today's actions.
- One card per agent/role: display name + role, status, focus, workload, counts, latest activity; an **order composer** (textarea + **Send** → POST `/api/team/order` `{owner, text}`); **To-do list** opener → panel with open orders (tick button → `/api/team/order/close` `{id}`), up to 12 owned board rows linking to `/task/<id>`, role description, base model, recent activity, **Copy brief**, **Open queue file** (via `/api/open`), close control. Workload data from GET `/api/team/load`. Closed orders can be reopened via `/api/team/order/reopen` (endpoint exists; UI hook not located in the inspected excerpt).

### 3.13 `/files` — Tools & Files (`page_files` 7544 → `tools_page.py`)

Two tabs (`?tab=`): **Chart Studio** (`tools`, default) and **Agent Configuration** (`agents`).
- **Chart Studio** tab: *Target table* (dropdown of known report workbooks or typed path) + *Sheet* (options fetched from `/api/tools/chart-studio/sheets?path=`; default "(first readable sheet)"); buttons **Open chart page** (POST `/api/tools/chart-studio` → generates an interactive chart HTML page under `Reports/Chart_Studio`, served by `/api/tools/chart-studio/view?name=`; the chart page itself contains filters, X/Y axes, chart type, palettes `a2|apple|ocean|sunset|candy|graphite`, pivots via `/api/tools/chart-studio/pivot*`), **Open chart folder** (POST `/api/tools/chart-studio/folder`), hidden **Open it again** link after a run. Also a "Every field of every product" spec matrix section.
- **Agent Configuration** tab (`agent_config_page.py`): view/manage the `.github/agents/*.agent.md` agent files (owner list, display names, models); exact controls live in that module.

### 3.14 `/rating-trend` (`page_rating_trend` 5062, chart from `home_charts.py`/`rating_trend_live.py`)

Full-page product rating trend chart. Controls: **Copy image**, **Choose products** (+ **Everything**, **Save** → POST `/api/trend/products`, **Close**), **Smooth curve** / **Straight line** (POST `/api/trend/line-style`). Data: GET `/api/trend/live?w&h&products&days&band&line`.

### 3.15 Settings pages

All share `settings_nav` tabs (Settings, AI inputs & limits, Language rules, Snapshots, Dispatch rules, Responsibility areas, Appearance & theme) and a save bar with dirty-state text ("Unsaved changes. Save before leaving." / "All changes saved.").

- **`/settings` — AI connection (`page_settings` 8034):** connection status + masked key (replacement input is password-type), model and timeout fields, defaults for work items and bugs, advanced English-editor instructions and never-send terms. Buttons: **Test the key** → POST `/api/settings/test`; **Fill the gaps now** → POST `/api/backfill` (AI backfills missing task/bug English fields); reset instructions → `/api/settings/polish/reset`; **Save changes** → `/api/settings/save` (key/model/timeout) then `/api/settings/polish` (instructions/terms). All four endpoints are blocked in demo mode.
- **`/settings/ai` — AI inputs & limits (8151):** sections for Summary, Progress, Comment and Issue classification, Issue Benchmark; link to Language rules; report wording guidance; an input-surface table; configuration-source list. **Save changes** / **Restore defaults** (`{defaults:true}`) → POST `/api/settings/ai`.
- **`/settings/language` (8274):** Primary/Secondary language selects (en/zh; both languages always kept, this sets order), natural-language rule textarea sent to every AI surface, live preview `<details>`. **Save changes** → `/api/settings/ai` with `{settings:{language:{primary,secondary}, natural_language_rules}}`. "Applies to the next AI call only."
- **`/settings/snapshots` (8327):** target selector ("Product · <name>" for every product, "Task · <key · title>" for every After Sales task; prefers product "Roselite"), From/To date filters, **Refresh list** → GET `/api/snapshots?product|task&from&to`; table Date/Kind/Excerpt with **Open** (snapshot URL) and **Delete** (confirm "Delete this snapshot permanently? The Page and other versions stay." → POST `/api/snapshots/delete` `{token, note_id, product|task}`). Nothing is auto-deleted.
- **`/settings/dispatch` (8392):** **Default owner** select (fallback Dispatcher); rule rows each with Keyword / Product / Issue / Severity / Area conditions + "Give it to" owner select + × remove; **Add rule**; first matching rule wins, blank conditions ignored, keywords match title+description; **Save changes** → `/api/settings/ai` with `{settings:{dispatch:{default_owner, rules:[{when:{...},owner}]}}}`.
- **`/settings/areas` (8490):** list of extra responsibility-area names (add/remove), **Unknown owner** fallback (default "NA"; PQA shown in report when NA), note that After Sales responsible teams live on the After Sales customization page (linked). **Save changes** → `/api/settings/ai` `{settings:{areas:{options, fallback}}}`.
- **`/settings/appearance` (8595, `theme_store.py`):** primary color (color picker + hex text), palette-preset swatches (Soft A2, Apple system, Ocean cool, Sunset warm, Candy pop, Graphite mono), button radius slider (0–20 px), card radius slider (0–28 px), glass opacity slider (0.10–1.00) + **enable glass** checkbox, live preview strip (Primary/Secondary buttons toast, Selected chip toggles), **Install Work Desk as an app** button (always visible; uses captured install prompt), **Save theme** → POST `/api/settings/theme`, **Restore default look** → same endpoint `{defaults:true}`. Defaults: primary `#0071E3`, radius_btn 8px, radius_card 16px, glass 0.25 on.

### 3.16 Customization pages (market-review tool configuration)

- **`/after-sales/customize?task=<id>` (6769):** valid only for an After Sales Top Items task (else 404). Sticky section nav: AI guidance (textarea + markdown preview), Responsibility (customer name, responsible-team rows add/remove, AI team brief, **Suggest teams with AI** → POST `/api/after-sales/team-suggest`, **Add selected**), ETA rule (priority default / fixed days / manual only), What the progress AI reads (comment/pages/top-items limits + Include Issue Benchmark / Include Top Items checkboxes), Preview on this Task (task/product/issue, **Open Task Page**, responsible team + ETA/NA, **Save this Task** → `/api/after-sales/task-values`), Snapshots (**Open Snapshot Manager** → `/settings/snapshots`). Bottom **Save changes** → `/api/after-sales/customize` (global config), reload on success.
- **`/analysis/customize?project=`** → `market_analysis_ui.render_customization` (Analysis Report config; saves via `/api/analysis/save`, `/api/analysis/summary/*`, `/api/analysis/version/save`).
- **`/issue-review/customize?project=`** → `issue_workbench.render_customization` (issue dictionary, actions, rules; saves `/api/issue/customization/save`).
- **`/review-update/customize?project=`** → `tool_tabs.render_review_update_customize` (scraper settings; saves `/api/tools/review-update/settings`).
- **`/customize/xbuild-report?project=`** → `xbuild_report.render_customize`.
- **`/customize/<tab>?project=`** → `tab_customization.render(tab,…)` for the other market tool tabs (titles in `tab_customization.TITLES`); saves POST `/api/customize/<tab>` (blocked in demo mode).
- **`/analysis/print?project=`** print view; **`/analysis/grid?project=`** JSON grid payload for the Analysis Report tab.

## 4. API inventory

Conventions: GET params are query-string; POST bodies are JSON (`Content-Type: application/json`) except `/api/attach` (multipart). JSON replies are `{"ok":true,...}` / `{"ok":false,"error":...}` (400 for ValueError, 409 for stale bug revision, 500 otherwise). Most mutating posts end with `refresh_queues()`. Demo mode blocks: `/api/settings/save`, `/api/settings/test`, `/api/settings/polish`, `/api/settings/polish/reset`, `/api/customize/<tab>`.

### 4.1 GET endpoints (30)

| Route | Params | Effect / response |
|---|---|---|
| `/api/rev` | — | `{ok, rev, stale}`; rev = sha1 of mtimes/sizes of tasks/events/bugs/bug_comments/projects/plan/pages/approvals/LOG.md; `stale` true when app code changed since start. Polled every 3 s for auto-reload. |
| `/api/build` | — | `{build: BUILD_STAMP}`; polled every 15 s. |
| `/api/reminders` | — | Due event reminders with context/href; consumed by reminder UI/notifications. |
| `/api/team/load` | — | `{ok, agents:{...}, total}` team workload. |
| `/api/snapshots` | `product` or `task`, `from`, `to` | List saved snapshots `{ok, snapshots:[{at,kind,excerpt,token,page_id,url}]}`. |
| `/api/rating-trend` | `days` | Rating-trend payload (card). |
| `/api/trend/live` | `w,h,products,days,band,line` | Live rating chart JSON (SVG inside). |
| `/api/pareto/live` | `w,h` | Market Review Pareto `{ok, svg}`. |
| `/api/issue/options` | `product` | Issue options/counts for a product. |
| `/api/issue/list` | `project`(req), `product`, `status`, `q` | Issue Review rows. |
| `/api/issue/review` | `project`, `id` | One review record. |
| `/api/issue/dictionary` | `project` | Dictionary items. |
| `/api/issue/export` | `project` | Downloads `Issue_Review_Master.xlsx`. |
| `/api/analysis/topsync` | — | Ensures After Sales notes exist + syncs Top Issues tabs; `{ok, message, report}`. |
| `/api/analysis/pareto` | `project`(req) + filters, `w,h` | Analysis Pareto as `image/svg+xml`. |
| `/api/analysis/pdf` / `/api/analysis/pptx` | `project` + filters | Generates and downloads the Analysis Report as PDF / PPTX. |
| `/analysis/grid` | `project` + filters | Analysis grid JSON (page data). |
| `/api/jobs` | `id`, `from`, `tool` | Job-runner progress snapshot (long scraper runs stream events; `from` = event offset). |
| `/api/tools/chart-studio/sheets` | `path` | `{ok, sheets, note}` workbook sheet list. |
| `/api/tools/chart-studio/pivot-columns` | `path` | Pivot dimension list. |
| `/api/tools/chart-studio/pivot-values` | `path`, `column` | Distinct values of a column. |
| `/api/tools/chart-studio/view` | `name` | Serves a generated chart HTML page (basename only). |
| `/api/tools/report-deck/view` | `name` | Serves a generated deck HTML. |
| `/api/tools/daily-digest/view` | `name` | Serves a digest HTML (prefers `Standalone_<name>`). |
| `/api/tools/xbuild/example` | `name` | Standalone xBuild example page. |
| `/api/note/export`, `/api/page/export` | `id`, `fmt` (pdf/png) | Exports a Page; attachment download. |
| `/brand/<file>` | — | Brand assets from `Assets/brand`; plain names only; png/ico/svg/webp/webmanifest; cache 1 h. |
| `/raw` | `p` (relative path) | Serves evidence files inside the workspace only (no `..`, extension allowlist: images/pdf/txt/log/csv/json); localhost only. |
| `/sw.js` | — | No-cache service worker. |

### 4.2 POST endpoints (95)

**Tasks**
- `/api/task/add` — `{title*(req), priority, due, start, type, project_id, note, files, eta, parent, product, module, description, expected, actual, dispatch, draft}`. Creates row (owner defaults Dispatcher; After Sales Top Items default to Amara), writes details/plan, generates key T-n, may fire background auto-dispatch. → `{ok, id, key}`.
- `/api/task/route` — `{id, owner, who?}` change owner (validated against choices); logs activity.
- `/api/task/update` — `{id, field, value, who?}` update a `tasks.tsv` header field; validates enum choices; blocks closing without QA mark; due change constrains plan end.
- `/api/task/field` — `{id, field, value}` update detail fields (description, repro, expected, actual, labels, product, issue, severity, type, component, reporter, found_in, fix_in, environment, duplicate_of, linked_task, resolution, links, title, note, due, eta, priority…); writes task_details/tasks + history.
- `/api/task/transition` — `{id, to, as/who, reason?, duplicate_of?}` workflow move using the 11-status machine; QA-only Verified/Closed, waiver statuses (Duplicate/Wont fix/Rejected) need Amara/QA/Steward and record a waiver, reason required for Wont fix/Rejected/Deferred/Reopened.
- `/api/task/toqa` — hand a row to QA (sets Waiting+owner QA, note mark `[待核 date]`).
- `/api/task/comment` — `{id, body, real?, who?}` append comment (`task_comments.tsv`); real progress updates may apply AI-derived values.
- `/api/task/comment/analyze` — `{id, body}` → `{ok, ai_comment}` (AI understanding/progress draft; not stored until posted).
- `/api/task/progress/parse` — `{real:true, id, body}` parse a real progress update; applies After Sales AI values; → result + `applied`.
- `/api/task/plan` — `{id, project_id, module, start, end, depends_on, milestone}` → `task_plan.tsv`.
- `/api/task/review` — `{id, decision(approve|changes), comment?}`; Amara only; stores to `task_approvals.tsv` with deliverable fingerprint.
- `/api/task/expect` — `{id, expected, actual}` → `task_expectations.tsv` (status 确认 when both filled, else 待确认).
- `/api/task/restore` — `{id}` restore a lost QA hand-over mark → `{ok, snapshot}`.
- `/api/task/detach` — `{id, path}` remove an attachment/deliverable reference.
- `/api/task/drop` / `/api/task/delete` — mark a row dropped (note `[dropped`); rows are never physically removed.
- `/api/backfill` — AI fills missing English fields on tasks/bugs.

**Bugs**
- `/api/bug/add` — full bug fields (title req, severity req, type, priority, component, found_in, description, repro req, expected, actual, environment, labels, links, reporter, assignee, due, linked_task, draft) → `{ok, id, key WD-n}`; SLA due from severity (S1:0d, S2:2d, S3:5d, S4:none).
- `/api/bug/update` — `{id, field, value, who?}` single-field edit + history row; stale write → 409.
- `/api/bug/transition` — `{id, to, as, reason?, duplicate_of?}` constrained by `TRANSITIONS`; fixer≠verifier; QA-only Verified.
- `/api/bug/comment` — `{id, body, who?}` append to `bug_comments.tsv`.
- `/api/bug/attach` — `{id, paths}` attach evidence files (after `/api/attach`).
- `/api/bug/detach` — `{id, path}` remove evidence reference.
- `/api/bug/delete` — `{id}` delete from the Bugs list page.

**Projects, products, pages, events**
- `/api/project/add` `{name,key,…}`; `/api/project/save` (name,key,description,owner,status,start,due,keywords); `/api/project/archive` `{id,archived}`; `/api/project/delete` `{id}`; `/api/projects/reorder` `{ids}`; `/api/project/tabs` `{id, tab_order}`; `/api/project/update` (field update).
- `/api/products` (save product list/config), `/api/products/one` (one product), `/api/products/columns` (column defs), `/api/products/sync` (sync catalog).
- `/api/page/save` `{project_id, page_id|new, title, body}` (+revision); `/api/page/preview` (markdown render); `/api/page/polish` (AI polish); `/api/page/delete` `{ids}`; `/api/note/save|preview|polish|delete` aliases.
- `/api/event/add` `{title, date, time, end, kind, note, link, repeat, until, remind, project_id, task_id}`; `/api/event/delete` `{id, scope?}`.

**Team**
- `/api/team/order` `{owner, text}` create order; `/api/team/order/close` `{id}`; `/api/team/order/reopen` `{id}`.

**Settings / theme / AI**
- `/api/settings/ai` `{settings:{…}}` or `{defaults:true}` — merged AI-pipeline settings (summary/progress/comment/issue limits, language, dispatch, areas).
- `/api/settings/save` `{api_key, model, timeout}`; `/api/settings/test` (round-trip test → `{ok,title,model}`); `/api/settings/polish` (editor instructions / never-send terms); `/api/settings/polish/reset`.
- `/api/settings/theme` `{primary, radius_btn, radius_card, glass_opacity, enable_glass}` or `{defaults:true}` → `_internal/data/theme_config.json`.
- `/api/ai/polish` — generic text polish (suggestion only, nothing stored).

**Market-review tools** (each ends with a quiet Mega Database rebuild where it writes workbooks)
- `/api/tools/review-update` run the Amazon review scraper (job events via `/api/jobs`); `/rating-only` scrape only the official star split; `/settings` save scraper config.
- `/api/tools/review-report` generate review report; `/api/tools/open-reports` open generated files locally; `/api/tools/find-user-voice` search review texts (voice_search), `/export` export hits.
- `/api/tools/chart-studio` generate chart page; `/pivot`, `/pivot-workbook` compute/write pivots; `/folder` open folder; `/config-table` chart config table.
- `/api/tools/daily-digest` build digest; `/coremail` open the digest in CoreMail (reuses cached `_DIGEST_STATE` HTML/subject/images; SendKeys/COM).
- `/api/tools/mega-database` rebuild archive workbook.
- `/api/tools/pqa-tracker` (+ `/workbooks`, `/overwrite`, `/writeback`, `/rows`, `/analyze`, `/publish`, `/detail`, `/use-shared-key`, `/taxonomy`, `/rewrite`) — PQA quality-event tracker: list workbooks, import/overwrite, write back, browse rows, AI analyze, publish, row detail, shared key, taxonomy edits, AI rewrite.
- `/api/tools/report-deck` generate an HTML report deck.
- `/api/tools/issue-workbench` issue-workbench actions (build/lock/parse); `/api/issue/save` `{project, annotation, locked?}` (+Mega refresh); `/api/issue/unlock` `{project, review_id}` (+Mega refresh); `/api/issue/customization/save` `{project, dictionary?, actions, rules}`.
- `/api/analysis/save` (UI overrides; `?project=` in query), `/api/analysis/summary/preview|section-suggest|save`, `/api/analysis/version/save`, `/api/analysis/snapshot`, `/api/snapshots/delete` `{token, note_id, product|task}`.
- `/api/after-sales/customize`, `/api/after-sales/task-values`, `/api/after-sales/team-suggest`.
- `/api/customize/<tab>` save tool-tab customization (demo-blocked).
- `/api/tools/xbuild/<action>` — xBuild Report actions: polish, check, outlook/email, view, preview, report save/build, yield targets, load.
- `/api/trend/products` `{products}`; `/api/trend/line-style` `{line}`.

**System**
- `/api/attach` — multipart upload (paste/drop); files land in `_work/evidence/<date>/`, generic clipboard names become `screenshot-YYYYMMDD-HHMMSS-xxxx.ext` (magic-sniffed ext); → `{ok, count, paths}` (workspace-relative). `mode=attach|evidence` accepted for compatibility.
- `/api/open` `{path}` — open a local file/folder with the OS.
- `/api/restart` — `{ok:true}`, then relaunches the same process with the same args (minus `--open`/`--rebuild-demo`).
- `/api/quit` — `{ok:true}`, then shuts the server down.

## 5. Data model

Data root: `ROOT` = parent of App; production `WORK = ROOT/Data`, `DATA = WORK/data` (modules refer to it as `_work/data`); demo swaps to `<demo>/_work`. Attachments `WORK/evidence/<date>/`. Queue snapshots `WORK/queue/<owner>.md` (steward.md, dispatcher.md, QA.md, worker-a.md…; auto-generated, fingerprinted, regenerated by a watcher thread and on every request via `refresh_queues`; never cleared if tasks.tsv reads empty mid-write). Log `WORK/LOG.md`. All stores are TSV with `\n` escaped as `\\n` so one record = one line (Excel-openable).

### tasks — `tasks.tsv`
`id, title, priority, status, due, owner, note, files, eta, parent`
- priority ∈ Highest, High, Medium, Low, Lowest.
- stored status ∈ To do, In progress, Waiting, Done. Shown status = 11 bug statuses via `task_details.workflow` (mapping `WORKFLOW_CLASS`: New/Triaged/Reopened/Deferred→To do; In progress→In progress; Fixed→Waiting; Verified/Closed/Duplicate/Wont fix/Rejected→Done). Board column = To Do/In Progress/In Review/Done (Waiting→In Review iff owner=QA, else flagged In Progress).
- type (in details) ∈ Task, Story, Epic, Sub-task, Bug, Improvement, After Sales Top Items, HVT/EVT/DVT/PVT Build Report Issue.
- owner ∈ Amara + live agent roles from `.github/agents/*.agent.md` (canonical: Steward, Dispatcher, QA, Worker A/B/C; merged roles stay valid on existing rows but are not offered for new work). Legacy "user"→Amara; Chinese legacy values migrated via `LEGACY` map.
- note carries QA marks: `[待核 date]` handed to QA, `[已核 date]` QA checked, `[免核 date]` waiver, `[驳回]` sent back, `[dropped` dropped row. QA-only statuses {Verified, Closed}; waiver statuses {Duplicate, Wont fix, Rejected} need who∈{Amara,QA,Steward}; reasons required for {Wont fix, Rejected, Deferred, Reopened}.
- Every save snapshots to `tasks_history/tasks-<timestamp>.tsv`.

### task_details — `task_details.tsv`
`task_id, key(T-n), type, severity, component, reporter, created, updated, found_in, fix_in, environment, description, repro, labels, duplicate_of, linked_task, resolution, links, workflow, product, issue, top_rank, progress_summary_en, progress_summary_zh, responsible_area, comment_ai_en, comment_ai_zh, comment_ai_kind, comment_ai_at, comment_ai_understanding_en, comment_ai_understanding_zh, comment_ai_progress_en, comment_ai_progress_zh, custom_assignees, custom_dispatch_rules, custom_eta_rule, custom_progress`

### task activity — `task_history.tsv` / `task_comments.tsv` (task_activity.py; append-only)
- history: `at, task_id, who, field, old, new`
- comments: `at, task_id, who, body, real`

### task_plan — `task_plan.tsv`: `task_id, project_id, module, start, end, depends_on, milestone, …`
### task_expectations — `task_expectations.tsv`: `task_id, expected, actual, status(待确认|确认), updated`
### task_approvals — `task_approvals.tsv`: `task_id, decision, by, at, fingerprint, comment` (Amara-only; stale when deliverable fingerprint changes)

### bugs — `bugs.tsv` (bug_tracker.FIELDS)
`id, key(WD-n), type, title, status, priority, severity, component, reporter, assignee, created, updated, due, found_in, fix_in, environment, description, repro, expected, actual, labels, duplicate_of, linked_task, resolution, links, note, files`
- TYPES: Bug, Improvement, Question. PRIORITIES: Highest…Lowest. SEVERITIES: S1 Blocker, S2 Critical, S3 Major, S4 Minor (SLA days 0/2/5/–). STATUSES: New, Triaged, In progress, Fixed, Verified, Closed, Reopened, Duplicate, Wont fix, Deferred, Rejected (OPEN = New/Triaged/In progress/Fixed/Reopened). COMPONENTS: work desk, inbox, bugs page, tasks page, overview, calendar, chat, settings, scraper, pipeline, report deck, chart studio, other. ROLES: Amara, Steward, Dispatcher, QA, Worker A, Worker B, Worker C.
- TRANSITIONS: New→[Triaged,Duplicate,Rejected,Deferred]; Triaged→[In progress,Duplicate,Rejected,Deferred,Wont fix]; In progress→[Fixed,Duplicate,Deferred,Wont fix]; Fixed→[Verified,Reopened]; Verified→[Closed,Reopened]; Closed→[Reopened]; Reopened→[Triaged,In progress,Fixed,Duplicate,Wont fix,Deferred]; Duplicate/Wont fix/Deferred/Rejected→[Reopened]. Gate: fixer may not verify own fix; only QA sets Verified. Status aliases accepted on read (To QA→Fixed, Open→New, Resolved→Verified, …). Writes are optimistic-locked (StaleError → HTTP 409). v1 14-column file auto-migrates.
- `bug_history.tsv`: `id, bug_id, at, who, field, old, new` (keep 40 shown); `bug_comments.tsv`: `id, bug_id, at, author, body`; snapshots in `bugs_history/`.

### events — `events.tsv`
`id, date, time, title, kind, note, end, link, repeat, until, remind, project_id, task_id`
- kind ∈ `schedule.KINDS` = Meeting, Reminder, Task, Deadline, Other.
- repeat ∈ empty/none/once, daily, weekdays, weekly(+weekday), monthly, yearly, `every:<n>:<d|w|m>`; `until` end date.
- remind ∈ none, 0, 5, 10, 15, 30, 60, 1440 minutes before.

### projects — `workspace_projects.tsv`
`id, key, name, description, owner, status, start, due, keywords, created, sort, archived, tab_order, …` (editable: name, key, description, owner, status, start, due, keywords; new rows status=Active).

### pages — `project_pages.tsv`
`page_id, rev, project_id, title, body, author, at` — latest row replaced on save; revision rows appended (version history, `?rev=` view, print/PDF/PNG export).

### ai_calls — `ai_calls.tsv` (inbox_ai.log_call)
`time, chars, placeholders, model, ok, detail` — one line per AI call; size and placeholders only, never content.

### Other stores
`notes.tsv` (legacy home notes), summary_store (product summaries, templates, figures, snapshots for the Analysis Report), `_internal/data/theme_config.json` (theme), `_internal/data/ai_pipeline.json` + `ai_pipeline_changes.tsv` (AI settings + change log), `_shared/supreme_secret.json` (API key/model/timeout), `_internal/data/polish_english.agent.md` (editable polish instructions), `_internal/data/voice_keyword_cache.json`.

## 6. Cross-cutting features

- **Theme (`theme_store.py`)**: 5 editable values `primary, radius_btn, radius_card, glass_opacity, enable_glass` → generated `:root` CSS tokens (primary + derived hover/soft shades, WCAG-aware text color, radii, glass) injected by `layout()` on every page plus `BINDINGS` style block; clamps radius 0–20/0–28 px, opacity 0.10–1.00; 6 preset palettes (see §3.15).
- **Create dialog (`create_dialog.py`)**: FAB on every page; three tabs:
  - **Task**: Title*, Type (TASK_TYPES, default Task), Project (default "(Dispatcher picks from the keywords)"), Priority (default Medium), Start, Due, Expected, Actual, draft checkbox ("saved as 待确认 until you confirm"), Description (paste images) → `/api/task/add`.
  - **Bug**: Title*, Type (default Bug), Severity* (default S3), Priority, Component, Found in, Description, Steps to reproduce*, Expected, Actual, Environment, Labels, Links, Reporter (default me), Assignee (default "(Dispatcher triages)"), Due, Linked task id, draft checkbox → `/api/bug/add`.
  - **Event**: What*, Date, Start/End time, Kind, Meeting link, Repeat (does not repeat/daily/weekdays/weekly+day chips/monthly/yearly), Until, Remind (default 5 min), Project, Task → `/api/event/add`.
  - Esc closes; paste uploads via `/api/attach`.
- **Home notes editor (`home_notes.py`)**: markdown editor used by Pages; toolbar, preview, AI polish, export, attachments (endpoints in §3.8).
- **Reminders (`reminder_ui.py`)**: browser notifications; **Enable reminders** button; polls `/api/reminders`.
- **Queues**: read-only per-owner markdown queue snapshots regenerated on every request + watcher thread; "Open queue file" on Team page.
- **Auto-dispatch (`auto_dispatch.py`)**: on task add (and sync/backfill) picks owner via settings dispatch rules (keyword/product/issue/severity/area → owner; first match wins; manual owner always wins; default owner fallback), recommends a model per agent, can pick a project from keywords.
- **Intake (`inbox_intake.py`/`inbox_ai.py`)**: parses pasted text into task candidates, loads agent defs from `.github/agents/*.agent.md` (owner list + display names + models; adding an agent file needs no code change), DEFAULT_OWNER = Dispatcher; module documents legacy `/api/inbox/*` routes (not wired in the current dispatcher).
- **AI features**: shared key/model/timeout in `_shared/supreme_secret.json` (supreme_ai); surfaces = Summary, Progress parsing, Comment analysis, Issue classification, Issue Benchmark, polish (notes/pages/xbuild), team suggestions, PQA analyze/rewrite, backfill; shared natural-language rule + primary/secondary language from settings; every call logged to `ai_calls.tsv`; suggestions are never auto-applied without the user posting/applying.
- **Market Review tool tabs (`tool_tabs.py`)**: Products (catalog via product_catalog_ui; product detail pages; `/api/products*`), Review Update (Amazon scraper runs w/ live job log via `/api/jobs`; rating-only mode; customize page), Find user voices (keyword-expanded review search with charts and export; voice_search), Daily Digest (HTML digest build + CoreMail hand-off), Issue Workbench (issue parsing/annotation/locking; dictionary customization; master export), PQA Tracker (quality-event workbook import/overwrite/writeback/analyze/publish/taxonomy/rewrite), Report Deck (HTML deck generation + viewer). All workbook writers finish with a quiet Mega Database rebuild (`/api/tools/mega-database` does it on demand).
- **xBuild Report (`xbuild_report.py`)**: two project tabs — **Rule Book** (`render_standard`) and **xBuild Report** (`render_report`) for build-phase reporting (HVT/EVT/DVT/PVT issue types exist as task types); customize page; `/api/tools/xbuild/*` actions (polish, check, outlook/email, view, preview, report, yield targets, load); example pages via GET `/api/tools/xbuild/example`.
- **Chart Studio**: §3.13; generated chart pages are self-contained HTML with palettes `a2, apple, ocean, sunset, candy, graphite`.
- **Markdown (`markdown_lite.py`)**: inline styles, lists, tables — used for pages/notes/guidance previews.
- **File serving security**: `/raw` workspace-only + extension allowlist; `/brand` fixed folder, plain names; uploads never leave the machine.

## 7. Acceptance checklist

### Shell / layout
- [x] Every page shows the sidebar with groups and links exactly as §1, in order.
- [ ] Sidebar Projects group lists every non-archived project as `KEY Name` linking to `/project/<name>`.
- [ ] Dragging a sidebar project link reorders projects and persists via `/api/projects/reorder`.
- [ ] `/tasks` nav link shows a badge with the count of In-progress tasks (hidden at 0).
- [x] Opening any `/settings*` page expands the six settings sub-links under Settings.
- [x] Sidebar folds via the fold button, state persists across pages (localStorage); pinned sidebar refuses to fold with a toast.
- [x] Folded sidebar shows a floating reopen button.
- [ ] Sidebar footer shows today's date and a **Stop server** button that POSTs `/api/quit` and stops the app.
- [ ] Every page polls `/api/rev` (~3 s) and reloads on data change, but never while the user is typing.
- [ ] Every page polls `/api/build` (~15 s) and reloads when the code build stamp changes.
- [x] Right-click context menu is disabled on every page.
- [ ] The ＋ create FAB is present on every page and opens the Create dialog; Esc closes it.
- [ ] `/go/T-5` redirects to that task; `/go/WD-3` redirects to that bug; unknown keys show a "Not found" page.
- [ ] Browser install prompt is captured; the Appearance page install button triggers it.
- [ ] Demo mode (`--demo`) shows a banner and blocks settings/customization writes.

### Create dialog
- [ ] Task tab creates a task with title/type/project/priority/start/due/expected/actual/draft/description via `/api/task/add` and returns the new key.
- [ ] Task created without owner goes to the dispatch default owner (Dispatcher) unless a rule matches.
- [ ] Bug tab requires Title, Severity, Steps to reproduce; posts `/api/bug/add`; new bug gets key WD-n and SLA due date from severity.
- [ ] Event tab creates an event with repeat and reminder options via `/api/event/add`.
- [ ] Pasting an image into a dialog textarea uploads it via `/api/attach` and references the saved path.

### Home
- [ ] Mini month calendar marks days with items; clicking a day opens `/calendar?m=YYYY-MM`.
- [ ] Agenda lists ≤6 upcoming entries merged from events, task dues, project dues, bug dues, plus ≤2 overdue entries.
- [ ] Agenda shows "Nothing due." when empty and a "more in the calendar" link when truncated.
- [ ] Clicking an agenda row opens a dialog with Open full page; Join meeting appears only for meeting links; Delete event only for real events and asks confirmation.
- [ ] Team-load card renders from `/api/team/load`.
- [ ] Rating-trend card renders from `/api/trend/live` and links to `/rating-trend`.
- [ ] Pareto card renders from `/api/pareto/live` and links to the Market Review Analysis Report tab.

### All work items (/tasks)
- [ ] Default view is List showing only open (not Done) rows; **All** shows everything.
- [ ] List shows columns Key, Summary, Project, Progress, Status, Assignee, Due, Priority, Severity, Component, Age, Actions.
- [ ] `q=` narrows by title, note, owner, id, key, component, description, module.
- [ ] Multi-select filters status/priority/owner/severity/component/module/project each narrow the list; explicit status filter overrides the open-only default.
- [ ] `sort=due|priority|key|smart` reorders rows; `reset=1` clears all filters.
- [ ] Rows link to `/task/<id>`; parent rows expand to show subtasks.
- [ ] Task statuses display as the 11-value workflow (New…Rejected), derived from stored 4-value status + details.workflow.
- [ ] Board view shows To Do / In Progress / In Review / Done; Waiting rows appear In Review only when owned by QA.
- [ ] Board card "Move to…" applies a transition via `/api/task/transition` respecting the transition map.
- [ ] Calendar view shows a month grid with Previous/This month/Next and counts open undated items.
- [ ] Timeline view draws dated bars with a today line and milestones.
- [ ] **Send to QA** on eligible rows sets Waiting/owner QA and stamps `[待核 date]` in the note.
- [ ] **Brief** copies a hand-off text to the clipboard.
- [ ] Board health lists Done rows lacking `[已核`/`[免核` marks (max 12).
- [ ] Board health "lost mark" rows offer **Restore mark** → `/api/task/restore`.
- [ ] Dropped rows (note contains `[dropped`) are reported as kept in tasks.tsv, not deleted.

### Task detail (/task/<id>)
- [ ] Title is editable inline and saves.
- [ ] Description/Steps/Expected/Actual blocks edit and save via `/api/task/field`.
- [ ] Ctrl+V pastes a screenshot into description/comment areas, uploading to `_work/evidence/<date>/`.
- [ ] Attachments can be added by drop/click/paste and removed via `/api/task/detach`.
- [ ] Workflow card only offers legal target statuses; illegal moves are refused with a reason.
- [ ] Verified/Closed can only be set by QA; Duplicate/Wont fix/Rejected require Amara/QA/Steward and record a waiver.
- [ ] Reason is required for Wont fix, Rejected, Deferred, Reopened.
- [ ] Owner change via assignee select (`/api/task/route`) records an activity line.
- [ ] Plan card saves project/module/start/end/depends_on/milestone (`/api/task/plan`).
- [ ] Expected/Actual confirmation: rows with both values show 确认, otherwise 待确认 (`/api/task/expect`).
- [ ] Comment box posts on Ctrl+Enter; comments appear in the feed with author and time.
- [ ] Comment **Analyze** returns an AI draft (`/api/task/comment/analyze`) that is only stored when posted.
- [ ] "Real progress update" checkbox routes through `/api/task/progress/parse` and can apply ETA/responsible-team values.
- [ ] Approve / Request changes stores an approval only for Amara, with deliverable fingerprint; approval goes stale when deliverables change.
- [ ] Subtasks section lists children; **New subtask** opens the create dialog with parent preset.
- [ ] **Schedule time for this** opens the create dialog Event tab linked to the task; linked events appear in the Scheduled section and in agent queue files.
- [ ] After Sales Top Items tasks show the Issue picker (product → issue), Top Issue order, and a link to `/after-sales/customize`.
- [ ] Done tasks and QA-owned tasks hide **Send to QA**.

### My work
- [ ] Shows Needs your decision / Blocked / Ready for review queues with counts.
- [ ] Each queue row shows task link, reason, next step, owner, due.
- [ ] Only 8 rows show by default; **Show all n** (`all=1`) expands.
- [ ] `project=` scopes all three queues.

### Projects
- [ ] Chips All / per-project / Archived (n) filter the view.
- [ ] Table shows Acronym, Project, Status, Start, Due, Open work items, Pages.
- [x] Open-items count links to the project's items tab pre-filtered to open board columns.
- [ ] Inline add row creates a project (`/api/project/add`).
- [x] Edit → Save updates name/key/description/owner/status/start/due/keywords (`/api/project/save`).
- [x] Archive asks confirmation; archived projects can be restored or (only then) deleted with confirmation.
- [x] Dragging table rows reorders projects persistently.
- [ ] "What got done, day by day" feed shows ≤14 dates, filterable by project chip; file chips open local paths via `/api/open`.

### Project page
- [ ] Route accepts project id or case-insensitive name; unknown → 404 "No such project."
- [ ] Every project shows Overview, Work items, Modules, Pages tabs; unknown tab falls back to Overview.
- [ ] Market Review project additionally shows Issue Review, Analysis Report, Products, Review Update, Find user voices, Daily Digest, Issue Workbench, PQA Tracker, Report Deck.
- [ ] Projects with key TAG additionally show Rule Book and xBuild Report tabs.
- [ ] Tabs can be reordered (double-click arm + drag, or Alt+arrows) and the order persists per project (`/api/project/tabs`).
- [ ] Edit-project disclosure saves fields via `/api/project/save`.
- [ ] Overview shows status donut, module bars, 14-day action chart, Coming up (≤8 items / 30 days) with Schedule button, pages list, daily record.
- [x] Work items tab reuses the full /tasks UI scoped to the project.
- [ ] Modules tab bars link into the items tab filtered by `module=`.
- [ ] Pages tab lists pages; New Page goes to the editor with the project preset; `page=`/`edit=1`/`new=1` redirects work.

### Calendar
- [ ] Month grid shows task deadlines, bug deadlines (when unfiltered), project dues, and events including repeats.
- [ ] A day shows ≤3 items plus `+n` overflow.
- [ ] Previous / This month / Next navigate months and keep the project filter.
- [ ] Project selector (`p=`) filters items and keeps the month.
- [ ] Next-seven-days agenda shows kind badges; Join opens meeting links; Delete removes events (confirm, repeat-aware wording).
- [ ] Enable reminders asks Notification permission; due reminders surface via `/api/reminders`.

### Pages
- [ ] /pages search by `q` matches title, body, tags; project filter narrows.
- [ ] New Page opens the editor; saving creates the page and navigates to it.
- [ ] Multi-select delete removes pages after confirmation.
- [ ] Page view renders markdown, shows author/date/projects/tags and the pages rail.
- [ ] Version selector shows prior revisions read-only (`?rev=`).
- [ ] Edit / Print / PDF / Image buttons work (print view, `/api/page/export` pdf/png).
- [ ] Editor live-previews markdown (`/api/page/preview`), polishes with AI (`/api/page/polish`), saves with revision history, blank title rejected.
- [ ] `/note/<id>` redirects to `/page/<id>`.

### Bugs
- [ ] /bugs shows open/total, waiting-for-QA, past-due counters.
- [ ] Filters q/status/severity/priority/component/assignee narrow the table; sort options smart/newest/oldest/severity/due/key work; reset clears.
- [ ] Table columns Key, Summary, Status, Assignee, Due, Priority, Severity, Component, Age; rows open `/bug/<id>`.
- [ ] /bugs/new auto-opens the bug form with `t/d/component/severity` prefills (severity default S3).
- [ ] New bug receives WD-n key and severity SLA due (S1 today, S2 +2d, S3 +5d, S4 none).
- [ ] Bug title and all detail fields edit inline via `/api/bug/update`; each change writes a history line (who/when/field/old/new).
- [ ] Concurrent edits are detected (stale write → 409, nothing written).
- [ ] Workflow move only offers transitions from the TRANSITIONS map; refused moves show a reason.
- [ ] A fixer cannot Verify their own fix; only QA can set Verified.
- [ ] Comments post via button or Ctrl+Enter and appear with author/time.
- [ ] Pasting a screenshot attaches evidence (`/api/attach` → `/api/bug/attach`); attachments render via `/raw`; detach works.
- [ ] Bug activity feed interleaves comments and field changes.
- [ ] Bugs-list delete control removes a bug (`/api/bug/delete`) while the detail page states bugs are never deleted.

### Team (/chat)
- [ ] Summary tiles show decisions pending, reviews ready, people working, open items, today's actions.
- [ ] Each agent card shows status, focus, workload, latest activity.
- [ ] Sending an order posts `{owner,text}` to `/api/team/order` and it appears in the open-orders list.
- [ ] Ticking an order closes it (`/api/team/order/close`); reopen endpoint restores it.
- [ ] Agent panel lists ≤12 owned rows linking to tasks, shows role description and base model.
- [ ] Copy brief copies the agent brief; Open queue file opens `_work/queue/<owner>.md`.
- [ ] Queue files regenerate automatically whenever tasks change and never go empty due to a mid-write read.

### Tools & Files (/files)
- [ ] Tabs Chart Studio and Agent Configuration switch via `?tab=`.
- [ ] Target-table dropdown lists known report workbooks; typing a path works too.
- [ ] Choosing a table loads its sheet list (`/api/tools/chart-studio/sheets`).
- [ ] Open chart page generates and opens an interactive chart HTML (`/api/tools/chart-studio` → `/api/tools/chart-studio/view`).
- [ ] Open chart folder opens the output folder locally.
- [ ] Chart page offers pivot building (`pivot-columns`, `pivot-values`, `pivot`, `pivot-workbook`) and the six palettes.
- [ ] Agent Configuration tab renders agent-file management (agent_config_page).

### Rating trend (/rating-trend)
- [ ] Full-page chart loads via `/api/trend/live` with product and day-window parameters.
- [ ] Choose products dialog saves the selection (`/api/trend/products`); Everything selects all.
- [ ] Smooth/straight line toggle persists (`/api/trend/line-style`).
- [ ] Copy image copies the chart.

### Settings
- [ ] /settings shows masked key, model, timeout; Test the key round-trips (`/api/settings/test`).
- [ ] Save writes connection then polish settings; demo mode blocks all four settings endpoints.
- [ ] Fill the gaps now runs AI backfill over tasks/bugs (`/api/backfill`).
- [ ] /settings/ai saves limits/toggles for Summary, Progress, Comment, Issue, Benchmark; Restore defaults works.
- [ ] /settings/language saves primary/secondary language and the natural-language rule; preview mirrors the textarea; applies to next AI call.
- [ ] /settings/snapshots lists snapshots per product or After Sales task with date range; Open opens the snapshot; Delete asks confirmation and removes only that snapshot.
- [ ] /settings/dispatch edits default owner and ordered condition rules (keyword/product/issue/severity/area → owner); first match wins; saved rules drive new-task dispatch.
- [ ] /settings/areas edits extra area names and the unknown-owner fallback (default NA).
- [ ] /settings/appearance live-previews primary color, radii, glass; presets apply palette colors; Save theme re-skins every page via :root tokens; Restore default look resets to #0071E3/8px/16px/0.25/on.
- [ ] Appearance page Install button installs the PWA when the browser allows.
- [ ] All settings pages show dirty-state text when edited and confirmation after save.

### Market Review tools
- [ ] Products tab lists the catalog; product rows open `/product/<name>` detail pages; products save via `/api/products*` and sync.
- [ ] Review Update runs the Amazon scraper with a live progress log (`/api/jobs` polling) and a rating-only mode; settings persist via its customize page.
- [ ] Find user voices searches review text with AI keyword expansion, shows hits/charts, exports results.
- [ ] Daily Digest generates a digest HTML, viewable via `/api/tools/daily-digest/view`, and can hand off to CoreMail reusing the exact generated body/subject/images.
- [ ] Issue Workbench parses and annotates reviews; annotations save with lock; unlock works; dictionary/actions/rules customization saves; master exports as XLSX.
- [ ] Analysis Report tab renders the grid (`/analysis/grid`), Pareto SVG, summary preview/suggest/save, version save, snapshot save; exports PDF and PPTX; print view works; Top Issues sync (`/api/analysis/topsync`) creates/aligns After Sales notes.
- [ ] PQA Tracker imports/overwrites from workbooks, browses rows, AI-analyzes, publishes, edits taxonomy, rewrites, uses shared key.
- [ ] Report Deck generates decks viewable via `/api/tools/report-deck/view`.
- [ ] Every workbook-writing tool triggers a Mega Database rebuild; `/api/tools/mega-database` rebuilds on demand.
- [ ] After Sales customization page saves global guidance/teams/ETA-rule/AI-input limits and per-task values; AI team suggestion works.
- [ ] xBuild tabs (Rule Book, xBuild Report) render on the TAG project; xBuild actions (polish/check/preview/report/yield/email) respond under `/api/tools/xbuild/*`; example page serves via GET.

### System behaviors
- [ ] `/api/attach` stores pasted/dropped files under `_work/evidence/<date>/`, renames generic clipboard names to timestamped screenshots, dedupes filenames, returns workspace-relative paths.
- [ ] `/raw?p=` serves only workspace-internal files with allowed extensions; path traversal is rejected.
- [ ] `/brand/<name>` serves only plain-named brand assets of allowed types.
- [ ] `/api/open` opens local files/folders with the OS.
- [ ] `/api/restart` relaunches the server process with the same arguments.
- [ ] Tasks, bugs, history, comments are append-preserving: task saves snapshot to tasks_history/, bug saves snapshot to bugs_history/, activity files are append-only, dropped tasks stay in the file.
- [ ] Legacy values (Chinese words, "user", old status words, v1 bug columns) are migrated/aliased on read, never crash.
- [ ] 500 errors on page rendering state that data files were not touched.
- [ ] Every AI call appends a line to ai_calls.tsv (time, chars, placeholders, model, ok, detail) without content.
- [ ] AI readiness and the key-file path are printed at startup.
- [ ] Port conflict with a foreign Work Desk shows an error dialog; same-install reuses the running instance (`--open` just opens the browser).

## 8. Unresolved / low-confidence areas

1. **Deep tool internals** — exact field-level UI of Issue Workbench, PQA Tracker, Report Deck, Daily Digest, Review Update pages (tool_tabs.py is 146 KB) and xbuild_report.py (241 KB) were summarized from entry points, route lists, and renderer names rather than a full walk; a rebuild should treat §4's endpoint contracts as authoritative and re-derive each tab's internal controls from those modules.
2. `/api/tools/*` POST parameter schemas were catalogued by effect; some individual JSON key names (e.g. pqa-tracker sub-route payloads) were not enumerated field-by-field.
3. `notes.tsv` legacy schema, full `workspace_projects.tsv`/`task_plan.tsv` trailing columns, and summary_store's internal JSON schema were not fully captured.
4. Agent Configuration tab (`agent_config_page.py`) controls, `product_detail_page.py`/`product_catalog_ui.py` layouts, and `rating_trend_live.py` internals were only summarized.
5. The Team page UI hook for `/api/team/order/reopen` was not located (endpoint exists).
6. `env_badge_html` content (environment pill wording) and `runtime_identity.py` details were not expanded.
