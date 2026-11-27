// src/credential_seal.js
// Hardware-backed credential vault daemon — clean-room aws/credential-daemon
// idea. Contract for sealing secrets to a local key; never stores plaintext.
// A real HSM/TPM integration is opt-in and supplied by the caller.
const crypto = require('crypto');

function seal(value, key) {
  const k = key || crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  return { ok: true, sealed: Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64'), key: k.toString('base64'), note: 'store the key in a hardware-backed keystore, not on disk' };
}
function unsealed(sealed, key) {
  try {
    const raw = Buffer.from(sealed, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), raw.slice(0, 12));
    d.setAuthTag(raw.slice(12, 28));
    return { ok: true, value: Buffer.concat([d.update(raw.slice(28)), d.final()]).toString('utf8') };
  } catch (e) { return { ok: false, error: 'unseal failed: ' + String(e.message || e) }; }
}
function status() {
  return { ok: true, hardware: false, note: 'hardware-backed daemon not bundled; caller supplies the keystore adapter' };
}
function tools() {
  return [
    { name: 'credential_seal', description: 'Seal a secret with a local key.', inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] } },
    { name: 'credential_unseal', description: 'Unseal a secret with its key.', inputSchema: { type: 'object', properties: { sealed: { type: 'string' }, key: { type: 'string' } }, required: ['sealed','key'] } },
    { name: 'credential_vault_status', description: 'Check credential vault availability.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'credential_seal') return seal(args.value, args.key);
  if (name === 'credential_unseal') return unsealed(args.sealed, args.key);
  if (name === 'credential_vault_status') return status();
  throw new Error('unknown credential_seal tool: ' + name);
}
module.exports = { seal, unsealed, status, tools, dispatch };
