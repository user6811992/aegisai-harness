// src/hardware_autotune.js
// Hardware-aware optimization: derive concrete backend/quantization/context
// settings from the detected profile, with an opt-in apply step that persists
// to settings.json. Local-only.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const hardware = require('./hardware');

const SETTINGS = () => path.join(DATA_DIR, 'autotune.json');

function tune(hw) {
  const detected = hardware.detect();
  const effective = Object.assign({}, detected, hw || {});
  const rec = hardware.recommend(effective);
  const env = {
    BACKEND_TYPE: rec.engine.replace(/\s*\(.*\)$/, '').replace('llama.cpp (MLX)', 'llamacpp'),
    AEGISAI_MODEL: rec.model,
  };
  // Derive a numeric context hint where possible
  const contextHint = rec.context;
  return {
    profile: rec.profile,
    label: rec.profileLabel,
    detected: hardware.detectProfile(effective).detected,
    settings: {
      backendType: env.BACKEND_TYPE,
      model: env.AEGISAI_MODEL,
      quantization: rec.quant,
      context: contextHint,
      engine: rec.engine,
    },
    env,
    note: rec.note,
  };
}

function apply(hw, opts) {
  opts = opts || {};
  const t = tune(hw);
  if (opts.dryRun) return Object.assign({ ok: true, dryRun: true }, t);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS(), JSON.stringify(t, null, 2));
    return Object.assign({ ok: true, path: SETTINGS() }, t);
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

function load() {
  if (!fs.existsSync(SETTINGS())) return null;
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); }
  catch (e) { return null; }
}

function tools() {
  return [
    { name: 'hardware_autotune', description: 'Compute hardware-tuned backend/quantization/context settings.', inputSchema: { type: 'object', properties: { dryRun: { type: 'boolean' } } } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'hardware_autotune') return apply(args.hw, args);
  throw new Error('unknown hardware_autotune tool: ' + name);
}

module.exports = { tune, apply, load, tools, dispatch };
