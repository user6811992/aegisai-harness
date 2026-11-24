const fs = require('fs');
const { execSync } = require('child_process');
const log = execSync('gh run view 45300368970 --log', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const lines = log.split(/\r?\n/);
// Find the steps
const steps = lines.filter((l) => /##\[group\]Run /i.test(l));
console.log('Steps:', steps.length);
steps.forEach((s) => console.log(s.slice(0, 100)));
// Find error lines (not npm test)
const errors = lines.filter((l) => /error|fail/i.test(l) && !/npm test/i.test(l) && !/✔|ℹ/.test(l));
console.log('\nerror lines:', errors.length);
errors.slice(0, 15).forEach((l) => console.log(l.slice(0, 200)));
