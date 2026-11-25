// src/deck.js
// Slide-deck generator: 16:9 landscape PDF decks from a simple outline.
// Uses the zero-dependency PDF writer; no external tooling.
const path = require('path');
const { buildPdf } = require('./pdf_writer');

// 16:9 landscape at 1280x720 points ⇒ readable on projectors and in PDF viewers.
const SLIDE_W = 960;
const SLIDE_H = 540;

function makeWriter() {
  // A tiny variant of buildPdf that lays out one slide per page at 960x540.
  const pdf = require('./pdf_writer');
  // Reuse buildPdf by rendering each slide as its own short page; buildPdf uses
  // Letter portrait, so we implement a slide-specific writer here instead.
  return pdf;
}

function escape(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '');
}

function buildSlidePdf(slides, meta) {
  meta = meta || {};
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push('PLACEHOLDER');
  const pageIds = [];
  const fontIds = {};
  const fallbackFont = () => { if (!fontIds.regular) { fontIds.regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); fontIds.bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); } return fontIds; };
  for (const slide of slides) {
    fallbackFont();
    const ops = [];
    // Background
    ops.push('1 1 1 rg 0 0 ' + SLIDE_W + ' ' + SLIDE_H + ' re f');
    // Title bar
    ops.push('0.086 0.106 0.145 rg 0 ' + (SLIDE_H - 96) + ' ' + SLIDE_W + ' 96 re f');
    ops.push('BT /F2 30 Tf 1 1 1 rg 48 ' + (SLIDE_H - 62) + ' Td (' + escape(slide.title || '') + ') Tj ET');
    let y = SLIDE_H - 150;
    for (const line of slide.bullets || []) {
      ops.push('BT /F1 20 Tf 0.13 0.16 0.19 rg 64 ' + y + ' Td (' + escape('•  ' + line) + ') Tj ET');
      y -= 40;
    }
    if (slide.notes) {
      ops.push('BT /F1 12 Tf 0.45 0.48 0.5 rg 64 40 Td (' + escape(slide.notes) + ') Tj ET');
    }
    const content = ops.join('\n');
    const cId = add('<< /Length ' + Buffer.byteLength(content, 'latin1') + ' >>\nstream\n' + content + 'endstream');
    const pId = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + SLIDE_W + ' ' + SLIDE_H + '] /Resources << /Font << /F1 ' + fontIds.regular + ' 0 R /F2 ' + fontIds.bold + ' 0 R >> >> /Contents ' + cId + ' 0 R >>');
    pageIds.push(pId);
  }
  objs[1] = '<< /Type /Pages /Kids [' + pageIds.map((i) => i + ' 0 R').join(' ') + '] /Count ' + pageIds.length + ' >>';
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets[i + 1] = Buffer.byteLength(out, 'latin1');
    out += (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= objs.length; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}

// Turn an outline (markdown-ish or object list) into slides.
function fromOutline(input) {
  if (Array.isArray(input)) return input.map((s) => ({ title: s.title || '', bullets: s.bullets || [], notes: s.notes || '' }));
  const slides = [];
  let current = null;
  for (const raw of String(input || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#\s+/.test(line)) { current = { title: line.replace(/^#\s+/, ''), bullets: [], notes: '' }; slides.push(current); continue; }
    if (/^##\s+/.test(line)) { current = { title: line.replace(/^##\s+/, ''), bullets: [], notes: '' }; slides.push(current); continue; }
    if (/^[-*]\s+/.test(line)) { if (current) current.bullets.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (/^>\s+/.test(line)) { if (current) current.notes = line.replace(/^>\s+/, ''); continue; }
    if (current) current.bullets.push(line);
  }
  return slides;
}

function generate(input, outputPath, meta) {
  const slides = fromOutline(input);
  if (!slides.length) throw Object.assign(new Error('no slides in outline'), { status: 400 });
  const buf = buildSlidePdf(slides, meta);
  if (outputPath) require('fs').writeFileSync(outputPath, buf);
  return { slides: slides.length, bytes: buf.length, path: outputPath || null, buffer: outputPath ? undefined : buf };
}

module.exports = { generate, fromOutline, buildSlidePdf, SLIDE_W, SLIDE_H };
