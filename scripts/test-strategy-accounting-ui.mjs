// Real frontend flows; every API request is intercepted before it reaches the adapter.
// No account profile, persistent browser profile, credentials, or model calls are used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output', 'strategy-library-1.9');
const require = createRequire('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium} = require('playwright');
const origin = 'http://127.0.0.1:4173';
const result = {fixtureOnly: true, realModelCalls: 0, passed: 0, checks: [], apiRequests: [], blockedExternal: [], errors: []};
const check = (condition, description) => {assert.ok(condition, description); result.passed++; result.checks.push(description);};
const equal = (actual, expected, description) => {assert.deepEqual(actual, expected, description); result.passed++; result.checks.push(description);};
const card = number => ({id: `custom-fixture-${String(number).padStart(2, '0')}`, title: `测试方法 ${number}`, description: '隔离测试卡片，不是真实学习记录。', instructions: '1. 先独立回答。\n2. 再检查依据。', tags: ['测试'], scene: 'self', category: '自主学习', color: 'orange', icon: 'layers', steps: ['先独立回答。', '再检查依据。'], evidence: '测试依据', examples: ['测试实例'], limits: '仅用于自动化测试'});
const makeSeed = count => {
  const custom = Array.from({length: count}, (_, i) => card(i + 1));
  return {version: 1, profile: {goal: '自动化测试', minutes: 25, guide: 'gentle', style: 'plain', encourage: 'quiet', memory: true}, adopted: custom.map(c => c.id), favorites: [], ratings: {}, usage: {}, custom, memories: [], sessions: [], blocks: 0, tasks: [], scene: 'self', onboarded: true};
};
const fixtureReply = (status, tokens, marker) => ({type: 'result', status, reply: marker, model: 'fixture-model', provider: 'fixture-only', usage: tokens === null ? {source: 'unavailable', total_tokens: null, prompt_tokens: null, completion_tokens: null} : {source: 'provider', total_tokens: tokens, prompt_tokens: tokens - 1, completion_tokens: 1}, billing: {status: 'unavailable', creditsConsumed: null, remainingCredits: null}, receipt: {requestId: `fixture-${marker}`}});
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const contexts = [];
let currentPage;

async function setup(count) {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, serviceWorkers: 'block'});
  contexts.push(context);
  const replies = [], chatRequests = [], pageErrors = [];
  await context.addInitScript(seed => {
    if (location.origin === 'http://127.0.0.1:4173' && !localStorage.getItem('learnflow.v1')) localStorage.setItem('learnflow.v1', JSON.stringify(seed));
  }, makeSeed(count));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      result.apiRequests.push({path: url.pathname, method: request.method(), fixture: true});
      const json = data => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
      if (url.pathname === '/api/health') return json({ok: true, service: 'LearnFlow local adapter', adapterVersion: '1.9.0', provider: 'openai-compatible', configured: true, busy: false, model: 'fixture-model', storesConversations: false, clients: []});
      if (url.pathname === '/api/models') return json({models: [{id: 'fixture-model', label: 'Fixture only'}], defaultModel: 'fixture-model', attachments: false, source: 'automated fixture'});
      if (url.pathname === '/api/chat/stream' && request.method() === 'POST') {
        chatRequests.push(request.postDataJSON());
        const reply = replies.shift();
        if (!reply) {result.errors.push('Unexpected chat request without queued fixture'); return route.fulfill({status: 500, contentType: 'application/json', body: '{"message":"No test fixture queued"}'});}
        return route.fulfill({status: 200, contentType: 'application/x-ndjson', body: JSON.stringify({type: 'status', phase: 'preparing', message: '自动化测试'}) + '\n' + JSON.stringify(reply) + '\n'});
      }
      // Fail closed: probes, OAuth, QQ and all other APIs must never reach the real service.
      return route.fulfill({status: 403, contentType: 'application/json', body: '{"error":"FIXTURE_ONLY","message":"Real API calls are disabled in this test."}'});
    }
    if (url.origin !== origin) {result.blockedExternal.push(url.origin); return route.abort('blockedbyclient');}
    return route.continue();
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => {pageErrors.push(error.message); result.errors.push(error.message);});
  await page.goto(origin + '/#session');
  await page.waitForFunction(() => window.LearnFlowComposer?.connectionStatus().connected && window.LearnFlowComposer.model() === 'fixture-model');
  await page.locator('#chat-input').waitFor({state: 'visible'});
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('learnflow.v1')));
  const summary = () => page.evaluate(() => window.LearnFlowLedger.summary(JSON.parse(localStorage.getItem('learnflow.v1')).ledger));
  async function send(status, tokens, marker) {
    const previous = chatRequests.length;
    replies.push(fixtureReply(status, tokens, marker));
    await page.locator('#chat-input').fill('自动化测试问题 ' + marker);
    await page.locator('#chat-form button[type="submit"]').click();
    await page.waitForFunction(text => [...document.querySelectorAll('.message-content')].some(el => el.textContent === text), marker);
    await page.locator('#chat-form button[type="submit"]').waitFor({state: 'visible'});
    equal(chatRequests.length, previous + 1, marker + ': exactly one intercepted frontend request');
    return chatRequests.at(-1);
  }
  return {context, page, state, summary, send, chatRequests, pageErrors};
}

try {
  const basic = await setup(2);
  await basic.send('completed', 101, 'complete-101');
  let stored = await basic.state();
  equal(stored.ledger.events.length, 1, 'completed response creates one event');
  equal(stored.ledger.events[0].tokens, 101, 'event preserves provider total 101');
  equal(stored.ledger.events[0].allocations.map(a => a.tokens), [51, 50], 'two-card allocation is 51 + 50');
  equal(stored.ledger.events[0].allocations.reduce((sum, a) => sum + a.tokens, 0), 101, 'allocation sum does not double-count provider total');
  equal((await basic.summary()).actualTokens, 101, 'library summary reports 101 actual tokens');
  const originalEvent = structuredClone(stored.ledger.events[0]);
  await basic.send('completed', null, 'complete-unknown');
  stored = await basic.state();
  equal(stored.ledger.events[1].tokens, null, 'missing usage remains null');
  check(stored.ledger.events[1].allocations.every(a => a.tokens === null), 'unknown allocations never become zero');
  equal(stored.ledger.events[1].source, 'unavailable', 'missing usage is marked unavailable');
  equal((await basic.summary()).actualTokens, 101, 'unknown usage does not add invented actual tokens');
  equal((await basic.summary()).unknownCalls, 1, 'unknown completed reply is tracked separately');
  for (const status of ['pending', 'received', 'requires_action']) {
    await basic.page.evaluate(() => window.LearnFlowComposer.resetVerification());
    await basic.send(status, 999, 'unfinished-' + status);
    equal((await basic.state()).ledger.events.length, 2, status + ' does not create a completed usage event');
    equal((await basic.summary()).actualTokens, 101, status + ' does not add token usage');
    equal(await basic.page.evaluate(() => window.LearnFlowComposer.connectionStatus().verified), false, status + ' does not mark a model verification success');
  }
  await basic.page.reload();
  await basic.page.waitForFunction(() => window.LearnFlowComposer?.model() === 'fixture-model');
  equal((await basic.state()).ledger.events.length, 2, 'ordinary reload does not duplicate recorded replies');
  equal((await basic.state()).ledger.events[0], originalEvent, 'ordinary reload keeps original event unchanged');
  equal(basic.pageErrors, [], 'basic flow has no uncaught browser errors');
  await basic.context.close();

  const crowded = await setup(13);
  await crowded.page.locator('a[href="#my-strategies"]').click();
  const targetId = 'custom-fixture-13';
  await crowded.page.locator(`[data-library="use"][data-card="${targetId}"]`).click();
  await crowded.page.locator('#chat-input').waitFor({state: 'visible'});
  const firstRequest = await crowded.send('completed', 101, 'crowded-before-edit');
  equal(firstRequest.strategies.length, 12, 'request respects 12-card adapter limit');
  check(firstRequest.strategies.some(c => c.id === targetId), 'explicitly chosen thirteenth card participates');
  const beforeEdit = await crowded.state(), preservedEvent = structuredClone(beforeEdit.ledger.events[0]);
  const oldVersion = preservedEvent.strategies.find(c => c.id === targetId).version;
  equal(preservedEvent.allocations.reduce((sum, c) => sum + c.tokens, 0), 101, '12-card request still allocates exactly 101');
  equal(preservedEvent.strategies.map(c => c.id), firstRequest.strategies.map(c => c.id), 'ledger participants equal actual request participants');

  await crowded.page.locator('a[href="#my-strategies"]').click();
  await crowded.page.locator(`.sl-title[data-detail="${targetId}"]`).click();
  await crowded.page.locator(`#modal [data-edit-card="${targetId}"]`).filter({hasText: '编辑卡片'}).click();
  const updatedInstructions = '1. 先写下猜测。\n2. 使用一个新例子验证。';
  await crowded.page.locator('#card-form [name="instructions"]').fill(updatedInstructions);
  await crowded.page.locator('#card-form button[type="submit"]').click();
  await crowded.page.waitForFunction(key => !document.querySelector('#modal').open && JSON.parse(localStorage.getItem('learnflow.v1')).custom.find(c => c.id === key)?.instructions.includes('新例子'), targetId);
  const afterEdit = await crowded.state();
  equal(afterEdit.ledger.events[0], preservedEvent, 'editing card does not rewrite historical usage evidence');
  const newVersion = await crowded.page.evaluate(key => window.LearnFlowLedger.cardVersion(JSON.parse(localStorage.getItem('learnflow.v1')).custom.find(c => c.id === key)), targetId);
  check(newVersion !== oldVersion, 'changed instructions produce a new content version');
  equal(afterEdit.custom.find(c => c.id === targetId).examples, ['测试实例'], 'editing instructions preserves unrelated examples');
  await crowded.page.locator('a[href="#my-strategies"]').click();
  await crowded.page.locator(`[data-library="use"][data-card="${targetId}"]`).click();
  await crowded.page.locator('#chat-input').waitFor({state: 'visible'});
  const secondRequest = await crowded.send('completed', 101, 'crowded-after-edit');
  equal(secondRequest.strategies.find(c => c.id === targetId).instructions, updatedInstructions, 'next frontend request contains edited instructions');
  const afterSecond = await crowded.state();
  equal(afterSecond.ledger.events[0], preservedEvent, 'new-version use still leaves old event unchanged');
  equal(afterSecond.ledger.events[1].strategies.find(c => c.id === targetId).version, newVersion, 'new response is attributed to the new content version');
  equal((await crowded.summary()).actualTokens, 202, 'two actual completed responses total 202 without duplication');
  const versionCounts = await crowded.page.evaluate(({key, oldVersion, newVersion}) => {
    const ledger = JSON.parse(localStorage.getItem('learnflow.v1')).ledger;
    return [window.LearnFlowLedger.summary(ledger, key, oldVersion).totalCalls, window.LearnFlowLedger.summary(ledger, key, newVersion).totalCalls];
  }, {key: targetId, oldVersion, newVersion});
  equal(versionCounts, [1, 1], 'old and new versions have independent one-response histories');
  await crowded.page.locator('a[href="#my-strategies"]').click();
  await crowded.page.screenshot({path: path.join(output, 'accounting-fixture.png'), fullPage: true});
  equal(crowded.pageErrors, [], 'crowded-card and edit flows have no uncaught browser errors');
  check(result.apiRequests.every(r => r.fixture), 'all API requests were fulfilled by fixtures, never passed through');
  equal(result.errors, [], 'test completed without route or page errors');
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.errors.push(error.message);
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({path: path.join(output, 'accounting-fixture-failure.png'), fullPage: true}).catch(() => {});
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await writeFile(path.join(output, 'accounting-fixture-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
