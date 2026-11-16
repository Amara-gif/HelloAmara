# My Platform — Progress

Updated: 2026-11-16

## Conventions

- `docs/FEATURE-INVENTORY.md` is the single feature standard. Checklist items are ticked in the
  same commit that completes them.
- One commit per phase. This log records the evidence for each phase.
- `assets/css/tokens.css` and `assets/css/components.css` are the only style files. New or
  changed components must appear on `styleguide.html` in the same commit.
- `node scripts/check-styles.mjs` is the design-system guard and runs in CI.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| P0 | Static shell, design system, inventory navigation | Done |
| P1 | IndexedDB wrapper, schema versioning, `meta` store, tests | Next |
| P2 | Tasks and calendar | Not started |
| P3 | Bugs and events | Not started |
| P4 | Export and import | Not started |
| P5 | PWA and offline | Not started |
| P6 | Scraper | Blocked on owner decision |
| P7 | Release automation and rollback proof | Not started |

## P0 — Static shell

### Inventory alignment

- Sidebar groups and order match inventory §1 exactly:
  - no label: Home `/`, My work `/mywork`, Pages `/pages`
  - Projects: Projects `/projects`
  - Work: All work items `/tasks`, Calendar `/calendar`
  - System: Bugs `/bugs`, Team `/chat`, Tools & Files `/files`, Settings `/settings`
- The six Settings sub-links appear under Settings on every `/settings*` page, in inventory
  order: AI inputs & limits, Language rules, Snapshots, Dispatch rules, Responsibility areas,
  Appearance & theme.
- Per-project sidebar links and the In-progress task count badge are wired as empty/zero for
  now; they start working with the IndexedDB layer (P1/P2).
- The invented Overview, Data & backup and About pages were removed. Home now uses the §3.1
  card set, My work uses the three §3.4 queues, Settings pages use the §3.15 shared tabs, and
  every other page shows its inventory screen contract instead of an invented layout.
- Old `/api/*` endpoints are treated as local IndexedDB operations with the same behaviour and
  fields, as the owner requested.
- Context menu is disabled on every page (inventory §7 Shell).
- Static-app difference: "Stop server" (§7 Shell) has no equivalent and is left unchecked.

### Design system

- `assets/css/tokens.css` holds 78 variables: colour, type, spacing, radius, shadow, layout,
  breakpoints and motion. Legacy palette values are the light-theme defaults:
  text `--color-text`, secondary text `--color-text-secondary`, divider `--color-divider`,
  card header `--color-card-header`, band `--color-band`.
- `assets/css/components.css` is the only layout/component stylesheet: `.btn` variants,
  `.card` / `.card-head` / `.card-body`, `.field`, `.table`, `.badge`, `.tabs`, `.nav`,
  `.chart-box`, toasts, dialogs and page layout.
- `assets/js/chart.js` is the only chart renderer (self-hosted SVG, no CDN).
- `assets/js/ui.js` is the only toast/dialog implementation.
- `styleguide.html` shows every token and the required components, plus working tabs, chart,
  toast and dialog demos.
- `scripts/check-styles.mjs` rejects inline `style=` attributes, hex/rgb/hsl literals outside
  `tokens.css`, px font sizes, literal font families, inline `<style>` blocks and extra CSS
  files. It also checks that the 13 required components exist in `components.css` and on the
  style guide.
- CSS limitation documented: `@media` cannot read custom properties, so `components.css`
  mirrors the four `--bp-*` values literally.

### Acceptance checklist

- Checked in this phase: **3 of 161**. Remaining: **158**.
  - [x] Every page shows the sidebar with groups and links exactly as §1, in order.
  - [x] Opening any `/settings*` page expands the six settings sub-links under Settings.
  - [x] Right-click context menu is disabled on every page.
- Not yet checked in Shell: project sub-links and drag reorder, task count badge, fold/pin,
  floating reopen, stop server, revision/build polling, create FAB, `/go/` redirects, install
  prompt, demo mode. They need the data layer, PWA work or a static-app decision.

### Publishing

- P0 is pushed to `main`.
- GitHub Pages is **not enabled** on the repository yet. The available integration token can
  read pushes but cannot create the Pages site (`403 Resource not accessible by integration`).
- Owner action once: repository Settings → Pages → Source **Deploy from a branch** →
  branch `main`, folder `/ (root)`. The target URL is
  <https://amara-gif.github.io/HelloAmara/>.
- No deploy workflow was kept: a branch deployment needs no workflow, and a workflow that
  creates the Pages site fails until Pages is enabled. P7 adds the release pipeline after
  Pages and the release host are available.

### Verification evidence

- Browser: Chromium (Playwright), local static server.
- 19 routes × 4 viewport widths (360, 390, 768, 1280) = **76 combinations**.
- Every combination: no page-level horizontal scroll, no interactive element wider than the
  viewport, every visible link/button at least 44 px in both dimensions, no console or page
  errors.
- Sidebar order and labels checked programmatically on every route; settings sub-links checked
  present and hidden outside `/settings*`.
- Network: 11 requests, all same origin (`index.html`, 2 CSS, 7 JS modules, favicon). No
  third-party request.
- Legacy palette computed in the browser: text `rgb(29, 29, 31)`, secondary `rgb(110, 110, 115)`,
  divider `rgb(217, 217, 222)`, card head `rgb(74, 144, 217)`, band `rgb(251, 243, 213)`.
- Mobile drawer: closed with `inert`, opens with the first nav link focused, Escape returns
  focus to the menu button.
- Style check: passed; 11 source files scanned, 13 required components covered.
- Style guide: colour swatches, type/space/radius/shadow/breakpoint/layout/motion tokens,
  chart, tabs and UI demos render at 360 and 1280.
- Screenshots:
  - `docs/evidence/p0-home-{360,390,768,1280}.png`
  - `docs/evidence/p0-home-1280-dark.png`
  - `docs/evidence/p0-drawer-390.png`
  - `docs/evidence/p0-settings-{360,1280}.png`
  - `docs/evidence/p0-styleguide-{360,1280}.png`

### Next

1. P1: IndexedDB wrapper and schema, then wire the Projects nav sub-links and the In-progress
   count badge.
2. P2: All work items, Home, My work, Calendar, Projects and Pages screens.
3. Decide with the owner whether the static app keeps a "Stop server" equivalent (it has no
   server process) and confirm the UI language.
