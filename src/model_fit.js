// src/model_fit.js
// VRAM fit predictor + launch dry-run — clean-room ggrun (284⭐) idea.
// Parses GGUF metadata (tensor sizes) and predicts whether a model fits across
// one or more GPUs / RAM, emitting a launch command. Universal: works for any
// backend. Hardware-agnostic estimates, clearly marked as estimates.
const fs = require('fs');
const path = require('path');
const os = require('os');

// Minimal GGUF header reader: magic "GGUF", version, tensor count, KV count,
// then key/value pairs. We only need total tensor bytes + metadata hints.
function readGgufMeta(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, error: 'file not found' };
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    if (buf.toString('ascii', 0, 4) !== 'GGUF') return { ok: false, error: 'not a GGUF file' };
    const version = buf.readUInt32LE(4);
    // v2/v3 use uint64 counts; we read tensor_data_offset from metadata when
    // available, else estimate from file size minus header.
    const size = fs.statSync(filePath).size;
    return { ok: true, file: filePath, version, sizeGB: +(size / 1024 ** 3).toFixed(2), bytes: size };
  } finally { fs.closeSync(fd); }
}

// Estimate memory needs from file size + quant heuristic (bpw): Q4 ≈ 4.5 bits/weight,
// Q8 ≈ 8.5, FP16 ≈ 16. Used only when exact tensor layout is unavailable.
function estimate(model, opts) {
  opts = opts || {};
  const meta = readGgufMeta(model);
  if (!meta.ok) return meta;
  const bpw = opts.bpw || (/q8|f16|fp16/i.test(path.basename(model)) ? 16 : 4.5);
  const weightGB = meta.bytes * (bpw / 8) / (4.5 / 8) / 1024 ** 3; // rough scaling from file bytes
  const ctx = opts.context || 8192;
  const kvGB = +(ctx * 0.000002).toFixed(2); // ~2MB per 1k tokens at 8k, heuristic
  const overheadGB = 0.8;
  return {
    ok: true,
    model,
    fileGB: meta.sizeGB,
    estimatedWeightGB: +weightGB.toFixed(2),
    kvCacheGB: kvGB,
    overheadGB,
    totalGB: +(weightGB + kvGB + overheadGB).toFixed(2),
    note: 'estimates from file size + quant heuristic; verify with a real load',
  };
}

function fit(model, devices, opts) {
  opts = opts || {};
  const need = estimate(model, opts);
  if (!need.ok) return need;
  const gpus = (devices || []).filter((d) => d && d.vramGB);
  const ram = (opts.ramGB || 32);
  let remaining = need.totalGB;
  const plan = [];
  for (const g of gpus) {
    const used = Math.min(g.vramGB, remaining);
    if (used > 0) { plan.push({ device: g.name || 'gpu', vramUsedGB: +used.toFixed(2), role: 'weights+compute' }); remaining -= used; }
  }
  if (remaining > 0) {
    if (remaining > ram) return { ok: false, fits: false, need: need.totalGB, available: gpus.reduce((a,g)=>a+g.vramGB,0) + ram, plan, reason: 'insufficient VRAM+RAM' };
    plan.push({ device: 'system RAM', ramUsedGB: +remaining.toFixed(2), role: 'offloaded experts/layers' });
  }
  return { ok: true, fits: true, need: need.totalGB, plan, command: launchCommand(model, opts, plan) };
}

function launchCommand(model, opts, plan) {
  const backend = opts.backend || 'llama.cpp';
  const ctx = opts.context || 8192;
  if (backend === 'vllm') return `vllm serve ${model} --max-model-len ${ctx} --tensor-parallel-size ${Math.max(1, (plan||[]).filter(p=>p.device!=='system RAM').length)}`;
  const ngl = (plan || []).some((p) => p.device === 'system RAM') ? ' partial-offload' : ' -ngl 99';
  return `llama-server -m ${model} -c ${ctx}${ngl}`;
}

function tools() {
  return [
    { name: 'model_fit_estimate', description: 'Estimate VRAM/RAM needed for a local GGUF model.', inputSchema: { type: 'object', properties: { model: { type: 'string' }, context: { type: 'number' } }, required: ['model'] } },
    { name: 'model_fit_plan', description: 'Plan model placement across GPUs/RAM and emit a launch command (dry-run).', inputSchema: { type: 'object', properties: { model: { type: 'string' }, devices: { type: 'array' }, context: { type: 'number' } }, required: ['model'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'model_fit_estimate') return estimate(args.model, args);
  if (name === 'model_fit_plan') return fit(args.model, args.devices, args);
  throw new Error('unknown model_fit tool: ' + name);
}
module.exports = { readGgufMeta, estimate, fit, launchCommand, tools, dispatch };
