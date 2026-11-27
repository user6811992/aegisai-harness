// src/thumb2_symbols.js
// Ghidra Thumb2 symbol recovery — clean-room collin80/symgrate2-ghidra-plugin
// idea. Plan for recovering Thumb-2 function symbols from a firmware image.
// Ghidra is an external, opt-in toolchain; nothing is bundled.
function available() {
  return { ok: true, ghidra: false, note: 'Ghidra not bundled — install separately and supply the project path' };
}
function plan(image, opts) {
  opts = opts || {};
  if (!image) return { ok: false, error: 'firmware image path required' };
  return {
    ok: true, image, base: opts.base || '0x08000000', arch: 'ARM Thumb-2',
    steps: ['import firmware', 'set language ARMB:LE:32:CORTEX', 'run auto-analysis', 'apply symbol map', 'export function list'],
    note: 'caller executes with Ghidra; verify recovered symbols against known vectors',
  };
}
function tools() {
  return [
    { name: 'thumb2_ghidra_status', description: 'Check Ghidra availability for Thumb2 recovery.', inputSchema: { type: 'object' } },
    { name: 'thumb2_recover_plan', description: 'Plan Thumb2 symbol recovery for a firmware image.', inputSchema: { type: 'object', properties: { image: { type: 'string' } }, required: ['image'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'thumb2_ghidra_status') return available();
  if (name === 'thumb2_recover_plan') return plan(args.image, args);
  throw new Error('unknown thumb2_symbols tool: ' + name);
}
module.exports = { available, plan, tools, dispatch };
