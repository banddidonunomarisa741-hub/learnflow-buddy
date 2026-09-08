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
    const examples = Array.isArray(prefill.examples) ? prefill.examples.filter(value => typeof value === 'string').join('\n\n---\n\n') : String(prefill.examples || '');

    showModal(`${modalHead(prefill.id ? '编辑策略' : '新建策略')}
      <div class="studio-layout" data-card-studio>
        <form id="card-form" class="studio-form" data-id="${esc(prefill.id || '')}">
          <label class="studio-field">策略名称
            <input name="title" required maxlength="160" placeholder="例如：把单词拆开记" value="${esc(prefill.title || '')}" autocomplete="off">
          </label>
          <fieldset class="studio-scene"><legend>适用场景</legend><div class="studio-scene-options">${scenes.map(([value, label]) => `<label><input type="radio" name="scene" value="${value}" ${scene === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset>
          <label class="studio-field">标签 <span class="studio-field-hint">逗号分隔，最多 24 个</span>
            <input name="tags" maxlength="2000" placeholder="例如：英语，词根，主动回忆" value="${esc(tags)}" autocomplete="off">
          </label>
          <label class="studio-field">方法介绍
            <textarea name="description" required maxlength="3000" rows="2" style="min-height:76px" placeholder="这个方法，帮你解决了什么？">${esc(prefill.description || '')}</textarea>
          </label>
          <label class="studio-field">使用步骤
            <textarea name="instructions" required maxlength="8000" rows="4" placeholder="1. 先把单词拆成词根和词缀。&#10;2. 用同一个词根串起几个词。&#10;3. 合上笔记，再用自己的话解释一次。">${esc(prefill.instructions || '')}</textarea>
          </label>
          <details class="ui-help studio-examples">
            <summary>示例与适用边界（可选）</summary>
            <label class="studio-field" style="margin-top:16px">使用示例 <span class="studio-field-hint">例子之间用一行 --- 分隔</span>
              <textarea name="examples" maxlength="24500" rows="4" placeholder="学习者：我总把 affect 和 effect 弄混。&#10;助手：先看这个句子，需要一个动作还是一个名词？&#10;&#10;---&#10;&#10;这里可以再写一个例子。">${esc(examples)}</textarea>
            </label>
            <label class="studio-field">适用边界
              <textarea name="limits" maxlength="3000" rows="2" style="min-height:76px" placeholder="什么情况下不适合？什么时候应该换个办法？">${esc(prefill.limits || '')}</textarea>
            </label>
            <label class="studio-field">方法依据
              <textarea name="evidence" maxlength="3000" rows="2" style="min-height:76px" placeholder="可以写自己的使用经历、参考资料，或仍待验证的部分。">${esc(prefill.evidence || '')}</textarea>
            </label>
          </details>
          <div class="studio-form-footer"><button class="primary studio-save" type="submit">${prefill.id ? '保存修改' : '保存并启用'}</button></div>
        </form>
        <aside class="studio-preview-pane" aria-label="策略卡外观预览">
          <div class="studio-preview-label">卡片预览</div>
          <div class="studio-preview-stage">
            <div class="studio-preview" data-color="${color}">
              <div class="studio-preview-face">
                <div class="studio-card-top"><span class="studio-card-scene">自主学习</span><img src="./assets/learnflow-logo.svg" alt="LearnFlow学习流动" width="25" height="25"></div>
                <div class="studio-card-art" aria-hidden="true"><i class="studio-art-orbit"></i><i class="studio-art-sheet sheet-back"></i><i class="studio-art-sheet sheet-middle"></i><i class="studio-art-sheet sheet-front"><b></b><b></b><b></b><em>↗</em></i><i class="studio-art-spark">✦</i></div>
                <div class="studio-card-copy"><h3>策略名称</h3><p>填写方法介绍</p><div class="studio-card-tags"><span>我的方法</span></div></div>
              </div>
            </div>
          </div>
          <fieldset class="studio-colors" form="card-form"><legend>选一个颜色</legend><div>${colors.map(([value, label]) => `<label title="${label}"><input form="card-form" type="radio" name="color" value="${value}" ${color === value ? 'checked' : ''}><span class="studio-swatch" data-color="${value}"><i aria-hidden="true"></i><span>${label}</span></span></label>`).join('')}</div></fieldset>
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
    const validateDetails = () => {
      const tagValues = form.elements.tags.value.split(/[,，]/).map(value => value.trim()).filter(Boolean);
      const exampleValues = form.elements.examples.value.split(/\n\s*---\s*\n/).map(value => value.trim()).filter(Boolean);
      form.elements.tags.setCustomValidity(tagValues.length > 24 ? '标签最多 24 个。' : tagValues.some(value => value.length > 80) ? '每个标签最多 80 字。' : '');
      form.elements.examples.setCustomValidity(exampleValues.length > 12 ? '使用示例最多 12 个。' : exampleValues.some(value => value.length > 2000) ? '每个示例最多 2000 字；多个例子用独占一行的 --- 分隔。' : '');
      return !form.elements.tags.validationMessage && !form.elements.examples.validationMessage;
    };
    const resetTilt = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      preview.style.setProperty('--studio-rx', '0deg');
      preview.style.setProperty('--studio-ry', '0deg');
      preview.style.setProperty('--studio-glow-x', '50%');
      preview.style.setProperty('--studio-glow-y', '25%');
    };
    const updatePreview = () => {
      validateDetails();
      const values = new FormData(form);
      root.querySelector('.studio-card-copy h3').textContent = String(values.get('title') || '').trim() || '策略名称';
      root.querySelector('.studio-card-copy p').textContent = String(values.get('description') || '').trim() || '填写方法介绍';
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
    form.addEventListener('submit', event => {
      if (!validateDetails()) {
        event.preventDefault(); event.stopPropagation();
        if (form.elements.examples.validationMessage) root.querySelector('.studio-examples').open = true;
        form.reportValidity();
      }
    }, { signal });
    form.elements.examples.addEventListener('invalid', () => { root.querySelector('.studio-examples').open = true; }, { signal });
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
