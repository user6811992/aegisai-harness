// src/aws_emulator_target.js
// AWS local emulator as a RE/pentest target — clean-room aws/aws-emulator
// (10,189⭐, Rust) idea. Opt-in only: plan a local target for authorized
// testing. Never starts or scans anything itself.
function plan(opts) {
  opts = opts || {};
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: false, error: 'emulator target disabled in offline mode' };
  if (opts.authorized !== true) return { ok: false, error: 'explicit authorization required for pentest target' };
  return {
    ok: true, target: opts.endpoint || 'http://127.0.0.1:4566',
    services: opts.services || ['s3', 'iam', 'lambda'],
    note: 'caller starts the emulator; use only on systems you own or are authorized to test',
  };
}
function tools() {
  return [{ name: 'aws_emulator_plan', description: 'Plan an authorized local emulator pentest target.', inputSchema: { type: 'object', properties: { authorized: { type: 'boolean' }, services: { type: 'array' } }, required: ['authorized'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'aws_emulator_plan') return plan(args);
  throw new Error('unknown aws_emulator_target tool: ' + name);
}
module.exports = { plan, tools, dispatch };
