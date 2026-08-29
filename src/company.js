// ── 创业公司：估值、增长、融资 ──────────────────────────────
import { db } from './db.js';
import * as M from './market.js';
import { bizRates, prestigeBonus, prestigeOf } from './sim.js';

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
  let daily = 0, dailyRev = 0, invested = 0;
  for (const b of shops) {
    const r = bizRates(b, pb, prosp[b.city] || 1);
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
export function ipoPlan(co, val, marketLevel = 1) {
  const rounds = co.round_n;
  const ok = rounds >= IPO_MIN_ROUNDS && val.value >= IPO_MIN_VAL
          && val.shops >= IPO_MIN_SHOPS && val.annual > 0;
  // 行情好的时候承销商敢定高价，熊市里就得让利
  const mood = clamp(marketLevel, 0.75, 1.35);
  const disc = clamp(IPO_DISCOUNT * mood, 0.65, 1.05);
  const preVal = val.value * disc;
  const price = preVal / co.shares;
  const newShares = co.shares * IPO_FLOAT / (1 - IPO_FLOAT);
  const gross = newShares * price;
  const fee = gross * IPO_FEE;
  return {
    ok, rounds, needRounds: IPO_MIN_ROUNDS, needVal: IPO_MIN_VAL, needShops: IPO_MIN_SHOPS,
    needProfit: val.annual <= 0,
    disc, preVal, price, newShares, gross, fee, net: gross - fee,
    sharesAfter: co.shares + newShares,
    stakeBefore: co.player_shares / co.shares,
    stakeAfter: co.player_shares / (co.shares + newShares),
    marketCap: (co.shares + newShares) * price,
    float: IPO_FLOAT,
  };
}

// 上市：把公司塞进行情表，成为第 N 支可交易的股票
export function goPublic(co, val, plan, hour) {
  const sector = CO_SECTOR_MAP[co.sector] || '日用消费';
  const shares = plan.sharesAfter;
  const price = plan.price;
  const eps = val.annual / shares;
  const name = co.name_en || co.name;
  // 波动率随规模递减：小盘股本来就更颠
  const sigma = clamp(0.62 - 0.06 * Math.log10(Math.max(1e5, plan.marketCap) / 1e5), 0.26, 0.70);
  const info = `${co.name}（${name}）· ${sector}板块 · 由你创办并带上市`;
  const r = db.prepare(`INSERT INTO assets
    (symbol,name,zh,kind,sector,unit,price,prev_close,day_open,day_high,day_low,fair,mu,sigma,beta,
     div_yield,shares,max_stake,eps,desc,link)
    VALUES(?,?,?,'stock',?,'股',?,?,?,?,?,?,?,?,?,0,?,1,?,?,?)`)
    .run(co.ticker, name, co.name, sector, price, price, price, price, price,
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
  insP.run(assetId, hour, price);

  db.prepare(`UPDATE companies SET stage='public', shares=?, cash=cash+?, raised=raised+?,
              asset_id=?, ipo_hour=?, ipo_price=?, round_val=? WHERE id=?`)
    .run(shares, plan.net, plan.net, assetId, hour, price, plan.marketCap, co.id);
  // 创始人的股份落成一条真的持仓
  db.prepare(`INSERT INTO holdings(user_id,asset_id,qty,cost) VALUES(?,?,?,?)
              ON CONFLICT(user_id,asset_id) DO UPDATE SET qty=qty+excluded.qty, cost=cost+excluded.cost`)
    .run(co.user_id, assetId, co.player_shares, co.player_shares * price);
  M.invalidate();
  return { assetId, price, shares, raised: plan.net, marketCap: plan.marketCap };
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

export { IPO_MIN_ROUNDS, IPO_MIN_VAL, IPO_MIN_SHOPS, IPO_FLOAT };

export { FOUND_FEE, INIT_SHARES, ROUNDS, ROUND, STAGE, CO_SECTOR, ILLIQUID };
