const fs = require('fs');
const { execSync } = require('child_process');
const log = execSync('gh run view 45300807175 --log', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const lines = log.split(/\r?\n/);
const failing = lines.filter((l) => /failing tests|AssertionError|Expected values|actual:|expected:/i.test(l));
console.log('failing lines:', failing.length);
failing.slice(0, 10).forEach((l) => console.log(l.slice(0, 300)));
// Find the test name
const testName = lines.filter((l) => /✖/i.test(l));
console.log('\ntest failures:', testName.length);
testName.forEach((l) => console.log(l.slice(0, 200)));
