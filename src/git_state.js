// src/git_state.js
// Git-backed state store: commit harness state snapshots to a git repo (opencomputer pattern).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function git(args, cwd) { return spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 }); }
function init(repo) {
  if (!fs.existsSync(repo)) fs.mkdirSync(repo, { recursive: true });
  const r = git(['init'], repo);
  return { ok: r.status === 0, output: r.stderr || '' };
}
function commit(repo, message) {
  git(['add', '-A'], repo);
  const r = git(['commit', '-m', message || 'harness state snapshot'], repo);
  return { ok: r.status === 0, output: r.stdout || r.stderr || '' };
}
function snapshot(repo, state) {
  const p = repo || path.join(DATA_DIR, 'git-state');
  init(p);
  fs.writeFileSync(path.join(p, 'state.json'), JSON.stringify(state || {}, null, 2));
  return commit(p, 'state snapshot ' + new Date().toISOString());
}
function history(repo) {
  const r = git(['log', '--oneline', '-10'], repo || path.join(DATA_DIR, 'git-state'));
  return (r.stdout || '').split(/\r?\n/).filter(Boolean);
}

module.exports = { init, commit, snapshot, history };
