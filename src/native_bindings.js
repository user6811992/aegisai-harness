// src/native_bindings.js
// In-process inference in Tauri via Rust bindings — clean-room
// replikeit/ik-llama-cpp-rs idea. Defines a safe FFI contract: the Rust side
// owns model memory; JS passes only plain JSON. Feature-gated, no binary.
const BINDINGS = {
  load_model: { args: ['path', 'n_gpu_layers'], returns: 'handle', unsafe: false },
  tokenize: { args: ['handle', 'text'], returns: 'number[]', unsafe: false },
  generate: { args: ['handle', 'prompt', 'max_tokens'], returns: 'string', unsafe: false },
  unload: { args: ['handle'], returns: 'bool', unsafe: false },
};

function available() {
  return { ok: true, enabled: process.env.AEGISAI_NATIVE_INFERENCE === 'true', note: 'Rust FFI bindings are opt-in; set AEGISAI_NATIVE_INFERENCE=true and provide a compiled Tauri plugin' };
}
function plan(op, args) {
  const b = BINDINGS[op];
  if (!b) return { ok: false, error: 'unknown native op: ' + op };
  if (!available().enabled) return { ok: false, error: 'native inference disabled (opt-in)', note: 'use an out-of-process backend by default' };
  const missing = b.args.filter((a) => args && args[a] === undefined);
  if (missing.length) return { ok: false, error: 'missing args: ' + missing.join(', ') };
  return { ok: true, op, contract: b, args: args, note: 'caller invokes the Rust plugin with this JSON payload' };
}
function tools() {
  return [
    { name: 'native_available', description: 'Check in-process native inference availability.', inputSchema: { type: 'object' } },
    { name: 'native_plan', description: 'Plan a safe native inference FFI call.', inputSchema: { type: 'object', properties: { op: { type: 'string' }, args: { type: 'object' } }, required: ['op'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'native_available') return available();
  if (name === 'native_plan') return plan(args.op, args.args);
  throw new Error('unknown native_bindings tool: ' + name);
}
module.exports = { BINDINGS, available, plan, tools, dispatch };
