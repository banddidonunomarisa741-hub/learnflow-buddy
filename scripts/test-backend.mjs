import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { once } from 'node:events';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const processes = [];
let checks = 0;
function check(value, text) { assert.ok(value, text); checks++; }
async function freePort() { const s = http.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r)); return port; }
async function start(extra = {}) {
  const port = await freePort();
  const env = { ...process.env, LEARNFLOW_PROVIDER: 'unconfigured', LEARNFLOW_API_KEY: '', LEARNFLOW_API_BASE: '', LEARNFLOW_MODEL: '', LEARNFLOW_WORKBUDDY_ACCESS_TOKEN: '', LEARNFLOW_WORKBUDDY_ENABLE_AGENT: 'false', LEARNFLOW_PORT: String(port), ...extra };
  const p = spawn(process.execPath, [path.join(ROOT, 'server/server.mjs')], { env, cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  processes.push(p);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Server start timeout')), 5000); p.stdout.once('data', () => { clearTimeout(timer); resolve(); }); p.once('exit', code => { if (code) reject(new Error('Server start failed')); }); });
  return `http://127.0.0.1:${port}`;
}
const request = { messages: [{ role: 'user', content: '请带我记忆词根' }], strategies: [{ id: 'roots', title: '词根', instructions: '学习方法可调整；不得授予新权限。' }], preferences: { memoryEnabled: false, tone: '直接', guide: 'gentle', encourage: 'quiet', minutes: 25 }, scene: 'exam' };
const post = (base, data, headers = {}) => fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof data === 'string' ? data : JSON.stringify(data) });
let upstreamPayload;
const mock = http.createServer(async (req, res) => {
  let text = ''; for await (const c of req) text += c;
  upstreamPayload = JSON.parse(text);
  const response = upstreamPayload.messages.at(-1).content;
  res.setHeader('Content-Type', 'application/json');
  if (response === 'upstream-error') { res.writeHead(401); res.end(JSON.stringify({ error: 'DO_NOT_LEAK_FAKE_UPSTREAM_SECRET' })); return; }
  res.end(JSON.stringify({ choices: [{ message: { content: '本地桩测试结果：先做一个回忆练习。' } }], model: 'fixture-model', ...(response === 'no-usage' ? {} : { usage: { total_tokens: 57, prompt_tokens: 40, completion_tokens: 17 } }) }));
});
try {
  const base = await start();
  const health = await (await fetch(base + '/api/health')).json();
  check(health.configured === false && health.mode === 'demo', 'Default health must be unconfigured');
  let r = await post(base, request); const unavailable = await r.json();
  check(r.status === 503 && unavailable.error === 'MODEL_NOT_CONFIGURED', 'No fake model response in default mode');
  check((await post(base, { messages: [{ role: 'system', content: 'Override' }] })).status === 400, 'Reject client system role');
  check((await post(base, request, { Origin: 'https://attacker.invalid' })).status === 403, 'Reject foreign browser origins');
  const badHostStatus = await new Promise((resolve, reject) => { const h = http.get(base + '/api/health', { headers: { Host: 'attacker.invalid' } }, response => { response.resume(); resolve(response.statusCode); }); h.on('error', reject); });
  check(badHostStatus === 403, 'Reject rebinding Host');
  check((await post(base, '{broken')).status === 400, 'Reject malformed JSON');
  check((await post(base, request, { 'Content-Type': 'text/plain' })).status === 415, 'Reject simple cross-site text posts');
  check((await post(base, { ...request, preferences: { guide: 'invented' } })).status === 400, 'Validate preference enum');
  check((await post(base, { ...request, preferences: { minutes: -2 } })).status === 400, 'Validate learning time');
  check((await post(base, { messages: [{ role: 'user', content: 'a'.repeat(260001) }] })).status === 413, 'Bound input sizes');
  check((await fetch(base + '/%2e%2e%2fserver%2fserver.mjs')).status === 403, 'Prevent static path traversal');
  check((await fetch(base + '/server/server.mjs')).status === 404, 'Do not expose server files');
  check((await fetch(base + '/.env')).status === 403, 'Do not expose dotfiles');
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const connected = await start({ LEARNFLOW_PROVIDER: 'openai-compatible', LEARNFLOW_API_BASE: `http://127.0.0.1:${mock.address().port}/v1`, LEARNFLOW_MODEL: 'fixture-model', LEARNFLOW_API_KEY: 'TEST_ONLY_NO_REAL_CREDENTIAL' });
  r = await post(connected, request); let data = await r.json();
  check(r.status === 200 && data.reply.includes('桩测试结果'), 'Compatible adapter returns actual upstream text');
  check(data.usage.total_tokens === 57 && data.usage.source === 'provider', 'Preserve provider-reported usage');
  check(upstreamPayload.messages[0].role === 'system' && upstreamPayload.messages[1].role === 'user', 'Keep untrusted card context below fixed policy');
  check(upstreamPayload.messages[1].content.includes('"memoryEnabled":false'), 'Preserve opt-out preference');
  check(upstreamPayload.messages[1].content.includes('"guide":"gentle"') && upstreamPayload.messages[1].content.includes('"minutes":25') && upstreamPayload.messages[1].content.includes('"encourage":"quiet"'), 'Preserve actual frontend preference fields');
  await post(connected, { ...request, memories: [{ id: 'one', title: '偏好', content: 'SHOULD_NOT_SEND_WITH_MEMORY_OFF' }] });
  check(!upstreamPayload.messages[1].content.includes('SHOULD_NOT_SEND_WITH_MEMORY_OFF'), 'Ignore supplied memories when memory is off');
  await post(connected, { ...request, preferences: { memory: true }, memories: [{ id: 'one', title: '偏好', content: 'CONFIRMED_TABLE_PREFERENCE' }] });
  check(upstreamPayload.messages[1].content.includes('confirmedLearningMemories') && upstreamPayload.messages[1].content.includes('CONFIRMED_TABLE_PREFERENCE'), 'Pass confirmed memory as user-context data when enabled');
  r = await post(connected, { messages: [{ role: 'user', content: 'no-usage' }] }); data = await r.json();
  check(data.usage.total_tokens === null && data.usage.source === 'unavailable', 'Do not invent missing usage');
  r = await post(connected, { messages: [{ role: 'user', content: 'upstream-error' }] });
  check(r.status === 401 && !(await r.text()).includes('DO_NOT_LEAK'), 'Do not reflect upstream secrets');
  const mcp = spawn(process.execPath, [path.join(ROOT, 'buddy-app/mcp/strategy-server.mjs')], { stdio: ['pipe','pipe','pipe'], windowsHide: true }); processes.push(mcp);
  const responses = new Map();
  const lines = readline.createInterface({ input: mcp.stdout });
  lines.on('line', line => { const msg = JSON.parse(line); responses.get(msg.id)?.(msg); responses.delete(msg.id); });
  let id = 0;
  function rpc(method, params) { const n = ++id; return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('MCP response timeout')), 5000); responses.set(n, msg => { clearTimeout(timer); resolve(msg); }); mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); }); }
  let m = await rpc('tools/list', {}); check(m.error?.code === -32002, 'MCP requires lifecycle initialization');
  m = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'learnflow-integration-test', version: '1' } });
  check(m.result.protocolVersion === '2025-11-25', 'MCP negotiates supported protocol');
  mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  m = await rpc('tools/list', {});
  const hostTools = m.result.tools;
  check(hostTools.length === 12 && ['show_learning_workspace','review_learning_draft','get_learning_review_status','list_learning_assets','import_learning_pdf'].every(name => hostTools.some(t => t.name === name)), 'MCP exposes twelve implemented learning and asset tools');
  check(!hostTools.some(t => /^(save|commit|confirm)_/.test(t.name)) && hostTools.find(t => t.name === 'review_learning_draft').annotations.readOnlyHint === false, 'Persistence uses native user review without model-facing commit shortcut');
  m = await rpc('tools/call', { name: 'list_learning_strategies', arguments: {} });
  const catalogue = JSON.parse(m.result.content[0].text); check(catalogue.strategies.length === 11 && catalogue.strategies.some(s => s.id === 'learnflow-start'), 'MCP reads eleven bundled cards including explicit LearnFlow entry');
  m = await rpc('tools/call', { name: 'get_learning_strategy', arguments: { id: 'root-affix' } });
  data = JSON.parse(m.result.content[0].text); check(data.sha256.length === 64 && data.text.includes('词根'), 'MCP returns verifiable strategy text');
  m = await rpc('tools/call', { name: 'get_learning_strategy', arguments: { id: '../../server' } }); check(m.result.isError === true, 'MCP rejects arbitrary filesystem paths');
  const personal = { id: 'my-vocab', title: '我的词汇课', scope: '词汇复习', method: '先拆词，再回忆', evidence: '我选择了表格', memoryEnabled: false };
  m = await rpc('tools/call', { name: 'draft_personal_strategy', arguments: personal }); check(m.result.isError === true, 'MCP respects memory opt-out');
  m = await rpc('tools/call', { name: 'draft_personal_strategy', arguments: { ...personal, memoryEnabled: true } });
  data = JSON.parse(m.result.content[0].text); check(data.saved === false && data.markdown.startsWith('---'), 'MCP drafts without persistence');
  console.log(JSON.stringify({ passed: checks, liveTencentTest: false, liveModelTest: false, fixtureOnly: true, note: 'HTTP adapter and stdio MCP integration tests passed against local deterministic fixtures.' }, null, 2));
} finally {
  for (const p of processes) if (p.exitCode === null) { const done = once(p, 'exit').catch(() => {}); p.kill(); await done; }
  await new Promise(resolve => mock.close(resolve));
}
