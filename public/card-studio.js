/* Local strategy editor. Saving stays with the application's existing card-form handler. */
(() => {
  'use strict';

  let dispose = null;
  const colors = [['orange', '暖橙'], ['green', '苔绿'], ['blue', '雾蓝'], ['purple', '浅紫']];
  const scenes = [['self', '自主学习'], ['exam', '应试学习'], ['project', '项目学习'], ['all', '通用方法']];

  function open({ showModal, modalHead, esc, prefill = {} }) {
    if (dispose) dispose();
    const color = colors.some(([value]) => value === prefill.color) ? prefill.color : 'orange';
    const scene = scenes.some(([value]) => value === prefill.scene) ? prefill.scene : 'self';
    const tags = Array.isArray(prefill.tags) ? prefill.tags.join('，') : String(prefill.tags || '');

    showModal(`${modalHead(prefill.id ? '再调一调这个方法' : '把你的方法，做成一张卡')}
      <p class="studio-intro">写下自己试过、下次还想用的方法。边写边看卡片的样子。</p>
      <div class="studio-layout" data-card-studio>
        <form id="card-form" class="studio-form" data-id="${esc(prefill.id || '')}">
          <label class="studio-field">给它起个名字
            <input name="title" required maxlength="60" placeholder="例如：把单词拆开记" value="${esc(prefill.title || '')}" autocomplete="off">
          </label>
          <fieldset class="studio-scene"><legend>什么时候用</legend><div class="studio-scene-options">${scenes.map(([value, label]) => `<label><input type="radio" name="scene" value="${value}" ${scene === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset>
          <label class="studio-field">标签 <span class="studio-field-hint">逗号分隔，最多 6 个</span>
            <input name="tags" maxlength="120" placeholder="例如：英语，词根，主动回忆" value="${esc(tags)}" autocomplete="off">
          </label>
          <label class="studio-field">一句话介绍
            <input name="description" required maxlength="160" placeholder="这个方法，帮你解决了什么？" value="${esc(prefill.description || '')}" autocomplete="off">
          </label>
          <label class="studio-field">下次怎么做
            <textarea name="instructions" required maxlength="8000" rows="4" placeholder="1. 先把单词拆成词根和词缀。&#10;2. 用同一个词根串起几个词。&#10;3. 合上笔记，再用自己的话解释一次。">${esc(prefill.instructions || '')}</textarea>
          </label>
          <div class="studio-form-footer"><span>保存到你的策略库，可随时编辑</span><button class="primary studio-save" type="submit">${prefill.id ? '保存修改' : '保存并启用'} <span aria-hidden="true">↗</span></button></div>
        </form>
        <aside class="studio-preview-pane" aria-label="策略卡外观预览">
          <div class="studio-preview-label"><span>你的专属策略</span><span aria-hidden="true">LIVE PREVIEW</span></div>
          <div class="studio-preview-stage">
            <div class="studio-preview" data-color="${color}">
              <div class="studio-preview-face">
                <div class="studio-card-top"><span class="studio-card-scene">自主学习</span><img src="./assets/learnflow-logo.svg" alt="LearnFlow学习流动" width="25" height="25"></div>
                <div class="studio-card-art" aria-hidden="true"><i class="studio-art-orbit"></i><i class="studio-art-sheet sheet-back"></i><i class="studio-art-sheet sheet-middle"></i><i class="studio-art-sheet sheet-front"><b></b><b></b><b></b><em>↗</em></i><i class="studio-art-spark">✦</i></div>
                <div class="studio-card-copy"><h3>你的方法，值得留下</h3><p>写下一句话，下次就从这里开始。</p><div class="studio-card-tags"><span>我的方法</span></div></div>
                <div class="studio-card-bottom"><span>LearnFlow <b>学习流动</b></span><span>01 <i aria-hidden="true">↗</i></span></div>
              </div>
            </div>
          </div>
          <fieldset class="studio-colors" form="card-form"><legend>选一个颜色</legend><div>${colors.map(([value, label]) => `<label title="${label}"><input form="card-form" type="radio" name="color" value="${value}" ${color === value ? 'checked' : ''}><span class="studio-swatch" data-color="${value}"><i aria-hidden="true"></i><span>${label}</span></span></label>`).join('')}</div></fieldset>
          <p class="studio-preview-tip">方法是你的，颜色也是。</p>
        </aside>
      </div>`);

    const modal = document.getElementById('modal');
    const root = modal?.querySelector('[data-card-studio]');
    if (!modal || !root) return;
    modal.classList.add('card-studio');
    const controller = new AbortController();
    const signal = controller.signal;
    const form = root.querySelector('#card-form');
    const preview = root.querySelector('.studio-preview');
    const stage = root.querySelector('.studio-preview-stage');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let focusFrame = 0;
    let tilt = { x: 0, y: 0 };

    const reducedMotion = () => document.documentElement.dataset.reducedMotion === 'true' || media.matches;
    const resetTilt = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      preview.style.setProperty('--studio-rx', '0deg');
      preview.style.setProperty('--studio-ry', '0deg');
      preview.style.setProperty('--studio-glow-x', '50%');
      preview.style.setProperty('--studio-glow-y', '25%');
    };
    const updatePreview = () => {
      const values = new FormData(form);
      root.querySelector('.studio-card-copy h3').textContent = String(values.get('title') || '').trim() || '你的方法，值得留下';
      root.querySelector('.studio-card-copy p').textContent = String(values.get('description') || '').trim() || '写下一句话，下次就从这里开始。';
      root.querySelector('.studio-card-scene').textContent = scenes.find(([value]) => value === values.get('scene'))?.[1] || '自主学习';
      const chosenColor = String(values.get('color'));
      preview.dataset.color = colors.some(([value]) => value === chosenColor) ? chosenColor : 'orange';
      const tagList = String(values.get('tags') || '').split(/[,，]/).map(value => value.trim()).filter(Boolean).slice(0, 6);
      const tagContainer = root.querySelector('.studio-card-tags');
      tagContainer.replaceChildren(...(tagList.length ? tagList : ['我的方法']).map(value => {
        const tag = document.createElement('span');
        tag.textContent = value;
        return tag;
      }));
    };

    root.addEventListener('input', updatePreview, { signal });
    root.addEventListener('change', updatePreview, { signal });
    stage.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || reducedMotion()) return;
      const rect = stage.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      tilt = { x, y };
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        preview.style.setProperty('--studio-rx', `${-tilt.y * 6}deg`);
        preview.style.setProperty('--studio-ry', `${tilt.x * 9}deg`);
        preview.style.setProperty('--studio-glow-x', `${50 + tilt.x * 35}%`);
        preview.style.setProperty('--studio-glow-y', `${40 + tilt.y * 30}%`);
      });
    }, { signal });
    stage.addEventListener('pointerleave', resetTilt, { signal });
    const motionChanged = () => { if (reducedMotion()) resetTilt(); };
    media.addEventListener('change', motionChanged, { signal });
    const motionObserver = new MutationObserver(motionChanged);
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
    const contentObserver = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
    contentObserver.observe(document.getElementById('modal-content'), { childList: true });

    function cleanup() {
      controller.abort();
      motionObserver.disconnect();
      contentObserver.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      modal.classList.remove('card-studio');
      if (dispose === cleanup) dispose = null;
    }
    dispose = cleanup;
    modal.addEventListener('close', cleanup, { once: true, signal });
    updatePreview();
    focusFrame = requestAnimationFrame(() => form.elements.title.focus({ preventScroll: true }));
  }

  window.LearnFlowCardStudio = Object.freeze({ open });
})();
