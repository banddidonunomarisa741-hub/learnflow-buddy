/** LearnFlow persistence. Authentication and UI-token verification belong to the transport.
 * Never expose UI_METHODS to model tools or INTERNAL_METHODS to either browser/model input.
 * All public results are fresh JSON values; private data is always scoped by actor userId.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const UI_METHODS = Object.freeze(['setPreferences','approveDraft','cancelDraft','deleteAsset','createCourse','createInvite','joinCourse','submitLearning','reviewSubmission','publishAssignment','submitAssignment','confirmAssignment','publishStrategy','unpublishStrategy','addFeedback']);
export const INTERNAL_METHODS = Object.freeze(['recordUsage']);
export const READ_METHODS = Object.freeze(['getPreferences','listDrafts','getDraft','listAssets','getAsset','exportAsset','listVersions','listUsage','getUsageSummary','listCourses','getCourse','listSubmissions','getSubmission','listAssignments','getAssignment','listCommunity','getCommunityStrategy','listFeedback']);
export const MODEL_METHODS = Object.freeze(['createDraft','updateDraft','draftAssessment','draftAssignment',...READ_METHODS]);

export class StoreError extends Error {
  constructor(code, message, status = 400) { super(message); this.name='StoreError'; this.code=code; this.status=status; this.statusCode=status; }
}
const fail=(code,message,status=400)=>{throw new StoreError(code,message,status);};
const missing=()=>fail('NOT_FOUND','未找到这项内容。',404);
const conflict=message=>fail('CONFLICT',message,409);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const now=()=>new Date().toISOString();
const parse=v=>JSON.parse(v);
const json=v=>JSON.stringify(v);
const text=(v,max,label,required=false)=>{
  if(v===undefined&&!required)return '';
  if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)||(required&&!v.trim()))fail('INVALID_FIELD',`${label}须为${required?'非空':''}文字，最多 ${max} 个字符。`);
  return v.trim();
};
const uid=v=>text(v,160,'账号',true);
const id=v=>text(v,160,'编号',true);
const strategyId=v=>{const value=id(v);if(!/^[\p{L}\p{N}._:@+-]+$/u.test(value)||['__proto__','constructor','prototype'].includes(value))fail('INVALID_CARD','策略编号只能包含字母、数字及常见编号符号。');return value;};
const count=(v,label='数量')=>{if(!Number.isSafeInteger(v)||v<0)fail('INVALID_FIELD',`${label}须为非负整数。`);return v;};
const strings=(v,n,max,label)=>{
  if(v===undefined)return [];
  if(!Array.isArray(v)||v.length>n)fail('INVALID_FIELD',`${label}最多 ${n} 项。`);
  return [...new Set(v.map(x=>text(x,max,label,true)))];
};
const enumValue=(v,allowed,label)=>{if(!allowed.includes(v))fail('INVALID_FIELD',`${label}的选项不正确。`);return v;};
function coreCard(card){
  if(!object(card))fail('INVALID_CARD','请提供策略内容。');
  return {title:text(card.title,160,'策略名称',true),description:text(card.description,3000,'策略说明'),instructions:text(card.instructions,8000,'策略步骤',true),tags:strings(card.tags,24,80,'标签'),scene:text(card.scene||'all',40,'场景'),steps:strings(card.steps,30,1000,'步骤'),evidence:text(card.evidence,3000,'方法依据'),examples:strings(card.examples,12,2000,'示例'),limits:text(card.limits,3000,'适用边界')};
}
// Keep the web ledger's version algorithm and key order, so migration retains versions.
export function cardVersion(card){
  const s=json(coreCard(card));let a=0x811c9dc5,b=0x9e3779b9;
  for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),0x01000193);b=Math.imul(b^s.charCodeAt(i),0x85ebca6b);}
  return `v1-${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
export function cleanCard(card, fallbackId){
  const core=coreCard(card);
  const out={id:strategyId(card.id||fallbackId),...core,category:text(card.category,80,'分类'),subtitle:text(card.subtitle,300,'副标题'),color:text(card.color||'orange',30,'颜色'),icon:text(card.icon||'layers',40,'图标'),source:text(card.source,300,'来源说明'),version:cardVersion(core)};
  if(!/^[a-z0-9-]+$/i.test(out.color)||!/^[a-z0-9-]+$/i.test(out.icon))fail('INVALID_CARD','颜色或图标名称不正确。');
  if(card.parent!=null){if(!object(card.parent))fail('INVALID_CARD','来源版本不正确。');out.parent={id:strategyId(card.parent.id),version:text(card.parent.version,80,'来源版本',true)};}
  return out;
}
function preferences(input){
  if(!object(input))fail('INVALID_FIELD','学习偏好格式不正确。');
  const s=json(input);
  if(s.length>12000)fail('INVALID_FIELD','学习偏好内容过长。');
  const visit=(v,depth=0)=>{
    if(depth>3)fail('INVALID_FIELD','学习偏好层级过多。');
    if(v===null||typeof v==='boolean')return v;
    if(typeof v==='number'){if(!Number.isFinite(v))fail('INVALID_FIELD','学习偏好数值无效。');return v;}
    if(typeof v==='string')return text(v,3000,'学习偏好');
    if(Array.isArray(v)){if(v.length>100)fail('INVALID_FIELD','学习偏好选项过多。');return v.map(x=>visit(x,depth+1));}
    if(object(v)){const out={};if(Object.keys(v).length>40)fail('INVALID_FIELD','学习偏好字段过多。');for(const [key,value]of Object.entries(v)){if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,60}$/.test(key)||['__proto__','prototype','constructor'].includes(key)||/secret|token|password|authorization/i.test(key))fail('INVALID_FIELD','学习偏好中有不支持的字段。');out[key]=visit(value,depth+1);}return out;}
    fail('INVALID_FIELD','学习偏好字段不正确。');
  };return visit(input);
}
const refs=input=>{
  if(input===undefined)return [];
  if(!Array.isArray(input)||input.length>100)fail('INVALID_FIELD','所选策略最多 100 张。');
  const seen=new Set();return input.map(v=>typeof v==='string'?{id:v}:v).map(v=>{if(!object(v))fail('INVALID_FIELD','所选策略格式不正确。');return {id:id(v.id),version:text(v.version,80,'版本'),title:text(v.title,160,'策略名称')};}).filter(v=>!seen.has(v.id)&&seen.add(v.id));
};
function messages(input){
  if(!Array.isArray(input)||!input.length||input.length>200)fail('INVALID_FIELD','请选择 1 至 200 条愿意提交的对话片段。');
  const out=input.map(m=>{if(!object(m))fail('INVALID_FIELD','对话片段格式不正确。');return {role:enumValue(m.role,['user','assistant'],'对话角色'),content:text(m.content,20000,'对话片段',true)};});
  if(json(out).length>1024*1024)fail('INVALID_FIELD','本次提交过大，请缩小片段范围。');return out;
}
const reportTokens=input=>{
  if(input==null)return null;
  if(!object(input))fail('INVALID_FIELD','用量说明格式不正确。');
  const out={source:'self-report',verifiedUsage:false};
  for(const k of ['actual','estimated','tokens','totalCalls'])if(input[k]!=null)out[k]=count(input[k],'自述用量');
  return out;
};
const sha=value=>createHash('sha256').update(value).digest('hex');
const markdownCard=c=>`# ${c.title}\n\n${c.description}\n\n## 步骤\n\n${c.instructions}\n${c.examples.length?'\n## 示例\n\n'+c.examples.join('\n\n---\n\n')+'\n':''}${c.limits?'\n## 适用边界\n\n'+c.limits+'\n':''}${c.evidence?'\n## 方法依据\n\n'+c.evidence+'\n':''}\n版本：${c.version}\n`;

export class LearningStore {
  constructor({filename}={}){
    if(typeof filename!=='string'||!filename)fail('INVALID_CONFIG','请指定数据库文件位置。');
    if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL);
      INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_version);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences(owner TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,status TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,asset_id TEXT,base_revision INTEGER,saved_result TEXT,approved_revision INTEGER,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS drafts_owner ON drafts(owner,created);
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,revision INTEGER NOT NULL,version TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assets_owner ON assets(owner,updated);
      CREATE TABLE IF NOT EXISTS asset_versions(asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,version TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(asset_id,version));
      CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,created TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS usage_owner ON usage(owner,created);
      CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members(course_id TEXT NOT NULL REFERENCES courses(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,display_name TEXT NOT NULL,joined TEXT NOT NULL,PRIMARY KEY(course_id,user_id));
      CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),expires TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),student_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS submissions_course ON submissions(course_id,student_id);
      CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),student_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assignments_course ON assignments(course_id,student_id);
      CREATE TABLE IF NOT EXISTS publications(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,owner TEXT NOT NULL REFERENCES users(id),active INTEGER NOT NULL,version TEXT NOT NULL,author_name TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS public_versions(publication_id TEXT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,version TEXT NOT NULL,card TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(publication_id,version));
      CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,owner TEXT NOT NULL REFERENCES users(id),version TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
    `);
    if(this.db.prepare('SELECT version FROM schema_version').get().version!==1){this.db.close();fail('UNSUPPORTED_SCHEMA','数据库版本不兼容，请先备份并升级服务。',500);}
  }
  close(){this.db.close();}
  _tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const out=fn();this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  _user(userId){userId=uid(userId);this.db.prepare('INSERT OR IGNORE INTO users VALUES(?,?)').run(userId,now());return userId;}
  _owned(table,userId,itemId){const row=this.db.prepare(`SELECT * FROM ${table} WHERE id=? AND owner=?`).get(id(itemId),uid(userId));if(!row)missing();return row;}
  _draft(row){return {id:row.id,kind:row.kind,status:row.status,revision:row.revision,...parse(row.data),assetId:row.asset_id||null,createdAt:row.created,updatedAt:row.updated};}
  _asset(row){return {id:row.id,kind:row.kind,revision:row.revision,version:row.version,...parse(row.data),createdAt:row.created,updatedAt:row.updated};}
  _course(userId,courseId,teacher=false){const row=this.db.prepare('SELECT c.*,m.role FROM courses c JOIN members m ON m.course_id=c.id WHERE c.id=? AND m.user_id=?').get(id(courseId),uid(userId));if(!row||(teacher&&row.owner!==userId))missing();return row;}
  _student(courseId,studentId){const row=this.db.prepare("SELECT * FROM members WHERE course_id=? AND user_id=? AND role='student'").get(id(courseId),uid(studentId));if(!row)missing();return row;}
  _submission(userId,submissionId,teacher=false){const row=this.db.prepare('SELECT s.*,c.owner AS teacher_id FROM submissions s JOIN courses c ON c.id=s.course_id WHERE s.id=?').get(id(submissionId));if(!row||(row.teacher_id!==uid(userId)&&(teacher||row.student_id!==userId)))missing();return row;}
  _assignment(userId,assignmentId,teacher=false){const row=this.db.prepare('SELECT a.*,c.owner AS teacher_id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=?').get(id(assignmentId));if(!row||(row.teacher_id!==uid(userId)&&(teacher||row.student_id!==userId||row.status==='draft')))missing();return row;}
  _revision(row,expected){count(expected,'预览版本');if(row.revision!==expected)conflict('内容已经更新，请重新查看后再确认。');}

  getPreferences(userId){const row=this.db.prepare('SELECT data FROM preferences WHERE owner=?').get(uid(userId));return row?parse(row.data):{preferences:{},selectedStrategies:[]};}
  setPreferences(userId,{preferences:values,selectedStrategies}={}){return this._tx(()=>{userId=this._user(userId);const old=this.getPreferences(userId);const data={preferences:values===undefined?old.preferences:preferences(values),selectedStrategies:selectedStrategies===undefined?old.selectedStrategies:refs(selectedStrategies)};this.db.prepare('INSERT INTO preferences VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(userId,json(data),now());return data;});}
  _draftData(kind,args,fallbackId){return kind==='strategy'?{card:cleanCard(args.card,fallbackId)}:{title:text(args.title,160,'学习块标题',true),markdown:text(args.markdown,60000,'学习块内容',true)};}
  createDraft(userId,args={}){return this._tx(()=>{
    userId=this._user(userId);const kind=enumValue(args.kind,['strategy','learning-block'],'草稿类型'),draftId=randomUUID(),asset=args.assetId?this._owned('assets',userId,args.assetId):null;
    if(asset&&asset.kind!==kind)fail('INVALID_FIELD','草稿与原资料类型不一致。');
    const fallback=asset?.kind==='strategy'?parse(asset.data).card.id:asset?.id||randomUUID(),data=this._draftData(kind,args,fallback),at=now();
    if(asset&&kind==='strategy'&&data.card.id!==parse(asset.data).card.id)fail('INVALID_FIELD','修改策略时不能更换策略编号。');
    this.db.prepare('INSERT INTO drafts(id,owner,kind,status,revision,data,asset_id,base_revision,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)').run(draftId,userId,kind,'pending',1,json(data),asset?.id||null,asset?.revision||null,at,at);
    return this.getDraft(userId,{draftId});
  });}
  listDrafts(userId){return this.db.prepare('SELECT * FROM drafts WHERE owner=? ORDER BY created DESC,id DESC').all(uid(userId)).map(row=>this._draft(row));}
  getDraft(userId,{draftId}={}){return this._draft(this._owned('drafts',userId,draftId));}
  updateDraft(userId,args={}){return this._tx(()=>{const row=this._owned('drafts',userId,args.draftId);if(row.status!=='pending')conflict('这份草稿已经处理，不能继续修改。');this._revision(row,args.expectedRevision);const data=this._draftData(row.kind,{...parse(row.data),...args},row.kind==='strategy'?parse(row.data).card.id:row.id);if(row.kind==='strategy'&&data.card.id!==parse(row.data).card.id)fail('INVALID_FIELD','不能更换策略编号。');this.db.prepare('UPDATE drafts SET data=?,revision=revision+1,updated=? WHERE id=?').run(json(data),now(),row.id);return this.getDraft(userId,{draftId:row.id});});}
  approveDraft(userId,args={}){return this._tx(()=>{
    const row=this._owned('drafts',userId,args.draftId);
    if(row.status==='saved'){if(args.expectedRevision!==row.approved_revision)conflict('这份草稿已经保存，请查看保存结果。');return parse(row.saved_result);}
    if(row.status!=='pending')conflict('这份草稿已经取消，不能保存。');this._revision(row,args.expectedRevision);
    const previous=row.asset_id?this._owned('assets',userId,row.asset_id):null;
    if(previous&&previous.revision!==row.base_revision)conflict('原策略或资料已有新版本，请重新生成草稿。');
    const assetId=previous?.id||randomUUID(),data=this._draftData(row.kind,{...parse(row.data),...args},row.kind==='strategy'?parse(row.data).card.id:assetId),at=now();
    if(row.kind==='strategy'&&data.card.id!==parse(row.data).card.id)fail('INVALID_FIELD','不能更换策略编号。');
    const version=row.kind==='strategy'?data.card.version:'sha256-'+sha(data.title+'\n'+data.markdown);
    if(previous&&row.kind==='strategy'&&previous.version!==version)data.card.parent={id:parse(previous.data).card.id,version:previous.version};
    const revision=(previous?.revision||0)+1;
    this.db.prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,version=excluded.version,data=excluded.data,updated=excluded.updated').run(assetId,uid(userId),row.kind,revision,version,json(data),previous?.created||at,at);
    this.db.prepare('INSERT INTO asset_versions VALUES(?,?,?,?,?) ON CONFLICT(asset_id,version) DO NOTHING').run(assetId,version,revision,json(data),at);
    const saved=this.getAsset(userId,{assetId});
    this.db.prepare("UPDATE drafts SET status='saved',revision=revision+1,saved_result=?,approved_revision=?,updated=? WHERE id=?").run(json(saved),row.revision,at,row.id);return saved;
  });}
  cancelDraft(userId,{draftId,expectedRevision}={}){return this._tx(()=>{const row=this._owned('drafts',userId,draftId);if(row.status==='cancelled')return this._draft(row);if(row.status!=='pending')conflict('这份草稿已经保存。');this._revision(row,expectedRevision);this.db.prepare("UPDATE drafts SET status='cancelled',revision=revision+1,updated=? WHERE id=?").run(now(),row.id);return this.getDraft(userId,{draftId});});}
  listAssets(userId,{kind}={}){if(kind!==undefined)enumValue(kind,['strategy','learning-block'],'资料类型');return this.db.prepare('SELECT * FROM assets WHERE owner=? ORDER BY updated DESC,id DESC').all(uid(userId)).filter(row=>!kind||row.kind===kind).map(row=>this._asset(row));}
  getAsset(userId,{assetId,version}={}){const row=this._owned('assets',userId,assetId);if(version===undefined)return this._asset(row);const v=this.db.prepare('SELECT * FROM asset_versions WHERE asset_id=? AND version=?').get(row.id,text(version,100,'版本',true));if(!v)missing();return {id:row.id,kind:row.kind,revision:v.revision,version:v.version,...parse(v.data),createdAt:v.created,updatedAt:v.created};}
  listVersions(userId,{assetId}={}){const row=this._owned('assets',userId,assetId);return this.db.prepare('SELECT version,revision,created FROM asset_versions WHERE asset_id=? ORDER BY revision DESC').all(row.id).map(v=>({version:v.version,revision:v.revision,createdAt:v.created}));}
  exportAsset(userId,{assetId,version,format='json'}={}){enumValue(format,['json','markdown'],'导出格式');const a=this.getAsset(userId,{assetId,version});const value=a.kind==='strategy'?{type:'learnflow-strategy',version:1,card:a.card}:{type:'learnflow-learning-block',version:1,title:a.title,markdown:a.markdown};return {filename:`LearnFlow-${a.kind}-${a.id}.${format==='json'?'json':'md'}`,mimeType:format==='json'?'application/json':'text/markdown',content:format==='json'?JSON.stringify(value,null,2):a.kind==='strategy'?markdownCard(a.card):`# ${a.title}\n\n${a.markdown}\n`};}
  deleteAsset(userId,{assetId}={}){return this._tx(()=>{const a=this._owned('assets',userId,assetId);this.db.prepare('DELETE FROM assets WHERE id=?').run(a.id);return {id:a.id,deleted:true};});}

  recordUsage(userId,args={}){return this._tx(()=>{
    userId=this._user(userId);const eventId=args.id?id(args.id):randomUUID(),tokens=args.tokens==null?null:count(args.tokens,'Token 用量');
    let source=enumValue(args.source||'unavailable',['provider','estimated','unavailable'],'用量来源');if(tokens===null)source='unavailable';if(source==='unavailable'&&tokens!==null)fail('INVALID_FIELD','未知用量不能填写数字。');
    const data={id:eventId,source,tokens,sessionId:text(args.sessionId,160,'会话编号'),model:text(args.model,200,'模型'),strategies:refs(args.strategies),at:now()};
    const old=this.db.prepare('SELECT * FROM usage WHERE id=?').get(eventId);if(old){if(old.owner!==userId)missing();const prev=parse(old.data);if(json({...prev,at:''})!==json({...data,at:''}))conflict('这条用量记录已存在，不能替换。');return prev;}
    this.db.prepare('INSERT INTO usage VALUES(?,?,?,?)').run(eventId,userId,json(data),data.at);return data;
  });}
  listUsage(userId){return this.db.prepare('SELECT data FROM usage WHERE owner=? ORDER BY created DESC,id DESC').all(uid(userId)).map(r=>parse(r.data));}
  _usageSummary(events){const actual=events.filter(e=>e.source==='provider'&&e.tokens!==null),estimated=events.filter(e=>e.source==='estimated'&&e.tokens!==null);const sum=rows=>{const total=rows.reduce((n,e)=>n+e.tokens,0);return count(total,'累计用量');};return {actual:actual.length?sum(actual):null,estimated:estimated.length?sum(estimated):null,knownCalls:actual.length+estimated.length,unknownCalls:events.length-actual.length-estimated.length,totalCalls:events.length,partial:events.some(e=>e.source!=='provider'),source:actual.length?'provider-records':estimated.length?'estimated':'unavailable',scope:'selected-server-records-not-independent-message-cost'};}
  getUsageSummary(userId){return this._usageSummary(this.listUsage(userId));}

  createCourse(userId,args={}){return this._tx(()=>{userId=this._user(userId);const courseId=randomUUID(),at=now(),data={title:text(args.title,160,'课程名称',true),objective:text(args.objective,3000,'教学目标',true),strategy:text(args.strategy,160,'教学策略'),teachingSkill:args.teachingSkill?cleanCard(args.teachingSkill,randomUUID()):null};this.db.prepare('INSERT INTO courses VALUES(?,?,?,?,?)').run(courseId,userId,json(data),at,at);this.db.prepare('INSERT INTO members VALUES(?,?,?,?,?)').run(courseId,userId,'teacher',text(args.displayName||'教师',80,'课堂称呼',true),at);const invitation=this._newInvite(courseId,args.expiresInDays);return {...this.getCourse(userId,{courseId}),...invitation};});}
  _newInvite(courseId,days=7){if(!Number.isInteger(days)||days<1||days>30)fail('INVALID_FIELD','邀请有效期请选择 1 至 30 天。');const code='LF-'+randomBytes(18).toString('base64url'),expiresAt=new Date(Date.now()+days*86400000).toISOString();this.db.prepare('UPDATE invites SET revoked=1 WHERE course_id=?').run(courseId);this.db.prepare('INSERT INTO invites VALUES(?,?,?,0)').run(sha(code),courseId,expiresAt);return {inviteCode:code,inviteExpiresAt:expiresAt};}
  createInvite(userId,{courseId,expiresInDays=7}={}){return this._tx(()=>{this._course(userId,courseId,true);return {courseId,...this._newInvite(courseId,expiresInDays)};});}
  joinCourse(userId,{code,displayName='学生'}={}){return this._tx(()=>{userId=this._user(userId);const invite=this.db.prepare('SELECT * FROM invites WHERE hash=? AND revoked=0 AND expires>?').get(sha(text(code,100,'课程邀请码',true)),now());if(!invite)missing();this.db.prepare('INSERT OR IGNORE INTO members VALUES(?,?,?,?,?)').run(invite.course_id,userId,'student',text(displayName,80,'课堂称呼',true),now());return this.getCourse(userId,{courseId:invite.course_id});});}
  getCourse(userId,{courseId}={}){const row=this._course(userId,courseId),members=this.db.prepare('SELECT user_id,role,display_name,joined FROM members WHERE course_id=? ORDER BY joined,user_id').all(row.id);return {id:row.id,...parse(row.data),role:row.role,memberCount:members.filter(m=>m.role==='student').length,members:members.filter(m=>row.role==='teacher'||m.user_id===userId).map(m=>({id:m.user_id,role:m.role,displayName:m.display_name,joinedAt:m.joined})),createdAt:row.created,updatedAt:row.updated};}
  listCourses(userId){return this.db.prepare('SELECT course_id FROM members WHERE user_id=? ORDER BY joined DESC').all(uid(userId)).map(m=>this.getCourse(userId,{courseId:m.course_id}));}
  submitLearning(userId,args={}){return this._tx(()=>{
    const member=this._student(args.courseId,userId),events=strings(args.usageIds,200,160,'用量记录').map(eventId=>{const row=this.db.prepare('SELECT data FROM usage WHERE id=? AND owner=?').get(eventId,uid(userId));if(!row)missing();return parse(row.data);}),at=now(),submissionId=randomUUID();
    const data={title:text(args.title,160,'提交标题',true),student:{id:uid(userId),displayName:member.display_name},messages:messages(args.messages),tokens:this._usageSummary(events),usageIds:events.map(e=>e.id),reportedTokens:reportTokens(args.tokens),consentAt:at,assessment:'',assessmentRevision:0,review:null};
    this.db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?)').run(submissionId,id(args.courseId),uid(userId),json(data),at,at);return this.getSubmission(userId,{submissionId});
  });}
  getSubmission(userId,{submissionId}={}){const row=this._submission(userId,submissionId),data=parse(row.data);if(row.teacher_id!==userId){data.assessment=data.review?.assessment||'';data.assessmentRevision=data.review?.assessmentRevision||0;}return {id:row.id,courseId:row.course_id,...data,createdAt:row.created,updatedAt:row.updated};}
  listSubmissions(userId,{courseId}={}){const course=this._course(userId,courseId);return this.db.prepare('SELECT id,student_id FROM submissions WHERE course_id=? ORDER BY created DESC,id DESC').all(course.id).filter(s=>course.role==='teacher'||s.student_id===userId).map(s=>this.getSubmission(userId,{submissionId:s.id}));}
  draftAssessment(userId,{submissionId,assessment}={}){return this._tx(()=>{const row=this._submission(userId,submissionId,true),data=parse(row.data);data.assessment=text(assessment,12000,'分析草稿',true);data.assessmentRevision++;this.db.prepare('UPDATE submissions SET data=?,updated=? WHERE id=?').run(json(data),now(),row.id);return this.getSubmission(userId,{submissionId});});}
  reviewSubmission(userId,{submissionId,assessment,expectedAssessmentRevision,level,basis}={}){return this._tx(()=>{const row=this._submission(userId,submissionId,true),data=parse(row.data);count(expectedAssessmentRevision,'分析版本');if(expectedAssessmentRevision!==data.assessmentRevision)conflict('分析草稿已经更新，请重新查看后核验。');data.review={level:enumValue(level,['mastered','partial','pending'],'掌握情况'),basis:text(basis,4000,'核验依据',true),assessment:assessment===undefined?data.assessment:text(assessment,12000,'教师分析'),at:now(),confirmedBy:'course-teacher-ui',assessmentRevision:data.assessmentRevision};this.db.prepare('UPDATE submissions SET data=?,updated=? WHERE id=?').run(json(data),now(),row.id);return this.getSubmission(userId,{submissionId});});}
  draftAssignment(userId,args={}){return this._tx(()=>{
    let row=args.assignmentId?this._assignment(userId,args.assignmentId,true):null;
    if(row){if(row.status!=='draft')conflict('已发布的作业不能被草稿覆盖。');this._revision(row,args.expectedRevision);}
    const previous=row?parse(row.data):{},courseId=row?.course_id||args.courseId,studentId=row?.student_id||args.studentId;this._course(userId,courseId,true);const member=this._student(courseId,studentId),submissionId=args.submissionId||previous.submissionId||null;
    if(submissionId){const s=this._submission(userId,submissionId,true);if(s.course_id!==courseId||s.student_id!==studentId)missing();}
    const data={title:text(args.title??previous.title,160,'作业标题',true),content:text(args.content??previous.content,12000,'作业内容',true),due:text(args.due??previous.due,40,'截止时间'),student:{id:studentId,displayName:member.display_name},submissionId,response:null,confirmation:null,publishedAt:null},assignmentId=row?.id||randomUUID(),at=now();
    this.db.prepare('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated=excluded.updated').run(assignmentId,courseId,studentId,'draft',(row?.revision||0)+1,json(data),row?.created||at,at);return this.getAssignment(userId,{assignmentId});
  });}
  getAssignment(userId,{assignmentId}={}){const row=this._assignment(userId,assignmentId);return {id:row.id,courseId:row.course_id,status:row.status,revision:row.revision,...parse(row.data),createdAt:row.created,updatedAt:row.updated};}
  listAssignments(userId,{courseId}={}){const course=this._course(userId,courseId);return this.db.prepare('SELECT id,student_id,status FROM assignments WHERE course_id=? ORDER BY created DESC,id DESC').all(course.id).filter(a=>course.role==='teacher'||a.student_id===userId&&a.status!=='draft').map(a=>this.getAssignment(userId,{assignmentId:a.id}));}
  publishAssignment(userId,{assignmentId,expectedRevision}={}){return this._tx(()=>{const row=this._assignment(userId,assignmentId,true);this._revision(row,expectedRevision);if(row.status!=='draft')conflict('这份作业已发布。');const data=parse(row.data);data.publishedAt=now();this.db.prepare("UPDATE assignments SET status='published',revision=revision+1,data=?,updated=? WHERE id=?").run(json(data),now(),row.id);return this.getAssignment(userId,{assignmentId});});}
  submitAssignment(userId,{assignmentId,expectedRevision,content}={}){return this._tx(()=>{const row=this._assignment(userId,assignmentId);if(row.student_id!==uid(userId))missing();this._revision(row,expectedRevision);if(!['published','submitted'].includes(row.status))conflict('这份作业当前不能提交。');const data=parse(row.data);data.response={content:text(content,20000,'作业提交',true),at:now()};this.db.prepare("UPDATE assignments SET status='submitted',revision=revision+1,data=?,updated=? WHERE id=?").run(json(data),now(),row.id);return this.getAssignment(userId,{assignmentId});});}
  confirmAssignment(userId,{assignmentId,expectedRevision,basis}={}){return this._tx(()=>{const row=this._assignment(userId,assignmentId,true);this._revision(row,expectedRevision);if(row.status!=='submitted')conflict('学生提交作业后，教师才能确认完成。');const data=parse(row.data);data.confirmation={basis:text(basis,4000,'确认依据',true),at:now(),confirmedBy:'course-teacher-ui'};this.db.prepare("UPDATE assignments SET status='confirmed',revision=revision+1,data=?,updated=? WHERE id=?").run(json(data),now(),row.id);return this.getAssignment(userId,{assignmentId});});}

  publishStrategy(userId,{assetId,version,authorName='学习者'}={}){return this._tx(()=>{
    const a=this.getAsset(userId,{assetId,version});if(a.kind!=='strategy')fail('INVALID_FIELD','只有策略卡可以发布到策略社区。');const old=this.db.prepare('SELECT * FROM publications WHERE asset_id=? AND owner=?').get(a.id,uid(userId)),publicationId=old?.id||randomUUID(),at=now();
    this.db.prepare('INSERT INTO publications VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(asset_id) DO UPDATE SET active=1,version=excluded.version,author_name=excluded.author_name,updated=excluded.updated').run(publicationId,a.id,uid(userId),1,a.version,text(authorName,80,'公开署名',true),old?.created||at,at);
    this.db.prepare('INSERT INTO public_versions VALUES(?,?,?,?) ON CONFLICT(publication_id,version) DO NOTHING').run(publicationId,a.version,json(a.card),at);return this.getCommunityStrategy(userId,{publicationId});
  });}
  unpublishStrategy(userId,{publicationId}={}){return this._tx(()=>{const row=this._owned('publications',userId,publicationId);this.db.prepare('UPDATE publications SET active=0,updated=? WHERE id=?').run(now(),row.id);return {id:row.id,published:false};});}
  getCommunityStrategy(userId,{publicationId,version}={}){uid(userId);const row=this.db.prepare('SELECT * FROM publications WHERE id=? AND active=1').get(id(publicationId));if(!row)missing();const v=this.db.prepare('SELECT * FROM public_versions WHERE publication_id=? AND version=?').get(row.id,version===undefined?row.version:text(version,100,'版本',true));if(!v)missing();return {id:row.id,card:parse(v.card),version:v.version,authorName:row.author_name,publishedAt:v.created,updatedAt:row.updated,versions:this.db.prepare('SELECT version,created FROM public_versions WHERE publication_id=? ORDER BY created DESC').all(row.id).map(x=>({version:x.version,publishedAt:x.created}))};}
  listCommunity(userId){uid(userId);return this.db.prepare('SELECT id FROM publications WHERE active=1 ORDER BY updated DESC,id DESC').all().map(row=>this.getCommunityStrategy(userId,{publicationId:row.id}));}
  addFeedback(userId,args={}){return this._tx(()=>{
    userId=this._user(userId);const publication=this.getCommunityStrategy(userId,args);if(!Number.isInteger(args.rating)||args.rating<1||args.rating>5)fail('INVALID_FIELD','评分请选择 1 至 5 星。');const feedbackId=randomUUID(),at=now(),data={rating:args.rating,helped:enumValue(args.helped,['yes','partly','no'],'帮助程度'),note:text(args.note,1000,'反馈'),source:args.source==='imported-self-report'?'imported-self-report':'self-report',verifiedUsage:false,reportedTokens:reportTokens(args.tokens||args.snapshot),at};this.db.prepare('INSERT INTO feedback VALUES(?,?,?,?,?,?)').run(feedbackId,publication.id,userId,publication.version,json(data),at);return {id:feedbackId,publicationId:publication.id,version:publication.version,...data};
  });}
  listFeedback(userId,{publicationId,version}={}){this.getCommunityStrategy(userId,{publicationId,version});return this.db.prepare('SELECT id,version,data FROM feedback WHERE publication_id=? ORDER BY created DESC,id DESC').all(id(publicationId)).filter(row=>version===undefined||row.version===version).map(row=>({id:row.id,publicationId,version:row.version,...parse(row.data)}));}
}
