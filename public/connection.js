/* Credentials remain in the loopback server's memory, never in browser storage. */
(() => {
  const local = ['127.0.0.1','localhost'].includes(location.hostname) && location.protocol === 'http:';
  const dialog = document.createElement('dialog');
  dialog.id = 'connection-dialog';
  dialog.style.cssText = 'max-width:620px;width:calc(100% - 32px);border:1px solid #eadfd4;border-radius:24px;padding:28px;color:#34302b';
  document.body.append(dialog);
  const button = document.createElement('button'); button.className = 'secondary'; button.textContent = '连接学习助手';
  document.querySelector('.top-actions').prepend(button);
  async function health() {
    if (!local) return window.LearnFlowBridge?.health();
    try { const r = await fetch('/api/health', {signal:AbortSignal.timeout(2500)}); const d = await r.json(); return d.service === 'LearnFlow local adapter' ? d : null; } catch { return null; }
  }
  async function open() {
    const h = await health();
    dialog.innerHTML = `<button id="connection-close" class="secondary" style="float:right">关闭</button><h2>连接你的学习助手</h2><p>授权后发送当前对话、启用的策略，以及你允许使用的记忆。调用可能消耗服务额度。</p>`;
    if (!local && h) {
      dialog.insertAdjacentHTML('beforeend','<p>已授权当前网页连接本机学习助手。学习对话和资产功能可以在这里继续使用。</p><button class="secondary" id="remote-disconnect">断开此网页的连接</button>');
      dialog.querySelector('#remote-disconnect').onclick=async()=>{await window.LearnFlowBridge.disconnect();dialog.close();button.textContent='连接学习助手';};
    } else if (!h) {
      dialog.insertAdjacentHTML('beforeend', `<p><button class="primary" id="pair-from-web">连接本机，在此网页继续学习</button></p><p id="pair-web-status" role="status"></p><p>首次使用需要本机连接助手。首次下载并解压后，双击“安装连接助手.cmd”；以后可直接点击下方按钮打开。</p><p><a class="primary" href="./downloads/learnflow-connector.zip" download>下载 Windows 连接助手</a></p><p><a class="secondary" href="learnflow://connect">已安装：打开本机 LearnFlow</a> <a href="http://127.0.0.1:4173/#session" target="_blank" rel="noopener">服务已启动：进入学习</a></p><p class="caption">Windows 或浏览器可能要求确认打开应用。首次安装需要 Node.js。线上与本机的学习记录分别保存在各自浏览器空间，可用“导出 / 恢复备份”迁移。打开客户端本身不代表取得模型调用授权。</p>`);
      dialog.querySelector('#pair-from-web').onclick=async()=>{const b=dialog.querySelector('#pair-from-web');b.disabled=true;try{await window.LearnFlowBridge.connect(text=>dialog.querySelector('#pair-web-status').textContent=text);button.textContent='本机已连接';setTimeout(()=>dialog.close(),500);}catch(e){dialog.querySelector('#pair-web-status').textContent=e.message;}finally{b.disabled=false;}};
    } else {
      dialog.insertAdjacentHTML('beforeend', `<p class="caption">腾讯官方网页登录授权：等待团队应用审核启用。普通用户无需填写访问令牌。</p><p id="connection-status" role="status">${h.configured?'接口已配置；真实回复成功后才能确认可用。':'连接助手已启动，请选择接口。'}</p><form id="connection-form"><label>连接方式<select name="provider" class="wide-button">${h.localCLIAvailable?'<option value="local-codebuddy">自动连接本机 WorkBuddy 附带的 CodeBuddy</option>':''}<option value="openai-compatible">自己的模型接口（OpenAI 兼容）</option></select></label><p id="cli-fields" hidden>已检测到 WorkBuddy 附带的 CodeBuddy。使用该入口自身的正常认证，不复制登录密钥；禁用文件、命令与 MCP 工具。版本更新可能改变此入口，连接失败可切换正式授权通道。</p><div id="compatible-fields"><p><label>接口地址<input class="wide-button" name="base" placeholder="https://你的服务/v1" autocomplete="off"></label></p><p><label>模型名称<input class="wide-button" name="model" placeholder="服务商提供的模型名" autocomplete="off"></label></p><p><label>API Key（本机无密钥服务可留空）<input class="wide-button" name="key" type="password" autocomplete="new-password"></label></p></div><p><label><input type="checkbox" name="consent" required> 我同意发送上述学习内容；密钥仅保留到连接助手退出或我断开连接。</label></p><button class="primary" type="submit">同意并连接</button> <button class="secondary" type="button" id="connection-disconnect">断开并清除密钥</button></form>`);
      const form = dialog.querySelector('form');
      form.elements.provider.onchange = () => { const buddy = form.elements.provider.value === 'workbuddy-localassistant'; dialog.querySelector('#compatible-fields').hidden = form.elements.provider.value !== 'openai-compatible'; dialog.querySelector('#cli-fields').hidden = form.elements.provider.value !== 'local-codebuddy';  };
      form.elements.provider.onchange();
      form.onsubmit = async e => {
        e.preventDefault(); const submit = form.querySelector('[type=submit]'); submit.disabled = true;
        try {
          const data = Object.fromEntries(new FormData(form)); data.consent = form.elements.consent.checked;
          const r = await fetch('/api/connection', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const d = await r.json();
          if (!r.ok) throw Error(d.message || '配置失败');
          form.elements.key.value = '';
          dialog.querySelector('#connection-status').textContent = '配置已接受，尚未验证模型。返回学习空间发送一条消息即可验证。';
          window.dispatchEvent(new Event('learnflow-connected')); button.textContent = '接口已配置';
        } catch(e) { dialog.querySelector('#connection-status').textContent = e.message; }
        finally { submit.disabled = false; }
      };
      dialog.querySelector('#connection-disconnect').onclick = async () => {
        try { const r = await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({disconnect:true})}); if(!r.ok) throw Error('暂时无法断开，请等待任务完成'); form.reset(); button.textContent='连接学习助手'; dialog.querySelector('#connection-status').textContent='已断开，服务内存中的密钥已清除。'; window.dispatchEvent(new Event('learnflow-disconnected')); } catch(e) { dialog.querySelector('#connection-status').textContent=e.message; }
      };
    }
    dialog.querySelector('#connection-close').onclick = () => { dialog.close(); dialog.innerHTML = ''; };
    if(!dialog.open) dialog.showModal();
  }
  window.addEventListener('learnflow-connected',()=>{if(window.LearnFlowBridge?.isRemote())button.textContent='本机已连接';});
  button.onclick = open;
  window.LearnFlowConnection = {open, health};
})();
