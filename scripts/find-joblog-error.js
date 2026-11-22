const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
const fails = lines.filter((l) => /not ok|AssertionError|Error:|FAIL/i.test(l));
console.log('size:', s.length, 'fails:', fails.length);
fails.slice(0, 15).forEach((l) => console.log(l.slice(0, 250)));
