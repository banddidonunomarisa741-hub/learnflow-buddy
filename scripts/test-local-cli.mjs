// Deterministic child-process tests only. Never launches an installed Buddy CLI.
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {cliChat, cliModels} from '../server/local-cli.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'learnflow-cli-fixture-'));
const checks = [];
const trackedPids = new Set();
const check = (condition, name) => { assert.ok(condition, name); checks.push(name); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = String.raw`
const fs = require('node:fs');
const path = require('node:path');
if (process.argv.includes('--help')) {
  const id = path.basename(__filename).startsWith('client-b') ? 'fixture-b' : 'fixture-a';
  process.stdout.write('  --model <model> Select a model (auto, ' + id + ')\n');
  if (id === 'fixture-a') process.stdout.write('  --effort <level> Reasoning effort\n');
  process.exit(0);
}
const model = process.argv[process.argv.indexOf('--model') + 1];
fs.writeFileSync(path.join(__dirname, model + '.pid'), String(process.pid));
const streaming = process.argv[process.argv.indexOf('--output-format') + 1] === 'stream-json';
const event = item => process.stdout.write(JSON.stringify(item) + '\n');
const final = (result, extra = {}) => event({type:'result',is_error:false,result,...extra});
const delta = text => event({type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text}}});
const snapshot = text => event({type:'assistant',message:{role:'assistant',content:[{type:'text',text}]}});
process.stdin.resume();
process.stdin.on('end', () => {
  switch (model) {
    case 'empty-result': final(''); break;
    case 'whitespace-result': final('   \n\t'); break;
    case 'result-open-handle': final('Final answer before process cleanup.'); setInterval(() => {}, 10000); break;
    case 'snapshot-only': snapshot('Snapshot answer.'); setTimeout(() => final('Snapshot answer.'), 40); break;
    case 'snapshot-delta':
      delta('甲'); snapshot('甲乙'); delta('丙'); snapshot('甲乙丙丁'); final('甲乙丙丁'); break;
    case 'snapshot-replay':
      snapshot('甲乙'); delta('甲'); delta('乙'); final('甲乙'); break;
    case 'cached-usage':
      final('Usage fixture.', {usage:{input_tokens:10,output_tokens:4,cache_creation_input_tokens:3,cache_read_input_tokens:7}}); break;
    case 'missing-usage': final('No usage reported.'); break;
    case 'capture-options': {
      const index = process.argv.indexOf('--effort');
      final(JSON.stringify({effort:index < 0 ? null : process.argv[index + 1]})); break;
    }
    case 'stderr-secret':
      process.stderr.write('HTTP 401 Authorization: Bearer SYNTHETIC_PRIVATE_TOKEN\nrefresh_token=SYNTHETIC_REFRESH_TOKEN\n');
      event({type:'result',is_error:true,result:'HTTP 401 Authorization: Bearer SYNTHETIC_PRIVATE_TOKEN refresh_token=SYNTHETIC_REFRESH_TOKEN'});
      process.exitCode = 1; break;
    case 'cancel-child':
    case 'timeout-child': setInterval(() => {}, 10000); break;
    default: final('Synthetic answer.', {usage:{input_tokens:2,output_tokens:3}});
  }
});
`;

const cliA = path.join(root, 'client-a.cjs');
const cliB = path.join(root, 'client-b.cjs');
await writeFile(cliA, fixture);
await writeFile(cliB, fixture);
const message = [{role:'user',content:'Synthetic learning test; no real model or user data.'}];
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };

async function pidFor(model, required = true) {
  for (let i = 0; i < 60; i++) {
    try {
      const pid = Number(await readFile(path.join(root, model + '.pid'), 'utf8'));
      if (Number.isInteger(pid) && pid > 0) { trackedPids.add(pid); return pid; }
    } catch {}
    await pause(25);
  }
  if (required) throw Error('Synthetic CLI did not write its PID for ' + model);
  return null;
}

async function dead(pid) {
  for (let i = 0; i < 60; i++) {
    if (!alive(pid)) { trackedPids.delete(pid); return true; }
    await pause(25);
  }
  return false;
}

async function chat(model, options = {}) {
  return cliChat(cliA, message, model, {timeoutMs:2500,...options});
}

try {
  for (const model of ['empty-result','whitespace-result']) {
    await assert.rejects(chat(model, {onDelta() {}}), undefined, model + ' must not be reported completed');
    checks.push(model + ' rejected instead of verified');
    check(await dead(await pidFor(model)), model + ' child cleaned up');
  }

  const began = performance.now();
  const finalDeltas = [];
  const completed = await chat('result-open-handle', {onDelta:text=>finalDeltas.push(text)});
  check(completed.reply === 'Final answer before process cleanup.', 'final result is accepted before child close');
  check(performance.now() - began < 1800, 'valid final result does not wait for hanging process handle');
  check(finalDeltas.join('') === completed.reply, 'result-only response reaches visible stream');
  check(await dead(await pidFor('result-open-handle')), 'completed hanging child is terminated');

  const snapshotDeltas = [];
  const snapshotResult = await chat('snapshot-only', {onDelta:text=>snapshotDeltas.push(text)});
  check(snapshotDeltas.join('') === snapshotResult.reply, 'assistant-only snapshot becomes visible without duplication');
  const mixedDeltas = [];
  const mixed = await chat('snapshot-delta', {onDelta:text=>mixedDeltas.push(text)});
  check(mixedDeltas.join('') === '甲乙丙丁' && mixed.reply === '甲乙丙丁', 'interleaved snapshot and delta text is emitted once');
  const replayDeltas = [];
  const replay = await chat('snapshot-replay', {onDelta:text=>replayDeltas.push(text)});
  check(replayDeltas.join('') === replay.reply && replay.reply === '甲乙', 'snapshot followed by replayed same deltas does not duplicate visible text');

  const controller = new AbortController();
  // Attach a rejection handler immediately so cancellation cannot be unhandled.
  const canceled = chat('cancel-child', {signal:controller.signal,onDelta() {}}).then(value=>({value}),error=>({error}));
  const canceledPid = await pidFor('cancel-child');
  controller.abort();
  const cancellation = await canceled;
  check(cancellation.error instanceof Error, 'explicit cancellation rejects active generation');
  check(await dead(canceledPid), 'explicit cancellation kills synthetic child');

  const timed = chat('timeout-child', {timeoutMs:900,onDelta() {}}).then(value=>({value}),error=>({error}));
  const timedPid = await pidFor('timeout-child');
  const timeout = await timed;
  check(timeout.error instanceof Error, 'bounded timeout rejects hanging generation');
  check(await dead(timedPid), 'timeout kills synthetic child');

  let secretError;
  const visible = [];
  try { await chat('stderr-secret', {onDelta:text=>visible.push(text),onStatus:text=>visible.push(text)}); }
  catch (error) { secretError = error; }
  check(secretError instanceof Error, 'CLI error result is not treated as successful answer');
  visible.push(secretError?.message || '');
  check(!visible.join('\n').includes('SYNTHETIC_PRIVATE_TOKEN') && !visible.join('\n').includes('SYNTHETIC_REFRESH_TOKEN'), 'stderr and result credential markers never reach public errors or deltas');

  const cached = await chat('cached-usage');
  check(cached.usage.source === 'provider', 'reported usage retains provider attribution');
  check(cached.usage.total_tokens === 14 && cached.usage.cache_read_tokens === 7 && cached.usage.cache_creation_tokens === 3 && cached.usage.basis === 'reported_input_plus_output', 'input and output are summed transparently while cache fields remain separate to avoid possible double counting');
  const unknown = await chat('missing-usage');
  check(unknown.usage.total_tokens === null && unknown.usage.source === 'unavailable', 'missing usage remains unknown and is not labeled provider-reported');

  const firstModels = await cliModels(cliA);
  const secondModels = await cliModels(cliB);
  check(firstModels.includes('fixture-a') && !firstModels.includes('fixture-b'), 'first client returns its declared model list');
  check(secondModels.includes('fixture-b') && !secondModels.includes('fixture-a'), 'model cache is isolated by client path');

  const supportedTeacher = await chat('capture-options', {effort:'low'});
  check(JSON.parse(supportedTeacher.reply).effort === 'low', 'teacher low effort is passed when selected CLI declares support');
  const unsupportedTeacher = await cliChat(cliB,message,'capture-options',{effort:'low',timeoutMs:2500});
  check(JSON.parse(unsupportedTeacher.reply).effort === null, 'unsupported CLI does not receive an unknown effort flag');
  const ordinaryLearning = await chat('capture-options');
  check(JSON.parse(ordinaryLearning.reply).effort === null, 'ordinary learning keeps default effort even when low is supported');
  const supportedProbe = await chat('capture-options',{probe:true});
  check(JSON.parse(supportedProbe.reply).effort === 'low', 'short verification uses low effort only on a supporting CLI');

  console.log(JSON.stringify({passed:checks.length,fixtureOnly:true,realModelCalls:0,realQQCalls:0,checks},null,2));
} finally {
  for (const pid of trackedPids) { if (alive(pid)) { try { process.kill(pid); } catch {} } }
  // The recursive target is the exact fresh mkdtemp directory, validated inside os.tmpdir.
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(root));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(root).startsWith('learnflow-cli-fixture-')) throw Error('Unsafe fixture cleanup target');
  await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
