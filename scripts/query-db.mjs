#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// --- CLI args ---
const args = process.argv.slice(2);
const command = args[0];

function getFlag(name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const dbPath = getFlag('--db-path',
  path.join(os.homedir(), '.claude/plugins/skill-lens/data/skill-lens.db'));
const days = parseInt(getFlag('--days', '30'), 10) || 30;

// --- DB ---
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const isNew = !fs.existsSync(dbPath);
const db = new Database(dbPath);

if (isNew) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_runs (
      id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      skill_run_id TEXT NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (skill_run_id) REFERENCES skill_runs(id)
    );
    CREATE TABLE IF NOT EXISTS skill_versions (
      id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      version TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ab_tests (
      id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      version_a TEXT NOT NULL,
      version_b TEXT NOT NULL,
      status TEXT DEFAULT 'running',
      target_runs INTEGER DEFAULT 100,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ab_runs (
      id TEXT PRIMARY KEY,
      ab_test_id TEXT NOT NULL,
      skill_run_id TEXT NOT NULL,
      version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id),
      FOREIGN KEY (skill_run_id) REFERENCES skill_runs(id)
    );
    CREATE TABLE IF NOT EXISTS guard_configs (
      id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

db.pragma('journal_mode = WAL');

// --- Queries ---

function overview() {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_runs,
      COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
      COUNT(DISTINCT skill_name) AS active_skills
    FROM skill_runs WHERE created_at >= ?
  `).get(since);

  const satRow = db.prepare(`
    SELECT
      ROUND(AVG(CASE WHEN r.reaction = 'satisfied' THEN 1.0 ELSE 0.0 END) * 100, 1) AS avg_satisfaction
    FROM skill_runs sr
    JOIN reactions r ON r.skill_run_id = sr.id
    WHERE sr.created_at >= ?
  `).get(since);
  summary.avg_satisfaction = satRow?.avg_satisfaction ?? null;

  const daily_runs = db.prepare(`
    SELECT DATE(created_at) AS date, skill_name, COUNT(*) AS count
    FROM skill_runs WHERE created_at >= ?
    GROUP BY date, skill_name ORDER BY date
  `).all(since);

  const top_skills = db.prepare(`
    SELECT skill_name, COUNT(*) AS count
    FROM skill_runs WHERE created_at >= ?
    GROUP BY skill_name ORDER BY count DESC
  `).all(since);

  const token_by_skill = db.prepare(`
    SELECT skill_name,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens
    FROM skill_runs WHERE created_at >= ?
    GROUP BY skill_name ORDER BY (input_tokens + output_tokens) DESC
  `).all(since);

  return { summary, daily_runs, top_skills, token_by_skill };
}

function health() {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();

  const skills = db.prepare(`
    SELECT DISTINCT skill_name FROM skill_runs WHERE created_at >= ?
  `).all(prevSince).map(r => r.skill_name);

  const result = skills.map(name => {
    const current = db.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
      FROM skill_runs WHERE skill_name = ? AND created_at >= ?
    `).get(name, since);

    const prev = db.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
      FROM skill_runs WHERE skill_name = ? AND created_at >= ? AND created_at < ?
    `).get(name, prevSince, since);

    const curReactions = db.prepare(`
      SELECT r.reaction, COUNT(*) AS count
      FROM reactions r JOIN skill_runs sr ON sr.id = r.skill_run_id
      WHERE sr.skill_name = ? AND sr.created_at >= ?
      GROUP BY r.reaction
    `).all(name, since);

    const reactionMap = {};
    curReactions.forEach(r => { reactionMap[r.reaction] = r.count; });
    const totalReactions = curReactions.reduce((s, r) => s + r.count, 0);

    const satisfaction = totalReactions > 0
      ? Math.round(((reactionMap.satisfied || 0) / totalReactions) * 1000) / 10
      : null;
    const cancel_rate = totalReactions > 0
      ? Math.round(((reactionMap.cancel || 0) / totalReactions) * 1000) / 10
      : null;
    const correction_rate = totalReactions > 0
      ? Math.round(((reactionMap.correction || 0) / totalReactions) * 1000) / 10
      : null;

    const prevReactions = db.prepare(`
      SELECT r.reaction, COUNT(*) AS count
      FROM reactions r JOIN skill_runs sr ON sr.id = r.skill_run_id
      WHERE sr.skill_name = ? AND sr.created_at >= ? AND sr.created_at < ?
      GROUP BY r.reaction
    `).all(name, prevSince, since);
    const prevMap = {};
    prevReactions.forEach(r => { prevMap[r.reaction] = r.count; });
    const prevTotal = prevReactions.reduce((s, r) => s + r.count, 0);
    const prevSat = prevTotal > 0
      ? Math.round(((prevMap.satisfied || 0) / prevTotal) * 1000) / 10
      : null;

    const avgTokensCur = current.total > 0 ? Math.round(current.tokens / current.total) : 0;
    const avgTokensPrev = prev.total > 0 ? Math.round(prev.tokens / prev.total) : 0;
    const tokenCreep = avgTokensPrev > 0
      ? Math.round(((avgTokensCur - avgTokensPrev) / avgTokensPrev) * 1000) / 10
      : 0;

    const satDrop = (prevSat !== null && satisfaction !== null) ? prevSat - satisfaction : 0;

    let status = 'healthy';
    if (cancel_rate > 10 || correction_rate > 25) status = 'critical';
    else if (satDrop > 15 || tokenCreep > 30) status = 'warning';

    return {
      name, satisfaction, cancel_rate, correction_rate,
      token_creep: tokenCreep, sat_drop: satDrop,
      avg_tokens: avgTokensCur, total_runs: current.total,
      trend: { satisfaction: prevSat !== null ? satisfaction - prevSat : null, tokens: tokenCreep },
      status,
    };
  });

  return { skills: result };
}

function healthDetail(skillName) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const satisfaction_timeline = db.prepare(`
    SELECT DATE(sr.created_at) AS date,
      ROUND(AVG(CASE WHEN r.reaction = 'satisfied' THEN 1.0 ELSE 0.0 END) * 100, 1) AS satisfaction
    FROM skill_runs sr
    JOIN reactions r ON r.skill_run_id = sr.id
    WHERE sr.skill_name = ? AND sr.created_at >= ?
    GROUP BY date ORDER BY date
  `).all(skillName, since);

  const reaction_distribution = db.prepare(`
    SELECT r.reaction, COUNT(*) AS count
    FROM reactions r JOIN skill_runs sr ON sr.id = r.skill_run_id
    WHERE sr.skill_name = ? AND sr.created_at >= ?
    GROUP BY r.reaction
  `).all(skillName, since);

  return { skill: skillName, satisfaction_timeline, reaction_distribution };
}

function abTests() {
  const tests = db.prepare(`SELECT * FROM ab_tests ORDER BY created_at DESC`).all().map(t => {
    const runs = db.prepare(`SELECT COUNT(*) AS count FROM ab_runs WHERE ab_test_id = ?`).get(t.id);
    return {
      id: t.id, skill: t.skill_name, status: t.status,
      version_a: t.version_a, version_b: t.version_b,
      target_runs: t.target_runs, completed_runs: runs.count,
      created_at: t.created_at,
    };
  });
  return { tests };
}

function abTestDetail(testId) {
  const test = db.prepare(`SELECT * FROM ab_tests WHERE id = ?`).get(testId);
  if (!test) {
    console.error(JSON.stringify({ error: `Test not found: ${testId}` }));
    process.exit(1);
  }

  function metricsForVersion(version) {
    const rows = db.prepare(`
      SELECT sr.input_tokens, sr.output_tokens, sr.duration_ms, r.reaction
      FROM ab_runs ar
      JOIN skill_runs sr ON sr.id = ar.skill_run_id
      LEFT JOIN reactions r ON r.skill_run_id = sr.id
      WHERE ar.ab_test_id = ? AND ar.version = ?
    `).all(testId, version);

    const total = rows.length;
    if (total === 0) return { total: 0, satisfaction: null, avg_tokens: 0, correction_rate: null, avg_duration: 0 };

    const satisfied = rows.filter(r => r.reaction === 'satisfied').length;
    const corrections = rows.filter(r => r.reaction === 'correction').length;
    const withReaction = rows.filter(r => r.reaction).length;
    const tokens = rows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
    const duration = rows.reduce((s, r) => s + (r.duration_ms || 0), 0);

    return {
      total,
      satisfaction: withReaction > 0 ? Math.round((satisfied / withReaction) * 1000) / 10 : null,
      avg_tokens: Math.round(tokens / total),
      correction_rate: withReaction > 0 ? Math.round((corrections / withReaction) * 1000) / 10 : null,
      avg_duration: Math.round(duration / total),
    };
  }

  const timeline = db.prepare(`
    SELECT DATE(sr.created_at) AS date, ar.version, COUNT(*) AS count
    FROM ab_runs ar JOIN skill_runs sr ON sr.id = ar.skill_run_id
    WHERE ar.ab_test_id = ?
    GROUP BY date, ar.version ORDER BY date
  `).all(testId);

  return {
    test_info: {
      id: test.id, skill: test.skill_name, status: test.status,
      version_a: test.version_a, version_b: test.version_b,
      target_runs: test.target_runs, created_at: test.created_at,
    },
    metrics_a: metricsForVersion(test.version_a),
    metrics_b: metricsForVersion(test.version_b),
    timeline,
  };
}

function skills() {
  const rows = db.prepare(`
    SELECT skill_name AS name, COUNT(*) AS total_runs, MAX(created_at) AS last_run
    FROM skill_runs GROUP BY skill_name ORDER BY total_runs DESC
  `).all();

  for (const s of rows) {
    const sat = db.prepare(`
      SELECT ROUND(AVG(CASE WHEN r.reaction = 'satisfied' THEN 1.0 ELSE 0.0 END) * 100, 1) AS avg_satisfaction
      FROM skill_runs sr JOIN reactions r ON r.skill_run_id = sr.id
      WHERE sr.skill_name = ?
    `).get(s.name);
    s.avg_satisfaction = sat?.avg_satisfaction ?? null;
  }

  return { skills: rows };
}

// --- Dispatch ---
const extraArgs = args.filter(a => !a.startsWith('--') && a !== command);

let result;
switch (command) {
  case 'overview':
    result = overview(); break;
  case 'health':
    result = health(); break;
  case 'health-detail':
    if (!extraArgs[0]) { console.error(JSON.stringify({ error: 'Missing skill name' })); process.exit(1); }
    result = healthDetail(extraArgs[0]); break;
  case 'ab-tests':
    result = abTests(); break;
  case 'ab-test-detail':
    if (!extraArgs[0]) { console.error(JSON.stringify({ error: 'Missing test ID' })); process.exit(1); }
    result = abTestDetail(extraArgs[0]); break;
  case 'skills':
    result = skills(); break;
  default:
    console.error(JSON.stringify({
      error: `Unknown command: ${command}`,
      usage: 'query-db.mjs <overview|health|health-detail|ab-tests|ab-test-detail|skills> [args] [--days N] [--db-path PATH]'
    }));
    process.exit(1);
}

console.log(JSON.stringify(result));
db.close();
