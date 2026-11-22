// src/podman.js
// Rootless Podman per-session isolation backend (opencomputer pattern), with sealed fallback.
const { spawnSync } = require('child_process');

function available() {
  try { const r = spawnSync('podman', ['--version'], { encoding: 'utf8', timeout: 3000 }); return r.status === 0; } catch (e) { return false; }
}
function runSession(command, opts) {
  opts = opts || {};
  if (!available()) return require('./sealed').run(command, opts);
  const args = ['run', '--rm', '--network', 'none', '-w', '/work', '-v', (opts.cwd || process.cwd()) + ':/work:z', 'docker.io/library/alpine:latest', 'sh', '-c', command];
  try {
    const r = spawnSync('podman', args, { encoding: 'utf8', timeout: opts.timeout || 60000 });
    return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '', backend: 'podman' };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
function status() { return { podman: available(), docker: require('./sealed').available() }; }

module.exports = { available, runSession, status };
