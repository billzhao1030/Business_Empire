// Business Empire — 网页版商业帝国模拟经营
// 零依赖：node:http + node:sqlite + node:crypto
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, DB_PATH } from './db.js';
import * as CO from './company.js';
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

M.loadSpeed();
M.bootTime();
M.initAssets();
M.loadSectorMom();
M.loadRumors();
{
  // 启动时先收住离线的口子，再补算行情。没人玩的时候世界最多往前 7 个游戏日。
  const skipped = M.clampOfflineGap();
  if (skipped > 0) console.log(`\n  ⏳  无人游玩超过 ${M.OFFLINE_CAP_HOURS / 24} 个游戏日，时钟停在上限处，跳过 ${Math.round(skipped / 24)} 天`);
}
M.advanceMarket();
let idleLogged = false;
// 每次推进行情之前先把离线的口子收住：进程可能被挂起（合上笔记本），
// 也可能整个关掉重开，两种情况都走这里。
function tickWorld() {
  const skipped = M.clampOfflineGap();
  if (skipped > 0 && !idleLogged) {
    idleLogged = true;
    console.log(`  ⏸  没人在玩，世界已走满 ${M.OFFLINE_CAP_HOURS / 24} 个游戏日，时钟就停在这里等你回来`);
  }
  if (skipped <= 0) idleLogged = false;
  M.advanceMarket();
  CO.syncPublicFundamentals();   // 上市公司的股价要围着自己的经营基本面转
  CO.applyMarketShare();         // 玩家的连锁做大了，同赛道的上市公司要让出份额
}
// 心跳跟着流速走：默认 5 秒一次，但开到 20 倍速时一个游戏小时只有 3 秒——
// 还按 5 秒推，行情就是一跳一个半小时。取两者中的小值，保证每跳最多补一个小时。
function heartbeat() {
  const d = Math.max(1_000, Math.min(5_000, M.MS_PER_GAME_HOUR));
  setTimeout(() => {
    try { tickWorld(); } catch (e) { console.error('[tick]', e.message); }
    heartbeat();
  }, d);
}
heartbeat();

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
        speedMin: M.SPEED_MIN_MS, speedMax: M.SPEED_MAX_MS, speedDefault: M.SPEED_DEFAULT,
        scale: API.scale(),
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
      // active=0：标签页在后台，或者人已经很久没动过了——这不算「在玩」，
      // 世界不该继续往前跑。挂机一晚上回来发现过了半年，就是这么来的。
      case '/api/state':       return send(res, 200, API.getState(uid, url.searchParams.get('active') !== '0'));
      case '/api/market':      return send(res, 200, { assets: API.getMarket(uid, url.searchParams.get('kind') || null) });
      case '/api/sparks':      return send(res, 200, { spark: API.getSparks() });
      case '/api/asset':       return send(res, 200, API.getAsset(uid, url.searchParams.get('symbol'), Number(url.searchParams.get('points') || 240)));
      case '/api/catalog':     return send(res, 200, API.catalog());
      case '/api/leaderboard': return send(res, 200, { list: API.leaderboard() });
      case '/api/news':        return send(res, 200, { news: M.latestNews(50) });
      case '/api/trade':       return send(res, 200, API.trade(uid, body));
      case '/api/takeover':    return send(res, 200, API.takeover(uid, body));
      case '/api/biz/buy':     return send(res, 200, API.bizBuy(uid, body));
      case '/api/biz/cities':  return send(res, 200, API.bizCities(uid, body));
      case '/api/company':          return send(res, 200, API.companyState(uid, body?.coId || url.searchParams.get('coId'),
                                      { price: Number(body?.price) || undefined, float: Number(body?.float) || undefined }));
      case '/api/company/found':    return send(res, 200, API.foundCompany(uid, body));
      case '/api/company/shops':    return send(res, 200, API.companyShops(uid, body));
      case '/api/company/raise':    return send(res, 200, API.raiseRound(uid, body));
      case '/api/company/dividend': return send(res, 200, API.payDividend(uid, body));
      case '/api/company/fund':     return send(res, 200, API.fundCompany(uid, body));
      case '/api/company/rename':   return send(res, 200, API.renameCompany(uid, body));
      case '/api/company/ipo':      return send(res, 200, API.listCompany(uid, body));
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
      case '/api/world':       return send(res, 200, API.worldMap(uid));
      case '/api/place':       return send(res, 200, API.place(uid, body));
      case '/api/citysearch':  return send(res, 200, API.citySearch(uid, body));
      case '/api/nearest':     return send(res, 200, API.nearest(uid, body));
      case '/api/speed':       return send(res, 200, API.setSpeed(uid, body));
      case '/api/birthplace':  return send(res, 200, API.setBirthplace(uid, body));
      case '/api/trip':        return send(res, 200, API.bookTrip(uid, body));
      case '/api/richlist':    return send(res, 200, API.richList(uid));
      case '/api/companyboard':return send(res, 200, API.companyBoard(uid));
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
// 兜底是为了让一次请求出错不至于把服务打死。但启动就失败（端口被占、
// 数据目录不可写）属于另一回事：这种进程活着只会白白占着数据库句柄，
// 让下一个真正的实例写不进去——直接退出。
const FATAL_AT_BOOT = new Set(['EADDRINUSE', 'EACCES', 'EADDRNOTAVAIL']);
let booted = false;
function bail(kind, err) {
  logFatal(kind, err);
  console.error(`\n  ✖  启动失败：${err && err.message || err}`);
  if (err && err.code === 'EADDRINUSE')
    console.error(`  端口 ${PORT} 已被占用。先停掉占用它的进程，或换一个 PORT。\n`);
  try { db.close(); } catch {}
  process.exit(1);
}
process.on('uncaughtException', e => {
  if (!booted && e && FATAL_AT_BOOT.has(e.code)) return bail('bootFailure', e);
  logFatal('uncaughtException', e);
});
process.on('unhandledRejection', e => logFatal('unhandledRejection', e));
server.on('clientError', (e, socket) => { try { socket.destroy(); } catch {} });
server.on('error', e => { if (!booted) bail('listenFailure', e); else logFatal('serverError', e); });

// 退出时把数据库关干净，WAL 才会合并回主库
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { try { server.close(); } catch {} try { db.close(); } catch {} process.exit(0); });
}

server.listen(PORT, () => {
  booted = true;
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
