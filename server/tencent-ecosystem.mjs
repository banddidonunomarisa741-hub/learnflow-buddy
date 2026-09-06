import {randomBytes,randomUUID,createDecipheriv,createHash} from 'node:crypto';
import {QQBot} from './vendor/qqbot-sdk.mjs';

// QQ's public scan-to-configure protocol. References and pinned SDK provenance
// are in docs/TENCENT-CONNECTORS.md. No WorkBuddy credential store is accessed.
const PORTAL='https://q.qq.com';
const GUIDE='https://www.codebuddy.cn/docs/workbuddy/QQ-Guide';
const consent=d=>{if(d?.consent!==true)throw new QQError(400,'CONSENT_REQUIRED','请先确认这次操作的内容和权限。');};
export class QQError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(status,code,message)=>{throw new QQError(status,code,message);};
const identifier=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,300}$/.test(v);
const cleanText=(v,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'INVALID_TEXT',`请填写 1～${max} 字的消息。`);return v.trim();};
function safeFailure(e){
  const status=Number(e?.httpStatus||0),code=String(e?.bizCode||'').replace(/[^\d-]/g,'').slice(0,20);
  if(status===401||status===403)return 'QQ 未允许这次操作。请检查机器人权限、沙箱成员及后台 IP 白名单，或重新扫码连接。';
  if(status===429)return 'QQ 限制了发送频率。请稍后再试。';
  return 'QQ 请求未完成'+(code?`（平台错误码 ${code}）`:'')+'。请检查网络、机器人权限和平台消息额度。结果不确定时先查看 QQ，避免重复发送。';
}

export function createQQConnector({Bot=QQBot,fetcher=globalThis.fetch,now=Date.now,timers=true}={}){
  let bot=null,generation=0,phase='disconnected',message='还没连接 QQ。',bind=null,connectedAt=null,account='';
  let connectionTimer=null,bindStarting=false,polling=false;
  const contacts=new Map(),inbox=new Map(),seen=new Map(),reminders=new Map(),operations=new Map();
  const status=()=>({provider:'qq-official-bot',state:phase,connected:phase==='connected',message,connectedAt,account,guide:GUIDE,
    storage:'本机服务内存；退出或断开连接后清除',receive:'仅接收发给此机器人的 QQ 私聊；不会读取 QQ 历史记录或联系人列表',
    send:'发送前确认收件人和内容；定时提醒在设定时确认',contacts:[...contacts.values()].map(({id,label})=>({id,label})),
    reminders:[...reminders.values()].map(({targetId,...r})=>({...r,recipient:contacts.get(targetId)?.label||'已移除账号'}))});
  const close=()=>{generation++;clearTimeout(connectionTimer);connectionTimer=null;const old=bot;bot=null;old?.stop();bind=null;phase='disconnected';message='已断开 QQ，并清除本次连接的凭据、收件和提醒。';connectedAt=null;account='';contacts.clear();inbox.clear();seen.clear();reminders.clear();operations.clear();};
  async function portal(route,data){
    let r;try{r=await fetcher(PORTAL+route,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','User-Agent':'LearnFlow/1.4 (QQ official onboard)'},body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(10000)});}catch{fail(502,'QQ_PORTAL_UNREACHABLE','暂时连不上 QQ 授权页面。请检查网络后重试，或使用下方官方客户端入口。');}
    let d;try{d=await r.json();}catch{fail(502,'QQ_PORTAL_FORMAT','QQ 授权服务未返回有效结果，请稍后重试。');}
    if(!r.ok||d.retcode!==0)fail(502,'QQ_PORTAL_REJECTED','QQ 暂未接受这次扫码请求'+(Number.isInteger(d.retcode)?`（${d.retcode}）`:'')+'，请稍后重试或使用手动连接。');
    return d.data||{};
  }
  function contact(openid,label){let c=[...contacts.values()].find(c=>c.openid===openid);if(!c){if(contacts.size>=100)return null;c={id:randomUUID(),openid,label:label||`QQ 私聊 · ${openid.slice(-4)}`};contacts.set(c.id,c);}return c;}
  function incoming(msg){
    if(phase!=='connected'||msg.kind!=='c2c'||!identifier(msg.senderId)||!identifier(msg.messageId)||seen.has(msg.messageId))return;
    if(seen.size>=1000)seen.delete(seen.keys().next().value);seen.set(msg.messageId,now());
    const c=contact(msg.senderId,typeof msg.senderName==='string'?msg.senderName.slice(0,40):undefined);if(!c)return;
    const id=randomUUID(),content=typeof msg.content==='string'?msg.content.slice(0,12000):'';
    if(!content&&!msg.attachments?.length)return;
    if(inbox.size>=100)inbox.delete(inbox.keys().next().value);
    inbox.set(id,{id,contactId:c.id,recipient:c.label,content,receivedAt:now(),sourceMessageId:msg.messageId,status:'pending',
      attachmentCount:Array.isArray(msg.attachments)?msg.attachments.length:0});
  }
  function start(appId,appSecret,scanner){
    if(!identifier(appId)||typeof appSecret!=='string'||appSecret.length<8||appSecret.length>4096)fail(400,'INVALID_BOT_IDENTITY','机器人身份格式无效，请重新扫码或检查 AppID / AppSecret。');
    close();const own=++generation;phase='connecting';message='已取得授权，正在连接 QQ…';account='机器人 · '+appId.slice(-4);
    if(identifier(scanner))contact(scanner,'刚才扫码的 QQ 账号');
    const logger={debug(){},info(s){if(own!==generation)return;if(String(s).includes('WebSocket closed:')){phase='reconnecting';message='QQ 连接中断，正在重连。';}},warn(){},error(){}};
    const instance=new Bot({appId,appSecret,intents:1<<25,markdownSupport:false,accountId:'learnflow-local',userAgent:'LearnFlow/1.4',logger});bot=instance;
    instance.on('ready',()=>{if(own!==generation)return;clearTimeout(connectionTimer);phase='connected';message='QQ 已连接。用手机给机器人发一句学习任务，就会出现在这里。';connectedAt=now();});
    instance.on('resumed',()=>{if(own!==generation)return;phase='connected';message='QQ 已重新连接。';});
    instance.on('message',(_ctx,msg)=>{if(own===generation)incoming(msg);});
    instance.on('error',e=>{if(own!==generation)return;phase='reconnecting';message=safeFailure(e);});
    Promise.resolve(instance.start()).catch(e=>{if(own!==generation)return;phase='error';message=safeFailure(e);instance.stop();bot=null;});
    if(timers){connectionTimer=setTimeout(()=>{if(own===generation&&phase!=='connected'){instance.stop();bot=null;phase='error';message='QQ 连接没有完成。请确认机器人已启用、支持 WebSocket，并检查网络或 IP 白名单后重新连接。';}},60000);connectionTimer.unref?.();}
    return status();
  }
  async function startBind(data){
    consent(data);if(bindStarting)fail(409,'BIND_BUSY','正在生成二维码，请稍等。');
    if(bot)fail(409,'ALREADY_CONNECTED','请先断开现有 QQ 连接，再绑定另一个机器人。');
    bindStarting=true;const own=generation;try{const key=randomBytes(32),d=await portal('/lite/create_bind_task',{key:key.toString('base64')});
      if(own!==generation)fail(409,'BIND_CANCELLED','连接已取消。');
      if(!identifier(d.task_id))fail(502,'QQ_BIND_FORMAT','QQ 未返回有效的扫码任务。');
      bind={id:randomBytes(24).toString('hex'),taskId:d.task_id,key,expiresAt:now()+300000};phase='awaiting_scan';message='请用手机 QQ 扫码，并在手机上确认授权。';
      return {id:bind.id,url:PORTAL+'/qqbot/openclaw/connect.html?task_id='+encodeURIComponent(d.task_id)+'&_wv=2&source=learnflow',expiresAt:bind.expiresAt};
    }finally{bindStarting=false;}
  }
  async function pollBind(data){
    const current=bind;if(!current||data.id!==current.id)fail(410,'BIND_EXPIRED','二维码已失效，请重新生成。');
    if(current.expiresAt<now()){bind=null;phase='disconnected';fail(410,'BIND_EXPIRED','二维码已过期，请重新生成。');}
    if(polling)return {pending:true};polling=true;
    try{const d=await portal('/lite/poll_bind_result',{task_id:current.taskId});
      if(bind!==current)fail(410,'BIND_EXPIRED','连接已取消，请重新扫码。');
      if(d.status===3){bind=null;phase='disconnected';fail(410,'BIND_EXPIRED','二维码已过期，请重新生成。');}
      if(d.status!==2)return {pending:true};
      let secret;try{const raw=Buffer.from(d.bot_encrypt_secret||'','base64');if(raw.length<29)throw Error();const dec=createDecipheriv('aes-256-gcm',current.key,raw.subarray(0,12));dec.setAuthTag(raw.subarray(-16));secret=Buffer.concat([dec.update(raw.subarray(12,-16)),dec.final()]).toString('utf8');}catch{bind=null;phase='error';fail(502,'BIND_VERIFY_FAILED','扫码结果无法验证，请重新生成二维码。');}
      const result=start(String(d.bot_appid||''),secret,String(d.user_openid||''));secret='';return {completed:true,...result};
    }finally{polling=false;}
  }
  function connected(){if(!bot||phase!=='connected')fail(409,'QQ_NOT_CONNECTED','请先完成 QQ 扫码连接。');}
  function recipient(id){const c=contacts.get(id);if(!c)fail(400,'RECIPIENT_REQUIRED','请选择已扫码或给机器人发过私聊的 QQ 账号。');return c;}
  async function send(data){
    consent(data);connected();const c=recipient(data.contactId),content=cleanText(data.content),key=data.operationId;
    if(typeof key!=='string'||!/^[a-f0-9-]{36}$/.test(key))fail(400,'OPERATION_REQUIRED','发送请求需要一个唯一编号，请重新打开确认窗口。');
    const signature=createHash('sha256').update(JSON.stringify([c.id,content,data.replyTo||null])).digest('hex');
    if(operations.has(key)){const old=operations.get(key);if(old.signature!==signature)fail(409,'OPERATION_CONFLICT','这次发送内容已变更，请重新确认。');return old.result;}
    if(operations.size>=200)fail(429,'SEND_LIMIT','本次连接的发送次数较多，请重新连接后继续。');
    const own=generation,instance=bot,target={scope:'c2c',targetId:c.openid};
    if(data.replyTo){const m=inbox.get(data.replyTo);if(!m||m.contactId!==c.id)fail(400,'INVALID_REPLY','回复对象不匹配。');if(m.replied||m.replyPending)fail(409,'ALREADY_REPLIED','这条消息已经发起回复，重复请求已阻止。请在 QQ 查看结果。');if(now()-m.receivedAt>240000)fail(409,'REPLY_EXPIRED','回复时间已过，请让对方再发一条消息，或另行确认一次主动提醒。');target.msgId=m.sourceMessageId;m.replyPending=true;}
    const record={signature,result:{status:'sending',message:'正在发送，请勿重复点击。'}};operations.set(key,record);
    try{const r=await instance.sendText(target,content);if(own!==generation)return {status:'unknown',message:'连接已断开，请在 QQ 查看是否送达。'};
      record.result={status:r?.id?'sent':'unknown',message:r?.id?'QQ 平台已接收这条消息。':'未收到消息回执，请在 QQ 查看是否送达。'};
      if(data.replyTo&&r?.id)inbox.get(data.replyTo).replied=true;
    }catch(e){record.result={status:'failed_or_unknown',message:safeFailure(e)};}
    return record.result;
  }
  function schedule(data){
    consent(data);connected();const c=recipient(data.contactId),content=cleanText(data.content),at=Date.parse(data.at);
    if(typeof data.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(data.operationId))fail(400,'OPERATION_REQUIRED','请重新打开提醒窗口再确认。');
    const existing=reminders.get(data.operationId);if(existing){if(existing.targetId!==c.id||existing.content!==content||existing.at!==at)fail(409,'OPERATION_CONFLICT','提醒内容已变更，请重新打开窗口确认。');return {id:existing.id,...status()};}
    if(!Number.isFinite(at)||at<now()+10000||at>now()+7*86400000)fail(400,'INVALID_REMINDER_TIME','请选择 10 秒后至 7 天内的提醒时间。');
    if(reminders.size>=50)fail(429,'REMINDER_LIMIT','最多保留 50 条提醒，请先移除已结束的提醒。');
    const id=data.operationId;reminders.set(id,{id,targetId:c.id,content,at,status:'scheduled',createdAt:now(),consentedAt:now()});return {id,...status()};
  }
  async function tick(){
    if(bind&&bind.expiresAt<now()){bind=null;if(phase==='awaiting_scan'){phase='disconnected';message='二维码已过期，请重新扫码连接。';}}
    for(const r of reminders.values())if(r.status==='scheduled'&&r.at<=now()){
      r.status='sending';
      if(now()-r.at>60000){r.status='missed';r.message='电脑休眠或服务暂停，已错过提醒时间；没有补发。';continue;}
      try{const result=await send({consent:true,contactId:r.targetId,content:r.content,operationId:r.id});r.status=result.status;r.message=result.message;}catch(e){r.status='failed';r.message=e instanceof QQError?e.message:'提醒未发送，请检查连接。';}
    }
  }
  const timer=timers?setInterval(()=>void tick(),1000):null;timer?.unref?.();
  async function route(method,path,data={},local=false){
    if(!path.startsWith('/api/ecosystem/qq/'))return null;
    const action=path.slice('/api/ecosystem/qq/'.length);
    if(['bind/start','bind/poll','connect'].includes(action)&&!local)fail(403,'LOCAL_CONFIRMATION_REQUIRED','请在本机 QQ 连接窗口完成授权。');
    if(action==='status'&&method==='GET')return status();
    if(action==='bind/start'&&method==='POST')return startBind(data);
    if(action==='bind/poll'&&method==='POST')return pollBind(data);
    if(action==='connect'&&method==='POST'){consent(data);if(bot)fail(409,'ALREADY_CONNECTED','请先断开当前 QQ。');return start(String(data.appId||''),data.appSecret);}
    if(action==='disconnect'&&method==='POST'){consent(data);close();return status();}
    if(action==='inbox'&&method==='GET')return {messages:[...inbox.values()].reverse().map(({sourceMessageId,...m})=>m)};
    if(action==='take'&&method==='POST'){consent(data);const m=inbox.get(data.id);if(!m)fail(404,'MESSAGE_MISSING','这条消息已移除。');m.status='opened';return {id:m.id,content:m.content,attachmentCount:m.attachmentCount};}
    if(action==='dismiss'&&method==='POST'){consent(data);inbox.delete(data.id);return {ok:true};}
    if(action==='send'&&method==='POST')return send(data);
    if(action==='reminders'&&method==='POST')return schedule(data);
    if(action==='reminders'&&method==='DELETE'){consent(data);const r=reminders.get(data.id);if(r?.status==='sending')fail(409,'ALREADY_SENDING','这条提醒已开始发送，请在 QQ 查看结果。');reminders.delete(data.id);return {ok:true};}
    fail(404,'QQ_ROUTE_MISSING','没有这个 QQ 操作。');
  }
  return {route,status,close:()=>{clearInterval(timer);close();},tick};
}
export const qqConnector=createQQConnector();
