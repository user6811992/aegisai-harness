// src/vision.js
// Vision/image input support: normalize image attachments into message content,
// plus a coordinate locator used by browser_find.
const BACKENDS = require('./backends');

function imageMessage(text, images) {
  const parts = [];
  if (text) parts.push({ type: 'text', text });
  for (const img of images || []) {
    const data = typeof img === 'string' ? img : (img.data || img.base64 || '');
    const mime = (typeof img === 'object' && img.mime) || 'image/png';
    if (!data) continue;
    const url = data.startsWith('data:') ? data : 'data:' + mime + ';base64,' + data;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role: 'user', content: parts };
}

function supportsVision(msg) {
  return Array.isArray(msg.content) && msg.content.some((p) => p.type === 'image_url');
}

/**
 * Ask a vision-capable model where an element described in natural language is.
 * Returns { ok, point: {x, y}, raw } — coordinates are CSS pixels in the image's
 * own dimensions; the caller scales them to the viewport if needed.
 */
async function locate(dataUrl, description, opts) {
  opts = opts || {};
  const prompt = [
    'You are a UI grounding model.',
    'Find the element that best matches this description: "' + description + '".',
    'Reply with ONLY a JSON object: {"x": <number>, "y": <number>, "confidence": <0..1>}',
    'Coordinates are the centre of the element in image pixels.',
    'If it is not present, reply {"x": null, "y": null, "confidence": 0}.',
  ].join('\n');
  const body = {
    model: opts.model || process.env.AEGISAI_VISION_MODEL || process.env.AEGISAI_MODEL || 'llama3.2:3b',
    messages: [imageMessage(prompt, [{ data: dataUrl, mime: 'image/png' }])],
    stream: false,
    temperature: 0,
  };
  let text = '';
  try {
    const r = await BACKENDS.backendChat(body, () => {});
    const payload = r && r.data ? r.data : r;
    text = (payload && payload.message && payload.message.content) || (typeof payload === 'string' ? payload : '') || '';
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  const m = String(text).match(/\{[\s\S]*?\}/);
  if (!m) return { ok: false, error: 'no JSON in vision reply', raw: String(text).slice(0, 200) };
  let parsed;
  try { parsed = JSON.parse(m[0]); } catch (e) { return { ok: false, error: 'invalid JSON from vision model', raw: m[0] }; }
  if (parsed.x == null || parsed.y == null) return { ok: false, error: 'element not found', confidence: parsed.confidence || 0 };
  return { ok: true, point: { x: Number(parsed.x), y: Number(parsed.y) }, confidence: Number(parsed.confidence || 0) };
}

module.exports = { imageMessage, supportsVision, locate };
