// src/quant_advisor.js
// Low-bit MoE quants for legacy GPUs — clean-room wepromen/pxq_llama +
// PhilAnderson1/minicpm-pi5 idea. Recommend a quant from VRAM and MoE shape.
// Hardware-agnostic: user hardware is one example, never the default.
function recommend(opts) {
  opts = opts || {};
  const vram = Number(opts.vramGB || 8);
  const moe = !!opts.moe;
  const bits = opts.bits || (vram <= 6 ? 3 : vram <= 8 ? 4 : 5);
  const quant = moe
    ? (bits <= 3 ? 'IQ3_K_R4' : bits === 4 ? 'IQ4_XS' : 'Q5_K_M')
    : (bits <= 3 ? 'Q3_K_M' : bits === 4 ? 'Q4_K_M' : 'Q5_K_M');
  const caveats = [];
  if (vram < 6) caveats.push('very limited VRAM: expect quality loss or CPU offload');
  if (moe) caveats.push('MoE experts need CPU offload on legacy GPUs — use --n-cpu-moe');
  return { ok: true, vramGB: vram, moe, bits, quant, caveats, note: 'universal heuristic; measure on your own hardware' };
}
function tools() {
  return [{ name: 'quant_recommend', description: 'Recommend a low-bit quant for a VRAM budget and MoE shape.', inputSchema: { type: 'object', properties: { vramGB: { type: 'number' }, moe: { type: 'boolean' } } } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'quant_recommend') return recommend(args);
  throw new Error('unknown quant_advisor tool: ' + name);
}
module.exports = { recommend, tools, dispatch };
