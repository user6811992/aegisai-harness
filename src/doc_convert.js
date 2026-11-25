// src/doc_convert.js
// Document → Markdown conversion (markitdown-style), zero dependencies.
// Supports: .txt/.md, .html/.htm, .csv, .json, .docx, .xlsx, .pptx,
// and best-effort .pdf text extraction (uncompressed / FlateDecode streams).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- minimal ZIP reader (read-only, central directory) ----
function readZip(buffer) {
  const entries = new Map();
  // Locate End Of Central Directory (EOCD) signature 0x06054b50 from the tail.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const count = buffer.readUInt16LE(eocd + 10);
  let off = buffer.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(off) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(off + 10);
    const compSize = buffer.readUInt32LE(off + 20);
    const nameLen = buffer.readUInt16LE(off + 28);
    const extraLen = buffer.readUInt16LE(off + 30);
    const commentLen = buffer.readUInt16LE(off + 32);
    const localOff = buffer.readUInt32LE(off + 42);
    const name = buffer.slice(off + 46, off + 46 + nameLen).toString('utf8');
    // Local header: skip its own name/extra lengths.
    const lNameLen = buffer.readUInt16LE(localOff + 26);
    const lExtraLen = buffer.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buffer.slice(dataStart, dataStart + compSize);
    entries.set(name, { method, raw });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: () => Array.from(entries.keys()),
    read: (name) => {
      const e = entries.get(name);
      if (!e) return null;
      if (e.method === 0) return e.raw;
      if (e.method === 8) { try { return zlib.inflateRawSync(e.raw); } catch (err) { return null; } }
      return null;
    },
  };
}

function stripXml(s) {
  return String(s || '')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function docxToMarkdown(buffer) {
  const zip = readZip(buffer);
  const doc = zip.read('word/document.xml');
  if (!doc) throw new Error('word/document.xml missing');
  const text = stripXml(doc.toString('utf8')).replace(/\n{3,}/g, '\n\n').trim();
  return '# ' + (path.basename('document')) + '\n\n' + text + '\n';
}

function xlsxToMarkdown(buffer) {
  const zip = readZip(buffer);
  const shared = zip.read('xl/sharedStrings.xml');
  const strings = [];
  if (shared) {
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(shared.toString('utf8'))) !== null) strings.push(stripXml(m[1]));
  }
  const sheets = zip.names().filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  const out = [];
  for (const s of sheets) {
    const xml = (zip.read(s) || Buffer.from('')).toString('utf8');
    const rows = [];
    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      const cells = [];
      const cellRe = /<c[^>]*?(?:t="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g;
      let cm;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        const type = cm[1];
        const v = (cm[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
        cells.push(type === 's' ? (strings[parseInt(v, 10)] || '') : v);
      }
      if (cells.length) rows.push(cells);
    }
    out.push('## ' + path.basename(s, '.xml'));
    if (rows.length) {
      out.push('| ' + rows[0].join(' | ') + ' |');
      out.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
      for (const r of rows.slice(1)) out.push('| ' + r.join(' | ') + ' |');
    }
    out.push('');
  }
  return out.join('\n');
}

function pptxToMarkdown(buffer) {
  const zip = readZip(buffer);
  const slides = zip.names().filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/(\d+)/)[1], 10) - parseInt(b.match(/(\d+)/)[1], 10));
  const out = [];
  slides.forEach((s, i) => {
    const xml = (zip.read(s) || Buffer.from('')).toString('utf8');
    const texts = [];
    const re = /<a:t>([\s\S]*?)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) texts.push(stripXml(m[1]));
    out.push('## Slide ' + (i + 1));
    out.push(texts.join('\n'));
    out.push('');
  });
  return out.join('\n');
}

// Best-effort PDF text: pull text from uncompressed or FlateDecode content streams.
function pdfToText(buffer) {
  const chunks = [];
  const s = buffer.toString('latin1');
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = streamRe.exec(s)) !== null) {
    const raw = Buffer.from(m[1], 'latin1');
    let text = '';
    try { text = zlib.inflateSync(raw).toString('latin1'); } catch (e) {
      try { text = zlib.inflateRawSync(raw).toString('latin1'); } catch (e2) { text = raw.toString('latin1'); }
    }
    // Extract literal strings from Tj / TJ operators.
    const litRe = /\((?:\\.|[^\\)])*\)/g;
    let lm;
    while ((lm = litRe.exec(text)) !== null) {
      const lit = lm[0].slice(1, -1).replace(/\\([nrtbf()\\])/g, (x, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[c] || c));
      chunks.push(lit);
    }
    chunks.push('\n');
  }
  return chunks.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToMarkdown(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<(br|p|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function csvToMarkdown(csv) {
  const rows = String(csv || '').split(/\r?\n/).filter((r) => r.trim());
  if (!rows.length) return '';
  const cells = (r) => r.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
  const head = cells(rows[0]);
  const out = ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |'];
  for (const r of rows.slice(1)) out.push('| ' + cells(r).join(' | ') + ' |');
  return out.join('\n');
}

function toMarkdown(filePath, opts) {
  opts = opts || {};
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const text = () => buf.toString('utf8');
  if (ext === '.docx') return { markdown: docxToMarkdown(buf), format: 'docx' };
  if (ext === '.xlsx') return { markdown: xlsxToMarkdown(buf), format: 'xlsx' };
  if (ext === '.pptx') return { markdown: pptxToMarkdown(buf), format: 'pptx' };
  if (ext === '.pdf') return { markdown: pdfToText(buf), format: 'pdf' };
  if (ext === '.html' || ext === '.htm') return { markdown: htmlToMarkdown(text()), format: 'html' };
  if (ext === '.csv') return { markdown: csvToMarkdown(text()), format: 'csv' };
  if (ext === '.json') { try { return { markdown: '```json\n' + JSON.stringify(JSON.parse(text()), null, 2) + '\n```', format: 'json' }; } catch (e) { return { markdown: '```\n' + text() + '\n```', format: 'json' }; } }
  if (ext === '.md' || ext === '.markdown') return { markdown: text(), format: 'markdown' };
  return { markdown: text(), format: 'text' };
}

module.exports = { toMarkdown, docxToMarkdown, xlsxToMarkdown, pptxToMarkdown, pdfToText, htmlToMarkdown, csvToMarkdown, readZip };
