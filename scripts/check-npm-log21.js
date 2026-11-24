const fs = require('fs');
const { execSync } = require('child_process');
const log = execSync('gh run view 45310974939 --log', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const lines = log.split(/\r?\n/);
// Find the v044 test details
const v044 = lines.filter((l) => l.includes('v044'));
console.log('v044 lines:', v044.length);
v044.forEach((l) => console.log(l.slice(0, 200)));
// Find harness lint details
const lint = lines.filter((l) => l.includes('harness lint') || l.includes('lint returns'));
console.log('\nlint lines:', lint.length);
lint.forEach((l) => console.log(l.slice(0, 200)));
