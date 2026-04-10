---
name: skill-lens-health
description: "View skill health and satisfaction metrics - per-skill satisfaction rates, token creep, cancel rates, and status indicators"
argument-hint: "<skill-name> [--days N]"
allowed-tools: [Bash]
---

# Skill Lens — Health & Satisfaction

Show health metrics and satisfaction data for skills.

## Arguments

- `$ARGUMENTS` may contain:
  - A skill name to get detailed info for that specific skill
  - `--days N` to set the time range (default: 14)

## Instructions

1. Parse `$ARGUMENTS`:
   - Extract `--days N` if present (default 14)
   - Any remaining text is the skill name for detailed view

2. If **no skill name** provided, run the health overview:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/query-db.mjs" health --days <DAYS> --db-path "${DB_PATH:-$HOME/.claude/plugins/skill-lens/data/skill-lens.db}"
```

Format as:
```
## Skill Health Report (<N> days)

| Skill | Satisfaction | Cancel | Correction | Token Creep | Trend | Status |
|-------|-------------|--------|------------|-------------|-------|--------|
| name  | 85.0%       | 2.5%   | 8.3%       | +5.2%       | +3.1  | healthy|

Thresholds: sat drop >15% = warning, token creep >30% = warning, cancel >10% = critical, correction >25% = critical
```

Use status indicators: `healthy`, `warning`, `critical`.

3. If a **skill name** is provided, also run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/query-db.mjs" health-detail <SKILL_NAME> --db-path "${DB_PATH:-$HOME/.claude/plugins/skill-lens/data/skill-lens.db}"
```

Add to the output:
```
### <Skill Name> — Satisfaction Timeline
| Date       | Satisfaction |
|------------|-------------|
| 2026-04-01 | 85.0%       |
...

### Reaction Distribution
| Reaction   | Count |
|------------|-------|
| satisfied  | 45    |
| correction | 8     |
...
```

4. Handle errors gracefully (DB not found, skill not found).
