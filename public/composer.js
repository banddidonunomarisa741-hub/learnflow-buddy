/* Attachments stay in this tab until sent. Saving is a separate choice. */
(() => {
  let files = [], draft = '', reading = false, models = [], selected = '';
  let verifiedFor='',state = '未连接', detail = '连接自己的模型后开始对话。';
  let loadingModels = null, modelSource = '', attachmentStatus = '', attachmentVersion = 0;
  let mode = 'demo', busy = false, lastInput = null, attachmentEpoch = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m8 10 4 4 4-4"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',check:'<path d="m5 12 4 4L19 6"/>'})[name] || ''}</svg>`;
  try { selected = sessionStorage.getItem('learnflow.model') || ''; } catch {}
  const menu = document.createElement('dialog');
  menu.id = 'model-menu'; menu.className = 'model-menu composer-model-popover';
  menu.setAttribute('aria-labelledby', 'model-menu-title'); document.body.append(menu);
  const family = id => id === 'auto' ? '自动选择' : /^hy\d|hunyuan/i.test(id) ? '腾讯混元' : /^glm/i.test(id) ? 'GLM' : /^deepseek/i.test(id) ? 'DeepSeek' : /^kimi/i.test(id) ? 'Kimi' : /^minimax/i.test(id) ? 'MiniMax' : '其他模型';
  const modelLabel = item => item?.id === 'auto' ? 'Auto' : item?.label || item?.id || '选择模型';
  function say(text) { attachmentStatus = text; const el = document.querySelector('#attachment-status'); if (el) el.textContent = text; }
  function resizeInput(input) {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(240, Math.max(72, input.scrollHeight)) + 'px';
    input.style.overflowY = input.scrollHeight > 240 ? 'auto' : 'hidden';
  }
  function positionMenu() {
    const trigger = document.querySelector('#model-trigger');
    if (!menu.open || !trigger) return;
    const anchor = trigger.getBoundingClientRect(), viewport = window.visualViewport;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    const offsetTop = viewport?.offsetTop || 0, offsetLeft = viewport?.offsetLeft || 0, margin = 12;
    menu.style.maxHeight = Math.max(160, height - margin * 2) + 'px';
    const above = anchor.top - menu.offsetHeight - 10;
    const top = above >= offsetTop + margin ? above : Math.min(anchor.bottom + 10, offsetTop + height - menu.offsetHeight - margin);
    menu.style.left = Math.max(offsetLeft + margin, Math.min(anchor.right - menu.offsetWidth, offsetLeft + width - menu.offsetWidth - margin)) + 'px';
    menu.style.top = Math.max(offsetTop + margin, top) + 'px';
  }
  function mount(m = mode, b = busy) {
    mode = m; busy = b;
    const form = document.querySelector('#chat-form');
    if (!form) { if (menu.open) closeModels(false); return; }
    const input = form.querySelector('#chat-input'), bottom = form.querySelector('.prompt-bottom');
    if (!input || !bottom) return;
    if (!form.querySelector('#composer-tools')) {
      form.classList.add('composer-polished');
      form.insertAdjacentHTML('afterbegin', '<div id="attachment-list" aria-label="待发送附件"></div>');
      bottom.insertAdjacentHTML('afterbegin', `<button type="button" id="attach-files" class="attach-trigger" aria-label="添加图片或文件" title="添加图片或文件 · 也可拖入或粘贴截图">${svg('plus')}</button><input id="chat-files" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.csv,.json" hidden>`);
      const tools = document.createElement('div'); tools.id = 'composer-tools';
      tools.innerHTML = '<button type="button" id="composer-connection"><span class="composer-status-dot" aria-hidden="true"></span><span class="composer-status-label"></span></button><button type="button" id="model-trigger" aria-haspopup="dialog" aria-controls="model-menu" aria-expanded="false"></button>';
      bottom.insertBefore(tools, bottom.querySelector('.send'));
      form.insertAdjacentHTML('beforeend', '<div id="connection-banner" role="status" aria-live="polite"></div><p id="attachment-status" role="status" aria-live="polite"></p><span class="composer-drop-hint" aria-hidden="true">松开，添加到这条消息</span>');
    }
    // A status refresh must not rewrite the active draft, move its caret, or steal focus.
    if (input !== lastInput) { if (input.value) draft = input.value; else input.value = draft; lastInput = input; resizeInput(input); }
    const model = models.find(item => item.id === selected);
    const label = mode === 'api' ? (model ? modelLabel(model) : loadingModels ? '读取模型…' : '选择模型') : '连接模型';
    const trigger = form.querySelector('#model-trigger');
    trigger.innerHTML = `<span class="composer-model-name">${esc(label)}</span>${svg('chevron')}`;
    trigger.disabled = busy; trigger.title = mode === 'api' ? '切换本次对话使用的模型' : '连接后使用自己的模型'; trigger.setAttribute('aria-expanded', String(menu.open));
    const failed = /失败|检查/.test(state), ready = mode === 'api' && verifiedFor===selected && !failed;
    const status = mode === 'demo' ? '演示' : failed ? '连接异常' : state === '正在验证' ? '验证中' : ready ? '已验证' : '待验证';
    const statusButton = form.querySelector('#composer-connection');
    statusButton.querySelector('.composer-status-label').textContent = status;
    statusButton.dataset.state = mode === 'demo' ? 'demo' : failed ? 'error' : ready ? 'ready' : 'pending';
    statusButton.title = mode === 'demo' ? '当前为预设演示，点击连接自己的模型' : detail + ' · 点击管理连接'; statusButton.setAttribute('aria-label', statusButton.title);
    const banner = form.querySelector('#connection-banner');
    banner.textContent = mode === 'demo' ? '当前为预设演示。连接模型后可开始真实对话。' : `${state}。${detail}`;
    banner.dataset.ready = String(ready); banner.dataset.error = String(failed);
    const list = form.querySelector('#attachment-list');
    if (list.dataset.version !== String(attachmentVersion) || list.dataset.busy !== String(busy)) {
      list.innerHTML = files.map((attachment, index) => `<div class="attachment-chip">${attachment.kind === 'image' ? `<img src="data:${attachment.mime};base64,${attachment.data}" alt="${esc(attachment.name)}预览">` : `<span class="file-mini">${svg('file')}</span>`}<span class="attachment-file-copy"><strong title="${esc(attachment.name)}">${esc(attachment.name)}</strong><small title="${esc(attachment.note || '发送时上传图片原件')}">${esc(attachment.kind === 'image' ? '图片' : attachment.note || '文档')}</small></span><button type="button" data-remove-attachment="${index}" aria-label="移除 ${esc(attachment.name)}" ${busy ? 'disabled' : ''}>${svg('close')}</button></div>`).join('');
      list.dataset.version = String(attachmentVersion); list.dataset.busy = String(busy);
    }
    form.querySelector('#attach-files').disabled = busy || reading;
    form.querySelector('#attachment-status').textContent = attachmentStatus;
    form.classList.toggle('reading-attachment', reading);
    if (menu.open) positionMenu();
  }
  function drawOptions(query = '') {
    const matches = models.filter(item => (item.id + ' ' + modelLabel(item) + ' ' + family(item.id)).toLowerCase().includes(query.trim().toLowerCase()));
    const groups = [...new Set(matches.map(item => family(item.id)))];
    menu.querySelector('#model-options').innerHTML = matches.length ? groups.map(group => `<div role="group" aria-label="${esc(group)}"><div class="model-group">${esc(group)}</div>${matches.filter(item => family(item.id) === group).map(item => `<button type="button" role="option" aria-selected="${item.id === selected}" data-model-id="${esc(item.id)}" class="model-option"><span class="model-mark" aria-hidden="true">${item.id === 'auto' ? 'A' : esc(group.slice(0, 1))}</span><span class="model-option-copy"><strong>${esc(modelLabel(item))}</strong><span class="model-proof-badge ${item.verification?.verified?'passed':item.verification?.verified===false?'failed':''}">${item.verification?.verified?'本机曾验证通过':item.verification?.verified===false?'最近请求未完成':'客户端声明 · 尚未验证'}</span>${modelLabel(item) !== item.id && item.id !== 'auto' ? `<small>${esc(item.id)}</small>` : item.id === 'auto' ? '<small>由当前服务选择</small>' : ''}</span>${item.id === selected ? `<span class="model-check" aria-hidden="true">${svg('check')}</span>` : ''}</button>`).join('')}</div>`).join('') : `<p class="model-empty">${models.length ? '没有找到，换个名字试试。' : '还没有可用模型。请先检查连接。'}</p>`;
    menu.querySelector('#model-count').textContent = `${matches.length} 个模型`; positionMenu();
  }
  function openModels() {
    if (busy) return;
    if (menu.open) { closeModels(); return; }
    if (mode !== 'api' || !models.length) { window.LearnFlowConnection?.open(); return; }
    menu.innerHTML = `<div class="model-menu-heading"><h2 id="model-menu-title">选择模型</h2><button type="button" id="close-models" aria-label="关闭模型选择">${svg('close')}</button></div><label class="model-search-field">${svg('search')}<input id="model-search" type="search" autocomplete="off" placeholder="搜索模型" aria-label="搜索模型"></label><div class="model-list-meta"><span id="model-count"></span><span>来自你的连接</span></div><div id="model-options" role="listbox" aria-label="模型列表"></div><div class="model-menu-footer"><button type="button" id="refresh-models">${svg('refresh')}<span>刷新列表</span></button><button type="button" id="model-connection-settings">连接设置</button></div><p class="model-source-note" title="${esc(modelSource)}">可用模型与费用以你的服务账号为准。</p>`;
    drawOptions(); menu.show(); positionMenu();
    document.querySelector('#model-trigger')?.setAttribute('aria-expanded', 'true'); menu.querySelector('#model-search').focus({preventScroll: true});
  }
  function closeModels(restoreFocus = true) {
    if (menu.open) menu.close();
    const trigger = document.querySelector('#model-trigger'); trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger?.focus({preventScroll: true});
  }
  menu.addEventListener('cancel', event => { event.preventDefault(); closeModels(); });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeModels(); return; }
    const options = [...menu.querySelectorAll('[role=option]')]; let index = options.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if (['Home', 'End'].includes(event.key) && event.target.id === 'model-search') return;
      event.preventDefault(); if (!options.length) return;
      if (event.key === 'ArrowDown') index = (index + 1) % options.length;
      if (event.key === 'ArrowUp') index = index < 0 ? options.length - 1 : (index - 1 + options.length) % options.length;
      if (event.key === 'Home') index = 0; if (event.key === 'End') index = options.length - 1;
      options[index]?.focus({preventScroll: true}); options[index]?.scrollIntoView({block: 'nearest'});
    }
    if (event.key === 'Enter' && event.target.id === 'model-search') { event.preventDefault(); options[0]?.click(); }
  });
  document.addEventListener('pointerdown', event => { if (menu.open && !menu.contains(event.target) && !event.target.closest('#model-trigger')) closeModels(false); });
  document.addEventListener('focusin', event => { if (menu.open && !menu.contains(event.target) && !event.target.closest('#model-trigger')) closeModels(false); });
  window.addEventListener('resize', positionMenu); window.addEventListener('scroll', positionMenu, true); window.visualViewport?.addEventListener('resize', positionMenu);
  async function refresh() {
    if (loadingModels) return loadingModels;
    loadingModels = (async () => {
      try {
        const response = await window.learnflowFetch('/api/models'), data = await response.json();
        if (!response.ok) throw Error(response.status === 404 ? '请更新本机连接助手后重试。' : data.message || '暂时没有读到模型列表。');
        const unique = new Map((Array.isArray(data.models) ? data.models : []).filter(item => typeof item?.id === 'string' && item.id.trim()).map(item => [item.id, item]));
        models = [...unique.values()];
        if (!models.some(item => item.id === selected)) selected = models.some(item => item.id === data.defaultModel) ? data.defaultModel : models[0]?.id || '';
        modelSource = data.source || '当前连接的模型服务';
        if (state !== '连接成功' && state !== '正在验证') { state = models.length ? '已授权，待验证' : '连接待检查'; detail = models.length ? '已读取客户端声明的模型；收到回答后才会标记可用。' : '暂时没有可用模型，请检查连接。'; }
        mount(); if (menu.open) drawOptions(menu.querySelector('#model-search').value); return data;
      } catch (error) { state = '连接待检查'; detail = error.message || '请更新连接助手后重试。'; mount(); throw error; }
      finally { loadingModels = null; mount(); }
    })();
    return loadingModels;
  }
  async function verify(status = () => {}, options={}) {
    state = '正在验证'; detail = '正在等模型回复…'; mount(); status(detail);
    try {
      await refresh();
      const response = await window.learnflowFetch('/api/probe', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({consent: true, model: selected || undefined}), signal: options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(65000)]):AbortSignal.timeout(65000)});
      const data = await response.json();
      if (!response.ok || !data.verified) throw Error(data.message || '模型没有完成验证。');
      verifiedFor=selected;state = '连接成功'; detail = `${data.model || selected} 已回复`; status('✓ 已连接，可以开始学习。'); mount();
      window.dispatchEvent(new CustomEvent('learnflow-verified', {detail: data})); return data;
    } catch (error) { verifiedFor='';state = '连接待检查'; detail = error.message; status('这次没连上：' + error.message); mount(); throw error; }
  }
  async function add(incoming) {
    if (busy || reading) return;
    const epoch = attachmentEpoch; reading = true; mount(); say('正在读取资料…'); const errors = [];
    try {
      for (const file of incoming) {
        if (epoch !== attachmentEpoch) break;
        try {
          if (files.length >= 4) throw Error('一次最多 4 个附件，请先移除一些。');
          if (file.size > 10 * 1024 * 1024) throw Error('超过 10 MB，请拆分后再试。');
          let attachment;
          if (/\.(png|jpe?g|webp)$/i.test(file.name) || ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            if (file.size > 5 * 1024 * 1024) throw Error('图片超过 5 MB，请缩小后再试。');
            const mime = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ? file.type : /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg';
            const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(Error('图片读取失败。')); reader.readAsDataURL(file); });
            attachment = {kind: 'image', name: file.name, mime, data};
          } else if (/\.pdf$/i.test(file.name)) {
            const pdfjs = await import('./vendor/pdfjs/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', location.href).href;
            const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false});
            try {
              const pdf = await task.promise; let text = '', read = 0;
              for (let number = 1; number <= Math.min(pdf.numPages, 30); number++) {
                if (epoch !== attachmentEpoch) break;
                const page = await pdf.getPage(number), content = await page.getTextContent(); text += `\n[第 ${number} 页]\n` + content.items.map(item => item.str || '').join(' '); read = number; if (text.length > 60000) break;
              }
              if (epoch !== attachmentEpoch) break;
              if (text.replace(/\[第 \d+ 页\]/g, '').trim().length < 10) throw Error('没有读到正文。扫描版 PDF 请改为上传页面截图。');
              attachment = {kind: 'text', name: file.name, text: text.slice(0, 60000), note: `已提取 ${read}/${pdf.numPages} 页文字${text.length > 60000 ? '，截取前 60000 字符' : ''}；不含图片与版式`};
            } finally { await task.destroy(); }
          } else if (/\.(txt|md|csv|json)$/i.test(file.name)) {
            const text = await file.text(); if (!text.trim()) throw Error('文件里没有文字。'); attachment = {kind: 'text', name: file.name, text: text.slice(0, 60000), note: text.length > 60000 ? '仅发送前 60000 字符' : '已读取全文文字'};
          } else throw Error('请使用图片、PDF 或 TXT / MD / CSV / JSON。Word 和 PPT 请先导出 PDF。');
          if (epoch !== attachmentEpoch) break;
          if (JSON.stringify([...files, attachment]).length > 15500000) throw Error('附件总量太大，请分两次发送。');
          files.push(attachment); attachmentVersion++;
        } catch (error) { errors.push(`${file.name}：${error.message}`); }
      }
    } finally { reading = false; if (epoch === attachmentEpoch) { mount(); say(errors.join('\n')); } else mount(); }
  }
  document.addEventListener('input', event => { if (event.target.id === 'chat-input') { draft = event.target.value; resizeInput(event.target); } if (event.target.id === 'model-search') drawOptions(event.target.value); });
  document.addEventListener('change', event => { if (event.target.id === 'chat-files') { add([...event.target.files]); event.target.value = ''; } });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.id === 'attach-files') document.querySelector('#chat-files')?.click();
    if (button.id === 'model-trigger') openModels(); if (button.id === 'close-models') closeModels();
    if (button.id === 'composer-connection' || button.id === 'model-connection-settings') { closeModels(false); window.LearnFlowConnection?.open(); }
    if (button.id === 'refresh-models') { button.disabled = true; button.querySelector('span').textContent = '刷新中…'; refresh().catch(error => say(error.message)).finally(() => { button.disabled = false; if (button.querySelector('span')) button.querySelector('span').textContent = '刷新列表'; }); }
    if (button.dataset.modelId && models.some(item => item.id === button.dataset.modelId)) { selected = button.dataset.modelId; try { sessionStorage.setItem('learnflow.model', selected); } catch {} verifiedFor='';state = '已授权，待验证';window.dispatchEvent(new Event('learnflow-model-changed')); detail = `下一条消息使用 ${modelLabel(models.find(item => item.id === selected))}`; closeModels(); mount(); }
    if (button.dataset.removeAttachment !== undefined && !busy) { files.splice(Number(button.dataset.removeAttachment), 1); attachmentVersion++; attachmentStatus = ''; mount(); }
  });
  document.addEventListener('dragover', event => { if (Array.from(event.dataTransfer?.types || []).includes('Files')) { if (!document.querySelector('#chat-form')) return; event.preventDefault(); if (!busy && !reading) document.querySelector('#chat-form').classList.add('dragging'); } });
  document.addEventListener('dragleave', event => { if (!event.relatedTarget) document.querySelector('#chat-form')?.classList.remove('dragging'); });
  document.addEventListener('drop', event => { if (event.dataTransfer?.files.length && document.querySelector('#chat-form')) { event.preventDefault(); document.querySelector('#chat-form').classList.remove('dragging'); add([...event.dataTransfer.files]); } });
  document.addEventListener('paste', event => { if (event.target.id === 'chat-input' && event.clipboardData?.files.length) { event.preventDefault(); add([...event.clipboardData.files]); } });
  window.addEventListener('learnflow-connected', () => { mode='api';refresh().catch(() => {}); });
  window.addEventListener('learnflow-disconnected', () => { mode='demo';models = []; selected = ''; verifiedFor='';state = '未连接'; detail = '可以重新连接模型。'; try { sessionStorage.removeItem('learnflow.model'); } catch {} closeModels(false); mount(); });
  const setDraft = text => { draft = String(text ?? ''); const input = document.querySelector('#chat-input'); if (input) { input.value = draft; resizeInput(input); } };
  const clear = () => { files = []; draft = ''; attachmentStatus = ''; attachmentVersion++; attachmentEpoch++; };
  window.LearnFlowComposer = {
    mount, refresh, verify, add, files: () => files, draft: () => draft, model: () => selected || undefined, ready: () => !reading, clear,
    restore: (items, text) => { files = items; attachmentVersion++; setDraft(text); }, setDraft,
    failure: message => { verifiedFor='';state = '本次请求失败'; detail = message;window.dispatchEvent(new Event('learnflow-model-failed')); },
    success: model => { verifiedFor=selected;state = '连接成功'; detail = `${model || selected} 已回复`; window.dispatchEvent(new CustomEvent('learnflow-verified', {detail: {model: model || selected, verified: true}})); },
    select: id => {selected=id;verifiedFor='';state='已授权，待验证';try{sessionStorage.setItem('learnflow.model',id);}catch{}mount();},
    resetVerification:()=>{verifiedFor='';state='已授权，待验证';},
    connectionStatus:()=>({connected:mode==='api',verified:verifiedFor===selected&&!!verifiedFor,model:selected,label:detail}),
    reset: clear
  };
})();
