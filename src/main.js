// Business Empire — 网页版商业帝国模拟经营
// 零依赖：node:http + node:sqlite + node:crypto
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, DB_PATH } from './db.js';
import * as A from './auth.js';
import * as M from './market.js';
import * as S from './sim.js';
import * as API from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8020);
const BUILD_ID = String(Date.now());   // 每次启动生成，用于识别前后端版本是否一致
process.env.BE_BUILD = BUILD_ID;

M.bootTime();
M.initAssets();
M.loadSectorMom();
M.advanceMarket();
setInterval(() => { try { M.advanceMarket(); } catch (e) { console.error('[tick]', e.message); } }, M.MS_PER_GAME_HOUR / 2);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const COOKIE_MAX_AGE = 365 * 24 * 3600;
const authCookie = token =>
  `be_token=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;

function send(res, code, data, headers = {}) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '', n = 0;
    req.on('data', c => { n += c.length; if (n > 1e6) { reject(new Error('请求体过大')); req.destroy(); } d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error('JSON 解析失败')); } });
    req.on('error', reject);
  });
}
function tokenOf(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)be_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (path.extname(file)) return send(res, 404, { error: 'not found' });
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, b2) =>
        e2 ? send(res, 404, { error: 'not found' }) : send(res, 200, b2, { 'Content-Type': MIME['.html'] }));
    }
    const ext = path.extname(file);
    // 前端代码一律不缓存，杜绝浏览器跑着旧版本 JS 的情况
    const noStore = ['.html', '.js', '.css'].includes(ext);
    send(res, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': noStore ? 'no-store, must-revalidate' : 'no-cache',
      'X-Build': BUILD_ID });
  });
}

const ACCESS_LOG = path.join(path.dirname(DB_PATH), 'access.log');
function logApi(req, p, code, extra = '') {
  if (p === '/api/state' || p === '/api/ping' || p === '/api/health' || p === '/api/sparks') return;  // 高频轮询不记
  const line = `${new Date().toISOString()} ${req.method} ${p} -> ${code}${extra ? ' ' + extra : ''}\n`;
  fs.appendFile(ACCESS_LOG, line, () => {});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (!p.startsWith('/api/')) return serveStatic(req, res, p);
  res.once('finish', () => logApi(req, p, res.statusCode));

  try {
    const body = req.method === 'POST' ? await readBody(req) : {};

    // ── 公开接口 ──
    if (p === '/api/register' && req.method === 'POST') {
      const u = A.register(body.username, body.password, body.nickname);
      const token = A.createSession(u.id);
      S.ensurePlayer(u.id, (body.nickname || u.username).slice(0, 16));
      return send(res, 200, { token, user: { id: u.id, username: u.username } }, { 'Set-Cookie': authCookie(token) });
    }
    if (p === '/api/login' && req.method === 'POST') {
      const u = A.login(body.username, body.password);
      const token = A.createSession(u.id);
      S.ensurePlayer(u.id, u.username);
      return send(res, 200, { token, user: { id: u.id, username: u.username } }, { 'Set-Cookie': authCookie(token) });
    }
    if (p === '/api/ping' || p === '/api/health')
      return send(res, 200, { ok: true, name: 'business-empire', port: PORT, build: BUILD_ID, msPerHour: M.MS_PER_GAME_HOUR,
        hour: M.currentGameHour(), date: M.gameDate(M.currentGameHour()) });

    // ── 需要登录 ──
    const token = tokenOf(req);
    const user = A.userFromToken(token);
    if (!user) return send(res, 401, { error: '请先登录' });
    const uid = user.id;
    S.ensurePlayer(uid, user.username);

    switch (p) {
      case '/api/logout':      A.destroySession(token);
        return send(res, 200, { ok: true }, { 'Set-Cookie': 'be_token=; Path=/; Max-Age=0; SameSite=Lax' });
      case '/api/me':          return send(res, 200, { user });
      case '/api/state':       return send(res, 200, API.getState(uid));
      case '/api/market':      return send(res, 200, { assets: API.getMarket(uid, url.searchParams.get('kind') || null) });
      case '/api/sparks':      return send(res, 200, { spark: API.getSparks() });
      case '/api/asset':       return send(res, 200, API.getAsset(uid, url.searchParams.get('symbol'), Number(url.searchParams.get('points') || 240)));
      case '/api/catalog':     return send(res, 200, API.catalog());
      case '/api/leaderboard': return send(res, 200, { list: API.leaderboard() });
      case '/api/news':        return send(res, 200, { news: M.latestNews(50) });
      case '/api/trade':       return send(res, 200, API.trade(uid, body));
      case '/api/takeover':    return send(res, 200, API.takeover(uid, body));
      case '/api/biz/buy':     return send(res, 200, API.bizBuy(uid, body));
      case '/api/biz/action':  return send(res, 200, API.bizAction(uid, body));
      case '/api/bank':        return send(res, 200, API.bank(uid, body));
      case '/api/item/buy':    return send(res, 200, API.itemBuy(uid, body));
      case '/api/item/action': return send(res, 200, API.itemAction(uid, body));
      case '/api/reset':       return send(res, 200, API.resetSave(uid));
      case '/api/job':         return send(res, 200, API.takeJob(uid, body));
      case '/api/hustle':      return send(res, 200, API.hustle(uid));
      case '/api/treat':       return send(res, 200, API.treat(uid));
      case '/api/dayoff':      return send(res, 200, API.dayOff(uid));
      case '/api/living':      return send(res, 200, API.setLiving(uid, body));
      case '/api/lottery':     return send(res, 200, API.buyLottery(uid, body));
      case '/api/trip':        return send(res, 200, API.bookTrip(uid, body));
      case '/api/richlist':    return send(res, 200, { list: API.richList(uid) });
      case '/api/overview':    return send(res, 200, API.marketOverview(uid));
      case '/api/account/delete': {
        const r = API.deleteAccount(uid, body);
        A.destroySession(token);
        return send(res, 200, r);
      }
      default: return send(res, 404, { error: '接口不存在' });
    }
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : 400;
    return send(res, code, { error: e.message || '操作失败' });
  }
});

// 安全网：任何未捕获的异常都不许把服务打死——记下来，继续服务
function logFatal(kind, err) {
  const msg = `\n[${new Date().toISOString()}] ${kind}: ${err && err.stack || err}\n`;
  try { fs.appendFileSync(path.join(path.dirname(DB_PATH), 'error.log'), msg); } catch {}
  console.error(msg);
}
process.on('uncaughtException', e => logFatal('uncaughtException', e));
process.on('unhandledRejection', e => logFatal('unhandledRejection', e));
server.on('clientError', (e, socket) => { try { socket.destroy(); } catch {} });

server.listen(PORT, () => {
  const h = M.currentGameHour();
  console.log(`\n  💼  Business Empire 已启动`);
  console.log(`  🌐  http://localhost:${PORT}`);
  const mins = (M.MS_PER_GAME_HOUR / 60000);
  console.log(`  🕒  游戏内时间 / In-game: ${M.gameDate(h).text}（现实 ${mins} 分钟 = 游戏 1 小时 / ${mins} real min = 1 game hour）`);
  console.log(`  🌍  宏观周期 / Macro: ${M.regimeState().emoji} ${M.regimeState().zh} · 政策利率 ${(M.policyRate()*100).toFixed(2)}%`);
  const all = M.allAssets();
  const tradable = all.filter(a => a.kind !== 'index').length;
  console.log(`  📊  资产 / Assets: ${tradable} 个可交易标的 + ${all.length - tradable} 个指数`);
  console.log(`  💾  存档 / Save: ${DB_PATH}`);
  console.log('  ⏹  停止 / Stop: Ctrl + C\n');
});
