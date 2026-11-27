const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const p2p = require('../src/p2p_messaging');
const diag = require('../src/diagram_gen');
const hp = require('../src/harness_protocol');
const er = require('../src/embedding_registry');
const bv = require('../src/backend_variants');
const ci = require('../src/compact_index');
const vr = require('../src/visual_retrieval');
const pg = require('../src/proxy_guardrails');
const kv = require('../src/kv_transfer');

function tmp(n){const p=path.join(os.tmpdir(),'aegisai-p2c-'+n+'-'+Date.now());fs.mkdirSync(p,{recursive:true});return p;}

test('p2p: keypair encrypt decrypt roundtrip', () => {
  const a = p2p.keypair(); const b = p2p.keypair();
  assert.ok(a.fingerprint && b.fingerprint);
  const msg = p2p.encrypt('secret message', b.publicKey);
  assert.ok(msg.ciphertext && msg.key);
  assert.equal(p2p.decrypt(msg, b.privateKey), 'secret message');
});
test('p2p: conflict warning', () => {
  const r = p2p.conflictWarning('src/auth.js', ['a','b']);
  assert.equal(r.ok, true);
  assert.ok(r.warning.includes('multiple'));
});

test('diagram: renders interactive HTML with nodes', () => {
  const r = diag.dispatch('diagram_render', { type:'flow', title:'My Diagram', nodes:[{id:'1',label:'Start'}], edges:[{from:'1',to:'2'}] });
  assert.equal(r.ok, true);
  assert.ok(r.html.includes('<!DOCTYPE html>'));
  assert.ok(r.html.includes('Start'));
  assert.ok(diag.TYPES.length === 10);
});

test('harness_protocol: resolve and envelope', () => {
  assert.equal(hp.resolve('codex').cli, 'codex');
  assert.equal(hp.resolve('nope').ok, false);
  const e = hp.envelope('fix bug', { harness:'claude' });
  assert.equal(e.object, 'harness.task');
  assert.equal(e.harness, 'claude');
});

test('embedding_registry: local vector and registration', () => {
  assert.equal(er.list().some(c=>c.name==='local'), true);
  assert.equal(er.vector('hello world','local').vector.length, 64);
  assert.equal(er.register('custom',{provider:'test'}).ok, true);
  assert.equal(er.vector('x','llamafile').ok, false);
});

test('backend_variants: ik and llama incompatible ABI', () => {
  assert.equal(bv.resolve('ik_llama').moe, true);
  assert.equal(bv.compatible('ik_llama','llama_cpp').ok, false);
  assert.equal(bv.compatible('llama_cpp','llamafile').ok, true);
});

test('compact_index: stores metadata not full embedding', () => {
  const prev=process.env.AEGISAI_DATA_DIR; const root=tmp('compact'); process.env.AEGISAI_DATA_DIR=root;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh=require('../src/compact_index');
    const r=fresh.index('doc1','the quick brown fox jumps over the lazy dog');
    assert.equal(r.ok,true); assert.ok(r.savingPct>0);
    const s=fresh.search('brown fox',{}); assert.ok(s.results.some(x=>x.id==='doc1'));
  } finally { if(prev==null)delete process.env.AEGISAI_DATA_DIR;else process.env.AEGISAI_DATA_DIR=prev; delete require.cache[require.resolve('../src/core/config')]; }
});

test('visual_retrieval: describe PNG and index/search', () => {
  const prev=process.env.AEGISAI_DATA_DIR; const root=tmp('visual'); process.env.AEGISAI_DATA_DIR=root;
  const png=Buffer.alloc(64); png.write('PNG',1,'ascii'); png.writeUInt32BE(800,16); png.writeUInt32BE(600,20);
  const p=path.join(root,'tile.png'); fs.writeFileSync(p,png);
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh=require('../src/visual_retrieval');
    const d=fresh.describe(p); assert.equal(d.ok,true); assert.equal(d.width,800);
    const r=fresh.index(p,{labels:['dashboard','chart']}); assert.equal(r.ok,true);
    const s=fresh.search('dashboard',{}); assert.ok(s.results.length>0);
  } finally { if(prev==null)delete process.env.AEGISAI_DATA_DIR;else process.env.AEGISAI_DATA_DIR=prev; delete require.cache[require.resolve('../src/core/config')]; }
});

test('proxy_guardrails: rescue malformed tool call', () => {
  const req={ tool_calls:[{ id:'1', function:{ name:'read_file', arguments:'{"path": "a.txt"' }}] };
  const r=pg.processRequest(req,{});
  assert.equal(r.ok,true);
  const args=JSON.parse(r.request.tool_calls[0].function.arguments);
  assert.equal(args.path,'a.txt');
});

test('kv_transfer: fails closed without mapping', () => {
  assert.equal(kv.transfer(['a'],null).ok,false);
  const m=kv.fitMapping('small','big',{});
  assert.equal(m.ok,true);
  assert.equal(kv.transfer(['a'],m).ok,true);
});

test('phase2c: tools registered in server', () => {
  const mcp=fs.readFileSync(path.join(__dirname,'..','src','mcp_server.js'),'utf8');
  for(const t of ['p2p_messaging','diagram_gen','harness_protocol','embedding_registry','backend_variants','compact_index','visual_retrieval','proxy_guardrails','kv_transfer']) assert.ok(mcp.includes(`./${t}`));
});
