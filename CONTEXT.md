# Skill Lens — Session Context

## Project Location
`/home/vannd1/workspaces/u30/skill-lens`

## What This Is
A Claude Code plugin that provides visual analytics for skill usage. It reads a SQLite database in read-only mode and presents usage, health, and A/B testing data through slash commands and an interactive web dashboard.

## Design Spec
Full spec at: `docs/superpowers/specs/2026-04-10-skill-lens-dashboard-design.md`

## Decisions Made

| Decision | Choice |
|----------|--------|
| Deployment | Claude Code plugin + local web dashboard |
| Frontend stack | Vanilla JS + HTML + Chart.js 4.x (CDN) |
| Backend | Node.js built-in `http` + better-sqlite3 (read-only) |
| DB connection | Reads SQLite directly via `DB_PATH` env var |
| Port | `localhost:3847` |

## Features

### Slash Commands
- `/skill-lens [days]` — Usage overview
- `/skill-lens-health [skill] [--days N]` — Health & satisfaction metrics
- `/skill-lens-ab [test-id]` — A/B test results
- `/skill-lens-dashboard [--port N]` — Launch web dashboard

### Web Dashboard (3 pages)

#### 1. Usage Overview (default page)
- Line chart: skill runs over time (30d, top-5 skills)
- Doughnut chart: top skills by usage
- Bar chart: token consumption by skill (stacked input/output)
- Summary cards: total runs, total tokens, avg satisfaction, active skills

#### 2. Health & Satisfaction
- Line chart: satisfaction rate over time (14d rolling avg)
- Bar chart: reaction distribution per skill (stacked)
- Heatmap table: health status matrix (green/yellow/red)
- Trend arrows vs previous 14d period
- Thresholds: satisfaction drop >15%, token creep >30%, cancel >10%, correction >25%

#### 3. A/B Test Visualization
- Grouped bar chart: version A vs B metrics
- Line chart: cumulative runs over time per version
- Test status card with progress
- Results summary table with winner highlight

## Tech Architecture

```
Browser ──GET──▶ Node.js server (server.mjs, port 3847)
                    │
                    ▼ (read-only)
              skill-lens.db (SQLite)
              default: ~/.claude/plugins/skill-lens/data/skill-lens.db
```

## API Endpoints
```
GET /api/overview      ?days=30
GET /api/health        ?days=14
GET /api/health/:skill
GET /api/ab-tests
GET /api/ab-tests/:id
GET /api/skills
```

## Frontend Structure
```
public/
├── index.html
├── style.css
├── app.js              # Hash-based router
├── pages/
│   ├── overview.js
│   ├── health.js
│   └── ab-tests.js
└── components/
    ├── chart-helpers.js
    ├── nav.js
    └── cards.js
```

## Plugin Structure
```
.claude-plugin/
└── plugin.json
skills/
├── skill-lens/SKILL.md
├── skill-lens-health/SKILL.md
├── skill-lens-ab/SKILL.md
└── skill-lens-dashboard/SKILL.md
scripts/
└── query-db.mjs           # CLI query runner
```

## UI
- Dark theme (#0f1117 bg)
- 3-tab nav: Overview | Health | A/B Tests
- 2-column chart grid (responsive → 1 col on mobile)

## Current State
- Plugin structure with 4 slash commands
- Server + 6 API endpoints working
- 3 frontend pages (Overview, Health, A/B Tests) with Chart.js
- Test seed database with sample data available
- Run with: `DB_PATH=./test.db npm run dev`

## Reference: DB Schema
```sql
-- Tables: skill_runs, reactions, skill_versions, ab_tests, ab_runs, guard_configs
-- Key joins: skill_runs.id → reactions.skill_run_id
--            ab_tests.id → ab_runs.ab_test_id → ab_runs.skill_run_id → skill_runs.id
```
