// src/runtime_manager.js
// Detect, register, and launch AI agent runtimes/harnesses available on this machine.
const fs = require('fs');
const path = require('path');
const db = require('./storage/db');

const KNOWN = ['claude', 'codex', 'gemini', 'opencode', 'cline', 'goose', 'pi', 'aider', 'qwen', 'openhands'];

function detect() {
  const found = [];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of KNOWN) {
    for (const d of dirs) {
      try {
        const p = path.join(d, name + (process.platform === 'win32' ? '.cmd' : ''));
        if (fs.existsSync(p)) { found.push({ name, path: p }); break; }
      } catch (e) {}
    }
  }
  return found;
}

function register(name, command) {
  try { db.get().prepare('INSERT OR REPLACE INTO runtimes (name, command, created) VALUES (?,?,?)').run(name, command, new Date().toISOString()); } catch (e) {}
  return { name, command };
}
function list() {
  try { return db.get().prepare('SELECT * FROM runtimes ORDER BY created DESC').all(); } catch (e) { return []; }
}
function launch(name, args, opts) {
  const r = list().find((x) => x.name === name);
  if (!r) return { ok: false, error: 'no runtime: ' + name };
  const { spawn } = require('child_process');
  try {
    const p = spawn(r.command, args || [], { cwd: (opts && opts.cwd) || process.cwd(), stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('error', () => {});
    return { ok: true, pid: p.pid };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

module.exports = { KNOWN, detect, register, list, launch };
