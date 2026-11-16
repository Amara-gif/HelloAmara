# My Platform — Task backlog

Ordered for DeepSeek Harness (dsh) one-session work. Each task should leave the app runnable
and be verifiable without later tasks.

Rules for implementers:

- Product name in UI/docs: **My Platform**. Do not call the app WorkDesk.
- Static SPA only. Data in IndexedDB / LocalStorage. No backend DB, no CDN scripts/fonts/images.
- Styles: only `assets/css/tokens.css` + `assets/css/components.css`. No inline `style=` (except
  unavoidable chart SVG internals already owned by `chart.js`). New components on
  `styleguide.html` in the same change. Run `node scripts/check-styles.mjs` when styles change.
- Phone: fresh responsive layout (drawer, stacked cards, ≥44 px). Do not copy broken narrow
  screenshots in `docs/Screen/`.
- Do **not** enable GitHub Pages, deploy, publish, spend money, delete remote data, or build P6
  scraper work.
- Tick matching boxes in `docs/FEATURE-INVENTORY.md` §7 when a task truly completes them.
- Update the matching row in `docs/PROGRESS.md` when a screen moves from partial → done.

Suggested branch pattern: `task/<nn>-<slug>`.

---

## 1. `idb-crud-tests`

**Title:** Add fake-IndexedDB CRUD and schema smoke tests  
**Branch:** `task/01-idb-crud-tests`  
**Context:** P1 accept criteria require CRUD round trips and a schema upgrade test. `db.js` /
`data.js` exist but there are zero automated tests.  
**Likely files:** `scripts/` or `tests/` (new), `assets/js/db.js`, `package.json` (only if a
tiny test runner is already acceptable without a build step — prefer `node --test` + fake-indexeddb).  
**Depends on:** none  

**Acceptance:**

- [ ] Node-runnable tests open a temp DB, `put`/`get`/`getAll`/`clear` for each store in `db.js`
- [ ] Soft-delete filter behaviour documented or tested via `data.js` helpers (live rows only)
- [ ] A schema upgrade smoke test opens version N then N+1 (or documents version 1 create path
      and fails if stores are missing)
- [ ] `node` test command documented in README or script comment; all new tests pass
- [ ] No HTML/CSS regressions; app still boots with Test account

---

## 2. `storage-persist-meta`

**Title:** Request persistent storage and show grant status  
**Branch:** `task/02-storage-persist-meta`  
**Context:** BRIEF §2 requires `navigator.storage.persist()` and showing whether it was granted.  
**Likely files:** `assets/js/data.js`, `assets/js/db.js`, `assets/js/views.js` (settings or
sidebar note), `index.html` (only if a status node is needed)  
**Depends on:** none  

**Acceptance:**

- [ ] On account boot, app calls `navigator.storage.persist()` when available and stores the
      boolean in `meta`
- [ ] Settings (or sidebar note) shows Granted / Denied / Unsupported for the active account
- [ ] Works offline after first load (no network dependency)
- [ ] Manual: open Test account, confirm status text visible

---

## 3. `nav-badge-always`

**Title:** Keep In-progress task badge updated on every route  
**Branch:** `task/03-nav-badge-always`  
**Context:** Badge exists but `updateNav` only refreshes it on tasks routes.  
**Likely files:** `assets/js/app.js`  
**Depends on:** none  

**Acceptance:**

- [ ] After render on Home (and any route), badge shows count of `status === 'In progress'`
- [ ] Badge hidden when count is 0
- [ ] Creating/moving a task to In progress then navigating away still shows the count
- [ ] Manual: Test account → note badge → open `#/tasks` → Send to QA / Move → navigate Home → badge matches

---

## 4. `go-key-redirects`

**Title:** Add `#/go/T-n` and `#/go/WD-n` key redirects  
**Branch:** `task/04-go-key-redirects`  
**Context:** Inventory §7 shell — readable keys jump to task/bug detail or Not found.  
**Likely files:** `assets/js/routes.js`, `assets/js/app.js`, `assets/js/views.js`  
**Depends on:** none  

**Acceptance:**

- [ ] `#/go/T-1` (demo) lands on that task’s detail
- [ ] `#/go/WD-1` lands on that bug’s detail
- [ ] Unknown key shows the existing Not found page with a Home link
- [ ] Case-insensitive key match for the letter prefix

---

## 5. `sidebar-fold-desktop`

**Title:** Desktop sidebar fold/pin with localStorage  
**Branch:** `task/05-sidebar-fold-desktop`  
**Context:** Inventory fold/pin; phone already uses drawer — fold is desktop-only. No Stop server.  
**Likely files:** `assets/js/app.js`, `assets/css/components.css`, `index.html`, `styleguide.html`  
**Depends on:** none  

**Acceptance:**

- [ ] Fold control collapses desktop sidebar; state persists in `localStorage`
- [ ] Pin prevents fold and shows a toast if the user tries to fold while pinned
- [ ] Folded desktop shows a floating reopen control
- [ ] Drawer behaviour below 900 px unchanged
- [ ] `node scripts/check-styles.mjs` passes
- [ ] New controls appear on `styleguide.html` if new component classes are introduced

---

## 6. `create-dialog-polish`

**Title:** Align Create dialog fields with inventory Task/Bug/Event tabs  
**Branch:** `task/06-create-dialog-polish`  
**Context:** FAB create works but omits several inventory fields (start, draft, event repeat…).  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Task tab: title*, type, project, priority, start, due, expected, actual, description
- [ ] Bug tab: title*, severity*, steps*, priority, component, description (at minimum)
- [ ] Event tab: what*, date, time, kind, link, repeat select (persist `repeat` field), remind, project
- [ ] Esc / Cancel closes without write; successful create navigates or toasts with new key
- [ ] Manual: create one of each on Test account; reload; rows still present

---

## 7. `home-agenda-interactions`

**Title:** Home mini-calendar clicks and agenda row dialog  
**Branch:** `task/07-home-agenda-interactions`  
**Context:** `01-home.png` / inventory §3.1 — days and agenda rows need interactions.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/ui.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Clicking a marked (or any) mini-calendar day navigates to `#/calendar?m=YYYY-MM`
- [ ] Agenda lists ≤6 upcoming + ≤2 overdue; empty copy “Nothing due.”
- [ ] Truncation shows a “more in the calendar” link to `#/calendar`
- [ ] Agenda row opens a dialog: kind, title, Open full page; Join only for http(s) meeting links;
      Delete only for real events (confirm → soft-delete)
- [ ] Manual: Test account Home at 1280 px matches section order of the reference

---

## 8. `home-charts-team-pareto`

**Title:** Home team-load chart and Pareto from issue-like data  
**Branch:** `task/08-home-charts-team-pareto`  
**Context:** Team load and Pareto cards should use `chart.js` meaningfully (not only bug components).  
**Likely files:** `assets/js/views.js`, `assets/js/chart.js`, `assets/js/demo-data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Team-load card renders a bar or donut via `chart.js` from open tasks (+ open orders)
- [ ] Pareto card uses ordered categories from demo/meta issue counts (or task titles/modules),
      with cumulative line if `renderParetoChart` supports it
- [ ] Rating-trend card still links to `#/rating-trend`
- [ ] Pareto link goes to `#/project/MR` (or Analysis placeholder route if added later)
- [ ] Manual: charts visible on Home with Test account; no CDN requests

---

## 9. `mywork-queue-rules`

**Title:** My work queues match inventory rules and project scope  
**Branch:** `task/09-mywork-queue-rules`  
**Context:** `02-mywork.png` — tighten queue membership and `project=` / `all=1`.  
**Likely files:** `assets/js/views.js`, `assets/js/data.js` (helpers only if needed)  
**Depends on:** none  

**Acceptance:**

- [ ] Needs decision: open tasks whose notes contain `[待确认]` or `pendingDecision`
- [ ] Blocked: waiting without QA hand-over (or depends-on unfinished) per inventory wording
- [ ] Ready for review: Done / QA-checked and not yet reviewed
- [ ] Each row shows link, reason, next step, owner, due
- [ ] Default 8 rows; Show all uses `all=1`; `project=<id>` scopes all three queues
- [ ] Manual: compare counts with Test demo rows

---

## 10. `tasks-list-filters`

**Title:** Complete All work items list filters and subtask expand  
**Branch:** `task/10-tasks-list-filters`  
**Context:** `05`/`06` screens — list is close; filters and parents incomplete.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Default scope open (not Done); All shows everything; Reset clears filters
- [ ] Filters: status (workflow), priority, owner, severity, component, module, project, `q`
- [ ] Sort: smart | due | priority | key
- [ ] Parent rows expand/collapse to show subtasks; row links to `#/task/:id`
- [ ] Progress column shows notes/progress text when present
- [ ] Manual: `#/tasks` and `#/tasks?scope=all` against demo data

---

## 11. `tasks-board-health`

**Title:** Board Send-to-QA and board health disclosure  
**Branch:** `task/11-tasks-board-health`  
**Context:** `21-tasks-board.png` + inventory board health.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Board columns To Do / In Progress / In Review / Done
- [ ] Waiting → In Review only when owner is QA (canonical QA role/name from team demo);
      otherwise flagged In Progress
- [ ] Cards expose Move to… and conditional Send to QA
- [ ] Board health disclosure when problems exist: Done without `[已核`/`[免核` (max 12);
      lost hand-over marks with Restore action writing the mark back
- [ ] Manual: `#/tasks?view=board` with Test account

---

## 12. `tasks-calendar-timeline`

**Title:** Implement tasks Calendar and Timeline views  
**Branch:** `task/12-tasks-calendar-timeline`  
**Context:** Tabs exist but render placeholders.  
**Likely files:** `assets/js/views.js`, `assets/css/components.css`, `styleguide.html`  
**Depends on:** 10 (filters shared) — soft; can reuse `filterTasks`  

**Acceptance:**

- [ ] Calendar view: month grid, Prev/This/Next, task links, count of open undated items
- [ ] Timeline view: dated bars, today line, milestone marks when present, undated count
- [ ] Same filter query params preserved when switching views
- [ ] `node scripts/check-styles.mjs` passes if CSS added
- [ ] New timeline/calendar task widgets documented on styleguide if new classes appear

---

## 13. `task-detail-inline-edit`

**Title:** Task detail inline field edits and Plan card  
**Branch:** `task/13-task-detail-inline-edit`  
**Context:** `12-task-detail.png` — sections exist but are read-only.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Title, Description, Steps/repro, Expected, Actual editable and saved via `updateTask`
      with history lines
- [ ] Details side fields (assignee, priority, severity, type, component, module, due, start)
      save on change or explicit Save
- [ ] Plan card: project, module, start, end, depends_on, milestone persisted on the task record
- [ ] Manual: edit T-1, reload, values persist; history feed shows field changes

---

## 14. `task-detail-workflow-gates`

**Title:** Task workflow 11-status transitions and review fingerprint  
**Branch:** `task/14-task-detail-workflow-gates`  
**Context:** Inventory workflow machine; current select only uses 4 stored statuses.  
**Likely files:** `assets/js/data.js` (transition helper), `assets/js/views.js`, `assets/js/app.js`  
**Depends on:** 13 helpful but not required  

**Acceptance:**

- [ ] Workflow Move to offers only legal targets from stored status + workflow map
- [ ] Verified/Closed require acting as QA; waiver statuses require Amara/QA/Steward + reason
      where inventory requires it
- [ ] Illegal moves toast a clear reason and write nothing
- [ ] Approve / Request changes stores decision; mark stale if attachments list changes
- [ ] Ctrl+Enter posts comment from `#tskComment` (or equivalent)

---

## 15. `task-detail-links-subtasks`

**Title:** Subtasks, depends-on, schedule presets, pages mentioning  
**Branch:** `task/15-task-detail-links-subtasks`  
**Context:** Finish remaining task-detail sections from inventory §3.3.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`  
**Depends on:** 6 (create dialog presets)  

**Acceptance:**

- [ ] New subtask opens Create dialog with parent preset and creates with `parentId`
- [ ] Depends on list editable (ids or keys) and shown
- [ ] Schedule time for this opens Create Event tab with `taskId` preset
- [ ] Pages mentioning this task listed with links
- [ ] Manual: from a task with children in demo, verify lists; create one subtask

---

## 16. `calendar-repeats-reminders`

**Title:** Expand event repeats and reminder polling  
**Branch:** `task/16-calendar-repeats-reminders`  
**Context:** `07-calendar.png` — events store `repeat` but grid does not expand occurrences.  
**Likely files:** `assets/js/views.js`, `assets/js/data.js` or new `assets/js/schedule.js`, `assets/js/app.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Daily / weekdays / weekly / monthly occurrences appear on the month grid within the
      visible month (`until` respected)
- [ ] Next-seven agenda includes expanded occurrences
- [ ] Enable reminders requests permission; a lightweight timer checks due reminders for the
      next hour and can `new Notification(...)` when granted (no server)
- [ ] Delete event confirms; soft-deletes series id
- [ ] Manual: weekly demo events appear on multiple days

---

## 17. `projects-inline-edit-reorder`

**Title:** Projects inline edit, drag reorder, archived delete  
**Branch:** `task/17-projects-inline-edit-reorder`  
**Context:** `04-projects.png`.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Edit → inline fields → Save/Cancel updates name/key/description/owner/status/start/due/keywords
- [ ] Archive confirm; Restore; Delete only when archived (confirm) soft-deletes
- [ ] Drag reorder persists `sort` and updates sidebar project order
- [ ] Open-items count links to `#/project/<key>?tab=work` with open filter when practical
- [ ] Manual: reorder two projects, reload, order kept

---

## 18. `project-overview-modules`

**Title:** Project Overview charts, Modules tab, Edit project  
**Branch:** `task/18-project-overview-modules`  
**Context:** `14`/`15` overview gaps; Modules tab currently ignored.  
**Likely files:** `assets/js/views.js`, `assets/js/chart.js`, `assets/js/app.js`  
**Depends on:** none  

**Acceptance:**

- [ ] `?tab=modules` renders module done/total bars; clicking a module filters Work items
- [ ] Overview: status donut or equivalent via `chart.js`, Coming up (≤8 / 30 days) + Schedule
      (opens Create Event with project preset), pages list, placeholder daily record from
      history/comments when available
- [ ] Edit project disclosure saves via `updateProject`
- [ ] Unknown project key → Not found “Project not found”
- [ ] Manual: `#/project/TAG` and `#/project/MR` Overview + Modules

---

## 19. `project-work-tab-parity`

**Title:** Project Work items tab reuses full tasks UI  
**Branch:** `task/19-project-work-tab-parity`  
**Context:** Inventory — project Work items should reuse list/board/calendar/timeline + filters.  
**Likely files:** `assets/js/views.js`  
**Depends on:** 10, 11, 12 (can ship list-only first if deps incomplete — then note partial)  

**Acceptance:**

- [ ] Project `tab=work` embeds the same toolbar/views as `#/tasks` scoped to `projectId`
- [ ] View/filter query params preserved with `tab=work`
- [ ] Manual: from `#/project/RSL?tab=work` only Roselite tasks appear

---

## 20. `pages-multiselect-view`

**Title:** Pages multi-select delete and richer page view  
**Branch:** `task/20-pages-multiselect-view`  
**Context:** `03-pages.png`, page view rail.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Select all + per-row checkboxes; Delete selected confirms then soft-deletes
- [ ] Page view shows author/date/project/tags (tags field optional), markdown body, Edit/Print
- [ ] Print uses `window.print` with a print-friendly class (no new CSS file)
- [ ] `/note/:id` hash alias redirects to `/page/:id` if easy in the router
- [ ] Manual: delete one page on a throwaway account or soft-delete then reset demo

---

## 21. `page-editor-preview`

**Title:** Page editor preview and revision history  
**Branch:** `task/21-page-editor-preview`  
**Context:** `20-page-editor.png` without requiring AI polish.  
**Likely files:** `assets/js/views.js`, `assets/js/data.js`, `assets/css/components.css`, `styleguide.html`  
**Depends on:** 20 helpful  

**Acceptance:**

- [ ] Editor shows live markdown preview beside or below the textarea
- [ ] Blank title rejected client-side
- [ ] Save appends a revision snapshot (store field or `pages` history rows) so view can pick
      `?rev=`
- [ ] Older rev is read-only
- [ ] AI Polish button may toast “not connected” — do not call external AI
- [ ] `node scripts/check-styles.mjs` passes if CSS added

---

## 22. `bugs-list-complete`

**Title:** Bugs list sorts, multi-delete, full columns  
**Branch:** `task/22-bugs-list-complete`  
**Context:** `08-bugs.png`.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Columns: Key, Summary, Status, Assignee, Due, Priority, Severity, Component, Age
- [ ] Filters: q, status, severity, priority, component, assignee; sort smart/newest/oldest/severity/due/key; Reset
- [ ] Multi-select delete from list (detail page still states bugs are never deleted — list
      delete may soft-delete or hide; document choice in PROGRESS)
- [ ] Counters: open/total, waiting for QA (Fixed), past due
- [ ] Manual: `#/bugs` with Test account

---

## 23. `bugs-new-prefill`

**Title:** Report-a-bug route opens Create Bug tab with prefills  
**Branch:** `task/23-bugs-new-prefill`  
**Context:** `16-bugs-new.png` — inventory wants Create dialog auto-open.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/routes.js`  
**Depends on:** 6  

**Acceptance:**

- [ ] `#/bugs/new` shows short page with Open the bug form + Back to Bugs
- [ ] On load, Create dialog opens on Bug tab
- [ ] Query prefills: `t` title, `d` description, `component`, `severity` (default S3)
- [ ] Create assigns `WD-n` and SLA due (S1 today, S2 +2d, S3 +5d, S4 none)

---

## 24. `bug-detail-workflow`

**Title:** Bug detail inline edits and TRANSITIONS gates  
**Branch:** `task/24-bug-detail-workflow`  
**Context:** `13-bug-detail.png`.  
**Likely files:** `assets/js/data.js`, `assets/js/views.js`, `assets/js/app.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Title + description/repro/expected/actual/environment inline save with history
- [ ] Details fields editable; created/updated/id read-only
- [ ] Move to only lists TRANSITIONS targets; fixer cannot Verify own fix; only QA → Verified
- [ ] Reason required for Wont fix / Rejected / Deferred / Reopened as per inventory
- [ ] Comments via button or Ctrl+Enter; feed interleaves comments + history
- [ ] Manual: try illegal transition → toast, no write

---

## 25. `team-page-polish`

**Title:** Team page lead strip, copy brief, reopen orders  
**Branch:** `task/25-team-page-polish`  
**Context:** `09-chat.png`.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Lead summary strip (Amara) + five stat tiles match inventory labels
- [ ] Each agent card: status, focus, workload counts, latest activity, order composer, To-do
- [ ] Copy brief copies a text brief to clipboard
- [ ] Close and Reopen order actions work (reopen restores `open: true`)
- [ ] Open queue file shows a clear “not available in browser” toast (no fake success)
- [ ] Manual: send order, close, reopen on Test account

---

## 26. `settings-forms-depth`

**Title:** Deepen Settings AI / language / dispatch / areas / snapshots  
**Branch:** `task/26-settings-forms-depth`  
**Context:** `11`, `17` and sibling settings routes.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/demo-data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Shared dirty-state text + Save confirmation pattern on settings pages
- [ ] `/settings/ai` sectioned limits + Restore defaults
- [ ] Language: primary/secondary + rule + preview note
- [ ] Dispatch: default owner + add/remove rules (keyword → owner); first match documented
- [ ] Areas: chip/list add-remove + fallback
- [ ] Snapshots: list Snapshot pages with Open + Delete confirm
- [ ] Test key / Fill gaps remain local toasts unless owner later allows network AI
- [ ] Manual: change a rule, reload, value persists in account DB

---

## 27. `settings-appearance-presets`

**Title:** Appearance presets, live preview, apply radius/glass tokens  
**Branch:** `task/27-settings-appearance-presets`  
**Context:** `18-settings-appearance.png`. Install button deferred to P5 task.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/css/tokens.css` (only if new
vars), `assets/css/components.css`, `styleguide.html`  
**Depends on:** none  

**Acceptance:**

- [ ] Six palette presets set primary (and related) tokens
- [ ] Live preview strip: Primary / Secondary / Selected chip
- [ ] Button/card radius and glass opacity apply via CSS variables on `:root`
- [ ] Save theme / Restore default look persist in settings meta
- [ ] `node scripts/check-styles.mjs` passes
- [ ] Install-as-app control may be disabled with “Coming with PWA” note (do not fake install)

---

## 28. `rating-trend-controls`

**Title:** Rating trend product picker, line style, copy image  
**Branch:** `task/28-rating-trend-controls`  
**Context:** `19-rating-trend.png`. Data stays local in `meta.ratings`.  
**Likely files:** `assets/js/views.js`, `assets/js/app.js`, `assets/js/chart.js`, `assets/js/data.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Choose products dialog: toggle series, Everything, Save to meta
- [ ] Smooth curve / Straight line toggles affect renderer and persist preference
- [ ] Copy image copies SVG or canvas PNG to clipboard when the browser allows (else toast)
- [ ] Back to Home link present
- [ ] Manual: hide one product, reload, chart respects selection

---

## 29. `files-chart-studio-local`

**Title:** Browser-safe Chart Studio using local table data  
**Branch:** `task/29-files-chart-studio-local`  
**Context:** `10-files.png` — replace OS paths with in-browser datasets (tasks/bugs counts).  
**Likely files:** `assets/js/views.js`, `assets/js/chart.js`  
**Depends on:** none  

**Acceptance:**

- [ ] Target table dropdown lists local datasets (e.g. Work items by status, Bugs by severity)
- [ ] Open chart page renders an interactive/filterable chart via `chart.js` in-page
- [ ] Open chart folder remains an honest unavailable toast
- [ ] Agent Configuration tab lists team agents (read-only is OK)
- [ ] Manual: `#/files` and `#/files?tab=agents`

---

## 30. `export-json`

**Title:** Export all stores as one JSON backup file  
**Branch:** `task/30-export-json`  
**Context:** P4 start — BRIEF §4 export half.  
**Likely files:** `assets/js/data.js`, `assets/js/views.js` (settings or tools entry), `assets/js/app.js`  
**Depends on:** 2 helpful  

**Acceptance:**

- [ ] Export downloads JSON with `schemaVersion`, `exportedAt`, `deviceId`, and all stores
- [ ] Entry point reachable from Settings or sidebar note (“Export a file”)
- [ ] After export, `meta.lastExportAt` updates
- [ ] Reminder banner or note when last export older than 7 days (Home or Settings)
- [ ] Manual: export from Test account; file opens as JSON; no network upload

---

## 31. `import-json-merge`

**Title:** Import JSON with validation, merge, and summary confirm  
**Branch:** `task/31-import-json-merge`  
**Context:** P4 import half.  
**Likely files:** `assets/js/data.js`, `assets/js/views.js`, `assets/js/app.js`  
**Depends on:** 30  

**Acceptance:**

- [ ] File picker accepts JSON; invalid schema/structure rejected with a clear message
- [ ] Confirm dialog shows added / updated / skipped counts before write
- [ ] Merge by `id` with newer `updatedAt` wins; soft-deleted handling documented
- [ ] Never silent overwrite of the whole DB without an explicit “replace all” choice
- [ ] Manual: export A → create empty account → import → row counts match; corrupt file rejected

---

## 32. `phone-layout-polish`

**Title:** Phone layout audit for stacked cards and 44 px targets  
**Branch:** `task/32-phone-layout-polish`  
**Context:** BRIEF §5; narrow screenshots are not the layout. Drawer already exists.  
**Likely files:** `assets/css/components.css`, `styleguide.html`, possibly `views.js` wrappers  
**Depends on:** none (run after major screen work if conflicts arise)  

**Acceptance:**

- [ ] At 360 and 390 px: Home, Tasks, Bugs, Task detail usable without horizontal page scroll
- [ ] Tables use stacked card rows; detail side columns stack
- [ ] Interactive controls ≥ 44×44 px (`--tap-size`)
- [ ] Drawer still inert when closed; FAB does not block primary actions
- [ ] `node scripts/check-styles.mjs` passes
- [ ] Manual screenshots optional under `docs/evidence/` (do not commit binary noise unless asked)

---

## 33. `pwa-manifest-sw`

**Title:** Add manifest + service worker offline shell  
**Branch:** `task/33-pwa-manifest-sw`  
**Context:** P5 — offline after first load; update prompt later can be minimal.  
**Likely files:** `manifest.webmanifest` (or under `assets/`), `sw.js`, `index.html`, Appearance
install button wiring  
**Depends on:** 27 for install button placement  

**Acceptance:**

- [ ] Manifest name/short_name **My Platform**; icons self-hosted
- [ ] Service worker caches app shell (HTML/CSS/JS); no third-party URLs
- [ ] After first load, DevTools Offline still opens the shell and reads IndexedDB data
- [ ] New version sets a “New version available, reload” affordance when SW updates
- [ ] Appearance Install button uses `beforeinstallprompt` when available
- [ ] Manual: installability check in Chromium; data intact across reload

---

## 34. `attachments-local-blobs`

**Title:** Local attachment blobs for tasks and bugs  
**Branch:** `task/34-attachments-local-blobs`  
**Context:** Inventory paste/drop attachments without a server — store in IndexedDB.  
**Likely files:** `assets/js/db.js` (blob store or embed), `assets/js/data.js`, `assets/js/views.js`,
`assets/js/app.js`  
**Depends on:** 13 or 24 for detail pages  

**Acceptance:**

- [ ] New object store or record field holds attachment metadata + blob/object URL strategy
- [ ] Drop/click/paste on task and bug detail adds an attachment; Remove soft-detaches
- [ ] Attachments survive reload for the account; never uploaded to a server
- [ ] Manual: paste a small PNG into a bug description area or drop zone; reload; still listed
- [ ] If paste-into-textarea is too large for one session, drop zone alone is acceptable if
      documented in PROGRESS

---

## 35. `tag-project-stub-tabs`

**Title:** TAG project Rule Book / xBuild placeholder tabs (no scraper)  
**Branch:** `task/35-tag-project-stub-tabs`  
**Context:** `14-project-hello-amara.png` shows Rule Book + xBuild. Keep local-only stubs;
do not build Amazon scraper or Outlook automation.  
**Likely files:** `assets/js/views.js`  
**Depends on:** 18  

**Acceptance:**

- [ ] For project key `TAG`, tabs include Rule Book and xBuild Report
- [ ] Each tab shows an honest local placeholder (markdown page list or “not ported” copy)
      without broken API calls
- [ ] Other projects do not show these tabs
- [ ] Manual: `#/project/TAG` tab strip matches reference names

---

## 36. `mr-project-local-tabs`

**Title:** Market Review local-only tool tab shells (no P6)  
**Branch:** `task/36-mr-project-local-tabs`  
**Context:** `15-project-market-review.png`. Add navigable tab shells that use local data only.
Scraper / Mega Database / CoreMail remain out of scope.  
**Likely files:** `assets/js/views.js`, `assets/js/demo-data.js`  
**Depends on:** 18  

**Acceptance:**

- [ ] MR project shows extra tabs: Products, Issue Review, Analysis Report (minimum set);
      others may be “Not available in My Platform yet”
- [ ] Products / Issue Review / Analysis use local demo lists or charts — no network fetch
- [ ] Review Update tab explicitly states scraper blocked on owner decision (no fake run)
- [ ] Manual: `#/project/MR` overview + at least one tool tab renders without console errors

---

## 37. `progress-checklist-sync`

**Title:** Sync FEATURE-INVENTORY checklist and PROGRESS screen table  
**Branch:** `task/37-progress-checklist-sync`  
**Context:** After a batch of tasks merges, documentation drifts.  
**Likely files:** `docs/FEATURE-INVENTORY.md`, `docs/PROGRESS.md`  
**Depends on:** whenever a cluster of tasks completes  

**Acceptance:**

- [ ] Every newly true checklist item is marked `[x]` with no false positives
- [ ] Per-screen table statuses updated (partial → done where earned)
- [ ] Phase status table reflects P1–P5 reality
- [ ] No application code changes in this task

---

## Explicitly excluded (do not implement here)

- Enabling GitHub Pages / deploy / publish / GitHub Actions spend
- P6 Amazon scraper, proxy purchase, Mega Database Excel pipelines, CoreMail SendKeys
- Windows `/api/open`, `/api/quit`, `/api/restart`, COM/Excel automation
- Deleting production or owner data outside the active browser account’s soft-delete UX
