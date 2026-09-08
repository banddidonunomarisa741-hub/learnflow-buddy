/* Conversation organization only. This store never contains message bodies or session titles. */
(() => {
  'use strict';
  const KEY = 'learnflow.sidebar.v1';
  const blank = () => ({version: 1, projects: [], looseOrder: []});
  const unique = values => [...new Set(values)];
  const svg = name => `<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true">${{
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    chat: '<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2z"/>',
    grip: '<path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"/>',
    up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z"/>',
    remove: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  }[name] || ''}</svg>`;

  function normalize(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.projects) || !Array.isArray(value.looseOrder)) throw Error('项目与对话排序文件的格式不正确。');
    if (value.projects.length > 100 || value.looseOrder.length > 5000) throw Error('项目数量或排序记录过多，请分批整理。');
    const assigned = new Set(), projectIds = new Set();
    const id = value => typeof value === 'string' && value.length > 0 && value.length <= 180 && !/[\u0000-\u001f]/.test(value);
    const projects = value.projects.map(project => {
      if (!project || !id(project.id) || projectIds.has(project.id) || typeof project.name !== 'string' || !project.name.trim() || !Array.isArray(project.sessionIds) || project.sessionIds.length > 5000) throw Error('有一项项目记录无法读取。');
      projectIds.add(project.id);
      const sessionIds = project.sessionIds.filter(value => {
        if (!id(value)) throw Error('项目中的对话编号格式不正确。');
        if (assigned.has(value)) return false;
        assigned.add(value); return true;
      });
      return {id: project.id, name: project.name.trim().slice(0, 40), collapsed: !!project.collapsed, sessionIds};
    });
    const looseOrder = unique(value.looseOrder.filter(value => {
      if (!id(value)) throw Error('对话排序中的编号格式不正确。');
      return !assigned.has(value);
    }));
    return {version: 1, projects, looseOrder};
  }

  window.LearnFlowSidebar = {create({esc, toast = () => {}, getSessions = () => [], getActiveId = () => '', onOpenSession = () => {}, onNewSession = () => {}, onChange = () => {}}) {
    let data; try { const stored = localStorage.getItem(KEY); data = stored ? normalize(JSON.parse(stored)) : blank(); } catch { data = blank(); }
    let container = null, sessions = [], renderToken = 0, popup = null, drag = null, animation = 0, suppressClickUntil = 0, dead = false;
    const events = new AbortController();
    const clone = () => JSON.parse(JSON.stringify(data));
    const projectBy = id => data.projects.find(project => project.id === id);
    const sessionBy = id => sessions.find(session => session.id === id);
    const groupFor = id => data.projects.find(project => project.sessionIds.includes(id))?.id || '';
    const sessionTitle = session => String(session?.title || session?.messages?.find(message => message.role === 'user' && message.content)?.content || '未命名对话').trim().slice(0, 120);
    const rows = group => {
      const list = sessions.filter(session => groupFor(session.id) === group);
      const order = group ? projectBy(group)?.sessionIds || [] : data.looseOrder;
      const byId = new Map(list.map(session => [session.id, session]));
      return [...list.filter(session => !order.includes(session.id)), ...order.map(id => byId.get(id)).filter(Boolean)];
    };
    function changed(type) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { toast('项目排序暂时没有保存，请导出备份。'); }
      paint(); onChange({type, data: clone()});
    }
    function row(session, group) {
      const title = sessionTitle(session), active = String(getActiveId() ?? '') === session.id;
      return `<div class="ws-session-row ${active ? 'is-active' : ''}" data-ws-session="${esc(session.id)}" data-ws-group="${esc(group)}"><button class="ws-drag-handle" data-ws-drag="session" data-ws-id="${esc(session.id)}" aria-label="拖动对话：${esc(title)}" title="拖动排序，也可以使用右侧菜单">${svg('grip')}</button><button class="ws-session-open" data-ws-action="open-session" data-ws-id="${esc(session.id)}" ${active ? 'aria-current="page"' : ''} title="${esc(title)}">${esc(title)}</button><button class="ws-row-menu" data-ws-action="session-menu" data-ws-id="${esc(session.id)}" aria-label="移动或排序对话：${esc(title)}" title="移动与排序">${svg('more')}</button></div>`;
    }
    function paint() {
      if (!container?.isConnected || dead || drag) return;
      const scroll = container.scrollTop, focused = container.contains(document.activeElement) ? document.activeElement : null;
      const focusAction = focused?.dataset.wsAction, focusId = focused?.dataset.wsId;
      container.classList.add('ws-host');
      container.innerHTML = `<div class="ws-workspace"><div class="ws-section-heading"><span>项目</span><button class="ws-heading-action" data-ws-action="create-project" aria-label="新增项目" title="新增项目">${svg('plus')}</button></div><div class="ws-projects">${data.projects.map(project => {
        const list = rows(project.id);
        return `<section class="ws-project ${project.collapsed ? 'is-collapsed' : ''}" data-ws-project="${esc(project.id)}"><div class="ws-project-row"><button class="ws-drag-handle" data-ws-drag="project" data-ws-id="${esc(project.id)}" aria-label="拖动项目：${esc(project.name)}" title="拖动项目排序">${svg('grip')}</button><button class="ws-project-toggle" data-ws-action="toggle-project" data-ws-id="${esc(project.id)}" aria-expanded="${!project.collapsed}" aria-controls="ws-project-${esc(project.id)}"><span class="ws-folder">${svg('folder')}</span><span class="ws-project-name">${esc(project.name)}</span><span class="ws-count">${list.length}</span><span class="ws-chevron">${svg('chevron')}</span></button><button class="ws-row-menu" data-ws-action="project-menu" data-ws-id="${esc(project.id)}" aria-label="项目选项：${esc(project.name)}">${svg('more')}</button></div><div class="ws-project-content" id="ws-project-${esc(project.id)}" ${project.collapsed ? 'hidden' : ''}>${list.map(session => row(session, project.id)).join('')}<button class="ws-new-project-chat" data-ws-action="new-project-chat" data-ws-id="${esc(project.id)}">${svg('plus')}<span>新对话</span></button></div></section>`;
      }).join('')}${!data.projects.length ? '<button class="ws-project-placeholder" data-ws-action="create-project">'+svg('folder')+'<span>新建项目</span></button>' : ''}</div><div class="ws-section-heading ws-conversation-heading"><span>对话</span></div><div class="ws-loose-drop" data-ws-drop-group="">${rows('').map(session => row(session, '')).join('')}${!rows('').length ? '<div class="ws-loose-empty">暂无对话</div>' : '<div class="ws-drop-tail" aria-hidden="true"></div>'}</div><div class="ws-live" role="status" aria-live="polite" aria-atomic="true"></div></div>`;
      container.scrollTop = scroll;
      if (focusAction) [...container.querySelectorAll('[data-ws-action]')].find(element => element.dataset.wsAction === focusAction && element.dataset.wsId === focusId)?.focus({preventScroll: true});
    }
    async function render(nextContainer = container) {
      if (dead || !nextContainer) return;
      const token = ++renderToken;
      if (nextContainer !== container) {
        container?.removeEventListener('click', handleClick); container?.removeEventListener('pointerdown', pointerDown);
        container = nextContainer;
        container.addEventListener('click', handleClick, {signal: events.signal});
        container.addEventListener('pointerdown', pointerDown, {signal: events.signal});
      }
      try {
        const result = await getSessions();
        if (token !== renderToken || dead) return;
        const seen = new Set();
        sessions = (Array.isArray(result) ? result : []).filter(session => {
          if (!session || !['string', 'number'].includes(typeof session.id) || seen.has(String(session.id)) || !Array.isArray(session.messages) || !session.messages.some(message => ['user', 'assistant'].includes(message.role) && String(message.content || '').trim())) return false;
          seen.add(String(session.id)); return true;
        }).map(session => ({...session, id: String(session.id)}));
        paint();
      } catch { if (token === renderToken) toast('暂时没有读到对话列表，请稍后重试。'); }
    }
    function closePopup() { popup?.close(); }
    function dialog(title, body) {
      closePopup();
      const element = document.createElement('dialog');
      element.className = 'ws-dialog';
      element.innerHTML = `<header class="ws-dialog-heading"><h2>${esc(title)}</h2><button data-ws-action="close-popup" class="ws-dialog-close" aria-label="关闭">${svg('close')}</button></header><div class="ws-dialog-body">${body}</div>`;
      document.body.append(element); popup = element;
      element.addEventListener('click', handleClick);
      element.addEventListener('close', () => {element.remove(); if (popup === element) popup = null;}, {once: true});
      element.showModal();
      return element;
    }
    function projectForm(id = '') {
      const project = projectBy(id);
      if (!project && data.projects.length >= 100) {toast('先整理一下已有项目，最多可以保留 100 个。'); return;}
      const element = dialog(project ? '重命名项目' : '新建项目', `<form class="ws-name-form"><label>项目名称<input name="name" required maxlength="40" autocomplete="off" value="${esc(project?.name || '')}" placeholder="输入项目名称"></label><div class="ws-form-error" role="status"></div><button type="submit" class="ws-primary">${project ? '保存' : '创建'}</button></form>`);
      element.querySelector('form').addEventListener('submit', event => {
        event.preventDefault(); const name = element.querySelector('[name=name]').value.trim();
        if (!name || data.projects.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {element.querySelector('.ws-form-error').textContent = name ? '已经有同名项目，换一个更容易分辨的名字吧。' : '先给项目起个名字。'; return;}
        if (project) project.name = name;
        else data.projects.push({id: 'project-' + crypto.randomUUID(), name, collapsed: false, sessionIds: []});
        closePopup(); changed(project ? 'rename-project' : 'create-project');
      });
      element.querySelector('[name=name]').focus();
    }
    function projectMenu(id) {
      const project = projectBy(id); if (!project) return;
      const index = data.projects.indexOf(project);
      dialog(project.name, `<div class="ws-menu-list"><button data-ws-action="new-project-chat" data-ws-id="${esc(id)}">${svg('plus')}新对话</button><button data-ws-action="rename-project" data-ws-id="${esc(id)}">${svg('edit')}重命名</button><div class="ws-menu-divider"></div><button data-ws-action="project-up" data-ws-id="${esc(id)}" ${index === 0 ? 'disabled' : ''}>${svg('up')}向上移动</button><button data-ws-action="project-down" data-ws-id="${esc(id)}" ${index === data.projects.length - 1 ? 'disabled' : ''}>${svg('down')}向下移动</button><div class="ws-menu-divider"></div><button class="ws-danger" data-ws-action="delete-project" data-ws-id="${esc(id)}">${svg('remove')}删除项目</button></div>`);
    }
    function sessionMenu(id) {
      const session = sessionBy(id); if (!session) return;
      const group = groupFor(id), list = rows(group), index = list.findIndex(item => item.id === id);
      const element = dialog('移动对话', `<p class="ws-moving-title">${esc(sessionTitle(session))}</p><div class="ws-menu-label">移动到</div><div class="ws-menu-list ws-destination-list"><button data-ws-action="move-session" data-ws-id="${esc(id)}" data-ws-target="" ${!group ? 'aria-current="true"' : ''}>${svg('chat')}<span>未分组对话</span>${!group ? svg('check') : ''}</button>${data.projects.map(project => `<button data-ws-action="move-session" data-ws-id="${esc(id)}" data-ws-target="${esc(project.id)}" ${group === project.id ? 'aria-current="true"' : ''}>${svg('folder')}<span>${esc(project.name)}</span>${group === project.id ? svg('check') : ''}</button>`).join('')}</div><div class="ws-menu-divider"></div><div class="ws-menu-label">排序</div><div class="ws-menu-order"><button data-ws-action="session-up" data-ws-id="${esc(id)}" ${index <= 0 ? 'disabled' : ''}>${svg('up')}上移一位</button><button data-ws-action="session-down" data-ws-id="${esc(id)}" ${index >= list.length - 1 ? 'disabled' : ''}>${svg('down')}下移一位</button></div>`);
      element.querySelector('[aria-current]')?.focus({preventScroll: true});
    }
    function moveSession(id, targetGroup, position = Infinity) {
      if (targetGroup && !projectBy(targetGroup)) return;
      const target = rows(targetGroup).map(item => item.id).filter(value => value !== id);
      target.splice(Math.max(0, Math.min(target.length, position)), 0, id);
      const prior = targetGroup ? projectBy(targetGroup).sessionIds : data.looseOrder;
      const stale = prior.filter(value => value !== id && !sessions.some(session => session.id === value));
      data.projects.forEach(project => {project.sessionIds = project.sessionIds.filter(value => value !== id);});
      data.looseOrder = data.looseOrder.filter(value => value !== id);
      if (targetGroup) projectBy(targetGroup).sessionIds = unique([...target, ...stale]);
      else data.looseOrder = unique([...target, ...stale]);
      changed('move-session');
    }
    function moveProject(id, position) {
      const project = projectBy(id); if (!project) return;
      data.projects = data.projects.filter(item => item.id !== id);
      data.projects.splice(Math.max(0, Math.min(data.projects.length, position)), 0, project);
      changed('move-project');
    }
    function deleteProject(id) {
      const project = projectBy(id); if (!project) return;
      const element = dialog('删除项目', `<p class="ws-delete-copy">“${esc(project.name)}”里的对话会移回侧栏的「对话」，内容和会话记录都会保留。</p><div class="ws-dialog-actions"><button class="ws-secondary" data-ws-action="close-popup">保留项目</button><button class="ws-primary" data-ws-confirm-delete>删除项目</button></div>`);
      element.querySelector('[data-ws-confirm-delete]').onclick = () => {
        data.looseOrder = unique([...project.sessionIds, ...data.looseOrder]);
        data.projects = data.projects.filter(item => item.id !== id);
        closePopup(); changed('delete-project'); toast('项目已删除，对话已保留。');
      };
    }
    async function handleClick(event) {
      const button = event.target.closest('[data-ws-action]'); if (!button) return;
      event.preventDefault(); event.stopPropagation();
      if (performance.now() < suppressClickUntil) return;
      const {wsAction: action, wsId: id, wsTarget: target} = button.dataset;
      try {
        if (action === 'close-popup') closePopup();
        else if (action === 'create-project') projectForm();
        else if (action === 'rename-project') projectForm(id);
        else if (action === 'project-menu') projectMenu(id);
        else if (action === 'session-menu') sessionMenu(id);
        else if (action === 'delete-project') deleteProject(id);
        else if (action === 'toggle-project') {const project = projectBy(id); if (project) {project.collapsed = !project.collapsed; changed('toggle-project');}}
        else if (action === 'open-session') onOpenSession(id);
        else if (action === 'new-project-chat') {
          closePopup(); const result = await onNewSession(id); const rawId = result && typeof result === 'object' ? result.id : result; const sessionId = ['string', 'number'].includes(typeof rawId) ? String(rawId) : '';
          if (sessionId && projectBy(id)) {projectBy(id).collapsed = false; moveSession(sessionId, id); await render();}
        } else if (action === 'move-session') {closePopup(); moveSession(id, target); toast(target ? '已移入“' + projectBy(target)?.name + '”。' : '已移回未分组对话。');}
        else if (action === 'session-up' || action === 'session-down') {const group = groupFor(id), index = rows(group).findIndex(item => item.id === id); closePopup(); moveSession(id, group, index + (action === 'session-up' ? -1 : 1));}
        else if (action === 'project-up' || action === 'project-down') {const index = data.projects.findIndex(item => item.id === id); closePopup(); moveProject(id, index + (action === 'project-up' ? -1 : 1));}
      } catch (error) {toast(error.message || '这次没有整理成功，请再试一次。');}
    }

    function pointerDown(event) {
      if (drag || popup?.open || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const handle = event.target.closest('[data-ws-drag]');
      const title = event.pointerType === 'mouse' ? event.target.closest('.ws-session-open') : null;
      if (!handle && !title) return;
      const source = handle || title, kind = handle?.dataset.wsDrag || 'session', id = source.dataset.wsId;
      if (handle) event.preventDefault();
      drag = {kind, id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, target: null, source: kind === 'project' ? source.closest('.ws-project-row') : source.closest('.ws-session-row')};
      if (handle) container.setPointerCapture?.(event.pointerId);
    }
    function activateDrag() {
      if (!drag?.source) return;
      drag.active = true;
      container.setPointerCapture?.(drag.pointerId);
      const rect = drag.source.getBoundingClientRect();
      drag.ghost = drag.source.cloneNode(true); drag.ghost.classList.add('ws-drag-ghost'); drag.ghost.inert = true; drag.ghost.setAttribute('aria-hidden', 'true'); drag.ghost.style.width = Math.min(rect.width, innerWidth - 35) + 'px'; document.body.append(drag.ghost);
      drag.marker = document.createElement('div'); drag.marker.className = 'ws-drop-marker'; drag.marker.setAttribute('aria-hidden', 'true'); document.body.append(drag.marker);
      drag.source.classList.add('ws-is-dragging'); container.classList.add('ws-drag-active');
      container.querySelector('.ws-live').textContent = '正在拖动。松开放置，按 Escape 取消。';
    }
    function targetAt(x, y) {
      const element = document.elementFromPoint(x, y); if (!element || !container?.contains(element)) return null;
      const projectElement = element.closest('[data-ws-project]');
      if (drag.kind === 'project') {
        if (!projectElement || projectElement.dataset.wsProject === drag.id) return null;
        const header = projectElement.querySelector('.ws-project-row'), rect = header.getBoundingClientRect();
        const targetId = projectElement.dataset.wsProject;
        const list = data.projects.filter(project => project.id !== drag.id), after = y > rect.top + rect.height / 2;
        return {kind: 'project', position: list.findIndex(project => project.id === targetId) + (after ? 1 : 0), rect, after};
      }
      const row = element.closest('.ws-session-row');
      if (row) {
        if (row.dataset.wsSession === drag.id) return null;
        const group = row.dataset.wsGroup, rect = row.getBoundingClientRect(), after = y > rect.top + rect.height / 2;
        const list = rows(group).filter(session => session.id !== drag.id);
        return {kind: 'session', group, position: list.findIndex(session => session.id === row.dataset.wsSession) + (after ? 1 : 0), rect, after};
      }
      if (projectElement) return {kind: 'session', group: projectElement.dataset.wsProject, position: Infinity, highlight: projectElement.querySelector('.ws-project-row')};
      const loose = element.closest('.ws-loose-drop') || (element.closest('.ws-conversation-heading') ? container.querySelector('.ws-loose-drop') : null);
      if (loose) return {kind: 'session', group: '', position: Infinity, highlight: loose};
      return null;
    }
    function dragFrame() {
      animation = 0; if (!drag?.active) return;
      drag.ghost.style.left = Math.min(innerWidth - drag.ghost.offsetWidth - 8, Math.max(8, drag.x + 12)) + 'px';
      drag.ghost.style.top = Math.min(innerHeight - 50, Math.max(8, drag.y + 10)) + 'px';
      drag.highlight?.classList.remove('ws-drop-target');
      drag.target = targetAt(drag.x, drag.y); drag.highlight = drag.target?.highlight;
      drag.highlight?.classList.add('ws-drop-target');
      drag.marker.hidden = !drag.target?.rect;
      if (drag.target?.rect) {const {rect, after} = drag.target; Object.assign(drag.marker.style, {left: rect.left + 'px', top: (after ? rect.bottom : rect.top) + 'px', width: rect.width + 'px'});}
      const bounds = container.getBoundingClientRect(), inBounds = drag.x >= bounds.left && drag.x <= bounds.right;
      const direction = inBounds && drag.y < bounds.top + 28 ? -1 : inBounds && drag.y > bounds.bottom - 28 ? 1 : 0;
      if (direction && drag.y >= bounds.top - 20 && drag.y <= bounds.bottom + 20) {const prior = container.scrollTop; container.scrollTop += direction * 8; if (container.scrollTop !== prior) animation = requestAnimationFrame(dragFrame);}
    }
    function pointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x = event.clientX; drag.y = event.clientY;
      if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 7) activateDrag();
      if (drag.active) {event.preventDefault(); if (!animation) animation = requestAnimationFrame(dragFrame);}
    }
    function endDrag(commit) {
      if (!drag) return;
      if (drag.active) dragFrame();
      const finished = drag; drag = null; cancelAnimationFrame(animation); animation = 0;
      try {container?.releasePointerCapture?.(finished.pointerId);} catch {}
      finished.ghost?.remove(); finished.marker?.remove(); finished.highlight?.classList.remove('ws-drop-target'); finished.source?.classList.remove('ws-is-dragging'); container?.classList.remove('ws-drag-active');
      if (finished.active) {
        suppressClickUntil = performance.now() + 300;
        if (commit && finished.target) {
          if (finished.kind === 'project') moveProject(finished.id, finished.target.position);
          else moveSession(finished.id, finished.target.group, finished.target.position);
          const live = container?.querySelector('.ws-live'); if (live) live.textContent = '已放好。';
        } else {paint(); const live = container?.querySelector('.ws-live'); if (live) live.textContent = '已取消拖动。';}
      }
    }
    document.addEventListener('pointermove', pointerMove, {signal: events.signal, passive: false});
    document.addEventListener('pointerup', event => {if (drag?.pointerId === event.pointerId) endDrag(true);}, {signal: events.signal});
    document.addEventListener('pointercancel', event => {if (drag?.pointerId === event.pointerId) endDrag(false);}, {signal: events.signal});
    document.addEventListener('keydown', event => {if (event.key === 'Escape' && drag) {event.preventDefault(); endDrag(false);}}, {signal: events.signal});
    window.addEventListener('blur', () => endDrag(false), {signal: events.signal});

    return {
      render,
      exportData: clone,
      validateData(value) {return value == null ? blank() : normalize(value);},
      restoreData(value) {
        const next = value == null ? blank() : normalize(value);
        try {localStorage.setItem(KEY, JSON.stringify(next));} catch {toast('项目排序没有恢复：浏览器未能保存数据。'); return false;}
        endDrag(false); data = next; paint(); onChange({type: 'restore', data: clone()}); return true;
      },
      clearData() {try {localStorage.removeItem(KEY);} catch {toast('浏览器未能清除项目排序，请稍后重试。'); return false;} endDrag(false); data = blank(); paint(); onChange({type: 'clear', data: clone()}); return true;},
      dispose() {dead = true; renderToken++; endDrag(false); closePopup(); events.abort(); container?.classList.remove('ws-host');}
    };
  }};
})();
