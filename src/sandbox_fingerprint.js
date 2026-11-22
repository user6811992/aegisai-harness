// src/sandbox_fingerprint.js
// Sandbox capability fingerprinting (sandbox-fingerprinting pattern).
const os = require('os');
const sealed = require('./sealed');

function fingerprint() {
  const fp = {
    platform: process.platform,
    arch: process.arch,
    docker: sealed.available(),
    shell: !!process.env.SHELL || process.platform === 'win32',
    cwdWritable: (() => { try { require('fs').accessSync(process.cwd(), require('fs').constants.W_OK); return true; } catch (e) { return false; } })(),
    cores: os.cpus().length,
    ramGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    offline: process.env.AEGISAI_OFFLINE === 'true',
  };
  return fp;
}
function describe(fp) {
  fp = fp || fingerprint();
  return 'platform=' + fp.platform + ' arch=' + fp.arch + ' docker=' + fp.docker + ' offline=' + fp.offline + ' ram=' + fp.ramGB + 'GB';
}

module.exports = { fingerprint, describe };
