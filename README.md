# My Platform

My Platform is a local-first workspace for tasks, calendar, bugs and events. It is a static
website — HTML, CSS and JavaScript only. There is no backend database, no account system and
no installer. Every device keeps its own data, and the only way to move records between a
phone and a computer is a JSON export/import file.

Target site: <https://amara-gif.github.io/HelloAmara/> — GitHub Pages still has to be enabled in
the repository settings (deploy from `main`, root folder); the deployment token available in
this environment cannot enable it.

## Rules this repository follows

- No `.exe` or installer for anyone, ever.
- User data stays on the user's device (browser IndexedDB) and is never uploaded.
- The server only serves static files; no server-side database and no accounts.
- No third-party scripts, fonts or images. Everything is in this repository.
- Phone and computer data are independent. Export/import JSON is the only sync path.

Requirements live in two documents:

- [docs/BRIEF.md](docs/BRIEF.md) — architecture, storage, privacy and phase rules.
- [docs/FEATURE-INVENTORY.md](docs/FEATURE-INVENTORY.md) — the single standard for pages,
  buttons, data fields and the 161-item acceptance checklist. Old `/api/` endpoints become
  operations on the local IndexedDB layer, not HTTP endpoints.

## Preview locally

ES modules need to be served over HTTP, not opened as `file://`:

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173/>. The design system is at
<http://localhost:4173/styleguide.html>.

## Tests

The data layer has Node tests that use an in-memory fake IndexedDB. There is no browser,
server or build step involved.

```sh
npm install
npm test
```

`npm test` runs `node --test` and creates a temporary database per test. It covers
`put`/`get`/`getAll`/`clear` for every store in `assets/js/db.js`, the version 1 schema plus a
version 1 → 2 upgrade, soft-delete filtering through `assets/js/data.js` (live rows only),
Test-account boot with demo data, and the nav In-progress badge count/show/hide helper. Tests
live in `tests/` and clean up their databases.

## UI rules

- `assets/css/tokens.css` is the only file with colour, type, spacing, radius, shadow and
  breakpoint values.
- `assets/css/components.css` is the only stylesheet for layout and components. Pages only
  compose its classes.
- Charts are drawn only by `assets/js/chart.js`. Toasts and dialogs are created only by
  `assets/js/ui.js`.
- Every component must appear on `styleguide.html` in the same commit that adds it.
- `node scripts/check-styles.mjs` fails on inline styles, colour literals outside
  `tokens.css`, px font sizes, literal font families or undocumented CSS files.

## Repository layout

```
index.html               app shell and inline SVG icons
styleguide.html          every token and component on one page
assets/css/tokens.css    global design variables
assets/css/components.css layout and shared components
assets/js/app.js         navigation, drawer, hash router bootstrap
assets/js/nav-badge.js   In-progress task count and nav badge visibility
assets/js/routes.js      route table and sidebar order from inventory §1
assets/js/views.js       screen shells
assets/js/icons.js       inline icon set
assets/js/chart.js       the only chart renderer
assets/js/ui.js          the only toast and dialog implementation
assets/js/styleguide.js  token and demo rendering for the style guide
scripts/check-styles.mjs design-system guard
tests/                   Node tests for IndexedDB CRUD, schema upgrades and soft deletes
package.json             test script and the fake-indexeddb dev dependency
docs/BRIEF.md            architecture and privacy rules
docs/FEATURE-INVENTORY.md feature standard and acceptance checklist
docs/PROGRESS.md         phase log, evidence and checklist counts
```

## Status

Phase P0 (static shell) is complete. The sidebar matches inventory §1, the Settings sub-links
expand on every `/settings*` page, and three acceptance items are checked. P1's data layer is
complete: Node-based IndexedDB CRUD and schema-upgrade tests plus per-account persistent-storage
request/status (`Granted` / `Denied` / `Unsupported`, shown in the sidebar and Settings).
Phases P1–P7 are tracked in [docs/PROGRESS.md](docs/PROGRESS.md).
