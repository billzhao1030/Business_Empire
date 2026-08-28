import { t, nm } from '../i18n.js';
import { $, $$, money, cls, esc, renderLedger, gDate, hoursAgo } from '../util.js';

let filter = '';

export default {
  render(root, app) {
    const s = app.state;
    const kinds = [...new Set(s.ledger.map(l => l.kind))];
    const rows = filter ? s.ledger.filter(l => l.kind === filter) : s.ledger;
    const income = s.ledger.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0);
    const outgo = s.ledger.filter(l => l.amount < 0).reduce((a, l) => a + l.amount, 0);

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat"><label>📥 ${t('common.revenue')}</label><div class="v up">${money(income)}</div><div class="d">${t('dash.recent')}</div></div>
      <div class="stat"><label>📤 ${t('common.expense')}</label><div class="v down">${money(outgo)}</div><div class="d">${t('dash.recent')}</div></div>
      <div class="stat"><label>🧾 ${t('dash.taxPaid')}</label><div class="v">${money(s.player.totalTax)}</div><div class="d">${t('common.total')}</div></div>
      <div class="stat"><label>💵 ${t('dash.dividends')}</label><div class="v gold">${money(s.player.totalDividend)}</div><div class="d">${t('common.total')}</div></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>${t('led.title')}</h3>
        <div class="right"><div class="chips">
          <button class="chip ${!filter ? 'active' : ''}" data-f="">${t('led.all')}</button>
          ${kinds.map(k => `<button class="chip ${filter === k ? 'active' : ''}" data-f="${k}">${t('led.kinds.' + k) || k}</button>`).join('')}
        </div></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="width:150px">${t('common.today')}</th><th style="width:90px">${t('common.change')}</th>
        <th>${t('led.title')}</th><th class="r" style="width:130px">${t('common.amount')}</th>
      </tr></thead><tbody>
        ${rows.length ? rows.map(l => `<tr>
          <td class="mono dim2" style="font-size:11.5px">${gDate(l.hour)}</td>
          <td><span class="tag">${l.icon || ''} ${t('led.kinds.' + l.kind) || l.kind}</span></td>
          <td style="white-space:normal">${renderLedger(l.detail)}</td>
          <td class="r mono ${cls(l.amount)}" style="font-weight:700">${l.amount ? (l.amount > 0 ? '+' : '') + money(l.amount) : '—'}</td>
        </tr>`).join('') : `<tr><td colspan="4"><div class="empty"><p>${t('led.empty')}</p></div></td></tr>`}
      </tbody></table></div>
    </div>`;
    $$('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; this.render(root, app); });
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
