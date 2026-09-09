/** Explicit, bounded live-model integration test. No personal data/tools, no raw CLI logs. */
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, mkdir, rm, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverClients, cliModels } from '../server/local-cli.mjs';
import { startService } from '../buddy-app/service/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output/buddy-service-0.3/live-model-check.json');
const names = ['get_learning_preferences', 'get_learning_strategy', 'draft_learning_block'];
const allowed = names.map(name => `mcp__learnflow_probe__${name}`);
const disabled = ['show_learning_workspace', 'list_learning_strategies', 'draft_personal_strategy', 'list_learning_assets', 'read_learning_asset', 'get_course_evidence', 'draft_teaching_assessment', 'draft_targeted_assignment', 'learnflow_app_action'];
const run = promisify(execFile);
const counts = { cliModelRequestsAttempted: 0, modelResponsesObserved: 0, qqMessagesSent: 0, personalLearningDataAccessed: 0 };
const report = { version: '0.3.0', checkedAt: new Date().toISOString(), kind: 'real-host-cli-model-with-isolated-development-service', officialBuddyPreviewVerified: false, productionIdentityVerified: false, accountFilesReadByTest: false, allowedTools: allowed, maxModels: 2, timeoutPerModelMs: 120000, results: [], ...counts };

function usageOf(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of ['input_tokens','output_tokens','total_tokens','cache_read_input_tokens','cache_creation_input_tokens']) out[key] = Number.isSafeInteger(value[key]) && value[key] >= 0 ? value[key] : null;
  return Object.values(out).some(v => v !== null) ? { ...out, source: 'provider-cli-result', note: 'Only provider fields; cache fields are not added to input and credits are unknown.' } : null;
}
function failureReason(stderr, timedOut, code) {
  if (timedOut) return 'Model attempt exceeded 120 seconds; no automatic retry.';
  if (/not logged|unauthorized|authentication|login required|\b401\b/i.test(stderr)) return 'Client login missing or expired; no account file was inspected.';
  if (/quota|credit|insufficient|balance|\b429\b|额度|余额/i.test(stderr)) return 'Provider quota, credits, or request rate prevented completion.';
  if (/unknown option|invalid option|unexpected argument/i.test(stderr)) return 'The installed CLI rejected a requested isolation option.';
  if (/ECONN|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(stderr)) return 'CLI or MCP network connection failed.';
  return code === 0 ? 'The model did not complete all required tool and draft checks.' : 'CLI exited without completing the isolated test.';
}
function cleanReply(value, secrets, nonce) {
  let text = String(value || '');
  for (const secret of secrets) if (secret) text = text.split(secret).join('[REDACTED]');
  text = text.split(nonce).join('[PROBE]');
  return text.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/(?:access_token|refresh_token|client_secret)\s*[:=]\s*[^\s,}]+/gi, '[REDACTED]').replace(/[A-Z]:[\\/][^\s"'<>]+/gi, '[LOCAL_PATH]').slice(0, 600);
}

async function makePrivate(directory) {
  await chmod(directory, 0o700);
  if (process.platform !== 'win32') return;
  // chmod alone does not limit Windows readers. Only this test's exact temp directory is changed.
  const { stdout: identity } = await run('whoami.exe', ['/user','/fo','csv','/nh'], { windowsHide: true, timeout: 10000, maxBuffer: 16000 });
  const sid = identity.match(/S-1-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw new Error('Cannot determine current security identity for private temp permissions.');
  await run('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true, timeout: 10000, maxBuffer: 16000 });
}

async function attempt(client, model, directory, app, index, supportsEffort) {
  const nonce = `LF-CHECK-${randomBytes(8).toString('hex')}`;
  const actor = { id: `live_probe_${index}`, label: '隔离测试学习者', source: 'development-only' };
  app.store.setPreferences(actor.id, { preferences: { memoryEnabled: false, responseFormat: '短句', probeMarker: nonce }, selectedStrategies: [{ id: 'root-affix', title: '词根词缀' }] });
  const token = app.auth.mint(actor, `isolated-probe-${index}`);
  const configPath = path.join(directory, `mcp-${index}.json`);
  await writeFile(configPath, JSON.stringify({ mcpServers: { learnflow_probe: { type: 'http', url: app.url + '/mcp', headers: { Authorization: `Bearer ${token.access_token}` }, disabledTools: disabled } } }), { mode: 0o600 });
  await chmod(configPath, 0o600);
  const args = [client.cli, '-p', '--model', model, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--tools', '', '--mcp-config', configPath, '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', '--permission-mode', 'dontAsk', '--allowedTools', allowed.join(','), '--max-turns', '6', '--system-prompt', '你正在执行用户授权的隔离学习集成测试。只能使用已允许的三个 LearnFlow MCP 工具，不操作系统、不调用其他工具、不访问真实个人资料、不发送消息。读取真实工具结果再回答，不能编造已调用或已保存。'];
  if (supportsEffort) args.push('--effort', 'low');
  const prompt = '请先调用 get_learning_preferences，接着调用 get_learning_strategy 读取 root-affix。根据返回的已选学法，给 inspect、inspection、spectator、retrospect 做一段很短的词根说明和一道选择练习，总共不超过150字。然后调用 draft_learning_block 创建待本人确认的学习块：标题为“词根法隔离验证”，正文包含刚才的小练习，并逐字包含 preferences.probeMarker 返回的随机标记。最后简短回复“草稿待确认”并逐字回显这个标记。你事先不知道标记，不要猜。只创建草稿，不确认保存。';
  const start = Date.now();
  counts.cliModelRequestsAttempted++;
  const captured = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: directory, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let buffer = '', stderr = '', bytes = 0, timedOut = false, final = null, finished = false, observedAssistant = false, actualModel = null;
    const uses = new Map(), toolResults = new Set();
    const finish = code => { if (finished) return; finished = true; clearTimeout(timer); resolve({ code, timedOut, final, actualModel, observedAssistant, uses: [...uses.values()], toolResults: [...toolResults], stderr }); };
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
    function event(line) {
      let e; try { e = JSON.parse(line); } catch { return; }
      if (e.type === 'result') final = e;
      if (e.type === 'assistant') { observedAssistant = true; if (/^[\w./:@+-]{1,160}$/.test(e.message?.model || '')) actualModel = e.message.model; }
      for (const block of Array.isArray(e.message?.content) ? e.message.content : []) {
        if (block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') uses.set(block.id, { id: block.id, name: block.name });
        if (block.type === 'tool_result' && !block.is_error && typeof block.tool_use_id === 'string') toolResults.add(block.tool_use_id);
      }
    }
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 6_000_000) { stderr += ' output limit'; child.kill(); return; } buffer += chunk; let at; while ((at = buffer.indexOf('\n')) >= 0) { event(buffer.slice(0, at)); buffer = buffer.slice(at + 1); } });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
    child.on('error', () => finish(null));
    child.on('close', code => { if (buffer.trim()) event(buffer); finish(code); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } }) + '\n');
  });
  if (captured.observedAssistant) counts.modelResponsesObserved++;
  const drafts = app.store.listDrafts(actor.id), assets = app.store.listAssets(actor.id);
  const namesUsed = [...new Set(captured.uses.map(t => t.name))];
  const resultsSeen = [...new Set(captured.uses.filter(t => captured.toolResults.includes(t.id)).map(t => t.name))];
  const matchingDrafts = drafts.filter(d => d.status === 'pending' && d.markdown?.includes(nonce));
  const reply = String(captured.final?.result || '');
  const checks = { requiredToolUses: allowed.every(t => namesUsed.includes(t)), requiredToolResults: allowed.every(t => resultsSeen.includes(t)), onlyAllowedToolUses: namesUsed.every(t => allowed.includes(t)), nonceInDraft: matchingDrafts.length > 0, nonceInFinalReply: reply.includes(nonce), pendingDraftCount: drafts.filter(d => d.status === 'pending').length, savedAssetCount: assets.length, resultCompleted: captured.final?.is_error === false && captured.code === 0 && !captured.timedOut };
  const passed = checks.requiredToolUses && checks.requiredToolResults && checks.onlyAllowedToolUses && checks.nonceInDraft && checks.nonceInFinalReply && checks.pendingDraftCount === 1 && checks.savedAssetCount === 0 && checks.resultCompleted;
  return { requestedModel: model, actualModel: captured.actualModel, passed, durationMs: Date.now() - start, exitCode: captured.code, timedOut: captured.timedOut, toolUses: namesUsed, successfulToolResults: resultsSeen, checks, usage: usageOf(captured.final?.usage), credits: null, replyExcerpt: cleanReply(reply, [token.access_token, token.refresh_token], nonce), failure: passed ? null : failureReason(captured.stderr, captured.timedOut, captured.code) };
}

let directory, app;
try {
  const clients = await discoverClients();
  const client = clients.find(c => c.name === 'WorkBuddy') || clients[0];
  if (!client) { report.blocked = 'No installed Buddy bundled CLI was found from executable metadata.'; }
  else {
    report.client = client.name;
    const models = await cliModels(client.cli);
    const { stdout: help } = await run(process.execPath, [client.cli, '--help'], { windowsHide: true, timeout: 15000, maxBuffer: 250000 });
    const required = ['--mcp-config','--strict-mcp-config','--setting-sources','--no-session-persistence','--allowedTools','--tools','--permission-mode'];
    if (required.some(flag => !help.includes(flag))) report.blocked = 'The installed CLI lacks required isolation flags.';
    else {
      const preferred = ['glm-5.3','glm-5.3-flash','deepseek-v4-flash','hy4-preview','auto'];
      const selected = preferred.filter(m => models.includes(m)).slice(0, 2);
      if (selected.length !== 2) report.blocked = 'Fewer than two CLI models are advertised; no unsupported model was guessed.';
      else {
        directory = await mkdtemp(path.join(os.tmpdir(), 'learnflow-live-model-'));
        await makePrivate(directory);
        app = await startService({ development: true, host: '127.0.0.1', port: 0, dataDir: path.join(directory, 'data'), workbuddy: {} });
        for (let i = 0; i < selected.length; i++) {
          report.results.push(await attempt(client, selected[i], directory, app, i, help.includes('--effort')));
          Object.assign(report, counts);
          await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
          console.log(JSON.stringify({ model: selected[i], passed: report.results.at(-1).passed, checks: report.results.at(-1).checks, durationMs: report.results.at(-1).durationMs }));
        }
      }
    }
  }
} catch (e) { report.blocked = 'The isolated verification could not start or complete. No raw error was retained.'; report.internalErrorType = e?.name || 'Error'; }
finally {
  if (app) await app.close();
  if (directory) {
    const temp = path.resolve(os.tmpdir()), target = path.resolve(directory), relative = path.relative(temp, target);
    if (path.dirname(target) !== temp || !relative.startsWith('learnflow-live-model-') || relative.includes(path.sep)) throw new Error('Refusing to remove an unverified temporary directory.');
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    report.temporaryCredentialsRemoved = true;
  }
  Object.assign(report, counts); report.passed = report.results.length === 2 && report.results.every(r => r.passed);
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, attempts: report.cliModelRequestsAttempted, responsesObserved: report.modelResponsesObserved, officialBuddyPreviewVerified: false, resultFile: 'output/buddy-service-0.3/live-model-check.json' }));
}
