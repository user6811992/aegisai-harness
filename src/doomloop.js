// src/doomloop.js
// Doom-loop detection: track repeated tool-call fingerprints across rounds.
const crypto = require('crypto');

function fingerprint(name, args) {
  let key;
  try { key = JSON.stringify(args || {}); } catch (e) { key = String(args); }
  return crypto.createHash('sha256').update(name + '|' + key).digest('hex').slice(0, 16);
}

class DoomLoopDetector {
  constructor(opts) {
    opts = opts || {};
    this.ladder = Object.assign({ observe: 2, block: 3, stop: 6 }, opts.ladder || {});
    this.history = []; // array of rounds; each round is array of fingerprints
    this.streaks = {}; // fingerprint -> consecutive round count
  }
  // record a round of tool calls; returns verdict { action, fingerprint, streak }
  record(roundFingerprints) {
    roundFingerprints = roundFingerprints || [];
    // update streaks: for each fp in this round, increment; others reset
    const thisSet = new Set(roundFingerprints);
    const verdicts = [];
    for (const fp of roundFingerprints) {
      this.streaks[fp] = (this.streaks[fp] || 0) + 1;
      const streak = this.streaks[fp];
      let action = null;
      if (this.ladder.stop && streak >= this.ladder.stop) action = 'stop';
      else if (this.ladder.block && streak >= this.ladder.block) action = 'block';
      else if (this.ladder.observe && streak >= this.ladder.observe) action = 'observe';
      if (action) verdicts.push({ action, fingerprint: fp, streak });
    }
    // reset streaks for fingerprints not in this round
    for (const fp of Object.keys(this.streaks)) {
      if (!thisSet.has(fp)) this.streaks[fp] = 0;
    }
    this.history.push(roundFingerprints);
    return verdicts;
  }
  reset() { this.history = []; this.streaks = {}; }
}

module.exports = { DoomLoopDetector, fingerprint };
