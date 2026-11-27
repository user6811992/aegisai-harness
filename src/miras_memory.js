// src/miras_memory.js
// MIRAS / Titans neural long-term memory — clean-room eelbaz/olmo3-miras idea.
// Surprise scoring: write to long-term memory only when new input is
// surprising relative to the current summary. Research-grade contract.
function surprise(summary, input) {
  const s = String(summary || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const i = String(input || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const known = new Set(s);
  const novel = i.filter((w) => !known.has(w));
  return { ok: true, score: i.length ? +(novel.length / i.length).toFixed(3) : 0, novel };
}
function write(store, item, threshold) {
  const sc = surprise(store && store.summary, item.text);
  const accepted = sc.score >= (threshold == null ? 0.5 : threshold);
  return { ok: true, accepted, score: sc.score, item: accepted ? item : null, note: 'low-surprise inputs are folded into the summary instead of stored' };
}
function tools() {
  return [
    { name: 'miras_surprise', description: 'Score how surprising an input is relative to a summary.', inputSchema: { type: 'object', properties: { summary: { type: 'string' }, input: { type: 'string' } }, required: ['input'] } },
    { name: 'miras_write', description: 'Write high-surprise items to long-term memory.', inputSchema: { type: 'object', properties: { store: { type: 'object' }, item: { type: 'object' } }, required: ['item'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'miras_surprise') return surprise(args.summary, args.input);
  if (name === 'miras_write') return write(args.store, args.item, args.threshold);
  throw new Error('unknown miras_memory tool: ' + name);
}
module.exports = { surprise, write, tools, dispatch };
