import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173',origin='https://learnflow-buddy-2026.netlify.app',proof='a'.repeat(64);let checks=0;
async function post(route,data,headers={}){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
function check(v){assert.ok(v);checks++;}
let r=await post('/api/pair/request',{proof},{Origin:origin});check(r.status===200);const id=r.data.id;
r=await post('/api/pair/approve',{id,consent:true},{Origin:origin});check(r.status===403);
r=await post('/api/pair/poll',{id,proof:'b'.repeat(64)},{Origin:origin});check(r.status===400);
r=await post('/api/pair/poll',{id,proof},{Origin:origin});check(r.data.pending===true);
r=await post('/api/pair/approve',{id,consent:true});check(r.data.approved===true);
r=await post('/api/pair/poll',{id,proof},{Origin:origin});check(typeof r.data.token==='string');const token=r.data.token;
let res=await fetch(base+'/api/assets',{headers:{Origin:origin,'X-LearnFlow-Grant':token}});check(res.status===200&&res.headers.get('access-control-allow-origin')===origin);
res=await fetch(base+'/api/assets',{headers:{Origin:'https://evil.example','X-LearnFlow-Grant':token}});check(res.status===403);
r=await post('/api/connection',{disconnect:true},{Origin:origin,'X-LearnFlow-Grant':token});check(r.status===403);
r=await post('/api/pair/revoke',{}, {Origin:origin,'X-LearnFlow-Grant':token});check(r.status===200);
res=await fetch(base+'/api/assets',{headers:{Origin:origin,'X-LearnFlow-Grant':token}});check(res.status===403);
r=await post('/api/pair/poll',{id,proof},{Origin:origin});check(r.status===400);
console.log(JSON.stringify({passed:checks,tokenNotLogged:true}));
