// src/re_index.js
// Reverse-engineered project index search (offline curated set + optional GitHub search).
const CATALOG = [
  { name: 'Ghidra', vendor: 'NSA', category: 'RE Tooling', protocol: 'proprietary', note: 'Software reverse engineering suite' },
  { name: 'radare2', vendor: 'rizinorg', category: 'Disassembly', protocol: 'open', note: 'Unix-like reverse engineering framework' },
  { name: 'rizin', vendor: 'rizinorg', category: 'Disassembly', protocol: 'open', note: 'radare2 fork' },
  { name: 'IDA Pro', vendor: 'Hex-Rays', category: 'Disassembly', protocol: 'proprietary', note: 'Commercial disassembler/debugger' },
  { name: 'x64dbg', vendor: 'x64dbg', category: 'Debugging', protocol: 'open', note: 'Windows debugger' },
  { name: 'Frida', vendor: 'Frida', category: 'Dynamic Instrumentation', protocol: 'open', note: 'Dynamic instrumentation toolkit' },
  { name: 'QEMU', vendor: 'QEMU', category: 'Emulation', protocol: 'open', note: 'Machine emulator/virtualizer' },
  { name: 'binwalk', vendor: 'ReFirmLabs', category: 'Firmware', protocol: 'open', note: 'Firmware analysis tool' },
  { name: 'unblob', vendor: 'onekey-sec', category: 'Firmware', protocol: 'open', note: 'Container format extractor' },
  { name: 'jadx', vendor: 'skylot', category: 'Android', protocol: 'open', note: 'Dex to Java decompiler' },
  { name: 'APKLab', vendor: 'APKLab', category: 'Android', protocol: 'open', note: 'Android RE workbench for VS Code' },
  { name: 'GhidrAssistMCP', vendor: 'symgraph', category: 'MCP', protocol: 'open', note: 'MCP server for Ghidra (100+ tools)' },
  { name: 'GhidrAssist', vendor: 'symgraph', category: 'Ghidra Extension', protocol: 'open', note: 'LLM extension for Ghidra' },
  { name: 'REA', vendor: 'morluto', category: 'Agentic RE', protocol: 'open', note: '255-tool RE agent' },
  { name: 'Craft Anything', vendor: 'storytold', category: 'Agentic RE', protocol: 'open', note: '320 RE tools' },
  { name: 'Integuru', vendor: 'Integuru-AI', category: 'API RE', protocol: 'open', note: 'Permissionless integration RE' },
  { name: 'LLM4Decompile', vendor: 'albertan017', category: 'Decompilation', protocol: 'open', note: 'LLM-based binary decompilation' },
  { name: 'Cutter', vendor: 'rizinorg', category: 'GUI', protocol: 'open', note: 'GUI for rizin' },
  { name: 'Cheat Engine', vendor: 'cheatengine', category: 'Debugging', protocol: 'open', note: 'Memory scanner/debugger' },
  { name: 'OllyDbg', vendor: 'ollydbg', category: 'Debugging', protocol: 'proprietary', note: 'Windows debugger' },
  { name: 'Wireshark', vendor: 'wireshark', category: 'Network', protocol: 'open', note: 'Network protocol analyzer' },
  { name: 'mitmproxy', vendor: 'mitmproxy', category: 'Network', protocol: 'open', note: 'Intercepting proxy' },
  { name: 'netvein', vendor: 'donyst', category: 'Web RE', protocol: 'open', note: '123-tool web RE MCP server' },
  { name: 'jshook-reverse-tool', vendor: 'wuji66dde', category: 'Web RE', protocol: 'open', note: 'JS reverse engineering' },
  { name: 'web-reverse-clone', vendor: 'iemsoft', category: 'Web RE', protocol: 'open', note: 'Web RE + UI cloning' },
  { name: 'android-reverse-engineering-skill', vendor: 'SimoneAvogadro', category: 'Android', protocol: 'open', note: 'Android RE skill' },
  { name: 'reverse-skill', vendor: 'zhaoxuya520', category: 'Skill', protocol: 'open', note: '44+ RE methodology skills' },
  { name: 'reverse-skills', vendor: 'P4nda0s', category: 'Skill', protocol: 'open', note: 'RE skills for Claude Code' },
  { name: 'glassbox', vendor: 'moiz-73', category: 'Methodology', protocol: 'open', note: '12 RE methodology skills' },
  { name: 'tech-core', vendor: 'rotteng749-lgtm', category: 'Methodology', protocol: 'open', note: 'RE/cracking playbook' },
  { name: 're-expertise', vendor: 'KelpHect', category: 'Methodology', protocol: 'open', note: '7 RE skills' },
  { name: 'unslopovich', vendor: 'erkamyaman', category: 'Skill', protocol: 'open', note: 'UI/UX review agent skill' },
];

function search(query, opts) {
  opts = opts || {};
  const q = String(query || '').toLowerCase();
  let results = CATALOG;
  if (opts.category) results = results.filter((p) => p.category.toLowerCase() === String(opts.category).toLowerCase());
  if (opts.protocol) results = results.filter((p) => p.protocol === opts.protocol);
  if (q) results = results.filter((p) => [p.name, p.vendor, p.category, p.note, p.protocol].some((v) => (v || '').toLowerCase().includes(q)));
  return { query, category: opts.category, protocol: opts.protocol, count: results.length, results };
}
function list() { return CATALOG; }
function categories() { return [...new Set(CATALOG.map((p) => p.category))].sort(); }
function byCategory() {
  const out = {};
  for (const p of CATALOG) { (out[p.category] = out[p.category] || []).push(p); }
  return out;
}
async function online(query) {
  try {
    const r = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(query || 'reverse engineering') + '&per_page=10', { signal: AbortSignal.timeout(10000), headers: { 'Accept': 'application/vnd.github+json' } });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const d = await r.json();
    return { ok: true, items: (d.items || []).map((i) => ({ name: i.name, full_name: i.full_name, description: i.description, stars: i.stargazers_count, url: i.html_url })) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

module.exports = { CATALOG, search, list, categories, byCategory, online };
