// src/http_utils.js — safe helpers for the built-in web server.
const path = require('path');
const crypto = require('crypto');

/**
 * Resolve a request path to a file inside `root`.
 * Returns null when the path would escape `root` (or is malformed).
 */
function resolvePublicPath(root, urlPath) {
  if (typeof urlPath !== 'string') return null;
  const rootAbs = path.resolve(root);
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); }
  catch (e) { return null; }
  if (decoded.includes('\0')) return null;

  // Windows treats backslashes as separators; normalize before validating.
  decoded = decoded.replace(/\\/g, '/');
  const rel = decoded.replace(/^\/+/, '') || 'index.html';
  const target = path.resolve(rootAbs, rel);
  const inside = path.relative(rootAbs, target);
  if (inside.startsWith('..' + path.sep) || inside === '..' || path.isAbsolute(inside)) return null;
  return target;
}

/** Constant-time token comparison. Returns true when no token is configured. */
function tokenMatches(supplied, expected) {
  if (!expected) return true;
  const a = Buffer.from(String(supplied || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { resolvePublicPath, tokenMatches };
