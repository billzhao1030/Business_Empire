// 创业：注册公司、把店铺装进去、看估值、融资、分红
import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, esc, toast } from '../util.js';

let data = null, sector = '服务', picked = null, divAmt = null, fundAmt = null;

const BASIS = { earnings: ['按利润估值', 'Earnings multiple'],
                revenue:  ['按营收估值', 'Revenue multiple'],
                book:     ['按清算价值', 'Liquidation value'] };

export default {
  async render(root, app) {
    if (!data) { try { data = await api.company(); } catch { data = null; } }
    if (!data) { root.innerHTML = `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`; return; }
    root.innerHTML = data.has ? this.owned(data, app) : this.found(data, app);
    this.bind(root, app);
  },

  // ── 还没有公司：注册一家 ──────────────────────────────────
  found(d, app) {
    if (picked === null) picked = new Set(d.shopsAvailable.map(s => s.id));
    const chosen = d.shopsAvailable.filter(s => picked.has(s.id));
    const daily = chosen.reduce((a, s) => a + s.dailyNet, 0);
    return `
    <div class="card" style="margin-bottom:16px;max-width:900px">
      <div class="card-h"><h3>🏢 ${t('co.foundTitle')}</h3><span class="sub">${t('co.foundSub')}</span></div>
      <div class="card-b">
        <div class="dim2" style="font-size:12px;line-height:1.8;margin-bottom:16px">${t('co.foundIntro')}</div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <label class="field"><span>${t('co.name')}</span>
            <input id="co-name" maxlength="24" placeholder="${t('co.namePh')}"></label>
          <label class="field"><span>${t('co.ticker')}</span>
            <input id="co-ticker" maxlength="5" placeholder="${t('co.tickerPh')}" style="text-transform:uppercase"></label>
        </div>
        <label class="field" style="margin-bottom:14px"><span>${t('co.nameEn')}</span>
          <input id="co-name-en" maxlength="32" placeholder="${t('co.nameEnPh')}"></label>
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('co.sector')}</div>
        <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));margin-bottom:16px">
          ${d.sectors.map(x => `<button class="opt ${sector === x.id ? 'active' : ''}" data-sec="${x.id}">
            <div class="t">${esc(nm(x))}</div></button>`).join('')}
        </div>
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('co.putIn', { n: chosen.length })}</div>
        ${d.shopsAvailable.length ? `<div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));margin-bottom:14px">
          ${d.shopsAvailable.map(s => `<button class="opt ${picked.has(s.id) ? 'active' : ''}" data-shop="${s.id}">
            <div class="t">${s.emoji} ${esc(s.name)}</div>
            <div class="s">${esc(nm({ zh: s.cityZh, en: s.cityEn }))} · ${t('co.dailyNet')}
              <b class="${s.dailyNet >= 0 ? 'up' : 'down'}">${money(s.dailyNet)}</b></div></button>`).join('')}
        </div>` : `<div class="summary" style="margin-bottom:14px;color:var(--orange)">${t('co.needShop')}</div>`}
        <div class="summary" style="margin-bottom:14px">
          <div><span>${t('co.fee')}</span><span class="mono down">${moneyFull(d.foundFee)}</span></div>
          <div><span>${t('co.yourCash')}</span><span class="mono ${d.cash >= d.foundFee ? '' : 'down'}">${moneyFull(d.cash)}</span></div>
          <div class="tot"><span>${t('co.startProfit')}</span>
            <span class="mono ${daily >= 0 ? 'up' : 'down'}">${money(daily * 365)}${t('co.perYear')}</span></div>
        </div>
        <button class="btn btn-primary btn-block" id="co-found"
          ${d.shopsAvailable.length && d.cash >= d.foundFee ? '' : 'disabled'}>🏢 ${t('co.foundBtn')}</button>
      </div>
    </div>`;
  },

  // ── 已经有公司 ────────────────────────────────────────────
  owned(d, app) {
    const c = d.co, v = d.val, o = d.offer;
    const basis = BASIS[v.basis] || BASIS.book;
    const gClass = v.growth > 0.02 ? 'up' : v.growth < -0.02 ? 'down' : 'dim';
    return `
    <div class="grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
      <div class="stat c5"><label>🏢 ${t('co.company')}</label>
        <div class="v" style="font-size:19px">${esc(c.name)}</div>
        <div class="d"><span class="tag y">${c.ticker}</span> ${esc(nm({ zh: c.stageZh, en: c.stageEn }))}</div></div>
      <div class="stat c1"><label>💰 ${t('co.valuation')}</label><div class="v">${money(v.value)}</div>
        <div class="d">${nm({ zh: basis[0], en: basis[1] })}${v.basis === 'earnings' ? ` · ${v.mult.toFixed(1)}×` : ''}</div></div>
      <div class="stat c2"><label>📈 ${t('co.growth')}</label>
        <div class="v ${gClass}">${v.growth >= 0 ? '+' : ''}${pctPlain(v.growth, 0)}</div>
        <div class="d">${v.maturity < 1 ? t('co.settling', { p: pctPlain(v.maturity, 0) }) : t('co.annualised')}</div></div>
      <div class="stat c3"><label>🥧 ${t('co.yourStake')}</label><div class="v">${pctPlain(c.stake, 1)}</div>
        <div class="d">${t('co.worth')} ${money(d.stakeValue)}</div></div>
      <div class="stat c4"><label>🏦 ${t('co.coCash')}</label><div class="v">${money(c.cash)}</div>
        <div class="d">${t('co.raised')} ${money(c.raised)}</div></div>
    </div>

    <div class="grid" style="grid-template-columns:1.1fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>💰 ${t('co.howValued')}</h3><span class="sub">${t('co.howValuedSub')}</span></div>
        <div class="card-b">
          <div class="summary" style="margin-bottom:12px">
            <div><span>${t('co.annualProfit')}</span><span class="mono ${v.annual >= 0 ? 'up' : 'down'}">${money(v.annual)}</span></div>
            <div><span>${t('co.spotProfit')}</span><span class="mono dim2">${money(v.spot)}</span></div>
            <div><span>${t('co.annualRev')}</span><span class="mono">${money(v.annualRev)}</span></div>
            <div><span>${t('co.shopsIn')}</span><span class="mono">${v.shops}</span></div>
            <div class="tot"><span>${t('co.valuation')}</span><span class="mono gold">${moneyFull(v.value)}</span></div>
          </div>
          <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('co.multBreakdown')}</div>
          <div class="mini-grid" style="margin-bottom:10px">
            <div class="mini"><label>${t('co.mBase')}</label><b>6.0×</b></div>
            <div class="mini"><label>${t('co.mGrowth')}</label><b class="${v.growth >= 0 ? 'up' : 'down'}">${(v.growth * 8 >= 0 ? '+' : '') + (v.growth * 8).toFixed(1)}×</b></div>
            <div class="mini"><label>${t('co.mHeat')}</label><b class="${v.heat >= 0 ? 'up' : 'down'}">${(v.heat * 5 >= 0 ? '+' : '') + (v.heat * 5).toFixed(1)}×</b></div>
            <div class="mini"><label>${t('co.mScale')}</label><b>+${v.scale.toFixed(1)}×</b></div>
            <div class="mini"><label>${t('co.mTotal')}</label><b class="gold">${v.mult.toFixed(1)}×</b></div>
          </div>
          <div class="dim2" style="font-size:11px;line-height:1.7">${t('co.threeWays', {
            e: v.byEarnings > 0 ? money(v.byEarnings) : t('co.na'),
            r: v.byRevenue > 0 ? money(v.byRevenue) : t('co.na'),
            b: money(v.byBook) })}
            <br>${v.annual > 0 ? t('co.revNaProfit') : t('co.revNeedGrowth')}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>💸 ${t('co.funding')}</h3></div>
        <div class="card-b">
          ${c.stage === 'public' ? `<div class="summary">${t('co.alreadyPublic')}</div>`
            : !o ? `<div class="summary">${t('co.noMoreRounds')}</div>` : `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <b style="font-size:15px">${esc(nm(o.round))}</b>
              ${o.ok ? `<span class="tag g">${t('co.canRaise')}</span>` : `<span class="tag">${t('co.notYet')}</span>`}
            </div>
            <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-bottom:12px">${esc(nm({ zh: o.round.descZh, en: o.round.descEn }))}</div>
            ${o.ok ? `<div class="summary" style="margin-bottom:12px">
              <div><span>${t('co.preMoney')}</span><span class="mono">${moneyFull(o.pre)}
                <span class="dim2" style="font-weight:400">(${pctPlain(o.disc, 0)} ${t('co.ofYourVal')})</span></span></div>
              <div><span>${t('co.raiseAmt')}</span><span class="mono up">${moneyFull(o.raise)}</span></div>
              <div><span>${t('co.sellPct')}</span><span class="mono down">${pctPlain(o.round.sell, 0)}</span></div>
              <div class="tot"><span>${t('co.stakeAfter')}</span>
                <span class="mono">${pctPlain(o.stakeBefore, 1)} → <b class="${o.stakeAfter < 0.5 ? 'down' : ''}">${pctPlain(o.stakeAfter, 1)}</b></span></div>
            </div>
            <button class="btn btn-primary btn-block" id="co-raise">💰 ${t('co.raiseBtn', { amt: money(o.raise) })}</button>
            <div class="dim2" style="font-size:10.5px;margin-top:8px;line-height:1.6">${t('co.dilutionNote')}</div>`
            : `<div class="summary" style="border-color:var(--orange)">
                <div><span>${t('co.needVal')}</span><span class="mono">${money(v.value)} / ${money(o.needVal)}</span></div>
                <div><span>${t('co.needShops')}</span><span class="mono">${v.shops} / ${o.needShops}</span></div>
              </div>`}`}
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>💵 ${t('co.dividend')}</h3><span class="sub">${t('co.dividendSub', { p: pctPlain(d.dividendTax, 0) })}</span></div>
        <div class="card-b">
          <div class="summary" style="margin-bottom:12px">
            <div><span>${t('co.coCash')}</span><span class="mono">${moneyFull(c.cash)}</span></div>
            <div><span>${t('co.paidSoFar')}</span><span class="mono">${money(c.dividendsPaid)}</span></div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input id="co-div" type="number" min="0" placeholder="${t('co.amount')}"
              value="${divAmt ?? ''}" style="flex:1;padding:8px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--txt)">
            <button class="btn btn-xs" data-div="all">${t('co.all')}</button>
            <button class="btn btn-xs" data-div="half">${t('co.half')}</button>
          </div>
          <button class="btn btn-primary btn-block" id="co-pay" ${c.cash >= d.minDividend ? '' : 'disabled'}>
            💵 ${t('co.payBtn')}</button>
          <div class="dim2" style="font-size:10.5px;margin-top:8px;line-height:1.6">${t('co.dividendNote', { p: pctPlain(c.stake, 1) })}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>🏦 ${t('co.injectTitle')}</h3><span class="sub">${t('co.injectSub')}</span></div>
        <div class="card-b">
          <div class="summary" style="margin-bottom:12px">
            <div><span>${t('co.yourCash')}</span><span class="mono">${moneyFull(d.cash)}</span></div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input id="co-fund" type="number" min="0" placeholder="${t('co.amount')}"
              value="${fundAmt ?? ''}" style="flex:1;padding:8px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--txt)">
            <button class="btn btn-xs" data-fund="all">${t('co.all')}</button>
          </div>
          <button class="btn btn-block" id="co-inject" ${d.cash > 0 ? '' : 'disabled'}>🏦 ${t('co.injectBtn')}</button>
          <div class="dim2" style="font-size:10.5px;margin-top:8px;line-height:1.6">${t('co.injectNote')}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🏬 ${t('co.assets')}</h3><span class="sub">${t('co.assetsSub')}</span></div>
      <div class="card-b">
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('co.inside', { n: d.shops.length })}</div>
        ${d.shops.length ? `<div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-bottom:14px">
          ${d.shops.map(s => `<button class="opt active" data-out="${s.id}">
            <div class="t">${s.emoji} ${esc(s.name)}</div>
            <div class="s">${esc(nm({ zh: s.cityZh, en: s.cityEn }))} ·
              <b class="${s.dailyNet >= 0 ? 'up' : 'down'}">${money(s.dailyNet * 365)}${t('co.perYear')}</b>
              ${c.stage !== 'public' ? `<span class="dim2">· ${t('co.takeOut')}</span>` : ''}</div></button>`).join('')}
        </div>` : `<div class="dim2" style="font-size:11.5px;margin-bottom:14px">${t('co.noneInside')}</div>`}
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('co.outside', { n: d.outside.length })}</div>
        ${d.outside.length ? `<div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
          ${d.outside.map(s => `<button class="opt" data-in="${s.id}">
            <div class="t">${s.emoji} ${esc(s.name)}</div>
            <div class="s">${esc(nm({ zh: s.cityZh, en: s.cityEn }))} ·
              <b class="${s.dailyNet >= 0 ? 'up' : 'down'}">${money(s.dailyNet * 365)}${t('co.perYear')}</b>
              ${c.stage !== 'public' ? `<span class="gold">· ${t('co.putInBtn')}</span>` : ''}</div></button>`).join('')}
        </div>` : `<div class="dim2" style="font-size:11.5px">${t('co.noneOutside')}</div>`}
      </div>
    </div>`;
  },

  bind(root, app) {
    const again = async (fn) => {
      try { const r = await app.guard(fn); data = r && r.has !== undefined ? r : null; await app.refresh(true); this.render(root, app); }
      catch (e) { toast(e.message.split(' / ')[0], 'err'); }
    };
    $$('[data-sec]').forEach(b => b.onclick = () => { sector = b.dataset.sec; this.render(root, app); });
    $$('[data-shop]').forEach(b => b.onclick = () => {
      const id = +b.dataset.shop;
      picked.has(id) ? picked.delete(id) : picked.add(id);
      this.render(root, app);
    });
    const f = $('#co-found');
    if (f) f.onclick = () => {
      const name = $('#co-name').value.trim(), ticker = $('#co-ticker').value.trim().toUpperCase();
      if (name.length < 2) return toast(t('co.errName'), 'err');
      if (!/^[A-Za-z]{2,5}$/.test(ticker)) return toast(t('co.errTicker'), 'err');
      again(() => api.coFound(name, $('#co-name-en').value.trim(), ticker, sector, [...picked]));
    };
    $('#co-raise') && ($('#co-raise').onclick = () => again(() => api.coRaise()));
    const dv = $('#co-div'), fd = $('#co-fund');
    if (dv) dv.oninput = () => { divAmt = dv.value; };
    if (fd) fd.oninput = () => { fundAmt = fd.value; };
    $$('[data-div]').forEach(b => b.onclick = () => {
      const c = data.co.cash;
      divAmt = String(Math.floor(b.dataset.div === 'all' ? c : c / 2));
      $('#co-div').value = divAmt;
    });
    $$('[data-fund]').forEach(b => b.onclick = () => {
      fundAmt = String(Math.floor(data.cash)); $('#co-fund').value = fundAmt;
    });
    $('#co-pay') && ($('#co-pay').onclick = () => {
      const a = Number($('#co-div').value);
      if (!(a > 0)) return toast(t('co.errAmount'), 'err');
      divAmt = null;
      again(() => api.coDividend(a));
    });
    $('#co-inject') && ($('#co-inject').onclick = () => {
      const a = Number($('#co-fund').value);
      if (!(a > 0)) return toast(t('co.errAmount'), 'err');
      fundAmt = null;
      again(() => api.coFund(a));
    });
    $$('[data-in]').forEach(b => b.onclick = () => again(() => api.coShops([+b.dataset.in], [])));
    $$('[data-out]').forEach(b => b.onclick = () => again(() => api.coShops([], [+b.dataset.out])));
  },

  patch(app) {
    const a = document.activeElement;
    if (a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) return;
    const s = app.state.netWorth.company;
    const sig = s ? `${Math.round(s.value)}|${Math.round(s.cash)}|${s.shops}` : 'none';
    if (sig === this._sig) return;
    this._sig = sig;
    data = null;
    const root = document.getElementById('view');
    const top = root.scrollTop;
    this.render(root, app).then(() => { root.scrollTop = top; });
  },
};
