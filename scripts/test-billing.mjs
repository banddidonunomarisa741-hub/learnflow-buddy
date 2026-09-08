import assert from 'node:assert/strict';
import {withBilling} from '../server/billing.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for (const provider of ['local-codebuddy','workbuddy-localassistant','openai-compatible']) {
  const source={provider,reply:'test',usage:{total_tokens:420,source:'provider'},total_cost_usd:0,billing:{creditsConsumed:0,remainingCredits:999}};
  const result=withBilling(source);
  assert.equal(result.reply,'test');
  assert.equal(result.usage.total_tokens,420);
  assert.equal(result.billing.creditsConsumed,null);
  assert.equal(result.billing.remainingCredits,null);
  assert.equal(result.billing.status,'unavailable');
  assert.equal(result.billing.source,'not_reported');
  assert.equal(source.billing.creditsConsumed,0);
}
console.log('Billing: tokens, placeholder costs and unverified amounts never become Tencent credits.');
const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const render=vm.runInNewContext(ui.slice(ui.indexOf('function usageReceipt(m){'),ui.indexOf('function messageView(m,index){'))+';usageReceipt',{
  fmt:n=>String(n),esc:s=>String(s).replaceAll('<','&lt;')
});
const missing=render({usage:{source:'unavailable',actual:null,estimated:null},source:'授权接口'});
assert.ok(missing.includes('当前通道未提供'));
assert.ok(!missing.includes('演示未调用'));
assert.ok(!missing.includes('演示估算'));
const demo=render({usage:{source:'estimated',actual:null,estimated:400}});
assert.ok(demo.includes('演示未调用模型'));
const actual=render({usage:{source:'provider',actual:0},providerUsage:{prompt_tokens:0,completion_tokens:0},billing:{note:'<unsafe>'}});
assert.ok(actual.includes('0 Tokens'));
assert.ok(actual.includes('&lt;unsafe>'));
assert.ok(actual.includes('本轮积分</dt><dd>当前通道未提供'));
console.log('Receipts: missing usage is not a free demo; zero tokens stay tokens; text is escaped.');
