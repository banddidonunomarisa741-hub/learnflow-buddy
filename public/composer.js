/* Raw attachments stay in this tab. Sending and saving are separate choices. */
(() => {
  let files=[],draft='',reading=false,models=[],selected='',state='未连接',detail='连接后，可以选模型、发图片。',loadingModels=null,modelSource='',attachmentStatus='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode='demo',busy=false;
  try{selected=sessionStorage.getItem('learnflow.model')||'';}catch{}
  const menu=document.createElement('dialog');menu.id='model-menu';menu.className='model-menu';menu.setAttribute('aria-labelledby','model-menu-title');document.body.append(menu);
  const family=id=>id==='auto'?'自动选择':/^hy\d|hunyuan/i.test(id)?'腾讯混元':/^glm/i.test(id)?'GLM':/^deepseek/i.test(id)?'DeepSeek':/^kimi/i.test(id)?'Kimi':/^minimax/i.test(id)?'MiniMax':'其他模型';
  const modelLabel=x=>x?.id==='auto'?'Auto · 自动选择':x?.label||x?.id||'选择模型';
  const say=text=>{attachmentStatus=text;const el=document.querySelector('#attachment-status');if(el)el.textContent=text;};
  function mount(m=mode,b=busy){
    mode=m;busy=b;const form=document.querySelector('#chat-form');if(!form)return;
    if(!document.querySelector('#composer-tools'))form.insertAdjacentHTML('afterbegin',`<div id="connection-banner" role="status" aria-live="polite"></div><div id="attachment-list"></div><div id="composer-tools"><button type="button" id="attach-files" class="attach-trigger" aria-label="添加图片或文件" title="添加图片或文件">＋</button><button type="button" id="model-trigger" aria-haspopup="dialog" aria-controls="model-menu" aria-expanded="false"></button><button type="button" class="text-link" id="composer-connection">连接设置</button><input id="chat-files" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.csv,.json" hidden></div><details class="attachment-help"><summary>图片 / 文件可拖到这里，也可直接粘贴截图</summary><p>支持 PNG、JPG、WebP、PDF、TXT、MD、CSV、JSON。每轮最多 4 份；图片每张 5 MB，文件每份 10 MB。PDF 只读取文字，扫描件请用截图。点击发送后才交给模型，保存为学习资产需另外确认。</p></details><p id="attachment-status" role="status"></p>`);
    const input=document.querySelector('#chat-input');if(input!==document.activeElement)input.value=draft;
    const trigger=document.querySelector('#model-trigger');trigger.innerHTML=`<span class="model-mark" aria-hidden="true">${selected==='auto'?'A':'F'}</span><span>${esc(models.length?modelLabel(models.find(x=>x.id===selected)):'选择模型')}</span><span class="model-chevron" aria-hidden="true">⌄</span>`;trigger.disabled=busy;trigger.setAttribute('aria-expanded',String(menu.open));
    const banner=document.querySelector('#connection-banner');banner.textContent=mode==='demo'?'当前是演示回复 · 连接后使用真实模型':`${state}${detail?' · '+detail:''}`;banner.dataset.ready=state==='连接成功'?'true':'false';banner.dataset.error=/失败|检查/.test(state)?'true':'false';
    document.querySelector('#attachment-list').innerHTML=files.map((a,i)=>`<div class="attachment-chip">${a.kind==='image'?`<img src="data:${a.mime};base64,${a.data}" alt="${esc(a.name)}预览">`:'<span class="file-mini">文档</span>'}<span><strong>${esc(a.name)}</strong><small>${esc(a.note||'发送图片原件')}</small></span><button type="button" data-remove-attachment="${i}" aria-label="移除 ${esc(a.name)}" ${busy?'disabled':''}>×</button></div>`).join('');
    document.querySelector('#attach-files').disabled=busy||reading;document.querySelector('#attachment-status').textContent=attachmentStatus;form.classList.toggle('reading-attachment',reading);
  }
  function drawOptions(query=''){
    const matches=models.filter(x=>(x.id+' '+modelLabel(x)+' '+family(x.id)).toLowerCase().includes(query.toLowerCase())),groups=[...new Set(matches.map(x=>family(x.id)))];
    menu.querySelector('#model-options').innerHTML=matches.length?groups.map(group=>`<div role="group" aria-label="${esc(group)}"><div class="model-group">${esc(group)}</div>${matches.filter(x=>family(x.id)===group).map(x=>`<button type="button" role="option" aria-selected="${x.id===selected}" data-model-id="${esc(x.id)}" class="model-option"><span class="model-mark" aria-hidden="true">${x.id==='auto'?'A':esc(group.slice(0,1))}</span><span><strong>${esc(modelLabel(x))}</strong>${modelLabel(x)!==x.id&&x.id!=='auto'?`<small>${esc(x.id)}</small>`:''}</span>${x.id===selected?'<span class="model-check" aria-hidden="true">✓</span>':''}</button>`).join('')}</div>`).join(''):'<p class="model-empty">没有找到这个模型，试试其他名字。</p>';
    menu.querySelector('#model-count').textContent=matches.length+' 个选项';
  }
  function openModels(){
    if(busy)return;if(mode!=='api'||!models.length){window.LearnFlowConnection?.open();return;}
    menu.innerHTML=`<div class="model-menu-heading"><img src="./assets/learnflow-logo.svg" alt=""><h2 id="model-menu-title">这次用哪个模型？</h2><button type="button" id="close-models" aria-label="关闭模型选择">×</button></div><input id="model-search" type="search" autocomplete="off" placeholder="搜索模型" aria-label="搜索模型"><div class="model-list-meta"><span id="model-count"></span><span>当前：${esc(selected)}</span></div><div id="model-options" role="listbox" aria-label="模型列表"></div><div class="model-menu-footer"><button type="button" id="refresh-models">↻ 刷新列表</button><details><summary>列表从哪里来？</summary><p>${esc(modelSource)}。模型是否可用、额度和费用以你的服务账号为准。</p></details></div>`;
    drawOptions();menu.showModal();const anchor=document.querySelector('#model-trigger').getBoundingClientRect();menu.style.left=Math.min(Math.max(12,anchor.left),innerWidth-menu.offsetWidth-12)+'px';menu.style.top=Math.max(12,Math.min(anchor.top-menu.offsetHeight-10,innerHeight-menu.offsetHeight-12))+'px';document.querySelector('#model-trigger').setAttribute('aria-expanded','true');menu.querySelector('#model-search').focus();
  }
  function closeModels(){menu.close();document.querySelector('#model-trigger')?.setAttribute('aria-expanded','false');document.querySelector('#model-trigger')?.focus();}
  menu.addEventListener('cancel',()=>setTimeout(()=>document.querySelector('#model-trigger')?.setAttribute('aria-expanded','false'),0));
  menu.addEventListener('click',e=>{if(e.target===menu)closeModels();});
  menu.addEventListener('keydown',e=>{const opts=[...menu.querySelectorAll('[role=option]')];let n=opts.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){if(['Home','End'].includes(e.key)&&e.target.id==='model-search')return;e.preventDefault();if(e.key==='ArrowDown')n=(n+1)%opts.length;if(e.key==='ArrowUp')n=n<0?opts.length-1:(n-1+opts.length)%opts.length;if(e.key==='Home')n=0;if(e.key==='End')n=opts.length-1;opts[n]?.focus();}if(e.key==='Enter'&&e.target.id==='model-search'){e.preventDefault();opts[0]?.click();}});
  async function refresh(){
    if(loadingModels)return loadingModels;
    loadingModels=(async()=>{try{const r=await window.learnflowFetch('/api/models');const d=await r.json();if(!r.ok)throw Error(r.status===404?'请升级本机连接助手，再读取模型列表。':d.message||'模型列表读取失败');models=Array.isArray(d.models)?d.models.filter(x=>typeof x.id==='string'):[];if(!models.some(x=>x.id===selected))selected=d.defaultModel||models[0]?.id||'';modelSource=d.source||'当前连接的模型服务';if(state!=='连接成功'&&state!=='正在验证'){state='已连接';detail='选好模型，就可以发第一条消息了';}mount();if(menu.open)drawOptions(menu.querySelector('#model-search').value);return d;}catch(e){state='连接待检查';detail=e.message||'请安装最新版连接助手后重试';mount();throw e;}finally{loadingModels=null;}})();return loadingModels;
  }
  async function verify(status=()=>{}){state='正在验证';detail='正在等模型回复…';mount();status(detail);try{await refresh();const r=await window.learnflowFetch('/api/probe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,model:selected||undefined}),signal:AbortSignal.timeout(65000)});const d=await r.json();if(!r.ok||!d.verified)throw Error(d.message||'模型没有完成验证');state='连接成功';detail=`${d.model||selected} 已回复`;status('✓ '+detail+'，现在可以开始学习。');mount();window.dispatchEvent(new CustomEvent('learnflow-verified',{detail:d}));return d;}catch(e){state='连接待检查';detail=e.message;status('这次没连上：'+e.message);mount();throw e;}}
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

  document.addEventListener('input',e=>{if(e.target.id==='chat-input')draft=e.target.value;if(e.target.id==='model-search')drawOptions(e.target.value);});
  document.addEventListener('change',e=>{if(e.target.id==='chat-files'){add([...e.target.files]);e.target.value='';}});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='attach-files')document.querySelector('#chat-files').click();if(b.id==='model-trigger')openModels();if(b.id==='close-models')closeModels();if(b.id==='composer-connection')window.LearnFlowConnection?.open();if(b.id==='refresh-models'){b.disabled=true;b.textContent='正在刷新…';refresh().catch(e=>say(e.message)).finally(()=>{b.disabled=false;b.textContent='↻ 刷新列表';});}if(b.dataset.modelId){selected=b.dataset.modelId;try{sessionStorage.setItem('learnflow.model',selected);}catch{}state='已连接';detail=`下一条消息使用 ${selected}`;closeModels();mount();}if(b.dataset.removeAttachment!==undefined&&!busy){files.splice(Number(b.dataset.removeAttachment),1);attachmentStatus='';mount();}});
  document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();document.querySelector('#chat-form')?.classList.add('dragging');}});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.querySelector('#chat-form')?.classList.remove('dragging');});
  document.addEventListener('drop',e=>{if(e.dataTransfer?.files.length){e.preventDefault();document.querySelector('#chat-form')?.classList.remove('dragging');if(document.querySelector('#chat-form'))add([...e.dataTransfer.files]);}});
  document.addEventListener('paste',e=>{if(e.target.id==='chat-input'&&e.clipboardData?.files.length){e.preventDefault();add([...e.clipboardData.files]);}});
  window.addEventListener('learnflow-connected',()=>refresh().catch(()=>{}));
  window.addEventListener('learnflow-disconnected',()=>{models=[];selected='';state='未连接';detail='可以重新连接学习助手';mount();});
  const setDraft=text=>{draft=text;const input=document.querySelector('#chat-input');if(input)input.value=text;};
  window.LearnFlowComposer={mount,refresh,verify,files:()=>files,model:()=>selected||undefined,ready:()=>!reading,clear:()=>{files=[];draft='';attachmentStatus='';},restore:(items,text)=>{files=items;setDraft(text);},setDraft,failure:message=>{state='本次请求失败';detail=message;},success:model=>{state='连接成功';detail=`${model||selected} 已回复`;window.dispatchEvent(new CustomEvent('learnflow-verified',{detail:{model:model||selected,verified:true}}));},reset:()=>{files=[];draft='';attachmentStatus='';},add};
})();
