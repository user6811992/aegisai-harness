// src/phishing_filter.js
// Phishing domain blocklist — clean-room LostRuins/phishing-database idea.
// Optional feed into security_gates. Ships a tiny built-in pattern set; a
// caller-supplied list can extend it. No network fetch by default.
const BUILTIN = ['paypa1.com', 'g00gle.com', 'micros0ft.com', 'app1e.com', 'amaz0n.com'];
function isPhishing(domain, extra) {
  const d = String(domain || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const list = BUILTIN.concat(extra || []);
  const hit = list.find((x) => d === x || d.endsWith('.' + x));
  return { ok: true, domain: d, phishing: !!hit, match: hit || null };
}
function scan(urls, extra) {
  const results = (urls || []).map((u) => isPhishing(u, extra));
  return { ok: true, results, blocked: results.filter((r) => r.phishing).length };
}
function tools() {
  return [
    { name: 'phishing_check', description: 'Check a domain against the built-in phishing blocklist.', inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
    { name: 'phishing_scan', description: 'Scan a list of URLs for phishing domains.', inputSchema: { type: 'object', properties: { urls: { type: 'array' } }, required: ['urls'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'phishing_check') return isPhishing(args.domain, args.extra);
  if (name === 'phishing_scan') return scan(args.urls, args.extra);
  throw new Error('unknown phishing_filter tool: ' + name);
}
module.exports = { BUILTIN, isPhishing, scan, tools, dispatch };
