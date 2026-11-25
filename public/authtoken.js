// /authtoken.js — shared auth shim for secondary pages (plugins, dag, trajectory).
// Reads the token from sessionStorage (set by the main UI) or ?token= in the URL,
// then attaches it to fetch() and EventSource() calls.
(function () {
  function readToken() {
    try {
      const q = new URL(location.href).searchParams.get('token');
      if (q) { try { sessionStorage.setItem('aegisai_token', q); } catch (e) {} return q; }
      return sessionStorage.getItem('aegisai_token') || localStorage.getItem('aegisai_token') || '';
    } catch (e) { return ''; }
  }
  const token = readToken();

  function withToken(url) {
    if (!token) return url;
    try {
      const u = new URL(url, location.origin);
      if (!u.searchParams.has('token')) u.searchParams.set('token', token);
      return u.pathname + u.search + u.hash;
    } catch (e) { return url; }
  }

  if (token) {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const opts = Object.assign({}, init || {});
      const headers = new Headers(opts.headers || {});
      if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
      opts.headers = headers;
      const url = typeof input === 'string' ? withToken(input) : input;
      return origFetch(url, opts);
    };

    const OrigEventSource = window.EventSource;
    if (OrigEventSource) {
      window.EventSource = function (url, cfg) { return new OrigEventSource(withToken(url), cfg); };
      window.EventSource.prototype = OrigEventSource.prototype;
    }
  }

  window.AEGISAI_AUTH = { token, withToken, hasToken: Boolean(token) };
})();
