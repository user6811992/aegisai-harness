// src/governance.js
// Aegis governance patterns: baseline-first, evidence-verified, drift-checked.
// Adapted from GanyuanRan/Aegis method pack for integration into the agent loop.

// Track baseline state for drift detection.
let baseline = null;
let evidenceLog = [];

function setBaseline(state) {
  baseline = { ...state, ts: Date.now() };
  evidenceLog = [];
}

function getBaseline() { return baseline; }

function recordEvidence(entry) {
  evidenceLog.push({ ...entry, ts: Date.now() });
}

function getEvidence() { return [...evidenceLog]; }

// Check if there is sufficient evidence to claim completion.
function hasSufficientEvidence(opts) {
  opts = opts || {};
  const minEvidence = opts.minEvidence || 1;
  if (evidenceLog.length < minEvidence) return { sufficient: false, reason: 'insufficient evidence: ' + evidenceLog.length + ' < ' + minEvidence };
  // Check for verification evidence specifically (not just tool results).
  const hasVerification = evidenceLog.some((e) => e.type === 'verification' || e.type === 'test');
  if (opts.requireVerification && !hasVerification) {
    return { sufficient: false, reason: 'no verification evidence recorded' };
  }
  return { sufficient: true, reason: 'ok', evidenceCount: evidenceLog.length };
}

// Drift detection: compare current state against baseline.
function detectDrift(currentState) {
  if (!baseline) return { drifted: false, reason: 'no baseline set' };
  const changes = [];
  for (const key of Object.keys(currentState)) {
    if (baseline[key] !== undefined && baseline[key] !== currentState[key]) {
      changes.push({ key, baseline: baseline[key], current: currentState[key] });
    }
  }
  return { drifted: changes.length > 0, changes, baselineTs: baseline.ts };
}

// Verification gate: run before claiming completion.
function verificationGate(finalText, toolLog) {
  const result = { verified: true, issues: [], evidenceCount: evidenceLog.length };
  // Check if tools were used but no verification evidence
  if (toolLog && toolLog.length > 0 && evidenceLog.length === 0) {
    result.verified = false;
    result.issues.push('tools were used but no verification evidence recorded');
  }
  // Check for unverified claims
  if (finalText && /verified|passed|complete|done|fixed/i.test(finalText) && evidenceLog.length === 0 && (!toolLog || toolLog.length === 0)) {
    result.verified = false;
    result.issues.push('completion claim without supporting evidence');
  }
  // Check for drift
  if (baseline) {
    const drift = detectDrift({ toolCount: toolLog ? toolLog.length : 0 });
    if (drift.drifted) {
      result.issues.push('state drift detected: ' + drift.changes.map((c) => c.key).join(', '));
    }
  }
  if (result.issues.length > 0) result.verified = false;
  return result;
}

function reset() {
  baseline = null;
  evidenceLog = [];
}

module.exports = {
  setBaseline, getBaseline, recordEvidence, getEvidence,
  hasSufficientEvidence, detectDrift, verificationGate, reset,
};