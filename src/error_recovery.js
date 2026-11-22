// src/error_recovery.js
// Multi-turn automated error recovery policy (retry, fallback, skip, abort).
const POLICIES = {
  tool_error: { maxRetries: 2, action: 'retry' },
  backend: { maxRetries: 3, action: 'fallback' },
  budget: { maxRetries: 0, action: 'abort' },
  approval: { maxRetries: 0, action: 'skip' },
  unknown: { maxRetries: 1, action: 'retry' },
};
function decide(category, attempts) {
  const p = POLICIES[category] || POLICIES.unknown;
  if (attempts < p.maxRetries) return { action: p.action, retry: true, attempts: attempts + 1 };
  return { action: p.action, retry: false, attempts, reason: 'max retries reached' };
}

module.exports = { POLICIES, decide };
