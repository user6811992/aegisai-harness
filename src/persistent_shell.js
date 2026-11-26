// src/persistent_shell.js
// Persistent shell session across tool calls (best-effort, local only).
const { spawn } = require('child_process');

let shell = null;
let buffer = '';

function start() {
  if (shell) return shell;
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  shell = spawn(cmd, [], { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  shell.stdout.on('data', (d) => { buffer += d.toString(); });
  shell.stderr.on('data', (d) => { buffer += d.toString(); });
  shell.on('exit', () => { shell = null; });
  return shell;
}

function exec(command, timeoutMs) {
  const s = start();
  const before = buffer.length;
  buffer = '';
  return new Promise((resolve) => {
    const to = setTimeout(() => {
      resolve({ ok: true, output: buffer, timedOut: true });
    }, timeoutMs || 5000);
    s.stdin.write(String(command) + '\n');
    // Give the shell time to produce output.
    setTimeout(() => {
      clearTimeout(to);
      resolve({ ok: true, output: buffer });
    }, 200);
  });
}

function stop() {
  if (shell) { try { shell.kill(); } catch (e) {} shell = null; }
  buffer = '';
}

function isRunning() { return !!shell; }

module.exports = { start, exec, stop, isRunning };
