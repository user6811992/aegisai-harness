const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) {
      const text = fs.readFileSync(p, 'utf8');
      const re = /require\(['"]node:[^'"]+['"]\)/g;
      let m;
      while ((m = re.exec(text))) console.log(path.relative(ROOT, p) + ': ' + m[0]);
    }
  }
}
walk(path.join(ROOT, 'src'));
