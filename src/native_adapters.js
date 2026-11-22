// src/native_adapters.js
// Graceful adapter interfaces for native-only capabilities (in-process models, Windows RPA).
const inProcessModel = {
  name: 'in-process-model',
  available: false,
  reason: 'requires native ggml/llama.cpp bindings (not present)',
  load(modelPath) { return { ok: false, error: this.reason, modelPath: modelPath || '' }; },
};

const windowsRPA = {
  name: 'windows-rpa',
  available: process.platform === 'win32',
  reason: process.platform === 'win32' ? 'UIAutomation available via PowerShell (adapter only)' : 'Windows only',
  click(selector) { return { ok: false, error: 'RPA adapter only; wire PowerShell UIAutomation for real control', selector }; },
  type(selector, text) { return { ok: false, error: 'RPA adapter only', selector, text }; },
};

function status() { return { inProcessModel: { available: inProcessModel.available, reason: inProcessModel.reason }, windowsRPA: { available: windowsRPA.available, reason: windowsRPA.reason } }; }

module.exports = { inProcessModel, windowsRPA, status };
