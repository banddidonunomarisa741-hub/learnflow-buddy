import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const run=promisify(execFile),modelCache=new Map();
// Executable metadata only: never inspect account files or private IPC.
export async function discoverClients(){
 if(process.platform!=='win32')return [];
 const script=`[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
 $registryPaths=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');
 $entries=@(Get-ItemProperty $registryPaths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '^(WorkBuddy|LearnBuddy|CodeBuddy)(?:\\s|$)' } | ForEach-Object { $_.DisplayIcon });
 $entries+=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(WorkBuddy|LearnBuddy|CodeBuddy)\\.exe$' } | ForEach-Object { $_.ExecutablePath });
 ConvertTo-Json -Compress -InputObject @($entries | Where-Object { $_ } | Sort-Object -Unique)`;
 try{
  const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,maxBuffer:100000});
  const values=JSON.parse(stdout.trim()||'[]'),clients=[],seen=new Set();
  for(const value of (Array.isArray(values)?values:[values])){
   const exe=String(value).trim().replace(/,\s*-?\d+$/,'').replace(/^"|"$/g,'');
   if(!path.isAbsolute(exe)||!/^(workbuddy|learnbuddy|codebuddy)\.exe$/i.test(path.basename(exe)))continue;
   const cli=path.join(path.dirname(exe),'resources','app.asar.unpacked','cli','bin','codebuddy'),key=cli.toLowerCase();
   if(seen.has(key))continue;try{await access(cli);}catch{continue;}seen.add(key);
   clients.push({id:createHash('sha256').update(key).digest('hex').slice(0,16),name:path.basename(exe,'.exe'),cli,method:'内置 CodeBuddy 命令行'});
  }
  return clients.sort((a,b)=>Number(b.name==='WorkBuddy')-Number(a.name==='WorkBuddy'));
 }catch{return [];}
}
export async function discoverCLI(){return (await discoverClients())[0]?.cli||null;}
export async function cliModels(cli){
 const cached=modelCache.get(cli);if(cached&&Date.now()-cached.at<300000)return cached.ids;
 const {stdout}=await run(process.execPath,[cli,'--help'],{windowsHide:true,timeout:15000,maxBuffer:200000});
 const line=stdout.split(/\r?\n/).find(x=>x.includes('--model <model>'))||'';
 const ids=[...new Set(['auto',...(line.match(/\(([^)]+)\)/)?.[1]||'').split(',').map(x=>x.trim()).filter(x=>/^[\w.-]+$/.test(x))])];
 modelCache.set(cli,{ids,effort:stdout.includes('--effort <level>'),at:Date.now()});return ids;
}
function failure(stderr){
 if(/unauthorized|not logged|authentication|login required|invalid.{0,12}(api.?key|token)|\b401\b/i.test(stderr))return '客户端的命令行尚未登录或授权已失效。请在对应客户端完成登录后重试。';
 if(/quota|insufficient|credits|balance|\b429\b|额度|余额/i.test(stderr))return '模型服务提示额度或请求频率受限。请在客户端检查可用额度，稍后再试。';
 if(/model.{0,25}(not found|unavailable|not supported)|unsupported model/i.test(stderr))return '账号当前不能使用这个模型。请选择 Auto 或其他模型后重新验证。';
 if(/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|fetch failed/i.test(stderr))return '客户端没有连上模型服务，请检查它的网络或代理连接。';
 return '客户端没有完成回复。请确认对应客户端已登录、网络和额度正常，再试 Auto 或其他模型。';
}
const count=v=>Number.isInteger(v)&&v>=0?v:null;
export async function cliChat(cli,messages,model='auto',options={}){
 const tempRoot=path.resolve(os.tmpdir()),cwd=await mkdtemp(path.join(tempRoot,'learnflow-chat-'));
 try{return await new Promise((resolve,reject)=>{
  if(options.signal?.aborted)return reject(Error('已停止生成。'));
  const parts=[];
  for(const m of messages){parts.push({type:'text',text:m.role+': '});for(const c of (Array.isArray(m.content)?m.content:[{type:'text',text:m.content}])){
   if(c.type==='image_url'){const match=c.image_url?.url?.match(/^data:([^;]+);base64,(.+)$/);if(!match)return reject(Error('图片格式无法读取。'));parts.push({type:'image',source:{type:'base64',media_type:match[1],data:match[2]}});}else parts.push(c);
  }}
  const prompt=JSON.stringify({type:'user',message:{role:'user',content:parts}})+'\n';
  const args=[cli,'-p','--model',model,'--input-format','stream-json','--tools','','--strict-mcp-config','--setting-sources','','--no-session-persistence','--output-format','stream-json','--verbose','--include-partial-messages','--system-prompt','你是 LearnFlow 学习助手。围绕当前问题讲清楚，不执行工具、命令或外部操作。遵循学习者明确选择的教学方法，区分证据和推断。'];
  if((options.probe||options.effort==='low')&&modelCache.get(cli)?.effort)args.push('--effort','low');
  const child=spawn(process.execPath,args,{cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let pending='',stderr='',size=0,settled=false,visible='',streamText='',actualModel=null;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(progress);options.signal?.removeEventListener('abort',abort);child.kill();error?reject(error):resolve(result);};
  const abort=()=>finish(Error('已停止生成。'));
  const timer=setTimeout(()=>finish(Error(visible?'模型回复中断了，已收到的内容会保留。可以重试或换个模型。':'这个模型在等待时间内没有回复。请先试 Auto，或在客户端确认这个模型是否可用。')),options.timeoutMs??120000);
  let seconds=0;const progress=setInterval(()=>{seconds+=15;options.onStatus?.(visible?'模型正在继续回答…':`已等待 ${seconds} 秒，客户端还没有返回正文。你可以停止并换个模型。`);},15000);
  options.signal?.addEventListener('abort',abort,{once:true});options.onStatus?.('已启动客户端，正在等待模型…');
  const emit=text=>{if(!text||settled)return;visible+=text;options.onDelta?.(text);};
  const snapshot=text=>{if(typeof text!=='string')return;if(!visible)emit(text);else if(text.startsWith(visible))emit(text.slice(visible.length));};
  function event(line){
   let item;try{item=JSON.parse(line);}catch{return;}
   if(item.type==='result'){
    if(item.is_error||typeof item.result!=='string'||!item.result.trim())return finish(Error(failure(JSON.stringify(item.errors||[])+' '+stderr)));
    snapshot(item.result);
    const u=item.usage||{},input=count(u.input_tokens),output=count(u.output_tokens),cacheRead=count(u.cache_read_input_tokens),cacheWrite=count(u.cache_creation_input_tokens);
    // CLI providers differ in whether cached input is already included in input_tokens.
    // Keep their cache fields separately; do not silently count them a second time.
    const reportedTotal=count(u.total_tokens),total=reportedTotal??(input!==null&&output!==null?input+output:null);
    return finish(null,{status:'completed',reply:item.result,provider:'local-codebuddy',model:actualModel||model,requestedModel:model,usage:{total_tokens:total,prompt_tokens:input,completion_tokens:output,cache_read_tokens:cacheRead,cache_creation_tokens:cacheWrite,basis:reportedTotal!==null?'provider_total':'reported_input_plus_output',source:total===null?'unavailable':'provider'}});
   }
   if(item.type==='assistant'){
    if(typeof item.message?.model==='string'&&/^[\w./:@+-]{1,200}$/.test(item.message.model))actualModel=item.message.model;
    const content=item.message?.content;snapshot(typeof content==='string'?content:Array.isArray(content)?content.filter(x=>x.type==='text'&&typeof x.text==='string').map(x=>x.text).join(''):'');
   }
   const e=item.type==='stream_event'?item.event:item;
   if(e?.type==='content_block_delta'&&e.delta?.type==='text_delta'&&typeof e.delta.text==='string'){streamText+=e.delta.text;snapshot(streamText);}
  }
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{if(settled)return;size+=chunk.length;if(size>6000000)return finish(Error('模型回复过长，请缩小问题范围。'));pending+=chunk;let n;while(!settled&&(n=pending.indexOf('\n'))>=0){event(pending.slice(0,n));pending=pending.slice(n+1);}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-12000);});
  child.on('error',()=>finish(Error('本机客户端命令行没有启动成功，请更新或重新安装该客户端。')));
  child.on('close',()=>{if(settled)return;if(pending.trim())event(pending);if(!settled)finish(Error(failure(stderr)));});
  child.stdin.on('error',()=>{});child.stdin.end(prompt);
 });}finally{
  const relative=path.relative(tempRoot,path.resolve(cwd));
  if(relative.startsWith('learnflow-chat-')&&!relative.includes(path.sep))await rm(cwd,{recursive:true,force:true,maxRetries:3,retryDelay:150}).catch(()=>{});
 }
}
