// src/vision.js
// Vision/image input support: normalize image attachments into message content.
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

module.exports = { imageMessage, supportsVision };
