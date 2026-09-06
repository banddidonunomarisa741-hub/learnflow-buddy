/* Model text is untrusted. No HTML, embedded images or executable URLs are accepted. */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function inline(text) {
    const tokens=[];
    const hold=html=>{tokens.push(html);return '\u0000'+(tokens.length-1)+'\u0000';};
    let value=String(text).replace(/\u0000/g,'');
    value=value.replace(/`([^`\n]+)`/g,(_,code)=>hold('<code>'+esc(code)+'</code>'));
    value=value.replace(/!?\[([^\]\n]+)\]\(([^\s)]+)\)/g,(all,label,url)=>{
      try { const u=new URL(url); if(!['https:','http:'].includes(u.protocol))return label;return hold(`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`); } catch{return label;}
    });
    value=esc(value).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/~~([^~\n]+)~~/g,'<s>$1</s>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
    return value.replace(/\u0000(\d+)\u0000/g,(_,n)=>tokens[Number(n)]||'');
  }
  const cells=line=>line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));
  const tableRule=line=>line.includes('|')&&cells(line).every(x=>/^:?-{3,}:?$/.test(x));
  function render(text) {
    const lines=String(text??'').replace(/\r\n?/g,'\n').split('\n'),out=[];
    let i=0;
    while(i<lines.length){
      const line=lines[i];
      if(!line.trim()){i++;continue;}
      const fence=line.match(/^\s*(`{3,}|~{3,})([^\s`]*)/);
      if(fence){const code=[];i++;while(i<lines.length&&!lines[i].trim().startsWith(fence[1]))code.push(lines[i++]);if(i<lines.length)i++;out.push(`<div class="code-block"><div class="code-head"><span>${esc(fence[2]||'代码')}</span><button type="button" data-copy-code>复制代码</button></div><pre><code>${esc(code.join('\n'))}</code></pre></div>`);continue;}
      if(i+1<lines.length&&line.includes('|')&&tableRule(lines[i+1])){const headers=cells(line),rules=cells(lines[i+1]);i+=2;const rows=[];while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(cells(lines[i++]));const cell=(v,n,tag)=>`<${tag}${tag==='th'?' scope="col"':''} style="text-align:${rules[n]?.endsWith(':')?(rules[n]?.startsWith(':')?'center':'right'):'left'}">${inline(v||'')}</${tag}>`;out.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="回答中的表格"><table><thead><tr>${headers.map((x,n)=>cell(x,n,'th')).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${headers.map((_,n)=>cell(row[n],n,'td')).join('')}</tr>`).join('')}</tbody></table></div>`);continue;}
      const h=line.match(/^(#{1,6})\s+(.+)/);if(h){const level=Math.min(6,h[1].length+1);out.push(`<h${level}>${inline(h[2])}</h${level}>`);i++;continue;}
      if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){out.push('<hr>');i++;continue;}
      if(/^>\s?/.test(line)){const q=[];while(i<lines.length&&/^>\s?/.test(lines[i]))q.push(lines[i++].replace(/^>\s?/,''));out.push('<blockquote>'+q.map(inline).join('<br>')+'</blockquote>');continue;}
      const list=line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)/);
      if(list){const ordered=!!list[2],items=[];while(i<lines.length){const item=lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)/);if(!item||!!item[2]!==ordered)break;items.push('<li>'+inline(item[3])+'</li>');i++;}const tag=ordered?'ol':'ul';out.push(`<${tag}${ordered?' start="'+Number(list[2])+'"':''}>${items.join('')}</${tag}>`);continue;}
      const p=[inline(line)];i++;while(i<lines.length&&lines[i].trim()&&!/^\s*(#{1,6}\s|`{3,}|~{3,}|>|[-*+]\s|\d+[.)]\s)/.test(lines[i])&&!(i+1<lines.length&&tableRule(lines[i+1])))p.push(inline(lines[i++]));out.push('<p>'+p.join('<br>')+'</p>');
    }
    return out.join('');
  }
  // A split chunk must not briefly reveal the model's structured follow-up metadata.
  function visibleStream(text){return String(text).replace(/```\s*learnflow-next[\s\S]*$/i,'').replace(/```\s*(?:l(?:e(?:a(?:r(?:n(?:f(?:l(?:o(?:w(?:-(?:n(?:e(?:x(?:t)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/i,'');}
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;try{await navigator.clipboard.writeText(b.closest('.code-block').querySelector('code').textContent);b.textContent='已复制';setTimeout(()=>b.textContent='复制代码',1800);}catch{b.textContent='请选中代码复制';}});
  window.LearnFlowText={render,visibleStream};
})();
