import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const port=4191,base=`http://127.0.0.1:${port}`,origin='https://learnflow-buddy-2026.netlify.app';
const child=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,LEARNFLOW_PORT:String(port),LEARNFLOW_PROVIDER:'unconfigured'},windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.resume();child.stderr.resume();let checks=0;
async function req(path,method='GET',data,extra={}){const r=await fetch(base+path,{method,headers:{...(data!==undefined?{'Content-Type':'application/json'}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});let d;try{d=await r.json();}catch{d={};}return {status:r.status,data:d};}
const code=(r,status,error)=>{assert.equal(r.status,status);if(error)assert.equal(r.data.error,error);checks++;};
try{
  const end=Date.now()+20000;while(true){try{if((await req('/api/health')).status===200)break;}catch{}if(Date.now()>end)throw Error('isolated server did not start');await new Promise(r=>setTimeout(r,100));}
  code(await req('/api/ecosystem/qq/status'),200);
  code(await req('/api/ecosystem/qq/status','GET',undefined,{Origin:'https://untrusted.example'}),403,'ORIGIN_REJECTED');
  code(await req('/api/ecosystem/qq/status','GET',undefined,{Origin:origin}),403,'PAIR_REQUIRED');
  code(await req('/api/ecosystem/qq/connect','POST',{appId:'fixture',appSecret:'fixture'},{Origin:origin}),403,'PAIR_REQUIRED');
  const proof=randomBytes(32).toString('hex'),created=await req('/api/pair/request','POST',{proof},{Origin:origin});code(created,200);
  code(await req('/api/pair/approve','POST',{id:created.data.id,consent:true}),200);
  const polled=await req('/api/pair/poll','POST',{id:created.data.id,proof},{Origin:origin});code(polled,200);assert.ok(polled.data.token);
  const paired={Origin:origin,'X-LearnFlow-Grant':polled.data.token};
  code(await req('/api/ecosystem/qq/status','GET',undefined,paired),200);
  code(await req('/api/ecosystem/qq/inbox','GET',undefined,paired),200);
  for(const action of ['bind/start','bind/poll','connect'])code(await req('/api/ecosystem/qq/'+action,'POST',{consent:true},paired),403,'LOCAL_CONFIRMATION_REQUIRED');
  for(const action of ['send','reminders','take','disconnect'])code(await req('/api/ecosystem/qq/'+action,'POST',{},paired),400,'CONSENT_REQUIRED');
  code(await req('/api/ecosystem/qq/send','POST',{consent:true},paired),409,'QQ_NOT_CONNECTED');
  code(await req('/api/ecosystem/qq/connect','POST',{}, {Origin:base}),400,'CONSENT_REQUIRED');
  code(await req('/api/pair/revoke','POST',{},paired),200);
  code(await req('/api/ecosystem/qq/inbox','GET',undefined,paired),403,'PAIR_REQUIRED');
  console.log(`QQ HTTP: ${checks} checks passed. Isolated port ${port}; no QQ authorization or message requests made.`);
}finally{child.kill();await new Promise(r=>child.once('exit',r));}
