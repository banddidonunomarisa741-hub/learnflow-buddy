// Isolated browser regression with synthetic data. Every API write is intercepted.
// /api/chat/stream deliberately returns 404 to exercise the older JSON fallback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function playwright(){
 const candidates=[process.env.PLAYWRIGHT_MODULE,process.env.CODEX_NODE_MODULES&&path.join(process.env.CODEX_NODE_MODULES,'playwright'),'playwright',process.env.USERPROFILE&&path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
 for(const item of candidates){try{return require(item);}catch{}}
 throw Error('Playwright missing: set PLAYWRIGHT_MODULE to its package directory or install playwright locally.');
}
const {chromium}=playwright(),out=path.join(__dirname,'validation-screenshots');fs.mkdirSync(out,{recursive:true});
const url=process.env.LEARNFLOW_TEST_URL||'http://127.0.0.1:4173/';
const results={date:new Date().toISOString(),url,syntheticData:true,mockedModel:true,stream404Fixture:true,realAPIWrites:0,tests:[],errors:[]};
function check(id,ok,detail){results.tests.push({id,status:ok?'PASS':'FAIL',detail});console.log(id,ok?'PASS':'FAIL',JSON.stringify(detail));if(!ok)process.exitCode=1;}
function seed(){return {version:1,profile:{goal:'QA 测试：复盘一个知识点',minutes:10,guide:'strong',style:'warm',encourage:'strong',memory:true},adopted:['roots','plain','feynman'],favorites:['roots'],ratings:{roots:4},usage:{},custom:[],memories:[{id:'qa-memory',title:'我的表达偏好',content:'QA_MEMORY_MARKER\n输出偏好：自然段落。引导：直接讲清楚。',tags:['自然段落','直接讲清楚'],scene:'应试学习',sceneId:'exam',created:'2026-09-06T00:00:00.000Z'}],sessions:[],blocks:0,tasks:[{id:'qa-task',title:'完成一次证据复盘',owner:'测试角色',evidence:'可检查的独立作答',status:'todo'}],scene:'exam',onboarded:true};}
async function reset(page,data=seed()){await page.goto(url);await page.evaluate(s=>localStorage.setItem('learnflow.v1',JSON.stringify(s)),data);await page.reload();}
async function pick(page,selector,payload){const pending=page.waitForEvent('filechooser');await page.locator(selector).click();await(await pending).setFiles({name:'qa.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});}
async function send(page,text){await page.locator('#chat-input').fill(text);await page.locator('#chat-form button[type=submit]').click();}
async function storage(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('learnflow.v1')));}
async function useDemo(page){await page.locator('#model-trigger').waitFor();if((await page.locator('#chat-mode').textContent()).includes('模型'))await page.locator('#chat-mode').click();}
async function answer(page,marker){await page.waitForFunction(m=>document.querySelector('#messages')?.innerText.includes(m)&&!document.querySelector('[aria-busy=true]'),marker);}
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:process.env.BROWSER_CHANNEL||'msedge'})});results.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 let assets=[],assetSaves=0;
 await context.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname,method=route.request().method(),reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(p==='/api/chat/stream')return route.fulfill({status:404,contentType:'application/json',body:'{"message":"JSON fallback fixture"}'});
   if(p==='/api/health')return reply({ok:true,service:'LearnFlow local adapter',adapterVersion:'1.4.0',configured:true,localCLIAvailable:true,provider:'QA fixture'});
   if(p==='/api/models')return reply({models:[{id:'auto',label:'Auto'}],defaultModel:'auto',source:'QA fixture'});
   if(p==='/api/assets'&&method==='GET')return reply({assets});
   if(p==='/api/assets'&&method==='POST'){const d=route.request().postDataJSON();if(d.consent!==true)return route.fulfill({status:400,body:'{}'});assetSaves++;assets.push({id:'fixture-asset-'+assetSaves,title:d.title,source:d.source,format:d.format,created:new Date().toISOString(),bytes:d.content?.length||0});return reply({ok:true,asset:assets.at(-1)});}
   return route.fulfill({status:403,contentType:'application/json',body:'{"message":"Read-only fixture blocked an unexpected API request"}'});
 });
 const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));await reset(page);
 let captured,calls=0;
 await page.route('**/api/chat',async route=>{captured=route.request().postDataJSON();calls++;await route.fulfill({json:{reply:'QA_REPLY_MARKER：这是一条测试模拟回复。',provider:'QA stub',usage:{total_tokens:101}}});});
 await page.locator('[data-scene=exam]').click();await send(page,'QA 独立测试消息');await answer(page,'QA_REPLY_MARKER');
 const examMemory=JSON.stringify(captured.memories).includes('QA_MEMORY_MARKER');
 await page.goto(url+'#home');await page.locator('[data-scene=self]').click();await send(page,'QA 检查自主学习场景');await answer(page,'QA_REPLY_MARKER');
 check('01-confirmed-memory-context',examMemory&&captured.memories.length===0,{examMemoryIncluded:examMemory,selfSceneMemories:captured.memories.length});
 await page.reload();check('02-session-restoration',(await page.locator('#messages').innerText()).includes('QA_REPLY_MARKER'),{savedSessions:(await storage(page)).sessions.length});await page.screenshot({path:path.join(out,'desktop-restored-session.png'),fullPage:true});
 await page.goto(url+'#settings');await page.locator('[name=memory]').uncheck();await page.locator('#settings-form button[type=submit]').click();await page.goto(url+'#session');
 const beforeCalls=calls,beforeSessions=JSON.stringify((await storage(page)).sessions);await send(page,'QA 关闭记忆请求');await page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'));while(calls===beforeCalls)await page.waitForTimeout(20);await answer(page,'QA_REPLY_MARKER');
 check('03-memory-off',captured.memories.length===0&&JSON.stringify((await storage(page)).sessions)===beforeSessions,{memorySent:captured.memories.length,sessionsUnchanged:JSON.stringify((await storage(page)).sessions)===beforeSessions});
 await page.unroute('**/api/chat');await reset(page);await page.locator('[data-scene=exam]').click();
 let release,started,raceRequest;const gate=new Promise(r=>release=r),called=new Promise(r=>started=r);
 await page.route('**/api/chat',async route=>{raceRequest=route.request().postDataJSON();started();await gate;await route.fulfill({json:{reply:'QA_RACE_REPLY',provider:'QA stub',usage:{total_tokens:100}}});});
 await send(page,'QA 正在请求');await called;await page.locator('a[href="#home"]').first().click();await page.locator('[data-scene=self]').click();const blocked=(await page.locator('#toast').innerText()).includes('处理中');release();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('learnflow.v1')).usage.roots?.actual===50);let saved=await storage(page);
 check('04-request-race',blocked&&saved.usage.roots.actual===50&&saved.usage.plain.actual===50&&!saved.usage.feynman&&saved.sessions[0].scene==='exam'&&saved.sessions[0].messages.some(x=>x.content==='QA_RACE_REPLY'),{blocked,requestCards:raceRequest.strategies.map(c=>c.id),savedScene:saved.sessions[0]?.scene,usage:saved.usage});
 await page.unroute('**/api/chat');await reset(page);await page.locator('[data-scene=self]').click();await page.goto(url+'#memory');await page.locator('[data-memory-edit=qa-memory]').click();
 const chosen={format:await page.locator('[name=format]').inputValue(),guidance:await page.locator('[name=guidance]').inputValue()};await page.locator('#memory-form button[type=submit]').click();let memory=(await storage(page)).memories[0];
 check('05-memory-edit-preserves-fields',chosen.format==='自然段落'&&chosen.guidance==='直接讲清楚'&&memory.sceneId==='exam'&&(memory.content.match(/输出偏好/g)||[]).length===1,{chosen,scene:memory.sceneId});await page.screenshot({path:path.join(out,'memory-preserved.png'),fullPage:true});
 await reset(page);await page.locator('[data-scene=self]').click();await useDemo(page);await page.locator('[data-prompt="我想建立一周的自学路线"]').click();await answer(page,'前 2 分钟');const plan=await page.locator('#messages').innerText();
 check('06-ten-minute-plan',plan.includes('前 2 分钟')&&plan.includes('中间 6 分钟')&&plan.includes('最后 2 分钟'),{allocation:'2 + 6 + 2',mode:'preset demo'});
 await reset(page);await page.goto(url+'#settings');const downloadWait=page.waitForEvent('download');await page.locator('[data-action=export-all]').click();const stream=await(await downloadWait).createReadStream();let chunks=[];for await(const chunk of stream)chunks.push(chunk);const backup=JSON.parse(Buffer.concat(chunks).toString());
 await page.locator('[data-action=clear-data]').click();await page.locator('[data-action=confirm-clear]').click();await pick(page,'[data-action=restore-backup]',backup);await page.locator('#confirm-restore').click();saved=await storage(page);
 check('07-full-backup-roundtrip',saved.profile.goal===backup.profile.goal&&saved.memories[0].content===backup.memories[0].content&&saved.tasks[0].title===backup.tasks[0].title&&saved.ratings.roots===4,{memories:saved.memories.length,tasks:saved.tasks.length,rating:saved.ratings.roots});
 const before=JSON.stringify(saved);await pick(page,'[data-action=restore-backup]',{version:99});await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('恢复失败'));
 check('08-invalid-backup-no-write',JSON.stringify(await storage(page))===before,{toast:await page.locator('#toast').innerText()});
 await reset(page);await page.goto(url+'#market');const html='<img src=x onerror="window.__QA_XSS=1">';await pick(page,'[data-action=import-card]',{title:html,description:html,instructions:html,scene:'self',tags:[html]});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('learnflow.v1')).custom.length===1);const custom=(await storage(page)).custom[0];await page.locator(`[data-detail="${custom.id}"]`).first().click();await page.locator('#modal details').click();
 check('09-card-html-escaped',await page.evaluate(()=>!window.__QA_XSS&&document.querySelector('#modal-content').innerText.includes('<img src=x')&&document.querySelectorAll('#modal-content img').length===0),{payload:'img/onerror rendered as literal text',autoEnabled:(await storage(page)).adopted.includes(custom.id)});await page.screenshot({path:path.join(out,'imported-html-as-text.png'),fullPage:true});
 await reset(page);await page.goto(url+'#settings');const evil=seed();evil.custom=[{id:'custom-\"><img src=x onerror="window.__QA_BACKUP_XSS=1">',title:'QA backup id',description:'synthetic',instructions:'test',scene:'self',tags:[]}];
 await pick(page,'[data-action=restore-backup]',evil);await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('恢复失败'));const rejected=(await page.locator('#confirm-restore').count())===0;
 check('10-backup-id-attribute-escaped',rejected&&await page.evaluate(()=>!window.__QA_BACKUP_XSS),{rejected,injected:await page.evaluate(()=>Boolean(window.__QA_BACKUP_XSS))});
 await reset(page);await page.locator('[data-scene=self]').click();await useDemo(page);await page.locator('[data-prompt="我想建立一周的自学路线"]').click();await answer(page,'前 2 分钟');
 await page.locator('[data-action=complete-block]').click();await page.getByRole('button',{name:'暂不保存',exact:true}).click();const cancelledCount=(await storage(page)).blocks;
 async function saveBlock(){await page.locator('[data-action=complete-block]').click();await page.locator('#asset-save-form select[name=format]').selectOption('md');await page.locator('#asset-save-form input[name=consent]').check();await page.locator('#asset-save-form button[type=submit]').click();await page.waitForURL('**/#assets');}
 await saveBlock();await page.goto(url+'#session');await page.reload();await saveBlock();saved=await storage(page);
 check('11-complete-block-reload-idempotent',cancelledCount===0&&saved.blocks===1,{cancelledCount,confirmedCount:saved.blocks,mockAssetSaves:assetSaves});
 const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});mobile.on('pageerror',e=>results.errors.push(e.message));await reset(mobile);await mobile.screenshot({path:path.join(out,'mobile-home-390.png'),fullPage:false});
 await mobile.getByRole('button',{name:'展开导航'}).click();await mobile.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().left>=-1);const opened=await mobile.locator('.sidebar').evaluate(el=>el.classList.contains('open'));
 await mobile.screenshot({path:path.join(out,'mobile-navigation-390.png'),fullPage:false});await mobile.locator('#navigation a[href="#market"]').click();await mobile.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);const closed=await mobile.locator('.sidebar').evaluate(el=>!el.classList.contains('open'));const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 check('12-mobile-navigation',opened&&closed&&mobile.url().endsWith('#market')&&!overflow,{opened,closed,overflow,viewport:390});await mobile.screenshot({path:path.join(out,'mobile-market-390.png'),fullPage:false});
 results.hashes={};for(const file of ['public/app.js','public/composer.js','public/rich-text.js','public/data.js','public/styles.css','server/server.mjs'])results.hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex');
 if(results.errors.length)process.exitCode=1;console.log('REPORT',results.tests.length,'tests',results.tests.filter(t=>t.status==='FAIL').length,'failures',results.errors.length,'page errors');
})().catch(e=>{console.error(e);results.fatal=String(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();fs.writeFileSync(path.join(__dirname,'validation-results.json'),JSON.stringify(results,null,2));});
