// src/isolation.js
// Per-session sandbox policy (aegisai-next server/runtime/isolation.js).
const security = require('./core/security');

const JOB_URL_KEYS = ['url', 'target', 'endpoint', 'href', 'link'];
const DEFAULT_MAX_JOBS = 100;

function createSessionPolicy(opts) {
  opts = opts || {};
  const policy = {
    root: null,
    cleanRoom: !!opts.cleanRoom,
    allowedTools: Array.isArray(opts.allowedTools) ? opts.allowedTools.slice() : null,
    deniedTools: Array.isArray(opts.deniedTools) ? opts.deniedTools.slice() : null,
    maxJobs: (typeof opts.maxJobs === 'number' && opts.maxJobs > 0) ? Math.floor(opts.maxJobs) : DEFAULT_MAX_JOBS,
    jobs: 0,
  };
  if (typeof opts.root === 'string' && opts.root.trim()) {
    try { policy.root = (typeof security.validateProjectRoot === 'function') ? security.validateProjectRoot(opts.root) : opts.root; } catch (e) { policy.root = opts.root; }
  }
  return policy;
}
function checkJobAgainstPolicy(policy, job) {
  policy = policy || {};
  job = job || {};
  if (typeof policy.maxJobs === 'number' && (policy.jobs || 0) >= policy.maxJobs) return { ok: false, blocked: true, reason: 'session job limit reached' };
  for (const key of JOB_URL_KEYS) {
    const v = job[key];
    if (typeof v === 'string' && v.trim()) {
      const isSafe = require('./url_validate').validate(v).ok;
      if (!isSafe) return { ok: false, blocked: true, reason: 'unsafe job target blocked by sandbox: ' + key };
    }
  }
  return { ok: true, blocked: false };
}

module.exports = { createSessionPolicy, checkJobAgainstPolicy, JOB_URL_KEYS, DEFAULT_MAX_JOBS };
