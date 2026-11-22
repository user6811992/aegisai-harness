// src/sim_browser.js
// Deterministic simulated browser: fixture-based DOM for testing without a real Chrome.
const { fromHTML, strip } = require('./markdown_extract');

function parse(html) {
  const elements = [];
  const re = /<(a|button|input|textarea|div|h[1-6]|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    const attrs = m[2] || '';
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/);
    const typeMatch = attrs.match(/type=["']([^"']+)["']/);
    elements.push({
      tag: m[1].toLowerCase(), id: idMatch ? idMatch[1] : null,
      href: hrefMatch ? hrefMatch[1] : null, inputType: typeMatch ? typeMatch[1] : null,
      text: strip(m[3]), index: elements.length,
    });
  }
  return elements;
}

class SimBrowser {
  constructor(fixtures) { this.fixtures = fixtures || {}; this.url = 'about:blank'; this.history = []; this.values = {}; }
  navigate(url) {
    this.url = url;
    this.history.push(url);
    this.dom = parse(this.fixtures[url] || '<html><body><h1>' + url + '</h1></body></html>');
    return { ok: true, url, elements: this.dom.length };
  }
  snapshot() { return (this.dom || []).map((e) => e.tag + '[' + (e.id || e.index) + '] ' + e.text).join('\n'); }
  click(selector) {
    const el = (this.dom || []).find((e) => e.id === selector || e.text === selector || String(e.index) === selector);
    if (!el) return { ok: false, output: 'no element: ' + selector };
    if (el.href) return this.navigate(el.href);
    return { ok: true, output: 'clicked ' + el.tag + ' ' + el.text };
  }
  type(selector, text) {
    const el = (this.dom || []).find((e) => e.id === selector || String(e.index) === selector);
    if (!el) return { ok: false, output: 'no element: ' + selector };
    this.values[selector] = text;
    return { ok: true, output: 'typed into ' + el.tag };
  }
  markdown() { return fromHTML('<div>' + (this.dom || []).map((e) => '<p>' + e.text + '</p>').join('') + '</div>', this.url); }
}

module.exports = { parse, SimBrowser };
