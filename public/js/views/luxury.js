import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, price, pct, pctPlain, cls, arrow, esc, toast, modal, confirmBox, int } from '../util.js';
import { sparkline } from '../chart.js';
import market from './market.js';

let tab = 'car', regionF = '', sparks = null;

export default {
  async render(root, app) {
    const s = app.state, cat = app.catalog;
    const cats = ['car', 'estate', 'yacht', 'jet', 'watch', 'art'];
    const mine = s.items;
    const totalVal = mine.reduce((a, i) => a + i.value, 0);
    const rentIncome = mine.filter(i => i.rented).reduce((a, i) => a + i.rent, 0);
    const upkeep = mine.reduce((a, i) => a + i.upkeep, 0);

    const market_ = cat.items.filter(i => i.cat === tab && (tab !== 'estate' || !regionF || i.region === regionF));
    const idxMap = Object.fromEntries(s.indices.map(i => [i.symbol, i]));

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat accent"><label>🏛️ ${t('lux.myItems')}</label><div class="v">${money(totalVal)}</div><div class="d">${mine.length} ${t('common.owned')}</div></div>
      <div class="stat"><label>⭐ ${t('common.prestige')}</label><div class="v gold">${int(s.player.prestige)}</div><div class="d">${t('lux.prestigeInfo')} <b class="gold">+${pctPlain(s.player.prestigeBonus)}</b></div></div>
      <div class="stat"><label>🔑 ${t('lux.rentIncome')}</label><div class="v up">${money(rentIncome)}</div><div class="d">${t('common.perMonth')}</div></div>
      <div class="stat"><label>🧰 ${t('lux.upkeep')}</label><div class="v down">${money(upkeep)}</div><div class="d">${t('common.perMonth')}</div></div>
    </div>

    ${mine.length ? `<div class="card" style="margin-bottom:16px">
      <div class="card-h"><h3>${t('lux.myItems')}</h3><span class="sub">${t('lux.indexHint')}</span></div>
      <div style="max-height:340px;overflow:auto">
      ${mine.map(i => `<div class="item-row">
        <div class="ico lg">${i.emoji}</div>
        <div class="i-main">
          <div class="i-title">${esc(nm(i.item))}
            ${i.rented ? `<span class="tag g">${t('lux.rented')}</span>` : ''}
            ${i.mortgage ? `<span class="tag r">${t('lux.hasMortgage')}</span>` : ''}
            ${i.region ? `<span class="tag b">${i.regionFlag || ''} ${esc(nm(i.region))}</span>` : ''}</div>
          <div class="i-sub">
            <span>${t('lux.myValue')} <b>${money(i.value)}</b></span>
            <span>${t('lux.gain')} <b class="${cls(i.gain)}">${money(i.gain)}</b> (${pct(i.paid ? i.gain / i.paid : 0)})</span>
            <span>${t('lux.upkeep')} ${money(i.upkeep)}</span>
            ${i.canRent ? `<span>${t('lux.rentIncome')} ${money(i.rent)}</span>` : ''}
            <span>⭐ ${i.prestige}</span>
            ${i.mortgage ? `<span class="down">${t('bank.left')} ${money(i.mortgage.balance)} · ${t('bank.monthly')} ${money(i.mortgage.payment)}</span>` : ''}
          </div>
        </div>
        <div class="i-act">
          ${i.canRent ? `<button class="btn btn-xs" data-rent="${i.id}">${i.rented ? t('lux.stopRent') : t('lux.rentOut')}</button>` : ''}
          ${i.indexSym ? `<button class="btn btn-xs btn-ghost" data-idx="${i.indexSym}">📈</button>` : ''}
          <button class="btn btn-xs btn-danger" data-sell="${i.id}">${t('lux.sellIt')} ${money(i.resale)}</button>
        </div></div>`).join('')}
      </div></div>` : ''}

    <div class="card">
      <div class="card-h"><h3>🛒 ${t('lux.market')}</h3>
        <div class="right"><div class="segs">${cats.map(c => `<button class="seg ${tab === c ? 'active' : ''}" data-tab="${c}">${cat.itemCats[c].emoji} ${esc(nm({ zh: cat.itemCats[c].name, en: cat.itemCats[c].en }))}</button>`).join('')}</div></div>
      </div>
      ${tab === 'car' && !app.state.job.carOwned ? `<div class="card-b" style="padding:11px 18px;border-bottom:1px solid var(--line);color:var(--gold);font-size:12.5px">${t('lux.carJobHint')}</div>` : ''}
      ${tab === 'estate' ? `<div class="card-b" style="padding:12px 18px;border-bottom:1px solid var(--line)">
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
      <div class="card-b">
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:12px">
        ${market_.map(i => {
          const afford = s.player.cash >= i.listPrice;
          const canMortgage = !!i.mortgage;
          const down = i.listPrice * cat.minDown;
          return `<div class="card" style="background:var(--bg2)">
            <div class="card-b" style="padding:14px">
              <div style="display:flex;gap:10px;align-items:flex-start">
                <div class="ico">${i.emoji}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:13px">${esc(nm({ zh: i.name, en: i.en }))}</div>
                  <div class="dim2" style="font-size:10.5px;margin-top:2px">⭐ ${i.prestige} · ${t('lux.upkeep')} ${money(i.listPrice * i.upkeep)}${i.rent ? ` · ${t('lux.rentIncome')} ${money(i.listPrice * i.rent)}` : ''}</div>
                </div>
              </div>
              <div class="mono" style="font-size:17px;font-weight:800;margin:10px 0 4px">${money(i.listPrice)}</div>
              <p class="dim2" style="font-size:11px;line-height:1.55;min-height:32px">${esc(nm({ zh: i.desc, en: i.descEn }))}</p>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button class="btn btn-sm ${afford ? 'btn-primary' : ''}" style="flex:1" data-buy="${i.id}" ${afford ? '' : 'disabled'}>${t('lux.buy')}</button>
                ${canMortgage ? `<button class="btn btn-sm" data-mort="${i.id}" ${s.player.cash >= down ? '' : 'disabled'} title="${t('lux.mortgage')}">🏦</button>` : ''}
              </div>
            </div></div>`;
        }).join('')}
        </div>
      </div>
    </div>`;

    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; regionF = ''; this.render(root, app); });
    $$('[data-reg]').forEach(b => b.onclick = () => { regionF = b.dataset.reg; this.render(root, app); });
    $$('[data-buy]').forEach(b => b.onclick = () => app.act(() => api.itemBuy(b.dataset.buy), t('toast.success')).catch(() => {}));
    $$('[data-mort]').forEach(b => b.onclick = () => this.mortgageModal(app, b.dataset.mort));
    $$('[data-rent]').forEach(b => b.onclick = () => app.act(() => api.itemAction(+b.dataset.rent, 'rent'), t('toast.success')).catch(() => {}));
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
    this.render(root, app);
    root.scrollTop = top;
  }
};
