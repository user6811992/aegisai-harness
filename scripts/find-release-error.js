const fs = require('fs');
const { execSync } = require('child_process');
const log = execSync('gh run view 45084137838 --log', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const lines = log.split(/\r?\n/);
const errors = lines.filter((l) => /error|fail|not found|cannot/i.test(l));
console.log('error lines:', errors.length);
errors.slice(0, 15).forEach((l) => console.log(l.slice(0, 200)));
