// src/bug_repro.js
// Bug reproduction workflow: clone → inspect → write failing test → run (example-bug-repro).
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { runAgent } = require('./agent/run');

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 });
}
function clone(repo, dest) {
  const r = git(['clone', repo, dest], process.cwd());
  return { ok: r.status === 0, output: r.stderr || r.stdout || '' };
}
async function reproduce(repo, report, opts) {
  opts = opts || {};
  const dest = opts.dest || path.join(require('os').tmpdir(), 'bugrepro-' + Date.now());
  const c = clone(repo, dest);
  if (!c.ok) return { ok: false, stage: 'clone', error: c.output };
  const prompt = 'Bug report:\n' + report + '\n\nRepository cloned at ' + dest + '. Inspect the code, write a failing test that reproduces the bug, then run it. Explain the root cause.';
  const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: dest, autoApprove: true, onEvent: () => {} });
  const final = (r.final && r.final.final) || '';
  return { ok: true, stages: ['clone', 'inspect', 'write-test', 'run'], dest, output: final.slice(0, 4000), toolLog: r.toolLog || [] };
}

module.exports = { clone, reproduce };
