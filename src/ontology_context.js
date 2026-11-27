// src/ontology_context.js
// Ontology-backed semantic context — clean-room aws/context-ontology-accelerator
// (1,326⭐) idea. Persist typed entities/relations and derive context by graph
// traversal, so the agent gets explicit semantic relationships, not just text.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const DB = () => path.join(DATA_DIR, 'ontology.json');
function load() { try { return JSON.parse(fs.readFileSync(DB(), 'utf8')); } catch (e) { return { entities: {}, relations: [] }; } }
function save(d) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB(), JSON.stringify(d)); }

function addEntity(id, type, props) {
  const d = load();
  d.entities[id] = { id, type, ...(props || {}) };
  save(d);
  return { ok: true, id, type };
}
function relate(from, rel, to) {
  const d = load();
  d.relations.push({ from, rel, to });
  save(d);
  return { ok: true, from, rel, to };
}
function context(entityId, hops) {
  const d = load();
  hops = hops == null ? 2 : hops;
  const seen = new Set([entityId]);
  const out = [];
  let frontier = [entityId];
  for (let i = 0; i < hops; i += 1) {
    const next = [];
    for (const r of d.relations) {
      if (frontier.includes(r.from) && !seen.has(r.to)) { seen.add(r.to); next.push(r.to); out.push({ from: r.from, rel: r.rel, to: r.to, entity: d.entities[r.to] || null, hop: i + 1 }); }
      else if (frontier.includes(r.to) && !seen.has(r.from)) { seen.add(r.from); next.push(r.from); out.push({ from: r.to, rel: r.rel, to: r.from, entity: d.entities[r.from] || null, hop: i + 1 }); }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { ok: true, root: d.entities[entityId] || null, related: out };
}
function tools() {
  return [
    { name: 'ontology_entity', description: 'Add a typed entity to the ontology.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' } }, required: ['id','type'] } },
    { name: 'ontology_relate', description: 'Relate two ontology entities.', inputSchema: { type: 'object', properties: { from: { type: 'string' }, rel: { type: 'string' }, to: { type: 'string' } }, required: ['from','rel','to'] } },
    { name: 'ontology_context', description: 'Derive semantic context by graph traversal.', inputSchema: { type: 'object', properties: { entityId: { type: 'string' }, hops: { type: 'number' } }, required: ['entityId'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'ontology_entity') return addEntity(args.id, args.type, args.props);
  if (name === 'ontology_relate') return relate(args.from, args.rel, args.to);
  if (name === 'ontology_context') return context(args.entityId, args.hops);
  throw new Error('unknown ontology_context tool: ' + name);
}
module.exports = { DB, load, save, addEntity, relate, context, tools, dispatch };
