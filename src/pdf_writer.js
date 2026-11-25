// src/pdf_writer.js
// Minimal, zero-dependency PDF 1.4 writer (Helvetica text only).
// Good enough for conversation exports: headings, body text, code blocks, page breaks.
const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 56;

// Approximate Helvetica advance widths (fraction of font size).
function charWidth(ch) {
  if (ch === ' ') return 0.278;
  if ('iljI.,:;\'`|!'.includes(ch)) return 0.222;
  if ('ft()[]{}'.includes(ch)) return 0.333;
  if ('mwMW'.includes(ch)) return 0.833;
  if (ch >= 'A' && ch <= 'Z') return 0.667;
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch === '-') return 0.333;
  return 0.5;
}
function textWidth(s, size) {
  let w = 0;
  for (const ch of s) w += charWidth(ch);
  return w * size;
}
function escapePdf(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Drop characters Helvetica/WinAnsi can't represent predictably.
    .replace(/[^\x20-\x7e]/g, (c) => (c === '\t' ? '    ' : ''));
}
function wrap(text, size, maxWidth) {
  const words = String(text == null ? '' : text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (textWidth(next, size) <= maxWidth || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/**
 * blocks: [{ text, size?, bold?, gap?, code? }]
 * Returns a Buffer containing a valid PDF.
 */
function buildPdf(blocks, meta) {
  meta = meta || {};
  const size = 11;
  const lineH = (s) => Math.round(s * 1.42);
  const maxW = PAGE_W - MARGIN * 2;

  // Layout into pages of positioned runs.
  const pages = [];
  let runs = [];
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    // header/footer on each page
    if (runs.length) pages.push(runs);
    runs = [];
    y = PAGE_H - MARGIN;
    runs.push({ text: meta.title || 'Conversation Export', size: 9, bold: false, x: MARGIN, y: PAGE_H - 30, gray: 0.45 });
    runs.push({ text: 'Page ' + (pages.length + 1), size: 9, bold: false, x: PAGE_W - MARGIN - 45, y: 30, gray: 0.45 });
  };
  newPage();

  for (const b of blocks || []) {
    const s = b.size || size;
    const bold = Boolean(b.bold);
    const lh = lineH(s);
    const gapBefore = b.gap ? Math.round(b.gap) : 0;
    y -= gapBefore;
    const lines = b.noWrap ? [String(b.text || '')] : wrap(b.text, s, maxW - (b.indent || 0));
    for (const line of lines) {
      if (y - lh < MARGIN) newPage();
      y -= lh;
      runs.push({ text: line, size: s, bold, x: MARGIN + (b.indent || 0), y, gray: b.gray });
    }
  }
  if (runs.length) pages.push(runs);

  // Build content streams.
  const contentOf = (pageRuns) => {
    let out = '';
    for (const r of pageRuns) {
      const font = r.bold ? '/F2' : '/F1';
      const gray = typeof r.gray === 'number' ? r.gray : 0;
      out += 'BT ' + font + ' ' + r.size + ' Tf ' + gray + ' g ' + r.x + ' ' + r.y + ' Td (' + escapePdf(r.text) + ') Tj ET\n';
    }
    return out;
  };

  // Objects: 1 catalog, 2 pages, then per page (page + content), then fonts.
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalogId = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = 2; // reserved below
  objs.push('PLACEHOLDER_PAGES'); // index 1 → id 2
  const pageIds = [];
  const contentIds = [];
  for (let i = 0; i < pages.length; i++) {
    const content = contentOf(pages[i]);
    const cId = add('<< /Length ' + Buffer.byteLength(content, 'latin1') + ' >>\nstream\n' + content + 'endstream');
    contentIds.push(cId);
    const pId = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] /Resources << /Font << /F1 100 0 R /F2 101 0 R >> >> /Contents ' + cId + ' 0 R >>');
    pageIds.push(pId);
  }
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  objs[pagesId - 1] = '<< /Type /Pages /Kids [' + pageIds.map((i) => i + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>';

  // Assemble with cross-reference table.
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets[i + 1] = Buffer.byteLength(pdf, 'latin1');
    pdf += (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objs.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n';
  return Buffer.from(pdf, 'latin1');
}

module.exports = { buildPdf, escapePdf, wrap, PAGE_W, PAGE_H };
