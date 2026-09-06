import {mkdir,readFile,writeFile,readdir,access,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
const exec = promisify(execFile);
const root=process.env.LEARNFLOW_ASSET_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(),'LearnFlowAssets');
const validID=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function listAssets(){await mkdir(root,{recursive:true});const rows=[];for(const f of await readdir(root)){if(!/^[a-f0-9-]{36}\.json$/.test(f))continue;try{const d=JSON.parse(await readFile(path.join(root,f),'utf8'));if(validID(d.id))rows.push(d);}catch{}}return rows.sort((a,b)=>b.created.localeCompare(a.created));}
async function generatePDF(title,content,target){
  const candidates=[path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),path.join(process.env.ProgramFiles||'C:/Program Files','Microsoft/Edge/Application/msedge.exe')];
  let edge;for(const p of candidates){try{await access(p);edge=p;break;}catch{}}
  if(!edge)throw Error('生成 PDF 需要 Microsoft Edge；你仍可以保存 Markdown 或导入已有 PDF。');
  const temp=await mkdtemp(path.join(os.tmpdir(),'learnflow-pdf-'));
  try {
    const file=path.join(temp,'document.html');
    await writeFile(file,`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{size:A4;margin:20mm 18mm}body{font:12pt/1.75 'Microsoft YaHei',sans-serif;color:#292724}header{color:#b8662d;font-size:10pt;border-bottom:1px solid #e8d8c7;padding-bottom:8px}h1{font-size:22pt;line-height:1.4}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}footer{margin-top:24px;font-size:9pt;color:#777}</style><header>LearnFlow · 我的学习资产</header><h1>${escape(title)}</h1><pre>${escape(content)}</pre><footer>由学习者确认保存 · AI 整理内容请结合原始教材核对</footer>`,'utf8');
    await exec(edge,['--headless','--disable-gpu','--no-first-run','--no-pdf-header-footer',`--user-data-dir=${path.join(temp,'profile')}`,`--print-to-pdf=${target}`,pathToFileURL(file).href],{windowsHide:true,timeout:35000,maxBuffer:200000});
    const pdf=await readFile(target);if(pdf.subarray(0,5).toString()!=='%PDF-')throw Error('PDF 生成失败，请选择 Markdown 保存。');
  } finally { await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:150}).catch(()=>{}); }
}
export async function saveAsset(data){
  if(data?.consent!==true)throw Error('请先确认保存这份资料。');
  if(typeof data.title!=='string'||!data.title.trim()||data.title.length>120)throw Error('请填写 1–120 字的标题。');
  const format=data.format;if(!['pdf','md','import-pdf'].includes(format))throw Error('仅支持 PDF 和 Markdown 学习资料。');
  await mkdir(root,{recursive:true});const id=randomUUID(),ext=format==='md'?'md':'pdf',target=path.join(root,`${id}.${ext}`);
  try {
    if(format==='import-pdf'){
      if(typeof data.base64!=='string'||data.base64.length>21000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64))throw Error('PDF 文件不合法或超过 15 MB。');
      const bytes=Buffer.from(data.base64,'base64');if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length>15*1024*1024)throw Error('请选择 15 MB 以内的有效 PDF 文件。');
      await writeFile(target,bytes,{flag:'wx'});
    }else{
      if(typeof data.content!=='string'||!data.content.trim()||data.content.length>100000)throw Error('内容需要 1–100000 字。');
      if(format==='pdf')await generatePDF(data.title,data.content,target);else await writeFile(target,`# ${data.title}\n\n${data.content}`,'utf8');
    }
    const record={id,title:data.title.trim(),format:ext,created:new Date().toISOString(),source:data.source==='learning-block'?'学习块':format==='import-pdf'?'我导入的 PDF':'对话整理',bytes:(await readFile(target)).length};
    await writeFile(path.join(root,`${id}.json`),JSON.stringify(record),'utf8');return record;
  }catch(e){await rm(target,{force:true}).catch(()=>{});throw e;}
}
export async function assetFile(id){if(!validID(id))throw Error('资料编号无效。');const d=JSON.parse(await readFile(path.join(root,`${id}.json`),'utf8'));if(!['pdf','md'].includes(d.format))throw Error('资料格式无效。');return {record:d,file:path.join(root,`${id}.${d.format}`)};}
export async function openAsset(id){const {file}=await assetFile(id);await access(file);if(process.platform!=='win32')throw Error('系统应用打开目前支持 Windows，请使用下载。');await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','Start-Process -FilePath $env:LEARNFLOW_OPEN_ASSET'],{windowsHide:true,timeout:10000,env:{...process.env,LEARNFLOW_OPEN_ASSET:file}});}
export async function removeAsset(id){const {file}=await assetFile(id);await rm(file,{force:true});await rm(path.join(root,`${id}.json`),{force:true});}
