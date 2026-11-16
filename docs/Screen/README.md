# Reference screenshots — old WorkDesk (design source for My Platform)

Captured 2026-11-16 from the live old app at `http://127.0.0.1:8777`. These exist only so the
implementing AI can see what each page looks like. They are reference, not a spec.

## Desktop (1440 × 2000)

| File | Page |
|---|---|
| `01-home.png` | Home: greeting, mini calendar, "Today and coming up", team load, rating-trend card, Pareto card |
| `02-mywork.png` | My work |
| `03-pages.png` | Pages (notes/pages list) |
| `04-projects.png` | Projects list with inline add/edit/archive |
| `05-tasks.png` | All work items — List view, filter bar, counters, row actions (Send to QA / Brief) |
| `06-tasks-all.png` | All work items — scope = all |
| `07-calendar.png` | Calendar (month) |
| `08-bugs.png` | Bugs list |
| `09-chat.png` | Team (agents, order composer) |
| `10-files.png` | Tools & Files |
| `11-settings.png` | Settings root |
| `12-task-detail.png` | Task detail (fields, progress, comments, history) |
| `13-bug-detail.png` | Bug detail |
| `14-project-hello-amara.png` | Project page (tabs) |
| `15-project-market-review.png` | Project page, analysis-heavy project |
| `16-bugs-new.png` | Report a bug form |
| `17-settings-ai.png` | Settings → AI inputs & limits |
| `18-settings-appearance.png` | Settings → Appearance & theme |
| `19-rating-trend.png` | Rating trend full page (SVG chart, product picker) |
| `20-page-editor.png` | Page / note editor |
| `21-tasks-board.png` | All work items — Board view |

## Narrow widths

| File | Width | Note |
|---|---|---|
| `t01-tasks-768.png` | 768 px | Sidebar becomes a floating overlay; main content is pushed out of view |
| `m01-home.png`, `m02-tasks.png`, `m03-bugs.png`, `m04-task-detail.png` | 390 px | Same problem: only the sidebar is usable |
| `t02-home-390.png` | 390 px | Same |

**Important:** the old app has **no usable phone layout**. Narrow widths show only the sidebar
overlay. Use these narrow screenshots for colour, typography and component style only. The
phone layout itself must be designed fresh for My Platform (see BRIEF §5): responsive grid,
sidebar as a drawer, tables becoming stacked cards, touch targets ≥ 44 px.

## What to copy vs. what to change

- Copy: page titles and subtitles, section order, filter controls, table columns and their
  order, status/priority badges, card headers, the flat light look with hairline borders,
  the pill buttons, the ＋ create FAB, and the sidebar grouping (Home / My work / Pages,
  PROJECTS + project sub-list, WORK, SYSTEM).
- Change: the sidebar must be a drawer on phones; nothing may depend on hover; no fixed
  1440 px assumptions; no "Stop server" button (there is no local server any more);
  the environment badge (PROD) is not needed.
