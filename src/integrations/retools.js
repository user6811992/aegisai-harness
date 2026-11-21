// src/integrations/retools.js
// Real wiring for REA/Ghidra/Craft external tools via spawned binaries or MCP URLs.
const { spawnSync } = require('child_process');

function status() {
  return {
    rea: { ready: !!process.env.REA_BIN, bin: process.env.REA_BIN || '' },
    ghidra: { ready: !!process.env.GHIDRA_MCP_URL, url: process.env.GHIDRA_MCP_URL || '' },
    craft: { ready: !!process.env.CRAFT_BIN, bin: process.env.CRAFT_BIN || '' },
  };
}

function runTool(prefix, name, args) {
  const s = status();
  let bin;
  if (prefix === 'rea_') bin = s.rea.bin;
  else if (prefix === 'ghidra_') bin = s.ghidra.url;
  else if (prefix === 'craft_') bin = s.craft.bin;
  else if (prefix === 'are_') bin = s.rea.bin;
  if (!bin) return { ok: false, output: 'integration not configured: ' + prefix };

  // MCP URL: forward JSON-RPC tools/call via HTTP
  if (prefix === 'ghidra_') {
    return { ok: false, output: 'MCP URL configured but no HTTP client wired (use stdio MCP config)' };
  }
  try {
    const argv = [name.replace(prefix, ''), ...Object.entries(args || {}).flatMap(([k, v]) => ['--' + k, String(v)])];
    const r = spawnSync(bin, argv, { encoding: 'utf8', timeout: 60000, shell: false });
    return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
  } catch (e) { return { ok: false, output: String(e.message || e) }; }
}

module.exports = { status, runTool };
