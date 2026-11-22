const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
let errors = 0;
for (const m of mods) {
  try { require(path.join(ROOT, 'src', m)); }
  catch (e) { errors++; console.log('FAIL:', m, '->', String(e.message || e)); }
}
console.log('checked', mods.length, 'modules,', errors, 'errors');
