// src/url_validate.js
// URL validation / SSRF protection for user-supplied fetches.
const BLOCKED_HOSTS = /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i;
function isPrivateIp(host) {
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || host === '::1' || host === '0.0.0.0') return true;
  const m = host.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}
function validate(url, opts) {
  opts = opts || {};
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, reason: 'unsupported protocol' };
    const host = u.hostname;
    if (BLOCKED_HOSTS.test(host) || isPrivateIp(host)) {
      if (!opts.allowPrivate) return { ok: false, reason: 'private/internal host blocked: ' + host };
    }
    if (opts.allowlist && !opts.allowlist.some((h) => host === h || host.endsWith('.' + h))) return { ok: false, reason: 'host not in allowlist' };
    return { ok: true, url: u.href, host };
  } catch (e) { return { ok: false, reason: 'invalid URL' }; }
}

module.exports = { isPrivateIp, validate };
