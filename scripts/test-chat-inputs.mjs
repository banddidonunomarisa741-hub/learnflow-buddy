import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {attachments} from '../server/attachments.mjs';
let count=0;const check=(x)=>{assert.ok(x);count++;};let payload;
const mock=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/v1/models')return res.end(JSON.stringify({data:[{id:'vision-fixture'},{id:'text-fixture'}]}));let body='';for await(const c of req)body+=c;payload=JSON.parse(body);res.end(JSON.stringify({model:payload.model,choices:[{message:{content:'verified fixture'}}],usage:{total_tokens:12}}));});
await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const spare=http.createServer();await new Promise(r=>spare.listen(0,'127.0.0.1',r));const port=spare.address().port;await new Promise(r=>spare.close(r));
const server=spawn(process.execPath,['server/server.mjs'],{windowsHide:true,stdio:['ignore','pipe','ignore'],env:{...process.env,LEARNFLOW_PORT:String(port),LEARNFLOW_PROVIDER:'openai-compatible',LEARNFLOW_API_BASE:`http://127.0.0.1:${mock.address().port}/v1`,LEARNFLOW_MODEL:'text-fixture',LEARNFLOW_API_KEY:'FIXTURE_ONLY'}});
try{
  await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});const base=`http://127.0.0.1:${port}`;
  const post=(p,b,headers={})=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});
  check((await (await fetch(base+'/api/models')).json()).models.some(m=>m.id==='vision-fixture'));
  check((await fetch(base+'/api/models',{headers:{Origin:'https://attacker.invalid'}})).status===403);
  check((await fetch(base+'/api/models',{headers:{Origin:'https://learnflow-buddy-2026.netlify.app'}})).status===403);
  check((await post('/api/probe',{})).status===400);
  const probe=await(await post('/api/probe',{consent:true,model:'vision-fixture'})).json();check(probe.verified&&probe.model==='vision-fixture');
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=';
  const message={messages:[{role:'user',content:'请解释资料'}],model:'vision-fixture',attachments:[{kind:'image',name:'test.png',mime:'image/png',data:png},{kind:'text',name:'lesson.pdf',text:'资料中的验证数字 98137'}]};
  check((await post('/api/chat',message)).status===200);
  check(payload.model==='vision-fixture');
  const parts=payload.messages.at(-1).content;check(parts.some(x=>x.type==='image_url'&&x.image_url.url.endsWith(png)));check(parts.some(x=>x.type==='text'&&x.text.includes('98137')));
  check((await post('/api/chat',{...message,attachments:[{kind:'image',name:'x.png',mime:'image/png',data:Buffer.from('not-an-image').toString('base64')}]})).status===400);
  check((await post('/api/chat',{...message,attachments:[{kind:'image',name:'x.svg',mime:'image/svg+xml',data:png}]})).status===400);
  check((await post('/api/chat',{...message,attachments:Array(5).fill(message.attachments[0])})).status===400);
  check((await post('/api/chat',{...message,model:'bad\n--flag'})).status===400);
  assert.throws(()=>attachments([{kind:'image',name:'x.png',mime:'image/png',data:'http://attacker.invalid'}]));count++;
  console.log(JSON.stringify({passed:count,fixtureOnly:true,checks:'model forwarding, image bytes, document text, explicit probe consent, denied unpaired origins, malformed attachments'}));
}finally{server.kill();mock.close();}
