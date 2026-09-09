import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { HttpError } from './http-utils.mjs';

const missing = () => { throw new HttpError(404, 'not_found', '找不到这份资料。'); };
export class FileVault {
  constructor(dataDir) {
    this.dir = path.join(dataDir, 'documents'); mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dataDir, 'documents.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);');
  }
  close() { this.db.close(); }
  view(r) { return { id: r.id, assetId: r.id, kind: 'pdf', title: r.name, name: r.name, size: r.size, createdAt: r.created, source: 'user-upload', revision: 1 }; }
  list(userId) { return this.db.prepare('SELECT * FROM documents WHERE owner=? ORDER BY created DESC').all(userId).map(r => this.view(r)); }
  import(userId, input) {
    if (typeof input.name !== 'string' || input.name.length > 160 || !input.name.trim().toLowerCase().endsWith('.pdf') || /[\x00-\x1f/\\]/.test(input.name)) throw new HttpError(400, 'invalid_pdf', '请选一个名称不超过 160 字的 PDF 文件。');
    if (typeof input.base64 !== 'string' || input.base64.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new HttpError(400, 'invalid_pdf', '文件内容格式不正确。');
    const bytes = Buffer.from(input.base64, 'base64');
    if (bytes.length > 5 * 1024 * 1024 || bytes.length < 8 || bytes.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(400, 'invalid_pdf', '请使用 5 MB 以内的 PDF。');
    const used = this.db.prepare('SELECT COALESCE(sum(size),0) bytes,count(*) n FROM documents WHERE owner=?').get(userId);
    if (used.bytes + bytes.length > 100 * 1024 * 1024 || used.n >= 100) throw new HttpError(409, 'quota_exceeded', '资料空间已满，请先删除不需要的副本。');
    const id = randomUUID(), created = new Date().toISOString(); const dest = path.join(this.dir, id + '.pdf');
    writeFileSync(dest + '.part', bytes, { mode: 0o600, flag: 'wx' }); renameSync(dest + '.part', dest);
    try { this.db.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run(id, userId, input.name.trim(), bytes.length, created); }
    catch (e) { unlinkSync(dest); throw e; }
    return this.view({ id, name: input.name.trim(), size: bytes.length, created });
  }
  get(userId, id) { const r = this.db.prepare('SELECT * FROM documents WHERE id=? AND owner=?').get(String(id), userId); if (!r) missing(); return r; }
  read(userId, id) { const r = this.get(userId, id); return { asset: this.view(r), mimeType: 'application/pdf', base64: readFileSync(path.join(this.dir, r.id + '.pdf')).toString('base64') }; }
  delete(userId, id) { const r = this.get(userId, id); unlinkSync(path.join(this.dir, r.id + '.pdf')); this.db.prepare('DELETE FROM documents WHERE id=? AND owner=?').run(r.id, userId); return { deleted: true, assetId: r.id }; }
}
