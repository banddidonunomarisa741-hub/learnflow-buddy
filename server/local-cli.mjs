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
export async function cliChat(cli, messages, model='auto') {
  const cwd = await mkdtemp(path.join(os.tmpdir(),'learnflow-chat-'));
  try {
    return await new Promise((resolve,reject) => {
      const system = '你是 LearnFlow 学习助手。用户输入含学习偏好和历史对话；只进行文字教学，不执行工具或外部操作。';
      const parts=[];
      for(const m of messages){parts.push({type:'text',text:m.role+': '});for(const c of (Array.isArray(m.content)?m.content:[{type:'text',text:m.content}])){if(c.type==='image_url'){const [,media_type,data]=c.image_url.url.match(/^data:([^;]+);base64,(.+)$/);parts.push({type:'image',source:{type:'base64',media_type,data}});}else parts.push(c);}}
      const prompt=JSON.stringify({type:'user',message:{role:'user',content:parts}})+'\n';
      // stdin keeps learner text out of OS command-line listings. No shell interpolation.
      const child = spawn(process.execPath,[cli,'-p','--model',model,'--input-format','stream-json','--tools','','--strict-mcp-config','--setting-sources','','--no-session-persistence','--output-format','json','--system-prompt',system],{cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
      let output='', failed=false;
      const timer=setTimeout(()=>{failed=true;child.kill();reject(Error('模型响应超时，请稍后重试。'));},55000);
      child.stdout.on('data',d=>{output+=d.toString();if(output.length>2000000){failed=true;child.kill();reject(Error('模型响应过长。'));}});
      child.stderr.resume();
      child.on('error',()=>{clearTimeout(timer);reject(Error('本机命令行入口未能启动。'));});
      child.stdin.on('error',()=>{}); child.stdin.end(prompt);
      child.on('close',code=>{
        clearTimeout(timer);if(failed)return;
        let result;try { const data=JSON.parse(output);result=Array.isArray(data)?data.findLast(x=>x.type==='result'):data; } catch {}
        if(code!==0||!result||result.is_error||typeof result.result!=='string')return reject(Error('本机 CodeBuddy 未完成调用，请检查客户端登录、网络或额度；没有读取登录密钥。'));
        const input=result.usage?.input_tokens, out=result.usage?.output_tokens;
        resolve({status:'completed',reply:result.result,provider:'workbuddy-bundled-codebuddy',model,usage:{total_tokens:Number.isFinite(input)&&Number.isFinite(out)?input+out:null,prompt_tokens:input??null,completion_tokens:out??null,source:'provider'}});
      });
    });
  } finally { await rm(cwd,{recursive:true,force:true,maxRetries:3,retryDelay:150}).catch(()=>{}); }
}
