// src/lean_verify.js
// Optional formal-verification tool: check a Lean 4 project with `lake env lean`.
// Inspired by eelbaz/Rule30PrizeKit. Heavy dependency (~6 GB Mathlib) is NOT
// bundled — this module detects availability and returns a clear status.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function available() {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['lake'], { encoding: 'utf8', timeout: 3000 });
  const hasLake = r.status === 0 && r.stdout.trim();
  const l = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['lean'], { encoding: 'utf8', timeout: 3000 });
  return {
    lake: !!hasLake,
    lean: l.status === 0 && !!l.stdout.trim(),
    note: hasLake ? 'Lean toolchain detected' : 'Lean 4 not installed — install elan + Mathlib (see docs/LEAN_VERIFY.md)',
  };
}

function verify(projectDir, opts) {
  opts = opts || {};
  const det = available();
  if (!det.lake) return { ok: false, available: false, note: det.note };
  if (!projectDir || !fs.existsSync(projectDir)) {
    return { ok: false, available: true, error: 'project directory not found: ' + projectDir };
  }
  const file = opts.file;
  const target = file ? path.join(projectDir, file) : path.join(projectDir, 'lakefile.toml');
  if (file && !fs.existsSync(target)) return { ok: false, available: true, error: 'file not found: ' + target };
  const args = file ? ['env', 'lean', target] : ['build'];
  const r = spawnSync('lake', args, { cwd: projectDir, encoding: 'utf8', timeout: opts.timeoutMs || 120000 });
  return {
    ok: r.status === 0,
    available: true,
    project: projectDir,
    command: 'lake ' + args.join(' '),
    stdout: (r.stdout || '').slice(-4000),
    stderr: (r.stderr || '').slice(-4000),
    exitCode: r.status,
    error: r.error ? String(r.error.message || r.error) : undefined,
  };
}

function tools() {
  return [
    { name: 'lean_verify_status', description: 'Check whether the optional Lean 4 formal-verification toolchain is available.', inputSchema: { type: 'object' } },
    { name: 'lean_verify_project', description: 'Verify a Lean 4 project with lake (opt-in, heavy toolchain).', inputSchema: { type: 'object', properties: { projectDir: { type: 'string' }, file: { type: 'string' } }, required: ['projectDir'] } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'lean_verify_status') return available();
  if (name === 'lean_verify_project') return verify(args.projectDir, args);
  throw new Error('unknown lean_verify tool: ' + name);
}

module.exports = { available, verify, tools, dispatch };
