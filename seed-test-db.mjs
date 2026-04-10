import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'test.db');

const db = new Database(dbPath);

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

// Seed data
const skills = ['code-review', 'refactor', 'test-writer', 'doc-gen', 'bug-fix', 'deploy-helper'];
const reactions = ['satisfied', 'correction', 'follow_up', 'retry', 'cancel'];
let runId = 0;
let reactId = 0;

for (let d = 29; d >= 0; d--) {
  const date = new Date(Date.now() - d * 86400000);
  const dateStr = date.toISOString();

  for (const skill of skills) {
    const numRuns = Math.floor(Math.random() * 5) + 1;
    for (let r = 0; r < numRuns; r++) {
      runId++;
      const id = `run-${runId}`;
      db.prepare(`INSERT INTO skill_runs VALUES (?, ?, ?, ?, ?, ?)`).run(
        id, skill,
        Math.floor(Math.random() * 5000) + 500,
        Math.floor(Math.random() * 3000) + 200,
        Math.floor(Math.random() * 10000) + 1000,
        dateStr
      );

      // 80% chance of a reaction
      if (Math.random() < 0.8) {
        reactId++;
        const weights = skill === 'bug-fix'
          ? [0.4, 0.3, 0.1, 0.1, 0.1]
          : [0.6, 0.15, 0.1, 0.1, 0.05];
        const rand = Math.random();
        let cum = 0;
        let reaction = 'satisfied';
        for (let i = 0; i < weights.length; i++) {
          cum += weights[i];
          if (rand < cum) { reaction = reactions[i]; break; }
        }
        db.prepare(`INSERT INTO reactions VALUES (?, ?, ?, ?)`).run(
          `react-${reactId}`, id, reaction, dateStr
        );
      }
    }
  }
}

// A/B test
const abId = 'ab-test-1';
db.prepare(`INSERT INTO ab_tests VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  abId, 'code-review', 'v1.0', 'v2.0', 'running', 50,
  new Date(Date.now() - 14 * 86400000).toISOString()
);

const abRuns = db.prepare(`SELECT id, created_at FROM skill_runs WHERE skill_name = 'code-review' LIMIT 40`).all();
abRuns.forEach((r, i) => {
  db.prepare(`INSERT INTO ab_runs VALUES (?, ?, ?, ?, ?)`).run(
    `ab-run-${i}`, abId, r.id, i % 2 === 0 ? 'v1.0' : 'v2.0', r.created_at
  );
});

db.close();
console.log(`Created test database at ${dbPath} with ${runId} runs, ${reactId} reactions, 1 A/B test`);
