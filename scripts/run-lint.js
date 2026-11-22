const r = require('../src/harness_lint').lint();
console.log(JSON.stringify(r, null, 2).slice(0, 4000));
if (!r.ok) process.exit(1);
