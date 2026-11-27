// src/backend_variants.js
// Backend variant registry — adapts ik_llama.cpp, llamafile, vLLM and Node
// inference-server patterns (clean-room). Feature-gated, no binaries bundled.
const VARIANTS = {
  llama_cpp: { cli: 'llama-server', quants: ['Q4_K_M','Q5_K','Q8_0'], moe: false, abi: 'ggml-upstream' },
  ik_llama: { cli: 'ik_llama_server', quants: ['IQ3_K_R4','IQ4_XS','Q4_K_M'], moe: true, flags: ['--n-cpu-moe','-rtr','-fmoe'], abi: 'ggml-ik', note: 'INCOMPATIBLE with stock llama.cpp ABI — feature-gate one runtime' },
  llamafile: { cli: 'llamafile', quants: ['Q4_K_M'], singleFile: true, abi: 'ggml-upstream' },
  vllm: { cli: 'vllm', serve: 'serve', quant: ['FP8','NVFP4','AWQ'], abi: 'python' },
  node_inference: { cli: 'node', entry: 'inferenceable', abi: 'napi', note: 'Node.js pluggable inference server pattern' },
  sd_cpp: { cli: 'sd-server', abi: 'cpp', note: 'stable-diffusion.cpp adapter — pure C/C++, opt-in runtime, not bundled' },
  mlx: { cli: 'mlx-lm', abi: 'mlx', platform: 'darwin', quants: ['IQ1_S_R4','IQ2_KS','IQ2_K'], note: 'mlx-iqk (MIT): only these IQ_K codecs; IQ3_K/Q4_K K-quants come from mlx-kquant. Apple Silicon only; adapter only' },
  memex: { cli: 'memex', abi: 'cpp', moe: true, note: 'MoE engine for weak hardware — adapter only, opt-in' },
};
function resolve(name, opts) {
  const v = VARIANTS[String(name||'').toLowerCase()];
  if (!v) return { ok: false, error: 'unknown backend variant: ' + name };
  return { ok: true, name, ...v, note: v.note || 'adapter only; requires installed runtime' };
}
function compatible(a, b) {
  const x = VARIANTS[a], y = VARIANTS[b];
  if (!x || !y) return { ok: false, error: 'unknown variant' };
  return { ok: x.abi === y.abi, abiA: x.abi, abiB: y.abi, note: x.abi === y.abi ? 'compatible ABI' : 'never link both in one process' };
}
function list() { return Object.entries(VARIANTS).map(([k,v]) => ({ name: k, ...v })); }
function tools() {
  return [
    { name: 'backend_variant', description: 'Resolve a backend variant adapter (ik_llama/llamafile/vLLM).', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'backend_abi', description: 'Check ABI compatibility between two backend variants.', inputSchema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a','b'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'backend_variant') return resolve(args.name, args);
  if (name === 'backend_abi') return compatible(args.a, args.b);
  if (name === 'backend_variants') return { ok: true, variants: list() };
  throw new Error('unknown backend_variants tool: ' + name);
}
module.exports = { VARIANTS, resolve, compatible, list, tools, dispatch };
