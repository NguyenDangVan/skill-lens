import path from 'node:path';

export function resolveAppRoot(env = process.env, fallbackRoot) {
  return env.SKILL_LENS_ROOT || env.CLAUDE_PLUGIN_ROOT || fallbackRoot;
}

export function getDefaultDbPath(homeDir) {
  return path.join(homeDir, '.codex', 'memories', 'skill-lens', 'skill-lens.db');
}

export function getClaudeDbPath(homeDir) {
  return path.join(homeDir, '.claude', 'plugins', 'skill-lens', 'data', 'skill-lens.db');
}

export function resolveDbPath(env = process.env, homeDir, existsSync = () => false) {
  if (env.DB_PATH) return env.DB_PATH;

  const codexPath = getDefaultDbPath(homeDir);
  const claudePath = getClaudeDbPath(homeDir);

  if (existsSync(codexPath)) return codexPath;
  if (existsSync(claudePath)) return claudePath;

  return codexPath;
}
