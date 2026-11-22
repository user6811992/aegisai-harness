const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
const idx = lines.findIndex((l) => l.includes('not ok 8 - harness lint returns ok'));
console.log(lines.slice(idx, idx + 25).join('\n'));
