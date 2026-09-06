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
      while(Date.now()<until){await new Promise(r=>setTimeout(r,1200));const r=await raw(base+'/api/pair/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,proof}),signal:AbortSignal.timeout(5000)});const p=await r.json();if(!r.ok)throw Error(p.message);if(p.denied)throw Error('你已取消连接，尚未授权此网页。');if(p.token){grant=p.token;try{sessionStorage.setItem('learnflow.bridge',grant);}catch{}window.dispatchEvent(new Event('learnflow-connected'));status('已连接本机模型。你可以留在这个网页继续学习。');popup.close();return;}}
      throw Error('连接请求已过期，请重新发起。');
    }catch(e){popup.close();throw Error(e.message==='Failed to fetch'?'未找到本机助手，或浏览器尚未允许访问本地网络。请先安装 / 打开助手，再重试。':e.message);}
  }
  async function disconnect(){if(grant)await window.learnflowFetch('/api/pair/revoke',{method:'POST'});clear();}
  window.LearnFlowBridge={health,connect,disconnect,isRemote:()=>!here&&Boolean(grant)};
  if(!here&&grant)setTimeout(async()=>{if((await health())?.configured)window.dispatchEvent(new Event('learnflow-connected'));},100);
  if(here&&location.hash.startsWith('#pair='))setTimeout(async()=>{
    const id=location.hash.slice(6),dialog=document.createElement('dialog');dialog.className='pair-dialog';document.body.append(dialog);
    try{const r=await raw('/api/pair/pending?id='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw Error(d.message);
      dialog.innerHTML='<h2>允许这个网页连接学习助手吗？</h2><p id="pair-origin"></p><p>允许它使用本机已配置模型进行学习对话，并访问你确认保存的学习资产。模型调用会使用账号额度。</p><p>如果你另外扫码连接 QQ，网页也能显示机器人的学习收件箱和提醒。发消息或设置提醒时，会让你确认收件人、内容和时间。</p><p>客户端登录密钥留在本机。连接有效期最多 8 小时，可在网页随时断开；QQ 连接和已设定的提醒可在连接器页面单独取消。</p><label><input type="checkbox" id="pair-consent"> 我确认这是我刚才发起的连接</label><p role="status" id="pair-status"></p><div class="button-row"><button class="primary" id="pair-approve">同意并连接原网页</button><button class="secondary" id="pair-deny">取消</button></div>';
      dialog.querySelector('#pair-origin').textContent='请求来源：'+d.origin;
      async function answer(consent){if(consent&&!dialog.querySelector('#pair-consent').checked){dialog.querySelector('#pair-status').textContent='请先确认请求来源。';return;}const r=await raw('/api/pair/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,consent})});const d=await r.json();dialog.querySelector('#pair-status').textContent=r.ok?'已处理，请回到原网页。':d.message;}
      dialog.querySelector('#pair-approve').onclick=()=>answer(true);dialog.querySelector('#pair-deny').onclick=()=>answer(false);
    }catch(e){dialog.textContent=e.message;}
    dialog.showModal();
  },200);
})();
