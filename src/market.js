// 市场模拟引擎：几何布朗运动 + 均值回归 + 市场/板块因子 + 波动率聚集 + 跳跃 + 新闻冲击
import { db, getMeta, setMeta } from './db.js';
import { STOCKS, COMMODITIES, CRYPTOS, INDICES, DISTRICTS } from './catalog-assets.js';
import * as C from './catalog-content.js';

// ── 时间：现实 MS_PER_GAME_HOUR 毫秒 = 游戏 1 小时（默认 2 分钟）──
export const SPEED_MIN_MS = 12_000;      // 最快：12 秒 = 1 游戏小时
export const SPEED_MAX_MS = 300_000;     // 最慢：5 分钟 = 1 游戏小时
export const SPEED_DEFAULT = 60_000;     // 默认：1 分钟 = 1 游戏小时
export let MS_PER_GAME_HOUR = Number(process.env.GAME_HOUR_MS || SPEED_DEFAULT);

// 改变流速时以「当前游戏时刻」为锚点重设起点，保证时钟不跳变
export function setSpeed(ms) {
  const v = Math.max(SPEED_MIN_MS, Math.min(SPEED_MAX_MS, Math.round(ms)));
  if (v === MS_PER_GAME_HOUR) return v;
  const hour = Number(getMeta('market_hour', '0'));
  const frac = hourProgress();
  MS_PER_GAME_HOUR = v;
  setMeta('epoch_ms', String(Date.now() - (hour + frac) * v));
  setMeta('ms_per_hour', v);
  return v;
}
export function loadSpeed() {
  const v = Number(getMeta('ms_per_hour', 0));
  if (v >= SPEED_MIN_MS && v <= SPEED_MAX_MS) MS_PER_GAME_HOUR = v;
  return MS_PER_GAME_HOUR;
}
export const DAY_HOURS   = 24;
export const MONTH_HOURS = 720;    // 30 天
export const YEAR_HOURS  = 8640;   // 12 个月
const DT = 1 / YEAR_HOURS;
const SQDT = Math.sqrt(DT);

const MKT_MU = 0.075, MKT_SIGMA = 0.155;
const HISTORY_KEEP = 900;
let pendingEvent = null;
let sectorMom = {};          // 每个资产保留的历史小时数
const MAX_DETAIL_TICKS = 600;      // 单次补算的最大精细步数
export const START_HOD = 8;        // 世界起点落在早上 8:00
export const WARMUP_HOURS = 720 + START_HOD;   // 预热 30 个游戏日，让一开局就有完整历史行情

export function bootTime() {
  let t = getMeta('epoch_ms');
  if (!t) { t = String(Date.now()); setMeta('epoch_ms', t); setMeta('ms_per_hour', MS_PER_GAME_HOUR); }
  // 时间流速被调整过：以当前游戏小时为锚点重新校准，避免时钟倒退
  const prev = Number(getMeta('ms_per_hour', MS_PER_GAME_HOUR));
  if (prev !== MS_PER_GAME_HOUR) {
    const hour = Number(getMeta('market_hour', '0'));
    t = String(Date.now() - hour * MS_PER_GAME_HOUR);
    setMeta('epoch_ms', t);
    setMeta('ms_per_hour', MS_PER_GAME_HOUR);
  }
  return Number(t);
}
export function currentGameHour() {
  return Math.max(0, Math.floor((Date.now() - bootTime()) / MS_PER_GAME_HOUR));
}
export function hourProgress() { // 当前游戏小时已过去的比例 0~1
  return ((Date.now() - bootTime()) % MS_PER_GAME_HOUR) / MS_PER_GAME_HOUR;
}
const p2 = n => String(n).padStart(2, '0');
export function gameDate(h) {
  const year = 2026 + Math.floor(h / YEAR_HOURS);
  const r1 = h % YEAR_HOURS;
  const month = Math.floor(r1 / MONTH_HOURS) + 1;
  const r2 = r1 % MONTH_HOURS;
  const day = Math.floor(r2 / DAY_HOURS) + 1;
  const hh = r2 % DAY_HOURS;
  return { year, month, day, hour: hh, text: `${year}-${p2(month)}-${p2(day)} ${p2(hh)}:00` };
}

// ── 随机数 ──────────────────────────────────────────────────
let spare = null;
export function gauss() {
  if (spare !== null) { const s = spare; spare = null; return s; }
  let u = 0, v = 0, s = 0;
  do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  const m = Math.sqrt(-2 * Math.log(s) / s);
  spare = v * m;
  return u * m;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;


// ══ 宏观经济周期 ══════════════════════════════════════════
export const REGIMES = [
  { id:'boom',      zh:'经济繁荣', en:'Boom',       emoji:'🚀', mu: 0.10, vol:0.88, rate: 0.018, demand:1.18, prop: 0.030 },
  { id:'expansion', zh:'稳步扩张', en:'Expansion',  emoji:'📈', mu: 0.05, vol:0.95, rate: 0.006, demand:1.08, prop: 0.015 },
  { id:'neutral',   zh:'平稳增长', en:'Steady',     emoji:'⚖️', mu: 0.00, vol:1.00, rate: 0.000, demand:1.00, prop: 0.000 },
  { id:'inflation', zh:'通胀高企', en:'Inflation',  emoji:'🔥', mu:-0.02, vol:1.28, rate: 0.048, demand:0.95, prop: 0.012 },
  { id:'slowdown',  zh:'经济放缓', en:'Slowdown',   emoji:'🌧️', mu:-0.05, vol:1.22, rate:-0.006, demand:0.88, prop:-0.020 },
  { id:'recession', zh:'经济衰退', en:'Recession',  emoji:'🐻', mu:-0.14, vol:1.58, rate:-0.022, demand:0.75, prop:-0.050 },
  { id:'crisis',    zh:'金融危机', en:'Crisis',     emoji:'💥', mu:-0.30, vol:2.20, rate:-0.032, demand:0.62, prop:-0.100 },
];
const TRANSIT = {
  boom:      [['boom',.52],['expansion',.24],['inflation',.14],['neutral',.10]],
  expansion: [['expansion',.48],['boom',.17],['neutral',.22],['inflation',.13]],
  neutral:   [['neutral',.44],['expansion',.21],['slowdown',.18],['inflation',.10],['boom',.07]],
  inflation: [['inflation',.40],['slowdown',.26],['neutral',.20],['recession',.14]],
  slowdown:  [['slowdown',.38],['neutral',.25],['recession',.26],['expansion',.11]],
  recession: [['recession',.36],['slowdown',.31],['neutral',.20],['crisis',.13]],
  crisis:    [['crisis',.28],['recession',.46],['slowdown',.26]],
};
export const WORLD_EVENTS = [
  { id:'ai',      emoji:'🤖', zh:'通用人工智能取得历史性突破，科技股疯狂',   en:'A historic AGI breakthrough sends tech into a frenzy',  regime:'boom',      shock: 0.05, sectors:['半导体','软件服务','互联网'], sectorShock: 0.13 },
  { id:'war',     emoji:'⚔️', zh:'地区冲突爆发，能源与黄金暴涨',             en:'Regional conflict erupts; energy and gold spike',        regime:'slowdown',  shock:-0.04, sectors:['石油','国防军工'], sectorShock: 0.14 },
  { id:'bank',    emoji:'🏚️', zh:'大型银行倒闭，流动性危机蔓延全球',         en:'A major bank collapses; liquidity dries up worldwide',   regime:'crisis',    shock:-0.09, sectors:['银行','投行'], sectorShock:-0.18 },
  { id:'stimulus',emoji:'💸', zh:'各国推出万亿级刺激计划，风险资产全线走高', en:'Trillion-dollar stimulus lifts every risk asset',        regime:'expansion', shock: 0.06, sectors:['工程机械','工业集团'], sectorShock: 0.10 },
  { id:'pandemic',emoji:'🦠', zh:'新型传染病暴发，全球供应链停摆',           en:'A new pandemic halts global supply chains',              regime:'recession', shock:-0.08, sectors:['航空运输','餐饮','制药'], sectorShock:-0.12 },
  { id:'energy',  emoji:'🔋', zh:'可控核聚变实现商业化，能源格局重写',       en:'Commercial fusion arrives; the energy map is redrawn',   regime:'boom',      shock: 0.045,sectors:['新能源','石油'], sectorShock: 0.15 },
  { id:'crash',   emoji:'📉', zh:'加密货币市场闪崩，杠杆资金连环爆仓',       en:'Crypto flash-crashes; leveraged positions liquidate',    regime:null,        shock:-0.02, sectors:['加密货币'], sectorShock:-0.28 },
  { id:'housing', emoji:'🏘️', zh:'全球房地产泡沫破裂，房价指数暴跌',         en:'The global property bubble bursts',                      regime:'slowdown',  shock:-0.03, sectors:['房地产'], sectorShock:-0.16 },
  { id:'boomcity',emoji:'🌇', zh:'新一轮城镇化启动，核心商圈价值重估',       en:'A new urbanisation wave re-rates prime districts',       regime:'expansion', shock: 0.02, sectors:['商圈','房地产'], sectorShock: 0.12 },
  { id:'taxcut',  emoji:'🧾', zh:'全球减税协议达成，企业利润预期上调',       en:'A global tax accord lifts corporate profit forecasts',   regime:'boom',      shock: 0.04, sectors:[], sectorShock: 0 },
];

export function regimeState() {
  const id = getMeta('regime', 'neutral');
  const r = REGIMES.find(x => x.id === id) || REGIMES[2];
  return { ...r, since: Number(getMeta('regime_since', '0')), policyRate: policyRate() };
}
export function policyRate() { return Number(getMeta('policy_rate', '0.035')); }

function rollRegime(hour) {
  const cur = getMeta('regime', 'neutral');
  const table = TRANSIT[cur] || TRANSIT.neutral;
  let r = Math.random(), next = cur;
  for (const [id, p] of table) { if (r < p) { next = id; break; } r -= p; }
  if (next !== cur) { setMeta('regime', next); setMeta('regime_since', hour); }
  // 政策利率向目标缓慢靠拢
  const reg = REGIMES.find(x => x.id === next) || REGIMES[2];
  const target = clamp(0.035 + reg.rate, 0.001, 0.11);
  const now = policyRate();
  setMeta('policy_rate', clamp(now + clamp(target - now, -0.008, 0.008), 0.001, 0.12));
  return next;
}

// ── 资产初始化 ──────────────────────────────────────────────
export function initAssets() {
  const n = db.prepare('SELECT COUNT(*) c FROM assets').get().c;
  if (n > 0) return;
  const ins = db.prepare(`INSERT INTO assets
    (symbol,name,zh,kind,sector,unit,price,prev_close,day_open,day_high,day_low,fair,mu,sigma,beta,div_yield,shares,max_stake,eps,desc)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  for (const [sym, name, zh, sector, price, sharesM, sigma, beta, div, maxStake, mu, pe] of STOCKS) {
    const eps = pe > 0 ? price / pe : -Math.abs(price) * 0.02;
    ins.run(sym, name, zh, 'stock', sector, '股', price, price, price, price, price,
      price, mu, sigma, beta, div, sharesM * 1e6, maxStake, eps,
      `${zh}（${name}）· ${sector}板块 · ${pe > 0 ? '市盈率 ' + pe : '尚未盈利'}`);
  }
  for (const [sym, name, zh, unit, price, supply, sigma, beta, maxStake, mu, desc] of COMMODITIES) {
    ins.run(sym, name, zh, 'commodity', '大宗商品', unit, price, price, price, price, price,
      price, mu, sigma, beta, 0, supply * 1e3, maxStake, 0, desc);
  }
  for (const [sym, name, zh, price, supply, sigma, beta, maxStake, mu, desc] of CRYPTOS) {
    ins.run(sym, name, zh, 'crypto', '加密货币', '枚', price, price, price, price, price,
      price, mu, sigma, beta, 0, supply * 1e6, maxStake, 0, desc);
  }
  for (const [sym, name, zh, city, price, units, sigma, beta, dy, mu, desc] of DISTRICTS) {
    ins.run(sym, name, zh, 'district', '商圈', '份', price, price, price, price, price,
      price, mu, sigma, beta, dy, units * 1e4, 1, 0, desc);
    db.prepare('UPDATE assets SET link=? WHERE symbol=?').run(city, sym);
  }
  for (const [sym, name, zh, sector, price, sigma, beta, mu, desc] of INDICES) {
    ins.run(sym, name, zh, 'index', sector, '点', price, price, price, price, price,
      price, mu, sigma, beta, 0, 1e9, 0, 0, desc);
  }
  db.exec('COMMIT');
  setMeta('market_hour', '0');
  setMeta('mkt_trend', '0');
  // 预热：先把世界向前推 30 个游戏日，写满历史价格与新闻
  warmup(WARMUP_HOURS);
  // 把世界起点前移，使「现在」正好等于预热结束的时刻
  setMeta('epoch_ms', String(Date.now() - WARMUP_HOURS * MS_PER_GAME_HOUR));
  setMeta('market_hour', String(WARMUP_HOURS));
}

// 把整个世界推倒重来：行情、历史、新闻、宏观周期、游戏时钟全部重置
export function resetWorld() {
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM prices; DELETE FROM news; DELETE FROM assets;');
    for (const k of ['market_hour', 'mkt_trend', 'regime', 'regime_since', 'policy_rate', 'sector_mom', 'bex_base', 'epoch_ms'])
      db.prepare('DELETE FROM meta WHERE key=?').run(k);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  cache = null;
  sectorMom = {};
  pendingEvent = null;
  setMeta('epoch_ms', String(Date.now()));
  setMeta('ms_per_hour', MS_PER_GAME_HOUR);
  initAssets();
  // 让所有玩家的时间基准对齐到新世界，避免旧存档卡在未来
  const h = Number(getMeta('market_hour', '0'));
  db.prepare('UPDATE players SET last_hour=?, created_hour=?, ot_day=-1, ot_hours=0, ot_pending=0, ot_until=0, last_seen_hour=?, last_seen_ms=0').run(h, h, h);
  return h;
}

// 预热：逐小时模拟并落库历史（仅在新建存档时执行一次）
function warmup(n) {
  const list = assets();
  const sectorSet = new Set(list.map(a => a.sector));
  const updA = db.prepare(`UPDATE assets SET price=?, prev_close=?, day_open=?, day_high=?, day_low=?,
                            fair=?, vol_state=?, last_ret=? WHERE id=?`);
  const insP = db.prepare('INSERT OR REPLACE INTO prices(asset_id,hour,price) VALUES(?,?,?)');
  const insN = db.prepare('INSERT INTO news(hour,scope,target,headline,impact) VALUES(?,?,?,?,?)');
  db.exec('BEGIN');
  for (let h = 1; h <= n; h++) {
    const news = tickOnce(list, h, sectorSet);
    for (const x of news) insN.run(h, x.scope, x.target, x.headline, x.impact);
    for (const a of list) insP.run(a.id, h, a.price);
  }
  for (const a of list) updA.run(a.price, a.prev_close, a.day_open, a.day_high, a.day_low, a.fair, a.vol_state, a.last_ret, a.id);
  db.exec('COMMIT');
  db.prepare('DELETE FROM news WHERE id NOT IN (SELECT id FROM news ORDER BY id DESC LIMIT 60)').run();
}

// ── 一次心跳：推进一个游戏小时 ──────────────────────────────
const selAll = () => db.prepare('SELECT * FROM assets').all();
let cache = null;
function assets() { if (!cache) cache = selAll(); return cache; }
export function invalidate() { cache = null; }

function tickOnce(assetList, hour, sectorSet) {
  let trend = Number(getMeta('mkt_trend', '0'));
  trend = clamp(trend * 0.996 + gauss() * 0.006, -0.30, 0.30);

  // 每个游戏月重新掷一次宏观周期
  const newsItems = [];
  if (hour % MONTH_HOURS === 0) {
    const before = getMeta('regime', 'neutral');
    const after = rollRegime(hour);
    if (after !== before) {
      const r = REGIMES.find(x => x.id === after);
      newsItems.push({ scope: 'market', target: 'regime', impact: r.mu / 6,
        headline: JSON.stringify({ zh: `${r.emoji} 宏观形势切换：进入「${r.zh}」阶段`, en: `${r.emoji} Macro regime shift: entering ${r.en}` }) });
    }
    // 世界大事件
    if (Math.random() < 0.11) {
      const ev = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
      if (ev.regime) { setMeta('regime', ev.regime); setMeta('regime_since', hour); }
      pendingEvent = ev;
      newsItems.push({ scope: 'world', target: ev.id, impact: ev.shock,
        headline: JSON.stringify({ zh: `${ev.emoji} ${ev.zh}`, en: `${ev.emoji} ${ev.en}` }) });
    }
  }
  const reg = REGIMES.find(x => x.id === getMeta('regime', 'neutral')) || REGIMES[2];

  let mktRet = (MKT_MU + trend + reg.mu) * DT + MKT_SIGMA * reg.vol * SQDT * gauss();
  let cryptoRet = 0.30 * DT + 0.95 * reg.vol * SQDT * gauss() + 1.9 * mktRet;
  if (pendingEvent) {
    mktRet += pendingEvent.shock;
    cryptoRet += pendingEvent.shock * 1.6;
  }

  const sectorRet = {};
  for (const s of sectorSet) {
    // 板块动量：缓慢演化的持续性趋势，形成板块轮动
    const m = (sectorMom[s] = clamp((sectorMom[s] || 0) * 0.985 + gauss() * 0.012, -0.35, 0.35));
    sectorRet[s] = m * DT + 0.20 * reg.vol * SQDT * gauss();
  }
  if (pendingEvent) {
    for (const sec of pendingEvent.sectors) if (sectorRet[sec] != null) sectorRet[sec] += pendingEvent.sectorShock;
    pendingEvent = null;
  }

  // ── 新闻 ──
  if (Math.random() < 0.085) {
    const roll = Math.random();
    if (roll < 0.16) {                       // 全市场
      const good = Math.random() < 0.5;
      const imp = (good ? 1 : -1) * (0.006 + Math.random() * 0.022);
      mktRet += imp; cryptoRet += imp * 1.5;
      const tp = pick(good ? C.NEWS_MARKET_GOOD : C.NEWS_MARKET_BAD);
      newsItems.push({ scope: 'market', target: '', headline: JSON.stringify({ zh: tp[0], en: tp[1] }), impact: imp });
    } else if (roll < 0.45) {                // 板块
      const s = pick([...sectorSet]);
      const good = Math.random() < 0.5;
      const imp = (good ? 1 : -1) * (0.008 + Math.random() * 0.028);
      sectorRet[s] = (sectorRet[s] || 0) + imp;
      const tp = good ? pick(C.NEWS_SECTOR_GOOD) : pick(C.NEWS_SECTOR_BAD);
      newsItems.push({ scope: 'sector', target: s, impact: imp,
        headline: JSON.stringify({ zh: tp[0].replace('{X}', s), en: tp[1].replace('{X}', C.sectorEn(s)) }) });
    } else {                                 // 个股
      const a = pick(assetList.filter(x => x.kind !== 'index' && x.kind !== 'district'));
      const good = Math.random() < 0.5;
      const imp = (good ? 1 : -1) * (0.015 + Math.random() * 0.085);
      a._news = (a._news || 0) + imp;
      const tpl = a.kind === 'stock' ? (good ? pick(C.NEWS_ASSET_GOOD) : pick(C.NEWS_ASSET_BAD))
        : (good ? pick(C.NEWS_SECTOR_GOOD) : pick(C.NEWS_SECTOR_BAD));
      newsItems.push({ scope: 'asset', target: a.symbol, impact: imp,
        headline: JSON.stringify({ zh: tpl[0].replace('{X}', a.zh), en: tpl[1].replace('{X}', a.name) }) });
    }
  }

  const newDay = hour % DAY_HOURS === 0;
  for (const a of assetList) {
    if (a.symbol === 'BEXI') continue;
    // 新的一天：昨日收盘价固化，开盘价 = 昨收
    if (newDay) { a.prev_close = a.price; a.day_open = a.price; a.day_high = a.price; a.day_low = a.price; }
    const isCrypto = a.kind === 'crypto';
    const effSigma = a.sigma * a.vol_state;

    // 基本面（内在价值）自身缓慢演化
    a.fair = Math.max(1e-6, a.fair * Math.exp(a.mu * DT + 0.40 * a.sigma * SQDT * gauss()));

    const theta = isCrypto ? 0.55 : a.kind === 'commodity' ? 1.9 : a.kind === 'index' ? 0.85 : a.kind === 'district' ? 1.05 : 1.15;
    const reversion = theta * Math.log(a.fair / a.price) * DT;
    const factor = isCrypto ? a.beta * cryptoRet : a.beta * mktRet + (sectorRet[a.sector] || 0);
    const idio = effSigma * SQDT * gauss();
    const jump = (a.kind === 'index' || a.kind === 'district') ? 0 : (Math.random() < (isCrypto ? 0.0022 : 0.0008) ? gauss() * (isCrypto ? 0.10 : 0.055) : 0);
    const news = a._news || 0;
    if (news) { a.fair = Math.max(1e-6, a.fair * Math.exp(news * 0.75)); a._news = 0; }

    const r = factor + idio + reversion + jump + news - 0.5 * effSigma * effSigma * DT;
    let price = a.price * Math.exp(r);
    price = clamp(price, a.fair * 0.06, a.fair * 9);        // 极端行情护栏
    price = Math.max(price, 1e-6);

    a.last_ret = Math.log(price / a.price);
    a.price = price;
    a.vol_state = clamp(1 + 0.985 * (a.vol_state - 1) + 0.055 * (Math.abs(a.last_ret) / (effSigma * SQDT) - 0.82), 0.55, 4.5);

    if (a.price > a.day_high) a.day_high = a.price;
    if (a.price < a.day_low) a.day_low = a.price;
  }
  // 大盘指数 = 全部股票市值加权（基准 1000 点）
  const bex = assetList.find(a => a.symbol === 'BEXI');
  if (bex) {
    let cap = 0;
    for (const a of assetList) if (a.kind === 'stock') cap += a.price * a.shares;
    let base = Number(getMeta('bex_base', '0'));
    if (!base) { base = cap; setMeta('bex_base', String(cap)); }
    if (newDay) { bex.prev_close = bex.price; bex.day_open = bex.price; bex.day_high = bex.price; bex.day_low = bex.price; }
    bex.price = 1000 * cap / base;
    bex.fair = bex.price;
    bex.day_high = Math.max(bex.day_high, bex.price);
    bex.day_low = Math.min(bex.day_low, bex.price);
  }
  setMeta('mkt_trend', trend);
  return newsItems;
}

// 长时间未运行时的快速补算（不写历史，一步到位）
function fastForward(gapHours) {
  if (gapHours <= 0) return;
  const list = assets();
  const t = gapHours * DT;
  const upd = db.prepare('UPDATE assets SET price=?, fair=?, prev_close=?, day_open=?, day_high=?, day_low=? WHERE id=?');
  db.exec('BEGIN');
  for (const a of list) {
    a.fair = Math.max(1e-6, a.fair * Math.exp(a.mu * t));
    const drift = (MKT_MU * a.beta) * t;
    const shock = a.sigma * Math.sqrt(t) * gauss();
    let price = a.price * Math.exp(drift + shock * 0.5 - 0.5 * a.sigma * a.sigma * t);
    price = clamp(price, a.fair * 0.25, a.fair * 3);
    // 长期向内在价值靠拢
    price = Math.exp(0.45 * Math.log(price) + 0.55 * Math.log(a.fair));
    a.price = Math.max(price, 1e-6);
    a.prev_close = a.price; a.day_open = a.price; a.day_high = a.price; a.day_low = a.price;
    upd.run(a.price, a.fair, a.prev_close, a.day_open, a.day_high, a.day_low, a.id);
  }
  db.exec('COMMIT');
}

let advancing = false;
export function advanceMarket() {
  if (advancing) return;
  advancing = true;
  try {
    const target = currentGameHour();
    let mh = Number(getMeta('market_hour', '0'));
    if (target <= mh) return;

    let gap = target - mh;
    if (gap > MAX_DETAIL_TICKS) {
      fastForward(gap - MAX_DETAIL_TICKS);
      mh = target - MAX_DETAIL_TICKS;
      gap = MAX_DETAIL_TICKS;
    }
    const list = assets();
    const sectorSet = new Set(list.map(a => a.sector));
    const updA = db.prepare(`UPDATE assets SET price=?, prev_close=?, day_open=?, day_high=?, day_low=?,
                              fair=?, vol_state=?, last_ret=? WHERE id=?`);
    const insP = db.prepare('INSERT OR REPLACE INTO prices(asset_id,hour,price) VALUES(?,?,?)');
    const insN = db.prepare('INSERT INTO news(hour,scope,target,headline,impact) VALUES(?,?,?,?,?)');

    db.exec('BEGIN');
    for (let h = mh + 1; h <= target; h++) {
      const news = tickOnce(list, h, sectorSet);
      for (const n of news) insN.run(h, n.scope, n.target, n.headline, n.impact);
      for (const a of list) insP.run(a.id, h, a.price);
    }
    for (const a of list) updA.run(a.price, a.prev_close, a.day_open, a.day_high, a.day_low, a.fair, a.vol_state, a.last_ret, a.id);
    setMeta('market_hour', String(target));
    db.exec('COMMIT');

    // 清理历史
    if (target % 40 === 0) {
      setMeta('sector_mom', JSON.stringify(sectorMom));
      db.prepare('DELETE FROM prices WHERE hour < ?').run(target - HISTORY_KEEP);
      db.prepare('DELETE FROM news WHERE id NOT IN (SELECT id FROM news ORDER BY id DESC LIMIT 400)').run();
    }
  } finally { advancing = false; }
}

// 玩家交易造成的价格冲击
export function applyImpact(assetId, signedShares) {
  const a = assets().find(x => x.id === assetId);
  if (!a) return;
  const frac = signedShares / a.shares;
  const k = a.kind === 'crypto' ? 1.6 : 0.9;
  const mult = Math.exp(clamp(k * frac, -0.25, 0.25));
  a.price = Math.max(1e-6, a.price * mult);
  if (a.price > a.day_high) a.day_high = a.price;
  if (a.price < a.day_low) a.day_low = a.price;
  db.prepare('UPDATE assets SET price=?, day_high=?, day_low=? WHERE id=?').run(a.price, a.day_high, a.day_low, a.id);
}

export function allAssets() { return assets(); }
export function loadSectorMom() { try { sectorMom = JSON.parse(getMeta('sector_mom', '{}')); } catch { sectorMom = {}; } }
// 各城市商圈繁荣度：直接影响该城市所有店铺的营收
export function cityProsperity() {
  const out = {};
  for (const a of assets()) {
    if (a.kind !== 'district' || !a.link) continue;
    const base = out[a.link] || (out[a.link] = { sum: 0, n: 0 });
    base.sum += a.price / a.fair;   // 相对内在价值的繁荣度
    base.n++;
  }
  const res = {};
  for (const [city, v] of Object.entries(out)) res[city] = clamp(0.55 + 0.45 * (v.sum / v.n), 0.55, 1.75);
  return res;
}
export function assetById(id) { return assets().find(a => a.id === id); }
export function assetBySymbol(sym) { return assets().find(a => a.symbol === sym); }
export function history(assetId, limit = 240) {
  return db.prepare('SELECT hour, price FROM prices WHERE asset_id=? ORDER BY hour DESC LIMIT ?')
    .all(assetId, limit).reverse();
}
export function latestNews(limit = 40) {
  return db.prepare('SELECT * FROM news ORDER BY id DESC LIMIT ?').all(limit);
}
export function marketIndex() {
  const bex = assetBySymbol('BEXI');
  if (bex) return { level: bex.price, change: bex.prev_close ? (bex.price - bex.prev_close) / bex.prev_close : 0, symbol: 'BEXI' };
  const list = assets().filter(a => a.kind === 'stock');
  let cap = 0, prevCap = 0;
  for (const a of list) { cap += a.price * a.shares; prevCap += a.prev_close * a.shares; }
  return { level: cap / 1e9, change: prevCap ? (cap - prevCap) / prevCap : 0 };
}

// 批量迷你走势图数据（行情列表用），带短缓存
let sparkCache = { hour: -1, data: null };
export function sparklines(hours = 96, points = 32) {
  const target = Number(getMeta('market_hour', '0'));
  if (sparkCache.hour === target && sparkCache.data) return sparkCache.data;
  const rows = db.prepare('SELECT asset_id, hour, price FROM prices WHERE hour > ? ORDER BY asset_id, hour')
    .all(target - hours);
  const bySym = {};
  const idToSym = new Map(assets().map(a => [a.id, a.symbol]));
  const buckets = new Map();
  for (const r of rows) {
    let arr = buckets.get(r.asset_id);
    if (!arr) { arr = []; buckets.set(r.asset_id, arr); }
    arr.push(r.price);
  }
  for (const [id, arr] of buckets) {
    const sym = idToSym.get(id); if (!sym) continue;
    const step = Math.max(1, Math.floor(arr.length / points));
    const out = [];
    for (let i = 0; i < arr.length; i += step) out.push(Math.round(arr[i] * 1e6) / 1e6);
    if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
    bySym[sym] = out;
  }
  sparkCache = { hour: target, data: bySym };
  return bySym;
}

export function indexLevel(symbol) {
  const a = assetBySymbol(symbol);
  return a ? a.price : 100;
}
