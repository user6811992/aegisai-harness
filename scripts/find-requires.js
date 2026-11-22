const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
const suspicious = [];
for (const m of mods) {
  const text = fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  // find top-level readFileSync (not inside function): lines not indented
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/readFileSync|readdirSync|existsSync/.test(line) && !/^\s/.test(line) && !line.trim().startsWith('//')) {
      suspicious.push(m + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
    }
  });
}
console.log('suspicious top-level fs calls:', suspicious.length);
suspicious.forEach((s) => console.log(s));
