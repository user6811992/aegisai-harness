// src/memory_policy.js
// Surprise-weighted memory consolidation policy.
// Inspired by eelbaz/olmo3-miras (Titans-LMM surprise-driven updates) and
// eelbaz/jit-lora (>=33% regularization ratio prevents catastrophic forgetting).
// Pure-JS policy layer; ranks what to consolidate, protect, or discard.
const REGULARIZATION_MIN = 0.33;

function surprise(text, baseline) {
  const tokens = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const base = new Set((baseline || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  if (!tokens.length) return 0;
  const novel = tokens.filter((t) => !base.has(t)).length;
  return +(novel / tokens.length).toFixed(3);
}

function classify(items, opts) {
  opts = opts || {};
  const baseline = opts.baseline || '';
  const threshold = opts.surpriseThreshold != null ? opts.surpriseThreshold : 0.4;
  const ratio = opts.regularizationRatio != null ? opts.regularizationRatio : REGULARIZATION_MIN;
  const out = (items || []).map((item) => {
    const s = surprise(item.text, baseline);
    let action = 'retain';
    if (s >= threshold) action = 'consolidate';
    else if (s < 0.05) action = 'discard-candidate';
    return Object.assign({}, item, { surprise: s, action });
  });
  const consolidated = out.filter((i) => i.action === 'consolidate');
  return {
    items: out,
    policy: {
      surpriseThreshold: threshold,
      regularizationRatio: ratio,
      forgettingProtected: ratio >= REGULARIZATION_MIN,
      note: ratio >= REGULARIZATION_MIN
        ? 'Regularization ratio >= 33% protects general knowledge from overwrite'
        : 'Low regularization ratio risks catastrophic forgetting',
    },
    counts: {
      consolidate: consolidated.length,
      retain: out.filter((i) => i.action === 'retain').length,
      discardCandidate: out.filter((i) => i.action === 'discard-candidate').length,
    },
  };
}

// Merge new facts into a fact store while keeping a protected core.
function consolidate(existing, incoming, opts) {
  opts = opts || {};
  const protectedCount = Math.max(1, Math.round((existing || []).length * (opts.regularizationRatio || REGULARIZATION_MIN)));
  const core = (existing || []).slice(0, protectedCount);
  const rest = (existing || []).slice(protectedCount);
  const merged = core.concat(rest, incoming || []);
  return { facts: merged, protected: core.length, total: merged.length };
}

module.exports = { surprise, classify, consolidate, REGULARIZATION_MIN };
