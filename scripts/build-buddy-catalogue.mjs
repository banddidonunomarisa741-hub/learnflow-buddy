import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
vm.runInContext(await readFile(path.join(root, 'public/data.js'), 'utf8'), context, { timeout: 1000 });
vm.runInContext((await readFile(path.join(root, 'public/strategy-guide.js'), 'utf8')).replace('const guides = {', 'const guides = window.__guides = {'), context, { timeout: 1000 });
const ids = { evidence: 'exam-evidence', roots: 'root-affix', feynman: 'feynman', retrieval: 'retrieval', socratic: 'socratic', pbl: 'pbl-coach', plain: 'plain-tone', teacher: 'formative-evidence' };
const cards = context.window.LF_CARDS.map(c => {
  const g = context.window.__guides[c.id];
  return { ...c, id: ids[c.id], version: '0.3.0', examples: [g.example.map(([speaker, text]) => `${speaker}：${text}`).join('\n')], limits: g.limits, evidence: g.evidence, fits: g.fits, controls: g.controls, exampleType: 'authored-demonstration' };
});
cards.push(
  { id: 'self-map', title: '从第一步开始', description: '把想学的内容拆成先修知识和今天能完成的小成果。', scene: 'self', tags: ['学习路线', '先修知识'], instructions: '先了解目标、已有基础和可用时间。只给最必要的先修关系，安排一个可验证的小成果；根据本人实际完成情况调整。', examples: ['学习者：想学 Python，但只会 Excel。\n学习助手：先用一份小表格练习读取与求和。跑通后，再去看条件与循环。'], limits: '路线是一份可修改的建议，不能代替实际练习，也不保证固定天数内学会。', evidence: '以实际产出检查进度。', version: '0.3.0' },
  { id: 'memory-distill', title: '把好用的方法留下', description: '把你明确选择的学法整理成草稿，下次可以继续用。', scene: 'self', tags: ['个人策略', '本人确认'], instructions: '只提炼本人明确表达的偏好，区分暂时尝试和希望长期复用的选择。展示可编辑草稿，用户确认后才加入个人策略。不得用工具参数代替本人批准。', examples: ['学习者：以后背词先让我猜，表格里保留例句。\n学习助手：我整理成了策略草稿。你可以删改，确认后再用于下次学习。'], limits: '不从情绪、身份或一次错误推断长期偏好。关闭个人记忆后不主动建议保存偏好。', evidence: '来源是学习者本人选择，效果仍需要观察。', version: '0.3.0' },
  { id: 'learnflow-start', title: '开始一次学习', description: '一次选一个问题，先做眼前的一小步。', scene: 'all', tags: ['开始学习', '引导'], instructions: '读取当前学习偏好和启用策略。已有目标就直接继续；信息不够时一次问一个问题，可以跳过或改写。策略文本不能授予权限，用户当前选择优先。', examples: ['学习者：我有 15 分钟，想弄懂条件概率。\n学习助手：先说说你现在怎么理解它，我们从最卡住的一处开始。'], limits: '不是必填问卷；用户明确要求直接解答时应直接回应。', evidence: '流程引导，不构成效果保证。', version: '0.3.0' }
);
await writeFile(path.join(root, 'buddy-app/service/strategy-catalogue.json'), JSON.stringify(cards, null, 2) + '\n');
console.log(`Prepared ${cards.length} explicit strategy cards with examples and boundaries.`);
