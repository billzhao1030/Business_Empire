import { t, nm } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, cls, esc, toast, durText, confirmBox, modal, keepScroll} from '../util.js';

export default {
  render(root, app) {
    const s = app.state, b = s.bank;
    const scoreLv = s.player.creditScore >= 780 ? 4 : s.player.creditScore >= 700 ? 3 : s.player.creditScore >= 620 ? 2 : s.player.creditScore >= 500 ? 1 : 0;
    const scorePct = (s.player.creditScore - 300) / 550;

    root.innerHTML = `
    ${s.player.cash < 0 ? `<div class="card" style="border-color:#5a2530;margin-bottom:16px"><div class="card-b" style="color:#ff8b9c;padding:13px 18px">${t('bank.overdraftWarn')}</div></div>` : ''}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat"><label>💵 ${t('common.cash')}</label><div class="v ${s.player.cash < 0 ? 'down' : ''}">${money(s.player.cash)}</div><div class="d">${t('bank.borrowHint')}</div></div>
      <div class="stat accent"><label>🏦 ${t('bank.savings')}</label><div class="v">${money(s.player.bank)}</div><div class="d">${t('bank.savingsRate')} <b class="gold">${pctPlain(b.savingsRate)}</b></div></div>
      <div class="stat"><label>💰 ${t('bank.fixed')}</label><div class="v">${money(s.netWorth.deposits)}</div><div class="d">${s.deposits.length} × ${t('bank.fixed')}</div></div>
      <div class="stat"><label>📉 ${t('bank.totalDebt')}</label><div class="v ${b.totalDebt > 0 ? 'down' : ''}">${money(b.totalDebt)}</div>
        <div class="d">${t('bank.mortgageDebt')} ${money(b.mortgageDebt)}</div></div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
      <div class="card"><div class="card-h"><h3>🏦 ${t('bank.savings')}</h3><span class="sub">${pctPlain(b.savingsRate)} ${t('common.year')}</span></div>
        <div class="card-b">
          <div class="qty-row"><input id="bk-amt" type="text" inputmode="decimal" placeholder="0"></div>
          <div class="pcts" id="bk-pcts">${[25, 50, 100].map(p => `<button data-p="${p}">${p}%</button>`).join('')}</div>
          <div style="display:flex;gap:9px">
            <button class="btn btn-primary" style="flex:1" data-bk="deposit">${t('bank.deposit')} →</button>
            <button class="btn" style="flex:1" data-bk="withdraw">← ${t('bank.withdraw')}</button>
          </div>
          <div class="summary" style="margin-top:12px">
            <div><span>${t('common.cash')}</span><span class="mono">${moneyFull(s.player.cash)}</span></div>
            <div><span>${t('bank.savings')}</span><span class="mono">${moneyFull(s.player.bank)}</span></div>
            <div class="tot"><span>${t('common.perMonth')} ${t('bank.interest')}</span><span class="mono gold">${money(s.player.bank * b.savingsRate / 12)}</span></div>
          </div>
        </div></div>

      <div class="card"><div class="card-h"><h3>📊 ${t('bank.credit')}</h3></div>
        <div class="card-b">
          <div style="display:flex;align-items:baseline;gap:10px">
            <div style="font-size:38px;font-weight:800;letter-spacing:-1px" class="${scoreLv >= 3 ? 'up' : scoreLv >= 2 ? 'gold' : 'down'}">${s.player.creditScore}</div>
            <div class="tag ${scoreLv >= 3 ? 'g' : scoreLv >= 2 ? 'y' : 'r'}">${t('bank.scoreLevels')[scoreLv]}</div>
            <div class="dim2 mono" style="margin-left:auto;font-size:11px">300 — 850</div>
          </div>
          <div class="bar" style="margin:11px 0 14px"><i style="width:${scorePct * 100}%;background:linear-gradient(90deg,var(--down),var(--gold),var(--up))"></i></div>
          <div class="summary">
            <div><span>${t('bank.loanRate')}</span><span class="mono">${pctPlain(b.loanRate)}</span></div>
            <div><span>${t('bank.mortgageRate')}</span><span class="mono gold">${pctPlain(b.mortgageRate)}</span></div>
            <div><span>${t('bank.creditLimit')}</span><span class="mono">${money(b.creditLimit)}</span></div>
            <div class="tot"><span>${t('common.prestige')}</span><span class="mono">${Math.round(s.player.prestige)}</span></div>
          </div>
          <p class="dim2" style="font-size:11.5px;margin-top:10px;line-height:1.6">${t('bank.creditTip')}</p>
        </div></div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="card-h"><h3>💰 ${t('bank.fixed')}</h3>
        <div class="right"><button class="btn btn-sm btn-primary" id="bk-newfix">+ ${t('bank.openFixed')}</button></div></div>
        <div style="max-height:320px;overflow:auto">
          ${s.deposits.length ? s.deposits.map(d => `<div class="item-row">
            <div class="ico">💰</div>
            <div class="i-main"><div class="i-title">${moneyFull(d.amount)} <span class="tag y">${pctPlain(d.rate)}</span></div>
              <div class="i-sub"><span>${d.termMonths} ${t('common.months')}</span><span>${t('bank.interest')} <b class="gold">${money(d.interest)}</b></span>
                <span>${t('bank.matureIn')} ${durText(Math.max(0, d.matureIn))}</span></div>
              <div class="bar thin" style="margin-top:6px"><i style="width:${d.progress * 100}%;background:var(--gold)"></i></div></div>
            <div class="i-act"><button class="btn btn-xs btn-ghost" data-redeem="${d.id}">${t('bank.redeem')}</button></div>
          </div>`).join('') : `<div class="empty" style="padding:32px"><p>${t('bank.noFixed')}</p></div>`}
        </div></div>

      <div class="card"><div class="card-h"><h3>🏦 ${t('bank.loans')}</h3>
        <div class="right"><button class="btn btn-sm btn-primary" id="bk-newloan">+ ${t('bank.borrow')}</button></div></div>
        <div style="max-height:320px;overflow:auto">
          ${s.loans.length ? s.loans.map(l => `<div class="item-row">
            <div class="ico">${l.kind === 'mortgage' ? '🏠' : '📄'}</div>
            <div class="i-main"><div class="i-title">${moneyFull(l.balance)}
              <span class="tag ${l.kind === 'mortgage' ? 'b' : 'r'}">${pctPlain(l.rate)}</span>
              ${l.itemName ? `<span class="dim" style="font-weight:400;font-size:11.5px">${esc(nm(l.itemName))}</span>` : ''}</div>
              <div class="i-sub"><span>${t('bank.monthly')} <b>${money(l.payment)}</b></span>
                <span>${t('bank.remain')} ${l.monthsLeft}</span>
                <span>${t('bank.nextDue')} ${durText(Math.max(0, l.nextDueIn))}</span></div></div>
            <div class="i-act"><button class="btn btn-xs" data-repay="${l.id}">${t('bank.repay')}</button></div>
          </div>`).join('') : `<div class="empty" style="padding:32px"><p>${t('bank.noLoans')}</p></div>`}
        </div></div>
    </div>`;

    const amt = () => Number($('#bk-amt').value) || 0;
    $$('#bk-pcts button').forEach(x => x.onclick = () => { $('#bk-amt').value = String(Math.floor(Math.max(0, s.player.cash) * (+x.dataset.p / 100))); });
    $$('[data-bk]').forEach(x => x.onclick = () => app.act(() => api.bank(x.dataset.bk, { amount: amt() }), t('toast.success')).catch(() => {}));
    $$('[data-redeem]').forEach(x => x.onclick = () => app.act(() => api.bank('redeem', { id: +x.dataset.redeem }), t('toast.success')).catch(() => {}));
    $$('[data-repay]').forEach(x => x.onclick = () => this.repayModal(app, +x.dataset.repay));
    $('#bk-newfix').onclick = () => this.fixedModal(app);
    $('#bk-newloan').onclick = () => this.loanModal(app);
  },

  fixedModal(app) {
    const s = app.state, rates = s.bank.fixedRates;
    let term = 12;
    modal({
      title: t('bank.openFixed'), icon: '💰',
      body: `<label class="field"><span>${t('common.amount')}（${t('bank.savings')} ${money(s.player.bank)}）</span>
        <input id="fx-amt" type="text" inputmode="decimal" placeholder="1000"></label>
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('common.term')}</div>
        <div class="opt-grid" id="fx-terms">${Object.entries(rates).map(([m, r]) => `
          <button class="opt ${+m === term ? 'active' : ''}" data-m="${m}"><div class="t">${m} ${t('common.months')}</div><div class="s gold">${pctPlain(r)} ${t('common.year')}</div></button>`).join('')}</div>
        <div class="summary" style="margin-top:14px" id="fx-sum"></div>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="fx-ok">${t('common.confirm')}</button>`,
      onMount: (el, close) => {
        const upd = () => {
          const a = Number(el.querySelector('#fx-amt').value) || 0;
          el.querySelector('#fx-sum').innerHTML = `<div><span>${t('bank.principal')}</span><span class="mono">${moneyFull(a)}</span></div>
            <div><span>${t('bank.fixedRate')}</span><span class="mono gold">${pctPlain(rates[term])}</span></div>
            <div class="tot"><span>${t('bank.interest')}</span><span class="mono gold">${money(a * rates[term] * term / 12)}</span></div>`;
        };
        el.querySelector('#fx-amt').oninput = upd;
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
          term = +b.dataset.m;
          el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b)); upd();
        });
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#fx-ok').onclick = async () => {
          try { await api.bank('fixed', { amount: Number(el.querySelector('#fx-amt').value), months: term }); close(); await app.refresh(true); toast(t('toast.success'), 'ok'); }
          catch (e) { toast(e.message, 'err'); }
        };
        upd();
      }
    });
  },

  loanModal(app) {
    const s = app.state, limit = s.bank.creditLimit, rate = s.bank.loanRate;
    let months = 12;
    modal({
      title: t('bank.borrow'), icon: '🏦',
      body: `<div class="summary" style="margin-bottom:14px">
          <div><span>${t('bank.creditLimit')}</span><span class="mono gold">${moneyFull(limit)}</span></div>
          <div><span>${t('bank.loanRate')}</span><span class="mono">${pctPlain(rate)}</span></div></div>
        <label class="field"><span>${t('common.amount')}</span><input id="ln-amt" type="text" inputmode="decimal" placeholder="0"></label>
        <input class="rng" id="ln-rng" type="range" min="0" max="100" value="0">
        <div class="dim2" style="font-size:10.5px;font-weight:700;margin:8px 0 6px">${t('common.term')}</div>
        <div class="opt-grid" id="ln-terms">${[6, 12, 24, 36, 60].map(m => `
          <button class="opt ${m === months ? 'active' : ''}" data-m="${m}"><div class="t">${m} ${t('common.months')}</div></button>`).join('')}</div>
        <div class="summary" style="margin-top:14px" id="ln-sum"></div>
        <p class="dim2" style="font-size:11.5px;margin-top:10px">${t('bank.borrowHint')}</p>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="ln-ok">${t('common.confirm')}</button>`,
      onMount: (el, close) => {
        const ai = el.querySelector('#ln-amt'), rg = el.querySelector('#ln-rng');
        const upd = () => {
          const a = Math.min(limit, Number(ai.value) || 0);
          const i = rate / 12, pay = a > 0 ? a * i / (1 - Math.pow(1 + i, -months)) : 0;
          el.querySelector('#ln-sum').innerHTML = `
            <div><span>${t('bank.principal')}</span><span class="mono">${moneyFull(a)}</span></div>
            <div><span>${t('bank.monthly')}</span><span class="mono">${moneyFull(pay)}</span></div>
            <div class="tot"><span>${t('common.total')} ${t('common.cost')}</span><span class="mono down">${moneyFull(pay * months)}</span></div>`;
        };
        ai.oninput = () => { rg.value = String(limit > 0 ? Math.min(100, (Number(ai.value) || 0) / limit * 100) : 0); upd(); };
        rg.oninput = () => { ai.value = String(Math.round(limit * rg.value / 100)); upd(); };
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
          months = +b.dataset.m; el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b)); upd();
        });
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#ln-ok').onclick = async () => {
          try { await api.bank('loan', { amount: Number(ai.value), months }); close(); await app.refresh(true); toast(t('toast.success'), 'ok'); }
          catch (e) { toast(e.message, 'err'); }
        };
        upd();
      }
    });
  },

  repayModal(app, id) {
    const l = app.state.loans.find(x => x.id === id);
    modal({
      title: t('bank.repay'), icon: '📉',
      body: `<div class="summary" style="margin-bottom:14px">
          <div><span>${t('bank.left')}</span><span class="mono">${moneyFull(l.balance)}</span></div>
          <div><span>${t('bank.monthly')}</span><span class="mono">${moneyFull(l.payment)}</span></div>
          <div><span>${t('common.rate')}</span><span class="mono">${pctPlain(l.rate)}</span></div></div>
        <label class="field"><span>${t('common.amount')}</span><input id="rp-amt" type="text" inputmode="decimal" value="${Math.round(l.balance)}"></label>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="rp-ok">${t('bank.payoff')}</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#rp-ok').onclick = async () => {
          try { await api.bank('repay', { id, amount: Number(el.querySelector('#rp-amt').value) }); close(); await app.refresh(true); toast(t('toast.success'), 'ok'); }
          catch (e) { toast(e.message, 'err'); }
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
