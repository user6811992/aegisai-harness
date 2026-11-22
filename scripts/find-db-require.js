const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
const dbUsers = [];
for (const m of mods) {
  const text = fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  if (/require\(['"]\.\/storage\/db['"]\)|require\(['"]\.\.\/storage\/db['"]\)/.test(text)) dbUsers.push(m);
}
console.log('modules requiring db:', dbUsers.length);
dbUsers.forEach((m) => console.log(m));
