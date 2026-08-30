// 商城：所有能买的东西都在这儿，按类目分。
// 「资产」那一页只管你已经拥有的，两件事分开看才不会挤成一坨。
import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, cls, arrow, esc, toast, modal, int, keepScroll } from '../util.js';
import { sparkline } from '../chart.js';
import market from './market.js';

let tab = 'top', regionF = '', sortBy = 'price', query = '', sparks = null;

const ORDER = ['top','bottom','outer','shoes','acc','car','estate','watch','art','yacht','jet'];

export default {
  render(root, app) {
    const s = app.state, cat = app.catalog;
    const cats = ORDER.filter(c => cat.itemCats[c]);
    if (!cats.includes(tab)) tab = cats[0];
    const owned = new Map();
    for (const i of s.items) owned.set(i.typeId, (owned.get(i.typeId) || 0) + 1);
    const idxMap = Object.fromEntries(s.indices.map(i => [i.symbol, i]));
    const q = query.trim().toLowerCase();

    let list = cat.items.filter(i => i.cat === tab
      && (tab !== 'estate' || !regionF || i.region === regionF)
      && (!q || String(i.name).toLowerCase().includes(q) || String(i.en).toLowerCase().includes(q)));
    const by = { price: (a, b) => a.listPrice - b.listPrice,
                 priceD: (a, b) => b.listPrice - a.listPrice,
                 prestige: (a, b) => (b.prestige || 0) - (a.prestige || 0) };
    list = list.sort(by[sortBy] || by.price);

    const isWear = !!cat.itemCats[tab]?.wear;

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat accent"><label>💵 ${t('common.cash')}</label><div class="v">${money(s.player.cash)}</div>
        <div class="d">${t('shop.affordable', { n: list.filter(i => s.player.cash >= i.listPrice).length })}</div></div>
      <div class="stat"><label>🛍️ ${t('shop.catalogue')}</label><div class="v">${int(cat.items.length)}</div>
        <div class="d">${cats.length} ${t('shop.cats')}</div></div>
      <div class="stat"><label>📦 ${t('shop.youOwn')}</label><div class="v">${s.items.length}</div>
        <div class="d">${t('shop.inThisCat', { n: list.filter(i => owned.has(i.id)).length })}</div></div>
      <div class="stat"><label>⭐ ${t('common.prestige')}</label><div class="v gold">${int(s.player.prestige)}</div>
        <div class="d">${t('lux.prestigeInfo')} <b class="gold">+${pctPlain(s.player.prestigeBonus)}</b></div></div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🛍️ ${t('shop.title')}</h3>
        <div class="right" style="display:flex;gap:8px;align-items:center">
          <input id="sh-q" type="search" placeholder="${t('shop.search')}" value="${esc(query)}"
            style="padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg2);color:var(--txt);font-size:12px;width:150px">
          <select class="sel" id="sh-sort">
            <option value="price" ${sortBy === 'price' ? 'selected' : ''}>${t('shop.sortPrice')}</option>
            <option value="priceD" ${sortBy === 'priceD' ? 'selected' : ''}>${t('shop.sortPriceD')}</option>
            <option value="prestige" ${sortBy === 'prestige' ? 'selected' : ''}>${t('shop.sortPrestige')}</option>
          </select>
        </div>
      </div>
      <div class="card-b" style="padding:11px 16px;border-bottom:1px solid var(--line)">
        <div class="chips">
          ${cats.map(c => { const n = cat.items.filter(i => i.cat === c).length;
            return `<button class="chip ${tab === c ? 'active' : ''}" data-tab="${c}">
              ${cat.itemCats[c].emoji} ${esc(nm({ zh: cat.itemCats[c].name, en: cat.itemCats[c].en }))}
              <b class="dim2">${n}</b></button>`; }).join('')}
        </div>
      </div>

      ${tab === 'estate' ? `<div class="card-b" style="padding:12px 16px;border-bottom:1px solid var(--line)">
        <div class="chips">
          <button class="chip ${!regionF ? 'active' : ''}" data-reg="">${t('mkt.all')}</button>
          ${cat.regions.map(r => { const ix = idxMap[r.index]; return `<button class="chip ${regionF === r.id ? 'active' : ''}" data-reg="${r.id}">
            ${r.flag} ${esc(nm({ zh: r.name, en: r.en }))} <b class="mono ${cls(ix?.change || 0)}">${ix ? ix.price.toFixed(0) : ''}</b></button>`; }).join('')}
        </div>
        ${regionF ? (() => { const r = cat.regions.find(x => x.id === regionF); const ix = idxMap[r.index];
          return `<div style="display:flex;align-items:center;gap:14px;margin-top:12px;padding:11px 14px;background:var(--bg2);border-radius:10px;border:1px solid var(--line)">
            <div><div class="dim2" style="font-size:10.5px">${t('lux.regionIndex')}</div>
              <div style="font-size:19px;font-weight:800" class="mono">${ix.price.toFixed(1)} <span class="${cls(ix.change)}" style="font-size:12px">${arrow(ix.change)} ${pct(ix.change)}</span></div></div>
            <canvas class="spark" data-sp="${r.index}" style="width:140px;height:34px"></canvas>
            <div class="dim2" style="font-size:11.5px;flex:1">${esc(ix.desc)}</div>
            <button class="btn btn-xs btn-ghost" data-idx="${r.index}">${t('mkt.detail')} →</button></div>`; })() : ''}
      </div>` : ''}
      ${isWear ? `<div class="card-b" style="padding:10px 16px;border-bottom:1px solid var(--line)">
        <span class="dim2" style="font-size:11.5px">👗 ${t('shop.wearHint')}</span></div>` : ''}

      <div class="card-b">
        ${list.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:11px">
        ${list.map(i => {
          const afford = s.player.cash >= i.listPrice;
          const have = owned.get(i.id) || 0;
          const down = i.listPrice * cat.minDown;
          return `<div class="shop-card ${have ? 'have' : ''}">
            <div class="sc-top">
              ${isWear ? `<div class="sc-sw" style="background:${i.col};border-color:${i.col2}"></div>` : `<div class="ico">${i.emoji}</div>`}
              <div style="flex:1;min-width:0">
                <div class="sc-t">${isWear ? i.emoji + ' ' : ''}${esc(nm({ zh: i.name, en: i.en }))}
                  ${have ? `<span class="tag g">×${have}</span>` : ''}</div>
                <div class="sc-s">⭐ ${i.prestige}${i.upkeep ? ` · ${t('lux.upkeep')} ${money(i.listPrice * i.upkeep)}` : ''}${
                  i.rent ? ` · ${t('lux.rentIncome')} ${money(i.listPrice * i.rent)}` : ''}${
                  i.style ? ` · ${esc(nm(cat.styles.find(x => x.id === i.style) || {}))}` : ''}${
                  i.bike ? ` · 🚲 ${t('shop.canCycle')}` : i.car ? ` · 🚗 ${t('shop.canDrive')}` : ''}</div>
              </div>
            </div>
            <div class="mono sc-p">${money(i.listPrice)}</div>
            <p class="sc-d">${esc(nm({ zh: i.desc, en: i.descEn }))}</p>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm ${afford ? 'btn-primary' : ''}" style="flex:1" data-buy="${i.id}" ${afford ? '' : 'disabled'}>${t('lux.buy')}</button>
              ${i.mortgage ? `<button class="btn btn-sm" data-mort="${i.id}" ${s.player.cash >= down ? '' : 'disabled'} title="${t('lux.mortgage')}">🏦</button>` : ''}
            </div>
          </div>`;
        }).join('')}</div>`
        : `<div class="empty" style="padding:34px"><div class="e-ico">🔍</div><p>${t('shop.none')}</p></div>`}
      </div>
    </div>`;

    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; regionF = ''; query = ''; this.render(root, app); });
    $$('[data-reg]').forEach(b => b.onclick = () => { regionF = b.dataset.reg; keepScroll(() => this.render(root, app)); });
    $$('[data-buy]').forEach(b => b.onclick = () => app.act(() => api.itemBuy(b.dataset.buy), t('toast.success')).catch(() => {}));
    $$('[data-mort]').forEach(b => b.onclick = () => app.viewObj?.mortgageModal
      ? app.viewObj.mortgageModal(app, b.dataset.mort) : this.mortgageModal(app, b.dataset.mort));
    $$('[data-idx]').forEach(b => b.onclick = () => market.openDetail(b.dataset.idx, app));
    const so = $('#sh-sort'); if (so) so.onchange = () => { sortBy = so.value; keepScroll(() => this.render(root, app)); };
    const qq = $('#sh-q');
    if (qq) qq.oninput = () => { query = qq.value; clearTimeout(this._t);
      this._t = setTimeout(() => { keepScroll(() => this.render(root, app));
        const n = $('#sh-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 170); };
    if (tab === 'estate' && regionF) { sparks = sparks || {}; this.drawSparks(app); }
  },

  drawSparks(app) {
    $$('[data-sp]').forEach(async c => {
      try { const r = await api.asset(c.dataset.sp, 120); sparkline(c, r.history.map(h => h.price)); } catch {}
    });
  },

  // 房贷：和资产页共用同一套
  mortgageModal(app, typeId) {
    const cat = app.catalog, s = app.state;
    const def = cat.items.find(x => x.id === typeId);
    if (!def) return;
    let months = cat.mortgageTerms[2] || 240, dp = Math.max(cat.minDown, 0.2);
    const render = el => {
      const price = def.listPrice, down = price * dp, amt = price - down;
      const rate = s.bank.mortgageRate ?? 0.05, i = rate / 12;
      const pay = amt * i / (1 - Math.pow(1 + i, -months));
      el.querySelector('#mg-body').innerHTML = `
        <div class="summary">
          <div><span>${t('lux.price')}</span><span class="mono">${moneyFull(price)}</span></div>
          <div><span>${t('lux.downPct')}</span><span class="mono">${pctPlain(dp, 0)} · ${moneyFull(down)}</span></div>
          <div><span>${t('lux.loanAmt')}</span><span class="mono">${moneyFull(amt)}</span></div>
          <div><span>${t('bank.rate')}</span><span class="mono">${pctPlain(rate, 2)}</span></div>
          <div class="tot"><span>${t('bank.monthly')}</span><span class="mono down">${moneyFull(pay)}</span></div>
        </div>
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin:12px 0 6px">${t('lux.downPct')}</div>
        <input class="rng" id="mg-dp" type="range" min="${cat.minDown * 100}" max="90" value="${dp * 100}">
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin:10px 0 6px">${t('lux.term')}</div>
        <div class="segs" style="display:flex;flex-wrap:wrap">
          ${cat.mortgageTerms.map(m => `<button class="seg ${m === months ? 'active' : ''}" data-mm="${m}" style="flex:1;font-size:11px">${m / 12}y</button>`).join('')}
        </div>`;
      el.querySelector('#mg-dp').oninput = e => { dp = +e.target.value / 100; render(el); };
      el.querySelectorAll('[data-mm]').forEach(b => b.onclick = () => { months = +b.dataset.mm; render(el); });
      const go = el.querySelector('#mg-go');
      go.disabled = s.player.cash < down;
      go.textContent = t('lux.mortgageGo', { amt: money(down) });
    };
    modal({ title: t('lux.mortgage'), icon: '🏦', body: `<div id="mg-body"></div>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="mg-go"></button>`,
      onMount: (el, close) => { render(el);
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#mg-go').onclick = async () => {
          try { await api.itemBuy(typeId, dp, months); close(); toast(t('toast.success'), 'ok'); await app.refresh(true); }
          catch (e) { toast(e.message, 'err'); } };
      } });
  },
};
