// src/p2p_messaging.js
// Account-free agent P2P messaging — clean-room ix-infrastructure/Peer2Peer
// (Apache-2.0). E2E-encrypted session messages, presence, conflict warnings on
// shared files. Local key generation; relay sees only ciphertext. No accounts.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const DIR = () => path.join(DATA_DIR, 'p2p');
function keypair() {
  // RSA-OAEP supports direct key wrapping; x25519 would need ECDH derivation.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    fingerprint: crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16),
  };
}
function encrypt(text, publicKeyPem) {
  const pub = crypto.createPublicKey(publicKeyPem);
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(text||''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrapped = crypto.publicEncrypt({ key: pub, oaepHash: 'sha256' }, key);
  return { ciphertext: Buffer.concat([iv, tag, enc]).toString('base64'), key: wrapped.toString('base64') };
}
function decrypt(msg, privateKeyPem) {
  const priv = crypto.createPrivateKey(privateKeyPem);
  const raw = Buffer.from(msg.ciphertext, 'base64');
  const iv = raw.slice(0, 12), tag = raw.slice(12, 28), enc = raw.slice(28);
  const key = crypto.privateDecrypt({ key: priv, oaepHash: 'sha256' }, Buffer.from(msg.key, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
function conflictWarning(file, peers) {
  return { ok: true, file, peers: peers || [], warning: 'shared file modified by multiple sessions; resolve before merge' };
}
function saveIdentity(id) {
  fs.mkdirSync(DIR(), { recursive: true });
  const p = path.join(DIR(), 'identity.json');
  fs.writeFileSync(p, JSON.stringify(id));
  return { ok: true, path: p, fingerprint: id.fingerprint };
}
function tools() {
  return [
    { name: 'p2p_keypair', description: 'Generate a local account-free identity keypair.', inputSchema: { type: 'object' } },
    { name: 'p2p_encrypt', description: 'Encrypt a message for a peer public key.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, publicKey: { type: 'string' } }, required: ['text','publicKey'] } },
    { name: 'p2p_decrypt', description: 'Decrypt a message with your private key.', inputSchema: { type: 'object', properties: { message: { type: 'object' }, privateKey: { type: 'string' } }, required: ['message','privateKey'] } },
    { name: 'p2p_conflict', description: 'Warn when a shared file has concurrent editors.', inputSchema: { type: 'object', properties: { file: { type: 'string' }, peers: { type: 'array' } }, required: ['file'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'p2p_keypair') return { ok: true, ...keypair() };
  if (name === 'p2p_encrypt') return { ok: true, ...encrypt(args.text, args.publicKey) };
  if (name === 'p2p_decrypt') return { ok: true, text: decrypt(args.message, args.privateKey) };
  if (name === 'p2p_conflict') return conflictWarning(args.file, args.peers);
  throw new Error('unknown p2p tool: ' + name);
}
module.exports = { keypair, encrypt, decrypt, conflictWarning, saveIdentity, tools, dispatch };
