# Skill Lens — Design Spec

## Overview

A Claude Code plugin that provides visual analytics for skill usage. It reads a SQLite database in read-only mode and presents usage, health, and A/B testing data through slash commands and interactive charts.

## Architecture

```
skill-lens (plugin)
  ├── .claude-plugin/plugin.json
  ├── skills/                     ← Slash commands
  ├── scripts/query-db.mjs       ← CLI query runner
  ├── data/skill-lens.db          ← SQLite file
  ├── server.mjs                  ← Node.js HTTP server for web dashboard
  ├── public/                     ← Static frontend (Vanilla JS + Chart.js)
  │   ├── index.html
  │   ├── app.js
  │   └── style.css
  └── package.json
```

**Data flow:** Slash command → query-db.mjs → SQLite (read-only) → JSON → formatted markdown
**Web dashboard:** Browser → REST API (Node.js) → SQLite (read-only) → JSON → Chart.js renders

**Key constraint:** The database is opened in **read-only mode**. It never writes to it.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | Node.js + better-sqlite3 | Lightweight, fast SQLite access |
| HTTP | Node built-in `http` module | No Express needed for ~6 endpoints |
| Frontend | Vanilla JS + HTML + CSS | No build step, fast, simple |
| Charts | Chart.js 4.x (CDN) | Lightweight, good defaults, responsive |
| Styling | CSS custom properties + minimal layout | Dark theme, responsive grid |

## Features

### 1. Usage Overview Page (default view)

**Purpose:** See how skills are being used over time.

**Charts:**
- **Line chart — Skill runs over time** (daily, 30-day window)
  - X: date, Y: run count. One line per top-5 skill, rest aggregated as "other"
- **Doughnut chart — Top skills by usage** (30-day)
  - Skill name + run count
- **Bar chart — Token consumption by skill** (30-day)
  - Stacked: input tokens vs output tokens
- **Summary cards** at top:
  - Total runs (30d), Total tokens (30d), Avg satisfaction rate, Active skills count

**Data source:** `skill_runs` table, aggregated by date and skill_name.

### 2. Health & Satisfaction Page

**Purpose:** Monitor skill quality and detect degradation.

**Charts:**
- **Line chart — Satisfaction rate over time** (14-day rolling avg)
  - Per-skill lines, color-coded
- **Bar chart — Reaction distribution** per skill
  - Stacked: satisfied / correction / follow_up / retry / cancel
- **Heatmap table — Health status matrix**
  - Rows: skills. Columns: satisfaction, token creep, cancel rate, correction rate
  - Cells: green/yellow/red based on thresholds
- **Trend arrows** for each metric vs previous 14-day period

**Thresholds:**
- Satisfaction drop > 15% → yellow
- Token creep > 30% → yellow
- Cancel rate > 10% → red
- Correction rate > 25% → red

### 3. A/B Test Visualization Page

**Purpose:** Compare skill versions side-by-side with visual charts.

**Charts:**
- **Grouped bar chart — Version A vs B metrics**
  - Metrics: satisfaction rate, avg tokens, correction rate, avg duration
- **Line chart — Cumulative runs over time** for each version
- **Test status card:**
  - Test name, versions, progress (runs completed / target), status badge
- **Results summary table** with winner highlight per metric

**Data source:** `ab_tests`, `ab_runs` joined with `skill_runs` and `reactions`.

## API Endpoints

All endpoints return JSON. Server runs on `localhost:3847` (configurable via `PORT` env var).

```
GET /api/overview
  Query: ?days=30
  Returns: { summary, daily_runs[], top_skills[], token_by_skill[] }

GET /api/health
  Query: ?days=14
  Returns: { skills[]: { name, satisfaction, tokens, cancel_rate, correction_rate, trend, status } }

GET /api/health/:skill
  Returns: { satisfaction_timeline[], reaction_distribution, trend_vs_previous }

GET /api/ab-tests
  Returns: { tests[]: { id, skill, status, versions, progress } }

GET /api/ab-tests/:id
  Returns: { test_info, metrics_a, metrics_b, timeline[] }

GET /api/skills
  Returns: { skills[]: { name, total_runs, last_run, avg_satisfaction } }
```

## Database Connection

```javascript
// Default path, configurable via DB_PATH env var
const DB_PATH = process.env.DB_PATH
  || path.join(os.homedir(), '.claude/plugins/skill-lens/data/skill-lens.db');

const db = new Database(DB_PATH, { readonly: true });
```

If the database file doesn't exist, the server shows a friendly error page with setup instructions instead of crashing.

## Frontend Structure

```
public/
├── index.html          # Shell: nav + page containers
├── style.css           # Dark theme, grid layout, responsive
├── app.js              # Router, fetch wrapper, page loader
├── pages/
│   ├── overview.js     # Usage overview charts
│   ├── health.js       # Health & satisfaction charts
│   └── ab-tests.js     # A/B test visualization
└── components/
    ├── chart-helpers.js # Chart.js config factory functions
    ├── nav.js           # Navigation component
    └── cards.js         # Summary card components
```

**Routing:** Hash-based (`#/overview`, `#/health`, `#/ab-tests`). No SPA framework needed.

**Chart.js config patterns:**
- Shared color palette (CSS custom properties → JS)
- Responsive by default
- Tooltip with formatted numbers
- Dark theme: dark background, light text, subtle grid lines

## UI/UX

**Theme:** Dark mode (matches developer tooling aesthetic).

**Layout:**
- Top: nav bar with 3 tabs (Overview | Health | A/B Tests)
- Below nav: summary cards row
- Main area: 2-column grid for charts (collapses to 1 on narrow screens)

**Colors:**
```css
--bg-primary: #0f1117;
--bg-card: #1a1d27;
--text-primary: #e1e4ea;
--text-secondary: #8b8fa3;
--accent-green: #22c55e;
--accent-yellow: #eab308;
--accent-red: #ef4444;
--accent-blue: #3b82f6;
--accent-purple: #a855f7;
```

## Project Setup

```bash
cd /home/vannd1/workspaces/u30/skill-lens
npm install better-sqlite3
# Chart.js loaded via CDN in HTML, no npm install needed
```

**Scripts:**
```json
{
  "start": "node server.mjs",
  "dev": "node --watch server.mjs"
}
```

**Run:** `npm run dev` → opens at `http://localhost:3847`

## Error Handling

- DB not found → show setup instruction page (not crash)
- DB read error → return 500 with message
- Empty data → show "No data yet" state with illustration
- API timeout → frontend shows retry button

## Out of Scope

- Writing to the database
- User authentication
- Remote deployment / hosting
- Run history explorer (deferred to future iteration)
- Real-time WebSocket updates (polling on page load is sufficient)
