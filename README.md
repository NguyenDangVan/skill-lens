# skill-lens

Analytics dashboard plugin for Claude Code. View skill usage statistics, health metrics, satisfaction trends, and A/B test results directly in Claude Code or via an interactive web dashboard.

## Installation

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

The plugin reads the SQLite database in read-only mode.

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `DB_PATH` | `~/.claude/plugins/skill-lens/data/skill-lens.db` | Path to the SQLite database |
| `PORT` | `3847` | Web dashboard port |

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
```

## License

ISC
