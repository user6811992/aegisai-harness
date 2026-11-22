const fs = require('fs');
const p = process.argv[2];
const n = parseInt(process.argv[3] || '30');
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
console.log(lines.slice(-n).join('\n'));
