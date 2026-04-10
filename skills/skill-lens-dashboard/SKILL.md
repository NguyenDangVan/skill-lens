---
name: skill-lens-dashboard
description: Launch the skill-lens web dashboard for interactive charts and data visualizations
argument-hint: [--port N]
allowed-tools: [Bash]
---

# Skill Lens — Web Dashboard

Launch the interactive web dashboard with charts and visualizations.

## Arguments

- `$ARGUMENTS` may contain `--port N` to use a custom port (default: 3847)

## Instructions

1. Parse `$ARGUMENTS` for `--port N` (default 3847).

2. Check if dependencies are installed:
```bash
ls "${CLAUDE_PLUGIN_ROOT}/node_modules/better-sqlite3" 2>/dev/null
```

3. If not installed, run:
```bash
cd "${CLAUDE_PLUGIN_ROOT}" && npm install --production
```

4. Launch the server in the background:
```bash
cd "${CLAUDE_PLUGIN_ROOT}" && PORT=<PORT> DB_PATH="${DB_PATH:-$HOME/.claude/plugins/skill-lens/data/skill-lens.db}" node server.mjs &
```

5. Tell the user:
   - Dashboard is running at `http://localhost:<PORT>`
   - They can open this URL in their browser
   - The dashboard reads the database in read-only mode
   - To stop: find the process with `lsof -i :<PORT>` and kill it

6. If the DB file doesn't exist, warn the user and suggest they set `DB_PATH` to a custom path.
