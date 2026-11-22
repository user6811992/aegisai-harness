// src/git_integration.js
// Git-aware editing: status, diff, commit, blame, branch, stash, log, auto-commit.
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function runGit(args, opts) {
  opts = opts || {};
  const cwd = opts.cwd || process.cwd();
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: opts.timeout || 30000 });
    return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim(), code: r.status };
  } catch (e) { return { ok: false, stdout: '', stderr: String(e.message || e), code: -1 }; }
}
function isRepo(cwd) { return runGit(['rev-parse', '--is-inside-work-tree'], { cwd }).ok; }
function status(cwd) {
  const r = runGit(['status', '--porcelain=v1', '-b'], { cwd });
  if (!r.ok) return { ok: false, error: r.stderr };
  const lines = r.stdout.split(/\r?\n/).filter(Boolean);
  const branch = lines.find((l) => l.startsWith('##')) || '';
  const files = lines.filter((l) => !l.startsWith('##')).map((l) => ({ status: l.slice(0, 2).trim(), file: l.slice(3) }));
  return { ok: true, branch: branch.replace(/^##\s*/, ''), files, clean: files.length === 0 };
}
function diff(cwd, opts) {
  opts = opts || {};
  const args = ['diff'];
  if (opts.staged) args.push('--cached');
  if (opts.file) args.push('--', opts.file);
  if (opts.stat) args.push('--stat');
  const r = runGit(args, { cwd });
  return { ok: r.ok, diff: r.stdout, error: r.stderr };
}
function log(cwd, n) {
  const r = runGit(['log', '--oneline', '-n', String(n || 20)], { cwd });
  return { ok: r.ok, commits: r.stdout.split(/\r?\n/).filter(Boolean), error: r.stderr };
}
function blame(cwd, file) {
  const r = runGit(['blame', '--porcelain', file], { cwd });
  if (!r.ok) return { ok: false, error: r.stderr };
  const lines = r.stdout.split(/\r?\n/);
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^([0-9a-f]{40})\s+\d+\s+\d+/);
    if (m) { cur = { commit: m[1].slice(0, 8) }; entries.push(cur); }
    else if (cur && line.startsWith('author ')) cur.author = line.slice(7);
    else if (cur && line.startsWith('summary ')) cur.summary = line.slice(8);
    else if (cur && /^\t/.test(line)) cur.line = line.slice(1);
  }
  return { ok: true, entries: entries.slice(0, 50) };
}
function branch(cwd, name) {
  if (!name) {
    const r = runGit(['branch', '-a'], { cwd });
    return { ok: r.ok, branches: r.stdout.split(/\r?\n/).filter(Boolean).map((b) => b.trim()), current: r.stdout.split(/\r?\n/).find((b) => b.trim().startsWith('*')) };
  }
  const r = runGit(['checkout', '-b', name], { cwd });
  return { ok: r.ok, output: r.stdout || r.stderr };
}
function stash(cwd, action) {
  action = action || 'push';
  const r = runGit(['stash', action], { cwd });
  return { ok: r.ok, output: r.stdout || r.stderr };
}
function commit(cwd, message, files) {
  if (files && files.length) {
    const add = runGit(['add', ...files], { cwd });
    if (!add.ok) return { ok: false, error: add.stderr };
  } else {
    const add = runGit(['add', '-A'], { cwd });
    if (!add.ok) return { ok: false, error: add.stderr };
  }
  const r = runGit(['commit', '-m', message || 'auto-commit'], { cwd });
  return { ok: r.ok, output: r.stdout || r.stderr };
}
function autoCommit(cwd, message, files) {
  const st = status(cwd);
  if (!st.ok || st.clean) return { ok: true, skipped: true, reason: 'nothing to commit' };
  return commit(cwd, message || 'auto: agent changes', files);
}
function show(cwd, ref) {
  const r = runGit(['show', ref || 'HEAD', '--stat'], { cwd });
  return { ok: r.ok, output: r.stdout, error: r.stderr };
}
function reset(cwd, ref, hard) {
  const args = ['reset'];
  if (hard) args.push('--hard');
  args.push(ref || 'HEAD');
  const r = runGit(args, { cwd });
  return { ok: r.ok, output: r.stdout || r.stderr };
}

module.exports = { runGit, isRepo, status, diff, log, blame, branch, stash, commit, autoCommit, show, reset };
