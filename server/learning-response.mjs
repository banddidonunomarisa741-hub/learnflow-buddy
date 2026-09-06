export const NEXT_POLICY = `在完整教学回复的末尾，用一个 learnflow-next 代码围栏附上 JSON（正常正文之外）：{"suggestions":[{"label":"简短可点击的下一步","prompt":"完整的后续学习请求"}],"blockReady":false,"blockReason":"","blockTitle":"","blockSummary":""}。建议提供 2–3 个与本轮知识、已选学习策略和学习偏好相符的选择；不要每次推荐更换方法，不要将建议当成已执行操作。仅在一个概念已经讲清并做过练习、用户完成阶段任务或主动要求总结时，将 blockReady 设为 true，给出可编辑的学习块草稿；不得据此断言用户已经掌握。blockSummary 写本轮要点、仍待检查的问题与下一步，不编造学习表现。不要在此 JSON 请求打开文件或写入资料。`;
export function learningResponse(result){
  if(!['completed','success',undefined].includes(result.status)||typeof result.reply!=='string')return result;
  const match=[...result.reply.matchAll(/```learnflow-next\s*\n([\s\S]{1,12000}?)\n```/g)].at(-1);
  if(!match)return result;
  try{
    const d=JSON.parse(match[1]);const suggestions=Array.isArray(d.suggestions)?d.suggestions.filter(x=>typeof x?.label==='string'&&typeof x?.prompt==='string'&&x.label.trim()&&x.prompt.trim()).slice(0,3).map(x=>({label:x.label.slice(0,45),prompt:x.prompt.slice(0,500)})):[];
    const clean=v=>typeof v==='string'?v.slice(0,6000):'';
    return {...result,reply:result.reply.replace(match[0],'').trim(),learning:{suggestions,blockReady:d.blockReady===true,blockReason:clean(d.blockReason),blockTitle:clean(d.blockTitle).slice(0,120),blockSummary:clean(d.blockSummary),source:'model'}};
  }catch{return {...result,reply:result.reply.replace(match[0],'').trim()};}
}
