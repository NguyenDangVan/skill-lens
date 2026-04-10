import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3847', 10);
const DB_PATH = process.env.DB_PATH
  || path.join(os.homedir(), '.claude/plugins/skill-lens/data/skill-lens.db');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// --- Database ---

let db = null;

function getDb() {
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) return null;
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return db;
}

// --- API helpers ---

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function error(res, msg, status = 500) {
  json(res, { error: msg }, status);
}

function parseQuery(url) {
  const u = new URL(url, 'http://localhost');
  return Object.fromEntries(u.searchParams);
}

function parseDays(query, fallback = 30) {
  const d = parseInt(query.days, 10);
  return Number.isFinite(d) && d > 0 ? d : fallback;
}

// --- API routes ---

function apiOverview(req, res) {
  const database = getDb();
  if (!database) return error(res, 'Database not found', 503);
  const query = parseQuery(req.url);
  const days = parseDays(query, 30);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const summary = database.prepare(`
    SELECT
      COUNT(*) AS total_runs,
      COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
      COUNT(DISTINCT skill_name) AS active_skills
    FROM skill_runs WHERE created_at >= ?
  `).get(since);

  const satRow = database.prepare(`
    SELECT
      ROUND(AVG(CASE WHEN r.reaction = 'satisfied' THEN 1.0 ELSE 0.0 END) * 100, 1) AS avg_satisfaction
    FROM skill_runs sr
    JOIN reactions r ON r.skill_run_id = sr.id
    WHERE sr.created_at >= ?
  `).get(since);
  summary.avg_satisfaction = satRow?.avg_satisfaction ?? null;

  const daily_runs = database.prepare(`
    SELECT DATE(created_at) AS date, skill_name, COUNT(*) AS count
    FROM skill_runs WHERE created_at >= ?
    GROUP BY date, skill_name ORDER BY date
  `).all(since);

  const top_skills = database.prepare(`
    SELECT skill_name, COUNT(*) AS count
    FROM skill_runs WHERE created_at >= ?
    GROUP BY skill_name ORDER BY count DESC
  `).all(since);

  const token_by_skill = database.prepare(`
    SELECT skill_name,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens
    FROM skill_runs WHERE created_at >= ?
    GROUP BY skill_name ORDER BY (input_tokens + output_tokens) DESC
  `).all(since);

  json(res, { summary, daily_runs, top_skills, token_by_skill });
}

function apiHealth(req, res) {
  const database = getDb();
  if (!database) return error(res, 'Database not found', 503);
  const query = parseQuery(req.url);
  const days = parseDays(query, 14);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();

  const skills = database.prepare(`
    SELECT DISTINCT skill_name FROM skill_runs WHERE created_at >= ?
  `).all(prevSince).map(r => r.skill_name);

  const result = skills.map(name => {
    const current = database.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
      FROM skill_runs WHERE skill_name = ? AND created_at >= ?
    `).get(name, since);

    const prev = database.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
      FROM skill_runs WHERE skill_name = ? AND created_at >= ? AND created_at < ?
    `).get(name, prevSince, since);

    const curReactions = database.prepare(`
      SELECT r.reaction, COUNT(*) AS count
      FROM reactions r
      JOIN skill_runs sr ON sr.id = r.skill_run_id
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

    const prevReactions = database.prepare(`
      SELECT r.reaction, COUNT(*) AS count
      FROM reactions r
      JOIN skill_runs sr ON sr.id = r.skill_run_id
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
      name,
      satisfaction,
      cancel_rate,
      correction_rate,
      token_creep: tokenCreep,
      sat_drop: satDrop,
      avg_tokens: avgTokensCur,
      total_runs: current.total,
      trend: {
        satisfaction: prevSat !== null ? satisfaction - prevSat : null,
        tokens: tokenCreep,
      },
      status,
    };
  });

  json(res, { skills: result });
}

function apiHealthSkill(req, res, skillName) {
  const database = getDb();
  if (!database) return error(res, 'Database not found', 503);
  const days = 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const satisfaction_timeline = database.prepare(`
    SELECT DATE(sr.created_at) AS date,
      ROUND(AVG(CASE WHEN r.reaction = 'satisfied' THEN 1.0 ELSE 0.0 END) * 100, 1) AS satisfaction
    FROM skill_runs sr
    JOIN reactions r ON r.skill_run_id = sr.id
    WHERE sr.skill_name = ? AND sr.created_at >= ?
    GROUP BY date ORDER BY date
  `).all(skillName, since);

  const reaction_distribution = database.prepare(`
    SELECT r.reaction, COUNT(*) AS count
    FROM reactions r
    JOIN skill_runs sr ON sr.id = r.skill_run_id
    WHERE sr.skill_name = ? AND sr.created_at >= ?
    GROUP BY r.reaction
  `).all(skillName, since);

  json(res, { skill: skillName, satisfaction_timeline, reaction_distribution });
}

function apiAbTests(req, res) {
  const database = getDb();
  if (!database) return error(res, 'Database not found', 503);

  const tests = database.prepare(`
    SELECT * FROM ab_tests ORDER BY created_at DESC
  `).all().map(t => {
    const runs = database.prepare(`
      SELECT COUNT(*) AS count FROM ab_runs WHERE ab_test_id = ?
    `).get(t.id);
    return {
      id: t.id,
      skill: t.skill_name,
      status: t.status,
      version_a: t.version_a,
      version_b: t.version_b,
      target_runs: t.target_runs,
      completed_runs: runs.count,
      created_at: t.created_at,
    };
  });

  json(res, { tests });
}

function apiAbTestDetail(req, res, testId) {
  const database = getDb();
  if (!database) return error(res, 'Database not found', 503);

  const test = database.prepare(`SELECT * FROM ab_tests WHERE id = ?`).get(testId);
  if (!test) return error(res, 'Test not found', 404);

  function metricsForVersion(version) {
    const rows = database.prepare(`
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

  const timeline = database.prepare(`
    SELECT DATE(sr.created_at) AS date, ar.version, COUNT(*) AS count
    FROM ab_runs ar
    JOIN skill_runs sr ON sr.id = ar.skill_run_id
    WHERE ar.ab_test_id = ?
    GROUP BY date, ar.version ORDER BY date
  `).all(testId);

  json(res, {
    test_info: {
      id: test.id,
      skill: test.skill_name,
      status: test.status,
      version_a: test.version_a,
      version_b: test.version_b,
      target_runs: test.target_runs,
      created_at: test.created_at,
    },
    metrics_a: metricsForVersion(test.version_a),
    metrics_b: metricsForVersion(test.version_b),
    timeline,
  });
}

function apiSkills(req, res) {
  const database = getDb();
  if (!database) return error(res, 'Database not found', 503);

  const skills = database.prepare(`
    SELECT
      skill_name AS name,
      COUNT(*) AS total_runs,
      MAX(created_at) AS last_run
    FROM skill_runs
    GROUP BY skill_name ORDER BY total_runs DESC
  `).all();

  for (const s of skills) {
    const sat = database.prepare(`
      SELECT ROUND(AVG(CASE WHEN r.reaction = 'satisfied' THEN 1.0 ELSE 0.0 END) * 100, 1) AS avg_satisfaction
      FROM skill_runs sr
      JOIN reactions r ON r.skill_run_id = sr.id
      WHERE sr.skill_name = ?
    `).get(s.name);
    s.avg_satisfaction = sat?.avg_satisfaction ?? null;
  }

  json(res, { skills });
}

// --- Static file server ---

function serveStatic(req, res) {
  let filePath = req.url.split('?')[0];
  if (filePath === '/') filePath = '/index.html';

  const fullPath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(fullPath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// --- Router ---

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;

  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405);
  }

  try {
    if (pathname === '/api/overview') return apiOverview(req, res);
    if (pathname === '/api/health') return apiHealth(req, res);
    if (pathname === '/api/skills') return apiSkills(req, res);
    if (pathname === '/api/ab-tests') return apiAbTests(req, res);

    const healthMatch = pathname.match(/^\/api\/health\/(.+)$/);
    if (healthMatch) return apiHealthSkill(req, res, decodeURIComponent(healthMatch[1]));

    const abMatch = pathname.match(/^\/api\/ab-tests\/(.+)$/);
    if (abMatch) return apiAbTestDetail(req, res, decodeURIComponent(abMatch[1]));

    return serveStatic(req, res);
  } catch (e) {
    console.error('API error:', e);
    return error(res, e.message);
  }
});

server.listen(PORT, () => {
  console.log(`Skill Lens running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  if (!fs.existsSync(DB_PATH)) {
    console.log('WARNING: Database file not found. Dashboard will show setup instructions.');
  }
});
