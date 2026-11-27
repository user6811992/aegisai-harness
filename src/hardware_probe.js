// src/hardware_probe.js
// Read-only local hardware capability probe. Feeds the universal backend,
// quant and MoE contracts with measured facts instead of assumptions.
// No network, no model downloads, no driver changes.
const { spawnSync } = require('child_process');

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: (opts && opts.timeoutMs) || 5000, windowsHide: true });
  return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? String(r.error.message) : null };
}

function parseVulkan(text) {
  const devices = [];
  let cur = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(deviceName|vendorID|driverInfo|driverID|apiVersion)\s*=\s*(.+)$/);
    if (line.trim() === 'GPU0:' || /^GPU\d+:/.test(line.trim())) { cur = {}; devices.push(cur); continue; }
    if (m && cur) cur[m[1]] = m[2].trim();
  }
  return devices.filter((d) => d.deviceName);
}

function vulkan(opts) {
  const r = run('vulkaninfo', ['--summary'], opts);
  if (!r.ok) return { ok: false, available: false, devices: [], reason: r.error || r.stderr.trim().slice(0, 200) || 'vulkaninfo failed' };
  const devices = parseVulkan(r.stdout);
  return { ok: true, available: devices.length > 0, devices };
}

function cuda(opts) {
  const r = run('nvidia-smi', ['--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'], opts);
  if (!r.ok) return { ok: false, available: false, devices: [], reason: r.error || r.stderr.trim().slice(0, 200) || 'nvidia-smi failed' };
  const devices = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, driver, memory] = l.split(',').map((x) => x.trim());
    return { name, driver, memory };
  });
  return { ok: true, available: devices.length > 0, devices };
}

function probe(opts) {
  const v = vulkan(opts), c = cuda(opts);
  const platform = process.platform;
  return {
    ok: true, platform, arch: process.arch,
    vulkan: v, cuda: c,
    metal: platform === 'darwin',
    notes: [
      'Vulkan works across AMD/NVIDIA/Intel; it does not validate CUDA-only kernels.',
      'CUDA requires a working NVML + toolkit; a GPU in Device Manager is not enough.',
      'MLX requires Apple Silicon + macOS Metal and cannot be validated on Windows/Linux.',
      'Ghidra requires a JDK and GHIDRA_INSTALL_DIR; a contract cannot validate it.',
    ],
  };
}

function recommend(p) {
  const out = [];
  if (p.cuda && p.cuda.available) out.push('cuda');
  if (p.vulkan && p.vulkan.available) out.push('vulkan');
  if (p.metal) out.push('mlx');
  return { ok: true, backends: out.length ? out : ['cpu'], note: 'implementation still requires an installed inference runtime and model' };
}

function tools() {
  return [
    { name: 'hardware_probe', description: 'Probe local Vulkan/CUDA/Metal capability (read-only).', inputSchema: { type: 'object' } },
    { name: 'hardware_recommend', description: 'Recommend backends from probe results.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'hardware_probe') return probe(args);
  if (name === 'hardware_recommend') return recommend(args.profile || probe(args));
  if (name === 'hardware_parse_vulkan') return { ok: true, devices: parseVulkan(args.text) };
  throw new Error('unknown hardware_probe tool: ' + name);
}
module.exports = { run, parseVulkan, vulkan, cuda, probe, recommend, tools, dispatch };
