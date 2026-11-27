// src/cel_policy.js
// Common Expression Language (CEL) subset for declarative governance rules.
// Clean-room hardbyte/python-common-expression-language idea. Safe,
// non-Turing-complete expressions: comparisons, booleans, membership, dot paths.
function getPath(ctx, path) { return String(path||'').split('.').reduce((a,k)=> a && a[k], ctx); }

function evaluate(expr, ctx) {
  const e = String(expr||'').trim();
  // boolean combinators
  if (e.includes(' && ')) return e.split(' && ').every(p=>evaluate(p,ctx));
  if (e.includes(' || ')) return e.split(' || ').some(p=>evaluate(p,ctx));
  if (/^!/.test(e) && !e.startsWith('!=')) return !evaluate(e.slice(1),ctx);
  // comparisons
  let m = e.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (m) {
    const l = getPath(ctx,m[1].trim()) ?? m[1].trim();
    let r = m[3].trim().replace(/^['"]|['"]$/g,'');
    if (/^-?\d+(\.\d+)?$/.test(r)) r = Number(r);
    if (r==='true') r=true; if(r==='false') r=false;
    switch(m[2]){case '==':return l===r;case '!=':return l!==r;case '>':return l>r;case '<':return l<r;case '>=':return l>=r;case '<=':return l<=r;}
  }
  // membership: x in [a,b]
  m = e.match(/^(.+?)\s+in\s+\[(.+)\]$/);
  if (m) { const v=getPath(ctx,m[1].trim()); return m[2].split(',').map(x=>x.trim().replace(/^['"]|['"]$/g,'')).includes(String(v)); }
  // plain truthiness of a path
  const v = getPath(ctx,e);
  return v != null ? Boolean(v) : e==='true';
}

function rules(ruleList, ctx) {
  return { ok:true, results:(ruleList||[]).map(r=>({name:r.name||'', expression:r.expression||'', pass:evaluate(r.expression,ctx)})), allPass:(ruleList||[]).every(r=>evaluate(r.expression,ctx)) };
}
function tools() {
  return [{ name:'cel_evaluate', description:'Evaluate a safe CEL-style expression against a context.', inputSchema:{ type:'object', properties:{ expression:{type:'string'}, context:{type:'object'} }, required:['expression'] } }];
}
function dispatch(name,args){args=args||{};if(name==='cel_evaluate')return {ok:true,result:evaluate(args.expression,args.context)};if(name==='cel_rules')return rules(args.rules,args.context);throw new Error('unknown cel_policy tool: '+name);}
module.exports = { getPath, evaluate, rules, tools, dispatch };
