const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const es = require('../src/ed25519_signing');
const ow = require('../src/offline_webui');
const cc = require('../src/character_cards');
const hp = require('../src/horde_provider');
const ms = require('../src/model_store');
const kp = require('../src/knowledge_pack');
const st = require('../src/agent_storage');
const ont = require('../src/ontology_context');

function tmp(n){const p=path.join(os.tmpdir(),'aegisai-p3b-'+n+'-'+Date.now());fs.mkdirSync(p,{recursive:true});return p;}
function withData(fn){const prev=process.env.AEGISAI_DATA_DIR;const root=tmp('data');process.env.AEGISAI_DATA_DIR=root;delete require.cache[require.resolve('../src/core/config')];try{return fn();}finally{if(prev==null)delete process.env.AEGISAI_DATA_DIR;else process.env.AEGISAI_DATA_DIR=prev;delete require.cache[require.resolve('../src/core/config')];}}

// ed25519
test('ed25519: keypair + sign/verify roundtrip', () => {
  const k = es.keypair();
  const obj = { id:'cert_1', type:'aegisai-verification-certificate', claims:['done'] };
  const sig = es.signObject(obj, k.privateKey);
  const v = es.verifySignature({ ...obj, signature: sig }, k.publicKey);
  assert.equal(v.ok, true);
  assert.equal(v.signatureValid, true);
  const bad = es.verifySignature({ ...obj, signature: sig, claims:['tampered'] }, k.publicKey);
  assert.equal(bad.ok, false);
});
test('ed25519: rejects missing signature', () => {
  assert.equal(es.verifySignature({}, 'x').ok, false);
});

// offline webui
test('offline_webui: emits single self-contained HTML file', () => {
  const r = ow.dispatch('offline_webui_render', { title:'Local Chat' });
  assert.equal(r.ok, true);
  assert.ok(r.html.includes('<!DOCTYPE html>'));
  assert.ok(r.html.includes('<style>'));
  assert.ok(r.html.includes('<script>'));
  assert.ok(r.html.includes('Local Chat'));
  assert.ok(!r.html.includes('cdn'));
});

// character cards
test('character_cards: parse + assemble roleplay prompt', () => {
  const card = { name:'Aria', description:'A careful engineer', personality:'precise', scenario:'in a lab',
    first_mes:'Hello', example_dialogue:'User: hi\nAria: hello',
    character_book:{ entries:[{ keys:['lab'], content:'The lab has strict rules' }] } };
  const p = cc.prompt(card, { authorsNote:'keep it short' });
  assert.equal(p.name, 'Aria');
  assert.ok(p.prompt.includes('A careful engineer'));
  assert.ok(p.prompt.includes('The lab has strict rules'));
  assert.ok(p.prompt.includes('keep it short'));
  assert.equal(cc.fromJSON('{bad').ok, false);
});

// horde
test('horde: disabled offline and opt-in by default', () => {
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  assert.equal(hp.plan('model').ok, false);
  process.env.AEGISAI_OFFLINE = 'false';
  assert.equal(hp.status().enabled, false);
  assert.equal(hp.plan('model').provider, 'ai-horde');
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

// model store
test('model_store: backends + opt-in pull plan', () => {
  assert.ok(ms.list().some(b => b.name === 'ollama'));
  assert.equal(ms.resolve('nope').ok, false);
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  assert.equal(ms.planPull('ollama', 'qwen3').ok, false);
  process.env.AEGISAI_OFFLINE = 'false';
  assert.equal(ms.planPull('ollama', 'qwen3').command[0], 'ollama');
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

// knowledge pack
test('knowledge_pack: build + verify offline bundle', () => withData(() => {
  const fresh = require('../src/knowledge_pack');
  const r = fresh.build('red-alert', [{ id:'a', title:'Intro', text:'offline knowledge content' }]);
  assert.equal(r.ok, true);
  assert.equal(r.offline, true);
  assert.equal(fresh.verify(r).hashValid, true);
  assert.ok(fresh.list().some(p => p.name === 'red-alert'));
  const tampered = { ...r, files: [{ id:'a', text:'changed', words:1 }] };
  assert.equal(fresh.verify(tampered).ok, false);
}));

// agent storage
test('agent_storage: session/trace/memory contract', () => withData(() => {
  const fresh = require('../src/agent_storage');
  assert.equal(fresh.put('default','session',{id:'s1'}).ok, true);
  assert.equal(fresh.put('default','trace',{id:'t1',ok:true}).ok, true);
  assert.equal(fresh.put('default','memory',{id:'m1',text:'remember'}).ok, true);
  assert.ok(fresh.get('default','session','s1').item);
  assert.equal(fresh.get('default','trace').items.length, 1);
  assert.ok(fresh.namespaces().includes('default'));
}));

// ontology
test('ontology_context: entities, relations, graph traversal', () => withData(() => {
  const fresh = require('../src/ontology_context');
  fresh.addEntity('alice','person',{role:'engineer'});
  fresh.addEntity('bob','person',{role:'reviewer'});
  fresh.addEntity('proj','project',{name:'aegis'});
  fresh.relate('alice','works_on','proj');
  fresh.relate('bob','reviews','proj');
  const c = fresh.context('alice', 2);
  assert.equal(c.root.type, 'person');
  assert.ok(c.related.some(r => r.to === 'proj'));
}));

// MCP
test('phase3b2: tools registered', () => {
  const mcp = fs.readFileSync(path.join(__dirname,'..','src','mcp_server.js'),'utf8');
  for (const t of ['ed25519_signing','offline_webui','character_cards','horde_provider','model_store','knowledge_pack','agent_storage','ontology_context']) assert.ok(mcp.includes(`./${t}`));
});
