// src/continual.js
// Continual learning: review → refine → apply → auto-rollback on regression.
const verifier = require('./verifier');
const waste = require('./waste');
const selfImprove = require('./self_improve');
const rollback = require('./rollback');

function review(output, toolLog) {
  const v = verifier.verify(output, toolLog);
  const w = waste.detect(toolLog, output);
  return { ok: v.verified && !w.wasteful, verification: v, waste: w };
}

function refine(reviewResult) {
  const notes = [];
  if (!reviewResult.verification.verified) notes.push('add independent verification evidence');
  for (const f of reviewResult.waste.flags) notes.push('fix: ' + f.type + ' (' + f.detail + ')');
  return notes;
}

function cycle(output, toolLog, options) {
  options = options || {};
  const r = review(output, toolLog);
  const refinements = refine(r);
  const proposals = options.autoPropose === false ? [] : selfImprove.propose();
  let applied = null;
  if (options.apply !== false && proposals.length) applied = selfImprove.evaluate(proposals[0].id);
  let rolledBack = null;
  if (options.rollbackSnapshot) rolledBack = rollback.restore(options.rollbackSnapshot);
  return { review: r, refinements, proposals, applied, rolledBack };
}

module.exports = { review, refine, cycle };
