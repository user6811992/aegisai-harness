const fs = require('fs');
const log = fs.readFileSync('npm-run-log.txt', 'utf8');
const lines = log.split(/\r?\n/);
// Find lines around "npm publish" step
const publishStart = lines.findIndex((l) => l.includes('npm publish --access public'));
const publishEnd = lines.findIndex((l, i) => i > publishStart && l.includes('##[endgroup]') && i > publishStart + 5);
console.log('publish step lines:', publishStart, 'to', publishEnd);
const relevant = lines.slice(publishStart, publishEnd + 1);
// Filter for key lines
const key = relevant.filter((l) => /npm notice (version|name|Publishing|published|error|Error|warn|provenance|422|403|401|E4|success|fail)/i.test(l));
console.log('key lines:', key.length);
key.forEach((l) => console.log(l.slice(0, 200)));
// Also check for any error
const errors = lines.filter((l) => /npm error/i.test(l));
console.log('\nerrors:', errors.length);
errors.forEach((l) => console.log(l.slice(0, 200)));
