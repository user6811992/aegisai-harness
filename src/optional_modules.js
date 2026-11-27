// src/optional_modules.js
// Generalized opt-in research module discovery. Heavy, research-grade
// dependencies (Lean, MLX, PyTorch, mLattice) are never bundled; they are
// discovered lazily and reported with a clear availability status.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Known optional research projects and their discovery signals.
const OPTIONAL = [
  {
    id: 'aegis-method-pack', label: 'Aegis Method Pack',
    type: 'submodule', path: 'vendor/aegis',
    probe: 'vendor/aegis/SKILL.md',
    note: '22 bundled skills; already included as a git submodule',
  },
  {
    id: 'lean-verify', label: 'Lean 4 formal verification',
    type: 'tool', command: 'lake',
    note: 'Install elan + Mathlib (~6 GB) to enable lean_verify_project',
  },
  {
    id: 'mlattice', label: 'mLattice (linear memory)',
    type: 'python', module: 'mulattice',
    note: 'Research memory architecture; pip install -e . from eelbaz/mLattice',
  },
  {
    id: 'jit-lora', label: 'JIT LoRA (continuous learning)',
    type: 'python', module: 'mlx',
    note: 'Apple Silicon only; pip install mlx from eelbaz/jit-lora',
  },
  {
    id: 'tensorbend-predictor', label: 'MoE expert prefetch predictor',
    type: 'python', module: 'torch',
    note: 'GPU/MoE research; requires PyTorch + vLLM',
  },
];

function exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); }
  catch (e) { return false; }
}

function commandAvailable(cmd) {
  try {
    const tool = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(tool, [cmd], { encoding: 'utf8', timeout: 3000 });
    return r.status === 0 && !!r.stdout.trim();
  } catch (e) { return false; }
}

function pythonModuleAvailable(mod) {
  try {
    const r = spawnSync('python', ['-c', 'import ' + mod], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0;
  } catch (e) { return false; }
}

function status() {
  const items = OPTIONAL.map((o) => {
    let available = false;
    if (o.type === 'submodule') available = exists(o.probe);
    else if (o.type === 'tool') available = commandAvailable(o.command);
    else if (o.type === 'python') available = pythonModuleAvailable(o.module);
    return Object.assign({}, o, { available });
  });
  return {
    generated: new Date().toISOString(),
    total: items.length,
    available: items.filter((i) => i.available).length,
    items,
  };
}

function discoverSubmodules() {
  const gitmodules = path.join(ROOT, '.gitmodules');
  if (!fs.existsSync(gitmodules)) return [];
  const text = fs.readFileSync(gitmodules, 'utf8');
  const paths = [];
  const re = /path\s*=\s*(.+)/g;
  let m;
  while ((m = re.exec(text))) paths.push(m[1].trim());
  return paths.map((p) => ({ path: p, present: exists(p) }));
}

function tools() {
  return [
    { name: 'optional_modules_status', description: 'List optional research modules and their availability (lazy, no install).', inputSchema: { type: 'object' } },
  ];
}

function dispatch(name) {
  if (name === 'optional_modules_status') return status();
  throw new Error('unknown optional_modules tool: ' + name);
}

module.exports = { status, discoverSubmodules, OPTIONAL, tools, dispatch };
