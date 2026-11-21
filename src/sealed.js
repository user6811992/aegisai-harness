// src/sealed.js
// Sealed execution: run commands in a Docker container with default-deny network.
const { spawnSync } = require('child_process');
const path = require('path');

function available() {
  try { const r = spawnSync('docker', ['--version'], { encoding: 'utf8', timeout: 3000 }); return r.status === 0; } catch (e) { return false; }
}

function run(command, opts) {
  opts = opts || {};
  if (!available()) return { ok: false, error: 'docker not available' };
  const image = opts.image || 'node:22-alpine';
  const args = ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '-w', '/work', '-v', path.resolve(opts.cwd || process.cwd()) + ':/work:ro', image, 'sh', '-c', command];
  try {
    const r = spawnSync('docker', args, { encoding: 'utf8', timeout: opts.timeout || 60000 });
    return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '', status: r.status };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

module.exports = { available, run };
