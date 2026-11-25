// src/conversation_export.js
// Export conversations to Markdown, JSON, and PDF (text-based).
const fs = require('fs');
const path = require('path');

function toMarkdown(messages, meta) {
  meta = meta || {};
  const lines = [];
  lines.push('# Conversation Export');
  lines.push('');
  if (meta.title) lines.push('**Title:** ' + meta.title);
  if (meta.model) lines.push('**Model:** ' + meta.model);
  if (meta.date) lines.push('**Date:** ' + meta.date);
  lines.push('');
  lines.push('---');
  lines.push('');
  for (const m of messages) {
    const role = (m.role || 'unknown').charAt(0).toUpperCase() + (m.role || 'unknown').slice(1);
    lines.push('## ' + role);
    lines.push('');
    lines.push(m.content || '');
    lines.push('');
  }
  return lines.join('\n');
}

function toJSON(messages, meta) {
  return JSON.stringify({ meta: meta || {}, messages: messages || [], exportedAt: new Date().toISOString() }, null, 2);
}

function toText(messages, meta) {
  meta = meta || {};
  const lines = [];
  if (meta.title) lines.push('Title: ' + meta.title);
  if (meta.model) lines.push('Model: ' + meta.model);
  if (meta.date) lines.push('Date: ' + meta.date);
  lines.push('');
  for (const m of messages) {
    lines.push('[' + (m.role || 'unknown').toUpperCase() + ']');
    lines.push(m.content || '');
    lines.push('');
  }
  return lines.join('\n');
}

// Real PDF via the zero-dependency writer.
function toPDF(messages, meta) {
  meta = meta || {};
  const blocks = [];
  blocks.push({ text: meta.title || 'Conversation Export', size: 20, bold: true, gap: 6 });
  if (meta.model) blocks.push({ text: 'Model: ' + meta.model, size: 9, gray: 0.45 });
  if (meta.date) blocks.push({ text: 'Date: ' + meta.date, size: 9, gray: 0.45 });
  blocks.push({ text: '', gap: 8 });
  for (const m of messages || []) {
    const role = (m.role || 'unknown').charAt(0).toUpperCase() + (m.role || 'unknown').slice(1);
    blocks.push({ text: role, size: 12, bold: true, gap: 10 });
    const body = String(m.content || '');
    for (const para of body.split(/\r?\n/)) {
      blocks.push({ text: para, size: 10.5 });
    }
    blocks.push({ text: '', gap: 4 });
  }
  return require('./pdf_writer').buildPdf(blocks, meta);
}

function exportToFile(messages, meta, format, outputPath) {
  format = (format || 'markdown').toLowerCase();
  let content, ext, encoding = 'utf8';
  if (format === 'json') { content = toJSON(messages, meta); ext = '.json'; }
  else if (format === 'text' || format === 'txt') { content = toText(messages, meta); ext = '.txt'; }
  else if (format === 'pdf') { content = toPDF(messages, meta); ext = '.pdf'; encoding = 'latin1'; }
  else { content = toMarkdown(messages, meta); ext = '.md'; }
  const filePath = outputPath || path.join(process.cwd(), 'conversation-export' + ext);
  fs.writeFileSync(filePath, content, encoding === 'latin1' ? null : 'utf8');
  const bytes = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
  return { ok: true, path: filePath, format: ext === '.pdf' ? 'pdf' : format, bytes };
}

module.exports = { toMarkdown, toJSON, toText, toPDF, exportToFile };
