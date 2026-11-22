const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
const fails = lines.filter((l) => /not ok|AssertionError|Error:|FAIL/.test(l));
console.log('FAIL LINES:', fails.length);
fails.slice(0, 30).forEach((l) => console.log(l.slice(0, 400)));
