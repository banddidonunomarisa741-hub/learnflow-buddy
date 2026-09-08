(() => {
 const local=['127.0.0.1','localhost'].includes(location.hostname)&&location.protocol==='http:';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=document.createElement('dialog');dialog.id='connection-dialog';dialog.className='connection-dialog';document.body.append(dialog);
 const button=document.createElement('button');button.className='secondary';button.textContent='连接学习助手';document.querySelector('.top-actions').prepend(button);
 let running=false,verificationAbort=null;
 async function health(){if(!local)return window.LearnFlowBridge?.health();try{const r=await fetch('/api/health',{signal:AbortSignal.timeout(3500)});const d=await r.json();return d.service==='LearnFlow local adapter'?d:null;}catch{return null;}}
 const status=text=>{const el=dialog.querySelector('#connection-status');if(el)el.textContent=text;};
 function proof(data){
  dialog.querySelector('.connection-proof')?.remove();if(!data?.verified)return;
  const tokens=data.usage?.source==='provider'&&Number.isFinite(data.usage.total_tokens)?data.usage.total_tokens.toLocaleString()+(data.usage.basis==='reported_input_plus_output'?'（接口输入＋输出）':'（服务报告）'):'服务未提供';
  dialog.insertAdjacentHTML('beforeend',`<section class="connection-proof"><h3>✓ 收到了真实校验回答</h3><dl><dt>调用入口</dt><dd>${esc(data.clientName||'当前模型服务')}</dd><dt>请求模型</dt><dd>${esc(data.requestedModel||data.model)}</dd><dt>返回模型</dt><dd>${esc(data.model||'服务未提供')}</dd><dt>等待时间</dt><dd>${(Number(data.latencyMs||0)/1000).toFixed(1)} 秒</dd><dt>Token 用量</dt><dd>${tokens}</dd><dt>验证时间</dt><dd>${esc(new Date(data.checkedAt||Date.now()).toLocaleString())}</dd></dl><p>模型实际返回：</p><pre>${esc(data.response||'已收到校验回答。')}</pre><small>每次使用新的校验码。这里只证明这个入口和本次模型请求成功，不代表列表中的所有模型都可用。</small></section>`);
 }
 async function task(fn){if(running)return;running=true;dialog.querySelectorAll('button:not(#connection-close)').forEach(b=>b.disabled=true);try{await fn();}catch(e){status(e.name==='AbortError'?'已停止验证。':'未完成：'+e.message);button.textContent='连接待检查';dialog.querySelector('.connection-proof')?.remove();}finally{running=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 async function verify(auto=false){
  dialog.querySelector('.connection-proof')?.remove();dialog.querySelector('#begin-connected')?.remove();
  if(auto)window.LearnFlowComposer.select('auto');
  window.dispatchEvent(new Event('learnflow-connected'));button.textContent='正在验证模型…';verificationAbort=new AbortController();
  try{const d=await window.LearnFlowComposer.verify(status,{signal:verificationAbort.signal});proof(d);button.textContent='✓ 模型已实际回复';dialog.classList.add('is-verified');const form=dialog.querySelector('#connection-form');if(form)form.hidden=true;
   dialog.insertAdjacentHTML('beforeend','<div class="connection-actions"><button class="primary" id="begin-connected">开始学习 →</button><button class="secondary" id="change-client-again">换一个入口</button></div>');
   dialog.querySelector('#begin-connected').onclick=()=>{dialog.close();location.hash='session';document.querySelector('#chat-input')?.focus();};return d;
  }finally{verificationAbort=null;}
 }
 async function open(){
  if(running){if(!dialog.open)dialog.showModal();return;}
  const h=await health();dialog.classList.remove('is-verified');
  dialog.innerHTML=`<img class="connection-logo" src="./assets/learnflow-logo.svg" alt="LearnFlow"><button class="secondary" id="connection-close">关闭</button><h2>用你自己的模型学习</h2><p>选择本机客户端，同意后发一条带校验码的测试。收到真实回答，才显示验证成功。</p><p class="connection-result" id="connection-status" role="status" aria-live="polite"></p>`;
  if(local&&h){
   const clients=h.clients|| (h.localCLIAvailable?[{id:'',name:'WorkBuddy',method:'内置 CodeBuddy 命令行'}]:[]);
   dialog.insertAdjacentHTML('beforeend',`<form id="connection-form">${clients.length?`<fieldset class="connection-clients"><legend>本机可用的调用入口</legend>${clients.map((c,i)=>`<label class="connection-client"><input type="radio" name="clientId" value="${esc(c.id)}" ${h.selectedClientId?c.id===h.selectedClientId?'checked':'':i===0?'checked':''}><span><strong>${esc(c.name)}</strong></span></label>`).join('')}</fieldset>`:'<p>未检测到支持的客户端命令行。可以先打开 WorkBuddy / LearnBuddy，再重启连接助手，或使用自己的模型接口。</p>'}<details ${clients.length?'':'open'}><summary>使用自己的模型接口</summary><label><input type="checkbox" id="use-compatible" ${clients.length?'':'checked'}> 使用 OpenAI 兼容接口</label><label>接口地址<input name="base" placeholder="https://你的服务/v1" autocomplete="off"></label><label>默认模型<input name="model" placeholder="服务商提供的模型名称" autocomplete="off"></label><label>API Key<input name="key" type="password" autocomplete="new-password"></label></details><p class="connection-consent">点击即同意：发送你本次输入的对话、所选附件、策略和允许使用的记忆；测试与学习均使用该账号额度。通过客户端命令行使用它已有的登录状态，网页不会读取客户端密码或令牌。更换入口会影响本机其他已配对的 LearnFlow 网页。</p><div class="connection-actions"><button class="primary" type="submit">同意，连接并测试 Auto</button>${h.configured?'<button class="secondary" type="button" id="verify-connection">测试当前模型</button>':''}</div></form>`);
   dialog.querySelector('#connection-form').onsubmit=e=>{e.preventDefault();task(async()=>{const form=e.target,data=Object.fromEntries(new FormData(form));data.provider=dialog.querySelector('#use-compatible').checked?'openai-compatible':'local-codebuddy';data.consent=true;if(!data.clientId)delete data.clientId;const r=await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();form.elements.key.value='';if(!r.ok)throw Error(d.message);window.LearnFlowComposer.resetVerification();window.dispatchEvent(new Event('learnflow-connected'));await window.LearnFlowComposer.refresh();await verify(data.provider==='local-codebuddy');});};
  }else if(h?.configured){
   dialog.insertAdjacentHTML('beforeend',`<p class="connection-current">已获本机访问许可 · <strong>${esc(h.clientName||h.provider)}</strong><br>当前模型：${esc(window.LearnFlowComposer.model()||'Auto')}</p><p class="connection-consent">验证会发送一条简短测试并使用账号额度。也可以改用 Auto；更换后不会继续使用刚才选择的模型。</p><div class="connection-actions"><button class="primary" id="verify-connection">测试当前模型</button><button class="secondary" id="verify-auto">改用 Auto 测试</button><button class="secondary" id="pair-from-web">更换本机入口</button></div>`);
  }else{
   dialog.insertAdjacentHTML('beforeend','<div class="connection-actions"><button class="primary" id="pair-from-web">同意，连接本机并测试</button></div><p class="connection-consent">会打开本机确认窗口，由你选择 WorkBuddy、CodeBuddy 或 LearnBuddy 的可用入口。确认后自动回到这里测试，使用客户端账号额度。</p><details><summary>第一次使用 / 没有弹出窗口？</summary><ol><li><a href="./downloads/learnflow-connector.zip" download>下载 Windows 连接助手</a>，解压并双击“安装连接助手.cmd”。只需安装一次。</li><li>已经安装时，<a href="learnflow://connect">唤起连接助手</a>后重试。</li></ol><p>浏览器可能要求允许弹窗和访问本地网络。网页无法替代首次安装或客户端登录。</p></details>');
  }
  if(h?.configured)dialog.insertAdjacentHTML('beforeend','<div class="connection-actions"><button class="secondary" id="disconnect-connection">断开网页连接</button></div>');
  if(h&&(!h.adapterVersion||Number(h.adapterVersion.split('.')[1])<7))dialog.insertAdjacentHTML('beforeend','<p><a href="./downloads/learnflow-connector.zip" download>更新本机连接助手</a>后可查看校验回执并选择多个客户端。</p>');
  dialog.querySelector('#connection-close').onclick=()=>{verificationAbort?.abort();dialog.close();};
  dialog.querySelector('#verify-connection')?.addEventListener('click',()=>task(()=>verify(false)));
  dialog.querySelector('#verify-auto')?.addEventListener('click',()=>task(()=>verify(true)));
  dialog.querySelector('#pair-from-web')?.addEventListener('click',()=>task(async()=>{await window.LearnFlowBridge.connect(status);window.LearnFlowComposer.resetVerification();await window.LearnFlowComposer.refresh();await verify(true);}));
  dialog.querySelector('#disconnect-connection')?.addEventListener('click',()=>task(async()=>{if(!local)await window.LearnFlowBridge.disconnect();else{const r=await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({disconnect:true})});if(!r.ok)throw Error('当前任务尚未结束，请稍后断开。');window.dispatchEvent(new Event('learnflow-disconnected'));}status('已断开。');button.textContent='连接学习助手';}));
  status(h?.configured?'已有访问许可；请测试当前选择的模型。':'确认权限后，会自动测试一次。');
  const previous=h?.verification;if(previous?.verified&&previous.requestedModel===(window.LearnFlowComposer.model()||'auto'))proof(previous);if(!dialog.open)dialog.showModal();
 }
 dialog.addEventListener('cancel',()=>verificationAbort?.abort());
 dialog.addEventListener('click',event=>{if(event.target.closest('#change-client-again'))open();});
 window.addEventListener('learnflow-connected',()=>{button.textContent='已授权 · 待验证';});
 window.addEventListener('learnflow-verified',()=>{button.textContent='✓ 模型已实际回复';});
 window.addEventListener('learnflow-model-changed',()=>{button.textContent='当前模型待验证';});
 window.addEventListener('learnflow-model-failed',()=>{button.textContent='本次模型未回复';});
 window.addEventListener('learnflow-disconnected',()=>{button.textContent='连接学习助手';});
 button.onclick=open;window.LearnFlowConnection={open,health};if(local)health().then(h=>{if(h?.configured)window.dispatchEvent(new Event('learnflow-connected'));});
})();
