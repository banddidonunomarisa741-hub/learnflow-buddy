/** Generate an editable 16-slide PPTX using the bundled pptxgenjs runtime. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const modules = process.env.CODEX_NODE_MODULES || path.join(root, 'node_modules');
const pptxgen = require(path.join(modules, 'pptxgenjs'));
const sharp = require(path.join(modules, 'sharp'));
const data = JSON.parse(fs.readFileSync(path.join(root,'docs/slides-data.json'),'utf8'));
const out = path.join(root,'output/slides');fs.mkdirSync(out,{recursive:true});
const brand = path.join(root,'output/brand');fs.mkdirSync(brand,{recursive:true});
const cat = path.join(brand,'learnflow-logo.png');
const C={ink:'1E2936',muted:'657184',orange:'FF8844',gold:'FFBB33',cream:'FFF8EF',white:'FFFFFF',line:'E8E0D7',panel:'F5F6F8'};
const pptx = new pptxgen();
pptx.layout='LAYOUT_WIDE';pptx.author='LearnFlow学习流动学生团队';pptx.subject='本地原型与 Buddy 应用配置材料';pptx.title='LearnFlow学习流动——基于可进化学习策略与腾讯 Buddy 生态的自主学习支持平台';pptx.company='独立学生团队';pptx.lang='zh-CN';
pptx.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei',lang:'zh-CN'};
function text(s,t,x,y,w,h,fs=20,color=C.ink,bold=false,opts={}){s.addText(t,{x,y,w,h,fontFace:'Microsoft YaHei',fontSize:fs,color,bold,margin:0,breakLine:false,vertAlign:'mid',fit:'shrink',...opts});}
function rect(s,x,y,w,h,fill,rad=true,line=fill){s.addShape(rad?pptx.ShapeType.roundRect:pptx.ShapeType.rect,{x,y,w,h,rectRadius:.12,radius:.12,line:{color:line,width:.6},fill:{color:fill}});}
function base(d,i,dark=false){const s=pptx.addSlide();s.background={color:dark?C.ink:C.white};if(dark){for(let x=0;x<13.34;x+=.4)s.addShape(pptx.ShapeType.line,{x,y:0,w:0,h:7.5,line:{color:'2A3643',width:.3}});for(let y=0;y<7.51;y+=.4)s.addShape(pptx.ShapeType.line,{x:0,y,w:13.34,h:0,line:{color:'2A3643',width:.3}});}rect(s,.65,.42,.43,.05,C.orange,false);text(s,d.eyebrow,1.25,.31,10.8,.28,10.5,dark?'FFD0AA':C.muted,true,{charSpacing:1.1});if(!['cover','closing'].includes(d.kind)){text(s,d.title,.65,.98,12.05,.63,30.5,dark?C.white:C.ink,true);text(s,d.subtitle,.68,1.77,11.95,.46,15.5,dark?'CFD7E1':C.muted);}text(s,'LEARNFLOW / 学习流动',.65,7.08,6,.2,8.5,dark?'AAB7C5':C.muted);text(s,`${String(i+1).padStart(2,'0')} / 16`,11.55,7.06,1.1,.22,9,dark?'AAB7C5':C.muted,false,{align:'right'});if(d.footer)text(s,d.footer,.67,6.69,11.98,.27,9.6,dark?'BAC6D2':C.muted);s.addNotes(d.note);return s;}
function cards(s,d){const n=d.cards.length,g=.27,w=(12.03-(n-1)*g)/n;d.cards.forEach((a,k)=>{const x=.65+k*(w+g);rect(s,x,2.73,w,3.24,k===1?C.cream:C.panel);text(s,`0${k+1}`,x+.25,2.98,w-.5,.3,12,C.orange,true);text(s,a[0],x+.25,3.49,w-.5,.52,23,C.ink,true);text(s,a[1],x+.25,4.31,w-.5,1.25,20,C.muted,false,{breakLine:false,paraSpaceAfterPt:10});});}
function steps(s,steps){const n=steps.length,g=.23,w=(12.02-(n-1)*g)/n;steps.forEach((v,k)=>{let x=.65+k*(w+g);rect(s,x,3.08,w,1.56,k===n-1?C.ink:C.cream);text(s,`0${k+1}`,x+.17,3.29,w-.34,.24,10.5,k===n-1?C.gold:C.orange,true);text(s,v,x+.17,3.83,w-.34,.45,n===6?18.5:19,k===n-1?C.white:C.ink,true,{align:'center'});if(k<n-1)text(s,'›',x+w+.045,3.68,.15,.4,24,C.orange,true);});text(s,'完成之后回到下一次学习，带着已经确认的策略继续。',.9,5.22,11.6,.42,18,C.muted,false,{align:'center'});}

(async()=>{
await sharp(path.join(root,'public/assets/learnflow-logo.svg')).resize(640,640).png().toFile(cat);
const screenshotCandidates=[path.join(root,'output/playwright/home-desktop.png'),...['learnflow-workbench.png','workbench-desktop.png','desktop-home.png'].map(n=>path.join(root,'output/screenshots',n))];
const screenshot=screenshotCandidates.find(p=>fs.existsSync(p));
let screenshotSize=null;
if(screenshot){const m=await sharp(screenshot).metadata();const scale=Math.min(6.7/m.width,4.65/m.height);screenshotSize={x:.71+(6.7-m.width*scale)/2,y:2.31+(4.65-m.height*scale)/2,w:m.width*scale,h:m.height*scale};}
data.forEach((d,i)=>{let s=base(d,i,['cover','closing','architecture'].includes(d.kind));
if(d.kind==='cover'){s.addImage({path:cat,x:10.05,y:1.35,w:2.35,h:2.35});text(s,d.title,.7,1.45,9.1,.96,40,C.white,true);text(s,d.subtitle,.75,2.78,9.5,1.46,31,C.white,true);text(s,'基于可进化学习策略与腾讯 Buddy 生态的自主学习支持平台',.76,4.61,11.9,.45,17,'FFCC9B');d.chips.forEach((t,k)=>{rect(s,.76+k*3.53,5.63,3.22,.5,'2F3B48');text(s,t,.93+k*3.53,5.71,2.9,.28,14,'FFE2CB',true,{align:'center'});});text(s,'中国地质大学（北京） · 独立学生团队 · 2026.09',.77,6.4,11,.28,11,'B9C4CE');}
else if(d.kind==='closing'){s.addImage({path:cat,x:10.43,y:1.25,w:1.6,h:1.6});text(s,d.title,.78,1.71,10.8,1.66,38,C.white,true);text(s,d.subtitle,.82,3.89,10.4,1.17,23,'D5DDE6');d.chips.forEach((t,k)=>text(s,t,.84+k*4,5.79,3.8,.48,17,'FFBD87',true));}
else if(d.kind==='cards')cards(s,d);
else if(d.kind==='flow')steps(s,d.steps);
else if(d.kind==='example'){d.steps.forEach((t,k)=>{const y=2.54+k*.82;rect(s,.68,y,11.96,.64,k%2?C.cream:C.panel);rect(s,.88,y+.11,.42,.42,k===3?C.ink:C.orange);text(s,String(k+1),.91,y+.17,.36,.24,13,C.white,true,{align:'center'});text(s,t,1.55,y+.14,10.5,.35,20,C.ink,k===3);});}
else if(d.kind==='architecture'){d.layers.forEach((a,k)=>{const y=2.52+k*.86;rect(s,.69,y,11.93,.68,'2A3745');rect(s,.69,y,2.59,.68,k===3?C.orange:'344353');text(s,a[0],.93,y+.18,2.1,.3,18,C.white,true);text(s,a[1],3.59,y+.18,8.66,.31,18.5,k===3?'FFD2AF':'D8E0E9');});}
else if(d.kind==='comparison'){d.rows.forEach((a,k)=>{const y=2.66+k*1.05;rect(s,.68,y,11.96,.84,k===1?C.cream:C.panel);text(s,a[0],.98,y+.24,2.2,.35,20,C.ink,true);text(s,a[1],3.29,y+.25,8.98,.36,19.5,C.muted);});}
else if(d.kind==='timeline'){d.phases.forEach((a,k)=>{let x=.7+k*4.04;rect(s,x,2.65,3.77,2.32,k===1?C.cream:C.panel);text(s,a[0],x+.23,2.97,3.31,.44,24,C.orange,true);text(s,a[1],x+.23,3.75,3.31,.91,20,C.ink);});d.routes.forEach((r,k)=>{rect(s,.7+k*6.09,5.53,5.86,.59,k===0?C.ink:C.cream);text(s,r,.92+k*6.09,5.69,5.4,.28,15.5,k===0?C.white:C.ink,true);});}
else if(d.kind==='screenshot'){rect(s,.65,2.27,6.82,4.73,C.panel,true,C.line);if(screenshot)s.addImage({path:screenshot,...screenshotSize});else text(s,'本地工作台截图待最终运行检查',1.2,3.91,5.8,.65,24,C.muted);d.cards.forEach((a,k)=>{const y=2.55+k*1.37;rect(s,7.86,y,4.79,1.16,k===0?C.cream:C.panel);text(s,a[0],8.13,y+.17,4.25,.31,19,C.orange,true);text(s,a[1],8.13,y+.64,4.25,.32,17,C.ink);});}
});
const dest=path.join(out,'LearnFlow学习流动-答辩演示.pptx');await pptx.writeFile({fileName:dest});console.log(JSON.stringify({pptx:dest,slides:data.length,screenshot:screenshot||null}));
})();

