// src/yaml_lite.js
// Small YAML subset parser: nested maps, block sequences, flow sequences, scalars.
// Deliberately limited — enough for config/template files, no anchors or multi-doc.
function parseScalar(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  // Strip trailing comments outside quotes.
  if (!/^["']/.test(s)) s = s.replace(/\s+#.*$/, '');
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((x) => parseScalar(x));
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    for (const part of inner.split(',')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      obj[parseScalar(part.slice(0, i))] = parseScalar(part.slice(i + 1));
    }
    return obj;
  }
  return s;
}

function parse(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const root = {};
  // stack entries: { indent, container, key } where key is the key in the parent
  const stack = [{ indent: -1, container: root, key: null }];

  const currentContainer = () => stack[stack.length - 1].container;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = raw.match(/^ */)[0].length;
    const content = raw.trim();

    // Pop to the parent level.
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    let parent = stack[stack.length - 1];

    // Block sequence item.
    if (content.startsWith('- ')) {
      const itemBody = content.slice(2).trim();
      if (!Array.isArray(parent.container)) {
        // Convert the parent's key slot to an array.
        const holder = stack[stack.length - 2];
        if (holder && parent.key != null) {
          holder.container[parent.key] = [];
          parent.container = holder.container[parent.key];
        } else {
          // Root-level sequence: not supported; skip.
          continue;
        }
      }
      const arr = parent.container;
      if (itemBody.includes(':') && !/^["']/.test(itemBody)) {
        const obj = {};
        const i = itemBody.indexOf(':');
        const k = itemBody.slice(0, i).trim();
        const v = itemBody.slice(i + 1).trim();
        obj[k] = parseScalar(v);
        arr.push(obj);
        stack.push({ indent, container: obj, key: null });
      } else {
        arr.push(parseScalar(itemBody));
      }
      continue;
    }

    const m = content.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim().replace(/^["']|["']$/g, '');
    const rest = m[2];
    const container = currentContainer();
    if (rest === '') {
      // Could be a nested map or a block sequence starting on the next line.
      let next = '';
      for (let j = idx + 1; j < lines.length; j++) { if (lines[j].trim()) { next = lines[j]; break; } }
      const nextIsSeq = /^\s*- /.test(next) && (next.match(/^ */)[0].length > indent);
      const child = nextIsSeq ? [] : {};
      container[key] = child;
      stack.push({ indent, container: child, key });
    } else {
      container[key] = parseScalar(rest);
    }
  }
  return root;
}

function load(file) { return parse(require('fs').readFileSync(file, 'utf8')); }

module.exports = { parse, load, parseScalar };
