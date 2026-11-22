const r = require('../src/adversarial').run();
console.log(JSON.stringify(r, null, 2));
if (!r.pass) process.exit(1);
