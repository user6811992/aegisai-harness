// src/guardrails.js
// Input/output guardrails (injection detection, output validation).
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /disregard (all )?(previous|prior) instructions/i,
  /you are now/i,
  /system:\s*override/i,
  /\[\s*system\s*\]/i,
  /<\|im_start\|>/,
];

function checkInput(text) {
  const hits = [];
  for (const p of INJECTION_PATTERNS) {
    if (p.test(text || '')) hits.push(p.source);
  }
  return { safe: hits.length === 0, hits };
}

function checkOutput(text, opts) {
  opts = opts || {};
  const hits = [];
  if (opts.maxLength && String(text).length > opts.maxLength) hits.push('too long');
  if (opts.requiredPhrase && !String(text).includes(opts.requiredPhrase)) hits.push('missing required phrase');
  for (const p of INJECTION_PATTERNS) {
    if (p.test(text || '')) hits.push('injection pattern');
  }
  return { safe: hits.length === 0, hits };
}

module.exports = { checkInput, checkOutput, INJECTION_PATTERNS };
