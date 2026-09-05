"""Create allowlisted, reproducible delivery archives without private inputs."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'/'releases'; OUT.mkdir(parents=True,exist_ok=True)
SKIP_PARTS={'.git','.build-deps','__pycache__','dist','node_modules','source-preview'}
ROOT_FILES=['README.md','LICENSE','.gitignore','package.json','netlify.toml','双击启动学习流.cmd','交付导航.html']
DOC_FILES=['PROJECT-NAMES.md','RESEARCH.md','JUDGES-QA.md','PLATFORM-VERIFICATION.md','DEPLOYMENT.md','PLAN-SOURCE.md','DEFENSE-SCRIPT.md','DOCUMENT-QA.md','VALIDATION.md','validation-results.json','validation-script.cjs','PUBLICATION.md','BUILD.md']
SCRIPT_FILES=['start-local.ps1','launch.ps1','build-release.py','test-backend.mjs','test-backend-results.json','build-documents.py','build-deck.cjs','check-documents.py','export-slides-pdf.ps1']
def files_in(folder):
    return [p for p in (ROOT/folder).rglob('*') if p.is_file() and not any(x in SKIP_PARTS for x in p.relative_to(ROOT).parts)]
source=[]
for name in ROOT_FILES:
    if (ROOT/name).is_file():source.append(ROOT/name)
for folder in ['public','server','buddy-app','.github']:
    source+=files_in(folder)
for name in DOC_FILES:
    if (ROOT/'docs'/name).is_file():source.append(ROOT/'docs'/name)
for name in SCRIPT_FILES:
    if (ROOT/'scripts'/name).is_file():source.append(ROOT/'scripts'/name)
for name in ['docs/plan-data.json','docs/slides-data.json','output/playwright/home-desktop.png','output/brand/buddy-cat.png']:
    if (ROOT/name).is_file():source.append(ROOT/name)
source+=files_in('docs/validation-screenshots')
for folder in ['output/pdf','output/slides']:
    source.extend(p for p in (ROOT/folder).glob('LearnFlow-*') if p.suffix in ['.pdf','.pptx'])
source=sorted(set(source))
def archive(name,entries):
    with zipfile.ZipFile(OUT/name,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p,arc in entries:z.write(p,arc)
    return {'file':name,'bytes':(OUT/name).stat().st_size,'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest(),'entries':len(entries)}
records=[]
records.append(archive('learnflow-netlify-drop.zip',[(p,p.relative_to(ROOT/'public').as_posix()) for p in files_in('public')]))
records.append(archive('learnflow-open-source.zip',[(p,p.relative_to(ROOT).as_posix()) for p in source]))
bundle_entries=[(p,p.relative_to(ROOT).as_posix()) for p in source]
bundle_entries += [(p,'buddy-packages/'+p.name) for p in (ROOT/'buddy-app'/'dist').glob('*.zip')]
records.append(archive('LearnFlow-完整交付包.zip',bundle_entries))
manifest={'version':'0.1.0','archives':records,'source_files':[p.relative_to(ROOT).as_posix() for p in source],'excluded':'Private Obsidian notes, original PDF, browser records, credentials, temporary dependencies, machine-specific MCP settings'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'archives':records,'source_count':len(source)},ensure_ascii=True))
