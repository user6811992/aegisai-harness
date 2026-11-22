const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
const hits = [];
for (const m of mods) {
  const text = fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/db\.(get|open|all|one|run)\s*\(/.test(line) && !/^\s/.test(line) && !line.trim().startsWith('//')) {
      hits.push(m + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
    }
  });
}
console.log('top-level db calls:', hits.length);
hits.forEach((h) => console.log(h));
