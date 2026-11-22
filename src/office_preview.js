// src/office_preview.js
// Basic Office document preview: extract text from docx/xlsx/pptx (zip + xml).
const fs = require('fs');
const zlib = require('zlib');

function unzipEntry(buf, name) {
  // minimal: find local file header for name, inflate
  const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let pos = 0;
  while (true) {
    const i = buf.indexOf(sig, pos);
    if (i < 0) return null;
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const compSize = buf.readUInt32LE(i + 18);
    const method = buf.readUInt16LE(i + 8);
    const fileName = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
    const dataStart = i + 30 + nameLen + extraLen;
    if (fileName === name) {
      const comp = buf.slice(dataStart, dataStart + compSize);
      try { return method === 0 ? comp : zlib.inflateRawSync(comp); } catch (e) { return null; }
    }
    pos = dataStart + compSize;
  }
}
function preview(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = filePath.toLowerCase().split('.').pop();
  if (ext === 'docx') {
    const xml = unzipEntry(buf, 'word/document.xml');
    if (!xml) return { ok: false, error: 'no document.xml' };
    const text = xml.toString('utf8').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return { ok: true, type: 'docx', text: text.slice(0, 8000) };
  }
  if (ext === 'xlsx') {
    const xml = unzipEntry(buf, 'xl/sharedStrings.xml');
    const text = xml ? xml.toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    return { ok: true, type: 'xlsx', text: text.slice(0, 8000) };
  }
  if (ext === 'pptx') {
    const xml = unzipEntry(buf, 'ppt/slides/slide1.xml');
    const text = xml ? xml.toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    return { ok: true, type: 'pptx', text: text.slice(0, 8000) };
  }
  return { ok: false, error: 'unsupported: ' + ext };
}

module.exports = { unzipEntry, preview };
