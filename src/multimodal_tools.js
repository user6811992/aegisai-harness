// src/multimodal_tools.js
// Multi-modal generation tools — clean-room koboldcpp (12,411⭐) idea.
// One adapter over image/audio generation backends. Reuses `image_gen` when
// available; never bundles a model or calls the network by default.
const MODALITIES = ['text', 'image', 'audio', 'video'];

function plan(modality, opts) {
  opts = opts || {};
  if (!MODALITIES.includes(modality)) return { ok: false, error: 'unsupported modality: ' + modality };
  if (modality !== 'text' && process.env.AEGISAI_OFFLINE === 'true') {
    return { ok: false, error: 'generation disabled in offline mode (opt-in backend required)' };
  }
  return {
    ok: true, modality,
    backend: opts.backend || 'local',
    params: { prompt: opts.prompt || '', steps: opts.steps || 20, seed: opts.seed || 0 },
    note: 'caller supplies the installed backend; no network by default',
  };
}
function describe() {
  return { ok: true, modalities: MODALITIES, imageGenAvailable: (() => { try { require('./image_gen'); return true; } catch (e) { return false; } })() };
}
function tools() {
  return [
    { name: 'multimodal_plan', description: 'Plan a multi-modal generation request.', inputSchema: { type: 'object', properties: { modality: { type: 'string' }, prompt: { type: 'string' } }, required: ['modality'] } },
    { name: 'multimodal_modalities', description: 'List supported modalities.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'multimodal_plan') return plan(args.modality, args);
  if (name === 'multimodal_modalities' || name === 'multimodal_describe') return describe();
  throw new Error('unknown multimodal_tools tool: ' + name);
}
module.exports = { MODALITIES, plan, describe, tools, dispatch };
