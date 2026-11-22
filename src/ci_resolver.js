// src/ci_resolver.js
// CI failure resolver with per-repository GitHub reach allowlist (opencomputer-example-ci-resolver).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const { runAgent } = require('./agent/run');

const FILE = () => path.join(DATA_DIR, 'ci-allowlist.json');
function setAllowlist(repos) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(repos, null, 2)); return repos; }
function allowlist() { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch (e) { return []; } }
function allowed(repo) { return allowlist().includes(repo); }

async function resolve(repo, logs, opts) {
  opts = opts || {};
  if (!allowed(repo)) return { ok: false, error: 'repository not in CI allowlist: ' + repo };
  const prompt = 'This CI run failed in repo ' + repo + '. Diagnose the failure from the logs and propose a minimal fix.\n\n' + String(logs).slice(0, 6000);
  const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} });
  return { ok: true, repo, analysis: (r.final && r.final.final) || '', reach: 'allowlisted' };
}

module.exports = { setAllowlist, allowlist, allowed, resolve };
