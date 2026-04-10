---
name: skill-lens
description: "View skill analytics overview - total runs, tokens, satisfaction, top skills, and token consumption per skill"
argument-hint: [days]
allowed-tools: [Bash]
---

# Skill Lens — Overview

Show a usage overview of skill analytics data.

## Arguments

- `$ARGUMENTS` may contain a number for the time range in days (default: 30)

## Instructions

1. Parse the days argument from `$ARGUMENTS`. If not a number or empty, default to `30`.

2. Run the query script:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/query-db.mjs" overview --days <DAYS> --db-path "${DB_PATH:-$HOME/.claude/plugins/skill-lens/data/skill-lens.db}"
```

3. If the script exits with an error (DB not found), tell the user:
   - The database file was not found
   - They can set `DB_PATH` environment variable to point to a custom database location

4. Parse the JSON output and format a report like this:

```
## Skill Lens Analytics — Overview (<N> days)

| Metric           | Value   |
|------------------|---------|
| Total Runs       | X       |
| Total Tokens     | X       |
| Avg Satisfaction | X%      |
| Active Skills    | X       |

### Top Skills by Usage
| # | Skill        | Runs |
|---|--------------|------|
| 1 | skill-name   | 123  |
...

### Token Consumption by Skill
| Skill       | Input    | Output   | Total    |
|-------------|----------|----------|----------|
| skill-name  | 12,345   | 6,789    | 19,134   |
...

> For interactive charts, run /skill-lens-dashboard
```

5. Format large numbers with commas (e.g., 1,234,567). Show token counts in human-readable form (e.g., 1.2M if over 1 million).
