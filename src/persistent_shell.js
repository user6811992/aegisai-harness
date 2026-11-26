// src/persistent_shell.js
// Persistent shell session across tool calls with SQLite-backed state.
// Maintains a long-running shell process with state persisted to SQLite,
// enabling state survival across agent restarts and tool call boundaries.
const { spawn } = require('child_process');
const fs = require('fs');
const { open } = require('./storage/db');
const path = require('path');
const os = require('os');

// Default database path: <cwd>/.aegisai/shell-state.db
const dbDir = path.join(process.cwd(), '.aegisai');
const defaultDbPath = path.join(dbDir, 'shell-state.db');

// Ensure the database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure the shell_states table exists (best-effort; skip if DB not yet migrated)
function ensureShellStatesTable() {
  try {
    const db = open(defaultDbPath);
    db.exec('CREATE TABLE IF NOT EXISTS shell_states (session_id TEXT PRIMARY KEY, buffer TEXT, exit_code INTEGER, ended TEXT, created TEXT)');
    db.close();
  } catch (e) {
    // Best-effort; table will be created on first use via open()
  }
}

// Ensure table exists on module load
ensureShellStatesTable();

let shell = null;
let buffer = '';
let currentSessionId = null;
let db = null;

function ensureDb() {
  if (!db) {
    db = open(defaultDbPath);
  }
  return db;
}

function persistState(sessionId, state) {
  try {
    const db = ensureDb();
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO shell_states (session_id, buffer, exit_code, ended, created) VALUES (?,?,?,?,?)'
    );
    stmt.run(sessionId, state.buffer, state.exitCode, state.ended, state.created);
    stmt.finalize();
  } catch (e) {
    // Best-effort persistence; don't crash if DB unavailable
  }
}

function loadState(sessionId) {
  try {
    const db = ensureDb();
    const row = db.prepare('SELECT buffer, exit_code, ended FROM shell_states WHERE session_id = ?').get(sessionId);
    if (row) {
      buffer = row.buffer || '';
      return { exitCode: row.exit_code, ended: row.ended };
    }
  } catch (e) {
    // Best-effort
  }
  return null;
}

function clearState(sessionId) {
  try {
    const db = ensureDb();
    db.prepare('DELETE FROM shell_states WHERE session_id = ?').run(sessionId);
  } catch (e) {
    // Best-effort
  }
}

function start(sessionId) {
  // If shell already running for this session, return it
  if (shell && currentSessionId === sessionId) return shell;

  // Clear any previous state for this session
  clearState(sessionId);

  // If shell running for another session, kill it
  if (shell && currentSessionId !== sessionId) {
    try { shell.kill(); } catch (e) {}
  }

  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  shell = spawn(cmd, [], { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  currentSessionId = sessionId;

  shell.stdout.on('data', (d) => { buffer += d.toString(); });
  shell.stderr.on('data', (d) => { buffer += d.toString(); });
  shell.on('exit', (code) => {
    buffer += '\n[Shell exited with code ' + code + ']';
    currentSessionId = null;
    shell = null;
    // Persist final state
    persistState(sessionId, { buffer, exitCode: code, ended: new Date().toISOString() });
  });

  return shell;
}

function exec(command, timeoutMs, sessionId) {
  sessionId = sessionId || 'default';
  const s = start(sessionId);
  const before = buffer.length;
  buffer = '';
  return new Promise((resolve) => {
    const to = setTimeout(() => {
      resolve({ ok: true, output: buffer, timedOut: true, sessionId });
    }, timeoutMs || 5000);
    s.stdin.write(String(command) + '\n');
    // Give the shell time to produce output.
    setTimeout(() => {
      clearTimeout(to);
      resolve({ ok: true, output: buffer, sessionId });
    }, 200);
  });
}

function stop(sessionId) {
  sessionId = sessionId || 'default';
  if (shell) { try { shell.kill(); } catch (e) {} shell = null; }
  currentSessionId = null;
  buffer = '';
  // Persist cleared state
  persistState(sessionId, { buffer: '', exitCode: null, ended: new Date().toISOString() });
}

function isRunning(sessionId) {
  sessionId = sessionId || 'default';
  return !!shell && currentSessionId === sessionId;
}

// Initialize: load any persisted state from previous runs
// Use a default session if no ID provided; this allows a single retained shell state
(() => {
  try {
    const db = ensureDb();
    const row = db.prepare('SELECT session_id, buffer, exit_code, ended FROM shell_states ORDER BY created DESC LIMIT 1').get();
    if (row && row.buffer) {
      buffer = row.buffer;
      currentSessionId = row.session_id;
      // If shell exited, we keep the buffered output but don't start a new shell automatically
    }
  } catch (e) {
    // Best-effort; if DB not migrated yet, just start fresh
  }
})();

module.exports = { start, exec, stop, isRunning, persistState, loadState, clearState };