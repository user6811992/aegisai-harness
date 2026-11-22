// src/ui_replay.js
// Evidence-first UI automation: record steps with evidence, replay deterministically, verify.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const browser = require('./integrations/browser');

const FILE = () => path.join(DATA_DIR, 'ui-replay.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch (e) { return { steps: [] }; } }
function save(r) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(r, null, 2)); }
function record(step) {
  const r = load();
  r.steps.push(Object.assign({ seq: r.steps.length + 1, at: new Date().toISOString(), platform: (step && step.platform) || 'web' }, step));
  save(r);
  return r.steps.length;
}
function verifyStep(step, result) {
  if (!step || !step.evidence) return { ok: true, note: 'no evidence required' };
  const ok = String(result && result.output || '').includes(step.evidence);
  return { ok, expected: step.evidence, actual: String(result && result.output || '').slice(0, 100) };
}
async function replay(opts) {
  opts = opts || {};
  const steps = load().steps;
  const results = [];
  for (const s of steps) {
    if (s.action === 'navigate' || s.action === 'click' || s.action === 'type' || s.action === 'eval' || s.action === 'ax') {
      const map = { navigate: 'browser_navigate', click: 'browser_click', type: 'browser_type', eval: 'browser_eval', ax: 'browser_ax' };
      const r = await browser.handle(map[s.action], s.args || {});
      results.push({ seq: s.seq, action: s.action, ok: r.ok, output: String(r.output || '').slice(0, 200) });
    } else results.push({ seq: s.seq, action: s.action, ok: true, note: 'no-op' });
  }
  return { steps: steps.length, results };
}
function verify(replayResults) {
  return { verified: (replayResults.results || []).every((r) => r.ok), results: replayResults.results };
}

module.exports = { load, record, replay, verify, verifyStep };
