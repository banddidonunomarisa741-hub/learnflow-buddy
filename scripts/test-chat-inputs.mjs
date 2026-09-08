import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {attachments} from '../server/attachments.mjs';
let count=0;const check=(x,message)=>{assert.ok(x,message);count++;};let payload,probeMode='correct',lastNonce='',upstreamCalls=0;
const mock=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/v1/models')return res.end(JSON.stringify({data:[{id:'vision-fixture'},{id:'text-fixture'}]}));
  let body='';for await(const c of req)body+=c;payload=JSON.parse(body);upstreamCalls++;
  const last=payload.messages.at(-1).content;
  const text=typeof last==='string'?last:'';
  const nonce=text.match(/LF-[a-f0-9]{8}\b/)?.[0];
  let content='verified fixture';
  if(nonce){
    lastNonce=nonce;
    if(probeMode==='upstream-error'){res.statusCode=503;return res.end(JSON.stringify({error:'SYNTHETIC_UPSTREAM_FAILURE'}));}
    content=probeMode==='empty'?'':probeMode==='wrong-math'?`132 ${nonce}`:probeMode==='wrong-nonce'?`133 WRONG-${nonce.slice(3)}`:`133 ${nonce}`;
  }
  res.end(JSON.stringify({model:payload.model,choices:[{message:{content}}],usage:{total_tokens:12}}));
});
await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const spare=http.createServer();await new Promise(r=>spare.listen(0,'127.0.0.1',r));const port=spare.address().port;await new Promise(r=>spare.close(r));
const server=spawn(process.execPath,['server/server.mjs'],{windowsHide:true,stdio:['ignore','pipe','ignore'],env:{...process.env,LEARNFLOW_PORT:String(port),LEARNFLOW_PROVIDER:'openai-compatible',LEARNFLOW_API_BASE:`http://127.0.0.1:${mock.address().port}/v1`,LEARNFLOW_MODEL:'text-fixture',LEARNFLOW_API_KEY:'FIXTURE_ONLY'}});
try{
  await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});const base=`http://127.0.0.1:${port}`;
  const post=(p,b,headers={})=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});
  check((await (await fetch(base+'/api/models')).json()).models.some(m=>m.id==='vision-fixture'));
  check((await fetch(base+'/api/models',{headers:{Origin:'https://attacker.invalid'}})).status===403);
  check((await fetch(base+'/api/models',{headers:{Origin:'https://learnflow-buddy-2026.netlify.app'}})).status===403);
  const health=await(await fetch(base+'/api/health')).json();
  check(Array.isArray(health.clients)&&health.clients.every(client=>typeof client.id==='string'&&typeof client.name==='string'&&typeof client.method==='string'),'client discovery exposes explicit source metadata');
  check(health.clients.every(client=>Object.keys(client).every(key=>['id','name','method'].includes(key))),'client list does not expose local paths or credentials');
  const beforeDenied=upstreamCalls;
  check((await post('/api/probe',{})).status===400,'probe requires explicit consent');
  check(upstreamCalls===beforeDenied,'denied probe does not invoke upstream');
  const probe=await(await post('/api/probe',{consent:true,model:'vision-fixture'})).json();check(probe.verified&&probe.model==='vision-fixture','valid computed response and request nonce verifies selected model');
  check(probe.prompt.includes(lastNonce)&&probe.response===`133 ${lastNonce}`,'verification receipt contains the matching challenge and response');
  check((await(await fetch(base+'/api/health')).json()).verification?.verified===true,'health records successful challenge verification');
  for(const mode of ['wrong-nonce','wrong-math','empty','upstream-error']){
    probeMode=mode;
    const result=await(await post('/api/probe',{consent:true,model:'vision-fixture'})).json();
    check(result.verified!==true,mode+' cannot become verified');
    const after=await(await fetch(base+'/api/health')).json();
    check(after.verification?.verified===false,mode+' clears previous verification success');
  }
  probeMode='correct';
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
  const teachingContext={
    messages:[{role:'user',content:'SUBMITTED_COURSE_EVIDENCE: 学生给出了结论，但还没有独立说明依据。请给教师一份可核验草稿。'}],
    model:'text-fixture',
    preferences:{memory:true,guide:'strong',goal:'STUDENT_PREFERENCE_ONLY'},
    strategies:[{id:'student-only',title:'Student method',instructions:'STUDENT_STRATEGY_ONLY'}],
    memories:[{id:'student-memory',title:'Student preference',content:'STUDENT_MEMORY_ONLY'}]
  };
  check((await post('/api/chat',teachingContext)).status===200,'default learning request remains accepted');
  const learningPayload=JSON.stringify(payload.messages);
  check(learningPayload.includes('STUDENT_STRATEGY_ONLY')&&learningPayload.includes('STUDENT_MEMORY_ONLY')&&learningPayload.includes('learnflow-next'),'default learning still receives selected strategy, confirmed memory and next-step protocol');
  for(const purpose of ['teacher-assessment','teacher-assignment']){
    check((await post('/api/chat',{...teachingContext,purpose})).status===200,purpose+' is an accepted teaching request');
    const sent=JSON.stringify(payload.messages),policy=payload.messages[0];
    check(payload.messages.length===2&&payload.messages.at(-1).content===teachingContext.messages[0].content,purpose+' retains submitted evidence without extra student-context message');
    check(!sent.includes('STUDENT_STRATEGY_ONLY')&&!sent.includes('STUDENT_MEMORY_ONLY')&&!sent.includes('STUDENT_PREFERENCE_ONLY'),purpose+' excludes incidental student strategies, memories and preferences');
    check(policy.role==='system'&&!policy.content.includes('learnflow-next'),purpose+' omits student next-step metadata protocol');
    check(/不要按\s*token\s*量推断学习效果/i.test(policy.content)&&policy.content.includes('区分用户证据、推断和未知'),purpose+' retains evidence and token-not-mastery policy');
    check(policy.content.includes('500字')&&policy.content.includes('供教师编辑')&&policy.content.includes('不输出学习引子或记忆元数据'),purpose+' requests a bounded teacher-editable draft');
  }
  const beforeInvalidPurpose=upstreamCalls;
  check((await post('/api/chat',{...teachingContext,purpose:'teacher-admin'})).status===400,'unknown request purpose is rejected');
  check(upstreamCalls===beforeInvalidPurpose,'invalid purpose never reaches upstream');
  console.log(JSON.stringify({passed:count,fixtureOnly:true,liveModelTest:false,liveTencentTest:false,checks:'teacher-purpose isolation and bounded drafts, preserved learning context and safety policy, challenge nonce and arithmetic verification, wrong and empty probe rejection, sanitized client metadata, model forwarding, image bytes, document text, explicit consent, denied unpaired origins, malformed attachments'}));
}finally{server.kill();mock.close();}
