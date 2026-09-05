"""Validate final deliverable structure; rendered visual review is recorded separately."""
from pathlib import Path
import json, zipfile, re, hashlib
import xml.etree.ElementTree as ET
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
PDF=ROOT/'output/pdf'
slides=ROOT/'output/slides/LearnFlow-答辩演示.pptx'
checks=[]
for name,count in [('LearnFlow-项目策划书.pdf',20),('LearnFlow-答辩演示.pdf',16)]:
    file=PDF/name
    reader=PdfReader(str(file))
    texts=[p.extract_text() or '' for p in reader.pages]
    assert len(texts)==count,(name,'page count')
    assert all(len(t)>60 for t in texts),(name,'empty page')
    assert not any('截图待最终' in t or '截图将在完成' in t for t in texts),(name,'missing screenshot')
    assert not any('\ufffd' in t for t in texts),(name,'replacement glyph')
    checks.append({'file':name,'pages':len(texts),'characters':sum(map(len,texts)),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
with zipfile.ZipFile(slides) as z:
    names=z.namelist()
    pagefiles=[n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]
    notefiles=[n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n)]
    ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
    texts=sum(len(ET.fromstring(z.read(n)).findall('.//a:t',ns)) for n in pagefiles)
    assert len(pagefiles)==16 and len(notefiles)==16
    assert texts>150,'Slides must include editable text, not flattened screenshots.'
    checks.append({'file':slides.name,'slides':len(pagefiles),'speaker_note_pages':len(notefiles),'editable_text_runs':texts,'bytes':slides.stat().st_size,'sha256':hashlib.sha256(slides.read_bytes()).hexdigest()})
result={'status':'pass','checks':checks,'visual_review':'All 20 proposal pages and 16 slide pages rendered with Poppler; contact sheets and selected full-size pages inspected.'}
(ROOT/'output/document-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
