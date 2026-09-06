// OpenAI-compatible answer stream. Never expose raw upstream errors or tool deltas.
export async function compatibleStream({base,key,model,messages,signal,onDelta}){
  const headers={'Content-Type':'application/json',Accept:'text/event-stream'};if(key)headers.Authorization=`Bearer ${key}`;
  const timer=AbortSignal.timeout(120000);const combined=signal?AbortSignal.any([signal,timer]):timer;
  let response;
  try{response=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers,body:JSON.stringify({model,messages,stream:true,stream_options:{include_usage:true}}),signal:combined,redirect:'error'});}catch(e){throw Error(signal?.aborted?'已停止生成。':'没有连上模型服务，请检查网络和接口地址。');}
  if(!response.ok)throw Error([401,403].includes(response.status)?'接口授权已失效，请重新连接。':`模型服务暂时不可用（HTTP ${response.status}）。`);
  let reply='',actualModel=model,usage={total_tokens:null,prompt_tokens:null,completion_tokens:null,source:'unavailable'};
  const update=d=>{
    if(d.error)throw Error('模型服务返回了错误，请稍后重试。');
    if(typeof d.model==='string')actualModel=d.model;
    if(d.usage){for(const k of ['total_tokens','prompt_tokens','completion_tokens'])if(Number.isInteger(d.usage[k])&&d.usage[k]>=0)usage[k]=d.usage[k];usage.source=usage.total_tokens===null?'unavailable':'provider';}
    const text=d.choices?.[0]?.delta?.content??d.choices?.[0]?.message?.content;
    if(typeof text==='string'){reply+=text;if(reply.length>200000)throw Error('回复过长，请缩小问题范围。');onDelta?.(text);}
  };
  if(!response.headers.get('content-type')?.includes('text/event-stream')){
    const text=await response.text();if(text.length>2000000)throw Error('模型服务返回内容过大。');try{update(JSON.parse(text));}catch(e){throw Error('接口没有返回可识别的回答。');}
  }else{
    const decoder=new TextDecoder();let pending='',size=0;
    const block=text=>{const data=text.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')return;let d;try{d=JSON.parse(data);}catch{throw Error('模型回复在传输时中断，请重试。');}update(d);};
    for await(const bytes of response.body){size+=bytes.length;if(size>6000000)throw Error('模型返回内容过大。');pending=(pending+decoder.decode(bytes,{stream:true})).replace(/\r\n/g,'\n');let n;while((n=pending.indexOf('\n\n'))>=0){block(pending.slice(0,n));pending=pending.slice(n+2);}if(pending.length>2000000)throw Error('模型回复格式不完整。');}
    pending+=decoder.decode();if(pending.trim())block(pending);
  }
  if(!reply.trim())throw Error('模型没有返回文字，请换个模型重试。');
  return {status:'completed',reply,usage,provider:'openai-compatible',model:actualModel};
}
