// 业务 API：状态、行情、交易、收购、实业、银行、房产与奢侈品
import { db } from './db.js';
import * as M from './market.js';
import * as S from './sim.js';
import * as A from './auth.js';
import { BIZ_TYPES, CITIES, ITEM_TYPES, ITEM_CATS, REGIONS, SECTOR_EN, JOBS, RIVALS,
         ILLNESSES, TRIPS, FLIGHT_CLASSES } from './catalog-content.js';

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
    report = {
      awayMs, awayRealHours: awayMs / 3.6e6, awayRealDays: awayMs / 8.64e7,
      gameHours: elapsedHours, settledHours,
      capped: elapsedHours > S.OFFLINE_CAP_HOURS,
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
export function getState(uid) {
  S.advancePlayer(uid);
  const p = P(uid);
  const hour = curHour();
  const nw = S.computeNetWorth(uid);
  const offline = buildOfflineReport(uid, p, hour, nw.total);
  const live = new Map(M.allAssets().map(a => [a.id, a]));
  const pbonus = S.prestigeBonus(S.prestigeOf(uid) + p.prestige);

  const businesses = db.prepare('SELECT * FROM businesses WHERE user_id=? ORDER BY id').all(uid).map(b => {
    const r = S.bizRates(b, pbonus), def = S.BIZ[b.type_id], city = S.CITY[b.city];
    return {
      id: b.id, typeId: b.type_id, name: b.name, emoji: def?.emoji, type: NM(def), cat: def?.cat, catEn: def?.catEn,
      city: NM(city), cityId: b.city, level: b.level, marketing: b.marketing,
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
      stake, maxStake: a.max_stake, divYield: a.div_yield, eps: a.eps,
      monthlyDividend: stake >= 0.9995 ? a.eps * h.qty / 12 : h.qty * a.price * a.div_yield / 12 * (stake >= 0.5 ? 1.4 : 1) * (1 - RATES.divTax),
      change: (a.price - a.prev_close) / a.prev_close,
    };
  }).sort((x, y) => y.value - x.value);

  const items = db.prepare('SELECT * FROM items WHERE user_id=? ORDER BY id').all(uid).map(it => {
    const d = S.ITEM[it.type_id];
    const value = S.itemValue(it);
    const loan = it.loan_id ? db.prepare("SELECT * FROM loans WHERE id=? AND status='active'").get(it.loan_id) : null;
    const region = d?.region ? S.REGION[d.region] : null;
    return { id: it.id, typeId: it.type_id, item: NM(d), emoji: d?.emoji, cat: d?.cat,
      catName: { zh: ITEM_CATS[d?.cat]?.name, en: ITEM_CATS[d?.cat]?.en },
      region: region ? NM(region) : null, regionFlag: region?.flag, indexSym: d?.index || null,
      value, paid: it.paid, gain: value - it.paid, rented: !!it.rented, canRent: !!d?.rent,
      prestige: d?.prestige, upkeep: value * (d?.upkeep || 0), rent: it.rented ? value * (d?.rent || 0) : value * (d?.rent || 0),
      resale: value * (['estate', 'art', 'watch'].includes(d?.cat) ? 0.95 : 0.85),
      mortgage: loan ? { id: loan.id, balance: loan.balance, payment: loan.payment, rate: loan.rate, monthsLeft: loan.months_left } : null };
  });

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

  const carOwned = S.hasCar(uid);
  const job = S.jobOf(p);
  const nwTmp = nw.total;
  const jobs = JOBS.map(j => ({ id: j.id, zh: j.zh, en: j.en, emoji: j.emoji, wage: j.wage, exp: j.exp,
    car: !!j.car, descZh: j.descZh, descEn: j.descEn,
    unlocked: p.job_exp >= j.exp, blocked: !!j.car && !carOwned, current: p.job_id === j.id }));
  const prestige = S.prestigeOf(uid) + p.prestige;
  const personalDebt = loans.filter(l => l.kind !== 'mortgage').reduce((s, l) => s + l.balance, 0);
  const creditLimit = Math.max(0, Math.max(100_000, nw.total * 0.6 + Math.max(0, nw.bizNetPerHour) * M.YEAR_HOURS * 0.5) - personalDebt);

  return {
    build: process.env.BE_BUILD || '',
    now: { hour, date: M.gameDate(hour), progress: M.hourProgress(), realMsPerHour: M.MS_PER_GAME_HOUR },
    player: {
      nickname: p.nickname, cash: p.cash, bank: p.bank, creditScore: p.credit_score,
      prestige, prestigeBonus: S.prestigeBonus(prestige), totalTax: p.total_tax,
      totalDividend: p.total_dividend, realizedPnl: p.realized_pnl, missedPay: p.missed_pay,
      bankrupt: !!p.bankrupt, peak: p.peak_networth, playedHours: hour - p.created_hour, monthProfit: p.month_profit,
    },
    netWorth: nw, title: S.titleOf(nw.total), offline,
    job: (() => {
      const hod = hour % 24, phase = S.dayPhase(hod), day = Math.floor(hour / 24);
      const otUsed = p.ot_day === day ? p.ot_hours : 0;
      const busy = p.ot_pending > 0 && hour < p.ot_until;
      const tb = S.timeBudget(db.prepare('SELECT * FROM businesses WHERE user_id=?').all(uid));
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
        working: !!job && (!job.car || carOwned), carOwned, list: jobs,
        stamina: p.stamina, staminaMax: S.STAMINA_MAX, efficiency: S.efficiency(p.stamina),
        phase, hod, wakeHour: S.WAKE_HOUR, sleepHour: S.SLEEP_HOUR,
        workStart: S.WORK_START, workEnd: S.WORK_END, workHours: S.WORK_HOURS_PER_DAY,
        otUsed, otMax: tb.otMax, otMult: S.OVERTIME_MULT,
        mgmtHours: tb.mgmt, freeHours: tb.free, shiftHours: tb.shift, canJob: tb.canJob,
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
      const bizCity = bizTrip ? S.CITY[p.trip_id.slice(4)] : null;
      const trip = bizTrip
        ? (bizCity ? { id: 'biztrip', zh: '出差：' + bizCity.name, en: 'Business trip: ' + bizCity.en, emoji: '✈️' } : null)
        : (p.trip_id ? S.TRIP[p.trip_id] : null);
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
        trips_catalog: TRIPS.map(t => ({ ...t, price: { economy: S.tripCost(t, 'economy'),
          business: S.tripCost(t, 'business'), first: S.tripCost(t, 'first'), private: S.tripCost(t, 'private') } })),
        classes: FLIGHT_CLASSES,
        hasJet: db.prepare("SELECT COUNT(*) c FROM items WHERE user_id=? AND type_id LIKE 'jet_%'").get(uid).c > 0,
      };
    })(),
    macro: M.regimeState(),
    prosperity: M.cityProsperity(),
    businesses, holdings, items, loans, deposits,
    bank: { savingsRate: S.savingsRate(), overdraftRate: S.overdraftRate(), fixedRates: S.fixedRates(),
      policyRate: M.policyRate(),
      loanRate: S.loanRate(p.credit_score), mortgageRate: S.mortgageRate(p.credit_score),
      creditLimit, totalDebt: nw.debt, mortgageDebt: nw.mortgage },
    offlineCap: { hours: S.OFFLINE_CAP_HOURS, days: S.OFFLINE_CAP_HOURS / 24 },
    tax: { corp: RATES.corpTax, div: RATES.divTax, capGain: RATES.capGainTax, property: RATES.propertyTax },
    fees: { commission: RATES.commission, minCommission: RATES.minCommission, spread: RATES.spread },
    ledger: db.prepare('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 80').all(uid),
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
export function bizBuy(uid, { typeId, cityId, name }) {
  S.advancePlayer(uid);
  const def = S.BIZ[typeId], city = S.CITY[cityId];
  if (!def || !city) throw new Err('店铺类型或城市无效 / Invalid business or city');
  const p = P(uid), hour = curHour();
  if (p.sick_until > hour) throw new Err('生着病没法去选址开店 / You are too ill to go and set up a shop');
  if (p.trip_until > hour) throw new Err('你正在外地，回来再说 / You are already away');
  const setup = Math.round(def.cost * city.costMult);
  const travel = Math.round(city.travelCost || 0);
  const cost = setup + travel;
  if (p.cash < cost)
    throw new Err(travel
      ? `现金不足：装修 ${S.fmt(setup)} + 往返差旅 ${S.fmt(travel)} = ${S.fmt(cost)} / Need ${S.fmt(cost)} (setup + travel)`
      : `现金不足，需要 ${S.fmt(cost)} / Need ${S.fmt(cost)}`);
  p.cash -= cost;
  const nm = String(name || '').trim().slice(0, 24) || `${city.name}${def.name}`;
  db.prepare(`INSERT INTO businesses(user_id,type_id,name,city,city_mult,invested,created_hour,demand,staff,auto_staff)
              VALUES(?,?,?,?,?,?,?,?,?,1)`).run(uid, typeId, nm, cityId, city.revMult, cost, curHour(), 0.9 + Math.random() * 0.2, 2);
  // 异地开店需要亲自跑一趟：付机票、在外面待几天，这期间不能上班
  if (city.travelDays > 0) {
    db.prepare('UPDATE players SET trip_until=?, trip_id=?, trip_relief=1 WHERE user_id=?')
      .run(hour + city.travelDays * 24, 'biz:' + cityId, uid);
    ledger(uid, 'trip', -travel, L('led.bizTrip', { city: NM(city), cost: travel, days: city.travelDays }), '✈️');
  }
  savePlayer(p);
  ledger(uid, 'biz', -setup, L('led.bizOpen', { name: nm, city: NM(city), type: NM(def), cost: setup }), def.emoji);
  return { ok: true, cost, setup, travel, travelDays: city.travelDays || 0 };
}

export function bizAction(uid, { id, action, name, arg }) {
  S.advancePlayer(uid);
  const b = db.prepare('SELECT * FROM businesses WHERE id=? AND user_id=?').get(num(id, 1), uid);
  if (!b) throw new Err('店铺不存在 / Business not found', 404);
  const def = S.BIZ[b.type_id], city = S.CITY[b.city], p = P(uid);

  if (action === 'upgrade') {
    if (b.level >= S.MAX_LEVEL) throw new Err('已达最高等级 / Max level reached');
    const cost = S.upgradeCost(def, city, b.level);
    if (p.cash < cost) throw new Err(`现金不足，需要 ${S.fmt(cost)} / Need ${S.fmt(cost)}`);
    p.cash -= cost;
    db.prepare('UPDATE businesses SET level=level+1, invested=invested+? WHERE id=?').run(cost, b.id);
    savePlayer(p);
    ledger(uid, 'biz', -cost, L('led.bizUpgrade', { name: b.name, level: b.level + 1, cost }), '🏗️');
    return { ok: true, cost, level: b.level + 1 };
  }
  if (action === 'marketing') {
    if (b.marketing >= S.MAX_MARKETING) throw new Err('营销投入已达上限 / Marketing maxed out');
    const cost = S.marketingCost(def, city, b.marketing);
    if (p.cash < cost) throw new Err(`现金不足，需要 ${S.fmt(cost)} / Need ${S.fmt(cost)}`);
    p.cash -= cost;
    db.prepare('UPDATE businesses SET marketing=marketing+1, invested=invested+? WHERE id=?').run(Math.round(cost * 0.4), b.id);
    savePlayer(p);
    ledger(uid, 'biz', -cost, L('led.bizMarketing', { name: b.name, level: b.marketing + 1, cost }), '📣');
    return { ok: true, cost };
  }
  if (action === 'repair') {
    const cost = Math.round(def.cost * city.costMult * 0.22 * (1 - b.condition));
    if (cost <= 0) throw new Err('店铺状况良好 / Already in good condition');
    if (p.cash < cost) throw new Err(`现金不足，需要 ${S.fmt(cost)} / Need ${S.fmt(cost)}`);
    p.cash -= cost;
    db.prepare('UPDATE businesses SET condition=1 WHERE id=?').run(b.id);
    savePlayer(p);
    ledger(uid, 'biz', -cost, L('led.bizRepair', { name: b.name, cost }), '🧹');
    return { ok: true, cost };
  }
  if (action === 'sell') {
    const value = Math.round(b.invested * 0.65 * (0.6 + 0.4 * b.condition));
    p.cash += value;
    db.prepare('DELETE FROM businesses WHERE id=?').run(b.id);
    savePlayer(p);
    ledger(uid, 'biz', value, L('led.bizSell', { name: b.name, value }), '🤝');
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
    if (p.cash < cost) throw new Err(`现金不足，需要 ${S.fmt(cost)} / Need ${S.fmt(cost)}`);
    p.cash -= cost;
    db.prepare('UPDATE businesses SET all_day=1, invested=invested+? WHERE id=?').run(cost, b.id);
    savePlayer(p);
    ledger(uid, 'biz', -cost, L('led.bizAllDay', { name: b.name, cost }), '🌃');
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
    db.prepare('DELETE FROM items WHERE id=?').run(it.id);
    savePlayer(p);
    ledger(uid, 'item', net, L('led.itemSell', { item: NM(def), value: gross, delta: value - it.paid, payoff }), '🤝');
    return { ok: true, value: gross, payoff };
  }
  if (action === 'rent') {
    if (!def.rent) throw new Err('该资产不可出租 / Not rentable');
    const on = it.rented ? 0 : 1;
    db.prepare('UPDATE items SET rented=? WHERE id=?').run(on, it.id);
    ledger(uid, 'item', 0, L('led.itemRent', { item: NM(def), on, rent: value * def.rent }), '🔑');
    return { ok: true, rented: !!on };
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
  if (p.job_exp < j.exp) throw new Err(`工作经验不足，需要 ${Math.round(j.exp)} / Requires ${Math.round(j.exp)} experience`);
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
  const tb = S.timeBudget(bizAll);
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

// ── 旅游 ────────────────────────────────────────────────────
export function bookTrip(uid, { tripId, cls }) {
  S.advancePlayer(uid);
  const p = P(uid), hour = curHour();
  const trip = S.TRIP[tripId];
  if (!trip) throw new Err('线路不存在 / Trip not found');
  if (p.sick_until > hour) throw new Err('生着病就别出门了 / Not while you are ill');
  if (p.trip_until > hour) throw new Err('你已经在旅途中了 / You are already travelling');
  const fc = FLIGHT_CLASSES.find(c => c.id === (cls || 'economy')) || FLIGHT_CLASSES[0];
  if (fc.needJet && !db.prepare("SELECT COUNT(*) c FROM items WHERE user_id=? AND type_id LIKE 'jet_%'").get(uid).c)
    throw new Err('你还没有私人飞机 / You do not own a private jet');
  const cost = S.tripCost(trip, fc.id);
  if (p.cash < cost) throw new Err(`需要现金 ${S.fmt(cost)} / Needs ${S.fmt(cost)} in cash`);
  p.cash -= cost;
  const prestige = trip.prestige * fc.prestige;
  db.prepare(`UPDATE players SET cash=?, prestige=prestige+?, trip_until=?, trip_id=?, trip_relief=?,
              trip_spent=trip_spent+?, trips=trips+1 WHERE user_id=?`)
    .run(p.cash, prestige, hour + trip.days * 24, trip.id, fc.relief, cost, uid);
  ledger(uid, 'trip', -cost, L('led.tripGo', { trip: { zh: trip.zh, en: trip.en },
    cls: { zh: fc.zh, en: fc.en }, cost, days: trip.days }), trip.emoji);
  return { ok: true, cost, days: trip.days, until: hour + trip.days * 24 };
}

// ── 富豪榜：财富与游戏内公司股价实时联动 ────────────────────
export function richList(uid) {
  const live = new Map(M.allAssets().map(a => [a.symbol, a]));
  const mine = new Map(db.prepare('SELECT asset_id,qty FROM holdings WHERE user_id=? AND qty>0').all(uid)
    .map(h => { const a = M.assetById(h.asset_id); return [a?.symbol, h.qty / (a?.shares || 1)]; }));
  const list = RIVALS.map(r => {
    const a = r.symbol ? live.get(r.symbol) : null;
    const cap = a ? a.price * a.shares : 0;
    const diluted = Math.max(0, 1 - (mine.get(r.symbol) || 0));   // 你买走的部分不再属于他
    const equity = cap * r.stake * diluted;
    return { id: r.id, zh: r.zh, en: r.en, emoji: r.emoji, bio: r.bio,
      symbol: r.symbol, company: a ? { zh: a.zh, en: a.name } : null,
      stake: r.stake, equity, other: r.other, value: equity + r.other, npc: true };
  });
  const me = S.computeNetWorth(uid);
  const p = P(uid);
  list.push({ id: 'me', zh: p.nickname, en: p.nickname, emoji: S.titleOf(me.total).icon, value: me.total, npc: false });
  list.sort((a, b) => b.value - a.value);
  return list.map((x, i) => ({ ...x, rank: i + 1 }));
}

// ── 账号管理 ───────────────────────────────────────────────
export function deleteAccount(uid, { password }) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  if (!u) throw new Err('账号不存在 / Account not found', 404);
  try { A.login(u.username, password); } catch { throw new Err('密码错误 / Wrong password', 403); }
  db.exec('BEGIN');
  try {
    for (const t of ['holdings','businesses','items','loans','deposits','ledger','networth','players','sessions'])
      db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid);
    db.prepare('DELETE FROM users WHERE id=?').run(uid);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { ok: true };
}

// ── 其它 ────────────────────────────────────────────────────
export function catalog() {
  const idx = Object.fromEntries(M.allAssets().filter(a => a.kind === 'index').map(a => [a.symbol, a.price]));
  return {
    biz: BIZ_TYPES, cities: CITIES, regions: REGIONS, cogsRate: S.COGS_RATE,
    items: ITEM_TYPES.map(i => ({ ...i, listPrice: i.index ? i.price * (idx[i.index] || 100) / 100 : i.price })),
    itemCats: ITEM_CATS, priceTiers: S.PRICE_TIERS, titles: S.TITLES, jobs: JOBS,
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
    for (const t of ['holdings', 'businesses', 'items', 'loans', 'deposits', 'ledger', 'networth'])
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
