import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, price, pct, pctPlain, cls, arrow, esc, toast, modal, confirmBox, int, keepScroll} from '../util.js';
import { sparkline } from '../chart.js';
import market from './market.js';

let catF = 'all', sparks = null;

export default {
  async render(root, app) {
    const s = app.state, cat = app.catalog;
    const cats = ['car', 'estate', 'yacht', 'jet', 'watch', 'art'];
    const mine = s.items;
    const totalVal = mine.reduce((a, i) => a + i.value, 0);
    const rentIncome = mine.filter(i => i.rented).reduce((a, i) => a + i.rent, 0);
    const upkeep = mine.reduce((a, i) => a + i.upkeep, 0);

    const idxMap = Object.fromEntries(s.indices.map(i => [i.symbol, i]));
    const byCat = {};
    for (const i of mine) (byCat[i.cat] ??= []).push(i);
    const shown = catF === 'all' ? mine : (byCat[catF] || []);

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat accent"><label>🏛️ ${t('lux.myItems')}</label><div class="v">${money(totalVal)}</div><div class="d">${mine.length} ${t('common.owned')}</div></div>
      <div class="stat"><label>⭐ ${t('common.prestige')}</label><div class="v gold">${int(s.player.prestige)}</div><div class="d">${t('lux.prestigeInfo')} <b class="gold">+${pctPlain(s.player.prestigeBonus)}</b></div></div>
      <div class="stat"><label>🔑 ${t('lux.rentIncome')}</label><div class="v up">${money(rentIncome)}</div><div class="d">${t('common.perMonth')}</div></div>
      <div class="stat"><label>🧰 ${t('lux.upkeep')}</label><div class="v down">${money(upkeep)}</div><div class="d">${t('common.perMonth')}</div></div>
    </div>

    ${mine.length ? `<div class="card" style="margin-bottom:16px">
      <div class="card-h"><h3>${t('lux.myItems')}</h3><span class="sub">${t('lux.indexHint')}</span>
        <div class="right"><button class="btn btn-sm btn-primary" data-goshop="1">🛍️ ${t('shop.title')}</button></div></div>
      <div class="card-b" style="padding:11px 16px;border-bottom:1px solid var(--line)">
        <div class="chips">
          <button class="chip ${catF === 'all' ? 'active' : ''}" data-catf="all">${t('mkt.all')} ${mine.length}</button>
          ${Object.keys(byCat).map(c => `<button class="chip ${catF === c ? 'active' : ''}" data-catf="${c}">
            ${cat.itemCats[c]?.emoji || '📦'} ${esc(nm({ zh: cat.itemCats[c]?.name, en: cat.itemCats[c]?.en }))} ${byCat[c].length}</button>`).join('')}
        </div>
      </div>
      <div style="max-height:520px;overflow:auto">
      ${shown.map(i => `<div class="item-row">
        <div class="ico lg">${i.emoji}</div>
        <div class="i-main">
          <div class="i-title">${esc(nm(i.item))}
            ${i.isHome ? `<span class="tag gold">🏡 ${t('lux.living')}</span>` : ''}
            ${i.rented ? `<span class="tag g">${t('lux.rented')}</span>` : ''}
            ${i.canLive && !i.isHome && !i.rented ? `<span class="tag">${t('lux.vacant')}</span>` : ''}
            ${i.mortgage ? `<span class="tag r">${t('lux.hasMortgage')}</span>` : ''}
            ${i.region ? `<span class="tag b">${i.regionFlag || ''} ${esc(nm(i.region))}</span>` : ''}</div>
          <div class="i-sub">
            <span>${t('lux.myValue')} <b>${money(i.value)}</b></span>
            <span>${t('lux.gain')} <b class="${cls(i.gain)}">${money(i.gain)}</b> (${pct(i.paid ? i.gain / i.paid : 0)})</span>
            <span>${t('lux.upkeep')} ${money(i.upkeep)}</span>
            ${i.canRent ? `<span class="${i.rented ? 'up' : 'dim2'}">${t('lux.rentIncome')} ${money(i.rent)}${i.rented ? '' : ' ' + t('lux.ifLet')}</span>` : ''}
            ${i.isHome && i.live ? `<span class="gold">${t('lux.comfortTag')} ${i.live.stress <= -0.12 ? '★★★' : i.live.stress <= -0.05 ? '★★' : '★'}</span>` : ''}
            <span>⭐ ${i.prestige}</span>
            ${i.mortgage ? `<span class="down">${t('bank.left')} ${money(i.mortgage.balance)} · ${t('bank.monthly')} ${money(i.mortgage.payment)}</span>` : ''}
          </div>
        </div>
        <div class="i-act">
          ${i.wearable ? `<button class="btn btn-xs ${i.worn ? 'btn-primary' : ''}" data-wear2="${i.id}">${i.worn ? '✓ ' + t('person.worn') : t('person.wearIt')}</button>` : ''}
          ${i.canLive && !i.isHome ? `<button class="btn btn-xs" data-live="${i.id}">🏡 ${t('lux.liveHere')}</button>` : ''}
          ${i.canRent ? `<button class="btn btn-xs" data-rent="${i.id}" ${i.isHome && !i.rented ? `title="${t('lux.rentedNoLive')}"` : ''}>${i.rented ? t('lux.stopRent') : t('lux.rentOut')}</button>` : ''}
          ${i.indexSym ? `<button class="btn btn-xs btn-ghost" data-idx="${i.indexSym}">📈</button>` : ''}
          <button class="btn btn-xs btn-danger" data-sell="${i.id}">${t('lux.sellIt')} ${money(i.resale)}</button>
        </div></div>`).join('')}
      </div></div>`
      : `<div class="card"><div class="empty" style="padding:40px"><div class="e-ico">💎</div>
          <h4>${t('lux.noneYet')}</h4><p>${t('lux.noneYetHint')}</p>
          <button class="btn btn-primary" style="margin-top:14px" data-goshop="1">🛍️ ${t('shop.title')}</button></div></div>`}`;

    $$('[data-goshop]').forEach(b => b.onclick = () => app.go('shop'));
    $$('[data-catf]').forEach(b => b.onclick = () => { catF = b.dataset.catf; keepScroll(() => this.render(root, app)); });
    $$('[data-rent]').forEach(b => b.onclick = () => app.act(() => api.itemAction(+b.dataset.rent, 'rent'), t('toast.success')).catch(() => {}));
    $$('[data-live]').forEach(b => b.onclick = () => app.act(() => api.itemAction(+b.dataset.live, 'live'), t('toast.success')).catch(() => {}));
    $$('[data-wear2]').forEach(b => b.onclick = () => app.act(() => api.itemAction(+b.dataset.wear2, 'wear'), t('toast.success')).catch(() => {}));
    $$('[data-idx]').forEach(b => b.onclick = () => market.openDetail(b.dataset.idx, app));
    $$('[data-sell]').forEach(b => b.onclick = async () => {
      const it = s.items.find(x => x.id === +b.dataset.sell);
      const ok = await confirmBox(t('lux.sellIt'), `${esc(nm(it.item))} → <b class="gold">${moneyFull(it.resale)}</b>${it.mortgage ? `<br><span class="dim">${t('lux.payoffFirst')}（${money(it.mortgage.balance)}）</span>` : ''}`, t('lux.sellIt'));
      if (ok) app.act(() => api.itemAction(it.id, 'sell'), t('toast.success')).catch(() => {});
    });
    this.loadSparks();
  },

  async loadSparks() {
    const els = $$('canvas[data-sp]');
    if (!els.length) return;
    try {
      const sp = (await api.sparks()).spark;
      els.forEach(c => { const d = sp[c.dataset.sp]; if (d) sparkline(c, d, c.offsetWidth || 140, 34); });
    } catch {}
  },

  mortgageModal(app, typeId) {
    const cat = app.catalog, s = app.state;
    const def = cat.items.find(i => i.id === typeId);
    let downPct = 0.3, months = 240;
    modal({
      title: t('lux.mortgage'), icon: def.emoji,
      body: `<div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(nm({ zh: def.name, en: def.en }))}</div>
        <div class="mono gold" style="font-size:20px;font-weight:800;margin-bottom:14px">${moneyFull(def.listPrice)}</div>
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('lux.down')} <b class="gold" id="mg-dp">30%</b></div>
        <input class="rng" id="mg-rng" type="range" min="20" max="100" step="5" value="30">
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin:10px 0 6px">${t('lux.term')}</div>
        <div class="opt-grid" id="mg-terms">${cat.mortgageTerms.map(m => `
          <button class="opt ${m === months ? 'active' : ''}" data-m="${m}"><div class="t">${m / 12} ${t('common.year')}</div><div class="s">${m} ${t('common.months')}</div></button>`).join('')}</div>
        <div class="summary" style="margin-top:14px" id="mg-sum"></div>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="mg-ok">${t('common.confirm')}</button>`,
      onMount: (el, close) => {
        const upd = () => {
          const down = def.listPrice * downPct, amt = def.listPrice - down;
          const i = s.bank.mortgageRate / 12;
          const pay = amt > 0 ? amt * i / (1 - Math.pow(1 + i, -months)) : 0;
          el.querySelector('#mg-dp').textContent = Math.round(downPct * 100) + '%';
          el.querySelector('#mg-sum').innerHTML = `
            <div><span>${t('lux.downPay')}</span><span class="mono ${down > s.player.cash ? 'down' : ''}">${moneyFull(down)}</span></div>
            <div><span>${t('lux.loanAmt')}</span><span class="mono">${moneyFull(amt)}</span></div>
            <div><span>${t('bank.mortgageRate')}</span><span class="mono gold">${pctPlain(s.bank.mortgageRate)}</span></div>
            <div class="tot"><span>${t('lux.monthlyPay')}</span><span class="mono">${moneyFull(pay)}</span></div>`;
          el.querySelector('#mg-ok').disabled = down > s.player.cash;
        };
        el.querySelector('#mg-rng').oninput = e => { downPct = +e.target.value / 100; upd(); };
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
          months = +b.dataset.m; el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b)); upd();
        });
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#mg-ok').onclick = async () => {
          try { await api.itemBuy(typeId, { downPct, months }); close(); await app.refresh(true); toast(t('toast.success'), 'ok'); }
          catch (e) { toast(e.message, 'err'); }
        };
        upd();
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
