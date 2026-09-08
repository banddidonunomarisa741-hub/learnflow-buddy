/* Progressive visual feedback only. No form rewriting, API calls or persisted state. */
(() => {
  'use strict';
  if (window.LearnFlowMotion) return;
  const root = document.documentElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const animations = new Map();
  const popupState = new WeakMap();
  const popups = 'dialog:not(.tc-modal):not(.ws-dialog):not(.card-studio), #profile-menu, .lf-select-options';
  const excluded = '.tc-modal, [class^="tc-"], .sf-gallery, .card-studio, .lf-gallery, .lf-card-studio, .lf-deck, .ws-sidebar, .ws-dialog, [class^="ws-"]';
  const easing = 'cubic-bezier(.22, 1, .36, 1)';
  let route = location.hash || '#home';
  let routeFrame = 0, refreshFrame = 0, pressed = null, trigger = null, inputKind = 'pointer';
  let destroyed = false;
  const reduced = () => media.matches || root.dataset.reducedMotion === 'true';
  const allowed = el => el instanceof HTMLElement && !el.closest(excluded);
  const stop = el => { const a = animations.get(el); if (a) { animations.delete(el); a.cancel(); } };
  function animate(el, frames, duration = 190) {
    stop(el);
    if (destroyed || reduced() || !el.isConnected || typeof el.animate !== 'function') return;
    const animation = el.animate(frames, { duration, easing, fill: 'none' });
    animation.id = 'lf-motion';
    animations.set(el, animation);
    const finish = () => { if (animations.get(el) === animation) animations.delete(el); };
    animation.addEventListener('finish', finish, { once: true });
    animation.addEventListener('cancel', finish, { once: true });
  }
  function release() { pressed?.classList.remove('lf-motion-pressed'); pressed = null; }
  function settle() {
    release();
    for (const el of [...animations.keys()]) stop(el);
    cancelAnimationFrame(routeFrame); routeFrame = 0;
  }
  function origin(el) {
    const preferred = el.id === 'model-menu' ? document.querySelector('#model-trigger')
      : el.id === 'profile-menu' ? document.querySelector('[aria-controls="profile-menu"]')
        : el.classList.contains('lf-select-options') ? el.parentElement.querySelector('.lf-select-trigger') : trigger;
    if (!preferred?.isConnected) return '50% 70%';
    const panel = el.getBoundingClientRect(), button = preferred.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, (button.x + button.width / 2 - panel.x) / (panel.width || 1) * 100));
    const y = Math.max(0, Math.min(100, (button.y + button.height / 2 - panel.y) / (panel.height || 1) * 100));
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }
  function syncPopup(el) {
    if (!allowed(el)) return;
    const visible = el instanceof HTMLDialogElement ? el.open : !el.hidden;
    const wasOpen = popupState.get(el) === true;
    popupState.set(el, visible);
    if (!visible) { stop(el); return; }
    if (wasOpen || inputKind === 'keyboard') return;
    el.classList.add('lf-motion-popup');
    el.style.setProperty('--lf-motion-origin', origin(el));
    animate(el, [{ opacity: 0, transform: 'translateY(4px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 190);
  }
  function refresh() {
    if (destroyed) return;
    document.querySelectorAll(popups).forEach(syncPopup);
    for (const el of [...animations.keys()]) if (!el.isConnected) stop(el);
  }
  function queueRefresh() {
    if (refreshFrame || destroyed) return;
    refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; refresh(); });
  }
  function normalized(value) {
    const path = (value || '#home').replace(/^#/, '').split('?')[0];
    const aliases = { connectors: 'settings/connections', mine: 'settings/learning', memory: 'settings/memory', teacher: 'settings/teacher', about: 'settings/about' };
    return aliases[path] || path || 'home';
  }
  function routeChanged() {
    const next = location.hash || '#home', changed = normalized(next) !== normalized(route);
    route = next;
    if (!changed || destroyed) return;
    cancelAnimationFrame(routeFrame);
    // Preserve the settings rail and chat composer: only the reading area moves.
    routeFrame = requestAnimationFrame(() => {
      routeFrame = 0;
      if (reduced() || inputKind === 'keyboard') return;
      const main = document.querySelector('#main');
      const target = main?.querySelector('.lf-settings-content') || main?.querySelector('.chat-welcome') || main?.querySelector('.messages') || main;
      if (!target || target.closest('[class^="tc-"]') || main?.querySelector('.tc-workspace, .sf-gallery')) return;
      animate(target, [{ opacity: .5, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], 200);
    });
  }
  const observer = new MutationObserver(records => {
    let scan = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target.matches?.(popups)) syncPopup(record.target);
      } else {
        // Message text chunks cannot start an entrance animation.
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && (node.matches(popups) || node.querySelector(popups))) scan = true;
        }
        if (record.removedNodes.length && animations.size) scan = true;
      }
    }
    if (scan) queueRefresh();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden'] });
  const preferenceObserver = new MutationObserver(() => { if (reduced()) settle(); });
  preferenceObserver.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion'] });
  document.addEventListener('pointerdown', event => {
    inputKind = 'pointer';
    const button = event.target.closest?.('button, a[role="button"]');
    trigger = button || event.target.closest?.('a, summary') || null;
    release();
    if (!allowed(button) || button.disabled || reduced() || event.button !== 0 || button.matches('.toggle, [role="switch"], [aria-haspopup]') || button.closest('.lf-segmented, .scene-pills, .lf-theme-options')) return;
    pressed = button;
    button.classList.add('lf-motion-pressable', 'lf-motion-pressed');
  }, { capture: true, signal: events.signal });
  document.addEventListener('pointerup', release, { capture: true, signal: events.signal });
  document.addEventListener('pointercancel', release, { capture: true, signal: events.signal });
  document.addEventListener('keydown', () => { inputKind = 'keyboard'; release(); }, { capture: true, signal: events.signal });
  window.addEventListener('blur', release, { signal: events.signal });
  window.addEventListener('hashchange', routeChanged, { signal: events.signal });
  media.addEventListener('change', () => { if (reduced()) settle(); }, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); }, { signal: events.signal });
  window.LearnFlowMotion = Object.freeze({
    refresh, routeChanged,
    destroy() {
      if (destroyed) return;
      destroyed = true; settle(); cancelAnimationFrame(refreshFrame);
      observer.disconnect(); preferenceObserver.disconnect(); events.abort();
      document.querySelectorAll('.lf-motion-pressed, .lf-motion-pressable, .lf-motion-popup').forEach(el => {
        el.classList.remove('lf-motion-pressed', 'lf-motion-pressable', 'lf-motion-popup');
        el.style.removeProperty('--lf-motion-origin');
      });
    }
  });
  // Existing open UI is already visible; do not replay it on module initialization.
  document.querySelectorAll(popups).forEach(el => popupState.set(el, el instanceof HTMLDialogElement ? el.open : !el.hidden));
})();
