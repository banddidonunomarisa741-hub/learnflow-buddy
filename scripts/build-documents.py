"""Build a continuous, restrained solution document, separate from the slide deck."""
from pathlib import Path
import json,html
from reportlab.platypus import BaseDocTemplate,PageTemplate,Frame,Paragraph,Spacer,PageBreak,Table,TableStyle,KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'docs/plan-data.json').read_text('utf8'))
OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Body','C:/Windows/Fonts/simsun.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('Head','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
TITLE='LearnFlow学习流动'
SUB=DATA['subtitle']
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=11.5,leading=23,spaceAfter=9,firstLineIndent=23,wordWrap='CJK',textColor=colors.HexColor('#222222')),
 'h1':ParagraphStyle('h1',fontName='Head',fontSize=15,leading=25,spaceBefore=20,spaceAfter=12,keepWithNext=True,wordWrap='CJK'),
 'h2':ParagraphStyle('h2',fontName='Head',fontSize=11.8,leading=22,spaceBefore=10,spaceAfter=5,keepWithNext=True,wordWrap='CJK'),
 'small':ParagraphStyle('small',fontName='Body',fontSize=10,leading=18,spaceAfter=7,wordWrap='CJK'),
 'cover':ParagraphStyle('cover',fontName='Head',fontSize=27,leading=40,spaceAfter=18,wordWrap='CJK'),
 'subtitle':ParagraphStyle('subtitle',fontName='Head',fontSize=15,leading=27,spaceAfter=25,wordWrap='CJK'),
}
def para(text,style='body'):return Paragraph(html.escape(text).replace('\n','<br/>'),styles[style])
class Document(BaseDocTemplate):
 def afterFlowable(self,f):
  if isinstance(f,Paragraph) and f.style.name=='h1':
   text=f.getPlainText();key='section-'+str(self.seq.nextf('section'));self.canv.bookmarkPage(key);self.canv.addOutlineEntry(text,key,0);self.notify('TOCEntry',(0,text,self.page,key))
def footer(c,d):
 c.saveState();c.setFont('Body',8.5);c.setFillColor(colors.HexColor('#666666'))
 if d.page>1:c.drawString(58,813,TITLE+' · 项目解决方案');c.drawRightString(537,30,str(d.page))
 c.restoreState()
dest=OUT/'LearnFlow学习流动-项目解决方案.pdf'
doc=Document(str(dest),pagesize=A4,leftMargin=58,rightMargin=58,topMargin=58,bottomMargin=48,title=TITLE+'——'+SUB,author=TITLE+'学生团队')
doc.addPageTemplates(PageTemplate(id='main',frames=[Frame(58,48,479,736,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=footer))
story=[Spacer(1,32),para(TITLE,'cover'),para('——'+SUB,'subtitle'),para('项目解决方案','h1'),Spacer(1,15)]
rows=[['参赛方向','中国国际大学生创新大赛 · 产业赛道'],['命题企业','腾讯科技（深圳）有限公司'],['申报单位','中国地质大学（北京）独立学生团队'],['项目阶段','已运行原型；正式平台应用身份尚待审核'],['文档版本',DATA['version']]]
t=Table([[para(a,'small'),para(b,'small')] for a,b in rows],colWidths=[88,391],hAlign='LEFT');t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#cccccc')),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]));story += [t,Spacer(1,25),para('摘要','h2'),para('本方案以学习者为中心，将可进化的学习策略、逐题学习路线、对话后的可选择行动、经确认的学习块与可再次打开的资料组合成连续的自主学习支持过程。项目以大学生可触达的真实学习任务为初期验证对象，开源发布前端与策略组件，并面向腾讯 Buddy 生态准备应用材料。'),para('本版区分已实现能力、单机联调结果和后续计划。已跑通的本机 CodeBuddy 通道不等于 LearnBuddy 原生 API；正式 OAuth 与 Buddy 应用上架仍以平台审核和真实联调为准。使用量不代表学习效果，所有效果主张均须另行验证。'),PageBreak(),para('目录','cover')]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Body',fontSize=10.3,leading=17,spaceBefore=3,wordWrap='CJK')];story += [toc,PageBreak()]
md=['# '+TITLE+'——'+SUB,'','## 项目解决方案','']
for n,p in enumerate(DATA['pages'][1:],1):
 title=p['title'].replace('\n',' ');story.append(para(f'{n}　{title}','h1'));story.append(para(p['lede']));md += ['## '+str(n)+' '+title,'',p['lede'],'']
 for j,s in enumerate(p['sections'],1):
  story.append(para(f'{n}.{j}　'+s['heading'],'h2'))
  for body in s['body'].split('\n'):
   if body.strip():story.append(para(body))
  md += ['### '+s['heading'],'',s['body'],'']
 # Integrate the point in prose; no graphic banners or forced chapter page breaks.
 if p.get('takeaway'):story.append(para(p['takeaway'].replace('\n',' '),'small'))
doc.multiBuild(story)
(ROOT/'docs/PLAN-SOURCE.md').write_text('\n'.join(md),'utf8')
print(json.dumps({'pdf':str(dest),'layout':'continuous body text; no decorative cards'},ensure_ascii=False))
