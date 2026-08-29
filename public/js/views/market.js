import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, price, pct, pctPlain, qty as fmtQty, cls, arrow, esc, toast, modal, confirmBox, newsLine, gShort } from '../util.js';
import { PriceChart, sparkline, movingAvg } from '../chart.js';

let assets = [], sparks = {}, kind = 'overview', sortKey = 'marketCap', sortDir = -1, search = '', sectorF = '';
let ovData = null, ovChart = null;
let lastPrices = {}, detailChart = null, detailTimer = null;

const KINDS = [
  { k: 'overview', i: '🌐' }, { k: 'stock', i: '📈' }, { k: 'district', i: '🏙️' },
  { k: 'commodity', i: '🥇' }, { k: 'crypto', i: '₿' }, { k: 'index', i: '🏘️' },
];
const kindLabel = k => ({ overview: t('mkt.overview'), stock: t('mkt.stocks'), district: t('mkt.districts'),
  commodity: t('mkt.commodities'), crypto: t('mkt.crypto'), index: t('mkt.indices') }[k]);

export default {
  async render(root, app) {
    root.innerHTML = `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`;
    await this.load(app);
    this.paint(root, app);
  },

  async load(app) {
    if (kind === 'overview') {
      const [ov, sp] = await Promise.all([api.overview(), api.sparks()]);
      ovData = ov; sparks = sp.spark;
      const m = await api.market(null); assets = m.assets;
      return;
    }
    const [m, sp] = await Promise.all([api.market(kind === 'index' ? 'index' : null), api.sparks()]);
    assets = m.assets; sparks = sp.spark;
  },

  kindBar() {
    return `<div class="segs">${KINDS.map(x => `<button class="seg ${kind === x.k ? 'active' : ''}" data-kind="${x.k}">${x.i} ${kindLabel(x.k)}</button>`).join('')}</div>`;
  },

  // ── 大盘概览 ──────────────────────────────────────────────
  paintOverview(root, app) {
    const d = ovData, s = app.state;
    const br = d.breadth.stock;
    const pos = d.sectors.filter(x => x.change > 0).length;
    root.innerHTML = `
    <div class="card" style="margin-bottom:14px"><div class="card-b" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:13px 18px">
      ${this.kindBar()}
      <div class="regime-chip regime-${d.macro.id}" style="margin-left:auto">${d.macro.emoji} ${esc(nm({ zh: d.macro.zh, en: d.macro.en }))}</div>
      <div class="dim2" style="font-size:11.5px">${t('macro.policy')} <b class="mono gold">${pctPlain(d.macro.policyRate)}</b></div>
    </div></div>

    <div class="grid" style="grid-template-columns:1.7fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>📊 ${t('mkt.marketIndex')} · BEXI</h3>
          <div class="right"><b class="mono" style="font-size:19px">${d.index.level.toFixed(1)}</b>
            <b class="mono ${cls(d.index.change)}">${arrow(d.index.change)} ${pct(d.index.change)}</b></div></div>
        <div class="card-b" style="padding:8px 12px 4px"><div id="ov-chart" style="height:220px"></div></div>
      </div>
      <div class="card"><div class="card-h"><h3>⚖️ ${t('mkt.breadth')}</h3></div>
        <div class="card-b">
          ${['stock', 'crypto', 'commodity'].map(k => { const b = d.breadth[k]; const tot = b.total || 1;
            return `<div style="margin-bottom:13px">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px">
                <span class="dim">${kindLabel(k)}</span>
                <span><b class="up">${b.up}</b> <span class="dim2">/</span> <b class="down">${b.down}</b>
                  <b class="mono ${cls(b.avg)}" style="margin-left:6px">${pct(b.avg)}</b></span></div>
              <div class="breadth">
                <i style="width:${b.up / tot * 100}%;background:var(--up)"></i>
                <i style="width:${b.flat / tot * 100}%;background:var(--panel3)"></i>
                <i style="width:${b.down / tot * 100}%;background:var(--down)"></i></div></div>`; }).join('')}
          <div class="dim2" style="font-size:11px;line-height:1.6;margin-top:4px">
            ${lang === 'zh' ? `${pos} / ${d.sectors.length} 个板块上涨` : `${pos} of ${d.sectors.length} sectors advancing`}</div>
        </div></div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px">
      <div class="card"><div class="card-h"><h3>🚀 ${t('mkt.gainers')}</h3></div>
        <div class="card-b" style="padding:8px 16px">
          ${d.gainers.map(g => `<div class="news-item clickable" data-sym="${g.symbol}" style="cursor:pointer">
            <b class="sym" style="width:56px">${g.symbol}</b>
            <span style="flex:1" class="dim">${esc(nm({ zh: g.zh, en: g.name }))}</span>
            <b class="mono up">${pct(g.change)}</b></div>`).join('')}
        </div></div>
      <div class="card"><div class="card-h"><h3>🩸 ${t('mkt.losers')}</h3></div>
        <div class="card-b" style="padding:8px 16px">
          ${d.losers.map(g => `<div class="news-item clickable" data-sym="${g.symbol}" style="cursor:pointer">
            <b class="sym" style="width:56px">${g.symbol}</b>
            <span style="flex:1" class="dim">${esc(nm({ zh: g.zh, en: g.name }))}</span>
            <b class="mono down">${pct(g.change)}</b></div>`).join('')}
        </div></div>
      <div class="card"><div class="card-h"><h3>🧭 ${t('mkt.sectorPerf')}</h3></div>
        <div class="card-b" style="padding:8px 16px;max-height:300px;overflow:auto">
          ${d.sectors.slice(0, 14).map(x => { const w = Math.min(100, Math.abs(x.change) * 900);
            return `<div class="sector-row">
              <span class="dim" style="width:78px;font-size:11px">${esc(nm(x))}</span>
              <div class="sector-bar"><i style="${x.change >= 0 ? `left:50%;width:${w / 2}%;background:var(--up)` : `right:50%;width:${w / 2}%;background:var(--down)`}"></i></div>
              <b class="mono ${cls(x.change)}" style="width:56px;text-align:right;font-size:11px">${pct(x.change)}</b></div>`; }).join('')}
        </div></div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="card-h"><h3>📰 ${t('dash.news')}</h3></div>
        <div class="card-b" style="padding:6px 18px;max-height:280px;overflow:auto">
          ${d.news.map(n => `<div class="news-item">
            <span class="news-time">${gShort(n.hour).split(' ')[0]}</span>
            <i class="news-dot" style="background:${n.impact >= 0 ? 'var(--up)' : 'var(--down)'}"></i>
            <span style="flex:1">${newsLine(n.headline)} <span class="dim2 mono" style="font-size:10.5px">${pct(n.impact)}</span></span>
          </div>`).join('')}
        </div></div>

      <div class="card"><div class="card-h"><h3>🕯️ ${t('mkt.rumors')}</h3>
        <span class="sub">${t('mkt.rumorsSub')}</span></div>
        <div class="card-b" style="padding:6px 18px;max-height:280px;overflow:auto">
          ${(d.rumors || []).length ? d.rumors.map(n => `<div class="news-item rumor clickable" data-rsec="${esc(n.target)}" style="cursor:pointer">
            <span class="news-time">${gShort(n.hour).split(' ')[0]}</span>
            <i class="news-dot" style="background:var(--purple)"></i>
            <span style="flex:1">${newsLine(n.headline)}
              <span class="tag" style="margin-left:4px">${esc(nm({ zh: n.target, en: n.target }))}</span></span>
          </div>`).join('')
          : `<div class="dim2" style="font-size:11.5px;padding:14px 0">${t('mkt.rumorsNone')}</div>`}
        </div>
        <div class="card-b" style="padding:0 18px 14px"><div class="dim2" style="font-size:10.5px;line-height:1.7">${t('mkt.rumorsHint')}</div></div>
      </div>
    </div>`;

    // 点传闻 → 直接筛出那个板块的股票
    $$('[data-rsec]').forEach(b => b.onclick = async () => {
      kind = 'stock'; sectorF = b.dataset.rsec;
      await this.load(app); this.paint(root, app);
    });

    $$('[data-kind]').forEach(b => b.onclick = async () => {
      kind = b.dataset.kind; sectorF = '';
      sortKey = kind === 'index' ? 'symbol' : 'marketCap';
      await this.load(app); this.paint(root, app);
    });
    $$('[data-sym]').forEach(x => x.onclick = () => this.openDetail(x.dataset.sym, app));
    ovChart = new PriceChart($('#ov-chart'), { height: 220 });
    ovChart.setData(d.index.history);
  },

  paint(root, app) {
    if (kind === 'overview') return this.paintOverview(root, app);
    const sectors = [...new Set(assets.filter(a => kind === 'index' || a.kind === kind).map(a => a.sector))]
      .sort((x, y) => this.secName(x, app).localeCompare(this.secName(y, app)));
    root.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-b" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:13px 18px">
        ${this.kindBar()}
        <div class="searchbox"><span class="dim2">🔍</span><input id="mk-search" placeholder="${t('mkt.searchPh')}" value="${esc(search)}"></div>
        <div class="selbox"><span class="dim2" style="font-size:11px">${t('common.sector')}</span>
          <select id="mk-sector">
            <option value="">${t('mkt.all')} (${assets.filter(a => kind === 'index' ? a.kind === 'index' : a.kind === kind).length})</option>
            ${sectors.map(x => `<option value="${esc(x)}" ${sectorF === x ? 'selected' : ''}>${esc(this.secName(x, app))} (${assets.filter(a => a.sector === x).length})</option>`).join('')}
          </select></div>
        <div style="margin-left:auto" class="dim2" id="mk-count"></div>
      </div>
    </div>
    <div class="card">
      <div class="tbl-wrap"><table class="tbl" id="mk-table"><thead><tr>
        <th class="sortable" data-s="symbol">${t('mkt.symbol')} / ${t('mkt.name')}</th>
        <th class="r sortable" data-s="price">${t('mkt.last')}</th>
        <th class="r sortable" data-s="hourChange">${t('mkt.hourChg')}</th>
        <th class="r sortable" data-s="change">${t('mkt.chg')}</th>
        <th class="c">${t('mkt.chart')}</th>
        ${kind !== 'index' ? `<th class="r sortable" data-s="marketCap">${t('mkt.cap')}</th>
        ${kind === 'stock' ? `<th class="r sortable" data-s="pe">${t('mkt.pe')}</th><th class="r sortable" data-s="divYield">${t('mkt.yield')}</th>` : ''}
        ${kind === 'district' ? `<th class="r sortable" data-s="divYield">${t('mkt.yieldRate')}</th>` : ''}
        <th class="r sortable" data-s="maxStake">${t('mkt.maxStake')}</th>
        <th class="r sortable" data-s="value">${t('mkt.mine')}</th>` : `<th class="r">${t('common.change')}</th>`}
      </tr></thead><tbody id="mk-body"></tbody></table></div>
    </div>`;

    $$('[data-kind]').forEach(b => b.onclick = async () => {
      kind = b.dataset.kind; sectorF = '';
      sortKey = kind === 'index' ? 'symbol' : 'marketCap';
      await this.load(app); this.paint(root, app);
    });
    const sel = $('#mk-sector');
    if (sel) sel.onchange = () => { sectorF = sel.value; this.rows(app); };
    $('#mk-search').oninput = e => { search = e.target.value; this.rows(app); };
    $$('#mk-table th.sortable').forEach(th => th.onclick = () => {
      const k = th.dataset.s;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = k === 'symbol' ? 1 : -1; }
      this.rows(app);
    });
    this.rows(app);
  },

  secName(s, app) {
    const map = app.catalog?.sectors?.find(x => x.zh === s);
    return map ? nm(map) : s;
  },

  list() {
    let l = assets.filter(a => kind === 'index' ? a.kind === 'index' : a.kind === kind);
    if (sectorF) l = l.filter(a => a.sector === sectorF);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.zh.includes(search));
    }
    const key = sortKey === 'value' ? (a => a.qty * a.price) : (a => a[sortKey] ?? -Infinity);
    return l.sort((a, b) => {
      const x = key(a), y = key(b);
      if (typeof x === 'string') return x.localeCompare(y) * sortDir;
      return ((x ?? -Infinity) - (y ?? -Infinity)) * sortDir;
    });
  },

  rows(app) {
    const body = $('#mk-body'); if (!body) return;
    const l = this.list();
    body.innerHTML = l.map(a => {
      const prev = lastPrices[a.symbol];
      const flash = prev != null && a.price !== prev ? (a.price > prev ? 'fu' : 'fd') : '';
      const mine = a.qty * a.price;
      return `<tr class="clickable ${flash}" data-sym="${a.symbol}">
        <td><div class="sym">${a.symbol}${a.stake >= 0.9995 ? ' <span class="tag y">100%</span>' : a.stake >= 0.5 ? ' <span class="tag p">' + t('mkt.controlling') + '</span>' : ''}</div>
            <div class="nm">${esc(nm({ zh: a.zh, en: a.name }))}</div></td>
        <td class="r mono" style="font-weight:700">${price(a.price)}</td>
        <td class="r mono ${cls(a.hourChange)}">${pct(a.hourChange)}</td>
        <td class="r mono ${cls(a.change)}" style="font-weight:700">${arrow(a.change)} ${pct(a.change)}</td>
        <td class="c"><canvas class="spark" data-sp="${a.symbol}"></canvas></td>
        ${kind !== 'index' ? `<td class="r mono dim">${money(a.marketCap)}</td>
        ${kind === 'stock' ? `<td class="r mono dim">${a.pe ? a.pe.toFixed(1) : '—'}</td>
        <td class="r mono ${a.divYield ? 'gold' : 'dim2'}">${a.divYield ? pctPlain(a.divYield) : '—'}</td>` : ''}
        ${kind === 'district' ? `<td class="r mono gold">${pctPlain(a.divYield)}</td>` : ''}
        <td class="r mono dim">${pctPlain(a.maxStake, 0)}</td>
        <td class="r mono">${a.qty ? `<b>${money(mine)}</b><div class="nm">${fmtQty(a.qty)} ${a.unit}</div>` : '<span class="dim2">—</span>'}</td>`
        : `<td class="r mono ${cls(a.change)}">${pct(a.change)}</td>`}
      </tr>`;
    }).join('');
    const cnt = $('#mk-count');
    if (cnt) cnt.textContent = `${l.length} / ${assets.filter(a => kind === 'index' ? a.kind === 'index' : a.kind === kind).length}`;
    lastPrices = Object.fromEntries(assets.map(a => [a.symbol, a.price]));
    $$('#mk-body canvas[data-sp]').forEach(c => { const d = sparks[c.dataset.sp]; if (d) sparkline(c, d); });
    $$('#mk-body tr').forEach(tr => tr.onclick = () => this.openDetail(tr.dataset.sym, app));
  },

  async patch(app) {
    try {
      if (kind === 'overview') {
        ovData = await api.overview();
        const lvl = $('.card-h .right b');
        if (ovChart) ovChart.setData(ovData.index.history);
        if (lvl) lvl.textContent = ovData.index.level.toFixed(1);
        return;
      }
      const m = await api.market(kind === 'index' ? 'index' : null);
      assets = m.assets;
      sparks = (await api.sparks()).spark;
      if ($('#mk-body')) this.rows(app);
    } catch {}
  },

  // ── 详情 / 交易 ───────────────────────────────────────────
  async openDetail(symbol, app) {
    let d;
    try { d = await api.asset(symbol, 400); } catch (e) { return toast(e.message, 'err'); }
    const isIndex = d.kind === 'index';
    const m = modal({
      wide: true,
      icon: '', title: `<span class="mono">${d.symbol}</span> <span class="dim" style="font-weight:500">${esc(nm({ zh: d.zh, en: d.name }))}</span>`,
      body: `<div id="dt-root"></div>`,
      onMount: (el, close) => {
        el._close = close;
        this.paintDetail(el, d, app, isIndex);
        detailTimer = setInterval(async () => {
          try {
            const nd = await api.asset(symbol, 400);
            Object.assign(d, nd);
            const pe = el.querySelector('#dt-price');
            if (pe) { pe.textContent = price(d.price); pe.className = 'trade-price ' + cls(d.change); }
            const ce = el.querySelector('#dt-chg');
            if (ce) ce.innerHTML = `<span class="${cls(d.change)}">${arrow(d.change)} ${pct(d.change)}</span>`;
            if (detailChart) detailChart.setData(d.history);
          } catch {}
        }, 6000);
        const obs = new MutationObserver(() => { if (!document.body.contains(el)) { clearInterval(detailTimer); detailChart?.destroy?.(); detailChart = null; obs.disconnect(); } });
        obs.observe(document.body, { childList: true });
      }
    });
  },

  paintDetail(el, d, app, isIndex) {
    const root = el.querySelector('#dt-root');
    const s = app.state;
    const h = d.holding;
    root.innerHTML = `
    <div class="trade-head">
      <div>
        <div id="dt-price" class="trade-price ${cls(d.change)}">${price(d.price)}</div>
        <div style="margin-top:6px;font-size:13px" id="dt-chg"><span class="${cls(d.change)}">${arrow(d.change)} ${pct(d.change)}</span></div>
      </div>
      <div style="margin-left:auto;text-align:right;font-size:11.5px;line-height:1.9" class="dim">
        <div>${t('common.sector')} · <b class="dim">${esc(this.secName(d.sector, app))}</b></div>
        ${!isIndex ? `<div>${t('mkt.maxStake')} · <b class="gold">${pctPlain(d.maxStake, 1)}</b></div>` : ''}
        ${d.divYield ? `<div>${t('mkt.yield')} · <b class="gold">${pctPlain(d.divYield)}</b></div>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <div class="segs" id="dt-range">
        ${[[48, '2D'], [120, '5D'], [240, '10D'], [400, '30D']].map(([v, l], i) => `<button class="seg ${i === 3 ? 'active' : ''}" data-r="${v}">${l}</button>`).join('')}
      </div>
      <div class="segs" id="dt-type">
        <button class="seg active" data-t="line">${t('mkt.line')}</button>
        <button class="seg" data-t="candle">${t('mkt.candle')}</button>
      </div>
      <button class="chip" id="dt-ma">${t('mkt.ma')} 5/20</button>
      <div class="dim2" style="font-size:11px;margin-left:auto">${t('mkt.intrinsic')} ${price(d.fair)} · ${t('mkt.volatility')} ${pctPlain(d.sigma)} · β ${d.beta.toFixed(2)}</div>
    </div>
    <div id="dt-chart" style="height:280px;margin-bottom:14px"></div>

    <div class="trade-meta">
      <div class="tm"><label>${t('mkt.high')}</label><b class="mono">${price(d.dayHigh)}</b></div>
      <div class="tm"><label>${t('mkt.low')}</label><b class="mono">${price(d.dayLow)}</b></div>
      ${!isIndex ? `<div class="tm"><label>${t('mkt.cap')}</label><b class="mono">${money(d.marketCap)}</b></div>
      <div class="tm"><label>${t('mkt.pe')}</label><b class="mono">${d.pe ? d.pe.toFixed(1) : '—'}</b></div>` : ''}
      ${d.annualProfit != null ? `<div class="tm"><label>${t('mkt.eps')}</label><b class="mono ${cls(d.eps)}">${price(d.eps)}</b></div>
      <div class="tm"><label>${t('mkt.annualProfit')}</label><b class="mono ${cls(d.annualProfit)}">${money(d.annualProfit)}</b></div>` : ''}
      <div class="tm"><label>${t('mkt.high52')}</label><b class="mono">${price(Math.max(...d.history.map(x => x.price)))}</b></div>
      <div class="tm"><label>${t('mkt.low52')}</label><b class="mono">${price(Math.min(...d.history.map(x => x.price)))}</b></div>
      <div class="tm"><label>${t('mkt.amplitude')}</label><b class="mono">${pctPlain((d.dayHigh - d.dayLow) / (d.dayLow || 1))}</b></div>
      <div class="tm"><label>${t('mkt.volatility')}</label><b class="mono">${pctPlain(d.sigma)}</b></div>
      ${d.kind === 'district' ? `<div class="tm"><label>${t('mkt.yieldRate')}</label><b class="mono gold">${pctPlain(d.divYield)}</b></div>
      <div class="tm"><label>${t('mkt.prosperity')}</label><b class="mono ${d.price >= d.fair ? 'up' : 'down'}">${((d.price / d.fair) * 100).toFixed(0)}%</b></div>` : ''}
      ${h ? `<div class="tm"><label>${t('mkt.holding')}</label><b class="mono">${fmtQty(h.qty)}</b></div>
      <div class="tm"><label>${t('mkt.avgCost')}</label><b class="mono">${price(h.avg)}</b></div>
      <div class="tm"><label>${t('pf.pnl')}</label><b class="mono ${cls(h.qty * d.price - h.cost)}">${money(h.qty * d.price - h.cost)}</b></div>` : ''}
    </div>

    <p class="dim" style="font-size:12px;line-height:1.7;margin-bottom:14px">${esc(d.desc)}</p>

    ${d.kind === 'district' ? `<div class="summary dim" style="font-size:12px;margin-bottom:12px">${t('mkt.districtHint')}</div>` : ''}
    ${isIndex ? `<div class="summary dim" style="font-size:12px">${t('lux.indexHint')}</div>` : `
    <div class="segs" id="dt-side" style="width:100%;display:flex;margin-bottom:12px">
      <button class="seg active" data-side="buy" style="flex:1">${t('mkt.buyPanel')}</button>
      <button class="seg" data-side="sell" style="flex:1">${t('mkt.sellPanel')}</button>
    </div>
    <div class="qty-row">
      <input id="dt-qty" type="text" inputmode="decimal" placeholder="0" value="">
      <span class="dim" style="font-size:12px">${d.unit}</span>
    </div>
    <div class="pcts" id="dt-pcts">
      ${[25, 50, 75, 100].map(p => `<button data-p="${p}">${p}%</button>`).join('')}
      <button data-p="max">MAX</button>
    </div>
    <div class="summary" id="dt-sum"></div>
    <button class="btn btn-buy btn-block" id="dt-submit" style="margin-top:12px">${t('common.buy')}</button>

    ${d.takeover ? `<div class="card" style="margin-top:16px;border-color:${d.takeover.eligible ? 'rgba(245,185,66,.4)' : 'var(--line)'}">
      <div class="card-b">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:19px">🏛️</span>
          <b style="font-size:13.5px">${t('mkt.takeover')}</b>
          ${d.stake >= 0.9995 ? `<span class="tag y">${t('mkt.fullyOwned')}</span>` : ''}
        </div>
        <p class="dim" style="font-size:12px;line-height:1.7;margin-bottom:10px">${t('mkt.takeoverDesc')}</p>
        ${d.annualProfit < 0 ? `<div class="summary" style="border-color:#5a2530;color:#ff8b9c;margin-bottom:10px">${t('mkt.lossWarn', { amt: money(Math.abs(d.annualProfit) / 12) })}</div>`
          : `<div class="summary" style="margin-bottom:10px"><div><span>${t('pf.ownerProfit')}</span><span class="mono gold">${money(d.annualProfit / 12)}${t('common.perMonth')}</span></div></div>`}
        <div class="trade-meta" style="margin:0 0 10px">
          <div class="tm"><label>${t('mkt.remaining')}</label><b class="mono">${fmtQty(d.takeover.remaining)}</b></div>
          <div class="tm"><label>${t('mkt.premium')}</label><b class="mono gold">+${pctPlain(d.takeover.premium - 1, 0)}</b></div>
          <div class="tm"><label>${t('mkt.takeoverCost')}</label><b class="mono">${money(d.takeover.cost)}</b></div>
        </div>
        <button class="btn ${d.takeover.eligible && s.player.cash >= d.takeover.cost ? 'btn-primary' : ''} btn-block" id="dt-takeover"
          ${d.takeover.eligible && s.player.cash >= d.takeover.cost ? '' : 'disabled'}>
          ${d.takeover.eligible ? t('mkt.takeover') : `${t('mkt.unlockAt')} ${pctPlain(d.maxStake, 1)}`}
        </button>
      </div></div>` : ''}
    `}

    ${d.news?.length ? `<div style="margin-top:18px">
      <div class="dim2" style="font-size:11px;font-weight:700;letter-spacing:.6px;margin-bottom:6px">${t('mkt.news')}</div>
      ${d.news.slice(0, 6).map(n => `<div class="news-item"><span class="news-time">${gShort(n.hour).split(' ')[0]}</span>
        <i class="news-dot" style="background:${n.impact >= 0 ? 'var(--up)' : 'var(--down)'}"></i>
        <span style="flex:1">${newsLine(n.headline)}</span></div>`).join('')}
    </div>` : ''}`;

    detailChart = new PriceChart(root.querySelector('#dt-chart'), { height: 280 });
    let maOn = false;
    const applyMA = () => {
      if (!maOn) return detailChart.setData(detailChart.data, { overlays: [] });
      const vals = detailChart.data.map(p => p.price);
      detailChart.setData(detailChart.data, { overlays: [
        { data: movingAvg(vals, 5), color: 'rgba(255,196,77,.9)', width: 1.2 },
        { data: movingAvg(vals, 20), color: 'rgba(86,160,255,.9)', width: 1.2 },
      ] });
    };
    detailChart.setData(d.history);
    const maBtn = root.querySelector('#dt-ma');
    if (maBtn) maBtn.onclick = () => { maOn = !maOn; maBtn.classList.toggle('active', maOn); applyMA(); };

    root.querySelectorAll('#dt-range .seg').forEach(b => b.onclick = () => {
      root.querySelectorAll('#dt-range .seg').forEach(x => x.classList.toggle('active', x === b));
      const n = +b.dataset.r;
      detailChart.setData(d.history.slice(-n)); applyMA();
    });
    root.querySelectorAll('#dt-type .seg').forEach(b => b.onclick = () => {
      root.querySelectorAll('#dt-type .seg').forEach(x => x.classList.toggle('active', x === b));
      detailChart.setData(detailChart.data, { type: b.dataset.t, bucket: 6 }); applyMA();
    });
    if (isIndex) return;

    let side = 'buy';
    const qIn = root.querySelector('#dt-qty');
    const sumEl = root.querySelector('#dt-sum');
    const btn = root.querySelector('#dt-submit');
    const maxBuy = () => {
      const px = d.price * (1 + s.fees.spread);
      const byCash = s.player.cash / (px * (1 + s.fees.commission));
      const byCap = d.shares * d.maxStake - (h?.qty || 0);
      return Math.max(0, Math.min(byCash, byCap));
    };
    const maxSell = () => h?.qty || 0;
    const round = v => d.kind === 'stock' ? Math.floor(v) : Math.floor(v * 1e6) / 1e6;

    const upd = () => {
      const q = Math.max(0, Number(qIn.value) || 0);
      const px = d.price * (1 + (side === 'buy' ? s.fees.spread : -s.fees.spread));
      const gross = q * px;
      const fee = Math.max(s.fees.minCommission, gross * s.fees.commission);
      if (side === 'buy') {
        const total = gross + fee;
        sumEl.innerHTML = `
          <div><span>${t('mkt.est')}</span><span class="mono">${price(px)} × ${fmtQty(q)}</span></div>
          <div><span>${t('mkt.commission')}</span><span class="mono">${money(fee)}</span></div>
          <div><span>${t('mkt.available')}</span><span class="mono">${money(s.player.cash)}</span></div>
          <div class="tot"><span>${t('common.total')}</span><span class="mono ${total > s.player.cash ? 'down' : ''}">${moneyFull(total)}</span></div>`;
        btn.disabled = q <= 0 || total > s.player.cash;
      } else {
        const basis = h && h.qty ? h.cost * (q / h.qty) : 0;
        const gain = gross - fee - basis;
        const tax = gain > 0 ? gain * s.tax.capGain : 0;
        sumEl.innerHTML = `
          <div><span>${t('mkt.est')}</span><span class="mono">${price(px)} × ${fmtQty(q)}</span></div>
          <div><span>${t('mkt.commission')}</span><span class="mono">${money(fee)}</span></div>
          <div><span>${t('mkt.capGain')}</span><span class="mono">${money(tax)}</span></div>
          <div class="tot"><span>${t('mkt.proceeds')}</span><span class="mono up">${moneyFull(gross - fee - tax)}</span></div>`;
        btn.disabled = q <= 0 || q > maxSell() + 1e-9;
      }
    };
    qIn.oninput = upd;
    root.querySelectorAll('#dt-side .seg').forEach(b => b.onclick = () => {
      side = b.dataset.side;
      root.querySelectorAll('#dt-side .seg').forEach(x => x.classList.toggle('active', x === b));
      btn.className = `btn ${side === 'buy' ? 'btn-buy' : 'btn-sell'} btn-block`;
      btn.textContent = side === 'buy' ? t('common.buy') : t('common.sell');
      qIn.value = ''; upd();
    });
    root.querySelectorAll('#dt-pcts button').forEach(b => b.onclick = () => {
      const cap = side === 'buy' ? maxBuy() : maxSell();
      const p = b.dataset.p === 'max' ? 1 : +b.dataset.p / 100;
      qIn.value = String(round(cap * p * (b.dataset.p === 'max' ? 0.9999 : 1)));
      upd();
    });
    btn.onclick = async () => {
      const q = Number(qIn.value) || 0;
      if (q <= 0) return;
      btn.disabled = true;
      try {
        await api.trade(d.symbol, side, q);
        toast(side === 'buy' ? t('toast.bought') : t('toast.sold'), 'ok');
        el._close?.();
        clearInterval(detailTimer);
        await app.refresh(true);
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    };
    upd();

    const tk = root.querySelector('#dt-takeover');
    if (tk) tk.onclick = async () => {
      const ok = await confirmBox(t('mkt.takeover'),
        `${esc(nm({ zh: d.zh, en: d.name }))} — ${t('mkt.takeoverCost')} <b class="gold">${moneyFull(d.takeover.cost)}</b>`
        + (d.annualProfit < 0 ? `<br><br><span class="down">${t('mkt.lossWarn', { amt: money(Math.abs(d.annualProfit) / 12) })}</span>` : ''), t('common.confirm'));
      if (!ok) return;
      try {
        await api.takeover(d.symbol);
        toast(t('mkt.fullyOwned'), 'ok');
        el._close?.(); clearInterval(detailTimer);
        await app.refresh(true);
      } catch (e) { toast(e.message, 'err'); }
    };
  },
};
