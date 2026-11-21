// src/themes.js
// CLI themes (colors) for the harness REPL.
const THEMES = {
  dark: { tool: '\x1b[36m', result: '\x1b[90m', status: '\x1b[33m', final: '\x1b[32m', reset: '\x1b[0m' },
  light: { tool: '\x1b[34m', result: '\x1b[90m', status: '\x1b[31m', final: '\x1b[32m', reset: '\x1b[0m' },
  none: { tool: '', result: '', status: '', final: '', reset: '' },
};
function get(name) { return THEMES[name || 'dark'] || THEMES.dark; }
function color(name, key, text) { const t = get(name); return t[key] + text + t.reset; }
function list() { return Object.keys(THEMES); }

module.exports = { THEMES, get, color, list };
