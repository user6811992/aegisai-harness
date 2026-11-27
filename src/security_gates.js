// src/security_gates.js
// Deterministic agent-security gates — clean-room 0xNyk/agent-security (MIT)
// idea. Scans repos/content/URLs for known risky patterns; CLEAN means no known
// pattern matched, not "safe". Local-only, no network.
const URL_PATTERNS = [
  { id:'private-host', re:/(^|\/\/)(127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)/i, decision:2 },
  { id:'credential-url', re:/(https?:\/\/)[^@\s]+:[^@\s]+@/i, decision:2 },
  { id:'pastebin', re:/https?:\/\/(pastebin|rentry|gist\.github)/i, decision:1 },
];
const CONTENT_PATTERNS = [
  { id:'prompt-injection-ignore', re:/ignore (all )?(previous|prior|above) instructions/i, severity:'high' },
  { id:'prompt-injection-role', re:/you are now (a )?(different|new|unrestricted)/i, severity:'high' },
  { id:'hidden-unicode', re:/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/, severity:'medium' },
  { id:'exfil-endpoint', re:/curl\s+[^|]*https?:\/\/[^\s]+/i, severity:'medium' },
];
function checkUrl(url) {
  for (const p of URL_PATTERNS) if (p.re.test(String(url||''))) return { ok:true, decision:p.decision, rule:p.id, note:'0=ALLOW, 1=REVIEW, 2=BLOCK' };
  return { ok:true, decision:0, rule:'none', note:'no known pattern matched' };
}
function scanContent(text) {
  const findings=[];
  for (const p of CONTENT_PATTERNS) { const m=String(text||'').match(new RegExp(p.re.source,p.re.flags.includes('g')?p.re.flags:p.re.flags+'g')); if(m) findings.push({rule:p.id,severity:p.severity,count:m.length}); }
  return { ok:true, clean:findings.length===0, findings, note:'CLEAN means no known pattern matched, not safe' };
}
function scanRepo(dir, fs, path) {
  const out=[];
  function walk(d,depth){if(depth>6)return;let es=[];try{es=fs.readdirSync(d,{withFileTypes:true});}catch(e){return;}
    for(const e of es){if(e.name==='.git'||e.name==='node_modules')continue;const p=path.join(d,e.name);
      if(e.isDirectory())walk(p,depth+1);else if(/\.(md|js|ts|txt|json|yml|yaml)$/i.test(e.name)){try{const r=scanContent(fs.readFileSync(p,'utf8'));if(!r.clean)out.push({file:p,findings:r.findings});}catch(err){}}
    }}
  walk(dir,0);
  return { ok:true, clean:out.length===0, files:out, note:'deterministic pattern scan only' };
}
function tools() {
  return [
    { name:'security_check_url', description:'Classify a URL as allow/review/block.', inputSchema:{type:'object',properties:{url:{type:'string'}},required:['url']} },
    { name:'security_scan_content', description:'Scan text for prompt-injection and risky patterns.', inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text']} },
  ];
}
function dispatch(name,args){args=args||{};if(name==='security_check_url')return checkUrl(args.url);if(name==='security_scan_content')return scanContent(args.text);if(name==='security_scan_repo')return scanRepo(args.dir,require('fs'),require('path'));throw new Error('unknown security_gates tool: '+name);}
module.exports = { URL_PATTERNS, CONTENT_PATTERNS, checkUrl, scanContent, scanRepo, tools, dispatch };
