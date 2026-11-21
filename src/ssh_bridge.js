// src/ssh_bridge.js
// SSH-based push A2A bridge across machines.
const { spawnSync } = require('child_process');

function send(host, command, payload, opts) {
  opts = opts || {};
  const remote = (opts.remoteCommand || 'aegisai-harness --rpc') + '';
  const input = JSON.stringify({ id: 'ssh_' + Date.now(), prompt: payload }) + '\n';
  try {
    const r = spawnSync('ssh', [host, remote], { input, encoding: 'utf8', timeout: opts.timeout || 60000 });
    return { ok: r.status === 0, output: r.stdout || '', error: r.stderr || '' };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function peers() {
  return (process.env.AEGISAI_SSH_PEERS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

module.exports = { send, peers };
