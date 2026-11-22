// src/speed_bench.js
// Real-world speed benchmark: time-to-first-push/pr/CI from externally supplied timestamps (speedbench).
function summarize(events) {
  // events: [{ name, ts }] — externally collected timestamps (Slack/GitHub)
  const byName = {};
  for (const e of events || []) byName[e.name] = new Date(e.ts).getTime();
  const base = byName.message || byName.start;
  if (!base) return { ok: false, error: 'no start/message timestamp' };
  const out = { ok: true, base: new Date(base).toISOString() };
  for (const [name, ts] of Object.entries(byName)) {
    if (name === 'message' || name === 'start') continue;
    out[name] = { seconds: +((ts - base) / 1000).toFixed(1), at: new Date(ts).toISOString() };
  }
  return out;
}
function compare(runs) {
  // runs: [{ agent, events }]
  return (runs || []).map((r) => Object.assign({ agent: r.agent }, summarize(r.events)));
}

module.exports = { summarize, compare };
