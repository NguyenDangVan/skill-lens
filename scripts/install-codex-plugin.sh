#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_NAME="skill-lens"
TARGET_PLUGIN_DIR="${HOME}/plugins/${PLUGIN_NAME}"
TARGET_MARKETPLACE_DIR="${HOME}/.agents/plugins"
TARGET_MARKETPLACE_FILE="${TARGET_MARKETPLACE_DIR}/marketplace.json"

mkdir -p "${HOME}/plugins"
mkdir -p "${TARGET_MARKETPLACE_DIR}"

if [ -e "${TARGET_PLUGIN_DIR}" ] && [ ! -L "${TARGET_PLUGIN_DIR}" ]; then
  echo "Refusing to overwrite existing non-symlink path: ${TARGET_PLUGIN_DIR}" >&2
  exit 1
fi

ln -sfn "${ROOT_DIR}" "${TARGET_PLUGIN_DIR}"

TARGET_MARKETPLACE_FILE="${TARGET_MARKETPLACE_FILE}" node <<'EOF'
const fs = require('node:fs');

const marketplacePath = process.env.TARGET_MARKETPLACE_FILE;
const nextEntry = {
  name: 'skill-lens',
  source: {
    source: 'local',
    path: './plugins/skill-lens',
  },
  policy: {
    installation: 'AVAILABLE',
    authentication: 'ON_INSTALL',
  },
  category: 'Productivity',
};

let payload;
if (fs.existsSync(marketplacePath)) {
  payload = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
} else {
  payload = {
    name: 'vannd1-local',
    interface: {
      displayName: 'vannd1 Local Plugins',
    },
    plugins: [],
  };
}

if (!Array.isArray(payload.plugins)) {
  throw new Error('marketplace.json must contain a plugins array');
}

const existingIndex = payload.plugins.findIndex(
  plugin => plugin && plugin.name === nextEntry.name,
);

if (existingIndex >= 0) {
  payload.plugins[existingIndex] = nextEntry;
} else {
  payload.plugins.push(nextEntry);
}

if (!payload.name) {
  payload.name = 'vannd1-local';
}

if (!payload.interface || typeof payload.interface !== 'object') {
  payload.interface = { displayName: 'vannd1 Local Plugins' };
}

if (!payload.interface.displayName) {
  payload.interface.displayName = 'vannd1 Local Plugins';
}

fs.writeFileSync(marketplacePath, `${JSON.stringify(payload, null, 2)}\n`);
EOF

cat <<EOF
Installed local Codex plugin:
  Plugin path: ${TARGET_PLUGIN_DIR}
  Marketplace: ${TARGET_MARKETPLACE_FILE}

Recommended environment:
  export SKILL_LENS_ROOT="${ROOT_DIR}"

If your analytics DB is elsewhere:
  export DB_PATH="/path/to/skill-lens.db"
EOF
