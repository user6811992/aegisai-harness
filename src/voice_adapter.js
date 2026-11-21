// src/voice_adapter.js
// Local ASR/TTS adapter: whisper.cpp / piper endpoints, all local, no cloud.
const STT = process.env.STT_URL || '';
const TTS = process.env.TTS_URL || '';

async function transcribe(audioBuffer, contentType) {
  if (!STT) return { ok: false, error: 'STT_URL not configured (use whisper.cpp locally)' };
  try {
    const r = await fetch(STT, { method: 'POST', headers: { 'Content-Type': contentType || 'audio/wav' }, body: audioBuffer, signal: AbortSignal.timeout(60000) });
    if (!r.ok) return { ok: false, error: 'STT HTTP ' + r.status };
    const data = await r.json();
    return { ok: true, text: data.text || '' };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

async function synthesize(text, opts) {
  if (!TTS) return { ok: false, error: 'TTS_URL not configured (use piper locally)' };
  try {
    const r = await fetch(TTS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: (opts && opts.voice) || 'default' }), signal: AbortSignal.timeout(60000) });
    if (!r.ok) return { ok: false, error: 'TTS HTTP ' + r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: true, audio: buf, bytes: buf.length };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function status() { return { stt: STT || 'not configured', tts: TTS || 'not configured', localOnly: true }; }

module.exports = { transcribe, synthesize, status };
