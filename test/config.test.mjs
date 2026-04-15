import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultDbPath,
  resolveAppRoot,
  resolveDbPath,
} from '../lib/config.mjs';

test('resolveAppRoot prefers SKILL_LENS_ROOT', () => {
  const env = {
    SKILL_LENS_ROOT: '/tmp/skill-lens',
    CLAUDE_PLUGIN_ROOT: '/tmp/claude-plugin',
  };

  assert.equal(resolveAppRoot(env, '/workspace/fallback'), '/tmp/skill-lens');
});

test('resolveAppRoot falls back to CLAUDE_PLUGIN_ROOT', () => {
  const env = {
    CLAUDE_PLUGIN_ROOT: '/tmp/claude-plugin',
  };

  assert.equal(resolveAppRoot(env, '/workspace/fallback'), '/tmp/claude-plugin');
});

test('getDefaultDbPath prefers Codex path before Claude path', () => {
  assert.equal(
    getDefaultDbPath('/home/demo'),
    '/home/demo/.codex/memories/skill-lens/skill-lens.db',
  );
});

test('resolveDbPath prefers explicit DB_PATH over defaults', () => {
  const env = {
    DB_PATH: '/data/custom.db',
  };

  assert.equal(resolveDbPath(env, '/home/demo'), '/data/custom.db');
});

test('resolveDbPath falls back to Claude path when Codex DB does not exist', () => {
  const env = {};
  const existing = new Set([
    '/home/demo/.claude/plugins/skill-lens/data/skill-lens.db',
  ]);

  assert.equal(
    resolveDbPath(env, '/home/demo', filePath => existing.has(filePath)),
    '/home/demo/.claude/plugins/skill-lens/data/skill-lens.db',
  );
});
