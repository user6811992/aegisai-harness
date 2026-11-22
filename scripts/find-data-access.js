const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
const suspicious = [];
for (const m of mods) {
  const text = fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/DATA_DIR|data\//.test(line) && !/^\s/.test(line) && !line.trim().startsWith('//')) {
      suspicious.push(m + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
    }
  });
}
console.log('top-level data access:', suspicious.length);
suspicious.forEach((s) => console.log(s));
