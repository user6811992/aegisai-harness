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

function recommend(hw) {
  hw = hw || detect();
  const ram = hw.totalRAM_GB;
  let engine = 'ollama';
  let modelSize = '3B';
  if (ram >= 32) modelSize = '14B';
  else if (ram >= 16) modelSize = '8B';
  if (hw.gpu.detected) engine = /nvidia/i.test(hw.gpu.info) ? 'ollama (CUDA)' : 'ollama (GPU)';
  const context = ram >= 32 ? 16384 : ram >= 16 ? 8192 : 4096;
  return {
    engine, modelSize: modelSize + ' Q4_K_M', context,
    model: modelSize === '3B' ? 'llama3.2:3b' : modelSize === '8B' ? 'llama3.1:8b' : 'llama3.1:14b',
    note: 'sized to ' + ram + ' GB RAM' + (hw.gpu.detected ? ' + GPU' : ''),
  };
}

module.exports = { detect, recommend, gpu };
