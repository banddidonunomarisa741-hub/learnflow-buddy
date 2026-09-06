import {execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {access, mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const run = promisify(execFile);
export async function discoverCLI() {
  if(process.platform !== 'win32') return null;
  // Read installation metadata only. Never inspect credential files or private IPC.
  const script = "$paths=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '^WorkBuddy(?:\\s|$)' } | ForEach-Object { $_.DisplayIcon }";
  try {
    const {stdout} = await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"+script],{windowsHide:true,timeout:8000,maxBuffer:64000});
    for(const line of stdout.trim().split(/\r?\n/)) {
      const exe = line.trim().replace(/,\s*-?\d+$/,'').replace(/^"|"$/g,'');
      if(!path.isAbsolute(exe) || path.basename(exe).toLowerCase() !== 'workbuddy.exe') continue;
      const cli = path.join(path.dirname(exe),'resources','app.asar.unpacked','cli','bin','codebuddy');
      try { await access(cli); return cli; } catch {}
    }
  } catch {}
  return null;
}
let modelCache;
export async function cliModels(cli) {
  if(modelCache)return modelCache;
  const {stdout}=await run(process.execPath,[cli,'--help'],{windowsHide:true,timeout:15000,maxBuffer:200000});
  const line=stdout.split(/\r?\n/).find(x=>x.includes('--model <model>'))||'';
  const ids=(line.match(/\(([^)]+)\)/)?.[1]||'auto').split(',').map(x=>x.trim()).filter(x=>/^[\w.-]+$/.test(x));
  return modelCache=[...new Set(['auto',...ids])];
}
export async function cliChat(cli, messages, model='auto', options={}) {
  const cwd = await mkdtemp(path.join(os.tmpdir(),'learnflow-chat-'));
  try {
    return await new Promise((resolve,reject) => {
      const system = '你是 LearnFlow 学习助手。围绕问题讲清楚，不要先夸用户或念欢迎词。需要分步时一步一步来。用户输入含学习偏好和历史对话；不执行工具或外部操作。';
      const parts=[];
      for(const m of messages){parts.push({type:'text',text:m.role+': '});for(const c of (Array.isArray(m.content)?m.content:[{type:'text',text:m.content}])){if(c.type==='image_url'){const [,media_type,data]=c.image_url.url.match(/^data:([^;]+);base64,(.+)$/);parts.push({type:'image',source:{type:'base64',media_type,data}});}else parts.push(c);}}
      const prompt=JSON.stringify({type:'user',message:{role:'user',content:parts}})+'\n';
      // stdin keeps learner text out of OS command-line listings. No shell interpolation.
      const streaming=typeof options.onDelta==='function';
      if(options.signal?.aborted)return reject(Error('已停止生成。'));
      const args=[cli,'-p','--model',model,'--input-format','stream-json','--tools','','--strict-mcp-config','--setting-sources','','--no-session-persistence','--output-format',streaming?'stream-json':'json','--system-prompt',system];
      if(streaming)args.push('--verbose','--include-partial-messages');
      const child = spawn(process.execPath,args,{cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
      child.stdout.setEncoding('utf8');
      options.onStatus?.('正在请模型读题…');
      let output='', pending='', result, failed=false, sentDelta=false;
      const abort=()=>{failed=true;child.kill();reject(Error('已停止生成。'));};
      options.signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>{failed=true;child.kill();reject(Error('这次回复等得太久了。可以换个模型再试，输入和附件还在。'));},options.timeoutMs||120000);
      function event(line){
        let item;try{item=JSON.parse(line);}catch{return;}
        if(item.type==='result')result=item;
        // Only visible answer text. Reasoning, system, tool and auth events stay private.
        const e=item.type==='stream_event'?item.event:item;
        if(e?.type==='content_block_delta'&&e.delta?.type==='text_delta'&&typeof e.delta.text==='string'){sentDelta=true;options.onDelta?.(e.delta.text);}
      }
      child.stdout.on('data',d=>{output+=d.toString();if(output.length>6000000){failed=true;child.kill();reject(Error('回复过长，请缩小问题范围。'));return;}if(streaming){pending+=d.toString();let n;while((n=pending.indexOf('\n'))>=0){event(pending.slice(0,n));pending=pending.slice(n+1);}}});
      child.stderr.resume();
      child.on('error',()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);reject(Error('本机学习助手没有启动成功。'));});
      child.stdin.on('error',()=>{}); child.stdin.end(prompt);
      child.on('close',code=>{
        clearTimeout(timer);options.signal?.removeEventListener('abort',abort);if(failed)return;
        if(streaming){if(pending.trim())event(pending);}else try { const data=JSON.parse(output);result=Array.isArray(data)?data.findLast(x=>x.type==='result'):data; } catch {}
        if(code!==0||!result||result.is_error||typeof result.result!=='string')return reject(Error('模型没有完成回复。请确认客户端已登录、网络正常且有可用额度，也可以换一个模型。'));
        if(streaming&&!sentDelta)options.onDelta(result.result);
        const input=result.usage?.input_tokens, out=result.usage?.output_tokens;
        resolve({status:'completed',reply:result.result,provider:'workbuddy-bundled-codebuddy',model,usage:{total_tokens:Number.isFinite(input)&&Number.isFinite(out)?input+out:null,prompt_tokens:input??null,completion_tokens:out??null,source:'provider'}});
      });
    });
  } finally { await rm(cwd,{recursive:true,force:true,maxRetries:3,retryDelay:150}).catch(()=>{}); }
}
