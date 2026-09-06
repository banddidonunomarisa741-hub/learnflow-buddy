import {randomBytes,createHash} from 'node:crypto';
const pending=new Map(),grants=new Map();
export const trustedOrigins=new Set(['https://learnflow-buddy-2026.netlify.app','https://banddidonunomarisa741-hub.github.io']);
const hash=s=>createHash('sha256').update(s).digest('hex');
function sweep(){for(const [k,v] of pending)if(v.expires<Date.now())pending.delete(k);for(const [k,v] of grants)if(v.expires<Date.now())grants.delete(k);}
export function requestPair(origin,proof){sweep();if(!trustedOrigins.has(origin)||typeof proof!=='string'||!/^[a-f0-9]{64}$/.test(proof))throw Error('连接请求无效。');if(pending.size>=20)throw Error('待确认请求过多，请稍后再试。');const id=randomBytes(16).toString('hex');pending.set(id,{origin,proof:hash(proof),expires:Date.now()+180000});return {id};}
export function readPair(id){sweep();const p=pending.get(id);if(!p)throw Error('请求已过期，请回到原网页重新连接。');return {id,origin:p.origin};}
export function approvePair(id,consent){const p=readPair(id);const full=pending.get(id);if(consent!==true){full.denied=true;return {denied:true};}const token=randomBytes(32).toString('hex');full.token=token;grants.set(hash(token),{origin:p.origin,expires:Date.now()+8*3600000});return {approved:true};}
export function pollPair(id,origin,proof){sweep();const p=pending.get(id);if(!p||p.origin!==origin||typeof proof!=='string'||p.proof!==hash(proof))throw Error('请求已失效，请重新连接。');if(p.denied){pending.delete(id);return {denied:true};}if(p.token){pending.delete(id);return {token:p.token};}return {pending:true};}
export function validGrant(origin,token){sweep();const g=typeof token==='string'&&grants.get(hash(token));return Boolean(g&&g.origin===origin);}
export function revokeGrant(token){if(typeof token==='string')grants.delete(hash(token));}
