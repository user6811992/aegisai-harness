// src/fs_robust.js
// Windows/filesystem robustness helpers.
const path = require('path');
const IS_WINDOWS = process.platform === 'win32';

function normalizePath(p) {
  if (!p) return p;
  let s = String(p).replace(/[\\/]+/g, path.sep);
  if (IS_WINDOWS) s = s.replace(/^\/([A-Za-z]:)/, '$1');
  return path.normalize(s);
}
function isAbsolute(p) { return path.isAbsolute(normalizePath(p)); }
function safeJoin(root, rel) {
  const r = path.resolve(root);
  const out = path.resolve(r, normalizePath(rel));
  if (out !== r && !out.startsWith(r + path.sep)) throw new Error('path traversal blocked');
  return out;
}
function shellCompatible(cmd) {
  if (!IS_WINDOWS) return cmd;
  // PowerShell does not accept && as a statement separator
  return String(cmd).replace(/&&/g, ';');
}
function longPath(p) {
  if (!IS_WINDOWS) return p;
  const full = path.resolve(p);
  return full.length > 260 && !full.startsWith('\\\\?\\') ? '\\\\?\\' + full : full;
}

module.exports = { IS_WINDOWS, normalizePath, isAbsolute, safeJoin, shellCompatible, longPath };
