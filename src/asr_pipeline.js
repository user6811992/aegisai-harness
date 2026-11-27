// src/asr_pipeline.js
// Word-level ASR + diarization — clean-room m-bain/whisperX (25,794⭐) pattern.
// Heavy external toolchain is NOT bundled. This module defines the pipeline
// contract (align → diarize → assign speakers) and a deterministic stub that
// works offline with caller-supplied segments. Fails closed outside opt-in.
function available() {
  return { ok: true, whisperX: false, note: 'whisperX not bundled — install separately for production word-level alignment; offline stub available' };
}
function align(segments, words) {
  return (segments || []).map((s, i) => ({ ...s, words: (words && words[i]) || String(s.text || '').split(/\s+/).filter(Boolean).map((w) => ({ word: w, start: s.start || 0, end: s.end || 0 })) }));
}
function diarize(aligned, speakers) {
  const out = [];
  aligned.forEach((seg, i) => {
    const speaker = (speakers && speakers[i]) || 'SPEAKER_00';
    for (const w of seg.words) out.push({ ...w, speaker });
  });
  return out;
}
function transcribe(segments, words, speakers) {
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: true, offline: true, words: diarize(align(segments, words), speakers), note: 'offline stub using caller-supplied segments' };
  return { ok: false, error: 'live ASR requires opt-in whisperX toolchain; not bundled', hint: 'use offline mode with caller-supplied segments' };
}
function tools() {
  return [
    { name: 'asr_available', description: 'Check ASR toolchain availability.', inputSchema: { type: 'object' } },
    { name: 'asr_transcribe', description: 'Align + diarize caller-supplied segments.', inputSchema: { type: 'object', properties: { segments: { type: 'array' }, words: { type: 'array' }, speakers: { type: 'array' } }, required: ['segments'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'asr_available') return available();
  if (name === 'asr_transcribe') return transcribe(args.segments, args.words, args.speakers);
  throw new Error('unknown asr_pipeline tool: ' + name);
}
module.exports = { available, align, diarize, transcribe, tools, dispatch };
