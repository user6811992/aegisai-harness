#!/usr/bin/env node
// Lean 4 release gate — opt-in: only active when a Lean project declares itself.
// Looks for proof/lakefile.toml or lean/lakefile.toml at the repo root. If no
// project exists the gate is skipped (exit 0). If a project exists, the Lean
// toolchain must be available and every declared proof file must verify.
const fs = require('fs');
const path = require('path');
const lean = require('../src/lean_verify');

const root = path.resolve(__dirname, '..');
const candidates = ['proof', 'lean', 'lean-project'];
const projectDir = candidates.map((d) => path.join(root, d)).find((p) => fs.existsSync(path.join(p, 'lakefile.toml')) || fs.existsSync(path.join(p, 'leanproject.toml')));

if (!projectDir) {
  console.log('lean-gate: no Lean project declared (proof/lakefile.toml) — gate skipped');
  process.exit(0);
}

console.log('lean-gate: Lean project found at', path.relative(root, projectDir));
const det = lean.available();
if (!det.lake) {
  console.error('lean-gate: FAIL — Lean project exists but `lake` is not installed.');
  console.error('  Install elan + Lean 4 (see docs/LEAN_VERIFY.md) or remove the project.');
  process.exit(1);
}

const files = (process.env.LEAN_GATE_FILES || '').split(',').map((s) => s.trim()).filter(Boolean);
const result = lean.verify(projectDir, files.length ? { file: files[0] } : {});
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
