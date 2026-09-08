/* Local usage records are not a billing statement or a measure of learning. */
(() => {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const MAX_EVENTS = 3000, MAX_SEEN_IDS = 6000, MAX_FEEDBACK = 3000, MAX_SHARE = 24000;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  const text = (value, max, name, required = false) => {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      if (value === undefined && !required) return '';
      fail('INVALID_TEXT', `${name}格式不正确或过长。`);
    }
    if (required && !value.trim()) fail('INVALID_TEXT', `请填写${name}。`);
    return value.trim();
  };
  const identifier = (value, name = '编号') => {
    const result = text(value, 160, name, true);
    if (!/^[\p{L}\p{N}._:@+-]+$/u.test(result) || ['__proto__', 'constructor', 'prototype'].includes(result)) fail('INVALID_ID', `${name}格式不正确。`);
    return result;
  };
  const integer = (value, name) => {
    if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_COUNT', `${name}须为非负整数。`);
    return value;
  };
  const date = value => {
    if (typeof value !== 'string' && typeof value !== 'number') fail('INVALID_DATE', '记录时间不正确。');
    const result = new Date(value);
    if (!Number.isFinite(result.getTime())) fail('INVALID_DATE', '记录时间不正确。');
    return result.toISOString();
  };
  const newId = prefix => `${prefix}-${root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const cappedStrings = (value, maxCount, maxLength, name) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maxCount) fail('INVALID_LIST', `${name}格式不正确或数量过多。`);
    return [...new Set(value.map(item => text(item, maxLength, name, true)))];
  };
  const normalizeParent = value => {
    if (value === undefined || value === null) return null;
    if (!object(value)) fail('INVALID_PARENT', '来源策略格式不正确。');
    return {id: identifier(value.id, '来源策略编号'), version: text(value.version, 80, '来源版本', true)};
  };
  function cardCore(card) {
    if (!object(card)) fail('INVALID_CARD', '无法读取这张策略卡。');
    return {
      title: text(card.title, 160, '策略名称', true),
      description: text(card.description, 3000, '策略说明'),
      instructions: text(card.instructions, 8000, '策略步骤', true),
      tags: cappedStrings(card.tags, 24, 80, '标签'),
      scene: text(card.scene || 'all', 40, '学习场景'),
      steps: cappedStrings(card.steps, 30, 1000, '步骤'),
      evidence: text(card.evidence, 3000, '方法依据'),
      examples: cappedStrings(card.examples, 12, 2000, '使用实例'),
      limits: text(card.limits, 3000, '适用边界')
    };
  }
  // A deterministic content fingerprint, not a signature or proof of authorship.
  function cardVersion(card) {
    const value = JSON.stringify(cardCore(card));
    let a = 0x811c9dc5, b = 0x9e3779b9;
    for (let i = 0; i < value.length; i++) {
      a = Math.imul(a ^ value.charCodeAt(i), 0x01000193);
      b = Math.imul(b ^ value.charCodeAt(i), 0x85ebca6b);
    }
    return `v1-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
  }
  function exportableCard(card) {
    const core = cardCore(card);
    const result = {
      id: identifier(card.id, '策略编号'), ...core,
      category: text(card.category, 80, '策略分类'),
      subtitle: text(card.subtitle, 300, '策略副标题'),
      color: text(card.color || 'orange', 30, '颜色'),
      icon: text(card.icon || 'layers', 40, '图标'),
      source: text(card.source, 300, '来源说明'),
      version: cardVersion(core)
    };
    if (!/^[a-z0-9-]+$/i.test(result.color) || !/^[a-z0-9-]+$/i.test(result.icon)) fail('INVALID_APPEARANCE', '策略颜色或图标名称不正确。');
    const parent = normalizeParent(card.parent);
    if (parent) result.parent = parent;
    return result;
  }
  function cleanEvent(input) {
    if (!object(input)) fail('INVALID_EVENT', '使用记录格式不正确。');
    const source = input.source;
    if (!['provider', 'estimated', 'unavailable'].includes(source)) fail('INVALID_SOURCE', '用量来源不正确。');
    const tokens = input.tokens === null || input.tokens === undefined ? null : integer(input.tokens, 'Token 用量');
    if (source === 'unavailable' && tokens !== null) fail('INVALID_COUNT', '未提供的用量不能填写数字。');
    if (!Array.isArray(input.strategies) || input.strategies.length > 100) fail('INVALID_STRATEGIES', '本次策略列表不正确。');
    const strategies = [], seen = new Set();
    for (const card of input.strategies) {
      if (!object(card)) fail('INVALID_STRATEGIES', '本次策略格式不正确。');
      const id = identifier(card.id, '策略编号');
      if (seen.has(id)) continue;
      seen.add(id);
      strategies.push({id, title: text(card.title, 160, '策略名称', true), version: text(card.version || 'unversioned', 80, '策略版本', true)});
    }
    const base = tokens === null || !strategies.length ? null : Math.floor(tokens / strategies.length);
    const remainder = base === null ? 0 : tokens % strategies.length;
    return {
      id: identifier(input.id, '记录编号'), at: date(input.at ?? new Date().toISOString()),
      sessionId: input.sessionId ? identifier(input.sessionId, '会话编号') : '',
      model: text(input.model, 200, '模型名称'), source: tokens === null ? 'unavailable' : source,
      tokens, strategies,
      allocations: strategies.map((card, index) => ({...card, tokens: base === null ? null : base + Number(index < remainder)})),
      attribution: 'equal-share-not-independent-cost'
    };
  }
  const safeSnapshot = value => {
    const snapshot = {};
    for (const key of ['actualTokens', 'estimatedTokens', 'knownCalls', 'unknownCalls', 'totalCalls']) {
      snapshot[key] = integer(value?.[key] ?? 0, key);
    }
    snapshot.scope = 'retained-local-events';
    snapshot.truncated = value?.truncated === true;
    return snapshot;
  };
  function cleanFeedback(input, forceImported = false) {
    if (!object(input)) fail('INVALID_FEEDBACK', '反馈格式不正确。');
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) fail('INVALID_RATING', '评分请选择 1 至 5 星。');
    if (!['yes', 'partly', 'no'].includes(input.helped)) fail('INVALID_FEEDBACK', '请选择这个方法是否帮到了你。');
    const imported = forceImported || input.source === 'imported-self-report';
    return {
      id: identifier(input.id || newId('feedback'), '反馈编号'), at: date(input.at ?? new Date().toISOString()),
      cardId: identifier(input.cardId, '策略编号'), version: text(input.version, 80, '策略版本', true),
      rating: input.rating, helped: input.helped, note: text(input.note, 1000, '反馈内容'),
      source: imported ? 'imported-self-report' : 'local',
      verifiedUsage: false,
      snapshot: {...safeSnapshot(input.snapshot), scope: imported ? 'imported-self-report' : 'retained-local-events'}
    };
  }
  function cleanSelfReport(input) {
    if (!object(input)) fail('INVALID_EVENT', '导入使用记录格式不正确。');
    const event = cleanEvent({...input, source: input.source === 'imported-self-report' ? input.reportedSource : input.source});
    return {...event, reportedSource: event.source, source: 'imported-self-report'};
  }
  function emptyStore() {
    return {version: 1, events: [], feedback: [], lineage: {}, truncated: false, droppedEvents: 0, droppedFeedback: 0,
      seenEventIds: [], deduplicationTruncated: false, droppedEventIds: 0,
      selfReportedEvents: [], selfReportedTruncated: false, droppedSelfReportedEvents: 0};
  }
  function normalizeStore(raw, options = {}) {
    const store = emptyStore();
    if (!object(raw)) return store;
    const imported = options.imported === true;
    store.truncated = !imported && raw.truncated === true;
    store.deduplicationTruncated = !imported && raw.deduplicationTruncated === true;
    store.selfReportedTruncated = raw.selfReportedTruncated === true || (imported && raw.truncated === true);
    for (const key of ['droppedFeedback', 'droppedSelfReportedEvents']) if (Number.isSafeInteger(raw[key]) && raw[key] >= 0) store[key] = raw[key];
    if (Number.isSafeInteger(raw.droppedEvents) && raw.droppedEvents >= 0) {
      if (imported) store.droppedSelfReportedEvents += raw.droppedEvents;
      else store.droppedEvents = raw.droppedEvents;
    }
    if (!imported && Number.isSafeInteger(raw.droppedEventIds) && raw.droppedEventIds >= 0) store.droppedEventIds = raw.droppedEventIds;
    const seen = new Set();
    if (!imported && Array.isArray(raw.seenEventIds)) for (const value of raw.seenEventIds) { try { seen.add(identifier(value)); } catch {} }
    // Usage imported from another browser is not promoted to local provider evidence.
    if (!imported && Array.isArray(raw.events)) {
      const eventIds = new Set();
      for (const input of raw.events) try {
        const event = cleanEvent(input);
        if (!eventIds.has(event.id)) { eventIds.add(event.id); seen.add(event.id); store.events.push(event); }
      } catch {}
    }
    store.seenEventIds = [...seen];
    const selfReportIds = new Set();
    const selfReports = [...(imported && Array.isArray(raw.events) ? raw.events : []), ...(Array.isArray(raw.selfReportedEvents) ? raw.selfReportedEvents : [])];
    for (const input of selfReports) try {
      const event = cleanSelfReport(input);
      if (!selfReportIds.has(event.id)) { selfReportIds.add(event.id); store.selfReportedEvents.push(event); }
    } catch {}
    if (Array.isArray(raw.feedback)) {
      const ids = new Set();
      for (const input of raw.feedback) try {
        const feedback = cleanFeedback(input, imported);
        if (!ids.has(feedback.id)) { ids.add(feedback.id); store.feedback.push(feedback); }
      } catch {}
    }
    if (object(raw.lineage)) for (const [key, value] of Object.entries(raw.lineage)) {
      try { store.lineage[identifier(key)] = normalizeParent(value); } catch {}
    }
    trim(store);
    return store;
  }
  function trim(store) {
    if (store.events.length > MAX_EVENTS) {
      const removed = store.events.length - MAX_EVENTS;
      store.events.splice(0, removed); store.droppedEvents += removed; store.truncated = true;
    }
    if (store.seenEventIds.length > MAX_SEEN_IDS) {
      // Keep every retained event ID plus a bounded recent eviction window.
      // A local ledger cannot promise permanent deduplication with finite storage.
      const retained = new Set(store.events.map(event => event.id));
      const recent = store.seenEventIds.filter(id => !retained.has(id)).slice(-(MAX_SEEN_IDS - retained.size));
      const bounded = [...recent, ...retained];
      store.droppedEventIds += store.seenEventIds.length - bounded.length;
      store.seenEventIds = bounded; store.deduplicationTruncated = true;
    }
    if (store.selfReportedEvents.length > MAX_EVENTS) {
      const removed = store.selfReportedEvents.length - MAX_EVENTS;
      store.selfReportedEvents.splice(0, removed); store.droppedSelfReportedEvents += removed; store.selfReportedTruncated = true;
    }
    if (store.feedback.length > MAX_FEEDBACK) {
      const removed = store.feedback.length - MAX_FEEDBACK;
      store.feedback.splice(0, removed); store.droppedFeedback += removed;
    }
  }
  const assertStore = store => {
    if (!object(store) || store.version !== 1 || !Array.isArray(store.events) || !Array.isArray(store.feedback) || !Array.isArray(store.seenEventIds) || !Array.isArray(store.selfReportedEvents)) fail('INVALID_STORE', '请先初始化策略使用记录。');
  };
  function record(store, input) {
    assertStore(store);
    const event = cleanEvent(input);
    if (store.seenEventIds.includes(event.id)) return {added: false, event: store.events.find(item => item.id === event.id) || null, store};
    store.events.push(event); store.seenEventIds.push(event.id); trim(store);
    return {added: true, event, store};
  }
  function summary(store, cardId, version) {
    assertStore(store);
    const result = {
      actualTokens: 0, estimatedTokens: 0, knownCalls: 0, unknownCalls: 0, totalCalls: 0,
      lastUsed: null, models: [], scope: 'retained-local-events', truncated: store.truncated === true,
      droppedEvents: store.droppedEvents || 0, attribution: cardId ? 'equal-share-not-independent-cost' : 'whole-response',
      deduplicationScope: 'retained-and-recent-event-ids', deduplicationTruncated: store.deduplicationTruncated === true,
      droppedEventIds: store.droppedEventIds || 0,
      selfReported: {
        source: 'imported-self-report', reportedProviderTokens: 0, reportedEstimatedTokens: 0,
        knownCalls: 0, unknownCalls: 0, totalCalls: 0, lastUsed: null, models: [],
        scope: 'retained-imported-self-reports', truncated: store.selfReportedTruncated === true,
        droppedEvents: store.droppedSelfReportedEvents || 0, verifiedUsage: false
      }
    };
    const models = new Set();
    for (const event of store.events) {
      const allocation = cardId ? event.allocations.find(item => item.id === cardId && (!version || item.version === version)) : null;
      if (cardId && !allocation) continue;
      const tokens = cardId ? allocation.tokens : event.tokens;
      result.totalCalls++;
      if (tokens === null || event.source === 'unavailable') result.unknownCalls++;
      else {
        result.knownCalls++;
        if (event.source === 'provider') result.actualTokens += tokens;
        else if (event.source === 'estimated') result.estimatedTokens += tokens;
      }
      if (!result.lastUsed || event.at > result.lastUsed) result.lastUsed = event.at;
      if (event.model) models.add(event.model);
    }
    result.models = [...models];
    const reportedModels = new Set();
    for (const event of store.selfReportedEvents) {
      const allocation = cardId ? event.allocations.find(item => item.id === cardId && (!version || item.version === version)) : null;
      if (cardId && !allocation) continue;
      const tokens = cardId ? allocation.tokens : event.tokens, report = result.selfReported;
      report.totalCalls++;
      if (tokens === null || event.reportedSource === 'unavailable') report.unknownCalls++;
      else {
        report.knownCalls++;
        if (event.reportedSource === 'provider') report.reportedProviderTokens += tokens;
        else if (event.reportedSource === 'estimated') report.reportedEstimatedTokens += tokens;
      }
      if (!report.lastUsed || event.at > report.lastUsed) report.lastUsed = event.at;
      if (event.model) reportedModels.add(event.model);
    }
    result.selfReported.models = [...reportedModels];
    return result;
  }
  function addFeedback(store, input, options = {}) {
    assertStore(store);
    const imported = options.imported === true || input?.source === 'imported-self-report';
    const feedback = cleanFeedback({...input, snapshot: imported ? input?.snapshot : summary(store, input?.cardId, input?.version)}, imported);
    const previous = store.feedback.find(item => item.id === feedback.id);
    if (previous) return previous;
    store.feedback.push(feedback); trim(store);
    return feedback;
  }
  function bytesToBase64(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return root.btoa ? root.btoa(binary) : globalThis.Buffer.from(bytes).toString('base64');
  }
  function base64ToBytes(value) {
    const binary = root.atob ? root.atob(value) : globalThis.Buffer.from(value, 'base64').toString('binary');
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }
  function encodeShare(card) {
    const body = JSON.stringify({type: 'learnflow-strategy', version: 1, card: exportableCard(card)});
    const encoded = bytesToBase64(new TextEncoder().encode(body)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // Leave space for the route/key that the application adds to the fragment.
    if (encoded.length > MAX_SHARE - 32) fail('SHARE_TOO_LONG', '这张卡片内容较长，请改用 JSON 文件分享。');
    return encoded;
  }
  function decodeShare(value) {
    if (typeof value !== 'string') fail('INVALID_SHARE', '分享内容无法读取。');
    if (value.length > MAX_SHARE) fail('SHARE_TOO_LONG', '分享链接太长，请改用 JSON 文件导入。');
    let encoded = value.replace(/^#(?:strategy=|share=)?/, '').replace(/^(?:strategy=|share=)/, '');
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) fail('INVALID_SHARE', '分享链接格式不正确。');
    try {
      encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(base64ToBytes(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))));
      if (!object(data) || data.type !== 'learnflow-strategy' || data.version !== 1) fail('INVALID_SHARE', '这不是支持的 LearnFlow 策略分享。');
      return exportableCard(data.card);
    } catch (error) {
      if (error.code) throw error;
      fail('INVALID_SHARE', '分享内容损坏，请重新复制链接或使用 JSON 文件。');
    }
  }
  root.LearnFlowLedger = Object.freeze({normalizeStore, record, summary, cardVersion, addFeedback, exportableCard, encodeShare, decodeShare, MAX_EVENTS, MAX_SEEN_IDS, MAX_SHARE});
})();
