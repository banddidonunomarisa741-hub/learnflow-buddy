"""Create allowlisted, reproducible delivery archives without private inputs."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'/'releases'; OUT.mkdir(parents=True,exist_ok=True)
SKIP_PARTS={'.git','.build-deps','__pycache__','dist','node_modules','source-preview'}
ROOT_FILES=['最新交付清单.md','README.md','LICENSE','.gitignore','package.json','netlify.toml','双击启动学习流动.cmd','安装连接助手.cmd','交付导航.html']
ROOT_FILES += ['安装LearnBuddy插件.cmd']
DOC_FILES=['CHAT-UPGRADE.md','LEARNING-EXPERIENCE.md','PROJECT-NAMES.md','RESEARCH.md','JUDGES-QA.md','PLATFORM-VERIFICATION.md','DEPLOYMENT.md','PLAN-SOURCE.md','DEFENSE-SCRIPT.md','DOCUMENT-QA.md','VALIDATION.md','validation-results.json','validation-script.cjs','PUBLICATION.md','BUILD.md']
DOC_FILES += ['MVP-UPGRADE.md','GLOSSARY.md','COPY-GUIDE.md','BUDDY-LAUNCH-ROADMAP.md','LEARNBUDDY-INSTALL.md','BUDDY-RELEASE-CHECKLIST.md','TENCENT-CONNECTORS.md','MVP-VALIDATION.md']
SCRIPT_FILES=['test-chat-inputs.mjs','test-pairing.mjs','test-learning-assets.mjs','install-connector.ps1','start-local.ps1','launch.ps1','build-release.py','test-backend.mjs','test-backend-results.json','build-documents.py','build-deck.cjs','check-documents.py','export-slides-pdf.ps1']
SCRIPT_FILES += ['test-chat-stream.mjs','test-qq-connector.mjs','test-qq-http.mjs','test-learnbuddy.mjs','install-learnbuddy.ps1']
SCRIPT_FILES += ['test-rich-text.mjs','test-buddy-library.mjs']
SCRIPT_FILES += ['test-buddy-host.mjs']
DOC_FILES += ['MVP-WEB-VALIDATION.md']
def files_in(folder):
    return [p for p in (ROOT/folder).rglob('*') if p.is_file() and not any(x in SKIP_PARTS for x in p.relative_to(ROOT).parts)]
# Self-contained helper; exclude its own downloadable archive from its payload.
connector=ROOT/'public/downloads/learnflow-connector.zip'
connector.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(connector,'w',compression=zipfile.ZIP_DEFLATED) as z:
    payload=[p for p in files_in('public') if 'downloads' not in p.relative_to(ROOT/'public').parts]
    payload+=files_in('server')
    payload += [ROOT/'scripts/launch.ps1',ROOT/'scripts/install-connector.ps1',ROOT/'安装连接助手.cmd']
    for p in payload:z.write(p,p.relative_to(ROOT).as_posix())
source=[]
for name in ROOT_FILES:
    if (ROOT/name).is_file():source.append(ROOT/name)
for folder in ['public','server','buddy-app','.github']:
    source+=files_in(folder)
for name in DOC_FILES:
    if (ROOT/'docs'/name).is_file():source.append(ROOT/'docs'/name)
for name in SCRIPT_FILES:
    if (ROOT/'scripts'/name).is_file():source.append(ROOT/'scripts'/name)
for name in ['docs/plan-data.json','docs/slides-data.json','output/playwright/home-desktop.png','output/brand/learnflow-logo.png']:
    if (ROOT/name).is_file():source.append(ROOT/name)
for name in ['home-mobile.png','learnflow-model-menu.png','learnflow-real-reply.png','netlify-live-answer.png','ux-verification.json','installed-web-resource-check.json','installed-web-browser-check.json']:
    if (ROOT/'output/playwright'/name).is_file():source.append(ROOT/'output/playwright'/name)
for name in ['desktop-restored-session.png','memory-preserved.png','imported-html-as-text.png','mobile-home-390.png','mobile-navigation-390.png','mobile-market-390.png']:
    if (ROOT/'docs/validation-screenshots'/name).is_file():source.append(ROOT/'docs/validation-screenshots'/name)
# Historical screenshots are not distributed; use current product captures.
for folder in ['output/pdf','output/slides']:
    source.extend(p for p in (ROOT/folder).glob('LearnFlow学习流动-*-1.4.*') if p.suffix in ['.pdf','.pptx'])
source=sorted(set(source))
catalogue=ROOT/'docs/FILE-CATALOG.json'
catalogue.write_text(json.dumps({'version':'1.4.2','source_files':[p.relative_to(ROOT).as_posix() for p in source],'buddy_packages':[p.name for p in (ROOT/'buddy-app/dist').glob('*.zip')],'note':'Source list excludes this catalogue. Buddy ZIP packages are included in the complete delivery archive; build them from source for the source-only archive.'},ensure_ascii=False,indent=2),encoding='utf-8')
source.append(catalogue)
def archive(name,entries):
    with zipfile.ZipFile(OUT/name,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p,arc in entries:z.write(p,arc)
    return {'file':name,'bytes':(OUT/name).stat().st_size,'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest(),'entries':len(entries)}
records=[]
records.append(archive('learnflow-netlify-drop.zip',[(p,p.relative_to(ROOT/'public').as_posix()) for p in files_in('public')]))
records.append(archive('learnflow-open-source.zip',[(p,p.relative_to(ROOT).as_posix()) for p in source]))
bundle_entries=[(p,p.relative_to(ROOT).as_posix()) for p in source]
bundle_entries += [(p,'buddy-packages/'+p.name) for p in (ROOT/'buddy-app'/'dist').glob('*.zip')]
marketplace=ROOT/'buddy-app/dist/learnflow-marketplace'
if marketplace.is_dir():
    bundle_entries += [(p,p.relative_to(ROOT).as_posix()) for p in marketplace.rglob('*') if p.is_file()]
records.append(archive('LearnFlow-完整交付包.zip',bundle_entries))
manifest={'version':'1.4.2','archives':records,'source_files':[p.relative_to(ROOT).as_posix() for p in source],'excluded':'Private Obsidian notes, original PDF, browser records, credentials, temporary dependencies, machine-specific MCP settings'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'archives':records,'source_count':len(source)},ensure_ascii=True))
