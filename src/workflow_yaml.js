// src/workflow_yaml.js
// Workflow-as-YAML with event listeners — clean-room kdeps/kdeps idea. A YAML
// pipeline: each event (API call, chat, webhook, file) starts one run; agents
// are chat steps with loop, connectors send answers. Minimal YAML subset parser.
function parse(text) {
  const out = { name:'', on:[], steps:[] };
  let section = '';
  let current = null;
  for (const raw of String(text||'').split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/,'').trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const ind = line.length - line.trimStart().length;
    const t = line.trim();
    if (ind===0 && t.startsWith('name:')) { out.name=t.slice(5).trim().replace(/^['"]|['"]$/g,''); section=''; current=null; continue; }
    if (ind===0 && t==='on:') { section='on'; current=null; continue; }
    if (ind===0 && t==='steps:') { section='steps'; current=null; continue; }
    // A new list item always starts a fresh step/event, even if the previous
    // item already populated `current` with key/value fields.
    if (t.startsWith('- ')) {
      if (section==='on') out.on.push(t.slice(2).trim());
      else if (section==='steps') { current={ id:out.steps.length, type:t.slice(2).trim() }; out.steps.push(current); }
      continue;
    }
    if (section==='steps' && current) {
      const kv=t.match(/^([\w]+):\s*(.*)$/);
      if (kv) current[kv[1]]=kv[2].trim().replace(/^['"]|['"]$/g,'');
    }
  }
  return out;
}
function run(workflow, event) {
  const wf = typeof workflow==='string' ? parse(workflow) : workflow;
  if (!wf || !wf.steps || !wf.steps.length) return { ok:false, error:'no steps' };
  if (wf.on && wf.on.length && event && !wf.on.includes(event)) return { ok:false, error:'event not in workflow trigger list', event };
  return { ok:true, workflow:wf.name, event, steps:wf.steps.map(s=>({ id:s.id, type:s.type, status:'planned' })), note:'deterministic plan; execute steps via harness tools' };
}
function tools() {
  return [
    { name:'workflow_parse', description:'Parse a minimal workflow YAML into steps and event triggers.', inputSchema:{type:'object',properties:{yaml:{type:'string'}},required:['yaml']} },
    { name:'workflow_plan', description:'Plan a workflow run for an event.', inputSchema:{type:'object',properties:{yaml:{type:'string'},event:{type:'string'}},required:['yaml']} },
  ];
}
function dispatch(name,args){args=args||{};if(name==='workflow_parse')return {ok:true,...parse(args.yaml)};if(name==='workflow_plan')return run(args.yaml||args.workflow,args.event);throw new Error('unknown workflow tool: '+name);}
module.exports = { parse, run, tools, dispatch };
