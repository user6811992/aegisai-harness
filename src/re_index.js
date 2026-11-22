// src/re_index.js
// Reverse-engineered project index search (offline curated set + optional GitHub search).
const CATALOG = [
  { name: 'Ghidra', vendor: 'NSA', category: 'RE Tooling', note: 'Software reverse engineering suite' },
  { name: 'radare2', vendor: 'rizinorg', category: 'Disassembly', note: 'Unix-like reverse engineering framework' },
  { name: 'IDA Pro', vendor: 'Hex-Rays', category: 'Disassembly', note: 'Commercial disassembler/debugger' },
  { name: 'x64dbg', vendor: 'x64dbg', category: 'Debugging', note: 'Windows debugger' },
  { name: 'Frida', vendor: 'Frida', category: 'Dynamic Instrumentation', note: 'Dynamic instrumentation toolkit' },
  { name: 'QEMU', vendor: 'QEMU', category: 'Emulation', note: 'Machine emulator/virtualizer' },
  { name: 'binwalk', vendor: 'ReFirmLabs', category: 'Firmware', note: 'Firmware analysis tool' },
  { name: 'jadx', vendor: 'skylot', category: 'Android', note: 'Dex to Java decompiler' },
  { name: 'GhidrAssistMCP', vendor: 'symgraph', category: 'MCP', note: 'MCP server for Ghidra' },
  { name: 'REA', vendor: 'morluto', category: 'Agentic RE', note: '255-tool RE agent' },
];

function search(query, opts) {
  opts = opts || {};
  const q = String(query || '').toLowerCase();
  const local = CATALOG.filter((p) => [p.name, p.vendor, p.category, p.note].some((v) => v.toLowerCase().includes(q)));
  return { query, local, online: opts.online ? 'use GitHub API search with GITHUB_TOKEN' : null };
}
function list() { return CATALOG; }

module.exports = { CATALOG, search, list };
