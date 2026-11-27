// src/hardware.js
// Local hardware detection + engine/model recommendation for local inference.
const os = require('os');
const { spawnSync } = require('child_process');

function gpu() {
  const cmds = [
    ['nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader']],
    ['wmic', ['path', 'win32_VideoController', 'get', 'name']],
  ];
  for (const [cmd, args] of cmds) {
    try {
      const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 3000, shell: false });
      if (r.status === 0 && r.stdout && r.stdout.trim()) return { detected: true, info: r.stdout.trim().split(/\r?\n/).slice(0, 4).join('; '), source: cmd };
    } catch (e) {}
  }
  return { detected: false, info: '', source: '' };
}

function detect() {
  const totalGB = +(os.totalmem() / 1024 ** 3).toFixed(1);
  const freeGB = +(os.freemem() / 1024 ** 3).toFixed(1);
  return {
    platform: process.platform, arch: process.arch,
    cpu: os.cpus()[0] ? os.cpus()[0].model : 'unknown',
    cores: os.cpus().length,
    totalRAM_GB: totalGB, freeRAM_GB: freeGB,
    gpu: gpu(),
  };
}

// Detect a named hardware profile from GPU/CPU strings.
// Profiles drive backend + quantization recommendations.
const PROFILES = [
  {
    id: 'dgx-spark-gb10', label: 'NVIDIA DGX Spark (GB10 Blackwell)',
    re: /dgx.?spark|gb10|sm_121|blackwell/i,
    engine: 'vllm', quant: 'NVFP4 / BF16', context: 131072,
    note: 'DGX Spark GB10 (sm_121): use the one-command vLLM setup; see docs/DGX_SPARK.md',
  },
  {
    id: 'nvidia-blackwell', label: 'NVIDIA Blackwell GPU',
    re: /blackwell|sm_100|sm_120|rtx.?50|b200|h100|h200/i,
    engine: 'vllm', quant: 'NVFP4 / FP8', context: 65536,
    note: 'Blackwell-class GPU: vLLM with FP8/NVFP4 quantization recommended',
  },
  {
    id: 'apple-silicon', label: 'Apple Silicon (MLX)',
    re: /apple m[1-9]|apple silicon/i,
    engine: 'llama.cpp (MLX)', quant: 'Q4_K_M', context: 32768,
    note: 'Apple Silicon: MLX/llama.cpp; LoRA updates possible mid-conversation',
  },
  {
    id: 'nvidia-cuda', label: 'NVIDIA CUDA GPU',
    re: /nvidia|geforce|quadro|a100|t4/i,
    engine: 'ollama (CUDA)', quant: 'Q4_K_M', context: 32768,
    note: 'CUDA GPU detected: Ollama or vLLM both viable',
  },
];

function detectProfile(hw) {
  hw = hw || detect();
  const hay = [hw.gpu && hw.gpu.info, hw.cpu].filter(Boolean).join(' ');
  for (const p of PROFILES) {
    if (p.re.test(hay)) return Object.assign({}, p, { detected: true });
  }
  return { id: 'generic', label: 'Generic CPU', engine: 'ollama', quant: 'Q4_K_M', context: 8192, note: 'No specialized profile detected', detected: false };
}

function recommend(hw) {
  hw = hw || detect();
  const profile = detectProfile(hw);
  const ram = hw.totalRAM_GB;
  let engine = profile.engine;
  let modelSize = '3B';
  if (ram >= 32) modelSize = '14B';
  else if (ram >= 16) modelSize = '8B';
  if (profile.id === 'generic' && hw.gpu.detected) engine = /nvidia/i.test(hw.gpu.info) ? 'ollama (CUDA)' : 'ollama (GPU)';
  let context = profile.context;
  if (profile.id === 'generic') context = ram >= 32 ? 16384 : ram >= 16 ? 8192 : 4096;
  return {
    engine, modelSize: modelSize + ' ' + profile.quant, quant: profile.quant, context,
    profile: profile.id,
    profileLabel: profile.label,
    model: modelSize === '3B' ? 'llama3.2:3b' : modelSize === '8B' ? 'llama3.1:8b' : 'llama3.1:14b',
    note: profile.note + ' (sized to ' + ram + ' GB RAM' + (hw.gpu.detected ? ' + GPU' : '') + ')',
  };
}

function tools() {
  return [
    { name: 'hardware_detect', description: 'Detect local hardware and the recommended inference profile.', inputSchema: { type: 'object' } },
  ];
}

module.exports = { detect, recommend, gpu, detectProfile, PROFILES, tools };
