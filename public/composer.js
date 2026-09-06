/* Attachments stay in this tab until Send. Raw bytes are never saved in backups. */
(() => {
  let files=[],draft='',reading=false,models=[],selected='',state='未连接',detail='连接后可选择模型、发送图片和资料。',loadingModels=false;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode='demo',busy=false;
  const say=text=>{const el=document.querySelector('#attachment-status');if(el)el.textContent=text;};
  function mount(m=mode,b=busy){
    mode=m;busy=b;const form=document.querySelector('#chat-form');if(!form)return;
    if(!document.querySelector('#composer-tools'))form.insertAdjacentHTML('afterbegin',`<div id="connection-banner" role="status" aria-live="polite"></div><div id="composer-tools"><label>模型 <select id="model-select" aria-label="选择学习模型"></select></label><button type="button" class="text-link" id="refresh-models">刷新列表</button><button type="button" class="secondary" id="attach-files">＋ 图片 / 文件</button><input id="chat-files" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.csv,.json" hidden></div><div id="attachment-list"></div><p class="attachment-help">拖拽图片或资料到输入框，也可粘贴截图 · PNG / JPG / WebP / PDF / TXT / MD / CSV / JSON<br>每轮最多 4 个；图片每张 5 MB，文件每个 10 MB。点击发送才交给模型，不会自动保存为学习资产。</p><p id="attachment-status" role="status"></p>`);
    const input=document.querySelector('#chat-input');if(input!==document.activeElement)input.value=draft;
    const select=document.querySelector('#model-select');select.innerHTML=models.length?models.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.label)}</option>`).join(''):'<option>连接后加载模型</option>';select.disabled=busy||!models.length||mode!=='api';
    document.querySelector('#connection-banner').textContent=mode==='demo'?'预设演示 · 连接后可读取附件':`${state} · ${detail}`;
    document.querySelector('#connection-banner').dataset.ready=state==='连接成功'?'true':'false';
    document.querySelector('#attachment-list').innerHTML=files.map((a,i)=>`<div class="attachment-chip">${a.kind==='image'?`<img src="data:${a.mime};base64,${a.data}" alt="附件预览">`:'<span>文档</span>'}<span><strong>${esc(a.name)}</strong><small>${esc(a.note||'图片原件将发送给模型')}</small></span><button type="button" data-remove-attachment="${i}" aria-label="移除 ${esc(a.name)}" ${busy?'disabled':''}>×</button></div>`).join('');
    document.querySelector('#attach-files').disabled=busy||reading;
    form.classList.toggle('reading-attachment',reading);
  }
  async function refresh(){loadingModels=true;try{const r=await window.learnflowFetch('/api/models');const d=await r.json();if(!r.ok)throw Error(r.status===404?'本机连接助手需要升级，请下载最新版并运行安装连接助手.cmd。':d.message||'模型列表读取失败');models=d.models;if(!models.some(x=>x.id===selected))selected=d.defaultModel;detail=d.source;state='已授权';mount();return d;}catch(e){state='连接待检查';detail=e.message||'请安装最新版连接助手后重试';mount();throw e;}finally{loadingModels=false;}}
  async function verify(status=()=>{}){state='正在验证';detail='正在请求一次简短回复，请稍候…';mount();status(detail);try{await refresh();state='正在验证';mount();const r=await window.learnflowFetch('/api/probe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,model:selected||undefined}),signal:AbortSignal.timeout(65000)});const d=await r.json();if(!r.ok||!d.verified)throw Error(d.message||'模型未完成验证');state='连接成功';detail=`${d.model||selected} 已实际回复，可以开始学习`;status('✓ '+detail);mount();window.dispatchEvent(new CustomEvent('learnflow-verified',{detail:d}));return d;}catch(e){state='连接待检查';detail=e.message;status('连接尚不可用：'+e.message);mount();throw e;}}
  async function add(incoming){if(busy||reading)return;reading=true;mount();say('正在本机读取资料…');const errors=[];try{for(const f of incoming){try{
    if(files.length>=4)throw Error('每轮最多 4 个附件，请先移除一些。');if(f.size>10*1024*1024)throw Error('文件超过 10 MB，请拆分。');let a;
    if(/\.(png|jpe?g|webp)$/i.test(f.name)||['image/png','image/jpeg','image/webp'].includes(f.type)){
      if(f.size>5*1024*1024)throw Error('图片超过 5 MB，请缩小后再试。');const mime=f.type||(/\.png$/i.test(f.name)?'image/png':/\.webp$/i.test(f.name)?'image/webp':'image/jpeg');
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('图片读取失败'));r.readAsDataURL(f);});a={kind:'image',name:f.name,mime,data};
    }else if(/\.pdf$/i.test(f.name)){
      const pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',location.href).href;
      const task=pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false});let pdf;
      try{pdf=await task.promise;let text='';let read=0;for(let n=1;n<=Math.min(pdf.numPages,30);n++){const p=await pdf.getPage(n);const t=await p.getTextContent();text+=`\n[第 ${n} 页]\n`+t.items.map(x=>x.str||'').join(' ');read=n;if(text.length>60000)break;}if(text.replace(/\[第 \d+ 页\]/g,'').trim().length<10)throw Error('未读取到正文，可能是扫描版 PDF；请改为上传页面截图。');a={kind:'text',name:f.name,text:text.slice(0,60000),note:`已提取 ${read}/${pdf.numPages} 页文字${text.length>60000?'，截取前 60000 字符':''}；不含图片与版式`};}finally{await task.destroy();}
    }else if(/\.(txt|md|csv|json)$/i.test(f.name)){const text=await f.text();if(!text.trim())throw Error('文件没有文字。');a={kind:'text',name:f.name,text:text.slice(0,60000),note:text.length>60000?'仅发送前 60000 字符':'已读取全文文字'};}
    else throw Error('暂不支持此格式。Word / PPT 请先导出 PDF；扫描件请用截图。');
    if(JSON.stringify([...files,a]).length>15500000)throw Error('本轮附件总量过大，请分两次发送。');files.push(a);
  }catch(e){errors.push(`${f.name}：${e.message}`);}}}finally{reading=false;mount();say(errors.join('\n')||`已准备 ${files.length} 个附件，确认后点击发送。`);}}
  document.addEventListener('input',e=>{if(e.target.id==='chat-input')draft=e.target.value;});
  document.addEventListener('change',e=>{if(e.target.id==='chat-files'){add([...e.target.files]);e.target.value='';}if(e.target.id==='model-select'){selected=e.target.value;state='已授权';detail=`下一条消息使用 ${selected}；切换不改变学习策略`;mount();}});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='attach-files')document.querySelector('#chat-files').click();if(b.id==='refresh-models')refresh().catch(()=>{});if(b.dataset.removeAttachment!==undefined&&!busy){files.splice(Number(b.dataset.removeAttachment),1);mount();}});
  document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();document.querySelector('#chat-form')?.classList.add('dragging');}});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.querySelector('#chat-form')?.classList.remove('dragging');});
  document.addEventListener('drop',e=>{if(e.dataTransfer?.files.length){e.preventDefault();document.querySelector('#chat-form')?.classList.remove('dragging');if(document.querySelector('#chat-form'))add([...e.dataTransfer.files]);}});
  document.addEventListener('paste',e=>{if(e.target.id==='chat-input'&&e.clipboardData?.files.length){e.preventDefault();add([...e.clipboardData.files]);}});
  window.addEventListener('learnflow-connected',()=>refresh().catch(()=>{}));
  window.addEventListener('learnflow-disconnected',()=>{models=[];selected='';state='未连接';detail='请重新连接学习助手';mount();});
  window.LearnFlowComposer={mount,refresh,verify,files:()=>files,model:()=>selected||undefined,ready:()=>!reading,clear:()=>{files=[];draft='';},restore:(items,text)=>{files=items;draft=text;},failure:message=>{state='本次请求失败';detail=message;},success:model=>{state='连接成功';detail=`${model||selected} 已实际回复`;},reset:()=>{files=[];draft='';},add};
})();
