import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Isolated browser-only fixtures: every API request is intercepted. No model or QQ calls.
const require = createRequire('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium} = require('playwright');
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(workspace, 'output', 'strategy-library-1.9');
await fs.mkdir(output, {recursive: true});
const BASE = 'http://127.0.0.1:4173/';
const checks = [], pageErrors = [], blockedActions = [];
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const contexts = [];
const record = (value, label) => { assert.ok(value, label); checks.push(label); };
const same = (left, right, label) => { assert.deepEqual(left, right, label); checks.push(label); };
const seed = {
  version: 1, profile: {goal: 'UI 回归合成样本', minutes: 25, guide: 'gentle', style: 'plain', encourage: 'quiet', memory: false},
  adopted: ['roots', 'plain'], favorites: [], ratings: {}, usage: {}, custom: [], memories: [], sessions: [], blocks: 0,
  tasks: [], scene: 'exam', onboarded: true, ui: {theme: 'light', reducedMotion: true}
};
async function fresh(label, viewport = {width: 1440, height: 1000}) {
  const context = await browser.newContext({viewport, acceptDownloads: true, reducedMotion: 'reduce'});
  contexts.push(context);
  await context.addInitScript(value => {
    if (!localStorage.getItem('learnflow.v1')) localStorage.setItem('learnflow.v1', JSON.stringify(value));
    window.__strategyFixtureExecuted = false;
  }, seed);
  await context.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (/\/api\/(chat|probe|connection)|\/api\/ecosystem\/qq\//.test(pathname) && request.method() !== 'GET') blockedActions.push({context: label, pathname, method: request.method()});
    if (pathname === '/api/health') return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, service: 'LearnFlow local adapter', configured: false, clients: [], provider: 'unconfigured', mode: 'demo', adapterVersion: 'fixture'})});
    return route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({message: 'Isolated UI fixture; network actions are disabled.'})});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => pageErrors.push({context: label, message: error.message}));
  await page.goto(BASE + '#my-strategies', {waitUntil: 'domcontentloaded'});
  await page.locator('.sl-library').waitFor();
  return page;
}
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('learnflow.v1')));
const cardState = (page, id) => page.evaluate(id => {
  const store = JSON.parse(localStorage.getItem('learnflow.v1'));
  const card = store.custom.find(card => card.id === id);
  return {card, version: window.LearnFlowLedger.cardVersion(card), summary: window.LearnFlowLedger.summary(window.LearnFlowLedger.normalizeStore(store.ledger), id)};
}, id);
const core = card => Object.fromEntries(['title', 'description', 'instructions', 'tags', 'scene', 'steps', 'examples', 'limits', 'evidence'].map(key => [key, card[key]]));
async function closeModal(page) {
  if (await page.locator('#modal').evaluate(element => element.open)) await page.locator('#modal .modal-head [data-action="close"]').click();
}
async function openDetail(page, id) {
  await closeModal(page);
  await page.goto(BASE + '#my-strategies', {waitUntil: 'domcontentloaded'});
  await page.locator(`.sl-title[data-detail="${id}"]`).click();
  await page.locator('.sl-detail').waitFor();
}
async function edit(page, id) {
  await openDetail(page, id);
  await page.locator(`#modal [data-edit-card="${id}"]`).first().click();
  await page.locator('#card-form').waitFor();
}
async function saveEditor(page) {
  await page.locator('#card-form button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  await page.locator('.sl-library').waitFor();
}
async function downloadJSON(page, click) {
  const next = page.waitForEvent('download');
  await click();
  const download = await next;
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  return {json: JSON.parse(buffer.toString('utf8')), buffer, name: download.suggestedFilename()};
}
async function uploadJSON(page, click, value, filename = 'fixture.json') {
  const next = page.waitForEvent('filechooser');
  await click();
  const chooser = await next;
  await chooser.setFiles({name: filename, mimeType: 'application/json', buffer: Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))});
}
async function screenshot(page, name) { await page.screenshot({path: path.join(output, name), fullPage: true}); }

let lastPage;
try {
  const author = lastPage = await fresh('author');
  await author.locator('.sl-heading [data-action="create-card"]').click();
  const authored = {
    title: '回归测试 · 从词根到语境', description: '先寻找可靠的构词线索，再把单词放回句子里。',
    instructions: '1. 先让我猜测词义。\n2. 区分可靠词源与个人联想。\n3. 用一个新语境检验。',
    tags: ['词根', '新语境', '自主选择'],
    examples: ['学习者：unpredictable 怎么记？\n助手：先看 predictable，再想 un- 在这里的作用。', '学习者：我还分不清。\n助手：把它放回天气变化的句子，再说说意思。'],
    limits: '没有可靠词源时，不强行拆词。\n初学者也可以改用例句。', evidence: '这是作者的合成测试示例，不代表学习效果已验证。'
  };
  await author.locator('#card-form [name="title"]').fill(authored.title);
  await author.locator('#card-form [name="description"]').fill(authored.description);
  await author.locator('#card-form [name="instructions"]').fill(authored.instructions);
  await author.locator('#card-form [name="tags"]').fill(authored.tags.join('，'));
  await author.locator('#card-form label:has([name="scene"][value="exam"])').click();
  await author.locator('.studio-examples summary').click();
  await author.locator('#card-form [name="examples"]').fill(authored.examples.join('\n\n---\n\n'));
  await author.locator('#card-form [name="limits"]').fill(authored.limits);
  await author.locator('#card-form [name="evidence"]').fill(authored.evidence);
  await screenshot(author, 'ui-author-card-editor.png');
  await saveEditor(author);
  const authorCard = (await state(author)).custom[0], authorId = authorCard.id;
  same(authorCard.examples, authored.examples, 'author card preserves multiline example boundaries');
  record(authorCard.limits === authored.limits && authorCard.evidence === authored.evidence, 'author card preserves boundaries and evidence');
  record((await state(author)).adopted.includes(authorId), 'new card is adopted only after its save action');

  // Supply synthetic ledger amounts only to exercise UI attribution; never call a real model.
  await author.evaluate(id => {
    const data = JSON.parse(localStorage.getItem('learnflow.v1')), L = window.LearnFlowLedger;
    data.ledger = L.normalizeStore(data.ledger);
    const own = data.custom.find(card => card.id === id), tone = window.LF_CARDS.find(card => card.id === 'plain');
    const strategies = [own, tone].map(card => ({id: card.id, title: card.title, version: L.cardVersion(card)}));
    for (const [suffix, source, tokens] of [['provider', 'provider', 101], ['estimated', 'estimated', 14], ['unknown', 'unavailable', null]]) {
      L.record(data.ledger, {id: 'ui-fixture-' + suffix, at: '2026-09-08T09:00:00Z', sessionId: 'fixture-session', model: 'synthetic-ui-fixture', source, tokens, strategies});
    }
    localStorage.setItem('learnflow.v1', JSON.stringify(data));
  }, authorId);
  await author.reload({waitUntil: 'domcontentloaded'});
  await author.locator('.sl-library').waitFor();
  const authorBefore = await cardState(author, authorId);
  record(authorBefore.summary.actualTokens === 51 && authorBefore.summary.estimatedTokens === 7 && authorBefore.summary.unknownCalls === 1, 'synthetic 101-token response is split as 51/50 and estimates/unknown stay separate');
  await author.locator(`[data-library="share"][data-card="${authorId}"]`).click();
  const url = await author.locator('#sl-share-url').inputValue(), fragment = new URL(url).hash;
  record(fragment.startsWith('#share=') && !url.includes('synthetic-ui-fixture') && url.length < 25000, 'card link is generated without usage fixture details');

  const recipient = lastPage = await fresh('recipient');
  await recipient.goto(BASE + fragment, {waitUntil: 'domcontentloaded'});
  await recipient.locator('[data-library="accept"]').waitFor();
  record((await state(recipient)).custom.length === 0, 'share preview does not silently create or adopt a card');
  await screenshot(recipient, 'ui-shared-card-preview.png');
  await recipient.locator('[data-library="accept"]').click();
  await recipient.locator('.sl-library').waitFor();
  const recipientCard = (await state(recipient)).custom[0], recipientId = recipientCard.id;
  const recipientOriginal = await cardState(recipient, recipientId);
  same(core(recipientCard), core(authorBefore.card), 'accepted card retains all original strategy core fields');
  record(recipientOriginal.version === authorBefore.version && recipientOriginal.summary.actualTokens === 0, 'sharing preserves the content version without transferring real usage');
  await recipient.goto(BASE + fragment, {waitUntil: 'domcontentloaded'});
  await recipient.locator('[data-library="accept"]').click();
  record((await state(recipient)).custom.length === 1, 'accepting the same share link twice does not duplicate the card');
  await edit(recipient, recipientId);
  await saveEditor(recipient);
  const unchanged = await cardState(recipient, recipientId);
  same(core(unchanged.card), core(recipientOriginal.card), 'editing and saving without changes retains strategy fields exactly');
  record(unchanged.version === recipientOriginal.version, 'unchanged save does not create a new content hash');

  await openDetail(author, authorId);
  await author.locator(`[data-library="feedback"][data-card="${authorId}"]`).click();
  await author.locator('#sl-feedback-form label:has([name="rating"][value="4"])').click();
  await author.locator('#sl-feedback-form label:has([name="helped"][value="partly"])').click();
  await author.locator('#sl-feedback-form [name="note"]').fill('词根提示清楚，下一版希望一次只练三个词。');
  await author.locator('#sl-feedback-form button[type="submit"]').click();
  await author.locator('.sl-feedback-list article').waitFor();
  const originalFeedback = (await state(author)).ledger.feedback[0];
  record(originalFeedback.version === authorBefore.version && originalFeedback.snapshot.actualTokens === 51, 'feedback is bound to the card version and calculated usage snapshot');
  await author.locator(`[data-library="export-feedback"][data-card="${originalFeedback.id}"]`).click();
  record(await author.locator('#sl-download-feedback').isVisible(), 'feedback export requires a separate explicit confirmation');
  const feedbackFile = await downloadJSON(author, () => author.locator('#sl-download-feedback').click());
  record(feedbackFile.json.type === 'learnflow-feedback' && feedbackFile.json.feedback.source === 'imported-self-report' && feedbackFile.json.feedback.verifiedUsage === false, 'feedback file explicitly carries self-report trust');
  await openDetail(recipient, recipientId);
  await recipient.locator(`[data-library="feedback"][data-card="${recipientId}"]`).click();
  // The importer must distrust forged metadata as well as correctly exported files.
  const tamperedFeedback = structuredClone(feedbackFile.json);
  tamperedFeedback.feedback.source = 'provider'; tamperedFeedback.feedback.verifiedUsage = true;
  await uploadJSON(recipient, () => recipient.locator(`[data-library="import-feedback"][data-card="${recipientId}"]`).click(), tamperedFeedback, 'external-feedback-fixture.json');
  await recipient.locator('#sl-confirm-feedback').waitFor();
  record((await state(recipient)).ledger.feedback.length === 0, 'external feedback waits for import confirmation');
  await recipient.locator('#sl-confirm-feedback').click();
  await recipient.locator('.sl-feedback-list article').waitFor();
  const importedFeedback = (await state(recipient)).ledger.feedback[0];
  record(importedFeedback.source === 'imported-self-report' && !importedFeedback.verifiedUsage && importedFeedback.cardId === recipientId, 'forged external verification is downgraded and mapped to the local card');
  record((await cardState(recipient, recipientId)).summary.actualTokens === 0, 'importing feedback never creates local model use');
  await screenshot(recipient, 'ui-imported-feedback.png');

  await edit(author, authorId);
  await author.locator('#card-form [name="instructions"]').fill(authored.instructions + '\n4. 每轮最多练三个词。');
  await saveEditor(author);
  const changed = await cardState(author, authorId);
  record(changed.version !== authorBefore.version && changed.card.parent.version === authorBefore.version, 'changing the method creates a new version linked to its parent');
  await openDetail(author, authorId);
  await author.locator(`[data-library="feedback"][data-card="${authorId}"]`).click();
  record(await author.locator('.sl-feedback-list article').count() === 0 && (await state(author)).ledger.feedback[0].version === authorBefore.version, 'old feedback is retained but not presented as feedback on the new version');

  const hostile = lastPage = await fresh('hostile');
  const evilPayload = {type: 'learnflow-strategy', version: 1, card: {...authorBefore.card, id: 'hostile-fixture', title: '<img src=x onerror="window.__strategyFixtureExecuted=true">', description: '<script>window.__strategyFixtureExecuted=true</script>', examples: ['<svg onload="window.__strategyFixtureExecuted=true">'], limits: '<iframe srcdoc="<script>alert(1)</script>">', source: 'javascript:window.__strategyFixtureExecuted=true'}};
  await hostile.goto(BASE + '#share=' + Buffer.from(JSON.stringify(evilPayload)).toString('base64url'), {waitUntil: 'domcontentloaded'});
  await hostile.locator('[data-library="accept"]').waitFor();
  record(!await hostile.evaluate(() => window.__strategyFixtureExecuted) && await hostile.locator('.sl-import-card script,.sl-import-card iframe,.sl-import-card svg,.sl-import-card img').count() === 0, 'HTML-like card content is escaped in preview and does not execute');
  await hostile.locator('[data-library="accept"]').click();
  const evilId = (await state(hostile)).custom[0].id;
  await openDetail(hostile, evilId);
  record(!await hostile.evaluate(() => window.__strategyFixtureExecuted) && await hostile.locator('.lf-strategy-guide script,.lf-strategy-guide iframe,.lf-strategy-guide img').count() === 0, 'adopted malicious text stays inert in the strategy guide');
  await hostile.goto(BASE + '#share=bad%payload', {waitUntil: 'domcontentloaded'});
  await hostile.locator('#modal h2').filter({hasText: '这张卡没有打开'}).waitFor();
  record(!await hostile.evaluate(() => window.__strategyFixtureExecuted) && (await state(hostile)).custom.length === 1, 'malformed links show an error without changing the card library');

  await closeModal(author);
  await author.goto(BASE + '#settings/data', {waitUntil: 'domcontentloaded'});
  await author.locator('[data-action="export-all"]').first().waitFor();
  const backup = await downloadJSON(author, () => author.locator('[data-action="export-all"]').first().click());
  const restored = lastPage = await fresh('restored');
  await restored.goto(BASE + '#settings/data', {waitUntil: 'domcontentloaded'});
  await uploadJSON(restored, () => restored.locator('[data-action="restore-backup"]').first().click(), backup.buffer, 'local-backup-fixture.json');
  await restored.locator('#confirm-restore').waitFor();
  record((await state(restored)).custom.length === 0, 'backup restoration requires explicit replacement confirmation');
  await restored.locator('#confirm-restore').click();
  const restoredCard = await cardState(restored, authorId);
  same(core(restoredCard.card), core(changed.card), 'backup roundtrip preserves all current strategy core fields');
  record(restoredCard.version === changed.version && restoredCard.card.parent.version === authorBefore.version, 'backup roundtrip preserves current hash and parent lineage');
  record(restoredCard.summary.actualTokens === 0 && restoredCard.summary.totalCalls === 0 && restoredCard.summary.selfReported.reportedProviderTokens === 51 && restoredCard.summary.selfReported.reportedEstimatedTokens === 7 && restoredCard.summary.selfReported.unknownCalls === 1, 'restored provider, estimated and unknown amounts remain separate self-reports');
  await restored.goto(BASE + '#my-strategies', {waitUntil: 'domcontentloaded'});
  await restored.locator(`[data-library="history"][data-card="${authorId}"]`).click();
  await restored.locator('.sl-rules summary').filter({hasText: '备份恢复记录'}).click();
  record(await restored.locator('#modal').innerText().then(text => text.includes('自述模型量 51') && text.includes('未纳入上方本机用量')), 'restored self-reports are visibly labeled apart from local measurements');
  await screenshot(restored, 'ui-restored-self-report.png');

  const mobile = lastPage = await fresh('mobile', {width: 390, height: 844});
  await mobile.goto(BASE + fragment, {waitUntil: 'domcontentloaded'});
  await mobile.locator('[data-library="accept"]').click();
  const mobileId = (await state(mobile)).custom[0].id;
  const measure = async label => {
    const sizes = await mobile.evaluate(() => ({viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, modal: document.querySelector('#modal').open ? {width: document.querySelector('#modal').clientWidth, scroll: document.querySelector('#modal').scrollWidth} : null}));
    record(sizes.html <= sizes.viewport + 1 && sizes.body <= sizes.viewport + 1 && (!sizes.modal || sizes.modal.scroll <= sizes.modal.width + 1), label + ' has no horizontal overflow at 390px');
  };
  await measure('strategy library');
  await screenshot(mobile, 'ui-mobile-library.png');
  await edit(mobile, mobileId);
  await mobile.locator('.studio-examples summary').click();
  await measure('expanded card editor');
  await screenshot(mobile, 'ui-mobile-card-editor.png');
  await saveEditor(mobile);
  await openDetail(mobile, mobileId);
  await measure('strategy detail');
  await screenshot(mobile, 'ui-mobile-card-detail.png');
  record(blockedActions.length === 0, 'the UI flow attempts no model calls or QQ writes');
  record(pageErrors.length === 0, 'all isolated contexts have no uncaught page errors');

  const report = {ok: true, checkedAt: new Date().toISOString(), fixtureOnly: true, actualModelCalls: 0, actualQQWrites: 0, passed: checks.length, checks, pageErrors, blockedActions};
  await fs.writeFile(path.join(output, 'strategy-library-ui-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (lastPage && !lastPage.isClosed()) await screenshot(lastPage, 'ui-failure.png').catch(() => {});
  const report = {ok: false, checkedAt: new Date().toISOString(), fixtureOnly: true, actualModelCalls: 0, passed: checks.length, checks, error: {message: error.message, stack: error.stack}, pageErrors, blockedActions};
  await fs.writeFile(path.join(output, 'strategy-library-ui-results.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close();
}
