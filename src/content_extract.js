// src/content_extract.js
// Clean-room main-content extraction — inspired by kepano/defuddle (10,211⭐).
// Removes clutter (nav/header/footer/aside/scripts/comments) and returns the
// primary content as readable text/Markdown with metadata. No dependencies,
// no network. Operates on HTML strings the caller already fetched.
const fs = require('fs');

function stripTags(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(nav|header|footer|aside|form|button)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

function extractMain(html) {
  const raw = String(html || '');
  const candidates = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+(?:class|id)=["'][^"']*(?:content|article|post|entry|main)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  ];
  for (const re of candidates) {
    const m = raw.match(re);
    if (m && m[1] && stripTags(m[1]).length > 80) return m[1];
  }
  return raw;
}

function metadata(html) {
  const out = {};
  const title = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) out.title = stripTags(title[1]);
  const desc = String(html || '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  if (desc) out.description = desc[1];
  const author = String(html || '').match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']*)["']/i);
  if (author) out.author = author[1];
  // schema.org / JSON-LD bits
  const ld = String(html || '').match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try { const j = JSON.parse(ld[1]); const obj = Array.isArray(j) ? j[0] : j; if (obj && obj.headline) out.headline = obj.headline; if (obj && obj.author) out.author = typeof obj.author === 'string' ? obj.author : obj.author.name; }
    catch (e) {}
  }
  return out;
}

function toMarkdown(html) {
  const main = stripTags(extractMain(html));
  const blocks = main.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.join('\n\n');
}

function extract(html, opts) {
  opts = opts || {};
  const meta = metadata(html);
  const text = opts.markdown ? toMarkdown(html) : stripTags(extractMain(html));
  return {
    ok: text.length > 0,
    title: meta.title || meta.headline || '',
    author: meta.author || '',
    description: meta.description || '',
    text: text.slice(0, opts.maxChars || 100000),
    words: (text.match(/[a-zA-Z0-9_]+/g) || []).length,
  };
}

function extractFile(filePath, opts) {
  try { return extract(fs.readFileSync(filePath, 'utf8'), opts); }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function tools() {
  return [
    { name: 'content_extract', description: 'Extract main readable content + metadata from an HTML string (Defuddle-style).', inputSchema: { type: 'object', properties: { html: { type: 'string' }, markdown: { type: 'boolean' } }, required: ['html'] } },
    { name: 'content_extract_file', description: 'Extract main content from a local HTML file.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'content_extract') return extract(args.html, args);
  if (name === 'content_extract_file') return extractFile(args.path, args);
  throw new Error('unknown content_extract tool: ' + name);
}

module.exports = { stripTags, extractMain, metadata, toMarkdown, extract, extractFile, tools, dispatch };
