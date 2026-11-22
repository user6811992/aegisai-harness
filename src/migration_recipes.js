// src/migration_recipes.js
// File-by-file harness config migration recipes.
const RECIPES = {
  'claude -> aegisai': [
    { from: 'CLAUDE.md', to: 'AGENTS.md', transform: 'copy' },
    { from: '.claude/settings.json', to: 'data/config.json', transform: 'merge-permissions' },
    { from: '.mcp.json', to: 'mcp.json', transform: 'copy' },
    { from: '.claude/skills/', to: 'data/skills/', transform: 'import-skills' },
  ],
  'codex -> aegisai': [
    { from: 'AGENTS.md', to: 'AGENTS.md', transform: 'keep' },
    { from: 'config.toml', to: 'data/config.json', transform: 'map-model-provider' },
  ],
  'cursor -> aegisai': [
    { from: '.cursorrules', to: 'AGENTS.md', transform: 'wrap-as-markdown' },
    { from: '.cursor/mcp.json', to: 'mcp.json', transform: 'copy' },
  ],
};
function list() { return Object.keys(RECIPES); }
function get(name) { return RECIPES[name] || null; }

module.exports = { RECIPES, list, get };
