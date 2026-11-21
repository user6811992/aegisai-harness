// src/vault.js
// Encrypted local secret vault (AES-256-GCM).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const VAULT_PATH = path.join(DATA_DIR, 'vault.json');
const ALG = 'aes-256-gcm';

function getKey() {
  const pass = process.env.AEGISAI_VAULT_KEY || 'aegisai-harness-default-key';
  return crypto.createHash('sha256').update(pass).digest();
}

function loadVault() {
  if (!fs.existsSync(VAULT_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
    const key = getKey();
    const iv = Buffer.from(raw.iv, 'base64');
    const tag = Buffer.from(raw.tag, 'base64');
    const ct = Buffer.from(raw.data, 'base64');
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return JSON.parse(pt);
  } catch (e) {
    return {};
  }
}

function saveVault(obj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VAULT_PATH, JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ct.toString('base64'),
  }, null, 2));
}

function setSecret(name, value) {
  const v = loadVault();
  v[name] = value;
  saveVault(v);
}

function getSecret(name) {
  const v = loadVault();
  return v[name];
}

function deleteSecret(name) {
  const v = loadVault();
  delete v[name];
  saveVault(v);
}

function listSecrets() {
  return Object.keys(loadVault());
}

module.exports = { loadVault, saveVault, setSecret, getSecret, deleteSecret, listSecrets };
