const fs = require('fs');
const path = require('path');
function walk(dir, exts, exclude) {
  const out = [];
  function rec(d) {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (exclude.some((x) => e.name === x)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(path.relative(dir, p));
    }
  }
  rec(dir);
  return out;
}
const harness = walk('C:\\Users\\Poonjab\\Documents\\Default Project\\aegisai-harness', ['.js', '.html', '.css', '.md'], ['.git', 'node_modules', 'data', 'dist']);
const next = walk('C:\\Users\\Poonjab\\Documents\\Default Project\\aegisai-next', ['.js', '.html', '.css', '.md', '.jsx', '.tsx'], ['.git', 'node_modules', 'dist', 'build']);
const fs2 = require('fs');
const out = [];
out.push('=== HARNESS FILES (' + harness.length + ') ===');
harness.forEach((f) => out.push(f));
out.push('');
out.push('=== AEGISAI-NEXT FILES (' + next.length + ') ===');
next.forEach((f) => out.push(f));
fs2.writeFileSync('C:\\Users\\Poonjab\\Documents\\Default Project\\aegisai-harness\\compare.txt', out.join('\n'));
