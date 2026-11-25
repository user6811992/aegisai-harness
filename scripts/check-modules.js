const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'index.js') {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const mods = walk(SRC);
let errors = 0;
for (const full of mods) {
  const rel = path.relative(ROOT, full);
  try { require(full); }
  catch (e) { errors++; console.log('FAIL:', rel, '->', String(e.message || e)); }
}
console.log('checked', mods.length, 'modules,', errors, 'errors');