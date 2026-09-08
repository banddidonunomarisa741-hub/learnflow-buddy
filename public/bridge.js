(() => {
  const base='http://127.0.0.1:4173';
  const here=['127.0.0.1','localhost'].includes(location.hostname);
  let grant='';try{grant=sessionStorage.getItem('learnflow.bridge')||'';}catch{}
  const raw=window.fetch.bind(window);
  window.learnflowFetch=(url,init={})=>{
    if(!here&&grant&&typeof url==='string'&&url.startsWith('/api/'))return raw(base+url,{...init,headers:{...init.headers,'X-LearnFlow-Grant':grant}});
    return raw(url,init);
  };
  const clear=()=>{grant='';try{sessionStorage.removeItem('learnflow.bridge');}catch{}window.dispatchEvent(new Event('learnflow-disconnected'));};
  async function health(){if(here||!grant)return null;try{const r=await raw(base+'/api/assets',{headers:{'X-LearnFlow-Grant':grant},signal:AbortSignal.timeout(2500)});if(!r.ok){clear();return null;}const h=await raw(base+'/api/health',{signal:AbortSignal.timeout(2500)});return await h.json();}catch{return null;}}
  async function connect(status){
    const popup=window.open('about:blank','learnflow-local-consent','width=680,height=760');
    if(!popup)throw Error('请允许本网站打开授权窗口，再点击连接。');
    popup.document.body.textContent='正在连接本机学习助手…';
    const proof=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    try{
      const request=()=>raw(base+'/api/pair/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proof}),signal:AbortSignal.timeout(2500)});
      let r;
      try{r=await request();}catch{
        status('正在唤起已安装的连接助手，请允许浏览器打开应用。首次使用需先下载并安装连接助手。');
        popup.location.href='learnflow://connect';
        const deadline=Date.now()+20000;
        while(Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1200));try{r=await request();break;}catch{}}
        if(!r)throw Error('未找到连接助手。首次使用请下载并安装；已安装时请允许打开应用和访问本地网络，然后重试。');
      }
      const d=await r.json();if(!r.ok)throw Error(d.message||'无法创建连接请求');
      popup.location.href=base+'/#pair='+d.id;status('请在弹出的本机窗口点击同意。确认后会自动测试模型并显示结果。');
      const until=Date.now()+180000;
      while(Date.now()<until){await new Promise(r=>setTimeout(r,1200));const r=await raw(base+'/api/pair/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,proof}),signal:AbortSignal.timeout(5000)});const p=await r.json();if(!r.ok)throw Error(p.message);if(p.denied)throw Error('你已取消连接，尚未授权此网页。');if(p.token){grant=p.token;try{sessionStorage.setItem('learnflow.bridge',grant);}catch{}window.dispatchEvent(new Event('learnflow-connected'));status('本机访问权限已确认，接下来测试模型是否能回答。');popup.close();return;}}
      throw Error('连接请求已过期，请重新发起。');
    }catch(e){popup.close();throw Error(e.message==='Failed to fetch'?'未找到本机助手，或浏览器尚未允许访问本地网络。请先安装 / 打开助手，再重试。':e.message);}
  }
  async function disconnect(){if(grant)await window.learnflowFetch('/api/pair/revoke',{method:'POST'});clear();}
  window.LearnFlowBridge={health,connect,disconnect,isRemote:()=>!here&&Boolean(grant)};
  if(!here&&grant)setTimeout(async()=>{if((await health())?.configured)window.dispatchEvent(new Event('learnflow-connected'));},100);
  if(here&&location.hash.startsWith('#pair='))setTimeout(async()=>{
    const id=location.hash.slice(6),dialog=document.createElement('dialog');dialog.className='pair-dialog connection-dialog';document.body.append(dialog);
    try{const healthResponse=await raw('/api/health');const localHealth=await healthResponse.json();const r=await raw('/api/pair/pending?id='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw Error(d.message);
      dialog.innerHTML='<img class="connection-logo" src="./assets/learnflow-logo.svg" alt="LearnFlow"><h2>允许网页使用你的 WorkBuddy 吗？</h2><p id="pair-origin" class="pair-origin"></p><p>连接后，网页会通过你选择的客户端发送对话、附件、学习策略和你允许使用的记忆。连接测试和后续对话可能消耗该账号额度。</p><p>同时允许访问已保存的学习资料，以及你另行扫码绑定的 QQ 收件箱与提醒；发送提醒仍需确认。</p><details><summary>连接与积分说明</summary><p>使用客户端已有的登录状态，网页不读取密码或客户端令牌。当前通道返回 Token 用量，不返回积分扣费或余额；实际以客户端账单为准。</p><p>许可只对上方网站有效，最多持续 8 小时，可在网页中断开。QQ 连接和已设置的提醒在连接器页面单独取消。</p></details><p id="pair-status" role="status" aria-live="polite"></p><div class="connection-actions"><button class="primary" id="pair-approve">同意并连接</button><button class="secondary" id="pair-deny">取消</button></div>';
      dialog.querySelector('#pair-origin').textContent='请求来源：'+d.origin;
      if(localHealth.clients?.length){const group=document.createElement('fieldset');group.className='connection-clients';const legend=document.createElement('legend');legend.textContent='选择本次授权使用的客户端入口';group.append(legend);for(const client of localHealth.clients){const label=document.createElement('label');label.className='connection-client';const input=document.createElement('input');input.type='radio';input.name='pair-client';input.value=client.id;input.checked=client.id===localHealth.selectedClientId;const span=document.createElement('span');span.textContent=client.name+' · '+client.method;label.append(input,span);group.append(label);}dialog.querySelector('#pair-origin').after(group);}
      async function answer(consent){const r=await raw('/api/pair/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,consent,clientId:consent?dialog.querySelector('[name="pair-client"]:checked')?.value:undefined})});const d=await r.json();dialog.querySelector('#pair-status').textContent=r.ok?consent?'已同意，原网页正在验证模型。':'已取消，本次没有授权。':d.message;}
      dialog.querySelector('#pair-approve').onclick=()=>answer(true);dialog.querySelector('#pair-deny').onclick=()=>answer(false);
    }catch(e){dialog.textContent=e.message;}
    dialog.showModal();
  },200);
})();
