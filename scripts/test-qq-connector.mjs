import assert from 'node:assert/strict';
import {createCipheriv,randomBytes,randomUUID} from 'node:crypto';
import {createQQConnector} from '../server/tencent-ecosystem.mjs';
let checks=0,clock=Date.now(),latest,networkCalls=0,key,complete=false,rejectSend=false;
const sent=[];
class FakeBot {
  constructor(options){this.options=options;this.listeners={};latest=this;}
  on(name,handler){this.listeners[name]=handler;return this;}
  async start(){this.listeners.ready();}
  stop(){this.stopped=true;}
  async sendText(target,content){sent.push({target,content});if(rejectSend)throw Object.assign(Error('sensitive-server-response'),{httpStatus:403});return {id:'realistic-fixture-receipt'};}
  inbound(content='请帮我复盘一道阅读题',id='fixtureMessage'){this.listeners.message({}, {kind:'c2c',senderId:'scanner123',messageId:id,content,attachments:[]});}
}
const fetcher=async(url,options)=>{
  networkCalls++;const d=JSON.parse(options.body);assert.equal(options.redirect,'error');
  if(url.endsWith('/create_bind_task')){key=Buffer.from(d.key,'base64');return {ok:true,json:async()=>({retcode:0,data:{task_id:'fixture-task'}})};}
  const iv=randomBytes(12),enc=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([iv,enc.update('fixture-secret-never-exposed'),enc.final(),enc.getAuthTag()]).toString('base64');
  return {ok:true,json:async()=>({retcode:0,data:complete?{status:2,bot_appid:'123456',bot_encrypt_secret:encrypted,user_openid:'scanner123'}:{status:1}})};
};
const q=createQQConnector({Bot:FakeBot,fetcher,now:()=>clock,timers:false});
const req=(action,data={},local=true,method='POST')=>q.route(method,'/api/ecosystem/qq/'+action,data,local);
const check=(fn)=>{fn();checks++;};
const rejects=async(p,code)=>{await assert.rejects(p,e=>e.code===code);checks++;};
try{
  check(()=>assert.equal(q.status().connected,false));
  await rejects(req('bind/start',{}),'CONSENT_REQUIRED');
  await rejects(req('bind/start',{consent:true},false),'LOCAL_CONFIRMATION_REQUIRED');
  check(()=>assert.equal(networkCalls,0));
  const binding=await req('bind/start',{consent:true});
  check(()=>assert.ok(binding.url.startsWith('https://q.qq.com/qqbot/openclaw/connect.html?task_id=')));
  check(()=>assert.equal(JSON.stringify(binding).includes(key.toString('base64')),false));
  await rejects(req('bind/poll',{id:binding.id},false),'LOCAL_CONFIRMATION_REQUIRED');
  check(()=>assert.equal(q.status().connected,false));
  check(()=>assert.equal(q.status().state,'awaiting_scan'));
  check(()=>assert.equal((awaitable=>awaitable)(binding.expiresAt),clock+300000));
  assert.equal((await req('bind/poll',{id:binding.id})).pending,true);checks++;
  complete=true;await req('bind/poll',{id:binding.id});
  check(()=>assert.equal(q.status().connected,true));
  check(()=>assert.equal(latest.options.intents,1<<25));
  check(()=>assert.equal(latest.options.appSecret,'fixture-secret-never-exposed'));
  check(()=>assert.equal(JSON.stringify(q.status()).includes('fixture-secret'),false));
  check(()=>assert.equal(JSON.stringify(q.status()).includes('scanner123'),false));
  check(()=>assert.equal(sent.length,0));
  latest.inbound();latest.inbound();
  const inbox=(await req('inbox',{},true,'GET')).messages;
  check(()=>assert.equal(inbox.length,1));
  check(()=>assert.equal(inbox[0].status,'pending'));
  check(()=>assert.equal('sourceMessageId' in inbox[0],false));
  check(()=>assert.equal(sent.length,0));
  latest.inbound('带点号消息编号的文字','ROBOT1.0_fixture:3');
  assert.equal((await req('inbox',{},true,'GET')).messages[0].content,'带点号消息编号的文字');checks++;
  latest.listeners.message({}, {kind:'group',senderId:'scanner123',messageId:'GROUP.1',content:'不应收取的群消息'});
  assert.equal((await req('inbox',{},true,'GET')).messages.length,2);checks++;
  await rejects(req('take',{id:inbox[0].id}),'CONSENT_REQUIRED');
  const task=await req('take',{id:inbox[0].id,consent:true});
  check(()=>assert.equal(task.content,'请帮我复盘一道阅读题'));
  const contactId=q.status().contacts[0].id;
  await rejects(req('send',{contactId,content:'测试',operationId:randomUUID()}),'CONSENT_REQUIRED');
  await rejects(req('send',{consent:true,contactId:'foreign',content:'测试',operationId:randomUUID()}),'RECIPIENT_REQUIRED');
  const send={consent:true,contactId,content:'我们先找题目里的定位词。',replyTo:inbox[0].id,operationId:randomUUID()};
  check(()=>assert.equal(sent.length,0));
  assert.equal((await req('send',send)).status,'sent');checks++;
  check(()=>assert.equal(sent[0].target.msgId,'fixtureMessage'));
  await req('send',send);check(()=>assert.equal(sent.length,1));
  await rejects(req('send',{...send,content:'changed'}),'OPERATION_CONFLICT');
  await rejects(req('send',{...send,operationId:randomUUID()}),'ALREADY_REPLIED');
  latest.inbound('第二道题','fixtureMessage2');clock+=300000;
  const second=(await req('inbox',{},true,'GET')).messages[0];
  await rejects(req('send',{...send,replyTo:second.id,operationId:randomUUID()}),'REPLY_EXPIRED');
  rejectSend=true;const bad={consent:true,contactId,content:'测试失败反馈',operationId:randomUUID()};
  const badResult=await req('send',bad);check(()=>assert.equal(badResult.status,'failed_or_unknown'));
  check(()=>assert.equal(JSON.stringify(badResult).includes('sensitive-server-response'),false));
  await req('send',bad);check(()=>assert.equal(sent.length,2));rejectSend=false;
  const remind={consent:true,contactId,content:'该回来看一道题了',at:new Date(clock+30000).toISOString(),operationId:randomUUID()};
  await rejects(req('reminders',{...remind,consent:false}),'CONSENT_REQUIRED');
  const reminder=await req('reminders',remind);await req('reminders',remind);
  check(()=>assert.equal(q.status().reminders.length,1));
  clock+=30000;await q.tick();await q.tick();
  check(()=>assert.equal(sent.length,3));
  check(()=>assert.equal(sent[2].target.msgId,undefined));
  check(()=>assert.equal(q.status().reminders[0].status,'sent'));
  const missed=await req('reminders',{...remind,at:new Date(clock+30000).toISOString(),operationId:randomUUID()});clock+=120000;await q.tick();
  check(()=>assert.equal(q.status().reminders.find(x=>x.id===missed.id).status,'missed'));
  check(()=>assert.equal(sent.length,3));
  await req('reminders',{consent:true,id:reminder.id},true,'DELETE');
  await req('disconnect',{consent:true});check(()=>assert.equal(q.status().contacts.length,0));
  check(()=>assert.equal(q.status().reminders.length,0));check(()=>assert.equal(q.status().connected,false));
  check(()=>assert.equal(latest.stopped,true));
  await rejects(req('send',send),'QQ_NOT_CONNECTED');
  complete=false;const cancelled=await req('bind/start',{consent:true});await req('disconnect',{consent:true});
  await rejects(req('bind/poll',{id:cancelled.id}),'BIND_EXPIRED');
  const expired=await req('bind/start',{consent:true});clock+=301000;
  await rejects(req('bind/poll',{id:expired.id}),'BIND_EXPIRED');
  console.log(`QQ connector: ${checks} checks passed. Mock QQ responses only; no real QQ message sent.`);
}finally{q.close();}
