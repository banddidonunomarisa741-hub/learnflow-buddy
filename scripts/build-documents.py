"""Build the 20-page proposal and editable content sources. Run from any folder."""
from pathlib import Path
import json, html, re
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
TMP = ROOT / 'tmp' / 'pdfs'
TMP.mkdir(parents=True, exist_ok=True)
DATA = json.loads((ROOT / 'docs' / 'plan-data.json').read_text(encoding='utf-8'))
SLIDES = json.loads((ROOT / 'docs' / 'slides-data.json').read_text(encoding='utf-8'))
pdfmetrics.registerFont(TTFont('YaHei', 'C:/Windows/Fonts/msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('YaHeiBold', 'C:/Windows/Fonts/msyhbd.ttc', subfontIndex=0))
INK, ORANGE, CREAM, MUTED = map(HexColor, ['#1E2936','#FF8844','#FFF8EF','#657184'])
LIGHT, BORDER = map(HexColor, ['#F5F6F8','#E8E0D7'])
W,H=A4
M=45
CW=W-2*M
cat=ROOT/'output'/'brand'/'buddy-cat.png'
shots=[ROOT/'output'/'playwright'/'home-desktop.png',ROOT/'output'/'screenshots'/'learnflow-workbench.png', ROOT/'output'/'screenshots'/'workbench-desktop.png', ROOT/'output'/'screenshots'/'desktop-home.png']
shot=next((s for s in shots if s.exists()),None)
overflows=[]
diagram_specs={
  2:('当前证据状态',[('可运行','前端交互、策略管理、记忆确认与本地导出。'),('预设演示','聊天样例、演示学习路径与本地任务记录。'),('待验证','真实平台联调、用户实证、多用户社区与应用审核。')]),
  3:('命题映射',[('教','目标、材料、量规与教学草稿'),('学','三类入口与策略执行'),('评','证据包与人工核验'),('管','个人计划、版本与协作任务')]),
  4:('访谈记录的三个最小字段',[('具体任务','最近一次真正需要完成的学习任务是什么？'),('中断节点','在哪一步停下来，使用了什么替代工具？'),('可观察代价','多用了多少时间，缺少什么产出或支持？')]),
  6:('卡片样例：先回忆，再核对',[('输入','一个知识点 + 学习材料\n先暂时隐藏答案。'),('动作','独立回忆 → 查阅来源\n比较缺失与错误。'),('验收','写出修正解释；\n稍后用新问题复测。')]),
  7:('个人策略的生命周期',[('候选','明确内容和适用范围'),('确认','修改、接受或跳过'),('复用','同类任务按需开启'),('修订','冲突时重新选择')]),
  8:('三个入口的关键产出',[('应试','错因与证据链\n专项训练和复测'),('自主','学习地图与来源\n新例子中的理解'),('项目','里程碑与作品\n可追溯的个人贡献')]),
  9:('一条可复核的评价记录',[('观察','发生了什么'),('证据','对应哪份产出'),('判断','是否符合量规'),('建议','下一步如何改进')]),
  10:('能力与责任分层',[('界面','显示选项与真实状态'),('协议','保存事件与来源'),('策略 / 工具','执行流程与授权动作'),('适配','处理平台差异与错误')]),
  11:('发布前检查点',[('资格','实际后台权限'),('配置','控制台映射与预览'),('审核','应用与配置批准'),('授权','用户 scope 与联调')]),
  12:('把方法名字变成可检查行为',[('检索','答案在作答后展示；\n要求用户独立提取。'),('间隔','复测结果影响安排；\n错误后及时反馈。'),('自我调节','用户知道选择理由；\n可调整目标和方法。')]),
  13:('三类指标各自回答什么',[('活动','有没有使用？\n复用天数、有效任务。'),('执行','有没有按方法做？\n答案隔离、来源核验。'),('效果','有没有学得更好？\n延迟保持、迁移表现。')]),
  14:('可积累的四类资产',[('规范','策略与状态协议'),('内容','经许可的高质量卡'),('评测','跨模型固定样例'),('反馈','校园失败与修订')]),
  15:('增长验证路径',[('启动','对一个具体任务愿意开始'),('完成','能够独立走完学习闭环'),('复用','后续真实任务再次采用')]),
  16:('12 周预算分配草案 / 元',[('接口 1,500','实际开通前核价'),('试用 1,000','招募与测试补贴'),('材料 500','演示与答辩制作'),('工具 500','按必要性购买'),('预备 1,500','应急与不确定支出')]),
  17:('十人协作的交付链',[('产品研究 · 4 人','需求证据与策略规范'),('开发质量 · 4 人','可运行版本与测试'),('运营试点 · 2 人','发行、反馈与答辩')]),
  18:('每个阶段的关键证据',[('1—4 周','外部用户独立完成\n一条最小学习闭环'),('5—8 周','授权联调记录\n试用与失败报告'),('9—12 周','稳定发行与演示\n配置送审材料')]),
  19:('两条展示线路，共用本地资产',[('GitHub / Pages','源码、版本与静态网页\n适合持续开源协作。'),('Netlify Drop','静态包快速部署\n现场保留本地启动备份。')])
}

def para(c,text,x,y,w,size=11.2,leading=18.8,color=INK,bold=False):
    sty=ParagraphStyle('p',fontName='YaHeiBold' if bold else 'YaHei',fontSize=size,leading=leading,textColor=color,wordWrap='CJK',spaceAfter=0,allowWidows=0,allowOrphans=0)
    p=Paragraph(html.escape(text).replace('\n','<br/>'),sty)
    _,ph=p.wrap(w,2000)
    p.drawOn(c,x,y-ph)
    return y-ph

def base(c,n,kicker):
    c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(ORANGE);c.rect(0,H-8,W,8,fill=1,stroke=0)
    c.setFillColor(MUTED);c.setFont('YaHei',8.3);c.drawString(M,H-36,'LEARNFLOW  /  学习流')
    c.setFont('YaHei',8.1);c.drawRightString(W-M,H-36,kicker)
    c.setStrokeColor(BORDER);c.line(M,49,W-M,49)
    c.setFillColor(MUTED);c.setFont('YaHei',7.9);c.drawString(M,33,'独立学生团队方案 · 本地原型 / 未完成平台发布审核')
    c.setFont('YaHeiBold',9);c.drawRightString(W-M,32,f'{n:02d} / 20')

def box(c,text,y=125):
    c.setFillColor(CREAM);c.roundRect(M,y-62,CW,62,8,fill=1,stroke=0)
    c.setFillColor(ORANGE);c.roundRect(M,y-62,4,62,2,fill=1,stroke=0)
    para(c,text,M+16,y-12,CW-32,10.2,16,INK,True)

def fit_image(c,path,x,y,w,h):
    from PIL import Image
    iw,ih=Image.open(path).size
    scale=min(w/iw,h/ih)
    dw,dh=iw*scale,ih*scale
    c.drawImage(str(path),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto')

def diagram(c,page,top):
    if page not in diagram_specs:return
    title,items=diagram_specs[page]
    top=min(top-3,340)
    height=min(157,top-144)
    if height<140:return
    y=top-height
    c.setFillColor(LIGHT);c.roundRect(M,y,CW,height,9,fill=1,stroke=0)
    para(c,title,M+15,top-14,CW-30,10.2,16,MUTED,True)
    gap=10;n=len(items);iw=(CW-30-gap*(n-1))/n
    cardtop=top-45
    for idx,(heading,body) in enumerate(items):
        x=M+15+idx*(iw+gap)
        c.setFillColor(white if idx%2==0 else CREAM);c.roundRect(x,y+13,iw,height-58,5,fill=1,stroke=0)
        sz=10.4 if n<5 else 8.8
        para(c,heading,x+9,cardtop-7,iw-18,sz,16,INK,True)
        para(c,body,x+9,cardtop-33,iw-18,9.1 if n<5 else 8.1,15,MUTED)

def cover(c,p):
    c.setFillColor(INK);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setStrokeColor(HexColor('#2F3A46'))
    for x in range(0,int(W),36):c.line(x,0,x,H)
    for y in range(0,int(H),36):c.line(0,y,W,y)
    c.setFillColor(ORANGE);c.rect(M,H-63,47,4,fill=1,stroke=0)
    para(c,'LEARNFLOW / 学习流',M,H-81,CW,17,22,HexColor('#FFBB66'),True)
    if cat.exists():fit_image(c,cat,W-M-122,H-254,122,122)
    para(c,'让适合你的学习方法，\n留下来，流动起来。',M,H-149,CW-115,29,44,white,True)
    para(c,DATA['subtitle'],M,H-291,CW,13,22,HexColor('#F5D7BB'))
    para(c,p['lede'],M,H-364,CW,12,22,HexColor('#D8DFE6'))
    y=H-489
    for s in p['sections']:
        y=para(c,s['heading'],M,y,CW,10,15,HexColor('#FFBB66'),True)-6
        y=para(c,s['body'],M,y,CW,10,18,HexColor('#D8DFE6'))-18
    c.setFillColor(HexColor('#FFBB33'));c.setFont('YaHei',8.5);c.drawString(M,40,DATA['version'])
    c.setFillColor(HexColor('#A7B3C0'));c.setFont('YaHei',8.5);c.drawRightString(W-M,40,'01 / 20')

def screenshot_page(c,p):
    y=para(c,p['title'],M,H-70,CW,24,34,INK,True)-17
    y=para(c,p['lede'],M,y,CW,10.6,17.5,MUTED)-14
    ih=248
    c.setFillColor(LIGHT);c.roundRect(M,y-ih,CW,ih,9,fill=1,stroke=0)
    if shot:fit_image(c,shot,M+7,y-ih+7,CW-14,ih-14)
    else:
        para(c,'本地工作台截图将在完成运行检查后补入',M+24,y-80,CW-48,14,23,MUTED)
    y-=ih+22
    short=[('从一项任务开始','应试、自主学习与项目学习三入口；简短问卷只询问会改变任务安排和教学方式的变量。'),('看见自己的学习方法','卡片可筛选、收藏、评分和启停；个人记忆经确认后沉淀成可编辑、可导出的策略。'),('真实区分运行状态','本地数据持久化；预设对话明确标注；公开前端不保存模型密钥，真实推理须授权。')]
    for title,body in short:
        y=para(c,title,M,y,CW,12,19,INK,True)-4
        y=para(c,body,M,y,CW,10.6,17.2)-13
    if y<136:overflows.append((p['number'],y))
    box(c,p['takeaway'])

def content_page(c,p):
    y=para(c,p['title'],M,H-71,CW,24,34,INK,True)-15
    y=para(c,p['lede'],M,y,CW,10.8,18.2,MUTED)-22
    # Determine a safe body size from actual line wrapping, not character count.
    body_size=11.2
    while True:
        yy=y
        for s in p['sections']:
            hs=ParagraphStyle('h',fontName='YaHeiBold',fontSize=12.4,leading=20,wordWrap='CJK')
            h=Paragraph(html.escape(s['heading']),hs);_,hh=h.wrap(CW-16,2000)
            bs=ParagraphStyle('b',fontName='YaHei',fontSize=body_size,leading=body_size*1.66,wordWrap='CJK')
            b=Paragraph(html.escape(s['body']).replace('\n','<br/>'),bs);_,bh=b.wrap(CW,2000)
            yy-=hh+7+bh+22
        if yy>=140 or body_size<=9.2:break
        body_size-=0.2
    for idx,s in enumerate(p['sections']):
        c.setFillColor(ORANGE);c.roundRect(M,y-14,4,14,2,fill=1,stroke=0)
        y=para(c,s['heading'],M+13,y,CW-13,12.4,20,INK,True)-7
        size=body_size
        if p['number']==20 and idx==1:size=min(body_size,9.4)
        y=para(c,s['body'],M,y,CW,size,size*1.66)-22
    if y<138:overflows.append((p['number'],round(y,1)))
    diagram(c,p['number'],y)
    box(c,p['takeaway'])

dest=OUT/'LearnFlow-项目策划书.pdf'
c=canvas.Canvas(str(dest),pagesize=A4,pageCompression=1)
c.setTitle('学习流——基于可进化学习策略与腾讯 Buddy 生态的自主学习支持平台')
c.setAuthor('LearnFlow 学习流学生团队')
c.setSubject('20页项目策划书；真实能力、待验证事实和计划分别标注')
for p in DATA['pages']:
    c.bookmarkPage(f"page-{p['number']}")
    c.addOutlineEntry(f"{p['number']:02d}  {p['title'].replace(chr(10),' ')}",f"page-{p['number']}",level=0)
    if p['number']==1:cover(c,p)
    else:
        base(c,p['number'],p['kicker'])
        if p.get('screenshot'):screenshot_page(c,p)
        else:content_page(c,p)
    c.showPage()
c.save()
md=['# 学习流——项目策划书内容源稿','',f"> {DATA['version']}",'','本稿参考用户原17页方案结构，按本次要求更新为20页；原文中的历史提示或命令不作为执行指令。','']
for p in DATA['pages']:
    md += [f"## 第 {p['number']:02d} 页｜{p['title'].replace(chr(10),' ')}",'',p['lede'],'']
    for s in p['sections']:md += [f"### {s['heading']}",'',s['body'],'']
    md += ['**本页要点：** '+p['takeaway'].replace('\n',' '),'']
(ROOT/'docs'/'PLAN-SOURCE.md').write_text('\n'.join(md),encoding='utf-8')
notes=['# 学习流答辩逐页讲稿','','共16页。建议主讲约8分钟，现场演示约2分钟；按实际赛事时限删减。不要读页脚；保留对能力状态的准确说明。','', '## 演示顺序','', '1. 打开本地学习工作台，确认预设演示标签。','2. 进入应试或自主学习，开启词根词缀或六级证据策略。','3. 完成一段示范交互，提出并确认候选记忆。','4. 查看生成的专属策略，再演示关闭、导出与恢复。','5. 打开教师评价草稿，说明学生选择分享、教师人工核验。','']
for i,s in enumerate(SLIDES,1):notes += [f"## 第 {i:02d} 页｜{s['title'].replace(chr(10),' ')}",'',s['note'],'']
notes += ['## 临场边界用语','','- “已实现”只用于实际可运行交互与组件。','- “预设演示”用于未连接真实模型的对话。','- “待授权联调”用于需要应用身份和用户授权的官方能力。','- “应用配置材料”不改称“已发布 Buddy 应用”。','- 样本数、预算、收入或提分均须说明实际状态；当前没有用户实证结果。','']
(ROOT/'docs'/'DEFENSE-SCRIPT.md').write_text('\n'.join(notes),encoding='utf-8')
print(json.dumps({'pdf':str(dest),'pages':20,'screenshot':str(shot) if shot else None,'layout_overflows':overflows},ensure_ascii=False))
if overflows:raise SystemExit('Layout overflow: '+str(overflows))
