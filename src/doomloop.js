// src/doomloop.js
// Doom-loop detection: repeated tool-call fingerprints + text repetition.
const crypto = require('crypto');

function canonical(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

function fingerprint(name, args, loopKey) {
  let val = args || {};
  if (typeof loopKey === 'function') {
    try { val = loopKey(args || {}); } catch (e) { val = args || {}; }
  } else if (Array.isArray(loopKey)) {
    const out = {};
    for (const k of loopKey) out[k] = (args || {})[k];
    val = out;
  }
  const key = canonical(val);
  return crypto.createHash('sha256').update(name + '|' + key).digest('hex').slice(0, 16);
}

class DoomLoopDetector {
  constructor(opts) {
    opts = opts || {};
    this.ladder = Object.assign({ observe: 2, steer: false, block: 3, escalate: false, stop: 6 }, opts.ladder || {});
    this.escalation = opts.escalation || null;
    this.streaks = {};
    this.textHistory = [];
    this.escalationsUsed = 0;
    this.maxEscalations = (this.escalation && this.escalation.maxEscalations) || 2;
  }
  record(roundFingerprints) {
    roundFingerprints = roundFingerprints || [];
    const thisSet = new Set(roundFingerprints);
    const verdicts = [];
    for (const fp of roundFingerprints) {
      this.streaks[fp] = (this.streaks[fp] || 0) + 1;
      const streak = this.streaks[fp];
      let action = null;
      if (this.ladder.stop && streak >= this.ladder.stop) action = 'stop';
      else if (this.ladder.escalate && streak >= this.ladder.escalate && this.escalationsUsed < this.maxEscalations) action = 'escalate';
      else if (this.ladder.block && streak >= this.ladder.block) action = 'block';
      else if (this.ladder.steer && streak >= this.ladder.steer) action = 'steer';
      else if (this.ladder.observe && streak >= this.ladder.observe) action = 'observe';
      if (action) verdicts.push({ action, fingerprint: fp, streak });
    }
    for (const fp of Object.keys(this.streaks)) {
      if (!thisSet.has(fp)) this.streaks[fp] = 0;
    }
    return verdicts;
  }
  // text repetition detection: returns 'observe' if repeated token blocks
  checkText(text) {
    if (!text) return null;
    const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const prev = this.textHistory[this.textHistory.length - 1];
    this.textHistory.push(norm);
    if (prev && prev === norm) return { action: 'observe', type: 'text-streak' };
    return null;
  }
  reset() { this.streaks = {}; this.textHistory = []; }
}

module.exports = { DoomLoopDetector, fingerprint };
