/** Synthetic local OAuth + real HTTP/MCP SDK regression. No provider/QQ/model calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { request as rawRequest } from 'node:http';
import { LearnFlowOAuth } from '../buddy-app/service/oauth.mjs';
import { startService, RESOURCE_URI } from '../buddy-app/service/server.mjs';

const require=createRequire(new URL('../buddy-app/service/package.json',import.meta.url));
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const random=()=>randomBytes(32).toString('base64url'),hash=s=>createHash('sha256').update(s).digest('hex');
const pkce=()=>{const verifier=random();return {verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};};
const actor={id:'fixture-learner',label:'测试学习者',source:'workbuddy-oauth'};
const req=(headers={})=>({headers});
const codeError=(code,fn)=>assert.throws(fn,e=>e.code===code);
function temp(){const dir=mkdtempSync(join(tmpdir(),'learnflow-auth-test-'));return {dir,remove(){const target=resolve(dir);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('learnflow-auth-test-'));rmSync(target,{recursive:true,force:true});}};}
function fixture(t,options={}){const tmp=temp(),auth=new LearnFlowOAuth({dataDir:tmp.dir,baseURL:'https://fixture.learnflow.invalid',...options});t.after(()=>{auth.close();tmp.remove();});return {auth,dir:tmp.dir};}
function capture(){return {status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(text=''){this.body+=text;}};}
function authorize(auth,{scope='learning:read learning:write',who=actor,redirect='http://127.0.0.1/oauth/callback'}={}){
  const client=auth.register({redirect_uris:[redirect],client_name:'Synthetic MCP client'}),proof=pkce(),state=random();
  const params=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope,state,code_challenge:proof.challenge,code_challenge_method:'S256',resource:auth.resource});
  const consent=auth.authorizeQuery(params),issued=auth.issueCode(consent,'fixture-pending',who);
  return {client,proof,params,code:new URL(issued.url).searchParams.get('code'),input:{grant_type:'authorization_code',client_id:client.client_id,redirect_uri:redirect,resource:auth.resource,code_verifier:proof.verifier,code:new URL(issued.url).searchParams.get('code')}};
}
const authRequest=token=>req({authorization:`Bearer ${token}`});
const rawStatus=(url,headers)=>new Promise((resolve,reject)=>{const r=rawRequest(url,{headers},response=>{const status=response.statusCode;response.resume();response.on('end',()=>resolve(status));});r.on('error',reject);r.end();});
async function httpFixture(t){const tmp=temp(),service=await startService({development:true,port:0,dataDir:tmp.dir,workbuddy:{}});const clients=[];t.after(async()=>{for(const c of clients)await c.close().catch(()=>{});await service.close();tmp.remove();});
  const post=async(path,data,headers={})=>fetch(service.url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data),redirect:'manual'});
  const dev=async(profile='learner')=>{const response=await post('/dev/session',{profile},{Origin:service.url,'X-LearnFlow-Preview-Nonce':service.auth.previewNonce});assert.equal(response.status,200);return {...await response.json(),cookie:response.headers.getSetCookie()[0].split(';')[0]};};
  const connect=async token=>{const c=new Client({name:'learnflow-regression',version:'1.0.0'});clients.push(c);await c.connect(new StreamableHTTPClientTransport(new URL(service.url+'/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));return c;};
  return {service,post,dev,connect};
}

test('OAuth redirect/source allowlist, PKCE-only, exact resource, duplicate and unknown scopes',t=>{
  const {auth}=fixture(t,{connectorSource:'learnflow-learning-cloud',redirectOrigins:['https://callback.example.invalid']});
  for(const uri of ['workbuddy://workbuddy/mcp/connector%3Alearnflow-learning-cloud/oauth/callback','http://127.0.0.1:9999/oauth/callback','http://[::1]:9999/oauth/callback','https://callback.example.invalid/cb'])assert.equal(auth.validRedirect(uri),true);
  for(const uri of ['workbuddy://workbuddy/mcp/connector%3Aanother-source/oauth/callback','https://evil.invalid/cb','http://evil.invalid/oauth/callback','http://127.0.0.1/other','https://callback.example.invalid.evil.invalid/cb','https://user@callback.example.invalid/cb','https://callback.example.invalid/cb#secret'])assert.equal(auth.validRedirect(uri),false);
  codeError('invalid_request',()=>auth.register({redirect_uris:['https://evil.invalid']}));
  const flow=authorize(auth);const repeated=new URLSearchParams(flow.params);repeated.append('client_id',flow.client.client_id);codeError('invalid_request',()=>auth.authorizeQuery(repeated));
  for(const [field,value,code]of [['code_challenge_method','plain','invalid_request'],['resource','https://else.invalid/mcp','invalid_target'],['scope','learning:admin','invalid_scope'],['redirect_uri','http://127.0.0.1:123/oauth/callback','invalid_request']]){const p=new URLSearchParams(flow.params);p.set(field,value);codeError(code,()=>auth.authorizeQuery(p));}
});

test('authorization codes are single-use, verifier/client/redirect/resource bound, expirable',t=>{
  const {auth}=fixture(t),flow=authorize(auth),other=auth.register({redirect_uris:['http://127.0.0.1/oauth/callback']});
  for(const override of [{code_verifier:random()},{client_id:other.client_id},{redirect_uri:'http://localhost/oauth/callback'}])codeError('invalid_grant',()=>auth.token({...flow.input,...override}));
  codeError('invalid_target',()=>auth.token({...flow.input,resource:'https://else.invalid/mcp'}));
  const tokens=auth.token(flow.input);assert.equal(auth.authenticate(authRequest(tokens.access_token)).actor.id,actor.id);codeError('invalid_grant',()=>auth.token(flow.input));
  const expired=authorize(auth);auth.db.prepare("UPDATE auth_entries SET expires=0 WHERE kind='code' AND key=?").run(hash(expired.code));codeError('invalid_grant',()=>auth.token(expired.input));
  auth.db.prepare("UPDATE auth_entries SET expires=0 WHERE kind='access' AND key=?").run(hash(tokens.access_token));codeError('invalid_token',()=>auth.authenticate(authRequest(tokens.access_token)));
});

test('refresh rotation and replay revoke entire grant persistently; downscope cannot escalate',t=>{
  const {auth,dir}=fixture(t),flow=authorize(auth),first=auth.token(flow.input),refreshInput={grant_type:'refresh_token',client_id:flow.client.client_id,resource:auth.resource,refresh_token:first.refresh_token};
  codeError('invalid_scope',()=>auth.token({...refreshInput,scope:'learning:read learning:admin'}));
  const second=auth.token({...refreshInput,scope:'learning:read'});assert.equal(second.scope,'learning:read');assert.equal(auth.authenticate(authRequest(second.access_token)).scope,'learning:read');
  codeError('invalid_grant',()=>auth.token(refreshInput));codeError('invalid_token',()=>auth.authenticate(authRequest(first.access_token)));codeError('invalid_token',()=>auth.authenticate(authRequest(second.access_token)));
  const another=new LearnFlowOAuth({dataDir:dir,baseURL:auth.base});try{codeError('invalid_token',()=>another.authenticate(authRequest(second.access_token)));}finally{another.close();}
  codeError('invalid_grant',()=>auth.token({...refreshInput,refresh_token:second.refresh_token}));
});

test('revocation checks client binding; valid revocation invalidates access and refresh',t=>{
  const {auth}=fixture(t),flow=authorize(auth),tokens=auth.token(flow.input);
  auth.revoke({token:tokens.access_token,client_id:'wrong-client'});assert.equal(auth.authenticate(authRequest(tokens.access_token)).actor.id,actor.id);
  auth.revoke({token:tokens.refresh_token,client_id:flow.client.client_id});codeError('invalid_token',()=>auth.authenticate(authRequest(tokens.access_token)));codeError('invalid_grant',()=>auth.token({grant_type:'refresh_token',client_id:flow.client.client_id,resource:auth.resource,refresh_token:tokens.refresh_token}));
  auth.revoke({token:'not-a-token'});
});

test('browser consent requires same origin, bound flow cookie and CSRF; deny is not an approval',async t=>{
  const {auth}=fixture(t);const flow=authorize(auth),res=capture();auth.startConsent(req(),res,flow.params);
  const requestId=res.body.match(/name="requestId" value="([^"]+)"/)[1],csrf=res.body.match(/name="csrf" value="([^"]+)"/)[1],cookie=res.headers['Set-Cookie'].split(';')[0],input={requestId,csrf,decision:'allow'};
  await assert.rejects(()=>auth.decide(req({origin:'https://evil.invalid',cookie}),capture(),input),e=>e.code==='origin_rejected');
  await assert.rejects(()=>auth.decide(req({origin:auth.base,cookie:'lf_flow=wrong'}),capture(),input),e=>e.code==='invalid_request');
  await assert.rejects(()=>auth.decide(req({origin:auth.base,cookie}),capture(),{...input,csrf:random()}),e=>e.code==='invalid_request');
  await assert.rejects(()=>auth.decide(req({origin:auth.base,cookie}),capture(),{...input,csrf:'错'.repeat(csrf.length)}),e=>e.code==='invalid_request'&&e.status===400);
  const denial=capture();await auth.decide(req({origin:auth.base,cookie}),denial,{...input,decision:'deny'});assert.equal(new URL(denial.headers.Location).searchParams.get('error'),'access_denied');assert.equal(auth.get('pending',requestId),null);
  await assert.rejects(()=>auth.decide(req({origin:auth.base,cookie}),capture(),input),e=>e.code==='invalid_request');
});

test('production rejects persisted development actors and cannot create a preview session',t=>{
  const {auth,dir}=fixture(t,{development:true}),preview={id:'preview_learner',label:'学习者',source:'development-only'},tokens=auth.mint(preview,'fixture-preview'),login=random();auth.put('browser',hash(login),preview,1800);
  const production=new LearnFlowOAuth({dataDir:dir,baseURL:auth.base,development:false});try{
    assert.equal(production.browserActor(req({cookie:'lf_login='+login})),null);codeError('invalid_token',()=>production.authenticate(authRequest(tokens.access_token)));
    codeError('invalid_request',()=>production.mint(preview,'fixture-preview'));codeError('invalid_request',()=>production.issueCode({redirectUri:'http://127.0.0.1/oauth/callback'},'fake-pending',preview));
    codeError('not_found',()=>production.devSession(req({origin:auth.base,'x-learnflow-preview-nonce':production.previewNonce}),capture(),{profile:'learner'}));
  }finally{production.close();}
});

test('upstream WorkBuddy token is exchanged only for an opaque local identity and never propagated or stored',async t=>{
  const {auth}=fixture(t,{workbuddy:{clientId:'fixture-workbuddy-client',clientSecret:'fixture-only-not-real'}}),flow=authorize(auth),res=capture();auth.startConsent(req(),res,flow.params);
  const requestId=res.body.match(/name="requestId" value="([^"]+)"/)[1],csrf=res.body.match(/name="csrf" value="([^"]+)"/)[1],cookie=res.headers['Set-Cookie'].split(';')[0],allowed=capture();
  await auth.decide(req({origin:auth.base,cookie}),allowed,{requestId,csrf,decision:'allow'});const upstream=new URL(allowed.headers.Location);assert.equal(upstream.hostname,'www.workbuddy.cn');
  const state=upstream.searchParams.get('state'),oldFetch=globalThis.fetch;let calls=0;const providerSecret='synthetic-upstream-access-'+random(),providerRefresh='synthetic-upstream-refresh-'+random();
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://www.workbuddy.cn/openapi/v2/token');assert.equal(options.redirect,'error');return new Response(JSON.stringify({data:{open_id:'fixture-openid',access_token:providerSecret,refresh_token:providerRefresh}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{const callback=capture();await auth.upstreamCallback(req({cookie}),callback,new URLSearchParams({state,code:'synthetic-upstream-code'}));assert.equal(calls,1);const code=new URL(callback.headers.Location).searchParams.get('code'),local=auth.token({...flow.input,code});assert.notEqual(local.access_token,providerSecret);assert.ok(!JSON.stringify(local).includes(providerSecret));assert.ok(!JSON.stringify(local).includes(providerRefresh));const identity=auth.authenticate(authRequest(local.access_token));assert.match(identity.actor.id,/^wb_[a-f0-9]{64}$/);assert.ok(!identity.actor.id.includes('fixture-openid'));
    const db=JSON.stringify(auth.db.prepare('SELECT kind,key,value FROM auth_entries').all());assert.ok(!db.includes(providerSecret));assert.ok(!db.includes(providerRefresh));assert.ok(!db.includes('fixture-openid'));
    await assert.rejects(()=>auth.upstreamCallback(req({cookie}),capture(),new URLSearchParams({state,code:'synthetic-upstream-code'})),e=>e.code==='invalid_request');assert.equal(calls,1);
  }finally{globalThis.fetch=oldFetch;}
});

test('two SQLite-backed issuer processes cannot redeem one code twice',async t=>{
  const {auth,dir}=fixture(t),flow=authorize(auth),gate=new SharedArrayBuffer(4),entry=new URL('../buddy-app/service/oauth.mjs',import.meta.url).href;
  const workerSource=`const {parentPort,workerData}=require('node:worker_threads'); import(workerData.entry).then(({LearnFlowOAuth})=>{const auth=new LearnFlowOAuth({dataDir:workerData.dir,baseURL:workerData.base});parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.gate),0,0,8000);let result;try{auth.token(workerData.input);result={ok:true};}catch(e){result={ok:false,code:e.code};}finally{auth.close();}parentPort.postMessage(result);}).catch(()=>parentPort.postMessage({ok:false,code:'worker_setup_failed'}));`;
  const workers=[0,1].map(()=>new Worker(workerSource,{eval:true,workerData:{entry,dir,base:auth.base,gate,input:flow.input}}));t.after(async()=>{await Promise.all(workers.map(w=>w.terminate()));});
  let ready=0;const outcomes=workers.map(w=>new Promise((resolve,reject)=>{w.on('message',m=>{if(m.ready){if(++ready===2){Atomics.store(new Int32Array(gate),0,1);Atomics.notify(new Int32Array(gate),0);}}else resolve(m);});w.on('error',reject);}));
  const results=await Promise.all(outcomes);assert.equal(results.filter(x=>x.ok).length,1);assert.equal(results.filter(x=>x.code==='invalid_grant').length,1);await Promise.all(workers.map(w=>w.terminate()));
});

test('real local HTTP enforces host/origin, preview nonce and proxy isolation; metadata and full PKCE grant work',async t=>{
  const {service,post,dev}=await httpFixture(t);
  assert.equal(await rawStatus(service.url+'/healthz',{Host:'evil.invalid'}),403);
  assert.equal((await post('/dev/session',{profile:'learner'},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await post('/dev/session',{profile:'learner'},{Origin:service.url})).status,403);
  assert.equal((await fetch(service.url+'/healthz',{headers:{'X-Forwarded-For':'203.0.113.1'}})).status,403);
  const metadata=await(await fetch(service.url+'/.well-known/oauth-authorization-server')).json();assert.deepEqual(metadata.code_challenge_methods_supported,['S256']);
  const resource=await(await fetch(service.url+'/.well-known/oauth-protected-resource')).json();assert.equal(resource.resource,service.url+'/mcp');
  const logged=await dev(),registration=await post('/oauth/register',{redirect_uris:['http://127.0.0.1/oauth/callback']});assert.equal(registration.status,201);const client=await registration.json(),proof=pkce();
  const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:'code',code_challenge:proof.challenge,code_challenge_method:'S256',resource:resource.resource,state:'fixture-state'});
  const consent=await fetch(service.url+'/oauth/authorize?'+query),content=await consent.text(),flowCookie=consent.headers.getSetCookie()[0].split(';')[0],requestId=content.match(/name="requestId" value="([^"]+)"/)[1],csrf=content.match(/name="csrf" value="([^"]+)"/)[1];
  const response=await post('/oauth/decision',{requestId,csrf,decision:'allow'},{Origin:service.url,Cookie:logged.cookie+'; '+flowCookie});assert.equal(response.status,303);const redirected=new URL(response.headers.get('location'));assert.equal(redirected.searchParams.get('state'),'fixture-state');
  const exchanged=await post('/oauth/token',{grant_type:'authorization_code',client_id:client.client_id,redirect_uri:client.redirect_uris[0],resource:resource.resource,code:redirected.searchParams.get('code'),code_verifier:proof.verifier});assert.equal(exchanged.status,200);const tokens=await exchanged.json();assert.equal(service.auth.authenticate(authRequest(tokens.access_token)).actor.id,'preview_learner');
  const noAccess=await post('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'});assert.equal(noAccess.status,401);assert.ok(noAccess.headers.get('www-authenticate').includes('/.well-known/oauth-protected-resource'));
});

test('HTTP JSON rejects null, arrays and scalar bodies; Unicode CSRF and preview nonce fail cleanly',async t=>{
  const {service,post}=await httpFixture(t);
  for(const value of [null,[],['value'],true,7,'not-an-object']){
    const response=await post('/oauth/register',value);assert.equal(response.status,400);assert.equal((await response.json()).error,'invalid_request');
  }
  const invalidNonce=await post('/dev/session',{profile:'learner'},{Origin:service.url,'X-LearnFlow-Preview-Nonce':'x'.repeat(service.auth.previewNonce.length)});assert.equal(invalidNonce.status,403);
  const directResponse=capture();codeError('invalid_request',()=>service.auth.devSession(req({origin:service.url,'x-learnflow-preview-nonce':'错'.repeat(service.auth.previewNonce.length)}),directResponse,{profile:'learner'}));assert.equal(directResponse.status,0);
  const flow=authorize(service.auth),consent=await fetch(service.url+'/oauth/authorize?'+flow.params),content=await consent.text(),cookie=consent.headers.getSetCookie()[0].split(';')[0],requestId=content.match(/name="requestId" value="([^"]+)"/)[1],csrf=content.match(/name="csrf" value="([^"]+)"/)[1];
  const denied=await post('/oauth/decision',{requestId,csrf:'错'.repeat(csrf.length),decision:'allow'},{Origin:service.url,Cookie:cookie});assert.equal(denied.status,400);assert.equal((await denied.json()).error,'invalid_request');
  const pending=service.auth.get('pending',requestId);assert.equal(pending.approved,false);
});

test('MCP SDK ordinary tools never return UI token; wrong/missing/other-user app token cannot approve',async t=>{
  const {service,dev,connect}=await httpFixture(t),a=await dev(),b=await dev('second-learner'),client=await connect(a.token),other=await connect(b.token),identity=service.auth.authenticate(authRequest(a.token)),otherIdentity=service.auth.authenticate(authRequest(b.token));
  const tools=await client.listTools();assert.ok(!JSON.stringify(tools).includes(identity.uiToken));assert.deepEqual(tools.tools.find(x=>x.name==='learnflow_app_action')._meta.ui.visibility,['app']);
  const workspace=await client.callTool({name:'show_learning_workspace',arguments:{}});assert.ok(!workspace.isError);assert.ok(!JSON.stringify(workspace).includes(identity.uiToken));assert.equal(workspace.structuredContent.presentation.opened,false);
  const created=await client.callTool({name:'draft_learning_block',arguments:{title:'HTTP学习块',markdown:'仅此草稿，无自动保存。'}});assert.ok(!created.isError);assert.ok(!JSON.stringify(created).includes(identity.uiToken));const draft=created.structuredContent.draft;
  const action={name:'learnflow_app_action',arguments:{action:'approveDraft',payload:{draftId:draft.id,expectedRevision:draft.revision},uiToken:'wrong'}};
  for(const token of ['wrong',otherIdentity.uiToken]){const r=await client.callTool({...action,arguments:{...action.arguments,uiToken:token}});assert.equal(r.isError,true);assert.equal(r.structuredContent.error,'user_confirmation_required');}
  const missing={...action.arguments};delete missing.uiToken;assert.equal((await client.callTool({...action,arguments:missing})).isError,true);
  const counterfeit=await client.callTool({...action,arguments:{...action.arguments,uiToken:identity.uiToken,payload:{...action.arguments.payload,confirmed:true}}});assert.equal(counterfeit.isError,true);
  assert.equal(service.store.listAssets(identity.actor.id).length,0);
  const resource=await client.readResource({uri:RESOURCE_URI});assert.ok(resource.contents[0].text.includes(identity.uiToken),'the resource is delivered privately to a standards-compliant host app renderer');
  const saved=await client.callTool({...action,arguments:{...action.arguments,uiToken:identity.uiToken}});assert.ok(!saved.isError);assert.equal(service.store.listAssets(identity.actor.id).length,1);
  const cross=await other.callTool({name:'learnflow_app_action',arguments:{action:'getAsset',payload:{assetId:saved.structuredContent.result.id},uiToken:otherIdentity.uiToken}});assert.equal(cross.isError,true);assert.equal(cross.structuredContent.error,'NOT_FOUND');
});

test('MCP app scopes distinguish read/write and read-only users can revoke',async t=>{
  const {service,connect}=await httpFixture(t),readTokens=service.auth.mint(actor,'fixture-read','learning:read'),writeTokens=service.auth.mint(actor,'fixture-write','learning:write'),reader=await connect(readTokens.access_token),writer=await connect(writeTokens.access_token),readIdentity=service.auth.authenticate(authRequest(readTokens.access_token)),writeIdentity=service.auth.authenticate(authRequest(writeTokens.access_token));
  const invoke=(client,identity,action,payload={})=>client.callTool({name:'learnflow_app_action',arguments:{action,payload,uiToken:identity.uiToken}});
  assert.equal((await invoke(reader,readIdentity,'getPreferences')).isError,undefined);
  const writeDenied=await invoke(reader,readIdentity,'setPreferences',{preferences:{goal:'不能写'}});assert.equal(writeDenied.structuredContent.error,'insufficient_scope');
  const readDenied=await invoke(writer,writeIdentity,'getPreferences');assert.equal(readDenied.structuredContent.error,'insufficient_scope');
  const pdf=await invoke(reader,readIdentity,'readPdf',{assetId:'nonexistent'});assert.notEqual(pdf.structuredContent.error,'insufficient_scope');
  const revoked=await invoke(reader,readIdentity,'revokeConnection');assert.ok(!revoked.isError);codeError('invalid_token',()=>service.auth.authenticate(authRequest(readTokens.access_token)));
});

test('development refuses public bind/domain; production requires explicit HTTPS and persistent data configuration',async()=>{
  await assert.rejects(()=>startService({development:true,host:'0.0.0.0'}),/loopback/);
  await assert.rejects(()=>startService({development:true,publicURL:'https://public.example.invalid'}),/public domain/);
  await assert.rejects(()=>startService({development:false,publicURL:'http://127.0.0.1:4318'}),/HTTPS/);
});
