// src/core/security.js
// Path safety + process spawning helpers. All file ops must go through safePath.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function safePath(root, rel) {
  const r = path.resolve(root, rel || '.');
  const rootResolved = path.resolve(root);
  if (r !== rootResolved && !r.startsWith(rootResolved + path.sep)) {
    throw new Error('path traversal blocked: ' + rel);
  }
  return r;
}

function runProcess(cmd, args, opts) {
  opts = opts || {};
  const cwd = opts.cwd || process.cwd();
  const timeout = opts.timeout || 60000;
  const shell = !!opts.shell;
  const env = opts.env || process.env;
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    let killed = false;
    const proc = spawn(cmd, args || [], { cwd, shell, windowsHide: true, env });
    const timer = setTimeout(() => { killed = true; try { proc.kill('SIGKILL'); } catch (e) {} }, timeout);
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, output: 'spawn error: ' + (e.message || e), stdout, stderr }); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return resolve({ ok: false, output: 'timeout after ' + timeout + 'ms', stdout, stderr });
      const ok = code === 0;
      resolve({ ok, code, output: (stdout || '') + (stderr ? '\n' + stderr : ''), stdout, stderr });
    });
  });
}

function isDangerousCmd(cmd) {
  if (typeof cmd !== 'string') return true;
  const bad = [/\brm\s+-rf\b/i, /\bdel\s+\/[sqf]/i, /\bformat\b/i, /\bmkfs\b/i, /:\(\)\s*\{/, /\bshutdown\b/i, /\breboot\b/i];
  return bad.some((r) => r.test(cmd));
}

module.exports = { safePath, runProcess, isDangerousCmd };
