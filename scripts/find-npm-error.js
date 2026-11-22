const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
const fails = lines.filter((l) => /error|fail|Error/i.test(l));
console.log('FAIL LINES:', fails.length);
fails.slice(0, 20).forEach((l) => console.log(l.slice(0, 300)));
