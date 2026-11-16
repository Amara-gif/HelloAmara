# My Platform — Rebuild Brief v2 (local-first)

**Product name: "My Platform".** Use this name everywhere: repo description, page titles,
PWA manifest name, UI header, docs. Never call the new app "WorkDesk"; that name refers
only to the old local app being replaced.

Supersedes `WORKDESK-REBUILD-BRIEF.md`. Where the two disagree, this file wins.
Sections 4 (route map), 6 (design tokens) and the page references in the old brief still
describe the UI and remain valid. Reuse them; do not re-invent the layout.

## 1. Non-negotiable rules (from the owner)

0. **The product is named "My Platform"** in all user-visible text and metadata.
1. **No `.exe` or any installer on any computer**, owner's or customer's.
2. **User data lives only on the user's own device.** It is never sent to any server
   and the server has no database for it. Not even for backup.
3. **The server only hosts static files** (HTML, CSS, JS, images) over HTTPS. It serves the
   same code to everyone.
4. **No accounts are required for data.** Whoever opens the app on a device owns the data on
   that device. Any login used later must not be tied to stored user data.
5. **Phone data stays on the phone.** Phone and PC data are separate. Sync is manual, by
   export and import files.
6. The app must work with no network after the first load.

## 2. Architecture

```
GitHub Pages (HTTPS)                -> static files only: index.html, /assets/*.js|css, manifest, sw.js
Browser on PC (Edge/Chrome)         -> app runs here; data in IndexedDB (this browser profile)
Browser on phone (Safari/Chrome)    -> same URL; data in IndexedDB on the phone
Export/Import file (.json)          -> the only way to move data between devices
```

- Client: static single-page app. Plain JS modules or a small framework; no build step required
  for the first version if it stays simple. Pick one and document it in `docs/PROGRESS.md`.
- Storage: IndexedDB through a thin wrapper (for example Dexie). One database named `my-platform`
  with one object store per entity. Keep the schema version in code.
- Request persistent storage with `navigator.storage.persist()` and show whether it was granted.
- Do not load fonts, scripts, analytics or images from third-party CDNs. Self-host everything,
  so the server and third parties never see user activity.
- Server access logs record only request paths. Do not add server-side logging of request bodies.

## 2.1 Design system — single source of truth for all UI (owner's hard requirement)

The old WorkDesk had no shared UI layer: every page invented its own buttons, cards and
colours. That must not happen again. Rules:

- **One token file**: `assets/css/tokens.css` defines every colour, font family, font size,
  spacing step, radius, shadow and breakpoint as CSS custom properties (`--ink`, `--blue`,
  `--space-2`, `--radius-card`, …). No page may hard-code a hex colour, px font size or
  font family; everything references a token.
- **One component stylesheet**: `assets/css/components.css` defines the shared classes:
  `.btn` (plus `.btn-primary`, `.btn-ghost`, `.btn-danger`), `.card` (plus `.card-head`,
  `.card-body`), `.field` (label + input), `.table`, `.badge`, `.tabs`, `.nav`, `.chart-box`.
  Pages may compose these classes but may not redefine them or add page-local button/card styles.
- **One shared JS module per widget type**: charts are drawn only through
  `assets/js/chart.js` (one wrapper, self-hosted, no CDN); dialogs/toasts only through
  `assets/js/ui.js`. No page creates its own chart or dialog code.
- **A living style-guide page** at `/styleguide.html` showing every token and component in
  one place. Any new component must be added there first, in the same pull request.
- **Review rule**: a pull request that adds an inline `style=`, a new hex colour, a new
  font-family declaration, or a second button/card implementation must be rejected. Add a
  CI grep check for `style=` and `#[0-9a-fA-F]{3,6}` outside `tokens.css`.
- Token starting values come from the old app (`work_app.py` 151–164): ink `#1D1D1F`,
  secondary `#6E6E73`, hairline `#D9D9DE`, card head `#4A90D9`, band `#FBF3D5`.

## 3. Data model (local IndexedDB)

Start from the TSV headers in the old app (`work_app.py` lines 308–314 in the current project),
which map to these stores:

| Store | Source TSV | Key |
|---|---|---|
| `tasks` | `tasks.tsv` | `id` |
| `task_history` | `task_history.tsv` | `id` |
| `task_comments` | `task_comments.tsv` | `id` |
| `events` | `events.tsv` | `id` |
| `bugs` | `bugs.tsv` | `id` |
| `bug_history` | `bug_history.tsv` | `id` |
| `ai_calls` | `ai_calls.tsv` | `id` |
| `meta` | (new) | `key` (schema version, device id, last export time) |

- Every record has `updatedAt` (ISO 8601) and `deletedAt` (soft delete), so imports can merge.
- Do not import from `_internal\backups\`. Import only from `Data\data\*.tsv` if the owner asks.

## 4. Export, import and backup

- **Export**: one JSON file with `schemaVersion`, `exportedAt`, `deviceId`, and all stores.
  Offer a download. Show a reminder when the last export is older than 7 days.
- **Import**: validate `schemaVersion` and structure first. Merge by `id`: the record with the
  newer `updatedAt` wins. Show a summary (added, updated, skipped) and require confirmation
  before writing.
- Never import silently. Never overwrite the whole database without an explicit choice.
- Optional on Chromium desktop only: pick a folder and write the export there automatically.
  Treat that as an extra, not the only backup.

## 5. Phone

- Same URL. The user adds it to the home screen (PWA manifest + service worker).
- Data is local to the phone. There is no automatic sync with the PC.
- Test the layout at 360 px and 390 px widths. Touch targets at least 44 px.
- Expect iOS Safari to clear script-written storage after long inactivity. Ask for export
  reminders on iOS, and mention this in the UI help text.

## 6. Updates (no installers)

- Ship the app as static files on GitHub Pages. A release = a tagged commit on `main`;
  rollback = revert the commit and push.
- Use content-hashed filenames for JS and CSS. The service worker uses a versioned cache name
  and removes old caches on activate.
- The app shows "New version available, reload" when the service worker reports an update.
- Data is never touched during an update, because data is in the browser, not on the server.
- GitHub Actions on tag `v*`: run tests, then let GitHub Pages publish `main`; check
  `/version.json` after deploy. On failure, revert the commit.

## 7. Scraper (open decision, owner chose "both")

- **Option A, server worker**: fetches public Amazon product data and writes it to a public
  product table on the server. No user data is involved. Amazon may block the server IP;
  a proxy may be needed.
- **Option B, user's PC**: a browser page cannot fetch Amazon directly because of CORS.
  No installer-free runtime has been chosen yet. **Do not build Option B until the owner
  approves a specific no-install method.** Candidates to evaluate, not decided: a user-run
  bookmarklet or browser extension loaded unpacked, or a copy-paste workflow.
- Scraped results must never be mixed into a user's private records without the user's action.

## 8. Phases (one pull request each)

- **P0 Shell**: static site, the design system from §2.1 (`tokens.css`, `components.css`,
  `/styleguide.html`), nav (`NAV_GROUPS` order from the old app), responsive
  layout at 360, 390, 768 and 1280 px. Publish via GitHub Pages (branch `main`).
  Accept: opens from a clean browser; no third-party requests in the network log;
  styleguide page shows every token and component.
- **P1 Data layer**: IndexedDB wrapper, schema versioning, `meta` store, tests with fake IndexedDB.
  Accept: CRUD round trip for each store; schema upgrade test.
- **P2 Tasks and calendar**: list, filters, detail, history, comments. Accept: old statuses and
  priorities preserved (`STATUSES`, `PRIORITIES` in the old code).
- **P3 Bugs and events**: list, detail, history. Accept: same fields as `bug_tracker.py`.
- **P4 Export and import**: as in section 4. Accept: export on device A, import on device B,
  merged counts match; corrupted file rejected with a clear message.
- **P5 PWA and offline**: manifest, service worker, offline start. Accept: works with network
  disabled after first load; update prompt appears after a new release.
- **P6 Scraper**: only after owner approves option A and option B's method. See section 7.
- **P7 Release**: GitHub Actions, rollback test, `docs/PROGRESS.md` with evidence.

## 9. Testing

- Playwright with two separate browser contexts = two users. Each must see only its own data.
- Mobile viewport tests at 360 and 390 px for every route.
- Offline test: block network after load; create and edit records; confirm they persist on reload.
- Import/export tests with a fixture file from the old TSV data (row counts must match).

## 10. Coding rules

- Keep changes small and focused; one phase per pull request.
- Comment code only where it needs clarification.
- No Windows-only code (no paths, COM, `os.startfile`).
- No third-party network requests from the page.
- Every bug fix gets a failing test first.
- Do not copy any `.before_*`, `_pre_*`, or `backups/` file into the new repo.

## 11. Open items for the owner

1. **Option B scraper method on user PCs** (no installers allowed): no method chosen yet.
2. Whether a folder-based automatic export (Chromium only) is wanted in addition to IndexedDB.
3. UI language: Chinese, English, or both.
4. Whether any third-party AI service may receive user data. Default: no.

## 12. Definition of done

- [ ] Server holds only static files; no user data is ever sent to it (verified in the network log).
- [ ] Two separate browser profiles cannot see each other's data.
- [ ] Phone and PC data stay separate; export and import work between them.
- [ ] Works offline after first load.
- [ ] Update to a new release does not touch user data.
- [ ] No step requires installing an `.exe` or any installer.
