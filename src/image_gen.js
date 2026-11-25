// src/image_gen.js
// Local image generation via OpenAI-compatible image APIs (DALL-E, Stable Diffusion WebUI, ComfyUI).
const fs = require('fs');
const path = require('path');
const { backendChat } = require('./backends');

const DEFAULT_URL = process.env.IMAGE_GEN_URL || 'http://127.0.0.1:7860';

async function generate(prompt, opts) {
  opts = opts || {};
  const url = opts.url || DEFAULT_URL;
  const size = opts.size || '512x512';
  const [w, h] = size.split('x').map(Number);
  const body = { prompt, width: w || 512, height: h || 512, steps: opts.steps || 20, cfg_scale: opts.cfg || 7 };

  // Try Stable Diffusion WebUI API
  try {
    const r = await fetch(url + '/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const data = await r.json();
      if (data.images && data.images.length > 0) {
        const buf = Buffer.from(data.images[0], 'base64');
        const outPath = opts.output || path.join(require('os').tmpdir(), 'gen-' + Date.now() + '.png');
        fs.writeFileSync(outPath, buf);
        return { ok: true, path: outPath, bytes: buf.length, backend: 'sd-webui' };
      }
    }
  } catch (e) {}

  // Try OpenAI-compatible image generation
  try {
    const r = await fetch(url + '/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, n: 1, size }),
    });
    if (r.ok) {
      const data = await r.json();
      if (data.data && data.data.length > 0) {
        const img = data.data[0];
        if (img.url) return { ok: true, url: img.url, backend: 'openai-compat' };
        if (img.b64_json) {
          const buf = Buffer.from(img.b64_json, 'base64');
          const outPath = opts.output || path.join(require('os').tmpdir(), 'gen-' + Date.now() + '.png');
          fs.writeFileSync(outPath, buf);
          return { ok: true, path: outPath, bytes: buf.length, backend: 'openai-compat' };
        }
      }
    }
  } catch (e) {}

  return { ok: false, error: 'no image generation backend available at ' + url };
}

function isAvailable() {
  try {
    // Quick check if SD WebUI is running
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(DEFAULT_URL + '/sdapi/v1/options', (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
  } catch (e) { return Promise.resolve(false); }
}

module.exports = { generate, isAvailable, DEFAULT_URL };