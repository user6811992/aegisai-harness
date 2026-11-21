// src/config_toml.js
// Minimal TOML parser (subset) for route configuration.
function parse(text) {
  const result = {};
  let current = result;
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    // section header
    const sec = line.match(/^\[([^\]]+)\]$/);
    if (sec) {
      const path = sec[1].split('.');
      let obj = result;
      for (const p of path) {
        if (!obj[p]) obj[p] = {};
        obj = obj[p];
      }
      current = obj;
      continue;
    }
    const kv = line.match(/^([\w-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    // string
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
    else if (/^-?\d+\.\d+$/.test(val)) val = parseFloat(val);
    else if (val.startsWith('[') && val.endsWith(']')) {
      // simple array of strings
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    current[key] = val;
  }
  return result;
}

function loadConfig(filePath) {
  const fs = require('fs');
  const text = fs.readFileSync(filePath, 'utf8');
  return parse(text);
}

module.exports = { parse, loadConfig };
