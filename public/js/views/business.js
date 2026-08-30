import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast, modal, confirmBox, durText, keepScroll} from '../util.js';

let pickType = null, pickCity = 'city', pickCat = 'all', typeQuery = '', sortBy = 'cost', adOnly = false;
// 可叠加的筛选条件：每一条都是「不满足就滤掉」，彼此互不干扰
let fMaxCost = '', fMaxDays = '', fMinMargin = '', fSeason = 'any', fCycle = 'any';
// 综合排名：点亮几个维度，就按这几个维度的加权总分排。全不点就是单键排序。
let mix = {};
let scoreOf = null;   // 综合排名开着的时候，用来给每一行打分

// 每种店的「性格」：直接把模拟里用的那几个数翻译成一句人话
const TRAIT_ROWS = [
  { k: 'margin', get: d => 1 - d.cogs,  fmt: v => Math.round(v * 100) + '%', hue: v => v > 0.6 ? 'up' : v < 0.35 ? 'down' : '',
    scale: v => v },
  { k: 'cyc',    get: d => d.cyc,       fmt: v => v < 0 ? t('biz.tr.counter') : v < 0.5 ? t('biz.tr.defensive') : v < 1.3 ? t('biz.tr.normal') : t('biz.tr.cyclical'),
    hue: v => v < 0 ? 'up' : v > 1.6 ? 'down' : '', scale: v => Math.min(1, Math.abs(v) / 2) },
  { k: 'vol',    get: d => d.vol,       fmt: v => v < 0.6 ? t('biz.tr.steady') : v < 1.2 ? t('biz.tr.normal') : v < 1.8 ? t('biz.tr.swingy') : t('biz.tr.wild'),
    hue: v => v > 1.7 ? 'down' : v < 0.6 ? 'up' : '', scale: v => Math.min(1, v / 2.4) },
  { k: 'labor',  get: d => d.labor,     fmt: v => v > 1.6 ? t('biz.tr.lean') : v < 0.8 ? t('biz.tr.handson') : t('biz.tr.normal'),
    hue: () => '', scale: v => Math.min(1, v / 3) },
  { k: 'wear',   get: d => d.wear,      fmt: v => v > 1.7 ? t('biz.tr.heavy') : v < 0.7 ? t('biz.tr.light') : t('biz.tr.normal'),
    hue: v => v > 1.8 ? 'down' : '', scale: v => Math.min(1, v / 2.5) },
  { k: 'mktg',   get: d => d.mktg,      fmt: v => v > 1.5 ? t('biz.tr.adDriven') : v < 0.6 ? t('biz.tr.adDeaf') : t('biz.tr.normal'),
    hue: () => '', scale: v => Math.min(1, v / 2) },
];
// ── 广告到底划不划算 ──────────────────────────────────────
// 投放营销要花一笔钱（开店成本的 10%），换来营收上涨；但房租也按同样的
// 系数涨——营销在这个模型里是持续的支出，不是一次性买断。所以真正该看的
// 是：这笔广告费，要靠它多赚出来的利润赚多少天才回得来。
// 这里用的是和服务端 bizRates 同一套算法，数字对得上。
function dailyNetAt(def, city, marketing) {
  const H = def.openHours;
  const mk = 1 + 0.10 * marketing * (def.mktg ?? 1);
  const rev = def.rev * city.revMult * mk;
  const wage = def.wage * city.wageMult;
  const staff = Math.max(1, Math.ceil(rev / (wage * (def.revPerWage ?? 4.5))));
  const served = Math.min(rev, staff * wage * (def.revPerWage ?? 4.5));
  const rentH = def.hourlyRent * city.rentMult * mk;
  return H * (served - served * (def.cogs ?? 0.42) - staff * wage) - 24 * rentH;
}
// 开这家店要花的钱 ÷ 它一天能赚的钱 = 多少天回本。
// 目录里的 payDays 是「设计目标」，只按成本算，跟城市无关；这里算的是
// 你选的这座城市的实际值——把差旅费也算进本金。大城市房租涨得比营收快，
// 同一家街头小摊在家乡 35 天回本，在国际金融中心要 140 天。
export function paybackInfo(def, city) {
  const setup = Math.round(def.cost * city.costMult);
  const travel = Math.round(city.travelCost || 0);
  const total = setup + travel;
  const dailyNet = dailyNetAt(def, city, 0);
  return { setup, travel, total, dailyNet,
    days: dailyNet > 0 ? total / dailyNet : Infinity,
    ok: dailyNet > 0 };
}
export function marketingInfo(def, city) {
  const cost = Math.round(def.cost * city.costMult * 0.10);
  const net0 = dailyNetAt(def, city, 0);
  const gain = dailyNetAt(def, city, 1) - net0;
  return { cost, net0, gain,
    payback: gain > 0 ? cost / gain : Infinity,      // 广告费多少天回本
    ratio: net0 > 0 ? cost / net0 : Infinity,        // 广告费 = 多少天的日净利
    worth: gain > 0 };
}

// 综合排名可以点亮的六个维度
const MIX_KEYS = [
  { id:'payback', emoji:'⏱️' }, { id:'margin', emoji:'💰' }, { id:'steady', emoji:'🛡️' },
  { id:'ad', emoji:'📣' }, { id:'cheap', emoji:'🪙' }, { id:'easy', emoji:'😌' },
];

const MONTHS_ZH = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function seasonText(d) {
  if (!d.season) return null;
  const [peak, amp] = d.season;
  const low = ((peak + 5) % 12) + 1;
  const M = lang === 'zh' ? MONTHS_ZH : MONTHS_EN;
  return t('biz.tr.seasonText', { hi: M[peak - 1], lo: M[low - 1], amp: Math.round(amp * 100) });
}

const bar = (v, color, max = 1) => `<div class="bar"><i style="width:${Math.min(100, v / max * 100)}%;background:${color}"></i></div>`;

// ── 折叠状态：跨 5 秒轮询、跨刷新都要记住，不然点开一次就被冲掉了 ──
const FOLD_KEY = 'be_biz_folds';
let folds = (() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch { return {}; } })();
const saveFolds = () => { try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch {} };
// 归属分组默认展开；同一种店有两家以上时默认收起来——「十个街头小摊」占十屏，就是这么来的
const isOpen = (key, dflt) => (folds[key] === undefined ? dflt : !!folds[key]);
// 翻转的是「现在看起来是开还是关」，不是存里那个可能还没写过的值——
// 没写过时 !undefined === true，归属分组本来就是开的，一点反而又「开」了一次
const toggle = (key, dflt) => { folds[key] = !isOpen(key, dflt); saveFolds(); };

const sum = (list, f) => list.reduce((a, b) => a + f(b), 0);
const chev = open => `<span class="chev ${open ? 'open' : ''}">▸</span>`;

// 按归属分组：个人一组，每家公司各一组
function groupByOwner(bs, companies) {
  const groups = [];
  const mine = bs.filter(b => !b.companyId);
  if (mine.length) groups.push({ key: 'own:self', emoji: '👤', name: t('biz.grpSelf'), sub: null, list: mine });
  for (const c of companies || []) {
    const list = bs.filter(b => b.companyId === c.id);
    if (!list.length) continue;
    groups.push({ key: 'own:co' + c.id, emoji: '🏢', name: nm({ zh: c.name, en: c.nameEn || c.name }),
      sub: c.ticker + (c.listed ? ' · ' + t('biz.grpListed') : ''), list, company: c });
  }
  // 公司已经没了但店还挂着（理论上不该发生），别把它们藏起来
  const known = new Set(groups.flatMap(g => g.list.map(b => b.id)));
  const orphan = bs.filter(b => !known.has(b.id));
  if (orphan.length) groups.push({ key: 'own:other', emoji: '❓', name: t('biz.grpOther'), sub: null, list: orphan });
  return groups;
}
// 组内再按业态归类：同一种店有多家的收成一行
function clusterByType(list) {
  const map = new Map();
  for (const b of list) {
    const k = b.typeId;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(b);
  }
  return [...map.entries()].map(([typeId, shops]) => ({ typeId, shops }))
    .sort((a, b) => sum(b.shops, x => x.dailyNet) - sum(a.shops, x => x.dailyNet));
}

export default {
  render(root, app) {
    const s = app.state, cat = app.catalog;
    const bs = s.businesses;
    const totalRev = bs.reduce((a, b) => a + b.revPerHour, 0);
    const totalCost = bs.reduce((a, b) => a + b.costPerHour, 0);
    const totalNet = totalRev - totalCost;

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat"><label>🏬 ${t('biz.title')}</label><div class="v">${bs.length}</div><div class="d">${t('biz.owned')}</div></div>
      <div class="stat"><label>📈 ${t('biz.revenue')}</label><div class="v up">${money(totalRev)}</div><div class="d">${t('common.perHour')} · ${money(totalRev * 24)}/${t('common.day')}</div></div>
      <div class="stat"><label>📉 ${t('biz.opcost')}</label><div class="v down">${money(totalCost)}</div><div class="d">${t('common.perHour')}</div></div>
      <div class="stat accent"><label>💰 ${t('biz.net')}</label><div class="v">${money(totalNet)}</div><div class="d">${t('dash.perDayNet')} <b>${money(totalNet * 24)}</b></div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-h"><h3>${t('biz.title')}</h3>
        <span class="sub">${t('biz.ownerBonus')} <b class="gold">+${pctPlain(s.player.ownerBonus)}</b>
          <span class="dim2">（${t('common.prestige')} ${int(s.player.prestige)} → +${pctPlain(s.player.prestigeBonus)}${
            s.player.knowBonus > 0 ? ` · ${t('attr.knowledge')} → +${pctPlain(s.player.knowBonus)}` : ''}）</span></span>
        <div class="right" style="display:flex;gap:8px">
          ${bs.length ? `<button class="btn btn-sm btn-ghost" id="b-foldall">${
            groupByOwner(bs, s.companies).some(g => isOpen(g.key, true)) ? t('biz.foldAll') : t('biz.unfoldAll')}</button>` : ''}
          <button class="btn btn-primary btn-sm" id="b-new">+ ${t('biz.open')}</button></div></div>
    </div>

    ${bs.length ? groupByOwner(bs, s.companies).map(g => this.ownerGroup(g, s, cat)).join('')
      : `<div class="card"><div class="empty"><div class="e-ico">🏪</div><h4>${t('biz.empty')}</h4><p>${t('biz.emptyHint')}</p>
          <button class="btn btn-primary" style="margin-top:16px" id="b-new2">+ ${t('biz.open')}</button></div></div>`}`;

    $('#b-new') && ($('#b-new').onclick = () => this.openNew(app));
    $('#b-new2') && ($('#b-new2').onclick = () => this.openNew(app));
    $$('[data-fold]').forEach(el => el.onclick = () => {
      toggle(el.dataset.fold, el.dataset.dflt === '1');
      keepScroll(() => this.render(root, app));
    });
    $('#b-foldall') && ($('#b-foldall').onclick = () => {
      const gs = groupByOwner(bs, s.companies);
      const anyOpen = gs.some(g => isOpen(g.key, true));
      for (const g of gs) {
        folds[g.key] = !anyOpen;
        for (const c of clusterByType(g.list)) folds[g.key + '/' + c.typeId] = !anyOpen;
      }
      saveFolds();
      keepScroll(() => this.render(root, app));
    });
    this.wire(root, app);
  },

  // ── 一个归属分组：个人，或者某一家公司 ──
  ownerGroup(g, s, cat) {
    const open = isOpen(g.key, true);
    const net = sum(g.list, b => b.dailyNet);
    const rev = sum(g.list, b => b.dailyRev);
    const clusters = clusterByType(g.list);
    return `<div class="card fold-card" style="margin-bottom:14px">
      <div class="fold-h" data-fold="${g.key}" data-dflt="1">
        ${chev(open)}
        <div class="ico">${g.emoji}</div>
        <div style="min-width:0;flex:1">
          <div class="fold-t">${esc(g.name)}${g.sub ? ` <span class="tag">${esc(g.sub)}</span>` : ''}</div>
          <div class="fold-s">${t('biz.grpShops', { n: g.list.length })} · ${t('biz.grpTypes', { n: clusters.length })}${
            g.company ? ` · ${t('biz.grpCash')} ${money(g.company.cash)}` : ''}</div>
        </div>
        <div class="fold-n">
          <div class="n ${cls(net)}">${money(net)}</div>
          <div class="l">${t('dash.perDayNet')} · ${t('biz.dailyRev')} ${money(rev)}</div>
        </div>
      </div>
      ${open ? `<div class="fold-b">${clusters.map(c => this.typeCluster(g, c, s, cat)).join('')}</div>` : ''}
    </div>`;
  },

  // ── 组内的一种业态。只有一家就直接摊开，多家才值得收起来 ──
  typeCluster(g, c, s, cat) {
    const grid = list => `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr))">
      ${list.map(b => this.card(b, s, cat)).join('')}</div>`;
    if (c.shops.length === 1) return grid(c.shops);
    const key = g.key + '/' + c.typeId;
    const open = isOpen(key, false);
    const b0 = c.shops[0];
    const net = sum(c.shops, b => b.dailyNet);
    const rev = sum(c.shops, b => b.dailyRev);
    const cities = [...new Set(c.shops.map(b => nm(b.city)))];
    const worst = c.shops.reduce((a, b) => (b.condition < a.condition ? b : a));
    const under = c.shops.filter(b => b.util < 0.98).length;
    return `<div class="cluster ${open ? 'open' : ''}">
      <div class="fold-h sm" data-fold="${key}" data-dflt="0">
        ${chev(open)}
        <div class="ico">${b0.emoji}</div>
        <div style="min-width:0;flex:1">
          <div class="fold-t">${esc(nm(b0.type))} <span class="tag b">×${c.shops.length}</span>
            ${under ? `<span class="tag r">${t('biz.grpUnder', { n: under })}</span>` : ''}
            ${worst.condition < 0.6 ? `<span class="tag r">${t('biz.grpWorn', { p: pctPlain(worst.condition, 0) })}</span>` : ''}</div>
          <div class="fold-s">${esc(cities.slice(0, 3).join(' · '))}${cities.length > 3 ? ` +${cities.length - 3}` : ''}</div>
        </div>
        <div class="fold-n">
          <div class="n ${cls(net)}">${money(net)}</div>
          <div class="l">${t('dash.perDayNet')} · ${t('biz.dailyRev')} ${money(rev)}</div>
        </div>
      </div>
      ${open ? `<div style="padding:10px 0 2px">${grid(c.shops)}</div>` : ''}
    </div>`;
  },

  card(b, s, cat) {
    const tier = cat.priceTiers.find(x => x.v === b.priceTier) || cat.priceTiers[2];
    const under = b.util < 0.98;
    return `<div class="biz-card" data-id="${b.id}">
      <div class="biz-top">
        <div class="ico lg">${b.emoji}</div>
        <div style="min-width:0;flex:1">
          <div class="biz-name">${esc(b.name)} <span class="tag">Lv.${b.level}</span>${b.marketing ? ` <span class="tag b">📣${b.marketing}</span>` : ''}</div>
          <div class="biz-meta">${b.trait ? b.trait.catEmoji + ' ' : ''}${esc(nm(b.type))} · ${esc(nm(b.city))} ·
            <span class="tag ${b.openNow ? 'g' : ''}">${b.allDay ? '🌃 24h' : `${String(b.hours[0]).padStart(2, '0')}:00–${String(b.hours[1]).padStart(2, '0')}:00`}
              ${b.openNow ? t('biz.openNow') : t('biz.closedNow')}</span></div>
        </div>
        <div class="biz-pl"><div class="n ${cls(b.netPerHour)}">${money(b.netPerHour)}</div><div class="l">${t('biz.net')}</div></div>
      </div>
      <div class="biz-body">
        <div class="biz-stats" style="grid-template-columns:repeat(5,1fr)">
          <div class="bs"><label>${t('biz.dailyNet')}</label><b class="${cls(b.dailyNet)}">${money(b.dailyNet)}</b></div>
          <div class="bs"><label>${t('biz.opcost')}</label><b class="down">${money(b.costPerHour)}</b></div>
          <div class="bs"><label>${t('biz.staff')}</label><b>${b.staff}<span class="dim2" style="font-size:10px"> / ${b.recStaff}</span></b></div>
          <div class="bs"><label>${t('biz.demand')}</label><b>${b.demand.toFixed(2)}<span class="dim2" style="font-size:10px"> → ${b.demandTarget.toFixed(2)}</span></b></div>
          <div class="bs"><label>${t('biz.rent')}</label><b class="down">${money(b.monthlyRent)}/${t('common.month')}</b></div>
        </div>
        <div style="display:flex;gap:14px;font-size:11px;margin-bottom:4px">
          <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span class="dim2">${t('biz.util')}</span><span class="mono ${under ? 'down' : 'up'}">${pctPlain(b.util, 0)}</span></div>
            ${bar(b.util, under ? 'var(--down)' : 'var(--up)')}</div>
          <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span class="dim2">${t('biz.condition')}</span><span class="mono ${b.condition < .6 ? 'down' : ''}">${pctPlain(b.condition, 0)}</span></div>
            ${bar(b.condition, b.condition < .6 ? 'var(--orange)' : 'var(--blue)')}</div>
        </div>
        ${under ? `<div class="down" style="font-size:11px;margin-top:7px">⚠️ ${t('biz.understaffed')}</div>` : ''}
        ${b.trait ? `<div class="dim2" style="font-size:10.5px;margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <span>${t('biz.tr.margin')} <b>${Math.round((1 - b.trait.cogs) * 100)}%</b></span>
          <span>${t('biz.tr.cyc')} <b class="${b.cycMult > 1.05 ? 'up' : b.cycMult < 0.95 ? 'down' : ''}">${b.cycMult != null ? (b.cycMult >= 1 ? '+' : '') + Math.round((b.cycMult - 1) * 100) + '%' : '—'}</b></span>
          ${b.trait.season ? `<span>🗓️ ${seasonText(b.trait)} <b class="${b.seasonMult > 1.02 ? 'up' : b.seasonMult < 0.98 ? 'down' : ''}">${(b.seasonMult >= 1 ? '+' : '') + Math.round((b.seasonMult - 1) * 100)}%</b></span>` : ''}
          <span>${t('biz.tr.vol')} <b>${b.trait.vol < 0.6 ? t('biz.tr.steady') : b.trait.vol < 1.2 ? t('biz.tr.normal') : b.trait.vol < 1.8 ? t('biz.tr.swingy') : t('biz.tr.wild')}</b></span>
        </div>` : ''}

        <div style="margin-top:12px">
          <div class="dim2" style="font-size:10px;font-weight:700;letter-spacing:.5px;margin-bottom:5px">${t('biz.price')} — ${esc(nm({ zh: tier.zh, en: tier.en }))}</div>
          <div class="segs" style="width:100%;display:flex">
            ${cat.priceTiers.map(x => `<button class="seg ${x.v === b.priceTier ? 'active' : ''}" style="flex:1;padding:5px 2px;font-size:11px"
              data-act="price" data-arg="${x.v}" title="${esc(nm({ zh: x.descZh, en: x.descEn }))}">${x.v < 0 ? '↓'.repeat(-x.v) : x.v > 0 ? '↑'.repeat(x.v) : '='}</button>`).join('')}
          </div>
          <div class="dim2" style="font-size:10.5px;margin-top:5px;line-height:1.5">${esc(nm({ zh: tier.descZh, en: tier.descEn }))}</div>
          <div class="dim2" style="font-size:10.5px;margin-top:6px">🕐 ${t('biz.hours')} <b>${b.openHrs}h</b> · ${t('biz.revenue')} ${money(b.revPerHour)}${t('common.perHour')} · ${t('biz.opcost')} ${money(b.idleCost)}${t('common.perHour')}（${lang === 'zh' ? '关门也要付' : 'even when closed'}）</div>
        </div>

        <div class="dim2" style="font-size:10.5px;margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">
          <span>🧾 ${t('biz.dailyRev')} <b>${money(b.dailyRev)}</b></span>
          <span>📦 ${t('biz.cogs')} <b class="down">${money(b.cogs * b.openHrs)}</b></span>
          <span>⏱️ ${t('biz.mgmt')} <b>${b.mgmt.toFixed(2)}h</b></span>
          <span>🏙️ ${t('biz.prosperity')} <b class="${(s.prosperity[b.cityId] || 1) >= 1 ? 'up' : 'down'}">${((s.prosperity[b.cityId] || 1) * 100).toFixed(0)}%</b></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:11px;flex-wrap:wrap">
          <span class="dim2" style="font-size:10.5px;font-weight:700">${t('biz.staff')}</span>
          <button class="btn btn-xs" data-act="staffm" ${b.autoStaff ? 'disabled' : ''}>−</button>
          <b class="mono" style="min-width:26px;text-align:center">${b.staff}</b>
          <button class="btn btn-xs" data-act="staffp" ${b.autoStaff ? 'disabled' : ''}>+</button>
          <span class="dim2" style="font-size:10.5px">${money(b.wages)}${t('common.perHour')}</span>
          <button class="switch ${b.autoStaff ? 'on' : ''}" data-act="autostaff"><i></i>${t('biz.autoStaff')}</button>
          <button class="switch ${b.autoRepair ? 'on' : ''}" data-act="autorepair"><i></i>${t('biz.autoRepair')}</button>
          <button class="switch ${b.manager ? 'on' : ''}" data-act="manager" data-arg="${b.manager ? '' : '1'}"
            title="${esc(t('biz.managerHint'))}"><i></i>🧑‍💼 ${t('biz.manager')} ${b.manager ? money(b.managerSalary) + '/' + t('common.month') : ''}</button>
        </div>
      </div>
      <div class="biz-ctrl">
        <button class="btn btn-sm" data-act="upgrade" ${b.upgradeCost == null ? 'disabled' : ''}>⬆ ${t('biz.upgrade')} ${b.upgradeCost != null ? money(b.upgradeCost) : 'MAX'}</button>
        <button class="btn btn-sm" data-act="marketing" ${b.marketingCost == null ? 'disabled' : ''}>📣 ${t('biz.doMarketing')} ${b.marketingCost != null ? money(b.marketingCost) : 'MAX'}</button>
        <button class="btn btn-sm" data-act="repair" ${b.repairCost <= 0 ? 'disabled' : ''}>🧹 ${t('biz.repair')} ${money(b.repairCost)}</button>
        <button class="btn btn-sm btn-ghost" data-act="rename">✏️</button>
        ${b.allDayCost ? `<button class="btn btn-sm" data-act="allday">🌃 ${t('biz.goAllDay')} ${money(b.allDayCost)}
          <span style="opacity:.7;font-weight:400">+${money(b.allDayGain)}/${t('common.day')}</span></button>` : ''}
        <button class="btn btn-sm btn-danger" data-act="sell" style="margin-left:auto">${t('biz.sellBiz')} ${money(b.sellValue)}</button>
      </div>
    </div>`;
  },

  wire(root, app) {
    $$('.biz-card').forEach(card => {
      const id = +card.dataset.id;
      const b = app.state.businesses.find(x => x.id === id);
      card.querySelectorAll('[data-act]').forEach(btn => btn.onclick = async e => {
        e.stopPropagation();
        const a = btn.dataset.act;
        try {
          if (a === 'price') await api.bizAction(id, 'price', { arg: +btn.dataset.arg });
          else if (a === 'staffm') await api.bizAction(id, 'staff', { arg: Math.max(0, b.staff - 1) });
          else if (a === 'staffp') await api.bizAction(id, 'staff', { arg: b.staff + 1 });
          else if (a === 'autostaff') await api.bizAction(id, 'autostaff', { arg: !b.autoStaff });
          else if (a === 'autorepair') await api.bizAction(id, 'autorepair', { arg: !b.autoRepair });
          else if (a === 'manager') await api.bizAction(id, 'manager', { arg: !b.manager });
          else if (a === 'rename') {
            const v = prompt(t('biz.rename'), b.name); if (!v) return;
            await api.bizAction(id, 'rename', { name: v });
          } else if (a === 'sell') {
            const ok = await confirmBox(t('biz.sellBiz'), `「${esc(b.name)}」 → <b class="gold">${moneyFull(b.sellValue)}</b>`, t('biz.sellBiz'));
            if (!ok) return;
            await api.bizAction(id, 'sell');
            toast(t('toast.success'), 'ok');
          } else await api.bizAction(id, a);
          await app.refresh(true);
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  },

  // ── 开新店：全世界 7,330 座城市任选 ──────────────────────
  async openNew(app) {
    const cat = app.catalog, s = app.state;
    pickType = pickType || cat.biz[0].id;
    let cities = [], cityQuery = '', searching = false, picked = null, cos = [], payer = 0;
    const loadCities = async q => {
      try {
        const r = await api.bizCities(q, pickType);
        cities = r.results; cos = r.companies || []; if (!picked) picked = r.home;
      } catch { cities = []; }
    };
    await loadCities('');
    pickCity = (cities[0] && cities[0].id) || pickCity;
    // 每一条筛选独立生效，可以随便叠；排序要么单键，要么按点亮的维度综合打分
    const buildList = (city) => {
      const q = typeQuery.trim().toLowerCase();
      const ad = x => marketingInfo(x, city);
      const pb = x => paybackInfo(x, city);
      const cost = x => Math.round(x.cost * city.costMult) + Math.round(city.travelCost || 0);
      const num = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? n : null; };
      const mc = num(fMaxCost), md = num(fMaxDays), mm = num(fMinMargin);

      let l = cat.biz.filter(x =>
           (pickCat === 'all' || x.catId === pickCat)
        && (!q || x.name.toLowerCase().includes(q) || x.en.toLowerCase().includes(q)
            || x.cat.toLowerCase().includes(q) || x.catEn.toLowerCase().includes(q))
        && (!adOnly || ad(x).worth)
        && (mc == null || cost(x) <= mc)
        && (md == null || (pb(x).ok && pb(x).days <= md))
        && (mm == null || (1 - x.cogs) * 100 >= mm)
        && (fSeason === 'any' || (fSeason === 'yes' ? !!x.season : !x.season))
        && (fCycle === 'any'
            || (fCycle === 'defensive' && x.cyc < 0.7)
            || (fCycle === 'counter' && x.cyc < 0)
            || (fCycle === 'cyclical' && x.cyc >= 1.3)));

      // ── 综合排名 ──
      // 六个维度，每个都换算成「在当前这批里排第几」的百分位（0~1，越大越好），
      // 然后把点亮的那几个平均一下。这样各维度量纲差得再远也能放在一起比。
      const keys = Object.keys(mix).filter(k => mix[k]);
      if (keys.length && l.length) {
        const raw = {
          payback: x => (pb(x).ok ? -pb(x).days : -1e9),      // 回本越快越好
          margin:  x => 1 - x.cogs,                            // 毛利越高越好
          steady:  x => -(x.vol + Math.abs(x.cyc)),            // 越不折腾越好
          ad:      x => (ad(x).worth ? -ad(x).payback : -1e9), // 广告越快回本越好
          cheap:   x => -cost(x),                              // 本金越低越好
          easy:    x => -(x.mgmt + x.wear),                    // 越省心越好
        };
        const pct = {};
        for (const k of keys) {
          const vals = l.map(raw[k]);
          const lo = Math.min(...vals), hi = Math.max(...vals);
          pct[k] = new Map(l.map((x, i) => [x.id, hi > lo ? (vals[i] - lo) / (hi - lo) : 1]));
        }
        scoreOf = x => Math.round(100 * keys.reduce((a, k) => a + pct[k].get(x.id), 0) / keys.length);
        return l.sort((a, b) => scoreOf(b) - scoreOf(a));
      }
      scoreOf = null;
      const by = { cost: (a, b) => cost(a) - cost(b),
                   payback: (a, b) => pb(a).days - pb(b).days,
                   margin: (a, b) => a.cogs - b.cogs,
                   steady: (a, b) => (a.vol + Math.abs(a.cyc)) - (b.vol + Math.abs(b.cyc)),
                   adback: (a, b) => ad(a).payback - ad(b).payback };
      return l.sort(by[sortBy] || by.cost);
    };
    const render = el => {
      const city = cities.find(c => c.id === pickCity) || picked;
      if (!city) return;
      const list = buildList(city);
      const nFilters = [pickCat !== 'all', !!typeQuery.trim(), adOnly, !!fMaxCost, !!fMaxDays,
                        !!fMinMargin, fCycle !== 'any', fSeason !== 'any'].filter(Boolean).length;
      if (!list.some(x => x.id === pickType) && list.length) pickType = list[0].id;
      const def = cat.biz.find(x => x.id === pickType);
      if (!def) return;
      const ad = marketingInfo(def, city);
      const pb = paybackInfo(def, city);
      const setup = Math.round(def.cost * city.costMult);
      const travel = Math.round(city.travelCost || 0);
      const cost = setup + travel;
      const rev = def.rev * city.revMult;
      const H = def.openHours;
      const wage = def.wage * city.wageMult;
      const staffN = Math.max(1, Math.ceil(rev / (wage * (def.revPerWage ?? 4.5))));
      const dailyRev = H * rev;
      const cogs = dailyRev * (def.cogs ?? cat.cogsRate ?? 0.42);
      const wages = H * staffN * wage;
      const rentM = def.monthlyRent * city.rentMult;
      const net = dailyRev - cogs - wages - rentM / 30;
      const box = el.querySelector('#nb-body');
      box.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px">
        <span class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.6px">${t('biz.chooseType')}</span>
        <select id="nb-cat" class="sel">
          <option value="all" ${pickCat === 'all' ? 'selected' : ''}>${t('biz.allCats')} · ${cat.biz.length}</option>
          ${cat.bizCats.map(c => { const n = cat.biz.filter(x => x.catId === c.id).length;
            return `<option value="${c.id}" ${pickCat === c.id ? 'selected' : ''}>${c.emoji} ${esc(nm(c))} · ${n}</option>`; }).join('')}
        </select>
        <select id="nb-sort" class="sel">
          <option value="cost" ${sortBy === 'cost' ? 'selected' : ''}>${t('biz.sortCost')}</option>
          <option value="payback" ${sortBy === 'payback' ? 'selected' : ''}>${t('biz.sortPayback')}</option>
          <option value="margin" ${sortBy === 'margin' ? 'selected' : ''}>${t('biz.sortMargin')}</option>
          <option value="steady" ${sortBy === 'steady' ? 'selected' : ''}>${t('biz.sortSteady')}</option>
          <option value="adback" ${sortBy === 'adback' ? 'selected' : ''}>${t('biz.sortAdback')}</option>
        </select>
        <label class="ckbox" title="${t('biz.adOnlyTip')}">
          <input type="checkbox" id="nb-adonly" ${adOnly ? 'checked' : ''}> ${t('biz.adOnly')}</label>
        <input id="nb-type-q" type="search" placeholder="${t('biz.typeSearchPh')}" value="${esc(typeQuery)}"
          style="flex:1;min-width:120px;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg2);color:var(--txt);font-size:12px">
        <span class="dim2" style="font-size:10.5px">${t('biz.typeCount', { n: list.length })}${
          nFilters ? ` <b class="gold">${t('biz.nFilters', { n: nFilters })}</b>` : ''}</span>
        ${nFilters ? `<button class="btn btn-xs btn-ghost" id="nb-clear">${t('biz.clearFilters')}</button>` : ''}
      </div>

      <div class="filt-panel">
        <div class="filt-row">
          <span class="fl">${t('biz.fBudget')}</span>
          <input class="fi" id="f-cost" inputmode="decimal" placeholder="${t('biz.fAny')}" value="${esc(fMaxCost)}">
          <span class="fl">${t('biz.fDays')}</span>
          <input class="fi" id="f-days" inputmode="numeric" placeholder="${t('biz.fAny')}" value="${esc(fMaxDays)}">
          <span class="fl">${t('biz.fMargin')}</span>
          <input class="fi" id="f-margin" inputmode="numeric" placeholder="${t('biz.fAny')}" value="${esc(fMinMargin)}">
          <select class="sel" id="f-cycle">
            <option value="any" ${fCycle === 'any' ? 'selected' : ''}>${t('biz.fCycleAny')}</option>
            <option value="defensive" ${fCycle === 'defensive' ? 'selected' : ''}>${t('biz.fCycleDef')}</option>
            <option value="counter" ${fCycle === 'counter' ? 'selected' : ''}>${t('biz.fCycleCounter')}</option>
            <option value="cyclical" ${fCycle === 'cyclical' ? 'selected' : ''}>${t('biz.fCycleCyc')}</option>
          </select>
          <select class="sel" id="f-season">
            <option value="any" ${fSeason === 'any' ? 'selected' : ''}>${t('biz.fSeasonAny')}</option>
            <option value="yes" ${fSeason === 'yes' ? 'selected' : ''}>${t('biz.fSeasonYes')}</option>
            <option value="no" ${fSeason === 'no' ? 'selected' : ''}>${t('biz.fSeasonNo')}</option>
          </select>
        </div>
        <div class="filt-row">
          <span class="fl">${t('biz.mixLabel')}</span>
          ${MIX_KEYS.map(k => `<button class="mixchip ${mix[k.id] ? 'on' : ''}" data-mix="${k.id}">${k.emoji} ${t('biz.mix.' + k.id)}</button>`).join('')}
          <span class="dim2" style="font-size:10.5px;margin-left:auto">${
            Object.values(mix).filter(Boolean).length ? t('biz.mixOn', { n: Object.values(mix).filter(Boolean).length }) : t('biz.mixOff')}</span>
        </div>
      </div>
      <div class="opt-grid" style="max-height:250px;overflow:auto;margin-bottom:16px">
        ${list.length ? list.map(x => {
          const c = Math.round(x.cost * city.costMult) + Math.round(city.travelCost || 0);
          const afford = s.player.cash >= c;
          const sea = seasonText(x);
          const sc = scoreOf ? scoreOf(x) : null;
          return `<button class="opt ${x.id === pickType ? 'active' : ''}" data-type="${x.id}" ${afford ? '' : 'style="opacity:.45"'}>
            <div class="t">${sc != null ? `<span class="mixscore ${sc >= 75 ? 'hi' : sc >= 50 ? 'mid' : ''}">${sc}</span>` : ''}${x.emoji} ${esc(nm({ zh: x.name, en: x.en }))}</div>
            <div class="s">${money(c)} · ${t('biz.grossMargin')} ${Math.round((1 - x.cogs) * 100)}% · ${(() => {
                const p = paybackInfo(x, city);
                return p.ok ? `<b class="${p.days < 60 ? 'up' : p.days > 240 ? 'down' : ''}">${Math.round(p.days)}${t('biz.dPayback')}</b>`
                            : `<b class="down">${t('biz.lossMaking')}</b>`; })()}
              ${(() => { const a = marketingInfo(x, city);
                return a.worth ? `<span class="${a.payback < 30 ? 'up' : a.payback > 200 ? 'down' : 'dim2'}">· 📣${Math.round(a.payback)}${t('biz.dAd')}</span>`
                               : `<span class="down">· 📣${t('biz.adNever')}</span>`; })()}
              ${sea ? `<span class="gold">· ${sea}</span>` : ''}</div></button>`;
        }).join('') : `<div class="dim2" style="font-size:11.5px;padding:10px">${t('biz.noType')}</div>`}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.6px">${t('biz.chooseCity')}</span>
        <span class="dim2" style="font-size:10.5px">${t('biz.cityHint')}</span>
      </div>
      <input id="nb-city-q" type="search" placeholder="${t('biz.citySearchPh')}" value="${esc(cityQuery)}"
        style="width:100%;padding:8px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--txt);font-size:12.5px;margin-bottom:8px">
      <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(196px,1fr));max-height:224px;overflow:auto;margin-bottom:16px">
        ${cities.length ? cities.map(c => `<button class="opt ${c.id === pickCity ? 'active' : ''}" data-city="${c.id}">
          <div class="t">${c.flag || ''} ${esc(nm({ zh: c.name, en: c.en }))}</div>
          <div class="s">${money(c.setup)}${c.travelCost ? ` <span class="dim2">+✈️${money(c.travelCost)}</span>` : ''}
            <span class="dim2">· ${t('biz.revenue')} ${c.revMult.toFixed(2)}× · ${t('biz.rent')} <b class="${c.rentMult > 1.5 ? 'down' : ''}">${c.rentMult.toFixed(2)}×</b></span></div>
          </button>`).join('')
        : `<div class="dim2" style="font-size:11.5px;padding:10px">${t('biz.noCity')}</div>`}
      </div>
      ${cos.length ? `<div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.6px;margin-bottom:7px">${t('biz.payer')}</div>
      <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));margin-bottom:16px">
        <button class="opt ${payer === 0 ? 'active' : ''}" data-payer="0">
          <div class="t">👤 ${t('biz.paySelf')}</div>
          <div class="s">${money(s.player.cash)}</div></button>
        ${cos.map(c => `<button class="opt ${payer === c.id ? 'active' : ''}" data-payer="${c.id}"
          ${c.cash < cost ? 'style="opacity:.5"' : ''}>
          <div class="t">🏢 ${esc(c.name)}</div>
          <div class="s ${c.cash < cost ? 'down' : ''}">${money(c.cash)}</div></button>`).join('')}
      </div>
      <div class="dim2" style="font-size:10.5px;margin:-10px 0 14px">${t('biz.payerHint')}</div>` : ''}
      <label class="field"><span>${t('biz.nameIt')}</span><input id="nb-name" placeholder="${esc(nm({ zh: city.name + def.name, en: def.en + ' · ' + city.en }))}" maxlength="24"></label>
      <div class="summary">
        <div><span>📍 ${t('biz.location')}</span><span class="mono">${city.flag || ''} ${esc(nm({ zh: city.name, en: city.en }))}
          <span class="dim2" style="font-weight:400">${esc(nm({ zh: city.desc || '', en: city.descEn || '' }))}</span></span></div>
        <div><span>${t('biz.setup')}</span><span class="mono">${moneyFull(setup)}</span></div>
        ${travel ? `<div><span>✈️ ${t('biz.travelCost')}（${city.travelDays} ${t('common.day')}）</span><span class="mono down">${moneyFull(travel)}</span></div>` : ''}
        <div><span>${t('biz.hours')}</span><span class="mono">${def.hours[0]}:00–${def.hours[1]}:00 · ${H}h</span></div>
        <div><span>${t('biz.dailyRev')}</span><span class="mono">${money(dailyRev)}</span></div>
        <div><span>${t('biz.cogs')}</span><span class="mono down">-${money(cogs)}</span></div>
        <div><span>${t('biz.wages')}（${staffN} ${t('biz.staff')}）</span><span class="mono down">-${money(wages)}</span></div>
        <div><span>${t('biz.rent')}</span><span class="mono down">-${money(rentM / 30)}/${t('common.day')}（${money(rentM)}/${t('common.month')}）</span></div>
        <div><span>${t('biz.mgmt')}</span><span class="mono">${def.mgmt.toFixed(1)} h/${t('common.day')}</span></div>
        <div class="tot"><span>${t('biz.payback')}
          <span class="dim2" style="font-weight:400">${t('biz.paybackHow')}</span></span>
          <span class="mono ${!pb.ok ? 'down' : pb.days < 60 ? 'up' : pb.days > 240 ? 'down' : ''}">${
            pb.ok ? Math.round(pb.days) + ' ' + t('common.day') : t('biz.lossMaking')}
          <span class="dim2" style="font-weight:400">${moneyFull(pb.total)} ÷ ${money(pb.dailyNet)}</span></span></div>
        <div><span>📣 ${t('biz.adCost')}</span><span class="mono">${moneyFull(ad.cost)}
          <span class="dim2" style="font-weight:400">${ad.ratio < 1e6 ? t('biz.adRatio', { d: ad.ratio.toFixed(1) }) : ''}</span></span></div>
        <div><span>📣 ${t('biz.adGain')}</span><span class="mono ${ad.gain > 0 ? 'up' : 'down'}">${ad.gain > 0 ? '+' : ''}${money(ad.gain)}/${t('common.day')}</span></div>
        <div><span>📣 ${t('biz.adBack')}</span><span class="mono ${!ad.worth ? 'down' : ad.payback < 30 ? 'up' : ad.payback > 200 ? 'down' : ''}">${
          ad.worth ? Math.round(ad.payback) + ' ' + t('common.day') : t('biz.adNeverLong')}</span></div>
        <div class="tot"><span>${t('biz.dailyNet')}</span><span class="mono ${net >= 0 ? 'up' : 'down'}">${money(net)}</span></div>
      </div>
      <p class="dim2" style="font-size:11px;margin-top:8px;line-height:1.6">🕐 ${t('biz.hoursHint')}</p>
      ${travel ? `<p style="font-size:11.5px;margin-top:8px;line-height:1.6;color:var(--orange)">✈️ ${t('biz.travelWarn', { n: city.travelDays })}</p>` : ''}
      <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.6px;margin:14px 0 7px">${def.catEmoji} ${t('biz.character')}</div>
      <div class="trait-grid">
        ${TRAIT_ROWS.map(r => { const v = r.get(def);
          return `<div class="trait"><label>${t('biz.tr.' + r.k)}</label>
            <div class="tv ${r.hue(v)}">${r.fmt(v)}</div>
            <div class="bar sm"><i style="width:${Math.round(r.scale(v) * 100)}%"></i></div></div>`; }).join('')}
      </div>
      ${seasonText(def) ? `<div class="dim2" style="font-size:11px;margin-top:8px">🗓️ ${seasonText(def)}</div>` : ''}
      <p class="dim2" style="font-size:11.5px;margin-top:10px;line-height:1.6">${esc(nm({ zh: def.desc, en: def.descEn }))}</p>`;
      box.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { pickType = b.dataset.type; render(el); });
      const ao = box.querySelector('#nb-adonly');
      if (ao) ao.onchange = () => { adOnly = ao.checked; render(el); };
      // 数值类筛选：边打字边筛，打完把光标留在原处
      const typed = (id, set) => { const n = box.querySelector(id); if (!n) return;
        n.oninput = () => { set(n.value); clearTimeout(this._fT);
          this._fT = setTimeout(() => { render(el);
            const k = el.querySelector(id); if (k) { k.focus(); k.setSelectionRange(k.value.length, k.value.length); } }, 220); }; };
      typed('#f-cost', v => { fMaxCost = v; });
      typed('#f-days', v => { fMaxDays = v; });
      typed('#f-margin', v => { fMinMargin = v; });
      const cy = box.querySelector('#f-cycle'); if (cy) cy.onchange = () => { fCycle = cy.value; render(el); };
      const se = box.querySelector('#f-season'); if (se) se.onchange = () => { fSeason = se.value; render(el); };
      box.querySelectorAll('[data-mix]').forEach(b => b.onclick = () => {
        mix[b.dataset.mix] = !mix[b.dataset.mix]; render(el); });
      const cl = box.querySelector('#nb-clear');
      if (cl) cl.onclick = () => { pickCat = 'all'; typeQuery = ''; adOnly = false;
        fMaxCost = fMaxDays = fMinMargin = ''; fCycle = fSeason = 'any'; render(el); };
      const catSel = box.querySelector('#nb-cat');
      if (catSel) catSel.onchange = () => { pickCat = catSel.value; render(el); };
      const sortSel = box.querySelector('#nb-sort');
      if (sortSel) sortSel.onchange = () => { sortBy = sortSel.value; render(el); };
      const tq = box.querySelector('#nb-type-q');
      if (tq) tq.oninput = () => {
        typeQuery = tq.value;
        clearTimeout(this._typeT);
        this._typeT = setTimeout(() => {
          render(el);
          const n = el.querySelector('#nb-type-q');
          if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
        }, 160);
      };
      box.querySelectorAll('[data-city]').forEach(b => b.onclick = () => { pickCity = b.dataset.city; render(el); });
      box.querySelectorAll('[data-payer]').forEach(b => b.onclick = () => { payer = +b.dataset.payer; render(el); });
      const cq = box.querySelector('#nb-city-q');
      if (cq) {
        cq.oninput = () => {
          cityQuery = cq.value;
          clearTimeout(this._cityT);
          this._cityT = setTimeout(async () => {
            if (searching) return;
            searching = true;
            const q = cityQuery.trim();
            await loadCities(q);
            searching = false;
            if (cities.length && !cities.some(c => c.id === pickCity)) pickCity = cities[0].id;
            render(el);
            const nq = el.querySelector('#nb-city-q');
            if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
          }, 240);
        };
      }
      const sub = el.querySelector('#nb-submit');
      const purse = payer ? (cos.find(c => c.id === payer)?.cash ?? 0) : s.player.cash;
      sub.disabled = purse < cost;
      sub.textContent = purse < cost ? `${money(purse)} / ${money(cost)}` : `${t('biz.open')} · ${money(cost)}`;
    };
    modal({
      wide: true, title: t('biz.open'), icon: '🏪',
      body: `<div id="nb-body"></div>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="nb-submit"></button>`,
      onMount: (el, close) => {
        render(el);
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#nb-submit').onclick = async () => {
          try {
            await api.bizBuy(pickType, pickCity, el.querySelector('#nb-name').value, payer || null);
            close(); toast(t('toast.opened'), 'ok');
            await app.refresh(true);
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    });
  },

  patch(app) {
    // 只有在用户没有打开弹窗、也没有在输入时，才安全地整页刷新
    if (document.querySelector('.modal-mask')) return;
    const a = document.activeElement;
    if (a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) return;
    const root = document.getElementById('view');
    const top = root.scrollTop;
    keepScroll(() => this.render(root, app));
    root.scrollTop = top;
  }
};
