// src/mcp_skills.js
// Skills over MCP: discover/distribute skills via MCP primitives (modelcontextprotocol/ext-skills).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function list() {
  const dir = path.join(DATA_DIR, 'skills');
  let out = [];
  try { out = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ name: f.slice(0, -3), uri: 'skill://' + f.slice(0, -3) })); } catch (e) {}
  return out;
}
function get(name) {
  const p = path.join(DATA_DIR, 'skills', name + '.md');
  try { return { name, uri: 'skill://' + name, content: fs.readFileSync(p, 'utf8') }; } catch (e) { return null; }
}

module.exports = { list, get };
