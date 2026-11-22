const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
const hits = [];
for (const m of mods) {
  const text = fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  const re = /require\(['"]node:[^'"]+['"]\)/g;
  let mm;
  while ((mm = re.exec(text))) hits.push(m + ': ' + mm[0]);
}
console.log('node: imports:', hits.length);
[...new Set(hits.map((h) => h.split(':')[1].trim()))].forEach((h) => console.log(h));
