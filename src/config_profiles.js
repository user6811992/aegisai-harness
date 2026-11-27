// src/config_profiles.js
// Config import/export profiles — clean-room llama-server-launcher idea.
// Per-backend launch profiles with safe import/export (fields whitelisted).
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const { DATA_DIR } = require('./core/config');
const DIR=()=>path.join(DATA_DIR,'config-profiles');
const FIELDS=['backend','model','context','threads','gpuLayers','quant','host','port','args'];
function sanitize(p){const out={};for(const f of FIELDS)if(p&&p[f]!==undefined)out[f]=p[f];return out;}
function save(name,profile){fs.mkdirSync(DIR(),{recursive:true});const safe=String(name||'default').replace(/[^a-zA-Z0-9._-]/g,'_');const doc={name:safe,...sanitize(profile),id:'prof_'+crypto.randomBytes(3).toString('hex'),saved:new Date().toISOString()};fs.writeFileSync(path.join(DIR(),safe+'.json'),JSON.stringify(doc,null,2));return {ok:true,profile:doc};}
function list(){if(!fs.existsSync(DIR()))return[];return fs.readdirSync(DIR()).filter(f=>f.endsWith('.json')).map(f=>{try{const p=JSON.parse(fs.readFileSync(path.join(DIR(),f),'utf8'));return {name:p.name,backend:p.backend,model:p.model};}catch(e){return null;}}).filter(Boolean);}
function get(name){try{return JSON.parse(fs.readFileSync(path.join(DIR(),String(name||'').replace(/[^a-zA-Z0-9._-]/g,'_')+'.json'),'utf8'));}catch(e){return null;}}
function exportProfile(name){const p=get(name);return p?{ok:true,json:JSON.stringify(sanitize(p),null,2)}:{ok:false,error:'profile not found'};}
function importProfile(name,json){try{return save(name,JSON.parse(json));}catch(e){return {ok:false,error:'invalid JSON'};}}
function tools(){return[{name:'config_profile_save',description:'Save a per-backend launch profile.',inputSchema:{type:'object',properties:{name:{type:'string'},profile:{type:'object'}},required:['name']}},{name:'config_profile_list',description:'List saved profiles.',inputSchema:{type:'object'}}];}
function dispatch(name,args){args=args||{};if(name==='config_profile_save')return save(args.name,args.profile);if(name==='config_profile_list')return {ok:true,profiles:list()};if(name==='config_profile_get'){const p=get(args.name);return p?{ok:true,profile:p}:{ok:false,error:'not found'};}if(name==='config_profile_export')return exportProfile(args.name);if(name==='config_profile_import')return importProfile(args.name,args.json);throw new Error('unknown config_profile tool: '+name);}
module.exports = { FIELDS, sanitize, save, list, get, exportProfile, importProfile, tools, dispatch };
