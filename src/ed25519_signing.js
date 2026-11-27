// src/ed25519_signing.js
// Ed25519 certificate signing — upgrade to verification_cert.js. Adds an
// optional detached signature so a certificate can be verified with a public
// key independent of the harness. The SHA-256 content hash check is preserved.
const crypto = require('crypto');
const certs = require('./verification_cert');

function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    fingerprint: crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16),
  };
}

function signObject(obj, privateKeyPem) {
  const priv = crypto.createPrivateKey(privateKeyPem);
  // Exclude both self-referential fields when signing.
  const unsigned = Object.assign({}, obj);
  delete unsigned.contentHash; delete unsigned.signature;
  return crypto.sign(null, Buffer.from(JSON.stringify(unsigned)), priv).toString('base64');
}

function verifySignature(obj, publicKeyPem) {
  if (!obj || !obj.signature) return { ok: false, error: 'no signature present' };
  try {
    const pub = crypto.createPublicKey(publicKeyPem);
    const unsigned = Object.assign({}, obj);
    delete unsigned.contentHash; delete unsigned.signature;
    const good = crypto.verify(null, Buffer.from(JSON.stringify(unsigned)), pub, Buffer.from(obj.signature, 'base64'));
    return { ok: good, signatureValid: good, hashValid: certs.verify(obj).contentHashMatches };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function signedIssue(runId, run, opts) {
  opts = opts || {};
  const issued = certs.issue(runId, run, opts);
  if (!issued.ok || !opts.privateKey) return issued;
  // Read the saved cert, sign it, and write it back.
  const fs = require('fs');
  const cert = JSON.parse(fs.readFileSync(issued.path, 'utf8'));
  cert.signature = signObject(cert, opts.privateKey);
  cert.signatureAlgorithm = 'Ed25519';
  fs.writeFileSync(issued.path, JSON.stringify(cert, null, 2));
  return { ...issued, signature: cert.signature, algorithm: 'Ed25519' };
}

function tools() {
  return [
    { name: 'cert_keypair', description: 'Generate an Ed25519 keypair for certificate signing.', inputSchema: { type: 'object' } },
    { name: 'cert_sign', description: 'Sign a certificate object with Ed25519.', inputSchema: { type: 'object', properties: { certificate: { type: 'object' }, privateKey: { type: 'string' } }, required: ['certificate','privateKey'] } },
    { name: 'cert_verify_signature', description: 'Verify a certificate signature and content hash.', inputSchema: { type: 'object', properties: { certificate: { type: 'object' }, publicKey: { type: 'string' } }, required: ['certificate','publicKey'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'cert_keypair') return { ok: true, ...keypair() };
  if (name === 'cert_sign') return { ok: true, signature: signObject(args.certificate, args.privateKey), algorithm: 'Ed25519' };
  if (name === 'cert_verify_signature') return verifySignature(args.certificate, args.publicKey);
  if (name === 'cert_signed_issue') return signedIssue(args.runId, args.run, args);
  throw new Error('unknown ed25519_signing tool: ' + name);
}
module.exports = { keypair, signObject, verifySignature, signedIssue, tools, dispatch };
