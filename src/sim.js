// 玩家经济引擎：实业经营、银行利息、股息、税收、贷款/房贷、房产指数、随机事件
import { db } from './db.js';
import { stepGrowth, valuate, stakeValue, companyOf, companiesOf } from './company.js';
import * as M from './market.js';
import { DESTINATIONS, DEST, CABINS, HOTELS, REGIONS_W, DEFAULT_HOME, distanceKm, routeOf, HOMES_AVAILABLE } from './catalog-world.js';
import { WEARABLES, WEAR_SLOTS, STYLES, GENDERS, outfitScore } from './catalog-wardrobe.js';
import { LEISURE, LEISURE_CATS, REPEAT_DECAY } from './catalog-leisure.js';
import { BIZ_TYPES, CITIES, ITEM_TYPES, ITEM_CATS, REGIONS, LIFE_EVENTS, JOBS, JOB_TRACKS, RIVALS,
         ILLNESSES, TRIPS, FLIGHT_CLASSES, isOpenAt, openHours,
         COGS_RATE, REV_PER_WAGE, MGMT_WITH_MANAGER, AWAKE_HOURS, MGMT_MAX_WITH_JOB,
         BIZ_CATS, seasonMult as seasonMultOf,
         MEALS, HOMES, COMMUTES, LOTTERIES } from './catalog-content.js';

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

// 离线上限（默认 7 个游戏日）。世界本身就被 M.clampOfflineGap() 卡在这个范围内，
// 所以这里通常不会再触发——留着是为了兜住多人存档里某个玩家格外久没上线的情况。
export const OFFLINE_CAP_HOURS = M.OFFLINE_CAP_HOURS;

// 资金流水的保留窗口：一个游戏月，最多 1500 条
export const LEDGER_KEEP_HOURS = 30 * 24;
export const LEDGER_MAX_ROWS = 1500;

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
// ── 人物：衣柜与消遣 ────────────────────────────────────────
export { WEARABLES, WEAR_SLOTS, STYLES, GENDERS, outfitScore, LEISURE, LEISURE_CATS, REPEAT_DECAY, JOB_TRACKS };
export const WEAR = Object.fromEntries(WEARABLES.map(w => [w.id, w]));
export const ACT = Object.fromEntries(LEISURE.map(a => [a.id, a]));
export const WEAR_COLS = { top:'wear_top', bottom:'wear_bottom', outer:'wear_outer', shoes:'wear_shoes', acc:'wear_acc' };

// 身上穿的那一套：从 players 的五个格子读回具体的衣服
export function outfitOf(p, items) {
  const byId = new Map((items || []).map(it => [it.id, it]));
  const out = {};
  for (const [slot, col] of Object.entries(WEAR_COLS)) {
    const it = byId.get(p[col]);
    const def = it && WEAR[it.type_id];
    out[slot] = def ? { ...def, itemId: it.id, value: it.value } : null;
  }
  return out;
}
// 穿得好不好，是能被别人看见的：算进声望，也让人松弛一点
export function lookOf(p, items) {
  const o = outfitOf(p, items);
  const sc = outfitScore(Object.values(o));
  return { ...sc, slots: o,
    // 一身得体的衣服，值几点声望；同时每小时压力略降——人是会因为体面而放松的
    prestige: sc.score,
    stress: -Math.min(0.06, sc.score / 1400) };
}

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
export function hasBike(userId) {
  return db.prepare('SELECT type_id FROM items WHERE user_id=?').all(userId).some(it => ITEM[it.type_id]?.bike);
}
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
export function restQuality(streak) { return Math.max(0.58, 1 - 0.055 * Math.max(0, streak - STREAK_FREE_DAYS)); }
// 连轴转的压力有上限：一直不休息会难受，但不会无限往上叠到崩溃
export function streakStress(streak) { return Math.min(0.30, Math.max(0, streak - 6) * 0.022); }   // 每小时
export const ST_NIGHT = -20;                      // 熬夜加班的体力代价
export const NIGHT_MULT = 2.2;                    // 夜班津贴
export const ST_MIN_FOR_OT = 15;                  // 体力低于此值无法加班

// ── 精神压力 ────────────────────────────────────────────────
export const STRESS_MAX = 100;
export const STRESS_OT = 1.25, STRESS_NIGHT = 2.6;  // 加班 / 熬夜带来的压力
export const STRESS_SLEEP = -1.25;                  // 睡眠缓解（每日约 -10，且受休息质量折损）
// 负债和月供是压力源，但要有天花板：背着房贷过日子是常态，不是精神崩溃。
export const STRESS_DEBT_K = 26;                    // 负债率系数（超出 35% 的部分）
export const STRESS_DEBT_CAP = 0.38;                // 每小时最多贡献这么多
export const STRESS_BURDEN_K = 20;                  // 月供占收入比系数
export const STRESS_BURDEN_CAP = 0.45;
// 越紧绷，一觉睡下去回落得越多。有了这一项压力才会收敛到一个水平，
// 而不是只要压力源不断就一路涨到 100 然后卡在那儿。
export const STRESS_RELIEF_SCALE = 45;
export const LEV_SAFE = 0.35, BURDEN_SAFE = 0.35;   // 安全线以内不产生压力
export const STRESS_MAX_FOR_OT = 85;                // 压力过高时干不动加班
export const SICK_FLOOR = 62;                       // 低于此压力不会生病
export { ILLNESSES, TRIPS, FLIGHT_CLASSES };
export const ILL = Object.fromEntries(ILLNESSES.map(i => [i.id, i]));
export const TRIP = Object.fromEntries(TRIPS.map(t => [t.id, t]));

// 压力对产出的折损：50 以下无感，往上线性衰减到 0.7
export function stressFactor(stress) {
  return stress <= 55 ? 1 : Math.max(0.72, 1 - (stress - 55) / 200);
}
// 每小时生病概率
export function sickChance(stress) {
  return stress <= SICK_FLOOR ? 0 : Math.min(0.008, (stress - SICK_FLOOR) * 0.00020);
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
export { COGS_RATE, REV_PER_WAGE, MGMT_WITH_MANAGER, AWAKE_HOURS, MGMT_MAX_WITH_JOB, MEALS, HOMES, COMMUTES, LOTTERIES, BIZ_CATS };
export const MEAL = Object.fromEntries(MEALS.map(m => [m.id, m]));
export const HOME = Object.fromEntries(HOMES.map(h => [h.id, h]));
export const COMMUTE = Object.fromEntries(COMMUTES.map(c => [c.id, c]));
export const LOTTO = Object.fromEntries(LOTTERIES.map(l => [l.id, l]));
export { DESTINATIONS, DEST, CABINS, HOTELS, REGIONS_W, DEFAULT_HOME, distanceKm, routeOf, HOMES_AVAILABLE };
export function birthOf(p) { return DEST[p.birth_id] || DEST[DEFAULT_HOME]; }
// 人现在在哪儿。买了单程票飞走就留在那儿，之后所有航程都从这里起算。
// at_id 可能是精选目的地，也可能是图集里的任意一座城市——两边都要认。
export function whereOf(p, cityLookup) {
  if (!p?.at_id) return birthOf(p);
  if (DEST[p.at_id]) return DEST[p.at_id];
  const c = cityLookup ? cityLookup(p.at_id) : null;
  return c || birthOf(p);
}
export function isAwayFromHome(p) { return !!p?.at_id && p.at_id !== p.birth_id; }
export const CABIN = Object.fromEntries(CABINS.map(c => [c.id, c]));
export const HOTEL = Object.fromEntries(HOTELS.map(h => [h.id, h]));
// 一趟旅程的报价：往返机票 + 住宿 + 日常开销
// oneWay：只买去程。飞过去就留在那儿，下一程从新的地方起算——
// 纽约飞洛杉矶本来就是单程，没道理逼着你买张回纽约的票。
export function tripQuote(dest, nights, cabinId, hotelId, home, oneWay = false) {
  const c = CABIN[cabinId] || CABINS[0], ht = HOTEL[hotelId] || HOTELS[1];
  const n = oneWay ? Math.max(0, Math.min(60, Math.round(nights)))
                   : Math.max(dest.minNights || 1, Math.min(60, Math.round(nights)));
  const rt = routeOf(home || DEST[DEFAULT_HOME], dest);
  const baseFare = oneWay ? rt.fareOneWay : rt.fare;
  const air = Math.round(baseFare * (c.mult || 0));
  const stay = Math.round(dest.hotel * ht.mult * n);
  const daily = Math.round(dest.spend * n * (ht.mult > 1 ? 1.3 : 1));
  // 单程只飞一趟，没有回程那几个小时
  const hours = Math.round(rt.hours * (oneWay ? 1 : 2) + n * 24);
  const relief = Math.min(100, dest.relief * n * c.relief * ht.relief * 0.55);
  const stamina = Math.min(100, 8 * n * ht.relief);
  const prestige = Math.round(dest.prestige * c.prestige * ht.prestige);
  return { nights: n, air, stay, daily, total: air + stay + daily, hours, relief, stamina, prestige,
           oneWay, cabin: c, hotel: ht, km: rt.km, flightHours: rt.hours,
           fareReturn: Math.round(rt.fare * (c.mult || 0)),
           fareOneWay: Math.round(rt.fareOneWay * (c.mult || 0)) };
}
// 自有住房：住自己的房子不用付租金，居住体验也更好。
// 但一套房子只能有一个用途——租出去了就是房客在住，你还得另外租房。
// 想要既收租又不付房租，就得买第二套。
export const OWNED_HOME = { id:'owned', emoji:'🏡', zh:'自有住房', en:'Your own home',
  rent:0, stress:-0.09, stamina:0.06, prestige:0 };

// 住的是名下哪一套。优先认玩家自己选的那套；选的那套卖了或者租出去了，
// 就自动搬进还空着的房子里最好的一套——这样买了房不用再点一下才生效。
export function homeItemOf(p, items) {
  const vacant = items.filter(it => ITEM[it.type_id]?.cat === 'estate' && !it.rented);
  if (!vacant.length) return null;
  const chosen = vacant.find(it => it.id === p.home_item_id);
  if (chosen) return chosen;
  return vacant.reduce((a, b) => (itemValue(b) > itemValue(a) ? b : a));
}
export function homeOf(p, homeItem) {
  if (!homeItem) return HOME[p.home_id] || HOMES[0];
  const def = ITEM[homeItem.type_id];
  const lv = def?.live || {};
  return { ...OWNED_HOME, zh: def ? def.name : OWNED_HOME.zh, en: def ? def.en : OWNED_HOME.en,
    emoji: def?.emoji || OWNED_HOME.emoji, itemId: homeItem.id,
    stress: lv.stress ?? OWNED_HOME.stress, stamina: lv.stamina ?? OWNED_HOME.stamina };
}
export function mealOf(p) { return MEAL[p.meal_id] || MEAL.canteen; }
// 没车的时候「自己开车」不成立，退回走路
export function commuteOf(p, carOwned, bikeOwned = false) {
  const c = COMMUTE[p.commute_id] || COMMUTES[0];
  if (c.needsCar && !carOwned) return COMMUTES[0];
  if (c.needsBike && !bikeOwned) return COMMUTES[0];
  return c;
}

export function bizHours(b) {
  const def = BIZ[b.type_id];
  return b.all_day ? [0, 24] : def.hours;
}
export function bizOpenNow(b, hod) { return isOpenAt(bizHours(b), hod); }

// 每营业小时的经营数据。房租等固定成本 24 小时都在烧，单独计。
// 店铺所在城市的经营参数。新店在开的时候就把这几个数固化下来了；
// 老存档没有，就回落到原来那张抽象城市表。
export function bizCity(b) {
  if (b.rev_mult > 0) return {
    revMult: b.rev_mult, rentMult: b.rent_mult, wageMult: b.wage_mult,
    costMult: b.cost_mult, vol: b.city_vol || 1,
    name: b.city_name || b.city, en: b.city_en || b.city, flag: b.city_flag || '',
  };
  return CITY[b.city] || CITIES[1];
}

// 此刻的宏观环境：界面上显示的营收，必须和结算时用的是同一套参数
export function bizEnv() {
  const h = M.currentGameHour();
  return { macro: M.regimeState().demand ?? 1, month: M.gameDate(h).month };
}

// macro：宏观周期的需求系数（繁荣 1.18 / 衰退 0.88）；month：游戏内月份，用来算旺季
export function bizRates(b, pb = 0, prosp = 1, macro = 1, month = 0) {
  const def = BIZ[b.type_id], city = bizCity(b);
  if (!def) return { rev: 0, cost: 0, net: 0, potential: 0, capacity: 0, util: 1, recStaff: 0 };
  const tier = b.price_tier || 0;
  const priceMult = 1 + 0.22 * tier;
  const volumeMult = 1 - 0.15 * tier;
  const lvR = levelRevMult(b.level), lvC = Math.pow(1.25, b.level - 1);   // 规模越大，场地越大、房租越贵
  const condFactor = 0.5 + 0.5 * b.condition;

  // 周期敏感度：药房几乎不动，钢厂和夜店跟着大盘上天入地；
  // 当铺、二手店、汽修的 cyc 是负的——经济一差，他们的生意反而来了
  const cycMult = Math.max(0.25, 1 + (macro - 1) * (def.cyc ?? 1));
  const seasonMult = month ? seasonOf(def, month) : 1;          // 冰淇淋的七月，滑雪场的一月
  const mktgMult = 1 + 0.10 * b.marketing * (def.mktg ?? 1);    // 投广告对奶茶店有用，对废品站没用

  const baseRev = def.rev * city.revMult;
  const scale = lvR * mktgMult * (1 + pb) * prosp * cycMult * seasonMult;
  const volume = baseRev * scale * volumeMult * b.demand * condFactor;
  const potential = volume * priceMult;

  const wage = def.wage * city.wageMult;                        // 当地工资水平
  const capPerStaff = wage * (def.revPerWage ?? REV_PER_WAGE) * priceMult;   // 一名员工能支撑的营收
  const staff = Math.max(0, b.staff | 0);
  const capacity = staff * capPerStaff;
  const rev = Math.min(potential, capacity);
  const util = potential > 0 ? Math.min(1, capacity / potential) : 1;
  const recStaff = Math.max(1, Math.ceil(potential / Math.max(capPerStaff, 1e-9)));

  // 营业时才发生：进货成本 + 人工。酒吧两成、超市七成——这是行业之间最根本的差别
  const cogs = rev * (def.cogs ?? COGS_RATE);
  const wages = staff * wage;
  const openCost = cogs + wages;
  // 关门也要付：房租（含营销投放与店长工资）
  const rentH = def.hourlyRent * city.rentMult * lvC * mktgMult * (1 + 0.15 * (1 - b.condition));
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
           allDayGainPerHour, allDayCost, capPerStaff, priceMult, volumeMult, tier,
           cycMult, seasonMult, macro, month };
}

// 你的时间：清醒 16 小时，先扣掉店铺管理、做饭和通勤，剩下的才能拿去打工
export function timeBudget(biz, opts = {}) {
  let mgmt = 0;
  for (const b of biz) mgmt += b.manager ? MGMT_WITH_MANAGER : (BIZ[b.type_id]?.mgmt || 0);
  const meal = Math.max(0, opts.mealHours || 0);        // 自己做饭要占掉的时间
  const commute = Math.max(0, opts.commuteHours || 0);  // 路上耗掉的时间
  const chores = meal + commute;
  const free = Math.max(0, AWAKE_HOURS - mgmt - chores);
  const canJob = mgmt <= MGMT_MAX_WITH_JOB;
  const shift = canJob ? Math.min(WORK_HOURS_PER_DAY, free) : 0;
  const otMax = Math.max(0, Math.min(OVERTIME_MAX_HOURS, Math.floor(free - shift)));
  return { mgmt, meal, commute, chores, free, canJob, shift, otMax };
}

// 旺季：冰淇淋的七月，滑雪场的一月，殡仪馆没有旺季
export function seasonOf(def, month) { return seasonMultOf(def.season, month); }
export function seasonLabel(def) {
  if (!def?.season) return null;
  const [peak, amp] = def.season;
  return { peak, amp, low: ((peak + 5) % 12) + 1 };
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
  const rows = db.prepare('SELECT id,type_id FROM items WHERE user_id=?').all(userId);
  let p = 0;
  // 衣服要穿在身上才算数：堆在衣柜里的高定，谁也看不见
  for (const r of rows) { const d = ITEM[r.type_id]; if (d && !d.wearable) p += d.prestige || 0; }
  const pl = db.prepare('SELECT * FROM players WHERE user_id=?').get(userId);
  if (pl) p += lookOf(pl, rows).prestige;
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
  const env = bizEnv();
  // 装进公司的店铺，账面值算在股权里，不能再单独计一次
  const cos = companiesOf(userId);
  const coIds = new Set(cos.map(c => c.id));
  let bizValue = 0, bizNetPerHour = 0;
  for (const b of biz) {
    if (coIds.has(b.company_id)) continue;
    bizValue += b.invested * 0.80 * (0.65 + 0.35 * b.condition);
    bizNetPerHour += bizRates(b, pbonus, prosp[b.city] || 1, env.macro, env.month).net;
  }
  let equity = 0;
  const coList = [];
  for (const c of cos) {
    const shops = biz.filter(b => b.company_id === c.id);
    const v = valuate(c, shops, pbonus, prosp, M.currentGameHour());
    const e = stakeValue(c, v);
    equity += e;
    for (const b of shops) bizNetPerHour += bizRates(b, pbonus, prosp[b.city] || 1, env.macro, env.month).net * (c.player_shares / c.shares);
    coList.push({ id: c.id, name: c.name, ticker: c.ticker, stage: c.stage,
      value: v.value, stake: c.player_shares / c.shares, equity: e, cash: c.cash,
      growth: v.growth, shops: v.shops });
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
  const total = p.cash + p.bank + depValue + portfolio + bizValue + itemValueSum + equity - debt;
  return { cash: p.cash, bank: p.bank, deposits: depValue, portfolio, business: bizValue,
           items: itemValueSum, equity, debt, mortgage, total, bizNetPerHour,
           company: coList[0] || null, companies: coList,
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
  const bikeOwned = items.some(it => ITEM[it.type_id]?.bike);
  let job = JOB[p.job_id];
  const home = homeOf(p, homeItemOf(p, items));
  const look = lookOf(p, items);                        // 今天穿的这一身
  let meal = mealOf(p);
  const commute = commuteOf(p, carOwned, bikeOwned);
  // 做饭和通勤都是实打实的时间，先从一天里扣掉，剩下的才轮得到加班
  const tb = timeBudget(biz, { mealHours: meal.hours || 0, commuteHours: commute.hours || 0 });
  const working = !!job && (!job.car || carOwned) && tb.canJob;
  const sRate = savingsRate(), oRate = overdraftRate();
  let dayRev = 0, dayCost = 0, dayInterest = 0, dayOverdraft = 0, dayJob = 0, dayFood = 0, dayFare = 0;
  const bizCommute = biz.some(b => !b.manager);          // 亲自看店，也得每天出门
  // 装进公司的店铺，利润归各自公司的账上，不再直接进你口袋
  const cos = db.prepare('SELECT * FROM companies WHERE user_id=? ORDER BY id').all(userId);
  const coById = new Map(cos.map(c => [c.id, c]));
  const co = cos[0] || null;                        // 门店维护那一段沿用的默认引用
  // 实业的日净利估算（用于衡量月供负担）
  let dayIncomeRate = 0;
  const env0 = bizEnv();
  for (const b of biz) dayIncomeRate += bizRates(b, pb, prosp[b.city] || 1, env0.macro, env0.month).dailyNet;

  // 宏观周期的需求系数：繁荣时人人多花钱，衰退时先砍掉不必要的
  const macroDemand = M.regimeState().demand ?? 1;

  for (let h = from + 1; h <= target; h++) {
    // ── 作息：体力随睡眠恢复、随清醒与工作消耗 ──
    const hod = h % DAY_HOURS;
    const month = M.gameDate(h).month;          // 旺季按游戏内月份走
    const phase = dayPhase(hod);
    const rq = restQuality(p.work_streak);
    // 吃得好不好、住得好不好，直接体现在恢复上
    p.stamina += (phase === 'sleep' ? ST_SLEEP * rq : ST_AWAKE) + meal.stamina + home.stamina;

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
      const isBiz = p.trip_id.startsWith('biz:');
      const dest = isBiz ? null : DEST[p.trip_id];
      if (dest) {
        p.stress = clamp(p.stress - (p.trip_relief || 0), 0, STRESS_MAX);
        p.stamina = clamp(p.stamina + (p.trip_stam || 0), 0, STAMINA_MAX);
        ledger.push([h, 'trip', 0, L('led.tripBack', { trip: { zh: dest.zh, en: dest.en },
          relief: Math.round(p.trip_relief || 0) }), dest.flag]);
        // 记一笔足迹
        db.prepare(`INSERT INTO visits(user_id,place_id,times,nights,spent,first_hour,last_hour)
                    VALUES(?,?,1,?,?,?,?)
                    ON CONFLICT(user_id,place_id) DO UPDATE SET
                      times=times+1, nights=nights+excluded.nights,
                      spent=spent+excluded.spent, last_hour=excluded.last_hour`)
          .run(userId, dest.id, p.trip_nights || 0, p.trip_spent2 || 0, h, h);
      }
      p.trip_id = ''; p.trip_relief = 0; p.trip_stam = 0; p.trip_nights = 0; p.trip_spent2 = 0;
      p.work_streak = 0;
    }

    // ── 自动升职：经验够了就换到更好的岗位（需要车的岗位仍需自己选）──
    if (job && p.job_exp >= 0) {
      let best = job;
      for (const j of JOBS) if (!j.car && p.job_exp >= j.exp && j.wage > best.wage) best = j;
      if (best.id !== p.job_id) {
        p.job_id = best.id; job = best;
        ledger.push([h, 'job', 0, L('led.promoted', { job: { zh: best.zh, en: best.en }, wage: best.wage }), best.emoji]);
      }
    }

    // ── 连续工作天数：跨日时结算 ──
    const dayIdx = Math.floor(h / DAY_HOURS);
    let wentOut = 0;
    if (p.streak_day !== dayIdx) {
      if (p.streak_day >= 0) {
        // 昨天出没出门：上了班，或者要亲自看店
        wentOut = (p.worked_today || (bizCommute && !sick && !traveling)) ? 1 : 0;
        if (p.worked_today) p.work_streak += 1;
        else { if (p.work_streak >= 2) p.stress = clamp(p.stress - 6, 0, STRESS_MAX); p.work_streak = 0; }
      }
      p.streak_day = dayIdx; p.worked_today = 0;
    }
    const onLeave = p.off_day === dayIdx;                 // 今天请假

    // ── 正常班：可上工时长会被店铺管理精力挤占 ──
    const shiftHod = hod - WORK_START;
    const busy = h < (p.busy_until || 0);                  // 正在消遣，脱不开身
    if (working && !onLeave && phase === 'shift' && shiftHod < tb.shift && !sick && !traveling && !busy) {
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
    let dStress = phase === 'sleep' ? STRESS_SLEEP * rq * (1 + p.stress / STRESS_RELIEF_SCALE) : 0;
    dStress += streakStress(p.work_streak);              // 连轴转本身就是压力源
    dStress += meal.stress + home.stress + look.stress;  // 吃不好、住不好、穿不好，人是会垮的
    if (traveling) dStress -= 1.2;                       // 旅途中持续放松
    const debtNow = loans.reduce((a, l) => a + (l.status === 'active' ? l.balance : 0), 0);
    if (debtNow > 0) {
      const nwNow = Math.max(1, quickNetWorth(p, biz, items, holdings, assetsById, loans, deposits) + debtNow);
      const lev = debtNow / nwNow;                       // 负债率：欠得越多越焦虑
      if (lev > LEV_SAFE) dStress += Math.min(STRESS_DEBT_CAP, (lev - LEV_SAFE) * STRESS_DEBT_K / 24);
      // 月供压力：还款额占收入的比重才是真正压垮人的东西
      const monthlyPay = loans.reduce((a, l) => a + (l.status === 'active' ? l.payment : 0), 0);
      const monthlyIncome = Math.max(1, (dayIncomeRate + (working ? job.wage * WORK_HOURS_PER_DAY : 0)) * 30);
      const burden = monthlyPay / monthlyIncome;
      if (burden > BURDEN_SAFE) dStress += Math.min(STRESS_BURDEN_CAP, (burden - BURDEN_SAFE) * STRESS_BURDEN_K / 24);
    }
    if (p.cash < 0) dStress += 0.35;                     // 透支的焦虑
    if (pb > 0.10) dStress -= pb * 1.2;                  // 房子、车、艺术品带来的生活质量
    if (p.stamina < 25) dStress += 0.25;
    if (sick) dStress += p.sick_treated ? 0.1 : 0.45;    // 硬扛比就医更煎熬
    p.stress = clamp(p.stress + dStress, 0, STRESS_MAX);

    // ── 生病判定（吃得差、住得差会显著提高概率）──
    if (!sick && !traveling && Math.random() < sickChance(p.stress) * meal.sick) {
      const ill = pickIllness(p.stress);
      p.sick_id = ill.id; p.sick_until = h + ill.days * DAY_HOURS; p.sick_treated = 0;
      ledger.push([h, 'health', 0, L('led.fellIll', { ill: { zh: ill.zh, en: ill.en }, days: ill.days }), ill.emoji]);
    }

    for (const b of biz) {
      const city = bizCity(b);
      const pr = prosp[b.city] || 1;
      const def0 = BIZ[b.type_id];
      const r0 = bizRates(b, pb, pr, macroDemand, month);
      const tgt = demandTarget(b) * (r0.util < 0.98 ? 0.90 : 1);
      // 行业自己的波动：服装看季节脸色跳得厉害，殡葬业一年到头一个样
      b.demand = clamp(b.demand + (tgt - b.demand) * 0.005
                       + M.gauss() * 0.010 * city.vol * (def0?.vol ?? 1), 0.30, 2.30);
      // 折旧：汽修厂的举升机和软件公司的服务器，磨损速度不是一回事
      b.condition = clamp(b.condition - 0.00015 * (def0?.wear ?? 1), 0.20, 1);
      if (b.auto_staff) { const rec = bizRates(b, pb, pr, macroDemand, month).recStaff; if (rec !== b.staff) b.staff = rec; }
      const r = bizRates(b, pb, pr, macroDemand, month);
      b.understaffed = r.util;
      // 只有营业时段才有营收与人工；房租之类的固定成本 24 小时都在烧
      const open = bizOpenNow(b, hod);
      const absent = sick || traveling ? 0.92 : 1;       // 老板不在，生意打点折
      const rev = open ? r.rev * absent : 0;
      const cost = (open ? r.openCost : 0) + r.idleCost;
      b.month_revenue += rev; b.month_cost += cost;
      b.lifetime_profit += (rev - cost);
      dayRev += rev; dayCost += cost;
      const net = rev - cost;
      const owner = b.company_id ? coById.get(b.company_id) : null;
      if (owner) { owner.cash += net; owner.lifetime_profit += net; }
      // 装进公司的店，钱进的是公司账户，不是你的口袋——那就不能算进你的
      // 个人月度利润，更不能让你替公司交那 25% 的税。公司的利润在分红的
      // 时候按股息税收；两头都收，等于同一笔钱交两遍。
      else { p.cash += net; p.month_profit += net; }
      // 门店维护。不修的话 condition 一路掉，毛利本来就薄的小生意会被拖成亏损，
      // 一家连锁就这么慢慢烂掉——公司名下的店从公司账上出这笔钱。
      if (b.auto_repair && b.condition < 0.72) {
        const rc = r.def.cost * r.city.costMult * 0.22 * (1 - b.condition);
        const owner = b.company_id ? coById.get(b.company_id) : null;
        if (owner) { if (owner.cash > rc * 3) { owner.cash -= rc; b.condition = 1; } }
        else if (p.cash > rc * 3) { p.cash -= rc; b.condition = 1; }
      }
    }
    // 每家公司各算各的利润跑速：快慢两条线一拉开，就是在增长
    if (cos.length) {
      const rate = new Map();
      for (const b of biz) if (b.company_id && coById.has(b.company_id))
        rate.set(b.company_id, (rate.get(b.company_id) || 0) + bizRates(b, pb, prosp[b.city] || 1, macroDemand, month).dailyNet);
      for (const c of cos) stepGrowth(c, (rate.get(c.id) || 0) * 365);
    }
    // 自动转存：手上留够生活费，多出来的自动进活期——省得每天手动点一次
    if (p.sweep_keep > 0 && p.cash > p.sweep_keep) {
      const move = p.cash - p.sweep_keep;
      p.cash -= move; p.bank += move;
      if (h % DAY_HOURS === 0) ledger.push([h, 'bank', 0, L('led.sweep', { amt: move, keep: p.sweep_keep }), '🔁']);
    }
    if (p.bank > 0) { const i = p.bank * sRate / YEAR_HOURS; p.bank += i; dayInterest += i; }
    if (p.cash < 0) { const i = -p.cash * oRate / YEAR_HOURS; p.cash -= i; dayOverdraft += i; }
    for (const l of loans) if (l.status === 'active') l.balance += l.balance * l.rate / YEAR_HOURS;

    if (h % DAY_HOURS === 0) {
      // 一日三餐：吃不起就只能饿着
      if (meal.cost > 0) {
        if (p.cash + p.bank >= meal.cost) { payFrom(p, meal.cost); p.food_spent += meal.cost; dayFood += meal.cost; }
        else { p.meal_id = 'skip'; meal = MEAL.skip;
          ledger.push([h, 'living', 0, L('led.cantAfford'), '🚱']); }
      }
      // 通勤：出门的日子才花钱，路上也确实耗体力
      if (wentOut && commute.cost > 0) {
        if (payFrom(p, commute.cost)) { p.transit_spent += commute.cost; dayFare += commute.cost; }
      }
      if (wentOut) {
        p.stamina = clamp(p.stamina + (commute.stamina || 0), 0, STAMINA_MAX);
        p.stress = clamp(p.stress + (commute.stress || 0), 0, STRESS_MAX);
      }
      if (dayFood > 0) ledger.push([h, 'living', -dayFood, L('led.food', { meal: { zh: meal.zh, en: meal.en }, amt: dayFood }), meal.emoji]);
      if (dayFare > 0) ledger.push([h, 'living', -dayFare, L('led.commute', { way: { zh: commute.zh, en: commute.en }, amt: dayFare }), commute.emoji]);
      if (dayJob > 0) ledger.push([h, 'job', dayJob, L('led.jobDay', { job: { zh: job.zh, en: job.en }, amt: dayJob }), job.emoji]);
      if (dayRev > 0) ledger.push([h, 'biz', dayRev - dayCost, L('led.bizDay', { rev: dayRev, cost: dayCost }), '🏬']);
      if (dayInterest > 0.005) ledger.push([h, 'interest', dayInterest, L('led.interest'), '🏦']);
      if (dayOverdraft > 0.005) ledger.push([h, 'overdraft', -dayOverdraft, L('led.overdraft'), '⚠️']);
      dayRev = dayCost = dayInterest = dayOverdraft = dayJob = dayFood = dayFare = 0;
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
      // 自己的房租：没房就得租
      if (home.rent > 0) {
        payFrom(p, home.rent); p.rent_spent += home.rent;
        ledger.push([h, 'living', -home.rent, L('led.homeRent', { home: { zh: home.zh, en: home.en }, amt: home.rent }), home.emoji]);
      }
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
        // 金额随身家缩放：穷的时候只是小钱，富起来才伤筋动骨
        let amt = 0;
        if (ev.nwRate > 0) {
          const mag = Math.min(ev.cap, Math.max(ev.floor, nw * ev.nwRate * (0.5 + Math.random())));
          amt = ev.gain ? mag : -mag;
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
                work_streak=?,worked_today=?,streak_day=?,meal_id=?,food_spent=?,rent_spent=?,
                commute_id=?,transit_spent=?,job_id=?,
                trip_relief=?,trip_stam=?,trip_nights=?,trip_spent2=? WHERE user_id=?`)
      .run(p.cash, p.bank, p.credit_score, p.last_hour, p.prestige, p.month_profit,
           p.total_tax, p.total_dividend, p.missed_pay, p.peak_networth, p.bankrupt,
           p.job_exp, p.job_hours, p.job_income, p.stamina, p.ot_pending,
           p.stress, p.sick_until, p.sick_id, p.sick_treated, p.trip_until, p.trip_id,
           p.work_streak, p.worked_today, p.streak_day, p.meal_id, p.food_spent, p.rent_spent,
           p.commute_id, p.transit_spent, p.job_id,
           p.trip_relief, p.trip_stam, p.trip_nights, p.trip_spent2, userId);
    const ub = db.prepare(`UPDATE businesses SET demand=?,condition=?,lifetime_profit=?,month_revenue=?,
                           month_cost=?,staff=?,understaffed=? WHERE id=?`);
    for (const b of biz) ub.run(b.demand, b.condition, b.lifetime_profit, b.month_revenue, b.month_cost, b.staff, b.understaffed, b.id);
    if (cos.length) {
      const uc = db.prepare(`UPDATE companies SET cash=?,rate_fast=?,rate_slow=?,rate_vslow=?,growth=?,
                             lifetime_profit=? WHERE id=?`);
      for (const c of cos) uc.run(c.cash, c.rate_fast, c.rate_slow, c.rate_vslow, c.growth, c.lifetime_profit, c.id);
    }
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

  // 流水只留最近一个游戏月。再加一道行数上限，免得某个月特别忙的时候无限膨胀。
  db.prepare('DELETE FROM ledger WHERE user_id=? AND hour < ?').run(userId, target - LEDGER_KEEP_HOURS);
  db.prepare(`DELETE FROM ledger WHERE user_id=? AND id NOT IN
              (SELECT id FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT ?)`)
    .run(userId, userId, LEDGER_MAX_ROWS);
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
