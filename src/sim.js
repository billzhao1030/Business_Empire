// 玩家经济引擎：实业经营、银行利息、股息、税收、贷款/房贷、房产指数、随机事件
import { db } from './db.js';
import * as M from './market.js';
import { BIZ_TYPES, CITIES, ITEM_TYPES, ITEM_CATS, REGIONS, LIFE_EVENTS, JOBS, RIVALS,
         ILLNESSES, TRIPS, FLIGHT_CLASSES, isOpenAt, openHours,
         COGS_RATE, REV_PER_WAGE, MGMT_WITH_MANAGER, AWAKE_HOURS, MGMT_MAX_WITH_JOB } from './catalog-content.js';

const { YEAR_HOURS, MONTH_HOURS, DAY_HOURS } = M;

export const RATES = {
  corpTax: 0.25,
  divTax: 0.10,
  capGainTax: 0.20,
  propertyTax: 0.0008,
  commission: 0.001,
  minCommission: 5,
  spread: 0.0004,
};
export const START_CASH = 0;

// 离线结算上限：最多只补算这么多游戏小时（默认 7 个游戏日）
// 市场行情仍会照常推进整段时间——只是你的生意最多累积一周的收益
export const OFFLINE_CAP_HOURS = Math.max(24, Number(process.env.OFFLINE_CAP_DAYS || 7) * 24);

// ── 利率随央行政策利率浮动 ────────────────────────────────
export function savingsRate()  { return Math.max(0.002, M.policyRate() * 0.85); }
export function overdraftRate(){ return M.policyRate() + 0.19; }
export function fixedRates() {
  const pr = M.policyRate();
  return { 3: pr + 0.008, 6: pr + 0.015, 12: pr + 0.024, 24: pr + 0.032 };
}
export const MORTGAGE_TERMS = [60, 120, 240, 360];
export const MIN_DOWN = 0.20;

const BIZ = Object.fromEntries(BIZ_TYPES.map(b => [b.id, b]));
const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));
const ITEM = Object.fromEntries(ITEM_TYPES.map(i => [i.id, i]));
const REGION = Object.fromEntries(REGIONS.map(r => [r.id, r]));
export { BIZ, CITY, ITEM, REGION, ITEM_CATS };

const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
const round2 = x => Math.round(x * 100) / 100;
// 账本条目：存 i18n key + 参数，前端按语言渲染
export const L = (k, p = {}) => JSON.stringify({ k, p });
const NM = def => ({ zh: def?.name || '', en: def?.en || def?.name || '' });

export function loanRate(score) { return M.policyRate() + 0.022 + clamp((850 - score) / 550, 0, 1) * 0.16; }
export function mortgageRate(score) { return M.policyRate() + 0.004 + clamp((850 - score) / 550, 0, 1) * 0.065; }
export function levelRevMult(level) { return Math.pow(1.32, level - 1); }
export function levelCostMult(level) { return Math.pow(1.18, level - 1); }
export function upgradeCost(def, city, level) { return Math.round(def.cost * city.costMult * 0.55 * Math.pow(1.5, level - 1)); }
export function marketingCost(def, city, m) { return Math.round(def.cost * city.costMult * 0.10 * Math.pow(1.6, m)); }
export const MAX_LEVEL = 12, MAX_MARKETING = 6;
export const JOB = Object.fromEntries(JOBS.map(j => [j.id, j]));
export { JOBS, RIVALS };
export function hasCar(userId) {
  const rows = db.prepare('SELECT type_id FROM items WHERE user_id=?').all(userId);
  return rows.some(r => ITEM[r.type_id]?.car);
}
export function jobOf(p) { return JOB[p.job_id] || null; }
export function nextJob(p) {
  const cur = JOBS.findIndex(j => j.id === p.job_id);
  return JOBS[cur + 1] || null;
}
// 一次加班 = 一个游戏工时：接单后必须等这个工时在游戏里真正过完，才能接下一单
export function overtimePay(p, night = false) {
  const j = jobOf(p);
  if (!j) return 0;
  return j.wage * (night ? NIGHT_MULT : OVERTIME_MULT) * efficiency(p.stamina);
}
export const HUSTLE_COOLDOWN_MS = 0;
// ── 作息与体力 ──────────────────────────────────────────────
export const WAKE_HOUR = 7, SLEEP_HOUR = 23;      // 07:00 起床，23:00 睡觉
export const WORK_START = 9, WORK_END = 17;       // 正常班 09:00–17:00，共 8 小时
export const WORK_HOURS_PER_DAY = WORK_END - WORK_START;
export const OVERTIME_MAX_HOURS = 6;              // 每游戏日最多加班 6 小时
export const OVERTIME_MULT = 1.6;                 // 加班费倍率
export const STAMINA_MAX = 100;
export const ST_SLEEP = 8.5, ST_SHIFT = -5, ST_OVERTIME = -9, ST_AWAKE = -1.5;
// 连轴转的代价：连续工作越久，睡眠越不解乏，压力越压不下去
export const STREAK_FREE_DAYS = 3;          // 前三天不算累
export function restQuality(streak) { return Math.max(0.42, 1 - 0.075 * Math.max(0, streak - STREAK_FREE_DAYS)); }
export function streakStress(streak) { return Math.max(0, streak - 4) * 0.055; }   // 每小时
export const ST_NIGHT = -20;                      // 熬夜加班的体力代价
export const NIGHT_MULT = 2.2;                    // 夜班津贴
export const ST_MIN_FOR_OT = 15;                  // 体力低于此值无法加班

// ── 精神压力 ────────────────────────────────────────────────
export const STRESS_MAX = 100;
export const STRESS_OT = 1.6, STRESS_NIGHT = 3.4;   // 加班 / 熬夜带来的压力
export const STRESS_SLEEP = -1.15;                  // 睡眠缓解（每日约 -9，且受休息质量折损）
export const STRESS_DEBT_K = 75;                    // 负债率系数（超出 35% 的部分）
export const STRESS_BURDEN_K = 42;                  // 月供占收入比系数
export const LEV_SAFE = 0.35, BURDEN_SAFE = 0.35;   // 安全线以内不产生压力
export const STRESS_MAX_FOR_OT = 78;                // 压力过高时干不动加班
export const SICK_FLOOR = 55;                       // 低于此压力不会生病
export { ILLNESSES, TRIPS, FLIGHT_CLASSES };
export const ILL = Object.fromEntries(ILLNESSES.map(i => [i.id, i]));
export const TRIP = Object.fromEntries(TRIPS.map(t => [t.id, t]));

// 压力对产出的折损：50 以下无感，往上线性衰减到 0.7
export function stressFactor(stress) {
  return stress <= 50 ? 1 : Math.max(0.7, 1 - (stress - 50) / 167);
}
// 每小时生病概率
export function sickChance(stress) {
  return stress <= SICK_FLOOR ? 0 : Math.min(0.012, (stress - SICK_FLOOR) * 0.00028);
}
export function pickIllness(stress) {
  const pool = ILLNESSES.filter(i => stress >= i.minStress);
  return pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 1 + Math.floor((stress - SICK_FLOOR) / 12)))] : ILLNESSES[0];
}
export function medicalCost(ill, netWorth) {
  return Math.max(ill.base, Math.abs(netWorth) * ill.nwRate);
}
export function tripCost(trip, cls) {
  const c = FLIGHT_CLASSES.find(x => x.id === cls) || FLIGHT_CLASSES[0];
  if (!trip.flight) return trip.cost;
  return Math.round(trip.cost * (c.mult || 0) * 0.45 + trip.cost * 0.55);   // 机票 + 地面开销
}

export function dayPhase(hod) {
  if (hod >= SLEEP_HOUR || hod < WAKE_HOUR) return 'sleep';
  if (hod < WORK_START) return 'morning';
  if (hod < WORK_END) return 'shift';
  return 'evening';
}
// 疲劳会直接压低工作效率
export function efficiency(stamina) {
  if (stamina >= 60) return 1;
  if (stamina >= 25) return 0.75 + 0.25 * (stamina - 25) / 35;
  return 0.40 + 0.35 * Math.max(0, stamina) / 25;
}

// ── 定价策略 ────────────────────────────────────────────────
export const PRICE_TIERS = [
  { v:-2, zh:'极致低价', en:'Deep Discount',  descZh:'客单价 -44%，客流大涨，长期抢占市场份额', descEn:'Ticket -44%, traffic surges, builds long-term market share' },
  { v:-1, zh:'亲民定价', en:'Value Pricing',  descZh:'客单价 -22%，客流上升', descEn:'Ticket -22%, traffic rises' },
  { v: 0, zh:'标准定价', en:'Standard',       descZh:'行业常规价位，供需平衡', descEn:'Industry-standard pricing, balanced demand' },
  { v: 1, zh:'品质溢价', en:'Premium',        descZh:'客单价 +22%，客流下滑，短期利润更高', descEn:'Ticket +22%, traffic slips, higher near-term profit' },
  { v: 2, zh:'奢华定位', en:'Luxury Harvest', descZh:'客单价 +44%，客流大幅萎缩，长期会流失客户', descEn:'Ticket +44%, traffic collapses, customers churn over time' },
];
export { COGS_RATE, REV_PER_WAGE, MGMT_WITH_MANAGER, AWAKE_HOURS, MGMT_MAX_WITH_JOB };

export function bizHours(b) {
  const def = BIZ[b.type_id];
  return b.all_day ? [0, 24] : def.hours;
}
export function bizOpenNow(b, hod) { return isOpenAt(bizHours(b), hod); }

// 每营业小时的经营数据。房租等固定成本 24 小时都在烧，单独计。
export function bizRates(b, pb = 0, prosp = 1) {
  const def = BIZ[b.type_id], city = CITY[b.city] || CITIES[1];
  if (!def) return { rev: 0, cost: 0, net: 0, potential: 0, capacity: 0, util: 1, recStaff: 0 };
  const tier = b.price_tier || 0;
  const priceMult = 1 + 0.22 * tier;
  const volumeMult = 1 - 0.15 * tier;
  const lvR = levelRevMult(b.level), lvC = Math.pow(1.25, b.level - 1);   // 规模越大，场地越大、房租越贵
  const condFactor = 0.5 + 0.5 * b.condition;

  const baseRev = def.rev * city.revMult;
  const scale = lvR * (1 + 0.10 * b.marketing) * (1 + pb) * prosp;
  const volume = baseRev * scale * volumeMult * b.demand * condFactor;
  const potential = volume * priceMult;

  const wage = def.wage * city.wageMult;                        // 当地工资水平
  const capPerStaff = wage * REV_PER_WAGE * priceMult;          // 一名员工能支撑的营收
  const staff = Math.max(0, b.staff | 0);
  const capacity = staff * capPerStaff;
  const rev = Math.min(potential, capacity);
  const util = potential > 0 ? Math.min(1, capacity / potential) : 1;
  const recStaff = Math.max(1, Math.ceil(potential / Math.max(capPerStaff, 1e-9)));

  // 营业时才发生：进货成本 + 人工
  const cogs = rev * COGS_RATE;
  const wages = staff * wage;
  const openCost = cogs + wages;
  // 关门也要付：房租（含营销投放与店长工资）
  const rentH = def.hourlyRent * city.rentMult * lvC * (1 + 0.10 * b.marketing) * (1 + 0.15 * (1 - b.condition));
  const managerH = b.manager ? def.managerSalary * city.wageMult / (30 * 24) : 0;
  const idleCost = rentH + managerH;

  const hrs = openHours(bizHours(b));
  const dailyNet = hrs * (rev - openCost) - 24 * idleCost;
  const extraHrs = 24 - hrs;
  const allDayGainPerHour = extraHrs > 0 ? extraHrs * Math.max(0, rev - openCost) / 24 : 0;
  const allDayCost = extraHrs > 0 ? Math.round(allDayGainPerHour * 24 * def.payDays) : null;

  return { rev, cost: openCost + idleCost, net: rev - openCost - idleCost, def, city,
           potential, capacity, util, recStaff, wage, wages, cogs,
           rent: rentH, managerCost: managerH, fixed: idleCost, varc: cogs,
           openCost, idleCost, hours: bizHours(b), openHrs: hrs, dailyNet, dailyRev: hrs * rev,
           monthlyRent: def.monthlyRent * city.rentMult * lvC, managerSalary: def.managerSalary * city.wageMult,
           mgmt: b.manager ? MGMT_WITH_MANAGER : def.mgmt,
           allDayGainPerHour, allDayCost, capPerStaff, priceMult, volumeMult, tier };
}

// 你的时间：清醒 16 小时，先扣掉所有店铺的管理精力，剩下的才能拿去打工
export function timeBudget(biz) {
  let mgmt = 0;
  for (const b of biz) mgmt += b.manager ? MGMT_WITH_MANAGER : (BIZ[b.type_id]?.mgmt || 0);
  const free = Math.max(0, AWAKE_HOURS - mgmt);
  const canJob = mgmt <= MGMT_MAX_WITH_JOB;
  const shift = canJob ? Math.min(WORK_HOURS_PER_DAY, free) : 0;
  const otMax = Math.max(0, Math.min(OVERTIME_MAX_HOURS, Math.floor(free - shift)));
  return { mgmt, free, canJob, shift, otMax };
}

export function demandTarget(b) {
  const tier = b.price_tier || 0;
  return clamp((1 - 0.16 * tier) * (1 + 0.05 * b.marketing), 0.30, 2.20);
}

// ── 资产（奢侈品/房产）估值 ─────────────────────────────────
export function itemValue(it) {
  const def = ITEM[it.type_id];
  if (!def) return it.value;
  if (def.index && it.units > 0) return it.units * M.indexLevel(def.index);
  return it.value;
}
export function itemListPrice(def) {
  return def.index ? def.price * M.indexLevel(def.index) / 100 : def.price;
}

export function prestigeOf(userId) {
  const rows = db.prepare('SELECT type_id FROM items WHERE user_id=?').all(userId);
  let p = 0;
  for (const r of rows) p += (ITEM[r.type_id]?.prestige || 0);
  return p;
}
export function prestigeBonus(prestige) { return Math.min(0.60, prestige * 0.0012); }

export function ensurePlayer(userId, nickname) {
  const p = db.prepare('SELECT * FROM players WHERE user_id=?').get(userId);
  if (p) return p;
  const h = Number(db.prepare("SELECT value FROM meta WHERE key='market_hour'").get()?.value || 0);
  db.prepare(`INSERT INTO players(user_id,nickname,cash,bank,last_hour,created_hour,peak_networth,stamina)
              VALUES(?,?,?,?,?,?,?,?)`).run(userId, nickname, START_CASH, 0, h, h, START_CASH, STAMINA_MAX);
  db.prepare('INSERT INTO ledger(user_id,hour,kind,amount,detail,icon) VALUES(?,?,?,?,?,?)')
    .run(userId, h, 'start', 0, L('led.start'), '🧳');
  return db.prepare('SELECT * FROM players WHERE user_id=?').get(userId);
}

export function computeNetWorth(userId) {
  const p = db.prepare('SELECT * FROM players WHERE user_id=?').get(userId);
  if (!p) return null;
  const live = new Map(M.allAssets().map(a => [a.id, a]));
  const holdings = db.prepare('SELECT * FROM holdings WHERE user_id=? AND qty>0').all(userId);
  let portfolio = 0;
  for (const h of holdings) { const a = live.get(h.asset_id); if (a) portfolio += h.qty * a.price; }

  const biz = db.prepare('SELECT * FROM businesses WHERE user_id=?').all(userId);
  const pbonus = prestigeBonus(prestigeOf(userId) + p.prestige);
  const prosp = M.cityProsperity();
  let bizValue = 0, bizNetPerHour = 0;
  for (const b of biz) {
    bizValue += b.invested * 0.80 * (0.65 + 0.35 * b.condition);
    bizNetPerHour += bizRates(b, pbonus, prosp[b.city] || 1).net;
  }
  const items = db.prepare('SELECT * FROM items WHERE user_id=?').all(userId);
  let itemValueSum = 0;
  for (const it of items) itemValueSum += itemValue(it);

  let depValue = 0;
  for (const d of db.prepare("SELECT * FROM deposits WHERE user_id=? AND status='active'").all(userId)) depValue += d.amount;
  let debt = 0, mortgage = 0;
  for (const l of db.prepare("SELECT * FROM loans WHERE user_id=? AND status='active'").all(userId)) {
    debt += l.balance; if (l.kind === 'mortgage') mortgage += l.balance;
  }
  const total = p.cash + p.bank + depValue + portfolio + bizValue + itemValueSum - debt;
  return { cash: p.cash, bank: p.bank, deposits: depValue, portfolio, business: bizValue,
           items: itemValueSum, debt, mortgage, total, bizNetPerHour,
           counts: { biz: biz.length, items: items.length, holdings: holdings.length } };
}

export function payFrom(p, amount) {
  if (amount <= 0) return true;
  if (p.cash >= amount) { p.cash -= amount; return true; }
  if (p.cash > 0) { amount -= p.cash; p.cash = 0; }
  if (p.bank >= amount) { p.bank -= amount; return true; }
  if (p.bank > 0) { amount -= p.bank; p.bank = 0; }
  p.cash -= amount;
  return false;
}

// ── 主推进 ──────────────────────────────────────────────────
export function advancePlayer(userId) {
  M.advanceMarket();
  const target = Number(db.prepare("SELECT value FROM meta WHERE key='market_hour'").get()?.value || 0);
  const p = db.prepare('SELECT * FROM players WHERE user_id=?').get(userId);
  if (!p || target <= p.last_hour) return p;

  let from = p.last_hour;
  const elapsed = target - from;
  const capped = elapsed > OFFLINE_CAP_HOURS;
  if (capped) from = target - OFFLINE_CAP_HOURS;   // 只结算最近 N 个游戏日

  const biz = db.prepare('SELECT * FROM businesses WHERE user_id=?').all(userId);
  const items = db.prepare('SELECT * FROM items WHERE user_id=?').all(userId);
  const loans = db.prepare("SELECT * FROM loans WHERE user_id=? AND status='active'").all(userId);
  const deposits = db.prepare("SELECT * FROM deposits WHERE user_id=? AND status='active'").all(userId);
  const holdings = db.prepare('SELECT * FROM holdings WHERE user_id=? AND qty>0').all(userId);
  const assetsById = new Map(M.allAssets().map(a => [a.id, a]));

  const ledger = [], nwPoints = [];
  const pb = prestigeBonus(prestigeOf(userId) + p.prestige);
  const prosp = M.cityProsperity();
  const carOwned = items.some(it => ITEM[it.type_id]?.car);
  const job = JOB[p.job_id];
  const tb = timeBudget(biz);
  const working = !!job && (!job.car || carOwned) && tb.canJob;
  const sRate = savingsRate(), oRate = overdraftRate();
  let dayRev = 0, dayCost = 0, dayInterest = 0, dayOverdraft = 0, dayJob = 0;
  // 实业的日净利估算（用于衡量月供负担）
  let dayIncomeRate = 0;
  for (const b of biz) dayIncomeRate += bizRates(b, pb, prosp[b.city] || 1).dailyNet;

  for (let h = from + 1; h <= target; h++) {
    // ── 作息：体力随睡眠恢复、随清醒与工作消耗 ──
    const hod = h % DAY_HOURS;
    const phase = dayPhase(hod);
    const rq = restQuality(p.work_streak);
    p.stamina += phase === 'sleep' ? ST_SLEEP * rq : ST_AWAKE;

    // ── 生病 / 旅游：这两种状态下没法上班 ──
    const sick = p.sick_until > h;
    const traveling = p.trip_until > h;
    if (sick && p.sick_until === h + 1) { /* 下一小时康复 */ }
    if (p.sick_until && h >= p.sick_until && p.sick_id) {
      ledger.push([h, 'health', 0, L('led.recovered', { ill: illName(p.sick_id) }), '💚']);
      p.sick_id = ''; p.sick_treated = 0;
      p.stress = clamp(p.stress - 8, 0, STRESS_MAX);
    }
    if (p.trip_until && h >= p.trip_until && p.trip_id) {
      const tp = TRIP[p.trip_id];
      if (tp) {
        p.stress = clamp(p.stress - tp.relief * (p.trip_relief || 1), 0, STRESS_MAX);
        p.stamina = clamp(p.stamina + tp.stamina, 0, STAMINA_MAX);
        ledger.push([h, 'trip', 0, L('led.tripBack', { trip: { zh: tp.zh, en: tp.en }, relief: Math.round(tp.relief * (p.trip_relief || 1)) }), tp.emoji]);
      }
      p.trip_id = ''; p.trip_relief = 1; p.work_streak = 0;
    }

    // ── 连续工作天数：跨日时结算 ──
    const dayIdx = Math.floor(h / DAY_HOURS);
    if (p.streak_day !== dayIdx) {
      if (p.streak_day >= 0) {
        if (p.worked_today) p.work_streak += 1;
        else { if (p.work_streak >= 2) p.stress = clamp(p.stress - 6, 0, STRESS_MAX); p.work_streak = 0; }
      }
      p.streak_day = dayIdx; p.worked_today = 0;
    }
    const onLeave = p.off_day === dayIdx;                 // 今天请假

    // ── 正常班：可上工时长会被店铺管理精力挤占 ──
    const shiftHod = hod - WORK_START;
    if (working && !onLeave && phase === 'shift' && shiftHod < tb.shift && !sick && !traveling) {
      const eff = efficiency(p.stamina) * stressFactor(p.stress);
      const pay = job.wage * eff;
      p.cash += pay; p.job_exp += 1; p.job_hours += 1; p.job_income += pay; dayJob += pay;
      p.stamina += ST_SHIFT; p.worked_today = 1;
    }
    // ── 加班结算：接单时已锁定报酬，这一工时在游戏里真正过完才到账 ──
    if (p.ot_pending > 0 && h >= p.ot_until) {
      p.cash += p.ot_pending; p.job_income += p.ot_pending; dayJob += p.ot_pending;
      p.job_exp += 1; p.job_hours += 1;
      p.ot_pending = 0;
    }
    p.stamina = clamp(p.stamina, 0, STAMINA_MAX);

    // ── 精神压力：负债、加班、透支推高；睡眠、旅游、低负债缓解 ──
    let dStress = phase === 'sleep' ? STRESS_SLEEP * rq : 0;
    dStress += streakStress(p.work_streak);              // 连轴转本身就是压力源
    if (traveling) dStress -= 1.2;                       // 旅途中持续放松
    const debtNow = loans.reduce((a, l) => a + (l.status === 'active' ? l.balance : 0), 0);
    if (debtNow > 0) {
      const nwNow = Math.max(1, quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits) + debtNow);
      const lev = debtNow / nwNow;                       // 负债率：欠得越多越焦虑
      if (lev > LEV_SAFE) dStress += (lev - LEV_SAFE) * STRESS_DEBT_K / 24;
      // 月供压力：还款额占收入的比重才是真正压垮人的东西
      const monthlyPay = loans.reduce((a, l) => a + (l.status === 'active' ? l.payment : 0), 0);
      const monthlyIncome = Math.max(1, (dayIncomeRate + (working ? job.wage * WORK_HOURS_PER_DAY : 0)) * 30);
      const burden = monthlyPay / monthlyIncome;
      if (burden > BURDEN_SAFE) dStress += Math.min(2.5, (burden - BURDEN_SAFE) * STRESS_BURDEN_K / 24);
    }
    if (p.cash < 0) dStress += 0.35;                     // 透支的焦虑
    if (pb > 0.10) dStress -= pb * 1.2;                  // 房子、车、艺术品带来的生活质量
    if (p.stamina < 25) dStress += 0.25;
    if (sick) dStress += p.sick_treated ? 0.1 : 0.45;    // 硬扛比就医更煎熬
    p.stress = clamp(p.stress + dStress, 0, STRESS_MAX);

    // ── 生病判定 ──
    if (!sick && !traveling && Math.random() < sickChance(p.stress)) {
      const ill = pickIllness(p.stress);
      p.sick_id = ill.id; p.sick_until = h + ill.days * DAY_HOURS; p.sick_treated = 0;
      ledger.push([h, 'health', 0, L('led.fellIll', { ill: { zh: ill.zh, en: ill.en }, days: ill.days }), ill.emoji]);
    }

    for (const b of biz) {
      const city = CITY[b.city] || CITIES[1];
      const pr = prosp[b.city] || 1;
      const r0 = bizRates(b, pb, pr);
      const tgt = demandTarget(b) * (r0.util < 0.98 ? 0.90 : 1);
      b.demand = clamp(b.demand + (tgt - b.demand) * 0.005 + M.gauss() * 0.010 * city.vol, 0.30, 2.30);
      b.condition = clamp(b.condition - 0.00015, 0.20, 1);
      if (b.auto_staff) { const rec = bizRates(b, pb, pr).recStaff; if (rec !== b.staff) b.staff = rec; }
      const r = bizRates(b, pb, pr);
      b.understaffed = r.util;
      // 只有营业时段才有营收与人工；房租之类的固定成本 24 小时都在烧
      const open = bizOpenNow(b, hod);
      const absent = sick || traveling ? 0.92 : 1;       // 老板不在，生意打点折
      const rev = open ? r.rev * absent : 0;
      const cost = (open ? r.openCost : 0) + r.idleCost;
      b.month_revenue += rev; b.month_cost += cost;
      b.lifetime_profit += (rev - cost);
      dayRev += rev; dayCost += cost;
      p.cash += (rev - cost); p.month_profit += (rev - cost);
      if (b.auto_repair && b.condition < 0.72) {
        const rc = r.def.cost * r.city.costMult * 0.22 * (1 - b.condition);
        if (p.cash > rc * 3) { p.cash -= rc; b.condition = 1; }
      }
    }
    if (p.bank > 0) { const i = p.bank * sRate / YEAR_HOURS; p.bank += i; dayInterest += i; }
    if (p.cash < 0) { const i = -p.cash * oRate / YEAR_HOURS; p.cash -= i; dayOverdraft += i; }
    for (const l of loans) if (l.status === 'active') l.balance += l.balance * l.rate / YEAR_HOURS;

    if (h % DAY_HOURS === 0) {
      if (dayJob > 0) ledger.push([h, 'job', dayJob, L('led.jobDay', { job: { zh: job.zh, en: job.en }, amt: dayJob }), job.emoji]);
      if (dayRev > 0) ledger.push([h, 'biz', dayRev - dayCost, L('led.bizDay', { rev: dayRev, cost: dayCost }), '🏬']);
      if (dayInterest > 0.005) ledger.push([h, 'interest', dayInterest, L('led.interest'), '🏦']);
      if (dayOverdraft > 0.005) ledger.push([h, 'overdraft', -dayOverdraft, L('led.overdraft'), '⚠️']);
      dayRev = dayCost = dayInterest = dayOverdraft = dayJob = 0;
    }

    for (const d of deposits) {
      if (d.status === 'active' && h >= d.mature_hour) {
        const gain = d.amount * d.rate * (d.term_months / 12);
        p.bank += d.amount + gain; d.status = 'matured';
        ledger.push([h, 'deposit', d.amount + gain, L('led.depositMature', { months: d.term_months, total: d.amount + gain, interest: gain }), '💰']);
      }
    }

    for (const l of loans) {
      if (l.status !== 'active' || h < l.next_due) continue;
      const last = l.months_left <= 1;
      const due = last ? l.balance : Math.min(l.payment, l.balance);
      const isMortgage = l.kind === 'mortgage';
      if (payFrom(p, due)) {
        l.balance -= due; l.paid_total += due; l.months_left--;
        p.credit_score = Math.min(850, p.credit_score + 2);
        ledger.push([h, 'loan', -due, L(isMortgage ? 'led.mortgagePay' : 'led.loanPay', { amt: due, left: Math.max(0, l.balance) }), '📉']);
        if (l.balance <= 1) { l.balance = 0; l.status = 'closed'; ledger.push([h, 'loan', 0, L('led.loanClosed'), '✅']); }
      } else {
        const pen = l.balance * 0.02;
        l.balance += pen; p.missed_pay++;
        p.credit_score = Math.max(300, p.credit_score - 35);
        ledger.push([h, 'loan', -pen, L('led.loanMissed', { pen }), '🚨']);
      }
      l.next_due += MONTH_HOURS;
    }

    if (h % MONTH_HOURS === 0) {
      const date = M.gameDate(h);
      let divTotal = 0, ownProfit = 0, ownLoss = 0;
      for (const hd of holdings) {
        const a = assetsById.get(hd.asset_id);
        if (!a || hd.qty <= 0) continue;
        const stake = hd.qty / a.shares;
        if (stake >= 0.9995 && a.kind === 'stock') {
          const prof = a.eps * hd.qty / 12;
          if (prof >= 0) { ownProfit += prof; p.cash += prof; }
          else { ownLoss += -prof; payFrom(p, -prof); }
        } else if (a.div_yield > 0) {
          const boost = a.kind === 'stock' && stake >= 0.5 ? 1.4 : 1;
          const net = hd.qty * a.price * a.div_yield / 12 * boost * (1 - RATES.divTax);
          divTotal += net; p.cash += net; p.total_dividend += net;
        }
      }
      if (divTotal > 0.01) ledger.push([h, 'dividend', divTotal, L('led.dividend', { tax: RATES.divTax }), '💵']);
      if (ownProfit > 0.01) ledger.push([h, 'dividend', ownProfit, L('led.ownerProfit'), '🏛️']);
      if (ownLoss > 0.01) ledger.push([h, 'dividend', -ownLoss, L('led.ownerLoss'), '🩸']);

      let rent = 0, upkeep = 0, ptax = 0;
      for (const it of items) {
        const def = ITEM[it.type_id]; if (!def) continue;
        if (def.index && it.units > 0) it.value = it.units * M.indexLevel(def.index);
        else it.value = Math.max(def.price * 0.05, it.value * (1 + (def.drift || 0) + M.gauss() * 0.005));
        upkeep += it.value * (def.upkeep || 0);
        ptax += it.value * RATES.propertyTax;
        if (it.rented && def.rent) rent += it.value * def.rent;
      }
      if (rent > 0) { p.cash += rent; ledger.push([h, 'rent', rent, L('led.rent'), '🔑']); }
      if (upkeep > 0) { payFrom(p, upkeep); ledger.push([h, 'upkeep', -upkeep, L('led.upkeep'), '🧰']); }
      if (ptax > 0) { payFrom(p, ptax); p.total_tax += ptax; ledger.push([h, 'tax', -ptax, L('led.propTax'), '🧾']); }

      if (p.month_profit > 0) {
        const tax = p.month_profit * RATES.corpTax;
        payFrom(p, tax); p.total_tax += tax;
        ledger.push([h, 'tax', -tax, L('led.corpTax', { year: date.year, month: date.month, rate: RATES.corpTax, profit: p.month_profit }), '🧾']);
      }
      p.month_profit = 0;
      for (const b of biz) { b.month_revenue = 0; b.month_cost = 0; }

      for (const b of biz) {
        if (Math.random() < 0.10) {
          const def = BIZ[b.type_id];
          if (Math.random() < 0.5) {
            b.condition = clamp(b.condition - 0.08 - Math.random() * 0.12, 0.2, 1);
            ledger.push([h, 'event', 0, L('led.bizBreak', { name: b.name, emoji: def?.emoji || '' }), '🔧']);
          } else {
            b.demand = clamp(b.demand + 0.15 + Math.random() * 0.25, 0.30, 2.30);
            ledger.push([h, 'event', 0, L('led.bizBoom', { name: b.name, emoji: def?.emoji || '' }), '📈']);
          }
        }
      }

      if (Math.random() < 0.22) {
        const ev = LIFE_EVENTS[Math.floor(Math.random() * LIFE_EVENTS.length)];
        const nw = Math.max(0, quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits));
        let amt = 0;
        if (ev.min !== 0 || ev.max !== 0) {
          const base = ev.min + Math.random() * (ev.max - ev.min);
          const scaled = ev.scaleNW ? Math.sign(base) * Math.max(Math.abs(base), nw * ev.scaleNW) : base;
          amt = Math.sign(base) * Math.min(Math.abs(scaled), Math.max(Math.abs(base), nw * 0.02));
        }
        if (amt < 0) payFrom(p, -amt); else p.cash += amt;
        if (ev.prestige) p.prestige = Math.max(0, p.prestige + ev.prestige);
        ledger.push([h, 'event', amt, L('led.life', { id: ev.id, amt, prestige: ev.prestige || 0 }), ev.icon]);
      }

      const nw2 = quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits);
      let debt = 0; for (const l of loans) if (l.status === 'active') debt += l.balance;
      const lev = nw2 > 0 ? debt / (nw2 + debt) : 1;
      p.credit_score = clamp(Math.round(p.credit_score + (lev < 0.3 ? 4 : lev < 0.5 ? 1 : lev < 0.7 ? -2 : -6)), 300, 850);
    }

    if (h % 4 === 0) nwPoints.push([h, quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits)]);
  }

  const nwFinal = quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits);
  if (p.cash < 0 && nwFinal < 0 && !p.bankrupt) {
    p.bankrupt = 1;
    ledger.push([target, 'event', 0, L('led.bankrupt'), '💀']);
  } else if (nwFinal > 0 && p.bankrupt) p.bankrupt = 0;
  p.peak_networth = Math.max(p.peak_networth, nwFinal);
  p.last_hour = target;
  if (capped) {
    ledger.push([target, 'event', 0,
      L('led.offlineCap', { elapsed: Math.round(elapsed / 24), settled: Math.round(OFFLINE_CAP_HOURS / 24) }), '⏳']);
  }

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE players SET cash=?,bank=?,credit_score=?,last_hour=?,prestige=?,month_profit=?,
                total_tax=?,total_dividend=?,missed_pay=?,peak_networth=?,bankrupt=?,
                job_exp=?,job_hours=?,job_income=?,stamina=?,ot_pending=?,
                stress=?,sick_until=?,sick_id=?,sick_treated=?,trip_until=?,trip_id=?,
                work_streak=?,worked_today=?,streak_day=? WHERE user_id=?`)
      .run(p.cash, p.bank, p.credit_score, p.last_hour, p.prestige, p.month_profit,
           p.total_tax, p.total_dividend, p.missed_pay, p.peak_networth, p.bankrupt,
           p.job_exp, p.job_hours, p.job_income, p.stamina, p.ot_pending,
           p.stress, p.sick_until, p.sick_id, p.sick_treated, p.trip_until, p.trip_id,
           p.work_streak, p.worked_today, p.streak_day, userId);
    const ub = db.prepare(`UPDATE businesses SET demand=?,condition=?,lifetime_profit=?,month_revenue=?,
                           month_cost=?,staff=?,understaffed=? WHERE id=?`);
    for (const b of biz) ub.run(b.demand, b.condition, b.lifetime_profit, b.month_revenue, b.month_cost, b.staff, b.understaffed, b.id);
    const ui = db.prepare('UPDATE items SET value=? WHERE id=?');
    for (const it of items) ui.run(it.value, it.id);
    const ul = db.prepare('UPDATE loans SET balance=?,months_left=?,next_due=?,paid_total=?,status=? WHERE id=?');
    for (const l of loans) ul.run(l.balance, l.months_left, l.next_due, l.paid_total, l.status, l.id);
    const ud = db.prepare('UPDATE deposits SET status=? WHERE id=?');
    for (const d of deposits) if (d.status !== 'active') ud.run(d.status, d.id);
    const il = db.prepare('INSERT INTO ledger(user_id,hour,kind,amount,detail,icon) VALUES(?,?,?,?,?,?)');
    for (const e of ledger.slice(-260)) il.run(userId, e[0], e[1], round2(e[2]), e[3], e[4]);
    const inw = db.prepare('INSERT OR REPLACE INTO networth(user_id,hour,value) VALUES(?,?,?)');
    for (const q of nwPoints.slice(-400)) inw.run(userId, q[0], q[1]);
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }

  db.prepare('DELETE FROM ledger WHERE user_id=? AND id NOT IN (SELECT id FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 400)').run(userId, userId);
  db.prepare('DELETE FROM networth WHERE user_id=? AND hour < ?').run(userId, target - 3000);
  return db.prepare('SELECT * FROM players WHERE user_id=?').get(userId);
}

function quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits) {
  let v = p.cash + p.bank;
  for (const d of deposits) if (d.status === 'active') v += d.amount;
  for (const h of holdings) { const a = assetsById.get(h.asset_id); if (a) v += h.qty * a.price; }
  for (const b of biz) v += b.invested * 0.80 * (0.65 + 0.35 * b.condition);
  for (const it of items) v += itemValue(it);
  for (const l of loans) if (l.status === 'active') v -= l.balance;
  return v;
}

function illName(id) { const i = ILL[id]; return i ? { zh: i.zh, en: i.en } : { zh: id, en: id }; }

export function fmt(n) {
  const a = Math.abs(n), sign = n < 0 ? '-' : '';
  if (a >= 1e12) return sign + '$' + (a / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(1) + 'K';
  return sign + '$' + a.toFixed(0);
}

export const TITLES = [
  [0, '街头小贩', 'Street Vendor', '🧢'], [1e5, '个体户', 'Sole Trader', '🛍️'],
  [5e5, '小老板', 'Small Owner', '👔'], [2e6, '区域商人', 'Regional Trader', '🏬'],
  [1e7, '企业主', 'Business Owner', '🏢'], [5e7, '商界新贵', 'Rising Magnate', '💼'],
  [2e8, '资本玩家', 'Capital Player', '📊'], [1e9, '亿万富豪', 'Billionaire', '💎'],
  [1e10, '商业巨鳄', 'Tycoon', '🐋'], [1e11, '财阀掌门', 'Conglomerate Head', '👑'],
  [1e12, '世界首富', 'Richest on Earth', '🌍'],
];
export function titleOf(nw) {
  let r = TITLES[0];
  for (const t of TITLES) if (nw >= t[0]) r = t;
  return { zh: r[1], en: r[2], icon: r[3], level: TITLES.indexOf(r) };
}
