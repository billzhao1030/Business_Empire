// ── 创业公司：估值、增长、融资 ──────────────────────────────
import { db } from './db.js';
import * as M from './market.js';
import { bizRates } from './sim.js';
import { FOUND_FEE, INIT_SHARES, BASE_MULT, GROWTH_K, HEAT_K, SCALE_K,
         MULT_MIN, MULT_MAX, BOOK_RECOVERY, ILLIQUID,
         FAST_HALFLIFE_H, SLOW_HALFLIFE_H, LEAD_DAYS, GROWTH_MIN, GROWTH_MAX,
         MATURE_DAYS, REV_GROWTH_MIN, TURNAROUND_G, GROWTH_SMOOTH,
         ROUNDS, ROUND, STAGE, CO_SECTOR } from './catalog-company.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function companyOf(uid) {
  return db.prepare('SELECT * FROM companies WHERE user_id=?').get(uid) || null;
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
  const mult = clamp(BASE_MULT + g * GROWTH_K + heat * HEAT_K + scale, MULT_MIN, MULT_MAX);

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
const HOURS_PER_YEAR = 365 * 24;
export function stepGrowth(co, annualRate) {
  // 头一次：两条线直接落在当前水平上。从 0 慢慢爬上去的那一段本身会被
  // 读成暴涨——刚注册的公司凭空拿到 400% 增长，就是这么来的。
  if (!co.rate_slow && !co.rate_fast) {
    co.rate_fast = co.rate_slow = annualRate;
    return;
  }
  co.rate_fast += (annualRate - co.rate_fast) * K_FAST;
  const prev = co.rate_slow;
  co.rate_slow += (annualRate - co.rate_slow) * K_SLOW;
  let g;
  if (prev > 1 && co.rate_slow > 1) {
    // 单次读数夹在合理范围内：一口气开四家店是阶跃，不是「年化 600% 的增长」
    g = clamp(Math.log(co.rate_slow / prev) * HOURS_PER_YEAR, -1, 1.5);
  } else if (co.rate_slow > 1) {
    g = TURNAROUND_G;                                    // 刚扭亏为盈
  } else {
    g = -0.3;                                            // 还在亏钱
  }
  // 输出再平滑一次（时间常数约 7 个游戏日），高增长得靠连着几个月做出来
  co.growth = clamp(co.growth * (1 - GROWTH_SMOOTH) + g * GROWTH_SMOOTH, GROWTH_MIN, GROWTH_MAX);
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

export { FOUND_FEE, INIT_SHARES, ROUNDS, ROUND, STAGE, CO_SECTOR, ILLIQUID };
