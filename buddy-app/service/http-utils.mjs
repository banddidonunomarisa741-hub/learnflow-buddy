import { randomBytes } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const random = (n = 32) => randomBytes(n).toString('base64url');
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function json(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}
export function html(res, value, status = 200, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers });
  res.end(value);
}
export function redirect(res, location, cookies = []) {
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(cookies.length ? { 'Set-Cookie': cookies } : {}) }); res.end();
}
export function cookieValue(req, name) {
  const pair = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return pair?.slice(name.length + 1) || '';
}
export async function body(req, limit = 1024 * 1024) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) throw new HttpError(413, 'request_too_large', '内容太长，请缩短后再试。'); chunks.push(chunk); }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  if (String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded')) {
    const p = new URLSearchParams(raw); const result = {};
    for (const [k, v] of p) { if (Object.hasOwn(result, k)) throw new HttpError(400, 'invalid_request', '参数重复。'); result[k] = v; }
    return result;
  }
  if (!String(req.headers['content-type']).startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type', '需要 JSON 或表单内容。');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an object');
    return parsed;
  } catch { throw new HttpError(400, 'invalid_request', '内容格式不正确。'); }
}
export function page(title, content) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · LearnFlow</title><style>body{margin:0;background:#fffaf5;color:#292725;font:18px/1.6 system-ui,'Microsoft YaHei',sans-serif}main{max-width:540px;margin:9vh auto;padding:36px;background:white;border:1px solid #f0dfce;border-radius:24px}h1{font-size:28px;line-height:1.3}p{margin:18px 0}button,a.button{display:inline-block;font:inherit;padding:12px 22px;border:0;border-radius:12px;background:#f67e28;color:#fff;cursor:pointer;text-decoration:none}button.secondary{background:#f4f1ed;color:#39332e;margin-left:8px}li{margin:8px 0}.brand{color:#de630b;font-weight:700}small{font-size:15px}@media(max-width:600px){main{margin:20px 12px;padding:26px}}</style><main><div class="brand">LearnFlow学习流动</div><h1>${escapeHtml(title)}</h1>${content}</main></html>`;
}
