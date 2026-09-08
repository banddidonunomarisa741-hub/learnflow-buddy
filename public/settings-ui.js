(() => {
  'use strict';

  const sections = [
    { id: 'general', label: '常规', icon: 'settings', group: '个人', terms: '目标 时间 引导 交流 鼓励 偏好 路线 初始化' },
    { id: 'appearance', label: '外观', icon: 'type', group: '个人', terms: '主题 深色 浅色 暗色 字体 大小 动画 显示' },
    { id: 'learning', label: '学习策略', icon: 'layers', group: '个人', terms: '方法 skill 卡片 技能 启用 停用 token 评分 收藏' },
    { id: 'memory', label: '学习记忆', icon: 'heart', group: '个人', terms: '偏好 记住 保存 删除 导出 记忆' },
    { id: 'connections', label: '连接与模型', icon: 'plug', group: '集成', terms: '接口 模型 API QQ 微信 腾讯 WorkBuddy LearnBuddy 本地 授权 连接器 提醒' },
    { id: 'teacher', label: '教师反馈', icon: 'clipboard', group: '集成', terms: '教师 老师 评价 证据 草稿 反馈' },
    { id: 'data', label: '数据与备份', icon: 'scan', group: '应用', terms: '导入 导出 清除 恢复 备份 数据 隐私 本地 存储' },
    { id: 'about', label: '关于 LearnFlow', icon: 'sprout', group: '应用', terms: '关于 开源 github 版本 团队 logo' }
  ];

  const glyph = (name) => {
    const paths = { search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', back: 'M19 12H5m6-6-6 6 6 6', check: 'm5 12 4 4L19 6', chevron: 'm8 10 4 4 4-4', sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', moon: 'M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13Z', monitor: 'M3 3h18v13H3zM8 21h8m-4-5v5', arrow: 'm9 5 7 7-7 7', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7' };
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`;
  };

  window.LearnFlowSettings = {
    create(ctx) {
      const { getState, save, toast, esc } = ctx;
      let activeSection = 'general';
      let mountController;
      let searchTerm = '';
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
      const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const readUI = () => ({ theme: 'system', textSize: 'normal', reducedMotion: systemMotion.matches, ...(getState().ui || {}) });

      function applyAppearance() {
        const ui = readUI();
        const resolvedTheme = ui.theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : ui.theme;
        document.documentElement.dataset.theme = resolvedTheme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.textSize = ['compact', 'normal', 'large'].includes(ui.textSize) ? ui.textSize : 'normal';
        document.documentElement.dataset.reducedMotion = String(Boolean(ui.reducedMotion));
        document.documentElement.style.setProperty('--lf-message-font-size', ({ compact: '15px', normal: '17px', large: '19px' })[ui.textSize] || '17px');
        document.documentElement.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
      }
      systemTheme.addEventListener('change', applyAppearance);
      systemMotion.addEventListener('change', applyAppearance);
      applyAppearance();

      function appearanceView() {
        const ui = readUI();
        return `<section class="lf-setting-section"><h2>主题</h2><div class="lf-theme-options" role="group" aria-label="界面主题">${[['light', '浅色', 'sun'], ['dark', '深色', 'moon'], ['system', '跟随系统', 'monitor']].map(([value, label, ic]) => `<button type="button" class="lf-theme-choice" data-ui-key="theme" data-ui-value="${value}" aria-pressed="${ui.theme === value}"><span class="lf-theme-preview" data-preview-theme="${value}" aria-hidden="true"><i></i><span><b></b><em></em><b></b><small></small></span></span><span class="lf-theme-caption">${glyph(ic)}${label}<span class="lf-choice-check">${ui.theme === value ? glyph('check') : ''}</span></span></button>`).join('')}</div></section><section class="lf-setting-section"><div class="lf-setting-row"><h2>对话文字大小</h2><div class="lf-segmented" role="group" aria-label="对话文字大小">${[['compact', '小'], ['normal', '标准'], ['large', '大']].map(([value, label]) => `<button type="button" data-ui-key="textSize" data-ui-value="${value}" aria-pressed="${ui.textSize === value}">${label}</button>`).join('')}</div></div><div class="lf-type-preview" aria-label="文字预览"><p>这是对话文字的显示效果。</p></div></section><section class="lf-setting-section"><label class="lf-setting-row"><span><strong>减少动态效果</strong><small>关闭界面过渡和滚动动画</small></span><input class="toggle" type="checkbox" data-ui-motion ${ui.reducedMotion ? 'checked' : ''}></label></section>`;
      }

      function dataView() {
        const state = getState();
        const counts = [['个人策略', state.custom?.length || 0], ['学习记忆', state.memories?.length || 0], ['看板任务', state.tasks?.length || 0]];
        return `<section class="lf-setting-section"><h2>本机数据</h2><p class="lf-settings-muted">仅保存在当前浏览器，换设备需导入备份。</p><div class="lf-data-counts">${counts.map(([label, count]) => `<div><strong>${count}</strong><span>${label}</span></div>`).join('')}</div></section><section class="lf-setting-section lf-data-actions"><div class="lf-setting-row"><div><h3>导出备份</h3><p>包含偏好、策略、记忆、已保存的对话和项目分组。</p></div><button type="button" class="secondary" data-action="export-all">${glyph('download')}导出</button></div><div class="lf-setting-row"><div><h3>恢复备份</h3><p>选择文件后预览，确认后替换当前数据。</p></div><button type="button" class="secondary" data-action="restore-backup">${glyph('upload')}选择文件</button></div><div class="lf-setting-row"><h3>导出已启用的策略</h3><button type="button" class="secondary" data-action="export-strategies">导出策略</button></div></section><section class="lf-setting-section"><div class="lf-setting-row"><h3>清除本机学习数据</h3><button type="button" class="secondary danger" data-action="clear-data">${glyph('trash')}清除</button></div></section><details class="lf-settings-help"><summary>备份说明</summary><p>备份包含个人学习记录。学习资料的原始文件需另行保存。</p></details>`;
      }

      function contentView(section) {
        if (section === 'appearance') return appearanceView();
        if (section === 'data') return dataView();
        const source = { general: 'preferences', learning: 'mine', memory: 'memory', connections: 'connectors', teacher: 'teacher', about: 'about' }[section];
        const view = ctx.views[source];
        return `${section === 'general' ? `<div class="lf-settings-start"><h2>学习路线</h2><button type="button" class="secondary" data-action="onboard">重新设置 ${glyph('arrow')}</button></div>` : ''}<div class="lf-settings-embedded" data-embedded-section="${section}">${view ? view() : ''}</div>`;
      }

      function view(section = 'general') {
        activeSection = sections.some(item => item.id === section) ? section : 'general';
        const current = sections.find(item => item.id === activeSection);
        const rawBack = ctx.backTarget?.() || '#home';
        const back = rawBack.startsWith('#') ? rawBack : `#${rawBack}`;
        return `<div class="lf-settings" data-settings-section="${activeSection}"><aside class="lf-settings-sidebar" aria-label="设置导航"><a class="lf-settings-back" href="${esc(back)}">${glyph('back')}<span>返回学习</span></a><div class="lf-settings-search">${glyph('search')}<input id="lf-settings-search" type="search" autocomplete="off" placeholder="搜索设置" aria-label="搜索设置" aria-controls="lf-settings-navigation" value="${esc(searchTerm)}"><kbd aria-hidden="true">/</kbd></div><nav id="lf-settings-navigation">${['个人', '集成', '应用'].map(group => `<div class="lf-settings-navgroup"><h2>${group}</h2>${sections.filter(item => item.group === group).map(item => `<a href="#settings/${item.id}" class="lf-settings-navitem ${item.id === activeSection ? 'active' : ''}" data-settings-id="${item.id}" data-settings-search="${esc(`${item.label} ${item.terms}`.toLowerCase())}" ${item.id === activeSection ? 'aria-current="page"' : ''}>${ctx.icon(item.icon)}<span>${item.label}</span></a>`).join('')}</div>`).join('')}</nav><p id="lf-settings-search-status" role="status" class="lf-settings-search-status" hidden></p></aside><section class="lf-settings-main" aria-labelledby="lf-settings-title"><div class="lf-settings-content"><header class="lf-settings-heading"><h1 id="lf-settings-title" tabindex="-1">${current.label}</h1></header><div id="lf-settings-content">${contentView(activeSection)}</div></div></section></div>`;
      }

      function mount() {
        mountController?.abort();
        mountController = new AbortController();
        const { signal } = mountController;
        const root = document.querySelector('.lf-settings');
        if (!root) return;
        applyAppearance();

        const input = root.querySelector('#lf-settings-search');
        const filterNavigation = () => {
          searchTerm = input.value;
          const term = searchTerm.trim().toLowerCase();
          let count = 0;
          root.querySelectorAll('[data-settings-search]').forEach(link => {
            const matches = !term || term.split(/\s+/).every(word => link.dataset.settingsSearch.includes(word));
            link.hidden = !matches;
            if (matches) count++;
          });
          root.querySelectorAll('.lf-settings-navgroup').forEach(group => { group.hidden = !group.querySelector('.lf-settings-navitem:not([hidden])'); });
          const status = root.querySelector('#lf-settings-search-status');
          status.hidden = !term;
          status.textContent = count ? `找到 ${count} 项设置` : '没有找到。试试“模型”“记忆”或“备份”。';
        };
        input.addEventListener('input', filterNavigation, { signal });
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') root.querySelector('.lf-settings-navitem:not([hidden])')?.click();
          if (event.key === 'Escape' && input.value) { input.value = ''; filterNavigation(); event.preventDefault(); event.stopPropagation(); }
        }, { signal });
        filterNavigation();
        if (window.matchMedia('(max-width: 720px)').matches) {
          const nav = root.querySelector('#lf-settings-navigation');
          const active = nav.querySelector('[aria-current="page"]:not([hidden])');
          if (active) nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
        }

        root.addEventListener('click', event => {
          const button = event.target.closest('[data-ui-key]');
          if (!button) return;
          const key = button.dataset.uiKey;
          const value = button.dataset.uiValue;
          const allowed = { theme: ['light', 'dark', 'system'], textSize: ['compact', 'normal', 'large'] };
          if (!allowed[key]?.includes(value)) return;
          getState().ui = { ...readUI(), [key]: value };
          save();
          applyAppearance();
          root.querySelectorAll(`[data-ui-key="${key}"]`).forEach(option => {
            const checked = option.dataset.uiValue === value;
            option.setAttribute('aria-pressed', String(checked));
            const check = option.querySelector('.lf-choice-check');
            if (check) check.innerHTML = checked ? glyph('check') : '';
          });
          window.dispatchEvent(new CustomEvent('learnflow:appearance-changed', { detail: readUI() }));
        }, { signal });
        root.querySelector('[data-ui-motion]')?.addEventListener('change', event => {
          getState().ui = { ...readUI(), reducedMotion: event.target.checked };
          save(); applyAppearance();
          window.dispatchEvent(new CustomEvent('learnflow:appearance-changed', { detail: readUI() }));
        }, { signal });

        document.addEventListener('keydown', event => {
          if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches('input,textarea,select,[contenteditable="true"]') && !document.querySelector('dialog[open]')) {
            event.preventDefault(); input.focus();
          }
        }, { signal });

        // Keep the existing form and its delegated submit handler; improve only its controls.
        root.querySelectorAll('#settings-form select').forEach((select, index) => mountSelect(select, index, signal));
        const preferences = root.querySelector('#settings-form');
        preferences?.addEventListener('change', () => {
          const button = preferences.querySelector('[type="submit"]');
          if (button) { button.textContent = '保存更改'; button.classList.add('has-changes'); }
        }, { signal });
        preferences?.addEventListener('input', () => {
          const button = preferences.querySelector('[type="submit"]');
          if (button) { button.textContent = '保存更改'; button.classList.add('has-changes'); }
        }, { signal });
        preferences?.addEventListener('submit', () => {
          const button = preferences.querySelector('[type="submit"]');
          if (button) { button.textContent = '保存偏好'; button.classList.remove('has-changes'); }
        }, { signal });

        if (activeSection === 'connections') window.LearnFlowEcosystem?.mount();
      }

      function mountSelect(select, index, signal) {
        if (select.dataset.enhanced) return;
        select.dataset.enhanced = 'true';
        const labelClone = select.closest('label')?.cloneNode(true);
        labelClone?.querySelectorAll('select,input,textarea').forEach(node => node.remove());
        const name = labelClone?.textContent.trim() || '选择偏好';
        const wrapper = document.createElement('div');
        wrapper.className = 'lf-preference-select';
        wrapper.innerHTML = `<button class="lf-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(name)}" aria-controls="lf-preference-options-${index}"><span>${esc(select.selectedOptions[0]?.textContent || '')}</span>${glyph('chevron')}</button><div class="lf-select-options" id="lf-preference-options-${index}" role="listbox" aria-label="${esc(name)}" hidden>${[...select.options].map(option => `<button type="button" role="option" data-value="${esc(option.value)}" aria-selected="${option.selected}" ${option.disabled ? 'disabled' : ''}>${esc(option.textContent)}<span>${option.selected ? glyph('check') : ''}</span></button>`).join('')}</div>`;
        select.hidden = true;
        select.after(wrapper);
        const trigger = wrapper.querySelector('.lf-select-trigger');
        const options = wrapper.querySelector('.lf-select-options');
        const buttons = [...options.querySelectorAll('button:not(:disabled)')];
        const close = (focus = false) => { options.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focus) trigger.focus(); };
        const open = () => { options.hidden = false; trigger.setAttribute('aria-expanded', 'true'); (buttons.find(button => button.getAttribute('aria-selected') === 'true') || buttons[0])?.focus(); };
        trigger.addEventListener('click', () => options.hidden ? open() : close(), { signal });
        trigger.addEventListener('keydown', event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); } }, { signal });
        options.addEventListener('click', event => {
          const button = event.target.closest('[data-value]');
          if (!button || button.disabled) return;
          select.value = button.dataset.value;
          trigger.querySelector('span').textContent = select.selectedOptions[0]?.textContent || '';
          buttons.forEach(option => { const checked = option === button; option.setAttribute('aria-selected', String(checked)); option.querySelector('span').innerHTML = checked ? glyph('check') : ''; });
          close(true);
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }, { signal });
        options.addEventListener('keydown', event => {
          const index = buttons.indexOf(document.activeElement);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
          else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus(); }
          else if (event.key === 'Escape') { event.preventDefault(); close(true); }
          else if (event.key === 'Tab') close();
        }, { signal });
        document.addEventListener('click', event => { if (!wrapper.contains(event.target)) close(); }, { signal });
      }

      return { view, mount, applyAppearance };
    }
  };
})();
