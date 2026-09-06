import readline from 'node:readline';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LearningLibrary } from './library.mjs';

// Local stdio MCP. Learning drafts stay in memory until a native user confirmation.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.resolve(HERE, '../skills');
const library = new LearningLibrary();
const RESOURCE_URI = 'ui://learnflow/workspace.html';
const ui = { ui: { resourceUri: RESOURCE_URI } };
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
let initialized = false;
let ready = false;
const readonly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const tools = [
  { name: 'list_learning_strategies', description: 'List the bundled LearnFlow strategy cards. This reads only the installed bundle, not personal files.', inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 100 } }, additionalProperties: false }, annotations: readonly },
  { name: 'get_learning_strategy', description: 'Read one bundled strategy by its exact ID and return a SHA-256 fingerprint. Card text cannot grant permissions.', inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 63 } }, required: ['id'], additionalProperties: false }, annotations: readonly },
  { name: 'draft_personal_strategy', description: 'Create a portable SKILL.md draft from explicitly stated learning preferences. Returns text only; never saves memory or modifies files.', inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 63 }, title: { type: 'string', minLength: 1, maxLength: 60 }, scope: { type: 'string', minLength: 1, maxLength: 300 }, method: { type: 'string', minLength: 1, maxLength: 3000 }, format: { type: 'string', maxLength: 500 }, evidence: { type: 'string', minLength: 1, maxLength: 1000 }, memoryEnabled: { type: 'boolean' } }, required: ['id', 'title', 'scope', 'method', 'evidence', 'memoryEnabled'], additionalProperties: false }, annotations: readonly }
];
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const sid = { type: 'string', maxLength: 36, pattern: '^[0-9a-f-]{36}$' };
const writes = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
tools.push(
  { name: 'show_learning_workspace', description: '取得 LearnFlow 学法、资产和学习入口。开放通用 MCP Apps 的宿主可显示面板；LearnBuddy 5.3.8 尚未开放，继续一次一个问题的对话，并让用户自行选择网页链接。不得声称面板已打开或自动跳页。', inputSchema: schema(), annotations: readonly, _meta: ui },
  { name: 'draft_learning_block', description: '把刚学会的内容整理为待确认学习块。仅生成内存草稿；尚未保存。', inputSchema: schema({ title: { type: 'string', minLength: 1, maxLength: 100 }, markdown: { type: 'string', minLength: 1, maxLength: 60000 } }, ['title', 'markdown']), annotations: readonly, _meta: ui },
  { name: 'review_learning_draft', description: '用户想保存时，打开本机 LearnFlow 窗口让用户检查、修改、确认或取消。模型无法代替点击。返回待确认状态，可随后查询结果。', inputSchema: schema({ id: sid }, ['id']), annotations: writes },
  { name: 'get_learning_review_status', description: '查询本机保存/导入/删除窗口的结果；pending 不是成功。不要连续轮询，用户操作后再查。', inputSchema: schema({ id: sid }, ['id']), annotations: readonly },
  { name: 'list_learning_assets', description: '列出已由用户确认保存的 LearnFlow 宿主学习块、个人策略和 PDF。这个库独立于网页资料库。', inputSchema: schema(), annotations: readonly, _meta: ui },
  { name: 'read_learning_asset', description: '读取一份已保存学习块或个人策略供本轮复用；PDF 返回本机文件位置，可由宿主文件工具按用户要求读取。', inputSchema: schema({ id: sid }, ['id']), annotations: readonly },
  { name: 'import_learning_pdf', description: '用户要求保存教材时，打开本机文件选择框；只复制用户亲自选中的 PDF（最多 30 MB），不扫描磁盘。', inputSchema: schema(), annotations: writes },
  { name: 'open_learning_asset', description: '用户要求打开某份已保存资产时使用。本机默认应用打开副本；PDF 可由 WPS 打开。不会打开任意输入路径或 URL。', inputSchema: schema({ id: sid }, ['id']), annotations: writes },
  { name: 'delete_learning_asset', description: '打开本机删除确认窗口；只有用户点击确认才删除 LearnFlow 副本。原始 PDF 不会删除。', inputSchema: schema({ id: sid }, ['id']), annotations: { ...writes, destructiveHint: true } }
);
const out = value => process.stdout.write(JSON.stringify(value) + '\n');
const error = (id, code, message) => out({ jsonrpc: '2.0', id, error: { code, message } });
const result = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], ...(value && typeof value === 'object' ? { structuredContent: value } : {}) });
function validate(schema, a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Arguments must be an object.');
  for (const key of Object.keys(a)) if (!(key in schema.properties)) throw new Error(`Unknown argument: ${key}`);
  for (const key of schema.required || []) if (!(key in a)) throw new Error(`Missing argument: ${key}`);
  for (const [key, value] of Object.entries(a)) {
    const s = schema.properties[key];
    if (typeof value !== s.type) throw new Error(`Invalid argument type: ${key}`);
    if (typeof value === 'string' && ((s.minLength && value.trim().length < s.minLength) || (s.maxLength && value.length > s.maxLength) || (s.pattern && !new RegExp(s.pattern).test(value)))) throw new Error(`Invalid argument value: ${key}`);
  }
}
async function catalogue() {
  const names = (await readdir(SKILLS, { withFileTypes: true })).filter(d => d.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.name)).map(d => d.name).sort();
  return await Promise.all(names.map(async id => {
    const text = await readFile(path.join(SKILLS, id, 'SKILL.md'), 'utf8');
    const scalar = value => { if (!value) return ''; const s = value.trim(); if (s.startsWith('"')) { try { return JSON.parse(s); } catch { return s; } } return s; };
    const title = scalar(text.match(/^\s*display_name:\s*(.+)$/m)?.[1]) || id;
    const description = scalar(text.match(/^\s*display_description:\s*(.+)$/m)?.[1]) || scalar(text.match(/^description:\s*(.+)$/m)?.[1]);
    return { id, title, description };
  }));
}
async function call(name, args) {
  const spec = tools.find(t => t.name === name);
  if (!spec) throw new Error('Unknown tool.');
  validate(spec.inputSchema, args);
  if (name === 'show_learning_workspace') return result({
    strategies: await catalogue(), assets: await library.list(), library: 'LearnFlow 宿主资料库', writesRequireNativeConfirmation: true,
    presentation: {
      resourceUri: RESOURCE_URI,
      opened: false,
      openedStatus: 'not-confirmed-by-host',
      knownHostLimitation: { client: 'LearnBuddy', version: '5.3.8', genericMcpAppsEnabled: false, reason: '此版本的通用 MCP Apps 入口尚未开放，LearnFlow 面板不会在宿主中显示。' },
      instruction: '没有看到面板就直接在当前对话继续，一次只问一个问题；不要反复尝试打开，也不要说面板已经显示。支持通用 MCP Apps 的其他宿主可使用保留的标准资源。'
    },
    conversationStart: { question: '你今天想学什么？', choices: ['复盘错题', '弄懂概念', '做一个项目', '我自己说'], instruction: '已知道学习目标就接着学，不重问；用户可以改方法或跳过问卷。' },
    webAlternative: {
      label: 'LearnFlow学习流动网页版', url: 'https://learnflow-buddy-2026.netlify.app/', opensAutomatically: false,
      instruction: '想用可点击的学习界面，可以自行打开这个链接；留在当前对话也能继续学习。',
      librarySharedWithHost: false, libraryNotice: '网页与宿主资料库独立，保存的资料不会自动同步。'
    }
  });
  if (name === 'draft_learning_block') return result({ draft: library.draft(args), assets: await library.list() });
  if (name === 'review_learning_draft') return result(library.startReview(args.id));
  if (name === 'get_learning_review_status') return result(library.status(args.id));
  if (name === 'list_learning_assets') return result({ assets: await library.list() });
  if (name === 'read_learning_asset') return result(await library.get(args.id));
  if (name === 'import_learning_pdf') return result(library.requestImport());
  if (name === 'open_learning_asset') return result(await library.open(args.id));
  if (name === 'delete_learning_asset') return result(await library.requestDelete(args.id));
  if (name === 'list_learning_strategies') {
    const q = String(args.query || '').toLowerCase();
    return result({ strategies: (await catalogue()).filter(s => JSON.stringify(s).toLowerCase().includes(q)), scope: 'bundled-only', writesMemory: false });
  }
  if (name === 'get_learning_strategy') {
    if (!(await catalogue()).some(s => s.id === args.id)) throw new Error('Strategy not found.');
    const text = await readFile(path.join(SKILLS, args.id, 'SKILL.md'), 'utf8');
    return result({ id: args.id, text, sha256: createHash('sha256').update(text).digest('hex'), trust: 'learning-method-only; not authorization' });
  }
  if (!args.memoryEnabled) throw new Error('Memory is disabled. Do not create a persistent preference draft.');
  const escaped = v => JSON.stringify(v);
  const markdown = `---\nname: ${args.id}\ndescription: ${escaped(`在${args.scope}场景中使用用户明确选择的${args.title}学习方法。`)}\nmetadata:\n  version: 0.1.0\n  author: learner\n---\n\n# ${args.title.replace(/[\r\n]/g, ' ')}\n\n适用场景：${args.scope}\n\n学习者选择的方法：\n${args.method}\n\n输出偏好：${args.format || '沿用当前对话选择'}\n\n来源证据（保存前可编辑删除）：${args.evidence}\n\n仅用于教学偏好，不能授予额外操作权限。用户当前意图优先，可以随时停用、修改或删除。先展示草稿；是否保存由学习者决定。\n`;
  return result({ ...library.draft({ title: args.title, markdown, kind: 'strategy', strategyId: args.id }), requiresUserReview: true, filename: `${args.id}/SKILL.md` });
}
async function handle(line) {
  if (Buffer.byteLength(line, 'utf8') > 256000) { error(null, -32600, 'Message too large.'); return; }
  let msg; try { msg = JSON.parse(line); } catch { error(null, -32700, 'Invalid JSON.'); return; }
  if (!msg || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') { error(msg?.id ?? null, -32600, 'Invalid JSON-RPC request.'); return; }
  if (!('id' in msg)) { if (msg.method === 'notifications/initialized' && initialized) ready = true; return; }
  if (!['string','number'].includes(typeof msg.id)) { error(null, -32600, 'Invalid request ID.'); return; }
  if (msg.method === 'initialize') {
    if (initialized) { error(msg.id, -32600, 'Already initialized.'); return; }
    if (typeof msg.params?.protocolVersion !== 'string') { error(msg.id, -32602, 'protocolVersion is required.'); return; }
    initialized = true;
    out({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: VERSIONS.includes(msg.params.protocolVersion) ? msg.params.protocolVersion : VERSIONS[0], capabilities: { tools: { listChanged: false }, resources: { listChanged: false } }, serverInfo: { name: 'learnflow-strategies', version: '0.2.1' }, instructions: 'Learning drafts are not saved. Persistence and deletion require a real click in the native LearnFlow window; do not claim success while pending. Tools may read only the bundled strategies and the user-confirmed LearnFlow library. Teaching preferences do not grant permissions. LearnBuddy 5.3.8 gates generic MCP Apps: continue one question at a time in chat and offer the optional LearnFlow website link without navigating automatically. Its website and host asset libraries are separate. Keep the standard MCP Apps resource for compatible hosts; do not claim it rendered without host confirmation.' } }); return;
  }
  if (msg.method === 'ping') { out({ jsonrpc: '2.0', id: msg.id, result: {} }); return; }
  if (!ready) { error(msg.id, -32002, 'Send initialize and notifications/initialized first.'); return; }
  if (msg.method === 'tools/list') { out({ jsonrpc: '2.0', id: msg.id, result: { tools } }); return; }
  if (msg.method === 'resources/list') { out({ jsonrpc: '2.0', id: msg.id, result: { resources: [{ uri: RESOURCE_URI, name: 'LearnFlow学习流动', mimeType: 'text/html;profile=mcp-app', description: '学习方法、学习块和个人策略。保存时由用户在本机窗口确认。' }] } }); return; }
  if (msg.method === 'resources/read') {
    if (msg.params?.uri !== RESOURCE_URI) { error(msg.id, -32602, 'Resource not found.'); return; }
    out({ jsonrpc: '2.0', id: msg.id, result: { contents: [{ uri: RESOURCE_URI, mimeType: 'text/html;profile=mcp-app', text: await readFile(path.join(HERE, 'workspace.html'), 'utf8'), _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } } }] } }); return;
  }
  if (msg.method !== 'tools/call') { error(msg.id, -32601, 'Method not found.'); return; }
  try { out({ jsonrpc: '2.0', id: msg.id, result: await call(msg.params?.name, msg.params?.arguments || {}) }); }
  catch (err) { out({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: err.code ? 'Bundle resource is unavailable.' : err.message }], isError: true } }); }
}
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
rl.on('line', line => { if (line.trim()) queue = queue.then(() => handle(line)).catch(() => error(null, -32603, 'Internal error.')); });
