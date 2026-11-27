// src/paillier.js
// Additively homomorphic encryption (Paillier) — clean-room hardbyte/paillier.js
// (23⭐) idea. Pure JS using BigInt, no dependencies. Supports key generation,
// encryption, decryption and ciphertext addition (E(a)+E(b)=E(a+b)).
const crypto = require('crypto');
function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function modInverse(a, m) {
  let [old_r, r] = [a, m], [old_s, s] = [1n, 0n];
  while (r) { const q = old_r / r; [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; }
  if (old_r !== 1n) throw new Error('no modular inverse');
  return ((old_s % m) + m) % m;
}
function powMod(base, exp, mod) {
  let r = 1n, b = base % mod, e = exp;
  while (e > 0n) { if (e & 1n) r = (r * b) % mod; b = (b * b) % mod; e >>= 1n; }
  return r;
}
function randomBelow(max) {
  const bytes = Buffer.from(crypto.randomBytes(32));
  let n = BigInt('0x' + bytes.toString('hex'));
  return n % max;
}
function keygen(bits) {
  bits = bits || 256; // small default for tests; use >=1024 for real security
  const half = bits / 2;
  const genPrime = () => {
    let p;
    do { p = BigInt('0x' + crypto.randomBytes(Math.ceil(half / 8)).toString('hex')) | 1n | (1n << BigInt(half - 1)); } while (!isPrime(p));
    return p;
  };
  let p = genPrime(), q = genPrime();
  while (q === p) q = genPrime();
  const n = p * q;
  const lambda = ((p - 1n) * (q - 1n)) / gcd(p - 1n, q - 1n);
  const g = n + 1n;
  const mu = modInverse(lambda, n);
  return { publicKey: { n: n.toString(), g: g.toString() }, privateKey: { lambda: lambda.toString(), mu: mu.toString(), n: n.toString() } };
}
// Miller-Rabin (deterministic bases for the small key sizes used here).
function isPrime(n) {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) if (n === p) return true;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) if (n % p === 0n) return false;
  let d = n - 1n, r = 0n;
  while (d % 2n === 0n) { d /= 2n; r += 1n; }
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n]) {
    let x = powMod(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let i = 1n; i < r; i += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) { composite = false; break; }
    }
    if (composite) return false;
  }
  return true;
}
function encrypt(pk, m) {
  const n = BigInt(pk.n), g = BigInt(pk.g);
  const r = randomBelow(n) || 1n;
  return (powMod(g, BigInt(m), n * n) * powMod(r, n, n * n) % (n * n)).toString();
}
function decrypt(sk, c) {
  const n = BigInt(sk.n), lambda = BigInt(sk.lambda), mu = BigInt(sk.mu);
  const l = (powMod(BigInt(c), lambda, n * n) - 1n) / n;
  return Number((l * mu) % n);
}
function add(pk, a, b) {
  const n2 = BigInt(pk.n) ** 2n;
  return ((BigInt(a) * BigInt(b)) % n2).toString();
}
function tools() {
  return [
    { name: 'paillier_keygen', description: 'Generate a Paillier keypair.', inputSchema: { type: 'object' } },
    { name: 'paillier_encrypt', description: 'Encrypt an integer homomorphically.', inputSchema: { type: 'object', properties: { publicKey: { type: 'object' }, value: { type: 'number' } }, required: ['publicKey','value'] } },
    { name: 'paillier_decrypt', description: 'Decrypt a Paillier ciphertext.', inputSchema: { type: 'object', properties: { privateKey: { type: 'object' }, ciphertext: { type: 'string' } }, required: ['privateKey','ciphertext'] } },
    { name: 'paillier_add', description: 'Add two ciphertexts homomorphically.', inputSchema: { type: 'object', properties: { publicKey: { type: 'object' }, a: { type: 'string' }, b: { type: 'string' } }, required: ['publicKey','a','b'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'paillier_keygen') return { ok: true, ...keygen(args.bits) };
  if (name === 'paillier_encrypt') return { ok: true, ciphertext: encrypt(args.publicKey, args.value) };
  if (name === 'paillier_decrypt') return { ok: true, value: decrypt(args.privateKey, args.ciphertext) };
  if (name === 'paillier_add') return { ok: true, ciphertext: add(args.publicKey, args.a, args.b) };
  throw new Error('unknown paillier tool: ' + name);
}
module.exports = { keygen, encrypt, decrypt, add, tools, dispatch };
