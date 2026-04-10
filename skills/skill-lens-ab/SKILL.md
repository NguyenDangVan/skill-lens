---
name: skill-lens-ab
description: "View A/B test results - compare skill versions, satisfaction, and token metrics side by side"
argument-hint: [test-id]
allowed-tools: [Bash]
---

# Skill Lens — A/B Tests

Show A/B test results.

## Arguments

- `$ARGUMENTS` may contain a test ID for detailed comparison

## Instructions

1. If **no test ID** provided, list all tests:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/query-db.mjs" ab-tests --db-path "${DB_PATH:-$HOME/.claude/plugins/skill-lens/data/skill-lens.db}"
```

Format as:
```
## A/B Tests

| ID  | Skill       | Version A | Version B | Status   | Progress    |
|-----|-------------|-----------|-----------|----------|-------------|
| abc | code-review | v1.0      | v1.1      | running  | 45/100      |
...

> Run /skill-lens-ab <test-id> for detailed comparison
```

2. If a **test ID** is provided, get detailed comparison:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/query-db.mjs" ab-test-detail <TEST_ID> --db-path "${DB_PATH:-$HOME/.claude/plugins/skill-lens/data/skill-lens.db}"
```

Format as:
```
## A/B Test: <skill> (<version_a> vs <version_b>)

Status: <status> | Created: <date>

### Metrics Comparison
| Metric          | <Version A> | <Version B> | Winner     |
|-----------------|-------------|-------------|------------|
| Runs            | 23          | 22          | —          |
| Satisfaction    | 78.3%       | 85.2%       | Version B  |
| Avg Tokens      | 4,521       | 3,890       | Version B  |
| Correction Rate | 12.5%       | 8.1%        | Version B  |
| Avg Duration    | 2,340ms     | 1,980ms     | Version B  |
```

3. Winner logic:
   - Higher satisfaction = better
   - Lower avg_tokens = better
   - Lower correction_rate = better
   - Lower avg_duration = better
   - If equal or both null, show "—"

4. Handle errors (DB not found, test not found).
