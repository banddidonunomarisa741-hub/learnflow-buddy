import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
let checks=0,cancelClosed=false;
const check=(v,m)=>{assert.ok(v,m);checks++;};
const fixture=http.createServer(async(req,res)=>{
  let raw='';for await(const b of req)raw+=b;const data=JSON.parse(raw);const text=data.messages.at(-1).content;
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  const write=d=>res.write('data: '+JSON.stringify(d)+'\n\n');
  if(text==='split-crlf'){
    const text='data: '+JSON.stringify({choices:[{delta:{content:'边界也能读懂。'}}]})+'\r\n\r\n';
    for(const char of text){res.write(char);await new Promise(r=>setTimeout(r,1));}res.end('data: [DONE]\r\n\r\n');return;
  }
  if(text==='cancel-me'){const t=setInterval(()=>write({choices:[{delta:{content:'继续'}}]}),20);res.on('close',()=>{cancelClosed=true;clearInterval(t);});return;}
  write({model:'fixture-stream',choices:[{delta:{reasoning_content:'PRIVATE_REASONING_NOT_FOR_UI'}}]});
  write({choices:[{delta:{content:'先看这个表格。\n\n'}}]});
  await new Promise(r=>setTimeout(r,15));
  write({choices:[{delta:{content:'| 单词 | 意思 |\n|---|---|\n| flow | 流动 |\n'}}]});
  write({choices:[{delta:{content:'\n```learnflow-next\n{"suggestions":[{"label":"试着回忆","prompt":"给我一道回忆练习"}],"blockReady":false}\n```'}}]});
  write({choices:[],usage:{total_tokens:42,prompt_tokens:20,completion_tokens:22}});res.end('data: [DONE]\n\n');
});await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const child=spawn(process.execPath,['server/server.mjs'],{windowsHide:true,stdio:['ignore','pipe','ignore'],env:{...process.env,LEARNFLOW_PORT:String(port),LEARNFLOW_PROVIDER:'openai-compatible',LEARNFLOW_API_BASE:`http://127.0.0.1:${fixture.address().port}/v1`,LEARNFLOW_API_KEY:'TEST_ONLY',LEARNFLOW_MODEL:'fixture-stream'}});
try{
 await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);});const base=`http://127.0.0.1:${port}`;
 const chat=(text,options={})=>fetch(base+'/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify({messages:[{role:'user',content:text}]}),signal:options.signal});
 const r=await chat('正常问题');check(r.ok,'stream accepted');check(r.headers.get('content-type').includes('ndjson'),'ndjson content type');
 const events=(await r.text()).trim().split('\n').map(s=>JSON.parse(s));const deltas=events.filter(e=>e.type==='delta');const end=events.find(e=>e.type==='result');
 check(events[0].type==='status','early visible status');check(deltas.length>=2,'incremental answer forwarded');check(end.reply.includes('| flow |'),'markdown preserved');check(!end.reply.includes('learnflow-next'),'metadata stripped from final');check(end.learning?.suggestions?.[0]?.label==='试着回忆','learning suggestions parsed');check(end.usage.total_tokens===42,'real upstream usage');check(!JSON.stringify(events).includes('PRIVATE_REASONING'),'reasoning never emitted');
 check((await chat('blocked',{headers:{Origin:'https://attacker.invalid'}})).status===403,'unknown origin rejected');check((await chat('blocked',{headers:{Origin:'https://learnflow-buddy-2026.netlify.app'}})).status===403,'unpaired trusted origin rejected');
 const boundary=(await (await chat('split-crlf')).text()).trim().split('\n').map(s=>JSON.parse(s));check(boundary.find(e=>e.type==='result')?.reply==='边界也能读懂。','SSE CRLF split between network chunks');
 const controller=new AbortController();const canceled=await chat('cancel-me',{signal:controller.signal});const reader=canceled.body.getReader();let received='';while(!received.includes('继续')){const {value,done}=await reader.read();if(done)break;received+=new TextDecoder().decode(value);}controller.abort();await new Promise(r=>setTimeout(r,450));check(cancelClosed,'browser stop aborts active upstream stream');
 console.log(JSON.stringify({passed:checks,fixtureOnly:true}));
}finally{child.kill();fixture.closeAllConnections();fixture.close();}
