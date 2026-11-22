// src/confidence_memory.js
// Self-checking memory: calibrated confidence + staged claim gates (minta pattern).
const db = require('./storage/db');

function store(text, source, confidence) {
  db.saveMemory({ text, source: source || 'self', tags: ['confidence:' + Number(confidence || 0.5).toFixed(2)] });
  return { text, confidence: confidence || 0.5 };
}
function confidenceOf(mem) {
  const tag = (mem.tags || []).find((t) => t.startsWith('confidence:'));
  return tag ? Number(tag.split(':')[1]) : 0.5;
}
function gate(mem, stage) {
  const c = confidenceOf(mem);
  const thresholds = { recall: 0.3, cite: 0.6, act: 0.8 };
  const t = thresholds[stage] || 0.5;
  return { pass: c >= t, confidence: c, threshold: t, stage };
}
function calibrate(mem, corroborated) {
  const c = confidenceOf(mem);
  const next = Math.min(1, Math.max(0, c + (corroborated ? 0.15 : -0.1)));
  mem.tags = (mem.tags || []).filter((t) => !t.startsWith('confidence:'));
  mem.tags.push('confidence:' + next.toFixed(2));
  db.saveMemory(mem);
  return next;
}

module.exports = { store, confidenceOf, gate, calibrate };
