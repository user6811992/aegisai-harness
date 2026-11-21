// src/core/logger.js
// Minimal structured logger writing to stderr + optional file.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

function ensureDir(d) { try { fs.mkdirSync(d, { recursive: true }); } catch (e) {} }

function log(level, msg, extra) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(extra || {}) });
  process.stderr.write(line + '\n');
  try {
    ensureDir(DATA_DIR);
    fs.appendFileSync(path.join(DATA_DIR, 'harness.log'), line + '\n');
  } catch (e) {}
}

module.exports = {
  info: (m, e) => log('info', m, e),
  warn: (m, e) => log('warn', m, e),
  error: (m, e) => log('error', m, e),
  debug: (m, e) => log('debug', m, e),
};
