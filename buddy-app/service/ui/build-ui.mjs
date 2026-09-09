import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const file=name=>new URL(name,import.meta.url);
const [template,css,js,logo]=await Promise.all([readFile(file('workspace.template.html'),'utf8'),readFile(file('style.css'),'utf8'),readFile(file('workspace.js'),'utf8'),readFile(file('../../assets/app-icon-256.png'))]);
const html=template.replace('/*__CSS__*/',()=>css).replace('/*__JS__*/',()=>js).replace('__LOGO__',()=>`data:image/png;base64,${logo.toString('base64')}`);
await writeFile(file('workspace.html'),html);
process.stdout.write(`Built ${fileURLToPath(file('workspace.html'))} (${Buffer.byteLength(html)} bytes)\n`);
