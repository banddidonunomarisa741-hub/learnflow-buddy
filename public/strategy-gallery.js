/* A dependency-free, pointer-driven card deck. Learning data stays in app.js. */
(() => {
 'use strict';
 const palette=c=>['orange','green','blue','purple'].includes(c)?c:'orange';
 window.LearnFlowGallery={create({esc,icon,getState}){
  let selectedId='feynman',flippedId=null,layout='deck',root=null,items=[],abort=null,observer=null,raf=0;
  let position=0,target=0,speed=0,lastFrame=0,drag=null,suppressUntil=0,spacing=220;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.reducedMotion==='true';
  const clamp=n=>Math.max(0,Math.min(items.length-1,n));
  const art=c=>`<div class="sf-art sf-art--${['evidence','roots','feynman','retrieval','socratic','pbl','plain','teacher'].includes(c.id)?c.id:'custom'}" aria-hidden="true">${[1,2,3,4,5].map(n=>`<i class="art-piece p${n}"></i>`).join('')}<span class="art-glyph">${icon(c.icon)}</span></div>`;
  function card(c,i){
   const state=getState(),adopted=state.adopted.includes(c.id),fav=state.favorites.includes(c.id),title=c.title.split(/\s*·\s*/),custom=c.id.startsWith('custom-');
   const steps=c.steps?.length?c.steps:String(c.instructions||'').split(/\n+/).filter(Boolean).slice(0,3);
   return `<article class="sf-slot sf-${palette(c.color)}" data-card-id="${esc(c.id)}" role="group" aria-label="${i+1} / ${items.length}：${esc(c.title)}"><div class="sf-card"><div class="sf-flipper"><div class="sf-face sf-front"><div class="sf-card-meta"><span>${esc(c.category||'我的方法')}</span></div>${art(c)}<div class="sf-card-copy"><h2>${esc(title[0])}</h2><p class="sf-card-subtitle">${esc(title.slice(1).join(' · ')||'为自己的学习习惯而做')}</p><p class="sf-card-description">${esc(c.description)}</p></div><div class="sf-tags">${c.tags.slice(0,3).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="sf-card-actions"><button class="sf-use ${adopted?'is-on':''}" data-adopt="${esc(c.id)}" aria-pressed="${adopted}">${adopted?'✓ 正在使用':'用这个方法'} ${icon('arrow')}</button><button class="sf-heart ${fav?'is-on':''}" data-favorite="${esc(c.id)}" aria-label="${fav?'取消收藏':'收藏'}${esc(c.title)}" aria-pressed="${fav}">${icon('heart')}</button><button class="sf-flip" data-sf-flip aria-label="翻面查看做法与示例" title="翻面查看做法与示例">↻</button></div></div><div class="sf-face sf-back" aria-hidden="true" inert><div class="sf-card-meta"><span>方法背面</span></div><h2>${esc(title[0])}</h2><ol class="sf-steps">${steps.slice(0,3).map((s,n)=>`<li><span>0${n+1}</span><p>${esc(String(s).slice(0,180))}</p></li>`).join('')}</ol><button class="sf-full" data-detail="${esc(c.id)}">详细做法 · 对话示例 ${icon('arrow')}</button><div class="sf-card-stamp"><span>${esc(c.source||'我的专属策略')}</span></div><button class="sf-back-button" data-sf-flip>↶ 回到正面</button></div></div><div class="sf-sheen" aria-hidden="true"></div></div><button class="sf-select-side" data-sf-select="${i}" aria-label="选中${esc(c.title)}" tabindex="-1"></button></article>`;
  }
  function view(){return `<section class="sf-gallery" aria-label="学习策略广场"><header class="sf-heading"><div><h1>策略广场</h1></div><button class="sf-create" data-action="create-card"><span>＋</span> 新建卡片</button></header><div class="sf-browse"><label class="sf-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="strategy-search" placeholder="搜索策略" aria-label="搜索学习策略"></label><div class="sf-filters" role="group" aria-label="筛选策略"></div><button class="sf-import" data-action="import-card" title="导入 JSON 策略卡">导入</button></div><div id="market-results"></div><footer class="sf-footer"><a href="#settings/learning">管理正在使用的方法 ${icon('arrow')}</a></footer></section>`;}
  function content(){
   if(!items.length)return '<div class="sf-empty">没找到这张卡片。<p>试试别的关键词，或把自己的方法做成卡片。</p><button class="sf-create" data-action="create-card">＋ 制作卡片</button></div>';
   return `<div class="sf-stage-heading"><span><strong>${String(items.length).padStart(2,'0')}</strong> 张方法卡</span><div class="sf-layout" role="group" aria-label="卡片展示方式"><button data-sf-layout="deck" aria-pressed="${layout==='deck'}">立体展台</button><button data-sf-layout="list" aria-pressed="${layout==='list'}">全部展开</button></div></div><div class="sf-stage" role="region" aria-roledescription="轮播" aria-label="策略卡片展台，左右方向键切换，回车翻面" tabindex="0">${items.map(card).join('')}<div class="sf-stage-floor" aria-hidden="true"></div></div><div class="sf-deck-navigation"><span class="sf-gesture"><svg viewBox="0 0 32 20" aria-hidden="true"><path d="m6 6-4 4 4 4M2 10h28m-4-4 4 4-4 4"/></svg></span><div class="sf-pager"><button data-sf-step="-1" aria-label="上一张策略卡">←</button><span class="sf-counter" aria-live="polite" aria-atomic="true"></span><button data-sf-step="1" aria-label="下一张策略卡">→</button></div></div><div class="sf-rail" role="group" aria-label="直接选择策略卡">${items.map((c,i)=>`<button class="sf-rail-item sf-${palette(c.color)}" data-sf-select="${i}" aria-label="选中${esc(c.title)}"><span>${icon(c.icon)}</span>${esc(c.title.split(' · ')[0])}</button>`).join('')}</div><div class="sf-announcement" role="status" aria-live="polite"></div>`;
  }
  function paint(){
   if(!root)return;
   const active=Math.round(target),w=root.querySelector('.sf-stage')?.clientWidth||900;
   spacing=Math.min(250,Math.max(170,w*.245));
   root.querySelectorAll('.sf-slot').forEach((slot,i)=>{
    const d=i-position,a=Math.abs(d),current=i===active,flipped=current&&flippedId===items[i].id;
    slot.classList.toggle('is-current',current);slot.classList.toggle('is-flipped',flipped);
    slot.style.setProperty('--sf-x',`${d*spacing}px`);slot.style.setProperty('--sf-z',`${-a*125}px`);
    slot.style.setProperty('--sf-y',`${Math.min(a,4)*13}px`);slot.style.setProperty('--sf-ry',`${Math.max(-45,Math.min(45,-d*23))}deg`);
    slot.style.setProperty('--sf-rz',`${Math.max(-8,Math.min(8,d*3.5))}deg`);
    slot.style.zIndex=String(20-Math.round(a*2));slot.style.opacity=layout==='list'?'1':String(Math.max(0,1-Math.max(0,a-2)*.7));
    const hidden=layout==='deck'&&a>3;slot.style.visibility=hidden?'hidden':'visible';
    slot.querySelector('.sf-select-side').hidden=current||layout==='list';
    const front=slot.querySelector('.sf-front'),back=slot.querySelector('.sf-back');
    front.inert=flipped||(!current&&layout==='deck');back.inert=!flipped;
    front.setAttribute('aria-hidden',String(front.inert));back.setAttribute('aria-hidden',String(back.inert));
   });
  }
  function announce(){
   if(!items.length||!root)return;
   const i=Math.round(target);selectedId=items[i].id;
   const count=root.querySelector('.sf-counter');if(count)count.textContent=`${String(i+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
   root.querySelectorAll('.sf-rail-item').forEach((el,n)=>el.setAttribute('aria-pressed',String(n===i)));
   root.querySelectorAll('[data-sf-step]').forEach(el=>el.disabled=Number(el.dataset.sfStep)<0?i===0:i===items.length-1);
  }
  function frame(time){
   if(!root)return;const dt=Math.min(2,(time-(lastFrame||time-16.7))/16.7);lastFrame=time;
   speed+=(target-position)*.12*dt;speed*=Math.pow(.68,dt);position+=speed*dt;
   if(Math.abs(target-position)<.0007&&Math.abs(speed)<.0007){position=target;speed=0;raf=0;paint();return;}
   paint();raf=requestAnimationFrame(frame);
  }
  function go(index){
   target=clamp(index);flippedId=null;announce();if(raf)cancelAnimationFrame(raf);raf=0;lastFrame=0;
   if(reduced()||layout==='list'){position=target;speed=0;paint();}else raf=requestAnimationFrame(frame);
  }
  function resetTilt(){root?.querySelectorAll('.sf-card').forEach(el=>{el.style.setProperty('--sf-tilt-x','0deg');el.style.setProperty('--sf-tilt-y','0deg');});}
  function dispose(){abort?.abort();abort=null;observer?.disconnect();observer=null;cancelAnimationFrame(raf);raf=0;drag=null;root=null;}
  function bind(){
   const signal=abort.signal,stage=root.querySelector('.sf-stage');if(!stage)return;
   root.dataset.layout=layout;stage.tabIndex=layout==='deck'?0:-1;
   stage.setAttribute('aria-label',layout==='deck'?'策略卡片展台，左右方向键切换，回车翻面':'全部策略卡片');
   if(layout==='list')stage.removeAttribute('aria-roledescription');paint();announce();
   const pointerEnd=e=>{
    if(!drag||drag.id!==e.pointerId)return;const was=drag;drag=null;stage.classList.remove('is-dragging');
    if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
    if(was.moved){suppressUntil=performance.now()+250;const age=performance.now()-was.time,velocity=age>100?0:was.velocity*(1-age/100);const projected=position-velocity*100/spacing;go(Math.round(projected));}
   };
   stage.addEventListener('pointerdown',e=>{
    if(layout!=='deck'||e.button!==0||e.isPrimary===false||e.target.closest('button:not(.sf-select-side),a'))return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,base:position,prevX:e.clientX,time:performance.now(),velocity:0,moved:false};
    cancelAnimationFrame(raf);raf=0;speed=0;resetTilt();
   },{signal});
   stage.addEventListener('pointermove',e=>{
    if(drag&&e.pointerId===drag.id){
     const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
     if(!drag.moved&&Math.abs(dx)<7)return;
     if(!drag.moved&&Math.abs(dy)>Math.abs(dx)){drag=null;go(Math.round(target));return;}
     if(!drag.moved){drag.moved=true;stage.setPointerCapture(e.pointerId);stage.classList.add('is-dragging');stage.focus({preventScroll:true});}
     const now=performance.now(),dt=now-drag.time;if(dt>0)drag.velocity=.5*drag.velocity+.5*(e.clientX-drag.prevX)/dt;
     drag.prevX=e.clientX;drag.time=now;position=Math.max(-.22,Math.min(items.length-1+.22,drag.base-dx/spacing));target=clamp(Math.round(position));flippedId=null;paint();
    }else if(e.pointerType==='mouse'&&!reduced()){
     const slot=e.target.closest('.sf-slot.is-current');if(!slot||layout!=='deck'||slot.classList.contains('is-flipped'))return resetTilt();
     if(e.target.closest('button'))return;
     const box=slot.getBoundingClientRect(),x=(e.clientX-box.left)/box.width-.5,y=(e.clientY-box.top)/box.height-.5,cardEl=slot.querySelector('.sf-card');
     cardEl.style.setProperty('--sf-tilt-x',`${-y*9}deg`);cardEl.style.setProperty('--sf-tilt-y',`${x*12}deg`);
     cardEl.style.setProperty('--sf-light-x',`${(x+.5)*100}%`);cardEl.style.setProperty('--sf-light-y',`${(y+.5)*100}%`);
    }
   },{signal});
   stage.addEventListener('pointerleave',()=>{if(!drag)resetTilt();},{signal});
   window.addEventListener('pointerup',pointerEnd,{signal});window.addEventListener('pointercancel',e=>{if(drag){const moved=drag.moved;drag.moved=false;pointerEnd(e);if(moved)go(Math.round(position));}},{signal});
   root.addEventListener('click',e=>{
    if(performance.now()<suppressUntil){e.preventDefault();e.stopPropagation();return;}
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-sf-select')){e.preventDefault();go(Number(button.dataset.sfSelect));}
    else if(button.hasAttribute('data-sf-step'))go(Math.round(target)+Number(button.dataset.sfStep));
    else if(button.hasAttribute('data-sf-layout')){layout=button.dataset.sfLayout;update(items);root.querySelector(`[data-sf-layout="${layout}"]`)?.focus();}
    else if(button.hasAttribute('data-sf-flip')){
     cancelAnimationFrame(raf);raf=0;speed=0;resetTilt();
     const slot=button.closest('.sf-slot'),i=items.findIndex(c=>c.id===slot.dataset.cardId);target=position=i;selectedId=items[i].id;flippedId=flippedId===selectedId?null:selectedId;
     paint();announce();const activeFace=slot.querySelector(flippedId?'.sf-back':'.sf-front');activeFace.querySelector('[data-sf-flip]')?.focus({preventScroll:true});
    }
   },{signal,capture:true});
   stage.addEventListener('keydown',e=>{
    if(e.target!==stage||layout!=='deck')return;
    const keys={ArrowLeft:Math.round(target)-1,ArrowRight:Math.round(target)+1,Home:0,End:items.length-1};
    if(Object.hasOwn(keys,e.key)){e.preventDefault();go(keys[e.key]);}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();cancelAnimationFrame(raf);raf=0;speed=0;position=target;resetTilt();flippedId=flippedId===selectedId?null:selectedId;paint();root.querySelector('.sf-announcement').textContent=`${items[Math.round(target)].title}，${flippedId?'背面：'+(items[Math.round(target)].steps||[]).join('；'):'正面'}`;}
   },{signal});
   observer=new ResizeObserver(()=>{resetTilt();paint();});observer.observe(stage);
  }
  function update(list){
   items=list;abort?.abort();observer?.disconnect();cancelAnimationFrame(raf);raf=0;drag=null;abort=new AbortController();
   const oldIndex=items.findIndex(c=>c.id===selectedId);target=position=oldIndex<0?0:oldIndex;speed=0;
   const results=root?.querySelector('#market-results');if(!results)return;results.innerHTML=content();root.dataset.layout=layout;
   bind();
  }
  function mount(list,{filter,query}){
   dispose();root=document.querySelector('.sf-gallery');if(!root)return;
   root.querySelector('#strategy-search').value=query;
   root.querySelector('.sf-filters').innerHTML=[['all','全部'],['exam','应试'],['self','自学'],['project','项目'],['style','表达'],['favorite','收藏']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('');
   update(list);
  }
  return {view,mount,update,dispose,select(id){selectedId=id;flippedId=null;}};
 }};
})();
