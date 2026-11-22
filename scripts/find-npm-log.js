const fs = require('fs');
const { execSync } = require('child_process');
// Write the log to a file first
try {
  const log = execSync('gh run view 45083906462 --log', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync('npm-run-log.txt', log);
  const lines = log.split(/\r?\n/);
  const relevant = lines.filter((l) => /publish|error|fail|422|403|401|success|E4|npm notice version|npm notice name/i.test(l));
  console.log('relevant lines:', relevant.length);
  relevant.slice(0, 30).forEach((l) => console.log(l.slice(0, 200)));
} catch (e) {
  console.log('error:', e.message);
}
