import { mkdir, readFile, writeFile, readdir, rename, rm, copyFile, stat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const DEFAULT_ROOT = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local/share'), 'LearnFlowHost');
const hash = text => createHash('sha256').update(text).digest('hex');
const checkedID = id => { if (!ID.test(id || '')) throw new Error('这份记录的编号不正确。'); return id; };

// No model-facing "confirm=true" shortcut. Windows owns the final Save/Delete/File-picker action.
export async function nativeReview(draft, root, mode = 'review') {
  if (process.platform !== 'win32') throw new Error('本版确认窗口使用 Windows。其他系统可先导出草稿，尚未保存。');
  return await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'review.ps1'), '-ReadStdin', '-Mode', mode], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
      child.stdout.setEncoding('utf8');
      let stdout = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('确认窗口已超时；没有保存。')); }, 10 * 60 * 1000);
      child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 300000) child.kill(); });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(draft));
      child.once('error', () => { clearTimeout(timer); reject(new Error('打不开本机确认窗口；没有保存。')); });
      child.once('close', code => { clearTimeout(timer); try { if (code) throw new Error(); resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); } catch { reject(new Error('确认窗口已关闭，未取得保存许可。')); } });
  });
}

export class LearningLibrary {
  constructor({ root = DEFAULT_ROOT, confirm = nativeReview } = {}) { this.root = root; this.confirm = confirm; this.drafts = new Map(); this.reviews = new Map(); }
  draft({ title, markdown, kind = 'block', strategyId = null }) {
    if (typeof title !== 'string' || !title.trim() || title.length > 100 || typeof markdown !== 'string' || !markdown.trim() || markdown.length > 60000 || !['block', 'strategy'].includes(kind)) throw new Error('标题或内容超出范围。');
    if (kind === 'strategy' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(strategyId || '')) throw new Error('策略名称请用小写英文和连字符。');
    for (const [key, value] of this.drafts) if (value.expires < Date.now()) this.drafts.delete(key);
    if (this.drafts.size >= 30) throw new Error('待确认的草稿太多，请先处理几份。');
    const draft = { id: randomUUID(), kind, title: title.trim(), markdown, strategyId, expires: Date.now() + 30 * 60 * 1000 };
    this.drafts.set(draft.id, draft);
    return { ...draft, status: 'draft', saved: false, instruction: '请先给用户看草稿。用户想保存时调用 review_learning_draft 打开本机确认窗口；只有用户点击保存才会落盘。' };
  }
  startReview(id) {
    const draft = this.drafts.get(checkedID(id));
    if (!draft || draft.expires < Date.now()) throw new Error('草稿已过期，请重新整理。');
    if ([...this.reviews.values()].some(x => x.draftId === id && x.status === 'pending')) throw new Error('这份草稿已经打开了确认窗口。');
    return this.runReview(draft, 'review', id);
  }
  runReview(draft, mode, draftId) {
    if ([...this.reviews.values()].filter(x => x.status === 'pending').length >= 2) throw new Error('请先关闭当前确认窗口。');
    const job = { id: randomUUID(), draftId, status: 'pending', saved: false, instruction: '请在弹出的 LearnFlow 窗口里检查内容；可以改，也可以取消。' };
    this.reviews.set(job.id, job);
    (async () => {
      try {
        const approval = await this.confirm(draft, this.root, mode);
        if (approval.approved !== true) { job.status = 'cancelled'; return; }
        if (mode === 'delete') {
          const record = await this.get(draft.id);
          await rm(path.join(this.root, 'assets', record.id), { recursive: true, force: true });
          job.status = 'deleted'; job.assetId = record.id; return;
        }
        let record;
        if (mode === 'import') {
          // The source path is returned solely by the native file picker, never by a tool argument.
          const source = approval.path;
          if (typeof source !== 'string' || path.extname(source).toLowerCase() !== '.pdf') throw new Error('请选择 PDF 文件。');
          if ((await stat(source)).size > 30 * 1024 * 1024) throw new Error('PDF 超过 30 MB，请先拆成章节。');
          const bytes = await readFile(source);
          if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('这个文件没有有效的 PDF 标识。');
          record = await this.persist({ kind: 'pdf', title: path.basename(source, path.extname(source)), bytes });
        } else {
          const title = approval.title, markdown = approval.markdown;
          if (typeof title !== 'string' || !title.trim() || title.length > 100 || typeof markdown !== 'string' || !markdown.trim() || markdown.length > 60000) throw new Error('修改后的标题或内容超出范围，未保存。');
          record = await this.persist({ ...draft, title, markdown });
        }
        job.status = 'saved'; job.saved = true; job.asset = record;
        if (draftId) this.drafts.delete(draftId);
      } catch (error) { job.status = 'error'; job.message = error.code ? '本机文件操作失败，未报告成功。' : error.message; }
      finally { if (this.reviews.size > 100) for (const [key, value] of this.reviews) { if (value.status !== 'pending') this.reviews.delete(key); if (this.reviews.size < 80) break; } }
    })();
    return { ...job };
  }
  status(id) { const status = this.reviews.get(checkedID(id)); if (!status) throw new Error('没有找到这次确认记录。'); return { ...status }; }
  async persist(draft) {
    const id = randomUUID(), folder = path.join(this.root, 'assets', id);
    await mkdir(folder, { recursive: true });
    const filename = draft.kind === 'strategy' ? 'SKILL.md' : draft.kind === 'pdf' ? 'document.pdf' : '学习块.md';
    const bytes = draft.bytes || Buffer.from(draft.markdown, 'utf8');
    const record = { id, title: draft.title, kind: draft.kind, strategyId: draft.strategyId || null, filename, sha256: hash(bytes), createdAt: new Date().toISOString(), confirmation: 'native-user-click' };
    try {
      await writeFile(path.join(folder, filename), bytes, { flag: 'wx', mode: 0o600 });
      await writeFile(path.join(folder, 'record.json'), JSON.stringify(record), { flag: 'wx', mode: 0o600 });
      return { ...record, file: path.join(folder, filename) };
    } catch (error) { await rm(folder, { recursive: true, force: true }); throw error; }
  }
  async list() {
    let dirs; try { dirs = await readdir(path.join(this.root, 'assets'), { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const records = [];
    for (const dir of dirs) if (dir.isDirectory() && ID.test(dir.name)) { try { records.push(await this.get(dir.name, false)); } catch {} }
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id, includeText = true) {
    checkedID(id);
    const folder = path.join(this.root, 'assets', id), record = JSON.parse(await readFile(path.join(folder, 'record.json'), 'utf8'));
    if (record.id !== id || !['SKILL.md', 'document.pdf', '学习块.md'].includes(record.filename)) throw new Error('这份学习资产的索引损坏了。');
    const file = path.join(folder, record.filename);
    return { ...record, file, ...(includeText && record.kind !== 'pdf' ? { markdown: await readFile(file, 'utf8') } : {}) };
  }
  async requestDelete(id) { return this.runReview(await this.get(id), 'delete', null); }
  requestImport() { return this.runReview({ title: '选择一份 PDF 保存到学习资产', markdown: '' }, 'import', null); }
  async open(id) {
    const record = await this.get(id, false);
    if (process.platform !== 'win32') return { opened: false, file: record.file, instruction: '请用本机文件管理器打开。' };
    // A fixed PowerShell script opens only a file generated inside this library.
    const script = '$ErrorActionPreference="Stop"; Invoke-Item -LiteralPath $env:LEARNFLOW_ASSET_TO_OPEN';
    await new Promise((resolve, reject) => { const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, shell: false, env: { ...process.env, LEARNFLOW_ASSET_TO_OPEN: record.file }, stdio: 'ignore' }); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('本机没有可打开该格式的默认程序。'))); });
    return { opened: true, file: record.file, note: '已交给本机默认程序；PDF 通常由 WPS 或浏览器打开。' };
  }
}
