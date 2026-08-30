// 业务 API：状态、行情、交易、收购、实业、银行、房产与奢侈品
import { db } from './db.js';
import * as M from './market.js';
import * as S from './sim.js';
import * as A from './auth.js';
import { BIZ_TYPES, CITIES, ITEM_TYPES, ITEM_CATS, REGIONS, SECTOR_EN, JOBS, RIVALS,
         ILLNESSES, TRIPS, FLIGHT_CLASSES, MEALS, HOMES, COMMUTES, LOTTERIES } from './catalog-content.js';
import * as CO from './company.js';
import { RIVALS_GEN } from './catalog-rivals-gen.js';
import { cityOf, cityEconomy, cityTravel, popText, LEGACY_CITIES } from './citybiz.js';
import { FOUND_FEE, FOUND_MIN_SHOPS, INIT_SHARES, ROUNDS, ROUND, STAGES, STAGE,
         CO_SECTORS, CO_SECTOR, DIVIDEND_TAX, MIN_DIVIDEND, ILLIQUID,
         IPO_TIERS, IPO_FLOAT, IPO_FEE } from './catalog-company.js';
import { DESTINATIONS, CABINS, HOTELS, REGIONS_W, DEFAULT_HOME, distanceKm, routeOf, HOMES_AVAILABLE,
         destOf, atlasCity, nearestCity, searchCities, CITY_ALIAS, CITY_COUNT, COUNTRIES, ATLAS } from './catalog-world.js';

const { RATES, L } = S;
class Err extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const num = (v, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  if (!isFinite(n)) throw new Err('数值无效 / Invalid number');
  if (n < min || n > max) throw new Err('数值超出允许范围 / Value out of range');
  return n;
};
const money = v => Math.round(num(v, 0.01, 1e18) * 100) / 100;
const NM = d => ({ zh: d?.name || '', en: d?.en || d?.name || '' });

function ledger(uid, kind, amount, detail, icon) {
  db.prepare('INSERT INTO ledger(user_id,hour,kind,amount,detail,icon) VALUES(?,?,?,?,?,?)')
    .run(uid, curHour(), kind, Math.round(amount * 100) / 100, detail, icon);
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const P = uid => db.prepare('SELECT * FROM players WHERE user_id=?').get(uid);
const savePlayer = p => db.prepare('UPDATE players SET cash=?,bank=?,credit_score=?,prestige=?,realized_pnl=? WHERE user_id=?')
  .run(p.cash, p.bank, p.credit_score, p.prestige, p.realized_pnl, p.user_id);
function curHour() { return Number(db.prepare("SELECT value FROM meta WHERE key='market_hour'").get()?.value || 0); }

// ── 离线收益报告 ────────────────────────────────────────────
const OFFLINE_MIN_MS = 10 * 60 * 1000;   // 离开超过 10 分钟才弹报告

function buildOfflineReport(uid, p, hour, nwNow) {
  const now = Date.now();
  const awayMs = p.last_seen_ms ? now - p.last_seen_ms : 0;
  let report = null;

  if (p.last_seen_ms && awayMs >= OFFLINE_MIN_MS && hour > p.last_seen_hour) {
    const fromHour = Math.max(p.last_seen_hour, hour - S.OFFLINE_CAP_HOURS);
    const rows = db.prepare(`SELECT kind, SUM(amount) amt, COUNT(*) n FROM ledger
                             WHERE user_id=? AND hour > ? AND hour <= ? AND kind != 'start'
                             GROUP BY kind`).all(uid, fromHour, hour);
    const sum = rows.reduce((a, r) => a + r.amt, 0);
    const nwDelta = nwNow - p.last_seen_nw;
    const highlights = db.prepare(`SELECT * FROM ledger WHERE user_id=? AND hour > ? AND hour <= ?
                                   AND kind IN ('event','deposit','dividend','loan')
                                   ORDER BY CASE kind WHEN 'event' THEN 0 WHEN 'deposit' THEN 1
                                                      WHEN 'dividend' THEN 2 ELSE 3 END,
                                            ABS(amount) DESC LIMIT 5`).all(uid, fromHour, hour);
    const elapsedHours = hour - p.last_seen_hour;
    const settledHours = Math.min(elapsedHours, S.OFFLINE_CAP_HOURS);
    // 如果不设上限，这段现实时间本该推进多少游戏小时
    const wouldHaveHours = Math.floor(awayMs / M.MS_PER_GAME_HOUR);
    report = {
      awayMs, awayRealHours: awayMs / 3.6e6, awayRealDays: awayMs / 8.64e7,
      gameHours: elapsedHours, settledHours, wouldHaveHours,
      skippedHours: Math.max(0, wouldHaveHours - elapsedHours),
      capped: wouldHaveHours > elapsedHours + 1,
      capHours: S.OFFLINE_CAP_HOURS, capDays: S.OFFLINE_CAP_HOURS / 24,
      fromHour: p.last_seen_hour, toHour: hour,
      fromDate: M.gameDate(p.last_seen_hour).text, toDate: M.gameDate(hour).text,
      nwBefore: p.last_seen_nw, nwAfter: nwNow, nwDelta,
      income: rows.filter(r => r.amt > 0).sort((a, b) => b.amt - a.amt),
      expense: rows.filter(r => r.amt < 0).sort((a, b) => a.amt - b.amt),
      totalIn: rows.filter(r => r.amt > 0).reduce((a, r) => a + r.amt, 0),
      totalOut: rows.filter(r => r.amt < 0).reduce((a, r) => a + r.amt, 0),
      cashFlow: sum,
      valuation: nwDelta - sum,        // 资产估值变动（股票/房产/店铺折旧）
      highlights,
    };
  }
  db.prepare('UPDATE players SET last_seen_ms=?, last_seen_hour=?, last_seen_nw=? WHERE user_id=?')
    .run(now, hour, nwNow, uid);
  return report;
}

// ── 状态 ────────────────────────────────────────────────────
export function getState(uid, active = true) {
  // 「在玩」指的是人真的在，不是这个标签页还开着。
  // 前端只在页面可见、而且最近还动过的时候才发 active=1；
  // 后台挂机、或者人走开很久，锚点就不再往前推，世界最多再走 7 个游戏日就停下等你。
  if (active) M.markActive();
  S.advancePlayer(uid);
  const p = P(uid);
  const hour = curHour();
  const nw = S.computeNetWorth(uid);
  const offline = buildOfflineReport(uid, p, hour, nw.total);
  const live = new Map(M.allAssets().map(a => [a.id, a]));
  const pbonus = S.prestigeBonus(S.prestigeOf(uid) + p.prestige);
  // 界面上的数字必须和结算用的是同一套参数：商圈繁荣度、宏观周期、旺季，一个都不能少
  const env = S.bizEnv();
  const prosp = M.cityProsperity();

  const businesses = db.prepare('SELECT * FROM businesses WHERE user_id=? ORDER BY id').all(uid).map(b => {
    const r = S.bizRates(b, pbonus, prosp[b.city] || 1, env.macro, env.month), def = S.BIZ[b.type_id], city = S.bizCity(b);
    return {
      id: b.id, typeId: b.type_id, name: b.name, emoji: def?.emoji, type: NM(def), cat: def?.cat, catEn: def?.catEn,
      city: NM(city), cityId: b.city, cityFlag: city.flag || '', level: b.level, marketing: b.marketing,
      companyId: b.company_id || 0,
      demand: b.demand, condition: b.condition, invested: b.invested, lifetime: b.lifetime_profit,
      revPerHour: r.rev, costPerHour: r.cost, netPerHour: r.net,
      potential: r.potential, capacity: r.capacity, util: r.util, recStaff: r.recStaff,
      staff: b.staff, wage: r.wage, wages: r.wages, fixedCost: r.fixed, varCost: r.varc,
      priceTier: b.price_tier, autoStaff: !!b.auto_staff, autoRepair: !!b.auto_repair,
      hours: r.hours, openHrs: r.openHrs, allDay: !!b.all_day, openNow: S.bizOpenNow(b, hour % 24),
      dailyNet: r.dailyNet, dailyRev: r.dailyRev, idleCost: r.idleCost, openCost: r.openCost,
      monthlyRent: r.monthlyRent, cogs: r.cogs, mgmt: r.mgmt,
      manager: !!b.manager, managerSalary: r.managerSalary,
      allDayCost: b.all_day ? null : r.allDayCost,
      allDayGain: b.all_day ? 0 : r.allDayGainPerHour * 24,
      demandTarget: S.demandTarget(b), monthRevenue: b.month_revenue, monthCost: b.month_cost,
      // 这行生意的脾气：界面上要能看出为什么两家同价的店表现完全不同
      trait: def ? { catId: def.catId, catEmoji: def.catEmoji, cogs: def.cogs, cyc: def.cyc,
                     vol: def.vol, wear: def.wear, mktg: def.mktg, labor: def.labor,
                     season: def.season, payDays: def.payDays } : null,
      cycMult: r.cycMult, seasonMult: r.seasonMult,
      upgradeCost: b.level < S.MAX_LEVEL ? S.upgradeCost(def, city, b.level) : null,
      marketingCost: b.marketing < S.MAX_MARKETING ? S.marketingCost(def, city, b.marketing) : null,
      repairCost: Math.round(def.cost * city.costMult * 0.22 * (1 - b.condition)),
      sellValue: Math.round(b.invested * 0.65 * (0.6 + 0.4 * b.condition)),
    };
  });

  const holdings = db.prepare('SELECT * FROM holdings WHERE user_id=? AND qty>0').all(uid).map(h => {
    const a = live.get(h.asset_id);
    const value = h.qty * a.price;
    const stake = h.qty / a.shares;
    return {
      id: a.id, symbol: a.symbol, name: a.name, zh: a.zh, kind: a.kind, sector: a.sector, unit: a.unit,
      qty: h.qty, cost: h.cost, avg: h.qty > 0 ? h.cost / h.qty : 0, price: a.price, value,
      pnl: value - h.cost, pnlPct: h.cost > 0 ? (value - h.cost) / h.cost : 0,
      stake, maxStake: a.max_stake, shares: a.shares, divYield: a.div_yield, eps: a.eps,
      monthlyDividend: stake >= 0.9995 ? a.eps * h.qty / 12 : h.qty * a.price * a.div_yield / 12 * (stake >= 0.5 ? 1.4 : 1) * (1 - RATES.divTax),
      change: (a.price - a.prev_close) / a.prev_close,
    };
  }).sort((x, y) => y.value - x.value);

  const rawItems = db.prepare('SELECT * FROM items WHERE user_id=? ORDER BY id').all(uid);
  const homeItem = S.homeItemOf(p, rawItems);
  const items = rawItems.map(it => {
    const d = S.ITEM[it.type_id];
    const value = S.itemValue(it);
    const loan = it.loan_id ? db.prepare("SELECT * FROM loans WHERE id=? AND status='active'").get(it.loan_id) : null;
    const region = d?.region ? S.REGION[d.region] : null;
    return { id: it.id, typeId: it.type_id, item: NM(d), emoji: d?.emoji, cat: d?.cat,
      catName: { zh: ITEM_CATS[d?.cat]?.name, en: ITEM_CATS[d?.cat]?.en },
      region: region ? NM(region) : null, regionFlag: region?.flag, indexSym: d?.index || null,
      value, paid: it.paid, gain: value - it.paid, rented: !!it.rented, canRent: !!d?.rent,
      canLive: d?.cat === 'estate', isHome: homeItem?.id === it.id, live: d?.live || null,
      wearable: !!d?.wearable, slot: d?.slot || null, style: d?.style || null,
      worn: d?.wearable ? p[S.WEAR_COLS[d.slot]] === it.id : false,
      shape: d?.shape, col: d?.col, col2: d?.col2,
      prestige: d?.prestige, upkeep: value * (d?.upkeep || 0), rent: it.rented ? value * (d?.rent || 0) : value * (d?.rent || 0),
      resale: value * (['estate', 'art', 'watch'].includes(d?.cat) ? 0.95 : 0.85),
      mortgage: loan ? { id: loan.id, balance: loan.balance, payment: loan.payment, rate: loan.rate, monthsLeft: loan.months_left } : null };
  });

  // 实业按归属分组要用：哪家店在哪家公司名下
  const myCompanies = CO.companiesOf(uid).map(c => ({
    id: c.id, name: c.name, nameEn: c.name_en || c.name, ticker: c.ticker,
    cash: c.cash, stage: c.stage, listed: c.stage === 'public', sector: c.sector }));

  const loans = db.prepare("SELECT * FROM loans WHERE user_id=? AND status='active' ORDER BY id").all(uid).map(l => ({
    id: l.id, kind: l.kind, itemId: l.item_id, principal: l.principal, balance: l.balance, rate: l.rate,
    termMonths: l.term_months, monthsLeft: l.months_left, payment: l.payment,
    nextDueIn: l.next_due - hour, paid: l.paid_total,
    itemName: l.item_id ? NM(S.ITEM[db.prepare('SELECT type_id FROM items WHERE id=?').get(l.item_id)?.type_id]) : null,
  }));
  const deposits = db.prepare("SELECT * FROM deposits WHERE user_id=? AND status='active' ORDER BY id").all(uid).map(d => ({
    id: d.id, amount: d.amount, rate: d.rate, termMonths: d.term_months, matureIn: d.mature_hour - hour,
    interest: d.amount * d.rate * (d.term_months / 12),
    progress: Math.min(1, (hour - d.start_hour) / Math.max(1, d.mature_hour - d.start_hour)),
  }));

  const carOwned = S.hasCar(uid), bikeOwned = S.hasBike(uid);
  const job = S.jobOf(p);
  // 有效经验：打工工时 + 身家折算 + 名声折算。做成过事的人不必从头攒工时。
  const prestigeNow = S.prestigeOf(uid) + p.prestige;
  const effExp = S.effectiveExp(p, nw.total, prestigeNow);
  const jobs = JOBS.map(j => ({ id: j.id, zh: j.zh, en: j.en, emoji: j.emoji, wage: j.wage, exp: j.exp,
    car: !!j.car, descZh: j.descZh, descEn: j.descEn,
    unlocked: effExp >= j.exp && nw.total >= (j.worth || 0),
    blocked: (!!j.car && !carOwned) || (nw.total < (j.worth || 0)),
    needWorth: j.worth || 0, current: p.job_id === j.id, track: j.track }));
  const prestige = prestigeNow;
  const personalDebt = loans.filter(l => l.kind !== 'mortgage').reduce((s, l) => s + l.balance, 0);
  const creditLimit = Math.max(0, Math.max(100_000, nw.total * 0.6 + Math.max(0, nw.bizNetPerHour) * M.YEAR_HOURS * 0.5) - personalDebt);

  return {
    build: process.env.BE_BUILD || '',
    birth: (() => { const h = S.birthOf(p); return { id: h.id, zh: h.zh, en: h.en, flag: h.flag,
      country: h.country, countryEn: h.countryEn, chosen: !!p.birth_id }; })(),
    // 人现在在哪儿：买了单程票就不在家乡了，所有机票从这里起算
    at: (() => { const b = S.birthOf(p); const w = S.whereOf(p, id => cityOf(id, b));
      return { id: w.id, zh: w.zh, en: w.en, flag: w.flag, country: w.country, countryEn: w.countryEn,
               away: w.id !== b.id }; })(),
    now: { hour, date: M.gameDate(hour), progress: M.hourProgress(), realMsPerHour: M.MS_PER_GAME_HOUR,
      speedMin: M.SPEED_MIN_MS, speedMax: M.SPEED_MAX_MS, speedDefault: M.SPEED_DEFAULT,
      ...M.pausedState() },
    player: {
      nickname: p.nickname,
      username: db.prepare('SELECT username FROM users WHERE id=?').get(uid)?.username || '',
      cash: p.cash, bank: p.bank, creditScore: p.credit_score,
      prestige, prestigeBonus: S.prestigeBonus(prestige), totalTax: p.total_tax,
      // 声望是饱和曲线：下一点还值多少、离上限还有多远，摆出来才知道该不该继续攒
      prestigeNext: S.prestigeBonus(prestige + 100) - S.prestigeBonus(prestige),
      // 没有上限，只有「翻倍需要多少声望」这个尺度
      prestigeDouble: Math.max(0, Math.ceil(prestige * (Math.pow(2, 1 / S.PRESTIGE_EXP) - 1))),
      totalDividend: p.total_dividend, realizedPnl: p.realized_pnl, missedPay: p.missed_pay,
      bankrupt: !!p.bankrupt, peak: p.peak_networth, playedHours: hour - p.created_hour, monthProfit: p.month_profit,
    },
    netWorth: nw, title: S.titleOf(nw.total), offline,
    job: (() => {
      const hod = hour % 24, phase = S.dayPhase(hod), day = Math.floor(hour / 24);
      const otUsed = p.ot_day === day ? p.ot_hours : 0;
      const busy = p.ot_pending > 0 && hour < p.ot_until;
      const tb = S.timeBudget(db.prepare('SELECT * FROM businesses WHERE user_id=?').all(uid),
        { mealHours: S.mealOf(p).hours || 0, commuteHours: S.commuteOf(p, carOwned, bikeOwned).hours || 0 });
      let block = null;
      if (!job) block = 'nojob';
      else if (!tb.canJob) block = 'owner';
      else if (job.car && !carOwned) block = 'needcar';
      else if (phase === 'shift') block = 'shift';
      else if (busy) block = 'busy';
      else if (tb.otMax <= 0) block = 'nomgmt';
      else if (otUsed >= tb.otMax) block = 'cap';
      else if (p.sick_until > hour) block = 'sick';
      else if (p.trip_until > hour) block = 'travel';
      else if (p.off_day === day) block = 'leave';
      else if (p.stress >= S.STRESS_MAX_FOR_OT) block = 'stressed';
      else if (p.stamina < S.ST_MIN_FOR_OT) block = 'tired';
      return {
        current: job ? { id: job.id, zh: job.zh, en: job.en, emoji: job.emoji, wage: job.wage } : null,
        exp: p.job_exp, hours: p.job_hours, income: p.job_income,
        // 履历的三块，界面上要拆开给人看，不然「我有九位数身家为什么还不够格」说不通
        effExp, expFromWorth: S.worthExp(nw.total), expFromPrestige: prestigeNow * S.EXP_FROM_PRESTIGE,
        netWorth: nw.total,
        working: !!job && (!job.car || carOwned), carOwned, list: jobs, tracks: S.JOB_TRACKS,
        stamina: p.stamina, staminaMax: S.STAMINA_MAX, efficiency: S.efficiency(p.stamina),
        phase, hod, wakeHour: S.WAKE_HOUR, sleepHour: S.SLEEP_HOUR,
        workStart: S.WORK_START, workEnd: S.WORK_END, workHours: S.WORK_HOURS_PER_DAY,
        otUsed, otMax: tb.otMax, otMult: S.OVERTIME_MULT,
        mgmtHours: tb.mgmt, freeHours: tb.free, shiftHours: tb.shift, canJob: tb.canJob,
        choreHours: tb.chores, mealHours: tb.meal, commuteHours: tb.commute,
        streak: p.work_streak, restQuality: S.restQuality(p.work_streak),
        streakStress: S.streakStress(p.work_streak) * 24,
        onLeave: p.off_day === Math.floor(hour / 24),
        awakeHours: S.AWAKE_HOURS, mgmtMax: S.MGMT_MAX_WITH_JOB,
        night: phase === 'sleep', nightMult: S.NIGHT_MULT,
        stress: p.stress, stressMax: S.STRESS_MAX, stressFactor: S.stressFactor(p.stress),
        sickChance: S.sickChance(p.stress),
        otPay: S.overtimePay(p, phase === 'sleep'), otBlock: block, canOvertime: !block,
        otBusy: busy, otPending: p.ot_pending, otUntil: p.ot_until,
        otRemainMs: busy ? Math.max(0, (p.ot_until - hour - M.hourProgress()) * M.MS_PER_GAME_HOUR) : 0,
        hustles: p.hustles, nextDayInHours: 24 - hod,
        dailyWage: (job ? job.wage : 0) * (tb.shift + tb.otMax * S.OVERTIME_MULT),
        sustainableWage: (job ? job.wage : 0) * (tb.shift + Math.min(3, tb.otMax) * S.OVERTIME_MULT),
      };
    })(),
    health: (() => {
      const ill = p.sick_id ? S.ILL[p.sick_id] : null;
      const bizTrip = p.trip_id && p.trip_id.startsWith('biz:');
      const bizCity = bizTrip ? (cityOf(p.trip_id.slice(4), S.birthOf(p)) || S.CITY[p.trip_id.slice(4)]) : null;
      const dst = !bizTrip && p.trip_id ? S.DEST[p.trip_id] : null;
      const trip = bizTrip
        ? (bizCity ? { id: 'biztrip', zh: '出差：' + bizCity.name, en: 'Business trip: ' + bizCity.en, emoji: '✈️' } : null)
        : (dst ? { id: dst.id, zh: dst.zh, en: dst.en, emoji: dst.flag } : null);
      return {
        stress: p.stress, stressMax: S.STRESS_MAX, factor: S.stressFactor(p.stress),
        sickRiskPerDay: Math.min(1, S.sickChance(p.stress) * 24),
        sick: ill ? { id: ill.id, zh: ill.zh, en: ill.en, emoji: ill.emoji,
          descZh: ill.descZh, descEn: ill.descEn, treated: !!p.sick_treated,
          untilHour: p.sick_until, hoursLeft: Math.max(0, p.sick_until - hour),
          treatCost: S.medicalCost(ill, nw.total), treatDays: ill.treatDays } : null,
        trip: trip ? { id: trip.id, zh: trip.zh, en: trip.en, emoji: trip.emoji,
          untilHour: p.trip_until, hoursLeft: Math.max(0, p.trip_until - hour) } : null,
        medSpent: p.med_spent, tripSpent: p.trip_spent, trips: p.trips,
        classes: FLIGHT_CLASSES,
        hasJet: db.prepare("SELECT COUNT(*) c FROM items WHERE user_id=? AND type_id LIKE 'jet_%'").get(uid).c > 0,
      };
    })(),
    living: (() => {
      const estates = rawItems.filter(it => S.ITEM[it.type_id]?.cat === 'estate');
      const meal = S.mealOf(p), home = S.homeOf(p, homeItem);
      const commute = S.commuteOf(p, carOwned, bikeOwned);
      const dailyWage = (job ? job.wage : 0) * 8;
      // 通勤费只在出门的日子花：一周按上五天算
      const commuteDays = 22;
      return {
        meal: { ...meal }, home: { ...home }, commute: { ...commute }, carOwned, bikeOwned,
        ownsEstate: !!homeItem, estateCount: estates.length,
        rentedOut: estates.filter(it => it.rented).length,
        // 名下每一套房：住着的、空着的、租出去的
        estates: estates.map(it => { const d = S.ITEM[it.type_id];
          return { id: it.id, zh: d.name, en: d.en, emoji: d.emoji, value: S.itemValue(it),
                   rented: !!it.rented, isHome: homeItem?.id === it.id,
                   stress: d.live?.stress ?? 0, stamina: d.live?.stamina ?? 0,
                   rentIncome: S.itemValue(it) * (d.rent || 0) }; }),
        meals: MEALS, homes: HOMES, commutes: COMMUTES,
        monthlyFood: meal.cost * 30, monthlyRent: home.rent,
        monthlyCommute: commute.cost * commuteDays, commuteDays,
        choreHours: (meal.hours || 0) + (commute.hours || 0),
        monthlyCost: meal.cost * 30 + home.rent + commute.cost * commuteDays,
        monthlyWage: dailyWage * 30,
        foodSpent: p.food_spent, rentSpent: p.rent_spent, transitSpent: p.transit_spent,
        lotteries: LOTTERIES.map(l => ({ id: l.id, emoji: l.emoji, zh: l.zh, en: l.en, price: l.price,
          maxBuy: l.maxBuy, descZh: l.descZh, descEn: l.descEn,
          topOdds: l.tiers[0][0], jackpot: l.jackpotBase ? jackpotOf(l) : l.tiers[0][1],
          tiers: l.tiers.map(([o, pz]) => ({ odds: o, prize: pz === 'JACKPOT' ? jackpotOf(l) : pz, isJackpot: pz === 'JACKPOT' })) })),
        lottoSpent: p.lotto_spent, lottoWon: p.lotto_won, lottoTickets: p.lotto_tickets,
      };
    })(),
    // ── 人物：性别、长相、身上这一套 ──
    look: (() => {
      const lk = S.lookOf(p, rawItems);
      const slots = {};
      for (const [k, v] of Object.entries(lk.slots))
        slots[k] = v ? { itemId: v.itemId, id: v.id, zh: v.name, en: v.en, emoji: v.emoji,
                         style: v.style, shape: v.shape, col: v.col, col2: v.col2, prestige: v.prestige } : null;
      return { gender: p.gender || 'x', skin: p.skin | 0, hair: p.hair | 0, haircol: p.haircol | 0,
        slots, score: lk.score, style: lk.style, coherence: lk.coherence,
        prestige: lk.prestige, worn: lk.worn, filled: lk.filled,
        genders: S.GENDERS, wearSlots: S.WEAR_SLOTS, styles: S.STYLES,
        wardrobe: rawItems.filter(it => S.ITEM[it.type_id]?.wearable).length };
    })(),
    // ── 消遣：做过什么、什么时候能再做 ──
    leisure: (() => {
      const done = Object.fromEntries(db.prepare('SELECT act_id,last_hour,times,spent FROM leisure WHERE user_id=?')
        .all(uid).map(r => [r.act_id, r]));
      return { cats: S.LEISURE_CATS,
        acts: S.LEISURE.map(a => { const r = done[a.id]; const since = r ? hour - r.last_hour : 1e9;
          const decay = Number.isFinite(S.REPEAT_DECAY) ? S.REPEAT_DECAY : 0.55;
  const fresh = since >= a.cool ? 1 : decay + (1 - decay) * (since / a.cool);
          return { ...a, times: r?.times || 0, spent: r?.spent || 0, fresh,
                   readyIn: Math.max(0, a.cool - since) }; }),
        spent: p.leisure_spent || 0, count: p.leisure_n || 0,
        busyUntil: p.busy_until || 0, busy: (p.busy_until || 0) > hour };
    })(),
    macro: M.regimeState(),
    prosperity: M.cityProsperity(),
    businesses, companies: myCompanies, holdings, items, loans, deposits,
    // 股票质押融资：身家在股权里，现金却在别处
    pledge: (() => {
      const pl = S.pledgeable(uid);
      const owed = db.prepare("SELECT COALESCE(SUM(balance),0) s FROM loans WHERE user_id=? AND status='active' AND kind='pledge'").get(uid).s;
      return { collateral: pl.value, owed, room: Math.max(0, pl.value * S.PLEDGE_LTV - owed),
        ltv: pl.value > 0 ? owed / pl.value : 0, maxLtv: S.PLEDGE_LTV, callLtv: S.PLEDGE_CALL,
        rate: S.pledgeRate(p.credit_score), items: pl.items.slice(0, 6) };
    })(),
    bank: { sweepKeep: p.sweep_keep || 0,
      savingsRate: S.savingsRate(), overdraftRate: S.overdraftRate(), fixedRates: S.fixedRates(),
      policyRate: M.policyRate(),
      loanRate: S.loanRate(p.credit_score), mortgageRate: S.mortgageRate(p.credit_score),
      creditLimit, totalDebt: nw.debt, mortgageDebt: nw.mortgage },
    offlineCap: { hours: S.OFFLINE_CAP_HOURS, days: S.OFFLINE_CAP_HOURS / 24 },
    tax: { corp: RATES.corpTax, div: RATES.divTax, capGain: RATES.capGainTax, property: RATES.propertyTax },
    fees: { commission: RATES.commission, minCommission: RATES.minCommission, spread: RATES.spread },
    ledger: db.prepare('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 220').all(uid),
    ledgerKeepDays: S.LEDGER_KEEP_HOURS / 24,
    nwHistory: db.prepare('SELECT hour,value FROM networth WHERE user_id=? ORDER BY hour DESC LIMIT 220').all(uid).reverse(),
    news: M.latestNews(15),
    index: M.marketIndex(),
    indices: M.allAssets().filter(a => a.kind === 'index').map(a => ({
      symbol: a.symbol, name: a.name, zh: a.zh, sector: a.sector, price: a.price,
      change: (a.price - a.prev_close) / a.prev_close, desc: a.desc })),
  };
}

// ── 行情 ────────────────────────────────────────────────────
export function getMarket(uid, kind) {
  M.advanceMarket();
  const held = new Map(db.prepare('SELECT asset_id,qty,cost FROM holdings WHERE user_id=? AND qty>0').all(uid).map(h => [h.asset_id, h]));
  return M.allAssets().filter(a => kind ? a.kind === kind : a.kind !== 'index').map(a => {
    const h = held.get(a.id);
    return {
      id: a.id, symbol: a.symbol, name: a.name, zh: a.zh, kind: a.kind, sector: a.sector, unit: a.unit,
      price: a.price, prevClose: a.prev_close, change: (a.price - a.prev_close) / a.prev_close,
      dayHigh: a.day_high, dayLow: a.day_low, divYield: a.div_yield, maxStake: a.max_stake,
      shares: a.shares, marketCap: a.price * a.shares, pe: a.eps > 0 ? a.price / a.eps : null,
      qty: h ? h.qty : 0, stake: h ? h.qty / a.shares : 0, avg: h && h.qty ? h.cost / h.qty : 0,
      hourChange: Math.expm1(a.last_ret),
    };
  });
}
export function getSparks() { M.advanceMarket(); return M.sparklines(); }

export function getAsset(uid, symbol, points = 240) {
  M.advanceMarket();
  const a = M.assetBySymbol(symbol);
  if (!a) throw new Err('资产不存在 / Asset not found', 404);
  const h = db.prepare('SELECT * FROM holdings WHERE user_id=? AND asset_id=?').get(uid, a.id);
  const base = getMarket(uid, a.kind).find(x => x.id === a.id) || {};
  const stake = h ? h.qty / a.shares : 0;
  return {
    ...base, kind: a.kind, symbol: a.symbol, name: a.name, zh: a.zh, unit: a.unit, sector: a.sector,
    price: a.price, desc: a.desc, fair: a.fair, sigma: a.sigma * a.vol_state, beta: a.beta, eps: a.eps,
    history: M.history(a.id, points),
    news: db.prepare("SELECT * FROM news WHERE (scope='asset' AND target=?) OR (scope='sector' AND target=?) ORDER BY id DESC LIMIT 10").all(a.symbol, a.sector),
    holding: h ? { qty: h.qty, cost: h.cost, avg: h.qty ? h.cost / h.qty : 0 } : null,
    annualProfit: a.kind === 'stock' ? a.eps * a.shares : null,
    takeover: a.kind === 'stock' && a.max_stake < 1 ? {
      eligible: stake >= a.max_stake - 1e-9,
      remaining: a.shares - (h?.qty || 0),
      premium: 1.20 + 0.5 * (1 - stake),
      cost: (a.shares - (h?.qty || 0)) * a.price * (1.20 + 0.5 * (1 - stake)),
    } : null,
  };
}

// ── 交易 ────────────────────────────────────────────────────
export function trade(uid, { symbol, side, qty }) {
  S.advancePlayer(uid);
  const a = M.assetBySymbol(String(symbol || ''));
  if (!a) throw new Err('资产不存在 / Asset not found', 404);
  if (a.kind === 'index') throw new Err('指数不可直接交易 / Indices are not tradable');
  let q = (a.kind === 'stock' || a.kind === 'district') ? Math.floor(num(qty, 1e-8, 1e15)) : Math.round(num(qty, 1e-8, 1e15) * 1e6) / 1e6;
  if (q <= 0) throw new Err('数量必须大于 0 / Quantity must be positive');
  const p = P(uid);
  const h = db.prepare('SELECT * FROM holdings WHERE user_id=? AND asset_id=?').get(uid, a.id) || { qty: 0, cost: 0 };
  const nm = { zh: a.zh, en: a.name };

  if (side === 'buy') {
    const cap = a.shares * a.max_stake;
    if (h.qty + q > cap + 1e-6) throw new Err(`超出持股上限 ${(a.max_stake * 100).toFixed(1)}% / Exceeds the ${(a.max_stake * 100).toFixed(1)}% ownership cap`);
    const px = a.price * (1 + RATES.spread);
    const gross = q * px;
    const fee = Math.max(RATES.minCommission, gross * RATES.commission);
    const total = gross + fee;
    if (p.cash < total) throw new Err(`现金不足，需要 ${S.fmt(total)} / Need ${S.fmt(total)} in cash`);
    p.cash -= total;
    db.prepare(`INSERT INTO holdings(user_id,asset_id,qty,cost) VALUES(?,?,?,?)
                ON CONFLICT(user_id,asset_id) DO UPDATE SET qty=qty+excluded.qty, cost=cost+excluded.cost`)
      .run(uid, a.id, q, total);
    M.applyImpact(a.id, q);
    savePlayer(p);
    const stake = (h.qty + q) / a.shares;
    ledger(uid, 'trade', -total, L('led.buy', { name: nm, sym: a.symbol, qty: q, unit: a.unit, px, fee }), '🛒');
    if (stake >= 0.9995) ledger(uid, 'event', 0, L('led.fullOwn', { name: nm }), '🏛️');
    else if (stake >= 0.5 && h.qty / a.shares < 0.5) ledger(uid, 'event', 0, L('led.control', { name: nm }), '👑');
    return { ok: true, price: px, fee, total, qty: q, stake };
  }
  if (side === 'sell') {
    if (h.qty < q - 1e-9) throw new Err(`持仓不足 / Insufficient position`);
    const px = a.price * (1 - RATES.spread);
    const gross = q * px;
    const fee = Math.max(RATES.minCommission, gross * RATES.commission);
    const basis = h.cost * (q / h.qty);
    const gain = gross - fee - basis;
    const tax = gain > 0 ? gain * RATES.capGainTax : 0;
    const net = gross - fee - tax;
    p.cash += net; p.realized_pnl += gain - tax;
    const left = h.qty - q;
    if (left <= 1e-9) db.prepare('DELETE FROM holdings WHERE user_id=? AND asset_id=?').run(uid, a.id);
    else db.prepare('UPDATE holdings SET qty=?, cost=? WHERE user_id=? AND asset_id=?').run(left, h.cost - basis, uid, a.id);
    M.applyImpact(a.id, -q);
    savePlayer(p);
    ledger(uid, 'trade', net, L('led.sell', { name: nm, sym: a.symbol, qty: q, unit: a.unit, px, gain, tax }), '💱');
    return { ok: true, price: px, fee, tax, net, gain, qty: q };
  }
  throw new Err('未知交易方向 / Unknown side');
}

// ── 全面收购要约 ────────────────────────────────────────────
export function takeover(uid, { symbol }) {
  S.advancePlayer(uid);
  const a = M.assetBySymbol(String(symbol || ''));
  if (!a || a.kind !== 'stock') throw new Err('只能对上市公司发起收购 / Only listed companies can be acquired');
  const h = db.prepare('SELECT * FROM holdings WHERE user_id=? AND asset_id=?').get(uid, a.id) || { qty: 0, cost: 0 };
  const stake = h.qty / a.shares;
  if (stake >= 0.9995) throw new Err('你已经全资拥有这家公司 / You already own it outright');
  if (stake < a.max_stake - 1e-9)
    throw new Err(`需先在二级市场买满 ${(a.max_stake * 100).toFixed(1)}% / Buy up to the ${(a.max_stake * 100).toFixed(1)}% cap first`);
  const remaining = a.shares - h.qty;
  const premium = 1.20 + 0.5 * (1 - stake);
  const cost = remaining * a.price * premium;
  const p = P(uid);
  if (p.cash < cost) throw new Err(`收购要约需要现金 ${S.fmt(cost)} / Tender offer requires ${S.fmt(cost)} in cash`);
  p.cash -= cost;
  db.prepare(`INSERT INTO holdings(user_id,asset_id,qty,cost) VALUES(?,?,?,?)
              ON CONFLICT(user_id,asset_id) DO UPDATE SET qty=?, cost=cost+?`)
    .run(uid, a.id, a.shares, cost, a.shares, cost);
  M.applyImpact(a.id, remaining * 0.35);
  savePlayer(p);
  ledger(uid, 'trade', -cost, L('led.takeover', { name: { zh: a.zh, en: a.name }, sym: a.symbol, cost, premium: premium - 1 }), '🏛️');
  return { ok: true, cost, premium };
}

// ── 实业 ────────────────────────────────────────────────────
export function bizBuy(uid, { typeId, cityId, name, useCompany, coId }) {
  S.advancePlayer(uid);
  const def = S.BIZ[typeId];
  const p = P(uid), hour = curHour();
  const home = S.whereOf(p, id => cityOf(id, S.birthOf(p)));   // 从你人在的地方飞过去
  const city = cityOf(cityId, home);
  if (!def || !city) throw new Err('店铺类型或城市无效 / Invalid business or city');
  if (p.sick_until > hour) throw new Err('生着病没法去选址开店 / You are too ill to go and set up a shop');
  if (p.trip_until > hour) throw new Err('你正在外地，回来再说 / You are already away');
  const setup = Math.round(def.cost * city.costMult);
  const travel = Math.round(city.travelCost || 0);
  const cost = setup + travel;
  // 公司账上的钱也能拿来开店——融来的钱就是干这个用的。
  // 名下可能有好几家公司，得说清楚是哪一家出钱、店归哪一家。
  const co = (useCompany || coId) ? CO.companyOf(uid, coId) : null;
  if ((useCompany || coId) && !co) throw new Err('找不到这家公司 / No such company');
  if (co) {
    if (co.cash < cost)
      throw new Err(`公司账上不够，需要 ${S.fmt(cost)}，现有 ${S.fmt(co.cash)} / Company needs ${S.fmt(cost)}, has ${S.fmt(co.cash)}`);
  } else if (p.cash < cost) {
    throw new Err(travel
      ? `现金不足：装修 ${S.fmt(setup)} + 往返差旅 ${S.fmt(travel)} = ${S.fmt(cost)} / Need ${S.fmt(cost)} (setup + travel)`
      : `现金不足，需要 ${S.fmt(cost)} / Need ${S.fmt(cost)}`);
  }
  if (co) db.prepare('UPDATE companies SET cash=cash-? WHERE id=?').run(cost, co.id);
  else p.cash -= cost;
  const nm = String(name || '').trim().slice(0, 24) || `${city.name}${def.name}`;
  db.prepare(`INSERT INTO businesses(user_id,type_id,name,city,city_mult,invested,created_hour,demand,staff,
              auto_staff,auto_repair,company_id,rev_mult,rent_mult,wage_mult,cost_mult,city_vol,city_name,city_en,city_flag)
              VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?)`)
    .run(uid, typeId, nm, cityId, city.revMult, cost, curHour(),
         0.9 + Math.random() * 0.2, 2, co ? 1 : 0, co ? co.id : 0,
         city.revMult, city.rentMult, city.wageMult, city.costMult, city.vol || 1,
         city.name, city.en, city.flag || '');
  // 异地开店需要亲自跑一趟：付机票、在外面待几天，这期间不能上班
  if (city.travelDays > 0) {
    db.prepare('UPDATE players SET trip_until=?, trip_id=?, trip_relief=1 WHERE user_id=?')
      .run(hour + city.travelDays * 24, 'biz:' + cityId, uid);
    ledger(uid, 'trip', -travel, L('led.bizTrip', { city: NM(city), cost: travel, days: city.travelDays }), '✈️');
  }
  savePlayer(p);
  ledger(uid, 'biz', -setup, L('led.bizOpen', { name: nm, city: NM(city), type: NM(def), cost: setup }), def.emoji);
  return { ok: true, cost, setup, travel, travelDays: city.travelDays || 0, company: !!co };
}

// 店铺归了公司，钱就该公司出、卖了也该公司收。
// 扩建、翻新、营销、改 24 小时——凡是这家店的开销，都走公司账户。
function purseFor(b, uid, p) {
  const co = b.company_id ? CO.companyOf(uid, b.company_id) : null;
  if (!co) return {
    cash: p.cash, who: null, tag: { zh: '', en: '' },
    short: amt => `现金不足，需要 ${S.fmt(amt)} / Need ${S.fmt(amt)}`,
    pay: amt => { p.cash -= amt; savePlayer(p); },
    take: amt => { p.cash += amt; savePlayer(p); },
  };
  return {
    cash: co.cash, who: co.name,
    short: amt => `「${co.name}」账上不够，需要 ${S.fmt(amt)}，现有 ${S.fmt(co.cash)} / ${co.name} needs ${S.fmt(amt)}, has ${S.fmt(co.cash)}`,
    tag: { zh: co.name + '：', en: co.name + ' — ' },
    pay: amt => db.prepare('UPDATE companies SET cash=cash-? WHERE id=?').run(amt, co.id),
    take: amt => db.prepare('UPDATE companies SET cash=cash+? WHERE id=?').run(amt, co.id),
  };
}

export function bizAction(uid, { id, action, name, arg }) {
  S.advancePlayer(uid);
  const b = db.prepare('SELECT * FROM businesses WHERE id=? AND user_id=?').get(num(id, 1), uid);
  if (!b) throw new Err('店铺不存在 / Business not found', 404);
  const def = S.BIZ[b.type_id], city = S.bizCity(b), p = P(uid);
  const purse = purseFor(b, uid, p);

  if (action === 'upgrade') {
    if (b.level >= S.MAX_LEVEL) throw new Err('已达最高等级 / Max level reached');
    const cost = S.upgradeCost(def, city, b.level);
    if (purse.cash < cost) throw new Err(purse.short(cost));
    purse.pay(cost);
    db.prepare('UPDATE businesses SET level=level+1, invested=invested+? WHERE id=?').run(cost, b.id);
    ledger(uid, 'biz', -cost, L('led.bizUpgrade', { by: purse.tag, name: b.name, level: b.level + 1, cost }), '🏗️');
    return { ok: true, cost, level: b.level + 1 };
  }
  if (action === 'marketing') {
    if (b.marketing >= S.MAX_MARKETING) throw new Err('营销投入已达上限 / Marketing maxed out');
    const cost = S.marketingCost(def, city, b.marketing);
    if (purse.cash < cost) throw new Err(purse.short(cost));
    purse.pay(cost);
    db.prepare('UPDATE businesses SET marketing=marketing+1, invested=invested+? WHERE id=?').run(Math.round(cost * 0.4), b.id);
    ledger(uid, 'biz', -cost, L('led.bizMarketing', { by: purse.tag, name: b.name, level: b.marketing + 1, cost }), '📣');
    return { ok: true, cost };
  }
  if (action === 'repair') {
    const cost = Math.round(def.cost * city.costMult * 0.22 * (1 - b.condition));
    if (cost <= 0) throw new Err('店铺状况良好 / Already in good condition');
    if (purse.cash < cost) throw new Err(purse.short(cost));
    purse.pay(cost);
    db.prepare('UPDATE businesses SET condition=1 WHERE id=?').run(b.id);
    ledger(uid, 'biz', -cost, L('led.bizRepair', { by: purse.tag, name: b.name, cost }), '🧹');
    return { ok: true, cost };
  }
  if (action === 'sell') {
    const value = Math.round(b.invested * 0.65 * (0.6 + 0.4 * b.condition));
    purse.take(value);                          // 公司的店卖了，钱回公司账上
    db.prepare('DELETE FROM businesses WHERE id=?').run(b.id);
    ledger(uid, 'biz', value, L('led.bizSell', { by: purse.tag, name: b.name, value }), '🤝');
    return { ok: true, value };
  }
  if (action === 'manager') {
    const on = arg ? 1 : 0;
    if (on && b.manager) throw new Err('已经雇了店长 / A manager is already in post');
    db.prepare('UPDATE businesses SET manager=? WHERE id=?').run(on, b.id);
    const sal = S.bizRates({ ...b, manager: 1 }, 0, 1).managerSalary;
    ledger(uid, 'biz', 0, L(on ? 'led.bizManagerHire' : 'led.bizManagerFire', { name: b.name, sal }), '🧑‍💼');
    return { ok: true };
  }
  if (action === 'allday') {
    if (b.all_day) throw new Err('已经是 24 小时营业 / Already open 24/7');
    const pbonus2 = S.prestigeBonus(S.prestigeOf(uid) + p.prestige);
    const cost = S.bizRates(b, pbonus2, 1).allDayCost;
    if (!cost) throw new Err('该店铺已是全天营业 / Already open 24/7');
    if (purse.cash < cost) throw new Err(purse.short(cost));
    purse.pay(cost);
    db.prepare('UPDATE businesses SET all_day=1, invested=invested+? WHERE id=?').run(cost, b.id);
    ledger(uid, 'biz', -cost, L('led.bizAllDay', { by: purse.tag, name: b.name, cost }), '🌃');
    return { ok: true, cost };
  }
  if (action === 'price') {
    const t = num(arg, -2, 2) | 0;
    db.prepare('UPDATE businesses SET price_tier=? WHERE id=?').run(t, b.id);
    const tier = S.PRICE_TIERS.find(x => x.v === t);
    ledger(uid, 'biz', 0, L('led.bizPrice', { name: b.name, tier: { zh: tier.zh, en: tier.en } }), '🏷️');
    return { ok: true };
  }
  if (action === 'staff') {
    db.prepare('UPDATE businesses SET staff=?, auto_staff=0 WHERE id=?').run(num(arg, 0, 5000) | 0, b.id);
    return { ok: true };
  }
  if (action === 'autostaff') {
    const on = arg ? 1 : 0;
    let staff = b.staff;
    if (on) staff = S.bizRates(b, S.prestigeBonus(S.prestigeOf(uid) + p.prestige)).recStaff;
    db.prepare('UPDATE businesses SET auto_staff=?, staff=? WHERE id=?').run(on, staff, b.id);
    return { ok: true };
  }
  if (action === 'autorepair') {
    db.prepare('UPDATE businesses SET auto_repair=? WHERE id=?').run(arg ? 1 : 0, b.id);
    return { ok: true };
  }
  if (action === 'rename') {
    const nm = String(name || '').trim().slice(0, 24);
    if (!nm) throw new Err('名称不能为空 / Name required');
    db.prepare('UPDATE businesses SET name=? WHERE id=?').run(nm, b.id);
    return { ok: true };
  }
  throw new Err('未知操作 / Unknown action');
}

// ── 银行 ────────────────────────────────────────────────────
export function bank(uid, { action, amount, months, id }) {
  S.advancePlayer(uid);
  const p = P(uid), hour = curHour();

  if (action === 'deposit') {
    const amt = money(amount);
    if (p.cash < amt) throw new Err('现金不足 / Not enough cash');
    p.cash -= amt; p.bank += amt; savePlayer(p);
    ledger(uid, 'bank', 0, L('led.bankDeposit', { amt }), '🏦');
    return { ok: true };
  }
  if (action === 'withdraw') {
    const amt = money(amount);
    if (p.bank < amt) throw new Err('活期余额不足 / Not enough in savings');
    p.bank -= amt; p.cash += amt; savePlayer(p);
    ledger(uid, 'bank', 0, L('led.bankWithdraw', { amt }), '🏦');
    return { ok: true };
  }
  if (action === 'fixed') {
    const amt = money(amount), m = num(months, 1, 24);
    if (!RATES.fixed[m]) throw new Err('期限无效 / Invalid term');
    if (amt < 1000) throw new Err('定期起存 $1,000 / Minimum $1,000');
    if (p.bank < amt) throw new Err('活期余额不足 / Not enough in savings');
    p.bank -= amt;
    db.prepare('INSERT INTO deposits(user_id,amount,rate,term_months,start_hour,mature_hour) VALUES(?,?,?,?,?,?)')
      .run(uid, amt, RATES.fixed[m], m, hour, hour + m * M.MONTH_HOURS);
    savePlayer(p);
    ledger(uid, 'bank', 0, L('led.fixedOpen', { amt, months: m, rate: RATES.fixed[m] }), '💰');
    return { ok: true };
  }
  if (action === 'redeem') {
    const d = db.prepare("SELECT * FROM deposits WHERE id=? AND user_id=? AND status='active'").get(num(id, 1), uid);
    if (!d) throw new Err('存单不存在 / Deposit not found');
    const prog = Math.min(1, (hour - d.start_hour) / Math.max(1, d.mature_hour - d.start_hour));
    const gain = d.amount * d.rate * (d.term_months / 12) * 0.3 * prog;
    p.bank += d.amount + gain;
    db.prepare("UPDATE deposits SET status='early' WHERE id=?").run(d.id);
    savePlayer(p);
    ledger(uid, 'bank', gain, L('led.fixedRedeem', { amt: d.amount, gain }), '💸');
    return { ok: true };
  }
  if (action === 'loan') {
    const amt = money(amount), m = num(months, 1, 60);
    if (p.credit_score < 350) throw new Err('信用分过低，银行拒绝放贷 / Credit score too low');
    const nw = S.computeNetWorth(uid);
    const debt = db.prepare("SELECT COALESCE(SUM(balance),0) s FROM loans WHERE user_id=? AND status='active' AND kind!='mortgage'").get(uid).s;
    const limit = Math.max(0, Math.max(100_000, nw.total * 0.6 + Math.max(0, nw.bizNetPerHour) * M.YEAR_HOURS * 0.5) - debt);
    if (amt > limit) throw new Err(`超出授信额度，最多 ${S.fmt(limit)} / Credit limit is ${S.fmt(limit)}`);
    const rate = S.loanRate(p.credit_score), i = rate / 12;
    const payment = amt * i / (1 - Math.pow(1 + i, -m));
    db.prepare(`INSERT INTO loans(user_id,principal,balance,rate,term_months,months_left,payment,next_due,created_hour,kind)
                VALUES(?,?,?,?,?,?,?,?,?,'personal')`).run(uid, amt, amt, rate, m, m, payment, hour + M.MONTH_HOURS, hour);
    p.cash += amt; savePlayer(p);
    ledger(uid, 'loan', amt, L('led.loanNew', { amt, rate, months: m, payment }), '🏦');
    return { ok: true, rate, payment };
  }
  // ── 股票质押：拿持仓换现金，不用卖 ──
  if (action === 'pledge') {
    const amt = money(amount);
    const pl = S.pledgeable(uid);
    const owed = db.prepare("SELECT COALESCE(SUM(balance),0) s FROM loans WHERE user_id=? AND status='active' AND kind='pledge'").get(uid).s;
    const room = Math.max(0, pl.value * S.PLEDGE_LTV - owed);
    if (pl.value <= 0) throw new Err('你名下没有可质押的股票 / You hold no stock to pledge');
    if (amt > room) throw new Err(`超出可融资额度，最多 ${S.fmt(room)}（持仓 ${S.fmt(pl.value)} 的 ${Math.round(S.PLEDGE_LTV * 100)}%）`
      + ` / Limit is ${S.fmt(room)}`);
    const rate = S.pledgeRate(p.credit_score);
    // 质押融资只付利息，本金随时还——这才是它的用处：要钱的时候有钱
    db.prepare(`INSERT INTO loans(user_id,principal,balance,rate,term_months,months_left,payment,next_due,created_hour,kind)
                VALUES(?,?,?,?,0,0,?,?,?,'pledge')`)
      .run(uid, amt, amt, rate, amt * rate / 12, hour + M.MONTH_HOURS, hour);
    p.cash += amt; savePlayer(p);
    ledger(uid, 'loan', amt, L('led.pledgeNew', { amt, rate,
      coll: Math.round(pl.value), ltv: Math.round(100 * (owed + amt) / pl.value) }), '📈');
    return { ok: true, rate, room: room - amt };
  }
  if (action === 'repay') {
    const l = db.prepare("SELECT * FROM loans WHERE id=? AND user_id=? AND status='active'").get(num(id, 1), uid);
    if (!l) throw new Err('贷款不存在 / Loan not found');
    const amt = Math.min(money(amount), l.balance);
    if (p.cash + p.bank < amt) throw new Err('现金与活期合计不足 / Insufficient funds');
    S.payFrom(p, amt);
    l.balance -= amt;
    if (l.balance <= 1) {
      db.prepare("UPDATE loans SET balance=0, status='closed', paid_total=paid_total+? WHERE id=?").run(amt, l.id);
      if (l.item_id) db.prepare('UPDATE items SET loan_id=0 WHERE id=?').run(l.item_id);
      p.credit_score = Math.min(850, p.credit_score + 12);
      ledger(uid, 'loan', -amt, L('led.loanPayoff', { amt }), '✅');
    } else {
      db.prepare('UPDATE loans SET balance=?, paid_total=paid_total+? WHERE id=?').run(l.balance, amt, l.id);
      ledger(uid, 'loan', -amt, L('led.loanRepay', { amt, left: l.balance }), '📉');
    }
    savePlayer(p);
    return { ok: true };
  }
  throw new Err('未知银行操作 / Unknown bank action');
}

// ── 房产 / 奢侈品 ───────────────────────────────────────────
export function itemBuy(uid, { typeId, downPct, months }) {
  S.advancePlayer(uid);
  const def = S.ITEM[typeId];
  if (!def) throw new Err('物品不存在 / Item not found');
  const p = P(uid), hour = curHour();
  const price = S.itemListPrice(def);
  const useMortgage = downPct != null && def.mortgage;
  let loanId = 0, down = price;

  if (useMortgage) {
    const dp = Math.min(1, Math.max(S.MIN_DOWN, num(downPct, 0.05, 1)));
    const m = num(months, 12, 480);
    if (!S.MORTGAGE_TERMS.includes(m)) throw new Err('贷款期限无效 / Invalid mortgage term');
    if (p.credit_score < 400) throw new Err('信用分不足，无法办理房贷 / Credit score too low for a mortgage');
    down = price * dp;
    const amt = price - down;
    if (p.cash < down) throw new Err(`首付不足，需要 ${S.fmt(down)} / Down payment of ${S.fmt(down)} required`);
    const rate = S.mortgageRate(p.credit_score), i = rate / 12;
    const payment = amt * i / (1 - Math.pow(1 + i, -m));
    const info = db.prepare(`INSERT INTO loans(user_id,principal,balance,rate,term_months,months_left,payment,next_due,created_hour,kind)
                             VALUES(?,?,?,?,?,?,?,?,?,'mortgage')`).run(uid, amt, amt, rate, m, m, payment, hour + M.MONTH_HOURS, hour);
    loanId = Number(info.lastInsertRowid);
    p.cash -= down;
    ledger(uid, 'loan', amt, L('led.mortgageNew', { item: NM(def), amt, rate, months: m, payment, down }), '🏦');
  } else {
    if (p.cash < price) throw new Err(`现金不足，需要 ${S.fmt(price)} / Need ${S.fmt(price)}`);
    p.cash -= price;
  }

  const units = def.index ? price / M.indexLevel(def.index) : 0;
  const info = db.prepare(`INSERT INTO items(user_id,type_id,value,paid,bought_hour,region,index_sym,units,loan_id)
                           VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(uid, typeId, price, price, hour, def.region || '', def.index || '', units, loanId);
  if (loanId) db.prepare('UPDATE loans SET item_id=? WHERE id=?').run(Number(info.lastInsertRowid), loanId);
  savePlayer(p);
  ledger(uid, 'item', -down, L('led.itemBuy', { item: NM(def), price, prestige: def.prestige, mortgage: !!loanId }), def.emoji);
  return { ok: true, price };
}

export function itemAction(uid, { id, action }) {
  S.advancePlayer(uid);
  const it = db.prepare('SELECT * FROM items WHERE id=? AND user_id=?').get(num(id, 1), uid);
  if (!it) throw new Err('物品不存在 / Item not found', 404);
  const def = S.ITEM[it.type_id], p = P(uid);
  const value = S.itemValue(it);

  if (action === 'sell') {
    const gross = value * (['estate', 'art', 'watch'].includes(def.cat) ? 0.95 : 0.85);
    let payoff = 0;
    if (it.loan_id) {
      const l = db.prepare("SELECT * FROM loans WHERE id=? AND status='active'").get(it.loan_id);
      if (l) {
        payoff = l.balance;
        db.prepare("UPDATE loans SET balance=0, status='closed', paid_total=paid_total+? WHERE id=?").run(payoff, l.id);
      }
    }
    const net = gross - payoff;
    if (net >= 0) p.cash += net; else S.payFrom(p, -net);
    // 身上穿着的卖掉了，格子也要跟着空出来
    for (const col of Object.values(S.WEAR_COLS))
      if (p[col] === it.id) db.prepare(`UPDATE players SET ${col}=0 WHERE user_id=?`).run(uid);
    db.prepare('DELETE FROM items WHERE id=?').run(it.id);
    savePlayer(p);
    ledger(uid, 'item', net, L('led.itemSell', { item: NM(def), value: gross, delta: value - it.paid, payoff }), '🤝');
    return { ok: true, value: gross, payoff };
  }
  if (action === 'rent') {
    if (!def.rent) throw new Err('该资产不可出租 / Not rentable');
    const on = it.rented ? 0 : 1;
    db.prepare('UPDATE items SET rented=? WHERE id=?').run(on, it.id);
    // 租出去就搬出来：房客住进去了，这套房不再是你的住处
    if (on && p.home_item_id === it.id) db.prepare('UPDATE players SET home_item_id=0 WHERE user_id=?').run(uid);
    ledger(uid, 'item', 0, L('led.itemRent', { item: NM(def), on, rent: value * def.rent }), '🔑');
    return { ok: true, rented: !!on };
  }
  if (action === 'wear') {
    if (!def.wearable) throw new Err('这个穿不上 / Not something you can wear');
    const col = S.WEAR_COLS[def.slot];
    const on = p[col] === it.id ? 0 : it.id;              // 再点一次就脱下来
    db.prepare(`UPDATE players SET ${col}=? WHERE user_id=?`).run(on, uid);
    return { ok: true, worn: !!on, slot: def.slot };
  }
  if (action === 'live') {
    if (def.cat !== 'estate') throw new Err('这不是能住的地方 / You cannot live there');
    // 自己要住进去，就先把房客请走
    const wasRented = !!it.rented;
    if (wasRented) db.prepare('UPDATE items SET rented=0 WHERE id=?').run(it.id);
    db.prepare('UPDATE players SET home_item_id=? WHERE user_id=?').run(it.id, uid);
    ledger(uid, 'item', 0, L(wasRented ? 'led.itemLiveEnd' : 'led.itemLive', { item: NM(def) }), def.emoji);
    return { ok: true, homeItemId: it.id, endedTenancy: wasRented };
  }
  throw new Err('未知操作 / Unknown action');
}

// ── 工作 / 零工 ─────────────────────────────────────────────
export function takeJob(uid, { jobId }) {
  S.advancePlayer(uid);
  const p = P(uid);
  if (jobId === '') { db.prepare("UPDATE players SET job_id='' WHERE user_id=?").run(uid); return { ok: true }; }
  const j = S.JOB[jobId];
  if (!j) throw new Err('职位不存在 / Job not found');
  const nwNow = S.computeNetWorth(uid);
  const eff = S.effectiveExp(p, nwNow.total, S.prestigeOf(uid) + p.prestige);
  if (eff < j.exp) throw new Err(`履历不够：需要 ${Math.round(j.exp)}，你现在 ${Math.round(eff)}`
    + `（工时 ${Math.round(p.job_exp)} + 身家折算 ${Math.round(S.worthExp(nwNow.total))} + 名声折算 ${Math.round((S.prestigeOf(uid) + p.prestige) * S.EXP_FROM_PRESTIGE)}）`
    + ` / Needs ${Math.round(j.exp)}, you have ${Math.round(eff)}`);
  if (j.worth && nwNow.total < j.worth)
    throw new Err(`这个位置还要求净资产 ${S.fmt(j.worth)}，你现在 ${S.fmt(nwNow.total)}`
      + ` / Also requires a net worth of ${S.fmt(j.worth)}`);
  if (j.car && !S.hasCar(uid)) throw new Err('这份工作需要你先拥有一辆车 / This job requires your own vehicle');
  db.prepare('UPDATE players SET job_id=? WHERE user_id=?').run(jobId, uid);
  ledger(uid, 'job', 0, L('led.jobTake', { job: { zh: j.zh, en: j.en }, wage: j.wage }), j.emoji);
  return { ok: true };
}

// 接一单加班：占用一个真实的游戏工时，期间不能再接
export function hustle(uid) {
  S.advancePlayer(uid);
  const p = P(uid);
  const hour = curHour(), hod = hour % 24, day = Math.floor(hour / 24);
  const j = S.jobOf(p);
  if (!j) throw new Err('先找一份工作 / Take a job first');
  if (j.car && !S.hasCar(uid)) throw new Err('这份工作需要一辆车 / This job requires a vehicle');

  if (p.sick_until > hour) throw new Err('你正在生病，先把身体养好 / You are ill — recover first');
  if (p.trip_until > hour) throw new Err('你正在旅行中 / You are away on a trip');
  if (p.off_day === Math.floor(hour / 24)) throw new Err('你今天请假了，好好休息 / You have taken the day off');
  if (p.stress >= S.STRESS_MAX_FOR_OT)
    throw new Err(`精神压力已达 ${Math.round(p.stress)}，实在提不起劲——去旅游散散心吧 / Stress is at ${Math.round(p.stress)} — take a trip before you break`);
  const phase = S.dayPhase(hod);
  const night = phase === 'sleep';        // 熬夜加班：钱多，但体力代价极大
  if (phase === 'shift')
    throw new Err(`你正在上正常班（${S.WORK_START}:00–${S.WORK_END}:00），下班后才能加班 / You are on your regular shift (${S.WORK_START}:00–${S.WORK_END}:00)`);
  if (p.ot_pending > 0 && hour < p.ot_until)
    throw new Err('这一单加班还没干完 / Your current overtime hour is not finished yet');

  const bizAll = db.prepare('SELECT * FROM businesses WHERE user_id=?').all(uid);
  const tb = S.timeBudget(bizAll,
    { mealHours: S.mealOf(p).hours || 0, commuteHours: S.commuteOf(p, S.hasCar(uid)).hours || 0 });
  const used = p.ot_day === day ? p.ot_hours : 0;
  if (tb.otMax <= 0)
    throw new Err(`店铺管理已经占满你的时间（每天 ${tb.mgmt.toFixed(1)} 小时），没空加班了 / Managing your businesses takes ${tb.mgmt.toFixed(1)}h a day — no time left`);
  if (used >= tb.otMax)
    throw new Err(`今天已加班 ${used} 小时，到上限了 / Daily overtime limit (${tb.otMax}h) reached`);
  if (p.stamina < S.ST_MIN_FOR_OT)
    throw new Err(`体力只剩 ${Math.round(p.stamina)}，太累了干不动，先睡一觉 / Too exhausted (stamina ${Math.round(p.stamina)}) — get some sleep first`);

  const pay = S.overtimePay(p, night);       // 报酬按接单时的体力锁定
  const stamina = Math.max(0, p.stamina + (night ? S.ST_NIGHT : S.ST_OVERTIME));
  const stress = Math.min(S.STRESS_MAX, p.stress + (night ? S.STRESS_NIGHT : S.STRESS_OT));
  db.prepare(`UPDATE players SET stamina=?, stress=?, ot_pending=?, ot_until=?, ot_hours=?, ot_day=?,
              hustles=hustles+1, last_hustle=?, worked_today=1 WHERE user_id=?`)
    .run(stamina, stress, pay, hour + 1, used + 1, day, Date.now(), uid);
  ledger(uid, 'job', 0, L(night ? 'led.otNight' : 'led.otStart', { job: { zh: j.zh, en: j.en }, amt: pay }), j.emoji);
  return { ok: true, pay, night, otUsed: used + 1, otMax: tb.otMax,
           until: hour + 1, stamina, cash: p.cash };
}

// ── 生活方式：吃什么、住哪儿 ────────────────────────────────
// 改自己的名字：昵称随时能改，用户名（登录用的）也能改，但要保证不重名
export function renameMe(uid, { nickname, username } = {}) {
  S.advancePlayer(uid);
  const out = {};
  if (nickname != null) {
    const n = String(nickname).trim().slice(0, 16);
    if (n.length < 1) throw new Err('昵称不能为空 / Nickname cannot be empty');
    db.prepare('UPDATE players SET nickname=? WHERE user_id=?').run(n, uid);
    out.nickname = n;
  }
  if (username != null) {
    const u = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(u))
      throw new Err('用户名只能用 3~16 位字母、数字或下划线 / 3-16 letters, digits or underscore');
    const taken = db.prepare('SELECT id FROM users WHERE username=? AND id<>?').get(u, uid);
    if (taken) throw new Err('这个用户名已经有人用了 / That username is taken');
    db.prepare('UPDATE users SET username=? WHERE id=?').run(u, uid);
    out.username = u;
  }
  return { ok: true, ...out };
}

// 自动转存：现金超过这个数就自动进活期
export function setSweep(uid, { keep } = {}) {
  S.advancePlayer(uid);
  const v = Math.max(0, Math.min(1e12, Number(keep) || 0));
  db.prepare('UPDATE players SET sweep_keep=? WHERE user_id=?').run(v, uid);
  return { ok: true, keep: v };
}

// ── 人物：性别与长相 ────────────────────────────────────────
export function setLook(uid, { gender, skin, hair, haircol } = {}) {
  S.advancePlayer(uid);
  const p = P(uid);
  if (gender != null) {
    if (!S.GENDERS.some(g => g.id === gender)) throw new Err('性别无效 / Invalid');
    db.prepare('UPDATE players SET gender=? WHERE user_id=?').run(gender, uid);
  }
  const set = (k, v, max) => { if (v != null) db.prepare(`UPDATE players SET ${k}=? WHERE user_id=?`)
    .run(Math.max(0, Math.min(max, v | 0)), uid); };
  set('skin', skin, 5); set('hair', hair, 7); set('haircol', haircol, 7);
  return { ok: true };
}

// ── 消遣：花钱花时间，把压力压下去 ──────────────────────────
export function doLeisure(uid, { actId } = {}) {
  S.advancePlayer(uid);
  const a = S.ACT[actId];
  if (!a) throw new Err('没有这个活动 / No such activity');
  const p = P(uid), hour = curHour();
  if (p.sick_until > hour) throw new Err('生着病，先把身体养好 / Not while you are ill');
  if (p.trip_until > hour) throw new Err('你正在外地 / You are away');
  if (p.cash < a.cost) throw new Err(`现金不足，需要 ${S.fmt(a.cost)} / Need ${S.fmt(a.cost)}`);

  // 同一项刚做过，这次的效果要打折——连着看三场电影，第三场就没意思了
  const row = db.prepare('SELECT * FROM leisure WHERE user_id=? AND act_id=?').get(uid, actId);
  const since = row ? hour - row.last_hour : 1e9;
  const decay = Number.isFinite(S.REPEAT_DECAY) ? S.REPEAT_DECAY : 0.55;
  const fresh = since >= a.cool ? 1 : decay + (1 - decay) * (since / a.cool);
  const relief = a.relief * fresh;
  const stamina = a.stamina * fresh;

  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);   // 算出 NaN 就不许落库
  if (a.cost) p.cash -= a.cost;
  p.stress = Math.max(0, num(p.stress) - num(relief));
  p.stamina = Math.min(100, Math.max(0, num(p.stamina) + num(stamina)));
  p.job_exp = num(p.job_exp) + Math.round(num((a.exp || 0) * fresh));
  p.prestige = num(p.prestige) + num(a.prestige);
  p.leisure_spent = (p.leisure_spent || 0) + a.cost;
  p.leisure_n = (p.leisure_n || 0) + 1;
  // 活动本身要占掉游戏时间：这段时间上不了班
  const until = hour + a.hours;
  db.prepare(`UPDATE players SET cash=?, stress=?, stamina=?, job_exp=?, prestige=?,
              leisure_spent=?, leisure_n=?, busy_until=? WHERE user_id=?`)
    .run(p.cash, p.stress, p.stamina, p.job_exp, p.prestige, p.leisure_spent, p.leisure_n,
         Math.max(p.busy_until || 0, until), uid);
  db.prepare(`INSERT INTO leisure(user_id,act_id,last_hour,times,spent) VALUES(?,?,?,1,?)
              ON CONFLICT(user_id,act_id) DO UPDATE SET last_hour=excluded.last_hour,
              times=times+1, spent=spent+excluded.spent`).run(uid, actId, hour, a.cost);
  if (a.cost) ledger(uid, 'leisure', -a.cost, L('led.leisure', { act: { zh: a.name, en: a.en },
    cost: a.cost, relief: Math.round(relief), hours: a.hours }), a.emoji);
  return { ok: true, relief: Math.round(relief), stamina: Math.round(stamina),
           exp: Math.round((a.exp || 0) * fresh), fresh, until, hours: a.hours };
}

export function setLiving(uid, { mealId, homeId, commuteId }) {
  S.advancePlayer(uid);
  if (mealId) {
    if (!S.MEAL[mealId]) throw new Err('伙食档位无效 / Invalid meal plan');
    db.prepare('UPDATE players SET meal_id=? WHERE user_id=?').run(mealId, uid);
    const m = S.MEAL[mealId];
    ledger(uid, 'living', 0, L('led.setMeal', { meal: { zh: m.zh, en: m.en }, cost: m.cost }), m.emoji);
  }
  if (homeId) {
    if (!S.HOME[homeId]) throw new Err('住处无效 / Invalid housing');
    db.prepare('UPDATE players SET home_id=? WHERE user_id=?').run(homeId, uid);
    const h = S.HOME[homeId];
    ledger(uid, 'living', 0, L('led.setHome', { home: { zh: h.zh, en: h.en }, rent: h.rent }), h.emoji);
  }
  if (commuteId) {
    const c = S.COMMUTE[commuteId];
    if (!c) throw new Err('通勤方式无效 / Invalid commute');
    if (c.needsCar) {
      if (!S.hasCar(uid)) throw new Err('你还没有车 / You do not own a car yet');
    }
    db.prepare('UPDATE players SET commute_id=? WHERE user_id=?').run(commuteId, uid);
    ledger(uid, 'living', 0, L('led.setCommute', { way: { zh: c.zh, en: c.en }, cost: c.cost }), c.emoji);
  }
  return { ok: true };
}

// ── 彩票：中奖率按真实彩种设定，累进奖池随销量增长 ──────────
function jackpotOf(l) {
  const v = Number(db.prepare('SELECT value FROM meta WHERE key=?').get('jackpot_' + l.id)?.value || 0);
  return Math.max(l.jackpotBase || 0, v);
}
export function buyLottery(uid, { id, n }) {
  S.advancePlayer(uid);
  const l = S.LOTTO[id];
  if (!l) throw new Err('彩种不存在 / Lottery not found');
  const count = Math.max(1, Math.min(l.maxBuy, Math.floor(num(n, 1, 100000))));
  const p = P(uid), spend = count * l.price;
  if (p.cash < spend) throw new Err(`现金不足，需要 ${S.fmt(spend)} / Need ${S.fmt(spend)}`);

  let jackpot = jackpotOf(l), won = 0, jackpotHit = false;
  const wins = [];
  for (let i = 0; i < count; i++) {
    for (const [odds, prize] of l.tiers) {
      if (Math.random() < 1 / odds) {
        const amt = prize === 'JACKPOT' ? jackpot : prize;
        won += amt;
        wins.push({ prize: amt, jackpot: prize === 'JACKPOT' });
        if (prize === 'JACKPOT') jackpotHit = true;
        break;                       // 每张票只中一个档位
      }
    }
  }
  // 没中头奖的部分继续做大奖池
  if (l.jackpotBase) {
    const next = jackpotHit ? l.jackpotBase : jackpot + count * l.price * (l.jackpotGrow || 1);
    db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('jackpot_' + l.id, String(Math.round(next)));
  }
  p.cash += won - spend;
  db.prepare(`UPDATE players SET cash=?, lotto_spent=lotto_spent+?, lotto_won=lotto_won+?,
              lotto_tickets=lotto_tickets+? WHERE user_id=?`).run(p.cash, spend, won, count, uid);
  if (jackpotHit) {
    ledger(uid, 'lottery', won - spend, L('led.lottoJackpot', { lot: { zh: l.zh, en: l.en }, amt: jackpot }), '🎉');
    db.prepare('UPDATE players SET prestige=prestige+40 WHERE user_id=?').run(uid);
  } else {
    ledger(uid, 'lottery', won - spend, L('led.lotto', { lot: { zh: l.zh, en: l.en }, n: count, spend, won }), l.emoji);
  }
  return { ok: true, count, spend, won, net: won - spend, jackpotHit, wins: wins.slice(0, 30),
           jackpot: jackpotOf(l), cash: p.cash };
}

// ── 请假：放自己一天，重置连轴转 ────────────────────────────
export function dayOff(uid) {
  S.advancePlayer(uid);
  const p = P(uid), hour = curHour(), day = Math.floor(hour / 24);
  if (p.off_day === day) throw new Err('今天已经在休息了 / Already resting today');
  if (p.trip_until > hour) throw new Err('你正在旅行中 / You are away');
  db.prepare(`UPDATE players SET off_day=?, work_streak=0, worked_today=0,
              stress=MAX(0, stress-9), stamina=MIN(100, stamina+18) WHERE user_id=?`).run(day, uid);
  ledger(uid, 'health', 0, L('led.dayOff'), '🛌');
  return { ok: true };
}

// ── 看病 ────────────────────────────────────────────────────
export function treat(uid) {
  S.advancePlayer(uid);
  const p = P(uid), hour = curHour();
  if (!p.sick_id || p.sick_until <= hour) throw new Err('你现在很健康 / You are not ill');
  if (p.sick_treated) throw new Err('已经在治疗中了 / Already under treatment');
  const ill = S.ILL[p.sick_id];
  const nw = S.computeNetWorth(uid).total;
  const cost = S.medicalCost(ill, nw);
  if (p.cash + p.bank < cost) throw new Err(`医药费需要 ${S.fmt(cost)} / Treatment costs ${S.fmt(cost)}`);
  S.payFrom(p, cost);
  const until = Math.min(p.sick_until, hour + ill.treatDays * 24);
  db.prepare('UPDATE players SET cash=?, bank=?, sick_until=?, sick_treated=1, med_spent=med_spent+? WHERE user_id=?')
    .run(p.cash, p.bank, until, cost, uid);
  ledger(uid, 'health', -cost, L('led.treated', { ill: { zh: ill.zh, en: ill.en }, cost, days: ill.treatDays }), '🏥');
  return { ok: true, cost, until, days: ill.treatDays };
}

// ── 开店城市：全世界 7,330 座任选 ──────────────────────────
function cityCard(c, def) {
  const setup = def ? Math.round(def.cost * c.costMult) : null;
  return { id: c.id, name: c.name, en: c.en, flag: c.flag || '', atlas: !!c.atlas,
    country: c.country, countryEn: c.countryEn, region: c.region, pop: c.pop,
    capital: c.capital, worldCity: c.worldCity,
    costMult: c.costMult, revMult: c.revMult, rentMult: c.rentMult, wageMult: c.wageMult,
    travelCost: c.travelCost || 0, travelDays: c.travelDays || 0, km: c.km || 0,
    desc: c.desc, descEn: c.descEn, setup, total: setup == null ? null : setup + (c.travelCost || 0) };
}

// 开店选址：默认给家乡 + 附近 + 几个世界级商圈，也可以搜
export function bizCities(uid, { q, typeId, limit }) {
  const p = P(uid), home = S.whereOf(p, id => cityOf(id, S.birthOf(p)));
  const def = typeId ? S.BIZ[typeId] : null;
  const n = Math.min(60, Math.max(1, (limit | 0) || 24));
  const seen = new Set();
  const out = [];
  const push = id => {
    if (seen.has(id)) return;
    const c = cityOf(id, home);
    if (!c) return;
    seen.add(id); out.push(cityCard(c, def));
  };
  const query = String(q || '').trim();
  if (query) {
    for (const c of searchCities(query, n)) push(CITY_ALIAS.get(c.id) ? c.id : c.id);
    return { home: cityCard(cityOf(home.id, home) || home, def), results: out, searched: true,
      companies: CO.companiesOf(uid).map(c => ({ id: c.id, name: c.name, ticker: c.ticker, cash: c.cash })) };
  }
  push(home.id);                                    // 家乡永远排第一
  for (const c of nearbyCities(home, 11)) push(c.id);   // 就近的大城市
  for (const id of ['tokyo.jp', 'new-york.us', 'london.gb', 'dubai.ae', 'singapore.sg',
                    'shanghai.cn', 'mumbai.in', 'sao-paulo.br', 'lagos.ng', 'bangkok.th'])
    push(id);
  return { home: cityCard(cityOf(home.id, home) || home, def), results: out.slice(0, n), searched: false,
    companies: CO.companiesOf(uid).map(c => ({ id: c.id, name: c.name, ticker: c.ticker, cash: c.cash })) };
}

// 离家最近的几座大城市（先按距离，人口太小的不算）
function nearbyCities(home, n) {
  const out = [];
  for (const c of ATLAS) {
    if (c.id === home.id || c.pop < 150_000) continue;
    out.push({ c, d: distanceKm(home, c) });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, n).map(x => x.c);
}

// ── 创业：注册公司、装店、估值、融资、分红 ──────────────────
const TICKER_RE = /^[A-Z]{2,5}$/;

function coState(uid, coId, want = {}) {
  const all = CO.companiesOf(uid);
  const co = coId ? all.find(c => c.id === Number(coId)) : all[0];
  const p = P(uid);
  // 公司清单：切换用，顺便让每一家的关键数字都能一眼看到
  const roster = all.map(c => {
    const shops = db.prepare('SELECT * FROM businesses WHERE user_id=? AND company_id=?').all(uid, c.id);
    const v = CO.valuate(c, shops, S.prestigeBonus(S.prestigeOf(uid) + p.prestige), M.cityProsperity(), curHour());
    return { id: c.id, name: c.name, ticker: c.ticker, stage: c.stage,
      stageZh: STAGE[c.stage]?.zh, stageEn: STAGE[c.stage]?.en,
      value: v.value, stake: c.player_shares / c.shares, cash: c.cash, shops: v.shops,
      growth: v.growth, listed: c.stage === 'public' };
  });
  const pb = S.prestigeBonus(S.prestigeOf(uid) + p.prestige);
  const prosp = M.cityProsperity();
  const bizAll = db.prepare('SELECT * FROM businesses WHERE user_id=?').all(uid);
  const owned = new Set(all.map(c => c.id));
  const freeShops = bizAll.filter(b => !owned.has(b.company_id));   // 还没被任何公司装走的
  if (!co) {
    return { has: false, roster, foundFee: FOUND_FEE, minShops: FOUND_MIN_SHOPS,
      atCap: all.length >= MAX_COMPANIES, maxCompanies: MAX_COMPANIES,
      sectors: CO_SECTORS, rounds: ROUNDS, illiquid: ILLIQUID,
      shopsAvailable: freeShops.map(b => shopBrief(b, pb, prosp)),
      canFound: freeShops.length >= FOUND_MIN_SHOPS && p.cash >= FOUND_FEE, cash: p.cash };
  }
  CO.syncPublicStake(co);                       // 上市后创始人持股以持仓为准
  const shops = bizAll.filter(b => b.company_id === co.id);
  const outside = freeShops;                        // 别家公司的店不在这儿挪
  const val = CO.valuate(co, shops, pb, prosp, curHour());
  const offer = co.stage === 'public' ? null : CO.roundOffer(co, val, p.credit_score);
  const stake = co.player_shares / co.shares;
  const mkt = M.indexLevel('BEXI') / 1000;      // 大盘冷暖决定承销商敢不敢定高价
  const ipo = co.stage === 'public' ? null : CO.ipoPlan(co, val, mkt, want);
  const listed = co.stage === 'public' && co.asset_id ? (() => {
    const a = M.assetById(co.asset_id);
    if (!a) return null;
    return { symbol: a.symbol, price: a.price, prevClose: a.prev_close, fair: a.fair,
      change: a.prev_close ? a.price / a.prev_close - 1 : 0, eps: a.eps,
      pe: a.eps > 0 ? a.price / a.eps : null, marketCap: a.price * a.shares,
      ipoPrice: co.ipo_price, ipoHour: co.ipo_hour,
      sinceIpo: co.ipo_price ? a.price / co.ipo_price - 1 : 0 };
  })() : null;
  return {
    has: true, roster, illiquid: ILLIQUID, rounds: ROUNDS, sectors: CO_SECTORS, cash: p.cash,
    canFoundMore: freeShops.length >= FOUND_MIN_SHOPS && p.cash >= FOUND_FEE,
    atCap: all.length >= MAX_COMPANIES, maxCompanies: MAX_COMPANIES,
    foundFee: FOUND_FEE, minShops: FOUND_MIN_SHOPS,
    shopsAvailable: freeShops.map(b => shopBrief(b, pb, prosp)),
    co: { id: co.id, name: co.name, nameEn: co.name_en, ticker: co.ticker, sector: co.sector,
      stage: co.stage, stageZh: STAGE[co.stage]?.zh, stageEn: STAGE[co.stage]?.en,
      foundedHour: co.founded_hour, cash: co.cash, shares: co.shares, autoDiv: co.auto_div || 0,
      playerShares: co.player_shares, stake, roundN: co.round_n, raised: co.raised,
      roundVal: co.round_val, peakVal: co.peak_val, lifetimeProfit: co.lifetime_profit,
      dividendsPaid: co.dividends_paid },
    val, offer, ipo, listed, stakeValue: CO.stakeValue(co, val),
    ipoReq: { tiers: IPO_TIERS, float: IPO_FLOAT, fee: IPO_FEE },
    shops: shops.map(b => shopBrief(b, pb, prosp)),
    outside: outside.map(b => shopBrief(b, pb, prosp)),
    minDividend: MIN_DIVIDEND, dividendTax: DIVIDEND_TAX, autoDivMax: AUTO_DIV_MAX,
  };
}
function shopBrief(b, pb, prosp) {
  const env = S.bizEnv();
  const r = S.bizRates(b, pb, prosp[b.city] || 1, env.macro, env.month);
  const def = S.BIZ[b.type_id], city = S.bizCity(b);
  return { id: b.id, name: b.name, emoji: def?.emoji || '🏬', typeZh: def?.name, typeEn: def?.en,
    city: b.city, cityZh: city?.name, cityEn: city?.en, level: b.level, invested: b.invested,
    dailyNet: r.dailyNet, dailyRev: r.dailyRev, companyId: b.company_id };
}

export function companyState(uid, coId, want) { S.advancePlayer(uid); return coState(uid, coId, want || {}); }

export function foundCompany(uid, { name, nameEn, ticker, sector, shopIds }) {
  S.advancePlayer(uid);
  const existing = CO.companiesOf(uid);
  if (existing.length >= MAX_COMPANIES)
    throw new Err(`最多同时经营 ${MAX_COMPANIES} 家公司 / You can run at most ${MAX_COMPANIES} companies`);
  const p = P(uid), hour = curHour();
  const nm = String(name || '').trim().slice(0, 24);
  if (nm.length < 2) throw new Err('公司名太短了 / Company name is too short');
  const tk = String(ticker || '').trim().toUpperCase();
  if (!TICKER_RE.test(tk)) throw new Err('股票代码要 2~5 个英文字母 / Ticker must be 2-5 letters');
  if (db.prepare('SELECT COUNT(*) c FROM assets WHERE symbol=?').get(tk).c
   || db.prepare('SELECT COUNT(*) c FROM companies WHERE ticker=?').get(tk).c)
    throw new Err(`代码 ${tk} 已经被占用了 / Ticker ${tk} is taken`);
  const sec = CO_SECTOR[sector] ? sector : CO_SECTORS[0].id;
  const owned = new Set(existing.map(c => c.id));
  const all = db.prepare('SELECT * FROM businesses WHERE user_id=?').all(uid).filter(b => !owned.has(b.company_id));
  if (all.length < FOUND_MIN_SHOPS)
    throw new Err(`还没被公司装走的生意不够 ${FOUND_MIN_SHOPS} 家 / You need ${FOUND_MIN_SHOPS} business not already inside a company`);
  if (p.cash < FOUND_FEE)
    throw new Err(`注册费 ${S.fmt(FOUND_FEE)}，现金不够 / Registration costs ${S.fmt(FOUND_FEE)}`);

  const wanted = new Set((Array.isArray(shopIds) ? shopIds : all.map(b => b.id)).map(Number));
  const picked = all.filter(b => wanted.has(b.id));
  if (!picked.length) throw new Err('至少要装一家店进去 / Put at least one business into it');

  p.cash -= FOUND_FEE;
  savePlayer(p);
  const r = db.prepare(`INSERT INTO companies(user_id,name,name_en,ticker,sector,stage,founded_hour,
              cash,shares,player_shares) VALUES(?,?,?,?,?, 'private',?,0,?,?)`)
    .run(uid, nm, String(nameEn || '').trim().slice(0, 32), tk, sec, hour, INIT_SHARES, INIT_SHARES);
  const coId = Number(r.lastInsertRowid);
  const upd = db.prepare('UPDATE businesses SET company_id=?, auto_repair=1 WHERE id=? AND user_id=?');
  for (const b of picked) upd.run(coId, b.id, uid);
  ledger(uid, 'company', -FOUND_FEE, L('led.coFound', { name: nm, ticker: tk, n: picked.length, fee: FOUND_FEE }), '🏢');
  return { ok: true, ...coState(uid, coId) };
}

// 把店铺装进公司 / 拿出来
export function companyShops(uid, { add, remove, coId }) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  if (co.stage === 'public') throw new Err('上市公司的资产不能随便进出 / A listed company cannot move assets in and out freely');
  const upd = db.prepare('UPDATE businesses SET company_id=?, auto_repair=1 WHERE id=? AND user_id=?');
  let moved = 0;
  for (const id of (Array.isArray(add) ? add : [])) { upd.run(co.id, Number(id), uid); moved++; }
  for (const id of (Array.isArray(remove) ? remove : [])) { upd.run(0, Number(id), uid); moved++; }
  if (!moved) throw new Err('没有要调整的店铺 / Nothing to move');
  return { ok: true, ...coState(uid, co.id) };
}

// 融资：投资人给的估值总比你自己算的低
export function raiseRound(uid, { coId } = {}) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  if (co.stage === 'public') throw new Err('已经上市了，融资要走公开市场 / Already listed');
  const st = coState(uid, co.id);
  const o = st.offer;
  if (!o) throw new Err('后面没有轮次了 / No further rounds available');
  if (!o.ok) {
    const need = [];
    if (st.val.value < o.needVal) need.push(`估值要到 ${S.fmt(o.needVal)}（现在 ${S.fmt(st.val.value)}）`);
    if (st.val.shops < o.needShops) need.push(`公司名下要有 ${o.needShops} 家店（现在 ${st.val.shops} 家）`);
    throw new Err(`还投不了：${need.join('，')} / Not yet: needs ${S.fmt(o.needVal)} valuation and ${o.needShops} shops`);
  }
  const stage = o.round.id;
  db.prepare(`UPDATE companies SET cash=cash+?, shares=shares+?, round_n=round_n+1,
              raised=raised+?, round_val=?, stage=?, last_val=?, peak_val=MAX(peak_val,?) WHERE id=?`)
    .run(o.raise, o.newShares, o.raise, o.post, stage, st.val.value, st.val.value, co.id);
  ledger(uid, 'company', 0, L('led.coRaise', { round: { zh: o.round.zh, en: o.round.en },
    amt: o.raise, pre: o.pre, post: o.post, pct: Math.round(o.round.sell * 100),
    stake: Math.round(o.stakeAfter * 100) }), '💰');
  return { ok: true, raised: o.raise, ...coState(uid, co.id) };
}

// 分红：公司账上的钱按持股比例发下来，你那份要缴 20% 的税
export function payDividend(uid, { amount, coId }) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  const amt = Math.min(co.cash, num(amount, MIN_DIVIDEND, 1e15));
  if (amt < MIN_DIVIDEND) throw new Err(`至少要发 ${S.fmt(MIN_DIVIDEND)} / Minimum dividend is ${S.fmt(MIN_DIVIDEND)}`);
  if (co.cash < amt) throw new Err(`公司账上只有 ${S.fmt(co.cash)} / The company only has ${S.fmt(co.cash)}`);
  const stake = co.player_shares / co.shares;
  const gross = amt * stake;
  const tax = gross * DIVIDEND_TAX;
  const net = gross - tax;
  const p = P(uid);
  p.cash += net; p.total_dividend += net; p.total_tax += tax;
  savePlayer(p);
  db.prepare('UPDATE companies SET cash=cash-?, dividends_paid=dividends_paid+? WHERE id=?').run(amt, amt, co.id);
  ledger(uid, 'dividend', net, L('led.coDividend', { total: amt, stake: Math.round(stake * 100),
    gross, tax, net }), '💵');
  return { ok: true, gross, tax, net, ...coState(uid, co.id) };
}

// 自动分红：设一个比例，往后每天自动把公司现金的这个比例发出来
export const AUTO_DIV_MAX = 0.50;
export function setAutoDividend(uid, { pct, coId } = {}) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  const v = Math.max(0, Math.min(AUTO_DIV_MAX, Number(pct) || 0));
  db.prepare('UPDATE companies SET auto_div=? WHERE id=?').run(v, co.id);
  return { ok: true, autoDiv: v, ...coState(uid, co.id) };
}

// 给公司注资：把个人的钱投进去（不稀释，你本来就是股东）
export function fundCompany(uid, { amount, coId }) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  const p = P(uid);
  const amt = num(amount, 1, 1e15);
  if (p.cash < amt) throw new Err(`现金不足 / Not enough cash`);
  p.cash -= amt; savePlayer(p);
  db.prepare('UPDATE companies SET cash=cash+? WHERE id=?').run(amt, co.id);
  ledger(uid, 'company', -amt, L('led.coFund', { name: co.name, amt }), '🏢');
  return { ok: true, ...coState(uid, co.id) };
}

// 上市：公司从此变成行情页上一支真的股票
export function listCompany(uid, { coId, price, float } = {}) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  if (co.stage === 'public') throw new Err('已经上市了 / Already listed');
  if (db.prepare('SELECT COUNT(*) c FROM assets WHERE symbol=?').get(co.ticker).c)
    throw new Err(`代码 ${co.ticker} 已被占用 / Ticker ${co.ticker} is taken`);
  const p = P(uid);
  const pb = S.prestigeBonus(S.prestigeOf(uid) + p.prestige);
  const prosp = M.cityProsperity();
  const shops = db.prepare('SELECT * FROM businesses WHERE user_id=? AND company_id=?').all(uid, co.id);
  const val = CO.valuate(co, shops, pb, prosp, curHour());
  const plan = CO.ipoPlan(co, val, M.indexLevel('BEXI') / 1000, { price, float });
  if (!plan.ok) {
    const need = [];
    if (val.value < plan.needVal) need.push(`估值要到 ${S.fmt(plan.needVal)}（现在 ${S.fmt(val.value)}）`);
    if (val.shops < plan.needShops) need.push(`名下要有 ${plan.needShops} 家店（现在 ${val.shops} 家）`);
    if (plan.needProfit) need.push('公司还没有盈利');
    const tierNote = plan.rounds >= 2 ? ''
      : `（融过 ${plan.rounds} 轮，走的是${plan.rounds ? '' : '未融资'}这一档；再融一轮门槛会降下来）`;
    throw new Err(`还上不了市：${need.join('，')}${tierNote} / Not eligible to list yet`);
  }
  // 定价太高，簿记根本填不满——这单发不出去，承销费照付，脸也丢了
  if (plan.pulled) {
    const fee = Math.round(plan.wantShares * plan.indPrice * IPO_FEE * 0.25);
    const pl = P(uid);
    S.payFrom(pl, fee);
    pl.prestige = Math.max(0, pl.prestige - 8);
    savePlayer(pl);
    ledger(uid, 'company', -fee, L('led.coIpoPulled', { name: co.name,
      price: plan.price, ind: plan.indPrice, fill: Math.round(plan.fill * 100), fee }), '🧊');
    throw new Err(`发行价 ${S.fmt(plan.price)} 定得太高，簿记只认购到 ${Math.round(plan.fill * 100)}%，这单发不出去。`
      + `承销商收了 ${S.fmt(fee)} 的费用，声望 -8。降价再试。`
      + ` / Priced at ${S.fmt(plan.price)} the book only filled ${Math.round(plan.fill * 100)}% — the deal was pulled.`);
  }
  const hour = curHour();
  const r = CO.goPublic(co, val, plan, hour);
  // 首日表现决定这单的口碑：大涨是好新闻，破发是坏新闻
  const pop = r.pop;
  const prestige = Math.round(clamp(12 + pop * 45, -6, 30));
  db.prepare('UPDATE players SET prestige=MAX(0, prestige+?) WHERE user_id=?').run(prestige, uid);
  ledger(uid, 'company', 0, L('led.coIpo', { name: co.name, ticker: co.ticker,
    price: r.price, raised: r.raised, cap: r.marketCap,
    stake: Math.round(plan.stakeAfter * 100) }), '🔔');
  ledger(uid, 'company', 0, L(pop >= 0 ? 'led.coIpoPop' : 'led.coIpoBreak', {
    ticker: co.ticker, open: r.open, price: r.price, pct: Math.round(Math.abs(pop) * 100),
    fill: Math.round(plan.fill * 100), prestige }), pop >= 0 ? '🚀' : '💔');
  return { ok: true, ...r, prestige, ...coState(uid, co.id) };
}

// 拆股 / 并股：股本乘以 n，每股价格除以 n。公司还是那个公司，
// 你手上的钱一分不多一分不少——只是把同一块蛋糕切成更多份。
export const SPLIT_MAX = 20;
export function splitCompany(uid, { coId, ratio, reverse } = {}) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  const n = Math.round(Number(ratio) || 0);
  if (!(n >= 2 && n <= SPLIT_MAX))
    throw new Err(`比例要在 2 到 ${SPLIT_MAX} 之间 / Ratio must be between 2 and ${SPLIT_MAX}`);
  const rev = !!reverse;
  if (rev && co.shares / n < 1000)
    throw new Err('并股之后股本太小了 / That would leave too few shares');
  if (!rev && co.shares * n > 5e11)
    throw new Err('股本太大了 / That would leave too many shares');

  if (co.stage === 'public' && co.asset_id) {
    M.splitAsset(co.asset_id, n, rev);          // 上市了：股价、历史、所有人的持仓一起调整
  } else {
    const f = rev ? 1 / n : n;                  // 还没上市：只有股本和创始人持股
    db.prepare('UPDATE companies SET shares=shares*?, player_shares=player_shares*? WHERE id=?')
      .run(f, f, co.id);
  }
  const after = CO.companyOf(uid, co.id);
  ledger(uid, 'company', 0, L(rev ? 'led.coReverseSplit' : 'led.coSplit',
    { name: co.name, n, shares: Math.round(after.shares) }), '🔀');
  return { ok: true, ...coState(uid, co.id) };
}

export function renameCompany(uid, { name, nameEn, coId }) {
  S.advancePlayer(uid);
  const co = CO.companyOf(uid, coId);
  if (!co) throw new Err('你还没有公司 / You have not founded a company');
  const nm = String(name || '').trim().slice(0, 24);
  if (nm.length < 2) throw new Err('公司名太短了 / Company name is too short');
  db.prepare('UPDATE companies SET name=?, name_en=? WHERE id=?')
    .run(nm, String(nameEn || '').trim().slice(0, 32), co.id);
  return { ok: true, ...coState(uid, co.id) };
}

// ── 世界地图：订机票出发 ────────────────────────────────────
export function bookTrip(uid, { destId, nights, cabin, hotel, oneWay }) {
  S.advancePlayer(uid);
  const p = P(uid), hour = curHour();
  const d = S.DEST[destId];
  if (!d) throw new Err('目的地不存在 / Destination not found');
  if (p.sick_until > hour) throw new Err('生着病就别出门了 / Not while you are ill');
  if (p.trip_until > hour) throw new Err('你已经在旅途中了 / You are already travelling');
  const c = S.CABIN[cabin] || CABINS[0];
  if (c.needJet && !db.prepare("SELECT COUNT(*) c FROM items WHERE user_id=? AND type_id LIKE 'jet_%'").get(uid).c)
    throw new Err('你还没有私人飞机 / You do not own a private jet');
  // 起点是你人现在在的地方，不是出生地——上一趟买了单程票，这一趟就从那儿飞
  const from = S.whereOf(p, id => cityOf(id, S.birthOf(p)));
  if (d.id === from.id) throw new Err('你已经在这儿了 / You are already there');
  const ow = !!oneWay;
  const q = S.tripQuote(d, num(nights, 0, 60), c.id, hotel, from, ow);
  if (p.cash < q.total)
    throw new Err(`现金不足：机票 ${S.fmt(q.air)} + 住宿 ${S.fmt(q.stay)} + 花销 ${S.fmt(q.daily)} = ${S.fmt(q.total)} / Need ${S.fmt(q.total)}`);
  p.cash -= q.total;
  db.prepare(`UPDATE players SET cash=?, prestige=prestige+?, trip_until=?, trip_id=?,
              trip_relief=?, trip_stam=?, trip_nights=?, trip_spent2=?,
              trip_spent=trip_spent+?, trips=trips+1 WHERE user_id=?`)
    .run(p.cash, q.prestige, hour + q.hours, d.id, q.relief, q.stamina, q.nights, q.total, q.total, uid);
  // 单程票飞过去就留在那儿；往返票飞完回原地
  db.prepare('UPDATE players SET at_id=? WHERE user_id=?')
    .run(ow ? d.id : (p.at_id || ''), uid);
  ledger(uid, 'trip', -q.total, L(ow ? 'led.tripOneWay' : 'led.tripGo2', {
    place: { zh: d.zh, en: d.en }, flag: d.flag, from: { zh: from.zh, en: from.en },
    nights: q.nights, cabin: { zh: q.cabin.zh, en: q.cabin.en }, hotel: { zh: q.hotel.zh, en: q.hotel.en },
    air: q.air, stay: q.stay, daily: q.daily, total: q.total, hours: Math.round(q.flightHours) }), d.flag);
  return { ok: true, ...q, until: hour + q.hours, place: d.zh, movedTo: ow ? d.id : null };
}

// 世界地图数据 + 我的足迹
export function worldMap(uid) {
  const p = P(uid);
  const birth = S.birthOf(p);
  // 地图上的每一条航线都从你人在的地方起算——买了单程票，起点就换了
  const home = S.whereOf(p, id => cityOf(id, birth));
  const rows = db.prepare('SELECT * FROM visits WHERE user_id=?').all(uid);
  const visited = Object.fromEntries(rows.map(r => [r.place_id, r]));
  const countries = new Set(rows.map(r => destOf(r.place_id)?.country).filter(Boolean));
  const regions = new Set(rows.map(r => destOf(r.place_id)?.region).filter(Boolean));
  return {
    home, birth, away: home.id !== birth.id, chosen: !!p.birth_id,
    atlas: { cities: CITY_COUNT, countries: COUNTRIES.size, total: TOTAL_PLACES,
             birthMinPop: BIRTH_MIN_POP, alias: Object.fromEntries(CITY_ALIAS) },
    homeOptions: HOMES_AVAILABLE().map(d => ({ id: d.id, zh: d.zh, en: d.en, flag: d.flag,
      country: d.country, countryEn: d.countryEn, lon: d.lon, lat: d.lat, region: d.region,
      descZh: d.descZh, descEn: d.descEn, hotel: d.hotel, spend: d.spend })),
    regions: REGIONS_W,
    cabins: CABINS, hotels: HOTELS,
    hasJet: db.prepare("SELECT COUNT(*) c FROM items WHERE user_id=? AND type_id LIKE 'jet_%'").get(uid).c > 0,
    places: DESTINATIONS.filter(d => d.id !== home.id).map(d => {
      const rt = routeOf(home, d);
      return { ...d, km: rt.km, flight: rt.fare, flightOneWay: rt.fareOneWay, hours: rt.hours,
        fromZh: home.zh, fromEn: home.en, isBirth: d.id === birth.id,
        visit: visited[d.id] ? { times: visited[d.id].times, nights: visited[d.id].nights,
          spent: visited[d.id].spent, firstHour: visited[d.id].first_hour, lastHour: visited[d.id].last_hour } : null };
    }),
    footprint: {
      places: rows.length, total: TOTAL_PLACES - 1,
      countries: countries.size, totalCountries: COUNTRIES.size,
      regions: regions.size, totalRegions: REGIONS_W.length,
      nights: rows.reduce((a, r) => a + r.nights, 0),
      trips: rows.reduce((a, r) => a + r.times, 0),
      spent: rows.reduce((a, r) => a + r.spent, 0),
      list: rows.map(r => ({ ...destOf(r.place_id), times: r.times, nights: r.nights, spent: r.spent,
        firstHour: r.first_hour, lastHour: r.last_hour }))
        .filter(x => x.id).sort((a, b) => a.firstHour - b.firstHour),
    },
  };
}

// 图集里任意一座城市：算好航线，够格就能订
export const BIRTH_MIN_POP = 20_000;
export const TOTAL_PLACES = CITY_COUNT - CITY_ALIAS.size + DESTINATIONS.length;
export const MAX_COMPANIES = 8;   // 同时经营的公司上限

function placePayload(uid, d) {
  const p = P(uid), birth = S.birthOf(p);
  const home = S.whereOf(p, id => cityOf(id, birth));
  const rt = routeOf(home, d);
  const v = db.prepare('SELECT * FROM visits WHERE user_id=? AND place_id=?').get(uid, d.id);
  return { ...d, km: rt.km, flight: rt.fare, flightOneWay: rt.fareOneWay, hours: rt.hours,
    fromId: home.id, fromZh: home.zh, fromEn: home.en, fromFlag: home.flag,
    isHere: d.id === home.id, isBirth: d.id === birth.id, isHome: d.id === home.id,
    visit: v ? { times: v.times, nights: v.nights, spent: v.spent, firstHour: v.first_hour, lastHour: v.last_hour } : null };
}

// 地图上点中某座城市：返回它的完整资料与航线
export function place(uid, { id }) {
  const d = destOf(id);
  if (!d) throw new Err('找不到这个地方 / No such place');
  return placePayload(uid, d);
}

// 搜索城市：中英文都能搜
export function citySearch(uid, { q, limit }) {
  const home = S.birthOf(P(uid));
  const hits = searchCities(q, Math.min(60, Math.max(1, limit | 0) || 30));
  return { results: hits.map(c => {
    const d = destOf(CITY_ALIAS.get(c.id) || c.id);
    if (d.id === home.id) return null;                 // 家乡不是目的地
    const rt = routeOf(home, d);
    return { id: d.id, zh: d.zh, en: d.en, flag: d.flag, country: d.country, countryEn: d.countryEn,
      region: d.region, lon: d.lon, lat: d.lat, pop: c.pop, km: rt.km, flight: rt.fare, hours: rt.hours };
  }).filter(Boolean) };
}

// 在地图上落 pin：吸附到最近的城市
export function nearest(uid, { lon, lat, minPop }) {
  const c = nearestCity(Number(lon) || 0, Number(lat) || 0, minPop === undefined ? 0 : (minPop | 0));
  if (!c) throw new Err('这附近没有城市 / No city near there');
  return placePayload(uid, destOf(CITY_ALIAS.get(c.id) || c.id));
}

// 选择出生地（只能选一次）
export function setBirthplace(uid, { id }) {
  const p = P(uid);
  if (p.birth_id) throw new Err('出生地已经确定了 / Your birthplace is already set');
  const d = destOf(id);
  if (!d) throw new Err('找不到这个地方 / No such place');
  if (!d.home && !(d.atlas && d.pop >= BIRTH_MIN_POP))
    throw new Err('这里太小了，换个大一点的城市 / Too small to start a life in — pick a larger town');
  db.prepare('UPDATE players SET birth_id=? WHERE user_id=?').run(id, uid);
  ledger(uid, 'start', 0, L('led.birth', { place: { zh: d.zh, en: d.en },
    country: { zh: d.country, en: d.countryEn }, flag: d.flag }), d.flag);
  return { ok: true, home: d };
}

// 游戏速度
export function setSpeed(uid, { ms }) {
  const v = M.setSpeed(num(ms, M.SPEED_MIN_MS, M.SPEED_MAX_MS));
  return { ok: true, msPerHour: v, minutes: v / 60000 };
}

// ── 富豪榜：财富与游戏内公司股价实时联动 ────────────────────
const ALL_RIVALS = [...RIVALS, ...RIVALS_GEN];

export function richList(uid) {
  const live = new Map(M.allAssets().map(a => [a.symbol, a]));
  const mine = new Map(db.prepare('SELECT asset_id,qty FROM holdings WHERE user_id=? AND qty>0').all(uid)
    .map(h => { const a = M.assetById(h.asset_id); return [a?.symbol, h.qty / (a?.shares || 1)]; }));
  const list = ALL_RIVALS.map(r => {
    const a = r.symbol ? live.get(r.symbol) : null;
    const cap = a ? a.price * a.shares : 0;
    const yours = mine.get(r.symbol) || 0;
    const diluted = Math.max(0, 1 - yours);   // 你买走的部分不再属于他
    const equity = cap * r.stake * diluted;
    return { id: r.id, zh: r.zh, en: r.en, emoji: r.emoji, bio: r.bio,
      symbol: r.symbol, company: a ? { zh: a.zh, en: a.name } : null, sector: a ? a.sector : null,
      stake: r.stake, yourStake: yours, takenOver: yours >= 0.999,
      equity, other: r.other, value: equity + r.other, npc: true };
  });
  const me = S.computeNetWorth(uid);
  const p = P(uid);
  list.push({ id: 'me', zh: p.nickname, en: p.nickname, emoji: S.titleOf(me.total).icon,
    value: me.total, npc: false, companies: (me.companies || []).length });
  list.sort((a, b) => b.value - a.value);
  const ranked = list.map((x, i) => ({ ...x, rank: i + 1 }));

  // ── 你对这个世界做了什么 ──
  const share = CO.playerSectorScale();
  const caps = new Map();
  for (const a of M.allAssets()) if (a.kind === 'stock') caps.set(a.sector, (caps.get(a.sector) || 0) + a.price * a.shares);
  const pressure = [];
  for (const [sec, e] of share) {
    const own = e.players.filter(x => x.userId === uid);
    if (!own.length) continue;
    const cap = caps.get(sec) || 0;
    const sh = e.scale / (e.scale + cap);
    if (sh < CO.EROSION_MIN) continue;
    pressure.push({ sector: sec, share: sh, annualDrag: sh * CO.EROSION_K,
      removed: CO.erosionTotal(sec), names: own.map(x => x.name),
      hitting: ranked.filter(r => r.sector === sec && r.npc).slice(0, 3).map(r => ({ zh: r.zh, en: r.en })) });
  }
  const stakes = ranked.filter(r => r.npc && r.yourStake > 0.001)
    .map(r => ({ zh: r.zh, en: r.en, symbol: r.symbol, company: r.company,
      yourStake: r.yourStake, takenOver: r.takenOver,
      cost: r.stake * (live.get(r.symbol)?.price || 0) * (live.get(r.symbol)?.shares || 0) * r.yourStake }))
    .sort((a, b) => b.yourStake - a.yourStake).slice(0, 12);

  return { list: ranked, total: ranked.length,
    impact: { pressure, stakes, erosionK: CO.EROSION_K, minShare: CO.EROSION_MIN } };
}

// ── 公司榜：全部上市公司 + 你自己的（含未上市，按估值折算）──
export function companyBoard(uid) {
  const rows = [];
  for (const a of M.allAssets()) {
    if (a.kind !== 'stock') continue;
    const own = a.link && a.link.startsWith('co:') ? Number(a.link.slice(3)) : 0;
    rows.push({ symbol: a.symbol, zh: a.zh, en: a.name, sector: a.sector,
      cap: a.price * a.shares, price: a.price, change: a.prev_close ? a.price / a.prev_close - 1 : 0,
      pe: a.eps > 0 ? a.price / a.eps : null, listed: true, coId: own, mine: false });
  }
  // 自己名下还没上市的公司，按估值排进来
  const p = P(uid);
  const pb = S.prestigeBonus(S.prestigeOf(uid) + p.prestige), prosp = M.cityProsperity();
  const myCoIds = new Set();
  for (const co of CO.companiesOf(uid)) {
    myCoIds.add(co.id);
    if (co.stage === 'public') continue;
    const shops = db.prepare('SELECT * FROM businesses WHERE user_id=? AND company_id=?').all(uid, co.id);
    const v = CO.valuate(co, shops, pb, prosp, curHour());
    rows.push({ symbol: co.ticker, zh: co.name, en: co.name_en || co.name,
      sector: CO_SECTOR[co.sector]?.zh || co.sector, cap: v.value, price: null, change: 0,
      pe: v.annual > 0 ? v.value / v.annual : null, listed: false, coId: co.id, mine: true });
  }
  for (const r of rows) if (r.coId && myCoIds.has(r.coId)) r.mine = true;
  rows.sort((a, b) => b.cap - a.cap);
  return { rows: rows.map((r, i) => ({ ...r, rank: i + 1 })), total: rows.length };
}

// ── 账号管理 ───────────────────────────────────────────────
export function deleteAccount(uid, { password }) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  if (!u) throw new Err('账号不存在 / Account not found', 404);
  try { A.login(u.username, password); } catch { throw new Err('密码错误 / Wrong password', 403); }
  db.exec('BEGIN');
  try {
    for (const t of ['holdings','businesses','items','loans','deposits','ledger','networth','visits','players','sessions'])
      db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid);
    db.prepare('DELETE FROM users WHERE id=?').run(uid);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { ok: true };
}

// 目录规模：登录页的数字从这里来，改了内容就不会说谎
export function scale() {
  return {
    markets: M.allAssets().length,
    stocks: M.allAssets().filter(a => a.kind === 'stock').length,
    biz: BIZ_TYPES.length,
    items: ITEM_TYPES.length,
    jobs: JOBS.length,
    wardrobe: S.WEARABLES.length,
    leisure: S.LEISURE.length,
    destinations: DESTINATIONS.length,
  };
}

// ── 其它 ────────────────────────────────────────────────────
export function catalog() {
  const idx = Object.fromEntries(M.allAssets().filter(a => a.kind === 'index').map(a => [a.symbol, a.price]));
  return {
    biz: BIZ_TYPES, bizCats: S.BIZ_CATS, cities: CITIES, regions: REGIONS, cogsRate: S.COGS_RATE,
    items: ITEM_TYPES.map(i => ({ ...i, listPrice: i.index ? i.price * (idx[i.index] || 100) / 100 : i.price })),
    itemCats: ITEM_CATS, priceTiers: S.PRICE_TIERS, titles: S.TITLES, jobs: JOBS, jobTracks: S.JOB_TRACKS,
    wearSlots: S.WEAR_SLOTS, styles: S.STYLES, genders: S.GENDERS, leisureCats: S.LEISURE_CATS,
    regimes: M.REGIMES, hustleCooldown: S.HUSTLE_COOLDOWN_MS,
    maxLevel: S.MAX_LEVEL, maxMarketing: S.MAX_MARKETING,
    mortgageTerms: S.MORTGAGE_TERMS, minDown: S.MIN_DOWN,
    sectors: [...new Set(M.allAssets().filter(a => a.kind !== 'index').map(a => a.sector))]
      .map(s => ({ zh: s, en: SECTOR_EN[s] || s })),
  };
}

// ── 大盘概览：涨跌分布 / 板块表现 / 涨跌幅榜 ────────────────
export function marketOverview(uid) {
  M.advanceMarket();
  const all = M.allAssets();
  const stocks = all.filter(a => a.kind === 'stock');
  const breadth = {};
  for (const k of ['stock', 'commodity', 'crypto']) {
    const l = all.filter(a => a.kind === k);
    breadth[k] = {
      up: l.filter(a => a.price > a.prev_close).length,
      down: l.filter(a => a.price < a.prev_close).length,
      flat: l.filter(a => a.price === a.prev_close).length,
      total: l.length,
      avg: l.reduce((s, a) => s + (a.price - a.prev_close) / a.prev_close, 0) / (l.length || 1),
    };
  }
  const secMap = {};
  for (const a of all) {
    if (a.kind === 'index') continue;
    const m = secMap[a.sector] || (secMap[a.sector] = { zh: a.sector, en: SECTOR_EN[a.sector] || a.sector, cap: 0, prev: 0, n: 0 });
    m.cap += a.price * a.shares; m.prev += a.prev_close * a.shares; m.n++;
  }
  const sectors = Object.values(secMap).map(m => ({ ...m, change: m.prev ? (m.cap - m.prev) / m.prev : 0 }))
    .sort((a, b) => b.change - a.change);
  const rank = all.filter(a => a.kind !== 'index')
    .map(a => ({ symbol: a.symbol, zh: a.zh, name: a.name, kind: a.kind, price: a.price,
      change: (a.price - a.prev_close) / a.prev_close, cap: a.price * a.shares }));
  rank.sort((a, b) => b.change - a.change);
  const bex = M.assetBySymbol('BEXI');
  return {
    breadth, sectors,
    gainers: rank.slice(0, 8), losers: rank.slice(-8).reverse(),
    index: { ...M.marketIndex(), history: bex ? M.history(bex.id, 300) : [], desc: bex?.desc || '' },
    macro: M.regimeState(),
    news: M.latestNews(20),
    // 市场传闻：只说迹象，不说方向。看得懂就看得懂。
    // target 现在是股票代码；老存档里还留着一批指向板块的旧记录，
    // 这里把它们分辨出来，前端才知道该跳到哪支股票、还是退回按板块筛。
    rumors: (() => {
      // 只看最近一个月的风声。更早的传闻早就有结果了，留在那儿只会挡住新的。
      const rows = db.prepare("SELECT hour,target,headline FROM news WHERE scope='rumor' AND hour >= ? ORDER BY id DESC LIMIT 12")
        .all(curHour() - M.NEWS_KEEP_HOURS);
      const bySym = new Map(M.allAssets().map(a => [a.symbol, a]));
      return rows.map(r => {
        const a = bySym.get(r.target);
        return { ...r, symbol: a ? a.symbol : null, zh: a?.zh || null, en: a?.name || null,
                 sector: a ? a.sector : r.target, isStock: !!a };
      });
    })(),
  };
}

export function leaderboard() {
  return db.prepare(`
    SELECT u.username, p.nickname, p.peak_networth,
      (SELECT value FROM networth n WHERE n.user_id=u.id ORDER BY hour DESC LIMIT 1) cur
    FROM users u JOIN players p ON p.user_id=u.id`).all()
    .map(r => ({ name: r.nickname || r.username, value: r.cur ?? r.peak_networth ?? 0, peak: r.peak_networth }))
    .sort((a, b) => b.value - a.value).slice(0, 20);
}

export function resetSave(uid, opts = {}) {
  const before = S.computeNetWorth(uid);
  const cleared = {
    cash: before?.cash || 0, netWorth: before?.total || 0,
    businesses: db.prepare('SELECT COUNT(*) c FROM businesses WHERE user_id=?').get(uid).c,
    holdings: db.prepare('SELECT COUNT(*) c FROM holdings WHERE user_id=? AND qty>0').get(uid).c,
    items: db.prepare('SELECT COUNT(*) c FROM items WHERE user_id=?').get(uid).c,
    loans: db.prepare("SELECT COUNT(*) c FROM loans WHERE user_id=? AND status='active'").get(uid).c,
    ledger: db.prepare('SELECT COUNT(*) c FROM ledger WHERE user_id=?').get(uid).c,
  };
  db.exec('BEGIN');
  try {
    for (const t of ['holdings', 'businesses', 'items', 'loans', 'deposits', 'ledger', 'networth', 'visits'])
      db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid);
    db.prepare('DELETE FROM players WHERE user_id=?').run(uid);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  // 连同世界一起重开：行情、新闻、宏观周期与游戏时间全部回到起点（早上 8:00）
  const others = db.prepare('SELECT COUNT(*) c FROM players WHERE user_id != ?').get(uid).c;
  let worldReset = false;
  if (opts.world !== false) { M.resetWorld(); worldReset = true; }

  const u = db.prepare('SELECT username FROM users WHERE id=?').get(uid);
  S.ensurePlayer(uid, u.username);
  const after = S.computeNetWorth(uid);
  const hour = curHour();
  return { ok: true, cleared, worldReset, otherPlayers: others,
    now: { cash: after.cash, netWorth: after.total, hour, date: M.gameDate(hour), hod: hour % 24 } };
}

export { Err };
