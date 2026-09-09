import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError, random, json, html, redirect, page, escapeHtml, cookieValue } from './http-utils.mjs';

const hash = s => createHash('sha256').update(String(s)).digest('hex');
const eq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const SCOPES = ['learning:read', 'learning:write'];
const invalid = message => new HttpError(400, 'invalid_request', message);

// LearnFlow is the resource/token issuer. Upstream WorkBuddy credentials are used
// only to authenticate a person; their tokens are never forwarded to an MCP client.
export class LearnFlowOAuth {
  constructor({ dataDir, baseURL, development = false, connectorSource = 'learnflow-learning-cloud', redirectOrigins = [], workbuddy = {} }) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dataDir, 'authorization.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS auth_entries(kind TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(kind,key));');
    this.base = baseURL.replace(/\/$/, ''); this.resource = this.base + '/mcp'; this.development = development;
    this.connectorSource = connectorSource; this.redirectOrigins = redirectOrigins; this.workbuddy = workbuddy;
    this.getQ = this.db.prepare('SELECT value,expires FROM auth_entries WHERE kind=? AND key=?');
    this.putQ = this.db.prepare('INSERT OR REPLACE INTO auth_entries(kind,key,value,expires) VALUES(?,?,?,?)');
    this.delQ = this.db.prepare('DELETE FROM auth_entries WHERE kind=? AND key=?');
    this.previewNonce = random();
  }
  close() { this.db.close(); }
  get(kind, key) { const r = this.getQ.get(kind, key); if (!r || r.expires < Date.now()) return null; return JSON.parse(r.value); }
  put(kind, key, value, seconds) { this.putQ.run(kind, key, JSON.stringify(value), Date.now() + seconds * 1000); }
  remove(kind, key) { this.delQ.run(kind, key); }
  cleanup() { this.db.prepare('DELETE FROM auth_entries WHERE expires<?').run(Date.now()); }
  get configured() { return !!(this.workbuddy.clientId && this.workbuddy.clientSecret); }
  cookie(name, value, maxAge = 600) { return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.base.startsWith('https:') ? '; Secure' : ''}`; }
  metadata() { return { issuer: this.base, authorization_endpoint: this.base + '/oauth/authorize', token_endpoint: this.base + '/oauth/token', registration_endpoint: this.base + '/oauth/register', revocation_endpoint: this.base + '/oauth/revoke', response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], scopes_supported: SCOPES }; }
  resourceMetadata() { return { resource: this.resource, authorization_servers: [this.base], scopes_supported: SCOPES, bearer_methods_supported: ['header'] }; }
  validRedirect(uri) {
    if (typeof uri !== 'string' || uri.length > 2048) return false;
    let u; try { u = new URL(uri); } catch { return false; }
    if (u.hash || u.username || u.password) return false;
    if (uri === `workbuddy://workbuddy/mcp/connector%3A${this.connectorSource}/oauth/callback`) return true;
    if (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) && u.pathname === '/oauth/callback') return true;
    return u.protocol === 'https:' && this.redirectOrigins.includes(u.origin);
  }
  register(input) {
    if (!input || !Array.isArray(input.redirect_uris) || !input.redirect_uris.length || input.redirect_uris.length > 5 || !input.redirect_uris.every(u => this.validRedirect(u))) throw invalid('回调地址未获允许。请使用已登记的域名或 WorkBuddy 回调。');
    if (input.token_endpoint_auth_method && input.token_endpoint_auth_method !== 'none') throw invalid('此连接器使用公共客户端与 PKCE。');
    if (input.grant_types && (!Array.isArray(input.grant_types) || input.grant_types.some(g => !['authorization_code', 'refresh_token'].includes(g)))) throw invalid('不支持此授权类型。');
    const count = this.db.prepare("SELECT count(*) n FROM auth_entries WHERE kind='client' AND expires>?").get(Date.now()).n;
    if (count >= 5000) throw new HttpError(429, 'temporarily_unavailable', '连接注册过多，请稍后再试。');
    const c = { client_id: 'lfc_' + random(20), client_name: String(input.client_name || 'WorkBuddy').slice(0, 100), redirect_uris: [...new Set(input.redirect_uris)], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], client_id_issued_at: Math.floor(Date.now() / 1000) };
    this.put('client', c.client_id, c, 365 * 86400); return c;
  }
  authorizeQuery(params) {
    for (const k of ['client_id','redirect_uri','response_type','state','scope','code_challenge','code_challenge_method','resource']) if (params.getAll(k).length > 1) throw invalid('授权参数重复。');
    const c = this.get('client', params.get('client_id'));
    if (!c || !c.redirect_uris.includes(params.get('redirect_uri'))) throw invalid('应用或回调地址不匹配。');
    if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(params.get('code_challenge') || '')) throw invalid('请使用授权码与 S256 PKCE。');
    if (params.get('resource') !== this.resource) throw new HttpError(400, 'invalid_target', '请求的服务地址不匹配。');
    const scopes = (params.get('scope') || SCOPES.join(' ')).split(/\s+/).filter(Boolean);
    if (!scopes.length || scopes.some(s => !SCOPES.includes(s))) throw new HttpError(400, 'invalid_scope', '请求了不支持的权限。');
    return { clientId: c.client_id, clientName: c.client_name, redirectUri: params.get('redirect_uri'), state: (params.get('state') || '').slice(0, 2048), challenge: params.get('code_challenge'), resource: this.resource, scope: [...new Set(scopes)].join(' ') };
  }
  startConsent(req, res, params) {
    const auth = this.authorizeQuery(params); const requestId = random(); const csrf = random(); const flow = random();
    this.put('pending', requestId, { ...auth, csrf, flowHash: hash(flow), approved: false }, 600);
    const content = `<p><strong>${escapeHtml(auth.clientName)}</strong> 希望连接你的 LearnFlow 学习空间。</p><ul><li>读取你保存的学习方法与资料。</li>${auth.scope.includes('learning:write') ? '<li>整理学习草稿；保存、提交、发布仍由你确认。</li>' : ''}</ul><p>你可以随时撤销连接。课程资料仅按你的提交范围提供给老师。</p>${this.development ? '<p><small>这是本机开发预览，使用测试身份。</small></p>' : ''}<form method="post" action="/oauth/decision"><input type="hidden" name="requestId" value="${requestId}"><input type="hidden" name="csrf" value="${csrf}"><button name="decision" value="allow">同意并连接</button><button class="secondary" name="decision" value="deny">取消</button></form>`;
    html(res, page('连接你的学习空间', content), 200, { 'Set-Cookie': this.cookie('lf_flow', flow), 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
  }
  assertBrowserOrigin(req) { if (req.headers.origin !== this.base) throw new HttpError(403, 'origin_rejected', '请从当前 LearnFlow 窗口操作。'); }
  pendingForBrowser(req, requestId) {
    const p = this.get('pending', requestId);
    if (!p || !eq(p.flowHash, hash(cookieValue(req, 'lf_flow')))) throw invalid('授权窗口已过期，请重新连接。'); return p;
  }
  browserActor(req) { const actor = this.get('browser', hash(cookieValue(req, 'lf_login'))); return !this.development && actor?.source === 'development-only' ? null : actor; }
  issueCode(p, requestId, actor, cookies = []) {
    if (!this.development && actor?.source === 'development-only') throw invalid('测试身份不能用于正式连接。');
    const code = random(); this.put('code', hash(code), { ...p, actor, approved: true }, 600); this.remove('pending', requestId);
    const u = new URL(p.redirectUri); u.searchParams.set('code', code); if (p.state) u.searchParams.set('state', p.state);
    return { url: u.href, cookies };
  }
  async decide(req, res, input) {
    this.assertBrowserOrigin(req); const p = this.pendingForBrowser(req, input.requestId);
    if (!eq(p.csrf, input.csrf)) throw invalid('授权校验未通过，请重新打开。');
    if (input.decision !== 'allow') { this.remove('pending', input.requestId); const u = new URL(p.redirectUri); u.searchParams.set('error', 'access_denied'); if (p.state) u.searchParams.set('state', p.state); redirect(res, u.href); return; }
    const actor = this.browserActor(req);
    if (actor) { const done = this.issueCode(p, input.requestId, actor); redirect(res, done.url); return; }
    if (!this.configured) throw new HttpError(503, 'temporarily_unavailable', 'WorkBuddy 应用身份尚未配置。开发预览请先选择测试身份；正式连接需配置已获批的应用。');
    const state = random(); this.put('upstream', hash(state), { requestId: input.requestId, flowHash: p.flowHash }, 600);
    this.put('pending', input.requestId, { ...p, approved: true }, 600);
    const u = new URL('https://www.workbuddy.cn/openapi/v2/authorize');
    u.search = new URLSearchParams({ response_type: 'code', client_id: this.workbuddy.clientId, redirect_uri: this.base + '/oauth/workbuddy/callback', scope: this.workbuddy.scope || 'user.profile.readable', state }).toString(); redirect(res, u.href);
  }
  async upstreamCallback(req, res, params) {
    const state = params.get('state') || ''; const f = this.get('upstream', hash(state));
    if (!f || !eq(f.flowHash, hash(cookieValue(req, 'lf_flow')))) throw invalid('登录回调校验未通过，请重新连接。');
    this.remove('upstream', hash(state)); const p = this.pendingForBrowser(req, f.requestId);
    if (params.has('error') || !params.get('code')) { this.remove('pending', f.requestId); throw invalid('未完成 WorkBuddy 授权。'); }
    if (!p.approved || !this.configured) throw invalid('请重新确认这次连接。');
    let result;
    try {
      const response = await fetch('https://www.workbuddy.cn/openapi/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code'), client_id: this.workbuddy.clientId, client_secret: this.workbuddy.clientSecret, redirect_uri: this.base + '/oauth/workbuddy/callback' }), signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) throw new Error('upstream_failed'); result = await response.json();
    } catch { throw new HttpError(502, 'temporarily_unavailable', 'WorkBuddy 登录暂时未完成，请重新连接。'); }
    const data = result.data || result;
    if (typeof data.open_id !== 'string' || !data.open_id || typeof data.access_token !== 'string') throw new HttpError(502, 'temporarily_unavailable', '未收到有效的用户身份，请检查平台应用权限。');
    const actor = { id: 'wb_' + hash(this.workbuddy.clientId + ':' + data.open_id), label: '我的学习空间', source: 'workbuddy-oauth' };
    const login = random(); this.put('browser', hash(login), actor, 1800);
    // Tokens from the upstream provider are intentionally discarded, not logged,
    // cached in a browser, forwarded, or reused for QQ permissions.
    const done = this.issueCode(p, f.requestId, actor, [this.cookie('lf_login', login, 1800)]); redirect(res, done.url, done.cookies);
  }
  mint(actor, clientId, scope = SCOPES.join(' '), family = random()) {
    if (!this.development && actor?.source === 'development-only') throw invalid('测试身份不能用于正式连接。');
    const access = random(); const refresh = random();
    this.put('grant', family, { actor, clientId, scope, revoked: false }, 31 * 86400);
    this.put('access', hash(access), { actor, clientId, scope, family, resource: this.resource, uiToken: random() }, 3600);
    this.put('refresh', hash(refresh), { actor, clientId, scope, family, resource: this.resource, used: false }, 30 * 86400);
    return { access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh, scope };
  }
  token(input) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = this.exchange(input); this.db.exec('COMMIT'); return value; }
    catch (e) { this.db.exec(e.commitRevocation ? 'COMMIT' : 'ROLLBACK'); throw e; }
  }
  exchange(input) {
    if (input.resource !== this.resource) throw new HttpError(400, 'invalid_target', '服务地址不匹配。');
    if (!this.get('client', input.client_id)) throw new HttpError(401, 'invalid_client', '连接身份无效。');
    if (input.grant_type === 'authorization_code') {
      const p = this.get('code', hash(input.code || ''));
      if (!p || p.clientId !== input.client_id || p.redirectUri !== input.redirect_uri || p.resource !== input.resource || !p.approved) throw new HttpError(400, 'invalid_grant', '授权码无效或已使用。');
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier || '') || !eq(createHash('sha256').update(input.code_verifier).digest('base64url'), p.challenge)) throw new HttpError(400, 'invalid_grant', 'PKCE 校验未通过。');
      this.remove('code', hash(input.code)); return this.mint(p.actor, p.clientId, p.scope);
    }
    if (input.grant_type === 'refresh_token') {
      const r = this.get('refresh', hash(input.refresh_token || ''));
      if (!r || r.clientId !== input.client_id || r.resource !== input.resource) throw new HttpError(400, 'invalid_grant', '连接已失效，请重新授权。');
      const grant = this.get('grant', r.family);
      if (r.used || !grant || grant.revoked) { this.revokeFamily(r.family); const e = new HttpError(400, 'invalid_grant', '刷新凭证已使用或撤销，请重新授权。'); e.commitRevocation = true; throw e; }
      if (input.scope && input.scope.split(/\s+/).some(s => !r.scope.split(' ').includes(s))) throw new HttpError(400, 'invalid_scope', '不能通过续期增加权限。');
      this.put('refresh', hash(input.refresh_token), { ...r, used: true }, 30 * 86400);
      return this.mint(r.actor, r.clientId, input.scope || r.scope, r.family);
    }
    throw new HttpError(400, 'unsupported_grant_type', '不支持此授权方式。');
  }
  revokeFamily(family) { const g = this.get('grant', family); if (g) this.put('grant', family, { ...g, revoked: true }, 31 * 86400); }
  revoke(input) {
    const r = this.get('access', hash(input.token || '')) || this.get('refresh', hash(input.token || ''));
    if (r && (!input.client_id || input.client_id === r.clientId)) this.revokeFamily(r.family);
  }
  authenticate(req) {
    const token = String(req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]{20,})$/)?.[1];
    const a = token && this.get('access', hash(token));
    if (!a || a.resource !== this.resource || (!this.development && a.actor?.source === 'development-only') || !this.get('grant', a.family) || this.get('grant', a.family).revoked) throw new HttpError(401, 'invalid_token', '请先连接 LearnFlow 学习空间。');
    return a;
  }
  checkUI(auth, token) { if (!eq(auth.uiToken, token)) throw new HttpError(403, 'user_confirmation_required', '请在学习面板里亲自完成这个操作。'); }
  devSession(req, res, input) {
    if (!this.development) throw new HttpError(404, 'not_found', '没有这个入口。');
    this.assertBrowserOrigin(req); if (!eq(req.headers['x-learnflow-preview-nonce'], this.previewNonce)) throw new HttpError(403, 'invalid_request', '请刷新预览页面后再试。');
    const profiles = { learner: '学习者', teacher: '教师', 'second-learner': '另一位学习者' };
    if (!Object.hasOwn(profiles, input.profile)) throw invalid('请选一个测试身份。');
    const actor = { id: 'preview_' + input.profile, label: profiles[input.profile], source: 'development-only' };
    const login = random(); this.put('browser', hash(login), actor, 1800);
    const tokens = this.mint(actor, 'local-preview');
    json(res, 200, { token: tokens.access_token, actor }, { 'Set-Cookie': this.cookie('lf_login', login, 1800) });
  }
  async handle(req, res, url, input) {
    if (req.method === 'GET' && ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(url.pathname)) { json(res, 200, this.resourceMetadata()); return true; }
    if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') { json(res, 200, this.metadata()); return true; }
    if (req.method === 'POST' && url.pathname === '/oauth/register') { json(res, 201, this.register(input)); return true; }
    if (req.method === 'GET' && url.pathname === '/oauth/authorize') { this.startConsent(req, res, url.searchParams); return true; }
    if (req.method === 'POST' && url.pathname === '/oauth/decision') { await this.decide(req, res, input); return true; }
    if (req.method === 'GET' && url.pathname === '/oauth/workbuddy/callback') { await this.upstreamCallback(req, res, url.searchParams); return true; }
    if (req.method === 'POST' && url.pathname === '/oauth/token') { json(res, 200, this.token(input)); return true; }
    if (req.method === 'POST' && url.pathname === '/oauth/revoke') { this.revoke(input); json(res, 200, {}); return true; }
    if (req.method === 'POST' && url.pathname === '/dev/session') { this.devSession(req, res, input); return true; }
    return false;
  }
}
