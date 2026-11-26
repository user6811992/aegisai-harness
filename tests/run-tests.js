const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-test-'));
process.env.AEGISAI_DATA_DIR = tmp;

const r = spawnSync(process.execPath, ['--test', '--test-force-exit', 'tests/**/*.test.js'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
});

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}

process.exit(r.status == null ? 1 : r.status);
