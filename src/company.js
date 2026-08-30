// ── 创业公司：估值、增长、融资 ──────────────────────────────
import { db } from './db.js';
import * as M from './market.js';
import { bizRates, bizEnv, prestigeBonus, prestigeOf } from './sim.js';

// 公司主人的声望加成（店铺营收会跟着它走）
function prestigeBonusOf(userId) {
  const p = db.prepare('SELECT prestige FROM players WHERE user_id=?').get(userId);
  return prestigeBonus(prestigeOf(userId) + (p ? p.prestige : 0));
}
import { FOUND_FEE, INIT_SHARES, BASE_MULT, GROWTH_K, HEAT_K, SCALE_K,
         MULT_MIN, MULT_MAX, BOOK_RECOVERY, ILLIQUID,
         FAST_HALFLIFE_H, SLOW_HALFLIFE_H, VSLOW_HALFLIFE_H, LEAD_DAYS, GROWTH_MIN, GROWTH_MAX,
         MATURE_DAYS, REV_GROWTH_MIN, TURNAROUND_G, DOWN_SENS,
         ROUNDS, ROUND, STAGE, CO_SECTOR,
         IPO_MIN_ROUNDS, IPO_MIN_VAL, IPO_MIN_SHOPS, IPO_FLOAT, IPO_DISCOUNT, IPO_FEE,
         IPO_PRICE_MIN, IPO_PRICE_MAX, IPO_FLOAT_MIN, IPO_FLOAT_MAX,
         IPO_SUB_AT_PAR, IPO_SUB_ELAST, IPO_PULL_FILL, IPO_FLOAT_DRAG,
         IPO_HISTORY_HOURS, CO_SECTOR_MAP } from './catalog-company.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 一个人可以开很多家公司。不带 id 时返回最早的那家（作为默认）。
export function companiesOf(uid) {
  return db.prepare('SELECT * FROM companies WHERE user_id=? ORDER BY id').all(uid);
}
export function companyOf(uid, id) {
  if (id) return db.prepare('SELECT * FROM companies WHERE user_id=? AND id=?').get(uid, Number(id)) || null;
  return db.prepare('SELECT * FROM companies WHERE user_id=? ORDER BY id LIMIT 1').get(uid) || null;
}
export function companyShops(uid, coId) {
  return db.prepare('SELECT * FROM businesses WHERE user_id=? AND company_id=?').all(uid, coId);
}

// ── 估值 ────────────────────────────────────────────────────
// 利润法、营收法、清算法取最高的一个：
//   利润法  年利润 × 倍数        —— 成熟生意
//   营收法  年营收 × 增长溢价    —— 还没赚钱但跑得快的
//   清算法  投入的残值 + 现金    —— 兜底，公司再差也值这些
export function valuate(co, shops, pb = 0, prosp = {}, hour = 0) {
  const env = bizEnv();
  let daily = 0, dailyRev = 0, invested = 0;
  for (const b of shops) {
    const r = bizRates(b, pb, prosp[b.city] || 1, env.macro, env.month);
    daily += r.dailyNet;
    dailyRev += r.dailyRev;
    invested += b.invested;
  }
  // 估值要用平滑后的利润，不能用此刻的瞬时值。
  // 小生意的客流本来就在随机游走，毛利又薄，瞬时利润在盈亏之间来回翻——
  // 照那个数字估值，公司市值会毫无理由地一天砍半。现实里也是看滚动的经营
  // 业绩，不是看某一小时的流水。
  const spot = daily * 365;
  const smooth = (co.rate_fast || co.rate_slow)
    ? 0.6 * (co.rate_fast || 0) + 0.4 * (co.rate_slow || 0)
    : spot;
  const annual = smooth, annualRev = dailyRev * 365;
  const book = invested * BOOK_RECOVERY + co.cash;

  // 开了三天的公司谈不上增长率——头 30 个游戏日里逐步采信，避免刚开张就
  // 因为一个季度化的噪声被估到天上去。
  const ageDays = hour > 0 ? Math.max(0, (hour - co.founded_hour) / 24) : 999;
  const maturity = clamp(ageDays / MATURE_DAYS, 0, 1);
  const gRaw = clamp(co.growth || 0, GROWTH_MIN, GROWTH_MAX);
  const g = gRaw * maturity;

  const heat = M.sectorMomentum(co.sector);
  const scale = Math.log10(Math.max(1, shops.length)) * SCALE_K;
  // 下跌对倍数的影响比上涨钝一些：生意在缩水该压估值，但不该一读到负增长
  // 就直接砸到地板，何况小生意的利润本来就在噪声里游走。
  const gEffect = g >= 0 ? g * GROWTH_K : g * GROWTH_K * DOWN_SENS;
  const mult = clamp(BASE_MULT + gEffect + heat * HEAT_K + scale, MULT_MIN, MULT_MAX);

  const byEarnings = Math.max(0, annual) * mult;
  // 营收法只留给「还没赚钱但跑得飞快」的公司——市场肯按营收给钱，正是因为
  // 还没有利润可看。已经盈利的公司就按利润估，否则一家赚 4 万的小连锁会被
  // 营收法抬到 56 倍市盈率去。
  const revMult = (annual <= 0 && g >= REV_GROWTH_MIN)
    ? clamp(0.35 + (g - REV_GROWTH_MIN) * 1.0, 0.35, 3.5) : 0;
  const byRevenue = annualRev * revMult;
  const byBook = book * 0.85;

  const value = Math.max(byEarnings, byRevenue, byBook, 1);
  const basis = value === byEarnings ? 'earnings' : value === byRevenue ? 'revenue' : 'book';
  // 展示用的倍数要跟实际采用的估值法对得上
  const shownMult = basis === 'earnings' ? mult
    : basis === 'revenue' ? revMult
    : (annual > 0 ? value / annual : 0);
  return { value, basis, annual, spot, annualRev, daily, book, mult, shownMult, growth: g, growthRaw: gRaw,
           maturity, ageDays, heat, scale, shops: shops.length, byEarnings, byRevenue, byBook };
}

// 每小时推进：利润的两条指数均线，以及增长率
//
// 增长率 = 平滑利润线自身的斜率，年化。这样定义有两个好处：
// 持续增长时它收敛到真实的增长率；开一家新店造成的阶跃只会让它翘一下，
// 随着均线追上来自己退回去——阶跃不是增长。
const K_FAST = 1 - Math.exp(-1 / FAST_HALFLIFE_H);
const K_SLOW = 1 - Math.exp(-1 / SLOW_HALFLIFE_H);
const K_VSLOW = 1 - Math.exp(-1 / VSLOW_HALFLIFE_H);
const ANNUALISE = 365 / LEAD_DAYS;
export function stepGrowth(co, annualRate) {
  // 三条线在第一次拿到「像样的」利润读数时一起落位。
  // 从 0 爬上来那一段会被读成暴涨；用刚开张时还在亏钱的读数当基准，
  // 又会让之后的一切都显得在暴跌。所以等到真的开始赚钱再起步。
  if (!co.rate_slow && !co.rate_fast && !co.rate_vslow) {
    if (annualRate <= 0) return;                         // 还没赚钱，先不定基准
    co.rate_fast = co.rate_slow = co.rate_vslow = annualRate;
    return;
  }
  co.rate_fast += (annualRate - co.rate_fast) * K_FAST;
  co.rate_slow += (annualRate - co.rate_slow) * K_SLOW;
  co.rate_vslow = (co.rate_vslow || co.rate_slow) + (annualRate - (co.rate_vslow || co.rate_slow)) * K_VSLOW;
  let g;
  if (co.rate_slow > 1 && co.rate_vslow > 1) g = Math.log(co.rate_slow / co.rate_vslow) * ANNUALISE;
  else if (co.rate_slow > 1) g = TURNAROUND_G;           // 刚扭亏为盈
  else g = -0.3;                                          // 还在亏钱
  co.growth = clamp(g, GROWTH_MIN, GROWTH_MAX);
}

// ── 融资 ────────────────────────────────────────────────────
// 投资人给的估值总比你自己算的低。增长越好、信用越好，压得越少。
export function roundOffer(co, val, creditScore = 680) {
  const r = ROUNDS[co.round_n];
  if (!r) return null;
  const growthBump = clamp(co.growth || 0, 0, 1.5) * 0.10;
  const creditBump = clamp((creditScore - 600) / 300, -0.2, 0.2) * 0.06;
  const disc = clamp(r.disc + growthBump + creditBump, 0.5, 0.98);
  const pre = val.value * disc;
  const raise = pre * r.sell / (1 - r.sell);
  const post = pre + raise;
  const newShares = co.shares * r.sell / (1 - r.sell);
  const playerAfter = co.player_shares / (co.shares + newShares);
  return { round: r, disc, pre, raise, post, newShares,
           stakeBefore: co.player_shares / co.shares, stakeAfter: playerAfter,
           ok: val.value >= r.minVal && val.shops >= r.minShops,
           needVal: r.minVal, needShops: r.minShops };
}

// 未上市股权计入身家时要打折——卖不掉的钱不算钱
export function stakeValue(co, val) {
  if (!co) return 0;
  if (co.stage === 'public' && co.asset_id) {
    const a = M.assetById(co.asset_id);
    if (a) return co.player_shares * a.price;
  }
  return val.value * (co.player_shares / co.shares) * ILLIQUID;
}

// ── 上市 ────────────────────────────────────────────────────
// 上市之后创始人的持股就是一条普通持仓：可以卖，也可以在市场上买回来。
// 所以 player_shares 要以 holdings 为准，否则两边会各说各的。
export function syncPublicStake(co) {
  if (!co || co.stage !== 'public' || !co.asset_id) return co;
  const h = db.prepare('SELECT qty FROM holdings WHERE user_id=? AND asset_id=?').get(co.user_id, co.asset_id);
  const qty = h ? h.qty : 0;
  if (Math.abs(qty - co.player_shares) > 1e-6) {
    co.player_shares = qty;
    db.prepare('UPDATE companies SET player_shares=? WHERE id=?').run(qty, co.id);
  }
  return co;
}

// 上市方案：发行价按估值打个折（真实 IPO 都要给二级市场留出上涨空间）
// price 和 float 都可以自己填。承销商只给建议，敢不敢偏离是你的事：
//   定得高 → 簿记认购不足，发不满，甚至发不出去；上市当天就破发
//   定得低 → 钱少拿了，但当天大涨，声望和口碑都在
export function ipoPlan(co, val, marketLevel = 1, want = {}) {
  const rounds = co.round_n;
  const ok = rounds >= IPO_MIN_ROUNDS && val.value >= IPO_MIN_VAL
          && val.shops >= IPO_MIN_SHOPS && val.annual > 0;
  // 行情好的时候承销商敢定高价，熊市里就得让利
  const mood = clamp(marketLevel, 0.75, 1.35);
  const float = clamp(Number(want.float) || IPO_FLOAT, IPO_FLOAT_MIN, IPO_FLOAT_MAX);
  // 卖得越多，机构越要压价——一次消化四成股本，谁都要个折扣
  const sizeDrag = 1 - IPO_FLOAT_DRAG * (float - IPO_FLOAT);
  const disc = clamp(IPO_DISCOUNT * mood * sizeDrag, 0.55, 1.05);
  const preVal = val.value * disc;
  const indPrice = preVal / co.shares;                 // 承销商的建议价
  const fairPrice = val.value / co.shares;             // 二级市场大致会落在这儿
  const price = clamp(Number(want.price) > 0 ? Number(want.price) : indPrice,
                      indPrice * IPO_PRICE_MIN, indPrice * IPO_PRICE_MAX);
  const ratio = price / indPrice;

  // 簿记：定价越高，认购倍数越低。建议价上 1.5 倍认购，是个健康的簿记
  const sub = IPO_SUB_AT_PAR * Math.pow(ratio, -IPO_SUB_ELAST);
  const fill = clamp(sub, 0, 1);                       // 真正卖得出去的比例
  const pulled = fill < IPO_PULL_FILL;                 // 认购太差，这单发不出去

  const wantShares = co.shares * float / (1 - float);
  const newShares = wantShares * fill;
  const gross = newShares * price;
  const fee = gross * IPO_FEE;
  const sharesAfter = co.shares + newShares;
  // 上市首日的落点：市场认的是价值，不是你的发行价
  const openPrice = fairPrice;
  const pop = price > 0 ? openPrice / price - 1 : 0;   // 正数是涨，负数是破发
  return {
    ok, rounds, needRounds: IPO_MIN_ROUNDS, needVal: IPO_MIN_VAL, needShops: IPO_MIN_SHOPS,
    needProfit: val.annual <= 0,
    disc, preVal, indPrice, fairPrice, price, ratio, sub, fill, pulled,
    priceMin: indPrice * IPO_PRICE_MIN, priceMax: indPrice * IPO_PRICE_MAX,
    floatMin: IPO_FLOAT_MIN, floatMax: IPO_FLOAT_MAX, floatDefault: IPO_FLOAT,
    pullFill: IPO_PULL_FILL,
    wantShares, newShares, gross, fee, net: gross - fee,
    sharesAfter,
    stakeBefore: co.player_shares / co.shares,
    stakeAfter: co.player_shares / sharesAfter,
    marketCap: sharesAfter * price,
    openPrice, pop, capAtOpen: sharesAfter * openPrice,
    float,
  };
}

// 上市：把公司塞进行情表，成为第 N 支可交易的股票
export function goPublic(co, val, plan, hour) {
  const sector = CO_SECTOR_MAP[co.sector] || '日用消费';
  const shares = plan.sharesAfter;
  const price = plan.price;                    // 发行价：你自己定的那个
  // 上市首日开在市场认可的价上，不是开在你的发行价上。
  // 定低了就大涨，定高了就破发——发行价定得再高，市场也不认。
  const open = Math.max(price * 0.35, plan.openPrice || price);
  const eps = val.annual / shares;
  const name = co.name_en || co.name;
  // 波动率随规模递减：小盘股本来就更颠
  const sigma = clamp(0.62 - 0.06 * Math.log10(Math.max(1e5, plan.marketCap) / 1e5), 0.26, 0.70);
  const info = `${co.name}（${name}）· ${sector}板块 · 由你创办并带上市`;
  const r = db.prepare(`INSERT INTO assets
    (symbol,name,zh,kind,sector,unit,price,prev_close,day_open,day_high,day_low,fair,mu,sigma,beta,
     div_yield,shares,max_stake,eps,desc,link)
    VALUES(?,?,?,'stock',?,'股',?,?,?,?,?,?,?,?,?,0,?,1,?,?,?)`)
    .run(co.ticker, name, co.name, sector, open, price, open, Math.max(open, price), Math.min(open, price),
         val.value / shares, clamp(val.growth * 0.5, -0.10, 0.35), sigma, 1.05,
         shares, eps, info, 'co:' + co.id);
  const assetId = Number(r.lastInsertRowid);

  // 补一段上市前的价格历史，图表不至于只有一个点
  const insP = db.prepare('INSERT OR REPLACE INTO prices(asset_id,hour,price) VALUES(?,?,?)');
  let px = price * 0.82;
  for (let h = hour - IPO_HISTORY_HOURS; h <= hour; h++) {
    const to = price;                                    // 向发行价收敛
    px = px + (to - px) * 0.035 + px * 0.012 * (Math.random() - 0.5);
    insP.run(assetId, h, Math.max(price * 0.5, px));
  }
  insP.run(assetId, hour, open);

  db.prepare(`UPDATE companies SET stage='public', shares=?, cash=cash+?, raised=raised+?,
              asset_id=?, ipo_hour=?, ipo_price=?, round_val=? WHERE id=?`)
    .run(shares, plan.net, plan.net, assetId, hour, price, plan.marketCap, co.id);
  // 创始人的股份落成一条真的持仓
  db.prepare(`INSERT INTO holdings(user_id,asset_id,qty,cost) VALUES(?,?,?,?)
              ON CONFLICT(user_id,asset_id) DO UPDATE SET qty=qty+excluded.qty, cost=cost+excluded.cost`)
    .run(co.user_id, assetId, co.player_shares, co.player_shares * price);
  M.invalidate();
  return { assetId, price, open, pop: price > 0 ? open / price - 1 : 0,
           shares, newShares: plan.newShares, fill: plan.fill,
           raised: plan.net, marketCap: shares * open };
}

// 上市公司的内在价值要跟着真实经营走，股价才会围着基本面转，
// 而不是变成一支跟公司毫无关系的随机游走。
export function syncPublicFundamentals() {
  const rows = db.prepare("SELECT * FROM companies WHERE stage='public' AND asset_id>0").all();
  if (!rows.length) return;
  const prosp = M.cityProsperity();
  const upd = db.prepare('UPDATE assets SET fair=?, eps=?, mu=? WHERE id=?');
  for (const co of rows) {
    const shops = db.prepare('SELECT * FROM businesses WHERE user_id=? AND company_id=?').all(co.user_id, co.id);
    // 声望加成要跟公司页用同一个，否则两处算出来的内在价值对不上
    const val = valuate(co, shops, prestigeBonusOf(co.user_id), prosp, M.currentGameHour());
    const fair = Math.max(1e-4, val.value / Math.max(1, co.shares));
    upd.run(fair, val.annual / Math.max(1, co.shares),
            Math.max(-0.10, Math.min(0.35, val.growth * 0.5)), co.asset_id);
  }
  M.invalidate();
}

// ── 市场份额：你做大了，别人就得让出位置 ────────────────────
// 你的连锁开到一定规模，它抢的就是同一个赛道里那些上市公司的生意。
// 折算方式：把你的年营收按典型的市销率折成一个「等效市值」，
// 和该板块所有上市公司的总市值比，得出你占了多大份额；
// 份额越高，那个板块的内在价值被侵蚀得越快。
export const PS_MULTIPLE = 3;          // 年营收 → 等效市值
export const EROSION_K = 0.55;         // 拿到 100% 份额时，对手每年掉多少内在价值
export const EROSION_MIN = 0.004;      // 份额低于这个数就当没有影响
const HOURS_PER_YEAR_E = 365 * 24;

// 玩家在各个板块的等效规模（按 assets 里的板块名归类）
export function playerSectorScale() {
  const rows = db.prepare('SELECT * FROM companies').all();
  if (!rows.length) return new Map();
  const prosp = M.cityProsperity();
  const out = new Map();               // sector → { scale, byUser: Map(uid → {scale, name}) }
  for (const co of rows) {
    const sec = CO_SECTOR_MAP[co.sector] || '日用消费';
    const shops = db.prepare('SELECT * FROM businesses WHERE user_id=? AND company_id=?').all(co.user_id, co.id);
    if (!shops.length) continue;
    const v = valuate(co, shops, prestigeBonusOf(co.user_id), prosp, M.currentGameHour());
    const scale = Math.max(0, v.annualRev) * PS_MULTIPLE;
    if (scale <= 0) continue;
    const e = out.get(sec) || { scale: 0, players: [] };
    e.scale += scale;
    e.players.push({ userId: co.user_id, coId: co.id, name: co.name, scale });
    out.set(sec, e);
  }
  return out;
}

// 每次世界结算时调用：把份额换算成对手内在价值的持续下压
export function applyMarketShare() {
  const mine = playerSectorShareGuard();
  if (!mine) return [];
  const { scales, hours } = mine;
  if (!scales.size || hours <= 0) return [];
  const caps = new Map();
  for (const a of M.allAssets()) {
    if (a.kind !== 'stock') continue;
    caps.set(a.sector, (caps.get(a.sector) || 0) + a.price * a.shares);
  }
  const upd = db.prepare('UPDATE assets SET fair=? WHERE id=?');
  const hits = [];
  for (const [sec, e] of scales) {
    const cap = caps.get(sec) || 0;
    if (cap <= 0) continue;
    const share = e.scale / (e.scale + cap);
    if (share < EROSION_MIN) continue;
    // 按真正过去了多少游戏小时来算。行情结算是每 5 秒现实时间跑一次，
    // 但一次可能补上几十上百个游戏小时，只扣一小时的份是不对的。
    const drag = -share * EROSION_K / HOURS_PER_YEAR_E * hours;
    let removed = 0;
    for (const a of M.allAssets()) {
      if (a.kind !== 'stock' || a.sector !== sec) continue;
      if (a.link && a.link.startsWith('co:')) continue;    // 玩家自己上市的公司不侵蚀自己
      const was = a.fair;
      a.fair = Math.max(1e-6, a.fair * Math.exp(drag));
      removed += (was - a.fair) * a.shares;                // 从对手手里拿走了多少市值
      upd.run(a.fair, a.id);
    }
    // 累计下来，玩家才看得见自己到底动了别人多少 —— 单看每小时那点变化是看不出来的
    const key = 'erosion:' + sec;
    const total = Number(M.getMeta(key, '0')) + removed;
    M.setMeta(key, String(total));

    // 跨过门槛时，世界会注意到你
    const marks = [0.01, 0.05, 0.12, 0.25, 0.45];
    const mk = 'erosion_mark:' + sec;
    const seen = Number(M.getMeta(mk, '0'));
    const now = marks.filter(x => share >= x).length;
    if (now > seen) {
      M.setMeta(mk, String(now));
      const who = e.players[0]?.name || '';
      M.pushNews('sector', sec, { zh: `${who} 在${sec}赛道的份额已经到了 ${(share * 100).toFixed(0)}%，行业格局正在改写`,
        en: `${who} now holds ${(share * 100).toFixed(0)}% of ${sec} — the incumbents are being rewritten` },
        -share * 0.25);
    }
    hits.push({ sector: sec, share, annualDrag: share * EROSION_K, players: e.players, removed: total });
  }
  if (hits.length) M.invalidate();
  return hits;
}

// 距上次结算过去了多少游戏小时；顺便把玩家的板块规模一起取回来
function playerSectorShareGuard() {
  const now = M.currentGameHour();
  const last = Number(M.getMeta('erosion_hour', '0'));
  const hours = last ? Math.min(24 * 30, now - last) : 1;   // 首次只算一小时
  if (hours <= 0) return null;
  M.setMeta('erosion_hour', String(now));
  return { scales: playerSectorScale(), hours };
}

// 你从某个板块的对手手里累计拿走了多少市值
export function erosionTotal(sector) { return Number(M.getMeta('erosion:' + sector, '0')); }

export { IPO_MIN_ROUNDS, IPO_MIN_VAL, IPO_MIN_SHOPS, IPO_FLOAT };

export { FOUND_FEE, INIT_SHARES, ROUNDS, ROUND, STAGE, CO_SECTOR, ILLIQUID };
