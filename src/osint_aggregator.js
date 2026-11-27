// src/osint_aggregator.js
// OSINT aggregator skill contract — clean-room togg53192-cmd/recon (54⭐) idea.
// Multi-source username/email reconnaissance. Network-dependent, opt-in only,
// disabled in offline mode. Returns a plan of sources; never performs live
// queries itself. Respect ToS and privacy law.
const SOURCES = ['github','twitter','reddit','linkedin','instagram','youtube','pastebin','breach-index'];
function plan(identity, opts) {
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: false, error: 'OSINT disabled in offline mode (opt-in only)' };
  const kind = String((opts && opts.kind) || 'username');
  if (!identity) return { ok: false, error: 'identity required' };
  const sources = (opts && opts.sources && opts.sources.length) ? opts.sources : SOURCES;
  return {
    ok: true, identity, kind,
    sources: sources.map((s) => ({ name: s, endpoint: 'caller-supplied', action: 'check' })),
    note: 'plan only — caller performs network checks; respect platform ToS and applicable law',
  };
}
function tools() {
  return [
    { name: 'osint_plan', description: 'Plan an opt-in multi-source OSINT query.', inputSchema: { type: 'object', properties: { identity: { type: 'string' }, kind: { type: 'string' }, sources: { type: 'array' } }, required: ['identity'] } },
    { name: 'osint_sources', description: 'List available OSINT sources.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'osint_plan') return plan(args.identity, args);
  if (name === 'osint_sources') return { ok: true, sources: SOURCES };
  throw new Error('unknown osint_aggregator tool: ' + name);
}
module.exports = { SOURCES, plan, tools, dispatch };
