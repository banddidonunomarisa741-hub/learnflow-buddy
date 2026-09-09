import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import vm from 'node:vm';
import { LearningStore, cardVersion, UI_METHODS, INTERNAL_METHODS, MODEL_METHODS } from '../buddy-app/service/store.mjs';

const card=(overrides={})=>({id:'retrieval-demo',title:'主动回忆',description:'先试着想起来，再检查。',instructions:'1. 合上材料。\n2. 写出三个要点。\n3. 核对并解释遗漏。',tags:['主动回忆','迁移'],scene:'self',steps:['尝试','反馈'],examples:['用户：我想不起来。\n助手：先从一个关键词开始。','换一道题，独立解释。'],limits:'不把猜对当作掌握。',evidence:'依据练习中的表现调整。',category:'常见学法',subtitle:'从记忆里拿出来',color:'orange',icon:'layers',source:'团队自制',...overrides});
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'learnflow-store-test-')),filename=join(dir,'data.sqlite');let store=new LearningStore({filename});t.after(()=>{try{store.close();}catch{}const absolute=resolve(dir),parent=resolve(tmpdir())+sep;assert.ok(absolute.startsWith(parent)&&absolute.split(sep).at(-1).startsWith('learnflow-store-test-'));rmSync(absolute,{recursive:true,force:true});});return {get store(){return store;},filename,reopen(){store.close();store=new LearningStore({filename});return store;}};}
function save(store,user,content=card(),assetId){const d=store.createDraft(user,{kind:'strategy',card:content,assetId});return store.approveDraft(user,{draftId:d.id,expectedRevision:d.revision});}
const err=(code,fn)=>assert.throws(fn,e=>e.code===code&&/[\u4e00-\u9fff]/.test(e.message));
function course(store){const c=store.createCourse('teacher',{title:'概念解释',objective:'在新情境中独立解释',displayName:'老师'});store.joinCourse('student',{code:c.inviteCode,displayName:'同学甲'});store.joinCourse('second-student',{code:c.inviteCode,displayName:'同学乙'});return c;}
function submit(store,c,who='student',extra={}){return store.submitLearning(who,{courseId:c.id,title:'我的解释',messages:[{role:'user',content:'我用自己的话解释。'},{role:'assistant',content:'请换一个例子。'}],...extra});}

test('explicit transport capability sets exclude all user approvals and trusted usage from model actions',()=>{
  for(const name of UI_METHODS)assert.ok(!MODEL_METHODS.includes(name),name);
  assert.deepEqual(INTERNAL_METHODS,['recordUsage']);assert.ok(!MODEL_METHODS.includes('recordUsage'));assert.ok(!UI_METHODS.includes('recordUsage'));
  for(const name of [...UI_METHODS,...MODEL_METHODS,...INTERNAL_METHODS])assert.equal(typeof LearningStore.prototype[name],'function',name);
});

test('durable account isolation, independent preferences, safe exports, and web-compatible versions',t=>{
  const f=fixture(t),s=f.store;const context={};vm.createContext(context);vm.runInContext(readFileSync(new URL('../public/strategy-ledger.js',import.meta.url),'utf8'),context);
  assert.equal(cardVersion(card()),context.LearnFlowLedger.cardVersion(card()));
  s.setPreferences('alice',{preferences:{goal:'阅读六级',memoryEnabled:false,guidance:'gentle'},selectedStrategies:[{id:'retrieval-demo',version:cardVersion(card()),title:'主动回忆'}]});
  assert.deepEqual(s.getPreferences('bob'),{preferences:{},selectedStrategies:[]});
  const a=save(s,'alice',card({receipt:'never-export-this',memories:['private']}));
  assert.match(a.id,/^[0-9a-f-]{36}$/);assert.deepEqual(s.listAssets('bob'),[]);
  for(const method of ['getAsset','exportAsset','listVersions','deleteAsset'])err('NOT_FOUND',()=>s[method]('bob',{assetId:a.id}));
  const exported=s.exportAsset('alice',{assetId:a.id});assert.equal(exported.mimeType,'application/json');const payload=JSON.parse(exported.content);
  assert.deepEqual(payload.card.examples,card().examples);assert.equal(payload.card.limits,card().limits);assert.equal(payload.card.evidence,card().evidence);assert.ok(!exported.content.includes('never-export-this'));assert.ok(!exported.content.includes('alice'));assert.ok(!Object.hasOwn(payload.card,'memories'));
  const reopened=f.reopen();assert.equal(reopened.getAsset('alice',{assetId:a.id}).version,a.version);assert.equal(reopened.getPreferences('alice').preferences.goal,'阅读六级');assert.equal(reopened.listAssets('alice').length,1);assert.equal(reopened.listCommunity('bob').length,0);
});

test('drafts cannot save by confirmed flag, reject stale previews, cancel irreversibly, and retry idempotently',t=>{
  const s=fixture(t).store;let d=s.createDraft('alice',{kind:'strategy',card:card(),confirmed:true});
  assert.equal(d.status,'pending');assert.equal(s.listAssets('alice').length,0);
  err('INVALID_FIELD',()=>s.approveDraft('alice',{draftId:d.id,confirmed:true}));
  err('NOT_FOUND',()=>s.approveDraft('bob',{draftId:d.id,expectedRevision:d.revision}));
  d=s.updateDraft('alice',{draftId:d.id,expectedRevision:d.revision,card:card({instructions:'先尝试，再回看。'})});
  assert.equal(d.revision,2);err('CONFLICT',()=>s.approveDraft('alice',{draftId:d.id,expectedRevision:1}));
  const saved=s.approveDraft('alice',{draftId:d.id,expectedRevision:d.revision});
  assert.deepEqual(s.approveDraft('alice',{draftId:d.id,expectedRevision:d.revision}),saved);assert.equal(s.listAssets('alice').length,1);
  err('CONFLICT',()=>s.updateDraft('alice',{draftId:d.id,expectedRevision:3,card:card()}));
  const cancelled=s.createDraft('alice',{kind:'learning-block',title:'要点',markdown:'一段学会的内容'});s.cancelDraft('alice',{draftId:cancelled.id,expectedRevision:cancelled.revision});
  err('CONFLICT',()=>s.approveDraft('alice',{draftId:cancelled.id,expectedRevision:cancelled.revision}));assert.equal(s.listAssets('alice').length,1);
});

test('asset versions remain stable and immutable; concurrent drafts cannot overwrite approved changes',t=>{
  const s=fixture(t).store,a=save(s,'alice');
  const left=s.createDraft('alice',{kind:'strategy',assetId:a.id,card:card({instructions:'第一次修订'})}),right=s.createDraft('alice',{kind:'strategy',assetId:a.id,card:card({instructions:'另一份旧稿'})});
  const revised=s.approveDraft('alice',{draftId:left.id,expectedRevision:left.revision});
  assert.equal(revised.id,a.id);assert.notEqual(revised.version,a.version);assert.deepEqual(revised.card.parent,{id:a.card.id,version:a.version});
  err('CONFLICT',()=>s.approveDraft('alice',{draftId:right.id,expectedRevision:right.revision}));
  assert.equal(s.getAsset('alice',{assetId:a.id,version:a.version}).card.instructions,card().instructions);assert.equal(s.listVersions('alice',{assetId:a.id}).length,2);
  const cosmetic=save(s,'alice',{...revised.card,subtitle:'新的展示副标题'},a.id);assert.equal(cosmetic.version,revised.version);assert.equal(s.listVersions('alice',{assetId:a.id}).length,2);
  assert.deepEqual(s.approveDraft('alice',{draftId:left.id,expectedRevision:left.revision}),revised);
  const {id:omittedId,...withoutId}=cosmetic.card;
  const omitted=s.createDraft('alice',{kind:'strategy',assetId:a.id,card:{...withoutId,instructions:'省略编号也应保留策略身份'}});assert.equal(omitted.card.id,omittedId);
  const third=s.approveDraft('alice',{draftId:omitted.id,expectedRevision:omitted.revision});assert.equal(third.id,a.id);assert.equal(third.card.id,a.card.id);assert.equal(third.card.parent.version,cosmetic.version);
  err('INVALID_FIELD',()=>s.createDraft('alice',{kind:'strategy',assetId:a.id,card:{...withoutId,id:'explicitly-different-id'}}));
});

test('field limits reject complete transaction without silent truncation; text is data, not executable code',t=>{
  const s=fixture(t).store;const full=card({title:'题'.repeat(160),description:'述'.repeat(3000),instructions:'步'.repeat(8000),examples:Array.from({length:12},(_,i)=>`${i}`+'例'.repeat(1998)),limits:'界'.repeat(3000),evidence:'据'.repeat(3000),tags:Array.from({length:24},(_,i)=>`${i}`+'签'.repeat(78))});
  const a=save(s,'alice',full);assert.equal(a.card.instructions.length,8000);assert.deepEqual(a.card.examples,full.examples);
  for(const invalid of [card({title:'a'.repeat(161)}),card({description:'a'.repeat(3001)}),card({instructions:'a'.repeat(8001)}),card({examples:['a'.repeat(2001)]}),card({limits:'a'.repeat(3001)}),card({evidence:'a'.repeat(3001)}),card({tags:Array.from({length:25},(_,i)=>String(i))})])err('INVALID_FIELD',()=>s.createDraft('alice',{kind:'strategy',card:invalid}));
  assert.equal(s.listDrafts('alice').length,1);assert.equal(s.listAssets('alice').length,1);
  const dangerous=save(s,'alice',card({title:'<img src=x onerror=alert(1)>',instructions:'<script>globalThis.hacked = true</script>',sessions:['hidden']}));
  assert.ok(dangerous.card.title.includes('<img'));assert.equal(globalThis.hacked,undefined);assert.ok(!Object.hasOwn(dangerous.card,'sessions'));
  err('INVALID_FIELD',()=>s.setPreferences('alice',{preferences:{access_token:'secret'}}));
  err('INVALID_CARD',()=>s.createDraft('alice',{kind:'strategy',card:card({id:'__proto__'})}));
  err('INVALID_CARD',()=>s.createDraft('alice',{kind:'strategy',card:card({id:'<script>id</script>'})}));
});

test('course invitation rotation and classroom isolation expose only intended membership',t=>{
  const s=fixture(t).store,c=course(s),other=s.createCourse('other-teacher',{title:'其他课',objective:'另一目标'});
  assert.equal(s.listCourses('stranger').length,0);assert.equal(s.getCourse('teacher',{courseId:c.id}).members.length,3);
  const own=s.getCourse('student',{courseId:c.id});assert.equal(own.role,'student');assert.deepEqual(own.members.map(m=>m.id),['student']);assert.equal(own.memberCount,2);assert.ok(!('inviteCode'in own));
  for(const who of ['student','stranger','other-teacher'])err('NOT_FOUND',()=>s.createInvite(who,{courseId:c.id}));
  err('NOT_FOUND',()=>s.getCourse('teacher',{courseId:other.id}));
  const rotated=s.createInvite('teacher',{courseId:c.id});err('NOT_FOUND',()=>s.joinCourse('new-student',{code:c.inviteCode}));s.joinCourse('new-student',{code:rotated.inviteCode});s.joinCourse('new-student',{code:rotated.inviteCode});assert.equal(s.getCourse('teacher',{courseId:c.id}).memberCount,3);
  s.db.prepare('UPDATE invites SET expires=? WHERE course_id=?').run('2000-01-01T00:00:00.000Z',c.id);err('NOT_FOUND',()=>s.joinCourse('late-student',{code:rotated.inviteCode}));
});

test('student shares only selected fragments and own server usage; submitted totals stay self-reported',t=>{
  const s=fixture(t).store,c=course(s);
  s.createDraft('student',{kind:'learning-block',title:'私密草稿',markdown:'not shared private study'});
  const event=s.recordUsage('student',{id:'event-1',source:'provider',tokens:101,model:'fixture-model',strategies:[{id:'retrieval-demo',version:cardVersion(card())}]});
  assert.deepEqual(s.recordUsage('student',{id:'event-1',source:'provider',tokens:101,model:'fixture-model',strategies:[{id:'retrieval-demo',version:cardVersion(card())}]}),event);
  err('CONFLICT',()=>s.recordUsage('student',{id:'event-1',source:'provider',tokens:102}));err('NOT_FOUND',()=>s.recordUsage('second-student',{id:'event-1',source:'provider',tokens:101}));
  const empty=submit(s,c,'second-student',{tokens:{actual:9000,source:'provider',verifiedUsage:true}});assert.equal(empty.tokens.actual,null);assert.equal(empty.reportedTokens.actual,9000);assert.equal(empty.reportedTokens.source,'self-report');assert.equal(empty.reportedTokens.verifiedUsage,false);
  const selected=submit(s,c,'student',{usageIds:['event-1']});assert.equal(selected.tokens.actual,101);assert.equal(selected.tokens.totalCalls,1);
  err('NOT_FOUND',()=>submit(s,c,'second-student',{usageIds:['event-1']}));
  assert.equal(s.listSubmissions('teacher',{courseId:c.id}).length,2);assert.equal(s.listSubmissions('student',{courseId:c.id}).length,1);
  err('NOT_FOUND',()=>s.getSubmission('second-student',{submissionId:selected.id}));err('NOT_FOUND',()=>s.getSubmission('outsider',{submissionId:selected.id}));
  assert.deepEqual(s.listDrafts('teacher'),[]);assert.deepEqual(s.listUsage('teacher'),[]);assert.ok(!JSON.stringify(s.listSubmissions('teacher',{courseId:c.id})).includes('not shared private study'));
  assert.equal(s.recordUsage('student',{source:'provider',tokens:null}).source,'unavailable');err('INVALID_FIELD',()=>s.recordUsage('student',{source:'provider',tokens:-1}));err('INVALID_FIELD',()=>s.recordUsage('student',{source:'provider',tokens:NaN}));err('INVALID_FIELD',()=>s.recordUsage('student',{source:'unavailable',tokens:2}));
});

test('AI assessment cannot overwrite human review; stale review is rejected and draft remains teacher-private',t=>{
  const s=fixture(t).store,c=course(s),sub=submit(s,c);
  err('NOT_FOUND',()=>s.draftAssessment('student',{submissionId:sub.id,assessment:'我已经掌握'}));
  const first=s.draftAssessment('teacher',{submissionId:sub.id,assessment:'应进一步检查迁移能力。',confirmed:true});assert.equal(first.review,null);assert.equal(s.getSubmission('student',{submissionId:sub.id}).assessment,'');
  err('CONFLICT',()=>s.reviewSubmission('teacher',{submissionId:sub.id,expectedAssessmentRevision:0,level:'partial',basis:'需要迁移题'}));
  const reviewed=s.reviewSubmission('teacher',{submissionId:sub.id,expectedAssessmentRevision:first.assessmentRevision,level:'partial',basis:'能解释概念，但没有新例子',assessment:'教师修改过的分析'});assert.equal(reviewed.review.level,'partial');assert.equal(s.getSubmission('student',{submissionId:sub.id}).assessment,'教师修改过的分析');
  const second=s.draftAssessment('teacher',{submissionId:sub.id,assessment:'新生成的不同草稿',review:{level:'mastered'}});assert.deepEqual(second.review,reviewed.review);assert.equal(s.getSubmission('student',{submissionId:sub.id}).assessment,'教师修改过的分析');
  err('NOT_FOUND',()=>s.reviewSubmission('student',{submissionId:sub.id,expectedAssessmentRevision:2,level:'mastered',basis:'我确认'}));
});

test('assignment lifecycle restricts teachers and students, forbids model publishing and stale approvals',t=>{
  const s=fixture(t).store,c=course(s),sub=submit(s,c);let a=s.draftAssignment('teacher',{courseId:c.id,studentId:'student',submissionId:sub.id,title:'换情境解释',content:'请给一个新的例子',confirmed:true,status:'published'});
  assert.equal(a.status,'draft');assert.equal(s.listAssignments('student',{courseId:c.id}).length,0);err('NOT_FOUND',()=>s.getAssignment('student',{assignmentId:a.id}));err('NOT_FOUND',()=>s.draftAssignment('student',{courseId:c.id,studentId:'student',title:'伪造',content:'伪造'}));
  const stale=a.revision;a=s.draftAssignment('teacher',{assignmentId:a.id,expectedRevision:a.revision,content:'再说明为什么适用'});err('CONFLICT',()=>s.publishAssignment('teacher',{assignmentId:a.id,expectedRevision:stale}));
  a=s.publishAssignment('teacher',{assignmentId:a.id,expectedRevision:a.revision});assert.equal(a.status,'published');assert.equal(s.listAssignments('student',{courseId:c.id}).length,1);assert.equal(s.listAssignments('second-student',{courseId:c.id}).length,0);
  err('NOT_FOUND',()=>s.submitAssignment('second-student',{assignmentId:a.id,expectedRevision:a.revision,content:'代做'}));err('CONFLICT',()=>s.confirmAssignment('teacher',{assignmentId:a.id,expectedRevision:a.revision,basis:'还没有交'}));
  a=s.submitAssignment('student',{assignmentId:a.id,expectedRevision:a.revision,content:'我在新情境中解释条件变化。'});assert.equal(a.status,'submitted');err('NOT_FOUND',()=>s.confirmAssignment('student',{assignmentId:a.id,expectedRevision:a.revision,basis:'自己确认'}));
  err('CONFLICT',()=>s.draftAssignment('teacher',{assignmentId:a.id,expectedRevision:a.revision,title:'偷偷改题',content:'新内容'}));
  a=s.confirmAssignment('teacher',{assignmentId:a.id,expectedRevision:a.revision,basis:'独立例子与条件解释均准确'});assert.equal(a.status,'confirmed');assert.ok(a.confirmation.at);
  err('CONFLICT',()=>s.submitAssignment('student',{assignmentId:a.id,expectedRevision:a.revision,content:'覆盖老师确认的内容'}));
});

test('community publication is opt-in, versioned, retractable and free of private account fields',t=>{
  const s=fixture(t).store,a=save(s,'secret-private-user');assert.equal(s.listCommunity('reader').length,0);
  const pub=s.publishStrategy('secret-private-user',{assetId:a.id,authorName:'公开署名'});assert.equal(s.listCommunity('reader').length,1);assert.equal(pub.card.version,a.version);assert.ok(!JSON.stringify(pub).includes('secret-private-user'));assert.ok(!Object.hasOwn(pub,'assetId'));
  const feedback=s.addFeedback('reader',{publicationId:pub.id,rating:5,helped:'yes',note:'帮我找出了遗漏',source:'provider',verifiedUsage:true,tokens:{actual:99999}});assert.equal(feedback.source,'self-report');assert.equal(feedback.verifiedUsage,false);
  const imported=s.addFeedback('reader',{publicationId:pub.id,rating:3,helped:'partly',note:'外部材料中的反馈',source:'imported-self-report'});assert.equal(imported.source,'imported-self-report');assert.equal(s.getUsageSummary('reader').actual,null);
  const second=save(s,'secret-private-user',card({instructions:'第二版：尝试后再做一题迁移'}),a.id);assert.equal(s.getCommunityStrategy('reader',{publicationId:pub.id}).version,a.version);
  s.publishStrategy('secret-private-user',{assetId:a.id});assert.equal(s.getCommunityStrategy('reader',{publicationId:pub.id}).version,second.version);assert.equal(s.getCommunityStrategy('reader',{publicationId:pub.id,version:a.version}).card.instructions,a.card.instructions);
  assert.equal(s.listFeedback('reader',{publicationId:pub.id,version:second.version}).length,0);assert.equal(s.listFeedback('reader',{publicationId:pub.id,version:a.version}).length,2);
  err('NOT_FOUND',()=>s.unpublishStrategy('reader',{publicationId:pub.id}));s.unpublishStrategy('secret-private-user',{publicationId:pub.id});assert.equal(s.listCommunity('reader').length,0);err('NOT_FOUND',()=>s.getCommunityStrategy('reader',{publicationId:pub.id}));
  s.publishStrategy('secret-private-user',{assetId:a.id});s.deleteAsset('secret-private-user',{assetId:a.id});assert.equal(s.listCommunity('reader').length,0);
});

test('independent connections observe committed data and stale drafts fail atomically',t=>{
  const f=fixture(t),a=save(f.store,'alice'),other=new LearningStore({filename:f.filename});try{
  const draft=f.store.createDraft('alice',{kind:'strategy',assetId:a.id,card:card({instructions:'窗口甲的版本'})});
  save(other,'alice',card({instructions:'窗口乙已保存的版本'}),a.id);
  err('CONFLICT',()=>f.store.approveDraft('alice',{draftId:draft.id,expectedRevision:draft.revision}));
  assert.equal(f.store.getDraft('alice',{draftId:draft.id}).status,'pending');assert.equal(f.store.getAsset('alice',{assetId:a.id}).card.instructions,'窗口乙已保存的版本');assert.equal(f.store.listVersions('alice',{assetId:a.id}).length,2);
  }finally{other.close();}
});
