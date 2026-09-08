"""Build the web and local-connector release with an explicit file allowlist."""
from pathlib import Path
import json,zipfile,hashlib
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text(encoding='utf-8-sig'))['version']
out=root/'output/releases';out.mkdir(parents=True,exist_ok=True)
def files(folder):
 return sorted(p for p in (root/folder).rglob('*') if p.is_file() and not any(s in p.parts for s in ['node_modules','__pycache__']))
def zip_to(target,entries):
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p,name in entries:z.write(p,name)
 return {'file':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
web=[p for p in files('public') if 'downloads' not in p.relative_to(root/'public').parts]
service=files('server')
helper=web+service+[root/p for p in ['package.json','LICENSE','scripts/launch.ps1','scripts/install-connector.ps1','安装连接助手.cmd','docs/TEACHER-CONNECTION-1.7.md','docs/PROJECTS-MOTION-1.8.md']]
zip_to(root/'public/downloads/learnflow-connector.zip',[(p,p.relative_to(root).as_posix()) for p in helper])
static=files('public')
records=[zip_to(out/'learnflow-netlify-drop.zip',[(p,p.relative_to(root/'public').as_posix()) for p in static])]
full=static+service+[root/p for p in ['package.json','README.md','最新交付清单.md','LICENSE','netlify.toml','双击启动学习流动.cmd','安装连接助手.cmd','scripts/start-local.ps1','scripts/launch.ps1','scripts/install-connector.ps1','scripts/build-web-release.py','docs/CHAT-FIRST-1.5.md','docs/CARD-GALLERY-1.6.md','docs/TEACHER-CONNECTION-1.7.md','docs/PROJECTS-MOTION-1.8.md']]
records.append(zip_to(out/f'LearnFlow学习流动-网页MVP-{version}.zip',[(p,p.relative_to(root).as_posix()) for p in full]))
(out/'web-release-manifest.json').write_text(json.dumps({'version':version,'archives':records,'source_files':[p.relative_to(root).as_posix() for p in full]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'version':version,'archives':records},ensure_ascii=False))
