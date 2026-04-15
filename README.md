# skill-lens

Analytics dashboard for skill usage. View usage statistics, health metrics, satisfaction trends, and A/B test results from Codex, Claude Code, or an interactive web dashboard.

## Installation

### Codex Plugin

This repo now includes a Codex plugin manifest at `.codex-plugin/plugin.json`.

If your Codex setup supports local plugins, install/link this repo as a plugin and set:

```bash
export SKILL_LENS_ROOT=/path/to/skill-lens
```

This repo also includes a repo-local marketplace entry at `.agents/plugins/marketplace.json`.

For a home-local install that mirrors the standard Codex marketplace layout, run:

```bash
bash scripts/install-codex-plugin.sh
```

If your plugin flow is not set up yet, you can still use the skills directly:

### Codex Skills

Copy the skills into your Codex skill directory and point them at this repo:

```bash
mkdir -p ~/.codex/skills
cp -R skills/skill-lens ~/.codex/skills/
cp -R skills/skill-lens-health ~/.codex/skills/
cp -R skills/skill-lens-ab ~/.codex/skills/
cp -R skills/skill-lens-dashboard ~/.codex/skills/
export SKILL_LENS_ROOT=/path/to/skill-lens
```

If your analytics DB lives somewhere else, set:

```bash
export DB_PATH=/path/to/skill-lens.db
```

### Claude Code Plugin

```bash
claude plugin marketplace add /path/to/skill-lens
claude plugin install skill-lens
```

## Commands

| Command | Description |
|---------|-------------|
| `/skill-lens [days]` | Usage overview: total runs, tokens, satisfaction, top skills |
| `/skill-lens-health [skill] [--days N]` | Health metrics: satisfaction rates, token creep, cancel rates |
| `/skill-lens-ab [test-id]` | A/B test results: list tests or compare versions |
| `/skill-lens-dashboard [--port N]` | Launch interactive web dashboard |

## Examples

```
/skill-lens 30           # Overview for the last 30 days
/skill-lens-health       # Health report for all skills
/skill-lens-health code-review --days 7  # Detailed health for one skill
/skill-lens-ab           # List all A/B tests
/skill-lens-ab ab-test-1 # Compare version A vs B
/skill-lens-dashboard    # Launch web UI at localhost:3847
```

## Configuration

The app reads the SQLite database in read-only mode.

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `DB_PATH` | `~/.codex/memories/skill-lens/skill-lens.db` | Path to the SQLite database |
| `PORT` | `3847` | Web dashboard port |
| `SKILL_LENS_ROOT` | repo path | Path to this repository when running from Codex or outside Claude plugin context |

If `DB_PATH` is not set, the app prefers the Codex default path and falls back to the Claude plugin path when that file exists.

## Requirements

- Node.js 18+

## Development

```bash
# Run with test data
DB_PATH=./test.db npm run dev

# Seed test database
node seed-test-db.mjs

# Query CLI directly
node scripts/query-db.mjs overview --db-path ./test.db --days 30
node scripts/query-db.mjs health --db-path ./test.db --days 14
node scripts/query-db.mjs ab-tests --db-path ./test.db
npm test
```

## License

ISC
