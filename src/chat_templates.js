// src/chat_templates.js
// Chat template editor with Jinja-style variables + reasoning/thinking controls.
// Clean-room llama-server-launcher idea. Zero deps, local-only.
function variables(text) {
  const out = new Set();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(String(text||'')))) out.add(m[1]);
  return Array.from(out).sort();
}

function render(template, ctx, opts) {
  opts = opts || {};
  let out = String(template||'').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = key.split('.').reduce((a,k)=> a && a[k], ctx||{});
    return v != null ? String(v) : '';
  });
  // reasoning/thinking controls: strip or wrap think blocks
  if (opts.stripThinking) out = out.replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (opts.showThinking === false) out = out.replace(/<think>[\s\S]*?<\/think>/gi, '[thinking]');
  return out;
}

const PRESETS = {
  instruct: '{% for message in messages %}{{ role }}: {{ content }}\n{% endfor %}',
  chatml: '<|im_start|>{{ role }}\n{{ content }}<|im_end|>\n',
  llama3: '<|start_header_id|>{{ role }}<|end_header_id|>\n{{ content }}<|eot_id|>',
  reasoning: '<think>{{ thinking }}</think>\n{{ content }}',
};

function validate(template) {
  const issues = [];
  const t = String(template||'');
  const opens = (t.match(/\{\{/g)||[]).length, closes = (t.match(/\}\}/g)||[]).length;
  if (opens !== closes) issues.push('unbalanced template braces');
  if (!t.trim()) issues.push('empty template');
  return { ok: issues.length===0, issues, variables: variables(t) };
}

function tools() {
  return [
    { name: 'chat_template_variables', description: 'List variables in a chat template.', inputSchema: { type: 'object', properties: { template: { type: 'string' } }, required: ['template'] } },
    { name: 'chat_template_render', description: 'Render a chat template with a context object.', inputSchema: { type: 'object', properties: { template: { type: 'string' }, context: { type: 'object' } }, required: ['template'] } },
  ];
}
function dispatch(name,args){args=args||{};if(name==='chat_template_variables')return {ok:true,variables:variables(args.template)};if(name==='chat_template_render')return {ok:true,text:render(args.template,args.context,args)};if(name==='chat_template_validate')return validate(args.template);if(name==='chat_template_presets')return {ok:true,presets:PRESETS};throw new Error('unknown chat_template tool: '+name);}
module.exports = { variables, render, PRESETS, validate, tools, dispatch };
