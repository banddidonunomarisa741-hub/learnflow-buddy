/* Personal strategies, explicit sharing, and feedback tied to content versions. */
(() => {
 'use strict';
 window.LearnFlowLibrary={create(ctx){
  const {esc,icon,getState,cards,save,render,toast,showModal,modalHead,download,navigate,edit,start,exportSkill}=ctx;
  const L=window.LearnFlowLedger, by=id=>cards().find(c=>c.id===id), store=()=>getState().ledger;
  const num=n=>Number(n||0).toLocaleString('zh-CN'), short=v=>String(v||'').slice(-8);
  const when=t=>t?new Date(t).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'还没使用';
  const id=prefix=>prefix+'-'+crypto.randomUUID();
  let tab='adopted',search='',pending=[];
  const button=(action,key,label,primary=false)=>`<button class="${primary?'primary':'secondary'}" data-library="${action}" data-card="${esc(key||'')}">${label}</button>`;
  const portable=c=>L.exportableCard({...c,id:c.origin?.version===L.cardVersion(c)?c.origin.id:c.id});
  const feedbackFor=c=>store().feedback.filter(f=>f.cardId===c.id&&f.version===L.cardVersion(c));
  function previousFeedback(c){const rows=store().feedback.filter(f=>f.cardId===c.id&&f.version!==L.cardVersion(c)).slice().reverse();return rows.length?`<details class="sl-rules"><summary>之前版本的反馈 · ${rows.length} 条</summary>${rows.map(f=>`<article><strong>${short(f.version)} · ${f.rating} / 5</strong><p>${esc(f.note||'没有补充文字')}</p><span>${f.source==='local'?'我的反馈':'外部自述'} · ${when(f.at)}</span></article>`).join('')}</details>`:'';}
  const weight=n=>Math.min(1,Math.log1p(n)/Math.log(10001));
  function stats(s){return `<div class="sl-stats"><div><strong>${num(s.totalCalls)}</strong><span>完成的回复</span></div><div><strong>${num(s.actualTokens)}</strong><span>模型返回 Token</span></div><div><strong>${num(s.estimatedTokens)}</strong><span>演示估算 Token</span></div><div><strong>${num(s.unknownCalls)}</strong><span>未返回用量的回复</span></div></div>`;}
  function rules(){return `<details class="sl-rules"><summary>记录怎么算，分享带走什么？</summary><p>这里只统计此浏览器保留的记录。模型返回的是整轮用量；多张策略共同参与时，按张数等额分摊，不能测出某张卡单独消耗了多少。演示估算单列，未返回的用量保持未知；中断或失败的请求可能仍产生费用，不计入完成回复。Token 不代表掌握程度或积分。</p><p>分享链接和卡片文件只包含方法内容。对话、记忆、模型凭证和使用记录不会随卡片发送。反馈另行导出，需自己转交；没有公开评分榜或自动同步。</p>${store().truncated?'<p>已达到本机记录上限，下方显示最近保留的记录。</p>':''}${Object.values(getState().usage||{}).some(u=>u.actual||u.estimated)?'<p>旧版累计量仍保留在完整备份中；缺少逐轮与版本证据的旧记录不会补算到这里。</p>':''}</details>`;}
  function row(c){
   const active=getState().adopted.includes(c.id),s=L.summary(store(),c.id),v=L.cardVersion(c),f=feedbackFor(c).filter(x=>x.source==='local').at(-1);
   const whole=store().events.filter(e=>e.source==='provider').reduce((n,e)=>n+e.allocations.reduce((a,b)=>a+(b.tokens||0),0),0),share=whole?s.actualTokens/whole*100:0;
   return `<article class="sl-card"><div class="sl-card-top"><span class="sl-symbol">${icon(c.icon)}</span><span class="sl-badge">${active?'已启用':'已停用'}</span><span class="sl-version">${c.origin?'来自分享':c.id.startsWith('custom-')?'我的版本':'预置策略'} · ${short(v)}</span></div><button class="sl-title" data-detail="${esc(c.id)}">${esc(c.title)}</button><p class="sl-description">${esc(c.description)}</p><div class="sl-card-usage"><strong>${num(s.actualTokens)} <span>Token 分摊</span></strong><span>${s.totalCalls} 次回复 · ${f?'我的评分 '+f.rating+' / 5':'待写反馈'}</span></div><div class="sl-meter" role="meter" aria-label="本机模型用量占比" aria-valuenow="${share.toFixed(1)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${share}%"></i></div><div class="sl-card-tools">${button('use',c.id,'开始学习',true)}${button('history',c.id,'记录')}${button('share',c.id,'分享')}<button class="sl-more" data-detail="${esc(c.id)}" aria-label="查看${esc(c.title)}详情">···</button></div></article>`;
  }
  function view(){
   const s=getState();let list=cards().filter(c=>tab==='adopted'?s.adopted.includes(c.id):tab==='created'?c.id.startsWith('custom-'):tab==='favorites'?s.favorites.includes(c.id):true);
   if(search)list=list.filter(c=>[c.title,c.description,...c.tags].join(' ').toLowerCase().includes(search.toLowerCase()));
   return `<section class="sl-library"><header class="sl-heading"><h1>我的策略</h1><div>${button('import','','导入')}<button class="primary" data-action="create-card">＋ 新建卡片</button></div></header>${stats(L.summary(store()))}<div class="sl-toolbar"><div class="sl-tabs" role="group" aria-label="我的策略分类">${[['adopted','已启用'],['created','我制作的'],['favorites','收藏'],['all','全部卡片']].map(([key,title])=>`<button data-library="tab" data-card="${key}" aria-pressed="${tab===key}">${title}</button>`).join('')}</div><label class="sl-search">${icon('scan')}<input id="library-search" type="search" placeholder="找一张卡片" aria-label="搜索我的策略" value="${esc(search)}"></label></div><div class="sl-grid">${list.map(row).join('')||'<div class="sl-empty">这里还没有卡片。<a href="#market">去策略广场看看 →</a></div>'}</div><div class="sl-bottom">${button('history','','全部使用记录')}${button('export-adopted','','导出已启用卡片')}<a href="#market">策略广场 ${icon('arrow')}</a></div>${rules()}</section>`;
  }
  function tools(c){const s=L.summary(store(),c.id,L.cardVersion(c));return `<section class="sl-detail"><div class="sl-detail-line"><strong>这一版的使用</strong><span>${short(L.cardVersion(c))}</span></div><p>${s.totalCalls} 次回复 · ${num(s.actualTokens)} Token 分摊${s.unknownCalls?' · '+s.unknownCalls+' 次用量未知':''}</p>${c.parent?`<details class="sl-rules"><summary>从哪个版本改过来？</summary><p>来源编号 ${esc(c.parent.id)} · ${esc(c.parent.version)}。版本指纹标记内容变化，不证明作者身份。</p></details>`:''}<div class="button-row">${button('use',c.id,'用它开始学习',true)}${button('history',c.id,'使用记录')}${button('feedback',c.id,'写反馈')}${button('share',c.id,'分享卡片')}${button('fork',c.id,'改成我的版本')}</div></section>`;}
  function history(key=''){
   const c=by(key),s=L.summary(store(),c?.id),events=store().events.filter(e=>!c||e.strategies.some(a=>a.id===c.id)).slice().reverse();
   showModal(modalHead(c?c.title+' · 使用记录':'使用记录')+`<div class="sl-dialog">${stats(s)}<div class="sl-log">${events.slice(0,80).map(e=>{const a=c?e.allocations.find(a=>a.id===c.id):null;return `<article><div><strong>${esc(e.model|| (e.source==='estimated'?'预设演示':'模型未标明'))}</strong><time>${when(e.at)}</time></div><div><span>${e.source==='provider'?'模型返回':e.source==='estimated'?'演示估算':'用量未知'}${a?' · 分摊':''}</span><b>${e.tokens===null?'未返回':num(a?a.tokens:e.tokens)+' Token'}</b></div><details><summary>${e.strategies.length} 张参与策略${a?' · '+short(a.version):''}</summary><ul>${e.allocations.map(x=>`<li>${esc(x.title)} · ${short(x.version)} · ${x.tokens===null?'用量未知':num(x.tokens)+' Token 分摊'}</li>`).join('')}</ul></details></article>`;}).join('')||'<div class="sl-empty">完成一次学习后，记录会出现在这里。</div>'}</div>${events.length>80?'<p>窗口展示最近 80 条；导出文件包含全部保留记录。</p>':''}${s.selfReported.totalCalls?`<details class="sl-rules"><summary>备份恢复记录 · ${s.selfReported.totalCalls} 次（自述）</summary><p>自述模型量 ${num(s.selfReported.reportedProviderTokens)} Token；未纳入上方本机用量。</p>${store().selfReportedEvents.filter(e=>!c||e.strategies.some(x=>x.id===c.id)).slice(-80).reverse().map(e=>`<p>${when(e.at)} · ${esc(e.model||'未标明模型')} · ${e.tokens===null?'用量未知':num(c?e.allocations.find(x=>x.id===c.id).tokens:e.tokens)+' Token'} · 自述</p>`).join('')}</details>`:''}${button('export-usage',c?.id||'','导出这些记录')}${rules()}</div>`);
  }
  function share(key){
   const c=by(key);if(!c)return;let url='',error='';
   try{const base=new URL(location.href);base.hash='';base.search='';if(base.protocol==='file:'||['localhost','127.0.0.1','[::1]'].includes(base.hostname))base.href='https://banddidonunomarisa741-hub.github.io/learnflow-buddy/';url=base.href+'#share='+L.encodeShare(portable(c));}catch(e){error=e.message;}
   showModal(modalHead('分享这张方法卡')+`<div class="sl-dialog"><h3>${esc(c.title)}</h3><p>发给朋友，对方打开后可以先看做法，再决定是否采纳。</p><details class="sl-rules"><summary>检查将要分享的内容</summary><p>${esc(c.description)}</p><pre>${esc(c.instructions)}</pre><p>${esc(c.tags.join(' · '))}</p>${c.examples?.length?'<h4>示例</h4>'+c.examples.map(x=>`<pre>${esc(x)}</pre>`).join(''):''}${c.limits?`<h4>适用边界</h4><p>${esc(c.limits)}</p>`:''}${c.evidence?`<h4>依据</h4><p>${esc(c.evidence)}</p>`:''}</details>${url?`<label class="field">卡片链接<textarea id="sl-share-url" readonly rows="2">${esc(url)}</textarea></label><button class="primary" data-library="copy-link">复制分享链接</button>`:`<p role="status">${esc(error)}</p>`}<div class="button-row">${button('export-card',key,'下载卡片 JSON')}${button('export-skill',key,'下载 SKILL.md')}</div><p class="sl-privacy">只分享这张卡，不附带对话、用量记录或个人记忆。</p></div>`);
  }
  function preview(input){
   const raw=Array.isArray(input)?input:[input?.type==='learnflow-strategy'?input.card:input];
   if(!raw.length||raw.length>50)throw Error('请一次导入 1–50 张卡片。');
   pending=raw.map((c,i)=>L.exportableCard({...c,id:c.id||'shared-'+i}));
   for(const c of pending)if(!['exam','self','project','all'].includes(c.scene))throw Error('这张卡的学习场景无法识别。');
   showModal(modalHead(pending.length===1?'收到一张方法卡':'收到 '+pending.length+' 张方法卡')+`<div class="sl-dialog"><p>先看看具体做法。确认后才会加入你的策略。</p>${pending.map(c=>`<section class="sl-import-card"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="tags">${c.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><details ${pending.length===1?'open':''}><summary>完整做法 · ${short(c.version)}</summary><pre>${esc(c.instructions)}</pre>${c.evidence?`<p>${esc(c.evidence)}</p>`:''}${c.examples?.map(t=>`<p>${esc(t)}</p>`).join('')||''}${c.limits?`<p>${esc(c.limits)}</p>`:''}</details></section>`).join('')}<div class="button-row">${button('accept','','确认采纳',true)}<button class="secondary" data-action="close">先不添加</button></div></div>`);
  }
  function accept(){
   const chosen=[];for(const c of pending){
    let match=cards().find(local=>L.cardVersion(local)===c.version&&(local.id===c.id||local.origin?.id===c.id));
    if(!match){match={...c,id:id('custom'),origin:{id:c.id,version:c.version},category:LF_SCENES[c.scene]?.title||'交流风格',source:'分享导入'};getState().custom.push(match);}
    if(!getState().adopted.includes(match.id))getState().adopted.push(match.id);chosen.push(match.id);
   }
   pending=[];save();document.querySelector('#modal').close();tab='adopted';navigate('my-strategies');render();toast('已采纳，可以直接开始学习。');
  }
  function feedback(key){
   const c=by(key);if(!c)return;const v=L.cardVersion(c),s=L.summary(store(),key,v),list=feedbackFor(c).slice().reverse();
   showModal(modalHead('这个方法用起来怎样？')+`<div class="sl-dialog"><h3>${esc(c.title)}</h3><form id="sl-feedback-form" data-card="${esc(key)}"><fieldset class="sl-choice"><legend>给这一版打个分</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}" required><span>${n} ★</span></label>`).join('')}</fieldset><fieldset class="sl-choice"><legend>对这次学习有帮助吗？</legend>${[['yes','有帮助'],['partly','有一部分'],['no','没帮上']].map(([value,label])=>`<label><input type="radio" name="helped" value="${value}" required><span>${label}</span></label>`).join('')}</fieldset><label class="field">具体是哪一步？<textarea name="note" maxlength="1000" rows="3" placeholder="比如：先猜词义很有用，但我希望一次只练三个词。"></textarea></label><button class="primary" type="submit">保存我的反馈</button></form><details class="sl-rules"><summary>本次反馈关联的使用依据</summary><p>当前版本 ${short(v)}；${s.totalCalls} 次回复，${num(s.actualTokens)} Token 模型用量分摊。参考权重 ${weight(s.actualTokens).toFixed(2)}，计算为 min(1, log(1 + 模型分摊量) / log(10001))。演示不增加权重；这个数只提示使用背景，不给学习效果打分，也不抵御篡改。</p></details><section class="sl-feedback-list"><h3>这一版的反馈</h3>${list.map(f=>`<article><strong>${f.rating} / 5 · ${{yes:'有帮助',partly:'有一部分',no:'没帮上'}[f.helped]}</strong><span>${f.source==='local'?'我的反馈':'外部反馈 · 自述'} · ${when(f.at)}</span><p>${esc(f.note||'没有补充文字')}</p>${f.source==='local'?button('export-feedback',f.id,'导出这条反馈'):''}</article>`).join('')||'<p>还没有反馈。</p>'}</section>${previousFeedback(c)}${button('import-feedback',key,'导入别人发来的反馈')}</div>`);
  }
  function pick(handler){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>1000000)throw Error('文件超过 1 MB，请精简后再导入。');await handler(JSON.parse(await file.text()));}catch(e){toast('没有导入：'+e.message);}};input.click();}
  function importFeedback(key){
   pick(data=>{const c=by(key);if(!c||data.type!=='learnflow-feedback'||data.version!==1||!data.feedback)throw Error('这不是 LearnFlow 反馈文件。');
    const f=data.feedback,shared=portable(c);if(f.cardId!==shared.id||f.version!==L.cardVersion(c))throw Error('这条反馈属于另一张卡或另一版本，请先找到对应的卡片。');
    const clean=L.addFeedback(L.normalizeStore(),{...f,cardId:key},{imported:true});
    showModal(modalHead('导入这条反馈？')+`<div class="sl-dialog"><h3>${clean.rating} / 5 · 外部反馈</h3><p>${esc(clean.note||'没有补充文字')}</p><p>这是文件提供者的自述，用量未经核验，不增加本机使用量或权重。</p><button id="sl-confirm-feedback" class="primary">确认导入</button></div>`);
    document.querySelector('#sl-confirm-feedback').onclick=()=>{L.addFeedback(store(),clean,{imported:true});save();feedback(key);toast('已保存外部反馈。');};
   });
  }
  function exportFeedback(key){const f=store().feedback.find(f=>f.id===key),c=f&&by(f.cardId);if(!f||!c)return;const cId=portable(c).id;showModal(modalHead('分享这条反馈')+`<div class="sl-dialog"><p>${esc(f.note||'没有补充文字')}</p><p>文件包含评分、文字、策略版本、时间和当时的用量汇总，不包含对话。对方导入时会标为“外部反馈 · 自述”。</p><button class="primary" id="sl-download-feedback">确认下载反馈文件</button></div>`);document.querySelector('#sl-download-feedback').onclick=()=>download('learnflow-feedback.json',JSON.stringify({type:'learnflow-feedback',version:1,feedback:{...f,cardId:cId,source:'imported-self-report',verifiedUsage:false}},null,2),'application/json');}
  function fromHash(){if(!location.hash.startsWith('#share='))return false;try{preview(L.decodeShare(location.hash));}catch(e){showModal(modalHead('这张卡没有打开')+`<p class="modal-copy">${esc(e.message)}</p><button class="primary" data-action="close">关闭</button>`);}historyReplace();return true;}
  function historyReplace(){window.history.replaceState(null,'',location.pathname+location.search+'#market');}
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-library]');if(!b)return;e.preventDefault();const key=b.dataset.card||'',c=by(key);try{switch(b.dataset.library){
   case 'tab':tab=key;render();break;
   case 'history':history(key);break;
   case 'share':share(key);break;
   case 'feedback':feedback(key);break;
   case 'fork':if(c){const p=portable(c);edit({...c,id:undefined,origin:undefined,parent:{id:p.id,version:p.version},title:(c.title+' · 我的版本').slice(0,60)});}break;
   case 'use':if(c)start(c);break;
   case 'import':pick(preview);break;
   case 'accept':accept();break;
   case 'copy-link':{const field=document.querySelector('#sl-share-url');try{await navigator.clipboard.writeText(field.value);b.textContent='已复制';toast('链接已复制。');}catch{field.focus();field.select();toast('请按 Ctrl+C 复制选中的链接。');}break;}
   case 'export-card':if(c)download('learnflow-strategy.json',JSON.stringify({type:'learnflow-strategy',version:1,card:portable(c)},null,2),'application/json');break;
   case 'export-skill':if(c)download('SKILL.md',exportSkill(c));break;
   case 'export-adopted':download('learnflow-strategies.json',JSON.stringify(cards().filter(c=>getState().adopted.includes(c.id)).map(portable),null,2),'application/json');break;
   case 'export-usage':download('learnflow-usage.json',JSON.stringify({type:'learnflow-usage',version:1,scope:'retained-local-events',truncated:store().truncated,events:store().events.filter(e=>!c||e.strategies.some(s=>s.id===c.id)),selfReportedEvents:store().selfReportedEvents.filter(e=>!c||e.strategies.some(s=>s.id===c.id))},null,2),'application/json');break;
   case 'import-feedback':importFeedback(key);break;
   case 'export-feedback':exportFeedback(key);break;
  }}catch(error){toast(error.message);}});
  document.addEventListener('input',e=>{if(e.target.id!=='library-search')return;search=e.target.value;const caret=e.target.selectionStart;render();const field=document.querySelector('#library-search');field?.focus();try{field?.setSelectionRange(caret,caret);}catch{}});
  document.addEventListener('submit',e=>{if(e.target.id!=='sl-feedback-form')return;e.preventDefault();try{const c=by(e.target.dataset.card),f=new FormData(e.target);L.addFeedback(store(),{cardId:c.id,version:L.cardVersion(c),rating:Number(f.get('rating')),helped:f.get('helped'),note:f.get('note')});getState().ratings[c.id]=Number(f.get('rating'));save();render();feedback(c.id);toast('反馈已保存到这一版。');}catch(error){toast(error.message);}});
  return {view,tools,share,preview,fromHash,importCards:()=>pick(preview),portable,history};
 }};
})();
