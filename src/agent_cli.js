// src/agent_cli.js
// Adapters that delegate a task to an external coding-agent CLI and capture the
// result as structured evidence. Nothing runs unless the binary is present and
// the caller explicitly invokes it.
const { spawnSync } = require('child_process');

const ADAPTERS = [
  {
    id: 'codex',
    bin: 'codex',
    buildArgs: (task, opts) => (opts && opts.fullAuto ? ['exec', '--full-auto', task] : ['exec', task]),
    notes: 'OpenAI Codex CLI',
  },
  {
    id: 'claude',
    bin: 'claude',
    buildArgs: (task) => ['-p', task],
    notes: 'Claude Code CLI (print mode)',
  },
  {
    id: 'aider',
    bin: 'aider',
    buildArgs: (task, opts) => ['--yes', '--message', task].concat((opts && opts.files) || []),
    notes: 'Aider',
  },
  {
    id: 'gemini',
    bin: 'gemini',
    buildArgs: (task) => ['-p', task],
    notes: 'Gemini CLI',
  },
];

function which(bin) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const r = spawnSync(cmd, [bin], { encoding: 'utf8', timeout: 5000 });
    if (r.status === 0) return String(r.stdout || '').split(/\r?\n/).filter(Boolean)[0] || bin;
  } catch (e) {}
  return null;
}

function detect() {
  return ADAPTERS.map((a) => ({ id: a.id, bin: a.bin, notes: a.notes, available: Boolean(which(a.bin)) }));
}

function get(id) { return ADAPTERS.find((a) => a.id === id) || null; }

/**
 * run(id, task, opts) -> { ok, agent, exitCode, stdout, stderr, duration }
 * opts: { cwd, timeoutMs, files, fullAuto, dryRun }
 */
function run(id, task, opts) {
  opts = opts || {};
  const adapter = get(id);
  if (!adapter) return { ok: false, error: 'unknown agent: ' + id };
  const binPath = which(adapter.bin);
  if (!binPath) return { ok: false, agent: id, error: 'binary not found on PATH: ' + adapter.bin };
  const args = adapter.buildArgs(task, opts);
  if (opts.dryRun) return { ok: true, agent: id, dryRun: true, bin: binPath, args };
  const started = Date.now();
  const r = spawnSync(binPath, args, {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    timeout: opts.timeoutMs || 300000,
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });
  return {
    ok: r.status === 0,
    agent: id,
    exitCode: r.status,
    stdout: String(r.stdout || '').slice(0, 200000),
    stderr: String(r.stderr || '').slice(0, 20000),
    duration: Date.now() - started,
    args,
  };
}

// Capture a delegation as an evidence record in the ledger.
function record(id, task, result) {
  try {
    const ledger = require('./ledger');
    ledger.append('agent_cli_delegation', { agent: id, task: String(task || '').slice(0, 500), ok: result.ok, exitCode: result.exitCode, duration: result.duration });
  } catch (e) {}
  return result;
}

module.exports = { ADAPTERS, detect, get, run, record, which };
