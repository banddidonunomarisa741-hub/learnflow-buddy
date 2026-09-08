const fs=require('fs');
const {chromium}=require('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT='output/sidebar-release',BASE='http://127.0.0.1:4174';
const report={fixtureOnly:true,checks:[],errors:[],failures:[],screenshots:[]};
const check=(name,pass,details)=>report.checks.push({name,pass,...(details===undefined?{}:{details})});
const seed={version:1,onboarded:true,profile:{memory:false},sessions:[{id:1001,title:'词根和例句一起记',scene:'exam',created:new Date().toISOString(),messages:[{role:'user',content:'我想把词根和例句一起记'}]},{id:1002,title:'条件概率怎么理解',scene:'self',created:new Date().toISOString(),messages:[{role:'user',content:'条件概率为什么换分母'}]},{id:1003,title:'把一个想法做成作品',scene:'project',created:new Date().toISOString(),messages:[{role:'user',content:'先确定项目的第一份成果'}]},{id:1004,title:'这个空会话不应出现',scene:'self',created:new Date().toISOString(),messages:[]}]};
async function context(browser,mobile=false,metadata=null){const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1100},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});await ctx.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{"configured":false,"connected":false,"models":[],"assets":[]}'}));await ctx.addInitScript(({seed,metadata})=>{localStorage.setItem('learnflow.v1',JSON.stringify(seed));if(metadata)localStorage.setItem('learnflow.sidebar.v1',JSON.stringify(metadata));},{seed,metadata});const page=await ctx.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.message));return{ctx,page};}
const meta=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('learnflow.sidebar.v1')));
async function shot(p,name){await p.screenshot({path:OUT+'/'+name+'.png'});report.screenshots.push(name+'.png');}
async function create(p,name){await p.locator('[data-ws-action="create-project"]').first().click();await p.locator('.ws-name-form [name=name]').fill(name);await p.locator('.ws-name-form button[type=submit]').click();return(await meta(p)).projects.find(x=>x.name===name).id;}
async function sessionMove(p,id,target){await p.locator('[data-ws-action="session-menu"][data-ws-id="'+id+'"]').click();const button=p.locator('[data-ws-action="move-session"][data-ws-target="'+target+'"]');await button.focus();await button.press('Enter');}
async function drag(p,from,to,offset=.5,saveGhost=false,cancel=false){const a=await from.boundingBox(),b=await to.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height*offset,{steps:12});await p.waitForTimeout(100);if(saveGhost){check('drag displays tactile ghost',await p.locator('.ws-drag-ghost').count()===1);await shot(p,'sidebar-drag-ghost');}if(cancel)await p.keyboard.press('Escape');await p.mouse.up();await p.waitForTimeout(340);}
(async()=>{fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let desktop,mobile,metadata;
try{
 desktop=await context(browser);const p=desktop.page;await p.goto(BASE+'/#home');await p.locator('.ws-session-row').first().waitFor();
 check('numeric session IDs render; empty sessions stay hidden',await p.locator('.ws-session-row').count()===3&&await p.locator('[data-ws-session="1004"]').count()===0);
 await p.locator('[data-ws-action="open-session"][data-ws-id="1002"]').click();await p.waitForFunction(()=>location.hash==='#session');check('regular row click opens session exactly once',await p.locator('.message.user .message-content').textContent()==='条件概率为什么换分母');
 const draft='这个聊天草稿在整理侧栏时必须保留';await p.locator('#chat-input').fill(draft);
 const a=await create(p,'六级复习'),b=await create(p,'项目作品');
 check('create two project folders', (await meta(p)).projects.length===2);
 await p.locator('[data-ws-action="project-menu"][data-ws-id="'+a+'"]').click();await p.locator('[data-ws-action="rename-project"]').click();await p.locator('.ws-name-form [name=name]').fill('六级词汇');await p.locator('.ws-name-form button[type=submit]').click();
 check('rename project persists', (await meta(p)).projects.find(x=>x.id===a).name==='六级词汇');
 await p.locator('[data-ws-action="project-menu"][data-ws-id="'+b+'"]').click();await p.locator('[data-ws-action="project-up"]').click();check('project keyboard-menu sorting', (await meta(p)).projects[0].id===b);
 await sessionMove(p,'1003',a);await sessionMove(p,'1002',a);check('keyboard menu moves conversations to folder',JSON.stringify((await meta(p)).projects.find(x=>x.id===a).sessionIds)===JSON.stringify(['1003','1002']));
 await p.locator('[data-ws-action="session-menu"][data-ws-id="1002"]').click();await p.locator('[data-ws-action="session-up"]').click();check('same-folder move up',JSON.stringify((await meta(p)).projects.find(x=>x.id===a).sessionIds)===JSON.stringify(['1002','1003']));
 await p.locator('[data-ws-action="session-menu"][data-ws-id="1002"]').click();await p.locator('[data-ws-action="session-down"]').click();check('same-folder move down',JSON.stringify((await meta(p)).projects.find(x=>x.id===a).sessionIds)===JSON.stringify(['1003','1002']));
 await drag(p,p.locator('[data-ws-drag="session"][data-ws-id="1001"]'),p.locator('[data-ws-project="'+a+'"] .ws-project-row'),.5,true);
 check('mouse drag into project', (await meta(p)).projects.find(x=>x.id===a).sessionIds.includes('1001'));
 await drag(p,p.locator('[data-ws-drag="session"][data-ws-id="1001"]'),p.locator('[data-ws-session="1003"]'),.1);
 check('mouse drag within project reorders', (await meta(p)).projects.find(x=>x.id===a).sessionIds[0]==='1001');
 await drag(p,p.locator('[data-ws-drag="session"][data-ws-id="1003"]'),p.locator('.ws-loose-empty'),.5);
 check('mouse drag out of project',!(await meta(p)).projects.find(x=>x.id===a).sessionIds.includes('1003')&&(await meta(p)).looseOrder.includes('1003'));
 const before=JSON.stringify(await meta(p));await drag(p,p.locator('[data-ws-drag="session"][data-ws-id="1001"]'),p.locator('[data-ws-project="'+b+'"] .ws-project-row'),.5,false,true);
 check('Escape cancels drag without metadata change',JSON.stringify(await meta(p))===before&&await p.locator('.ws-drag-ghost').count()===0);
 await drag(p,p.locator('[data-ws-drag="project"][data-ws-id="'+a+'"]'),p.locator('[data-ws-project="'+b+'"] .ws-project-row'),.1);check('project pointer drag reorders folders',(await meta(p)).projects[0].id===a);
 await p.locator('[data-ws-action="toggle-project"][data-ws-id="'+a+'"]').click();check('collapse hides project conversations',await p.locator('[data-ws-project="'+a+'"] .ws-project-content').isHidden());await p.locator('[data-ws-action="toggle-project"][data-ws-id="'+a+'"]').click();
 check('sidebar edits do not clear active chat draft',await p.locator('#chat-input').inputValue()===draft);
 metadata=await meta(p);await shot(p,'sidebar-desktop');await p.locator('.sidebar').screenshot({path:OUT+'/sidebar-desktop-crop.png'});report.screenshots.push('sidebar-desktop-crop.png');
 await p.locator('[data-ws-action="project-menu"][data-ws-id="'+a+'"]').click();await p.locator('[data-ws-action="delete-project"]').click();await p.locator('[data-ws-confirm-delete]').click();
 check('delete folder preserves all conversations',await p.locator('.ws-session-row').count()===3&&!(await meta(p)).projects.some(x=>x.id===a));
 const count=await p.locator('.ws-session-row').count();await p.locator('[data-ws-action="new-project-chat"][data-ws-id="'+b+'"]').click();check('empty new project conversation is not shown',await p.locator('.ws-session-row').count()===count);const newId=(await meta(p)).projects.find(x=>x.id===b).sessionIds.at(-1);
 await p.locator('#chat-input').fill('项目里的新对话');await p.locator('#chat-form button[type=submit]').click();await p.locator('[data-ws-session="'+newId+'"]').waitFor();
 check('new project conversation appears after actual message',await p.locator('[data-ws-project="'+b+'"] [data-ws-session="'+newId+'"]').count()===1);
 const stored=await p.evaluate(()=>localStorage.getItem('learnflow.sidebar.v1'));check('sidebar storage contains metadata only',!stored.includes('项目里的新对话')&&!stored.includes('messages')&&!stored.includes('title')&&JSON.parse(stored).projects.some(x=>x.sessionIds.includes(newId)));
}catch(e){report.failures.push({area:'desktop',error:e.stack});}
try{
 mobile=await context(browser,true,metadata);const p=mobile.page;await p.goto(BASE+'/#home');await p.locator('.sidebar-reopen').first().click();await p.locator('.sidebar.open').waitFor();
 const m=await meta(p),a=m.projects.find(x=>x.name==='六级词汇').id,b=m.projects.find(x=>x.name==='项目作品').id;
 await p.locator('[data-ws-drag="session"][data-ws-id="1002"]').scrollIntoViewIfNeeded();const source=await p.locator('[data-ws-drag="session"][data-ws-id="1002"]').boundingBox(),target=await p.locator('[data-ws-project="'+b+'"] .ws-project-row').boundingBox();
 const cdp=await mobile.ctx.newCDPSession(p),start={x:source.x+source.width/2,y:source.y+source.height/2},end={x:target.x+target.width/2,y:target.y+target.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/10,y:start.y+(end.y-start.y)*i/10,id:1}]});}await p.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(340);
 check('touch pointer drag moves conversation to project',(await meta(p)).projects.find(x=>x.id===b).sessionIds.includes('1002'));
 check('mobile sidebar has no horizontal overflow',await p.locator('.ws-host').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await shot(p,'sidebar-mobile');
 await p.locator('[data-ws-action="project-menu"][data-ws-id="'+b+'"]').click();await p.locator('[data-ws-action="rename-project"]').click();await shot(p,'sidebar-project-dialog-mobile');
 await p.evaluate(()=>document.documentElement.dataset.theme='dark');await shot(p,'sidebar-project-dialog-dark');check('dark project dialog remains readable',(await p.locator('.ws-dialog').evaluate(e=>getComputedStyle(e).backgroundColor))==='rgb(46, 37, 31)');
}catch(e){report.failures.push({area:'mobile',error:e.stack});}
try{
 const p=desktop.page;
 const result=await p.evaluate(()=>{
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const instance=LearnFlowSidebar.create({esc});
  const empty=instance.validateData(null),valid={version:1,projects:[{id:'one',name:'甲',sessionIds:['1','2'],messages:['DO-NOT-STORE']},{id:'two',name:'乙',sessionIds:['2','3']}],looseOrder:['1','4','4']};const normalized=instance.validateData(valid);let malformed=false;try{instance.validateData({version:1,projects:[{id:'x',name:'',sessionIds:[]}],looseOrder:[]})}catch{malformed=true}
  const original=instance.exportData(),save=Storage.prototype.setItem;let fail;try{Storage.prototype.setItem=function(){throw new DOMException('fixture quota','QuotaExceededError')};fail=instance.restoreData(valid)===false&&JSON.stringify(instance.exportData())===JSON.stringify(original)}finally{Storage.prototype.setItem=save}
  const restore=instance.restoreData(normalized),exported=instance.exportData(),clear=instance.clearData();instance.dispose();return{empty,normalized,malformed,fail,restore,exported,clear};
 });
 check('validate null yields empty metadata',result.empty.version===1&&result.empty.projects.length===0);
 check('restore normalization enforces one folder per conversation',result.normalized.projects[1].sessionIds.join(',')==='3'&&result.normalized.looseOrder.join(',')==='4'&&!JSON.stringify(result.normalized).includes('messages'));
 check('bad input rejected before mutation',result.malformed);
 check('storage failure returns false without half-restore',result.fail);
 check('export restore clear APIs work',result.restore===true&&result.clear===true&&result.exported.projects.length===2);
}catch(e){report.failures.push({area:'metadata-api',error:e.stack});}
await desktop?.ctx.close();await mobile?.ctx.close();await browser.close();report.passed=report.checks.filter(c=>c.pass).length;report.failed=report.checks.filter(c=>!c.pass).length;fs.writeFileSync(OUT+'/sidebar-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));})();
