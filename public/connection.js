(() => {
  const local=['127.0.0.1','localhost'].includes(location.hostname)&&location.protocol==='http:';
  const dialog=document.createElement('dialog');dialog.id='connection-dialog';dialog.className='connection-dialog';document.body.append(dialog);
  const button=document.createElement('button');button.className='secondary';button.textContent='连接学习助手';document.querySelector('.top-actions').prepend(button);
  async function health(){if(!local)return window.LearnFlowBridge?.health();try{const r=await fetch('/api/health',{signal:AbortSignal.timeout(2500)});const d=await r.json();return d.service==='LearnFlow local adapter'?d:null;}catch{return null;}}
  let running=false;
  async function open(){
    if(running){if(!dialog.open)dialog.showModal();return;}
    const h=await health();
    dialog.innerHTML='<img class="connection-logo" src="./assets/learnflow-logo.svg" alt="LearnFlow"><button class="secondary" id="connection-close" style="float:right">关闭</button><h2>连接你的学习助手</h2><p>连接本机已登录的 WorkBuddy。会发送一条简短测试，结果直接显示在这里。</p><p class="connection-result" id="connection-status" role="status" aria-live="polite"></p>';
    if(h?.configured){
      if(Number(h.adapterVersion?.split('.')[0]||0)<1||Number(h.adapterVersion?.split('.')[0]||0)===1&&Number(h.adapterVersion?.split('.')[1]||0)<4)dialog.insertAdjacentHTML('beforeend','<p>更新本机连接助手后，可使用实时回复和停止生成。</p><p><a class="primary" href="./downloads/learnflow-connector.zip" download>下载最新版，解压并运行安装连接助手.cmd</a></p>');
      dialog.insertAdjacentHTML('beforeend','<button class="primary" id="verify-connection">验证连接并开始学习</button> <button class="secondary" id="disconnect-connection">断开连接</button>');
    }else if(local&&h){
      dialog.insertAdjacentHTML('beforeend',`<form id="connection-form">${h.localCLIAvailable?'<p class="connection-found">✓ 已找到本机 WorkBuddy 学习助手</p>':'<p>未发现可用的本机入口，请填写自己的模型接口。</p>'}<details ${h.localCLIAvailable?'':'open'}><summary>使用自己的模型接口（可选）</summary><p><label><input type="checkbox" id="use-compatible" ${h.localCLIAvailable?'':'checked'}> 使用 OpenAI 兼容接口</label></p><label>接口地址<input name="base" placeholder="https://你的服务/v1" class="wide-button"></label><label>默认模型<input name="model" placeholder="服务商提供的模型标识" class="wide-button"></label><label>API Key<input name="key" type="password" autocomplete="new-password" class="wide-button"></label></details><p>点击下方按钮，即同意发送学习对话、你选择的附件、策略和允许使用的记忆，并进行一次连接测试；会消耗账号额度。密钥只留在本机服务内存中。</p><button type="submit" class="primary">同意连接并验证</button></form>`);
      dialog.querySelector('form').onsubmit=e=>{e.preventDefault();task(async()=>{const form=e.target;const data=Object.fromEntries(new FormData(form));data.provider=dialog.querySelector('#use-compatible').checked?'openai-compatible':'local-codebuddy';data.consent=true;const r=await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();form.elements.key.value='';if(!r.ok)throw Error(d.message);window.dispatchEvent(new Event('learnflow-connected'));await verify();});};
    }else{
      dialog.insertAdjacentHTML('beforeend','<button class="primary" id="pair-from-web">同意连接本机并验证</button><p>会打开本机确认窗口，确认后自动回到此网页并测试模型。对话和主动选择的附件交给你授权的模型处理，消耗账号额度。</p><details><summary>第一次使用 / 没有弹出窗口？</summary><ol><li><a href="./downloads/learnflow-connector.zip" download>下载最新版 Windows 连接助手</a>，解压并双击“安装连接助手.cmd”。只需安装一次。</li><li>已安装时，<a href="learnflow://connect">点击唤起连接助手</a>，再点上方连接按钮。</li></ol><p>请允许浏览器打开确认窗口和访问本地网络。电脑需要 Node.js 20 及以上。</p></details>');
      dialog.querySelector('#pair-from-web').onclick=()=>task(async()=>{await window.LearnFlowBridge.connect(status);await verify();});
    }
    dialog.querySelector('#connection-close').onclick=()=>dialog.close();
    dialog.querySelector('#verify-connection')?.addEventListener('click',()=>task(verify));
    dialog.querySelector('#disconnect-connection')?.addEventListener('click',()=>task(async()=>{if(!local)await window.LearnFlowBridge.disconnect();else{const r=await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({disconnect:true})});if(!r.ok)throw Error('当前任务尚未结束，请稍后断开。');window.dispatchEvent(new Event('learnflow-disconnected'));}status('已断开，可随时重新连接。');button.textContent='连接学习助手';}));
    status(h?.configured?'已授权，点击验证即可确认模型现在是否可用。':'确认后会测试一次模型连接。');if(!dialog.open)dialog.showModal();
  }
  function status(t){const el=dialog.querySelector('#connection-status');if(el)el.textContent=t;}
  async function task(fn){if(running)return;running=true;dialog.querySelectorAll('button:not(#connection-close)').forEach(b=>b.disabled=true);try{await fn();}catch(e){status('未完成：'+e.message);button.textContent='连接待检查';}finally{running=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  async function verify(){window.dispatchEvent(new Event('learnflow-connected'));button.textContent='正在验证模型…';await window.LearnFlowComposer.verify(status);button.textContent='✓ 学习助手已连接';if(!dialog.querySelector('#begin-connected')){const b=document.createElement('button');b.id='begin-connected';b.className='primary';b.textContent='开始学习 →';b.onclick=()=>{dialog.close();location.hash='session';document.querySelector('#chat-input')?.focus();};dialog.append(b);}}
  window.addEventListener('learnflow-connected',()=>{button.textContent='已授权 · 可验证';});window.addEventListener('learnflow-verified',()=>{button.textContent='✓ 学习助手已连接';});window.addEventListener('learnflow-disconnected',()=>{button.textContent='连接学习助手';});
  button.onclick=open;window.LearnFlowConnection={open,health};if(local)health().then(h=>{if(h?.configured)window.dispatchEvent(new Event('learnflow-connected'));});
})();
