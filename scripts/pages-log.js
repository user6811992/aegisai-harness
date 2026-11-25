const { execSync } = require('child_process');
const id = process.argv[2];
const log = execSync('gh run view ' + id + ' --log', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const lines = log.split(/\r?\n/);
for (const l of lines) {
  if (/error|Error|tar:|No files|cannot/i.test(l)) console.log(l.slice(0, 300));
}
