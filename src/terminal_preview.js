// src/terminal_preview.js
// Terminal media preview — clean-room 0xNyk/termpeek (6⭐, MIT) idea.
// Render a text-only preview of images/video/PDFs/diffs from metadata the
// caller supplies. No GUI dependency, works over SSH.
function previewImage(meta) {
  const w = meta && meta.width || 0, h = meta && meta.height || 0;
  const blocks = Math.min(12, Math.max(1, Math.round(h / 24)));
  return { ok: true, kind: 'image', text: `[image ${w}x${h}]\n` + Array(blocks).fill('█'.repeat(Math.min(32, Math.max(4, Math.round(w / 24))))).join('\n') };
}
function previewDiff(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = lines.map((l) => (l.startsWith('+') ? '\x1b[32m' + l + '\x1b[0m' : l.startsWith('-') ? '\x1b[31m' + l + '\x1b[0m' : l)).slice(0, 80);
  return { ok: true, kind: 'diff', text: out.join('\n') };
}
function preview(kind, meta) {
  if (kind === 'image') return previewImage(meta);
  if (kind === 'diff') return previewDiff(meta && meta.text);
  return { ok: true, kind, text: `[${kind} preview — metadata only: ${JSON.stringify(meta || {}).slice(0, 200)}]` };
}
function tools() {
  return [{ name: 'term_preview', description: 'Render a terminal text preview of media or a diff.', inputSchema: { type: 'object', properties: { kind: { type: 'string' }, meta: { type: 'object' } }, required: ['kind'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'term_preview') return preview(args.kind, args.meta);
  throw new Error('unknown terminal_preview tool: ' + name);
}
module.exports = { previewImage, previewDiff, preview, tools, dispatch };
