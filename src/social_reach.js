// src/social_reach.js
// Social/web reach adapter — clean-room Panniantong/Agent-Reach (MIT) idea.
// Give the agent tools to read/search social platforms via a single interface.
// Network-dependent and opt-in; disabled in offline mode. No credentials stored.
const PLATFORMS=['twitter','reddit','youtube','github','bilibili','xiaohongshu','weibo'];
function classify(url){
  const u=String(url||'').toLowerCase();
  for(const p of PLATFORMS){if(u.includes(p)||u.includes(p.replace('twitter','x.com').replace('xiaohongshu','xhslink')))return {ok:true,platform:p,url};}
  return {ok:false,error:'unsupported platform',url};
}
function plan(target,opts){
  if(process.env.AEGISAI_OFFLINE==='true')return {ok:false,error:'social reach disabled in offline mode'};
  const c=classify(target);
  if(!c.ok)return c;
  return {ok:true,...c,action:(opts&&opts.action)||'read',note:'adapter contract; caller supplies fetch/credential handling. Respect platform ToS.'};
}
function tools(){return[{name:'social_reach_plan',description:'Classify a social URL and plan a read/search action.',inputSchema:{type:'object',properties:{url:{type:'string'},action:{type:'string'}},required:['url']}}];}
function dispatch(name,args){args=args||{};if(name==='social_reach_plan'||name==='social_classify')return plan(args.url,args);if(name==='social_platforms')return {ok:true,platforms:PLATFORMS};throw new Error('unknown social_reach tool: '+name);}
module.exports = { PLATFORMS, classify, plan, tools, dispatch };
