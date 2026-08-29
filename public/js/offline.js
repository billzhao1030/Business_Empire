// 「欢迎回来」离线收益报告
import { t, nm, lang } from './i18n.js';
import { money, moneyFull, pct, cls, esc, modal, renderLedger, gShort } from './util.js';

const KIND_META = {
  job:      { icon: '🧳', color: 'var(--cyan)' },
  biz:      { icon: '🏬', color: 'var(--gold)' },
  dividend: { icon: '💵', color: 'var(--up)' },
  rent:     { icon: '🔑', color: 'var(--lime)' },
  interest: { icon: '🏦', color: 'var(--blue)' },
  deposit:  { icon: '💰', color: 'var(--purple)' },
  event:    { icon: '🎲', color: 'var(--pink)' },
  tax:      { icon: '🧾', color: 'var(--down)' },
  upkeep:   { icon: '🧰', color: 'var(--orange)' },
  loan:     { icon: '📉', color: 'var(--down)' },
  overdraft:{ icon: '⚠️', color: 'var(--down)' },
  trade:    { icon: '💱', color: 'var(--blue)' },
  item:     { icon: '💎', color: 'var(--purple)' },
  bank:     { icon: '🏦', color: 'var(--blue)' },
};

function awayText(ms) {
  const d = Math.floor(ms / 8.64e7), h = Math.floor(ms / 3.6e6) % 24, m = Math.floor(ms / 6e4) % 60;
  const parts = [];
  if (d) parts.push(t('offline.days', { n: d }));
  if (h) parts.push(t('offline.hours', { n: h }));
  if (!d && m) parts.push(t('offline.mins', { n: m }));
  return parts.join(' ') || t('offline.mins', { n: 1 });
}
function gameText(hours) {
  const d = Math.floor(hours / 24), h = Math.round(hours % 24);
  if (hours >= 720) {
    const mo = Math.floor(hours / 720), dd = Math.floor((hours % 720) / 24);
    return lang === 'zh' ? `${mo} 个月 ${dd} 天` : `${mo}mo ${dd}d`;
  }
  if (d) return lang === 'zh' ? `${d} 天 ${h} 小时` : `${d}d ${h}h`;
  return lang === 'zh' ? `${h} 小时` : `${h}h`;
}

function bars(rows, total) {
  if (!rows.length) return `<div class="dim2" style="font-size:12px;padding:10px 0">—</div>`;
  return rows.map(r => {
    const meta = KIND_META[r.kind] || { icon: '•', color: 'var(--dim)' };
    const w = total ? Math.abs(r.amt) / Math.abs(total) * 100 : 0;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin-bottom:4px">
        <span>${meta.icon}</span>
        <span class="dim" style="flex:1">${t('led.kinds.' + r.kind) || r.kind}
          <span class="dim2" style="font-size:10.5px">×${r.n}</span></span>
        <b class="mono ${cls(r.amt)}">${r.amt > 0 ? '+' : ''}${money(r.amt)}</b>
      </div>
      <div class="bar thin"><i style="width:${w}%;background:${meta.color}"></i></div>
    </div>`;
  }).join('');
}

export function showOfflineReport(o, app) {
  const up = o.nwDelta >= 0;
  modal({
    wide: true,
    title: `👋 ${t('offline.title')}`,
    body: `
      <div style="text-align:center;padding:6px 0 18px">
        <div class="dim" style="font-size:12.5px">${t('offline.sub')}</div>
        <div style="display:flex;justify-content:center;gap:26px;margin-top:14px;flex-wrap:wrap">
          <div><div class="dim2" style="font-size:10.5px;font-weight:700">${t('offline.away')}</div>
            <div class="mono" style="font-size:17px;font-weight:800">${awayText(o.awayMs)}</div></div>
          <div><div class="dim2" style="font-size:10.5px;font-weight:700">${t('offline.gameElapsed')}</div>
            <div class="mono gold" style="font-size:17px;font-weight:800">${gameText(o.gameHours)}</div></div>
        </div>
        <div class="dim2 mono" style="font-size:11px;margin-top:8px">${o.fromDate} → ${o.toDate}</div>
        ${o.capped ? `<div class="summary" style="margin-top:12px;border-color:var(--orange);color:var(--orange);font-size:12px;text-align:left">
          ⏳ <b>${t('offline.capped')}</b> · ${t('offline.cappedNote', {
            would: Math.round(o.wouldHaveHours / 24), cap: o.capDays,
            skipped: Math.round(o.skippedHours / 24) })}</div>` : ''}

        <div style="margin-top:20px;padding:18px;border-radius:var(--r);
          background:linear-gradient(140deg,${up ? 'rgba(44,232,164,.14)' : 'rgba(255,92,124,.12)'},transparent);
          border:1px solid ${up ? 'var(--up)' : 'var(--down)'}">
          <div class="dim2" style="font-size:11px;font-weight:700">${t('offline.nwChange')}</div>
          <div class="mono ${up ? 'up' : 'down'}" style="font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.2">
            ${up ? '+' : ''}${money(o.nwDelta)}</div>
          <div class="dim" style="font-size:12px">${money(o.nwBefore)} → <b>${money(o.nwAfter)}</b>
            ${o.nwBefore > 0 ? `<span class="${up ? 'up' : 'down'}">(${pct(o.nwDelta / Math.abs(o.nwBefore))})</span>` : ''}</div>
        </div>
      </div>

      ${o.income.length || o.expense.length ? `
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:18px">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
            <b style="font-size:13px">📥 ${t('offline.incomeTitle')}</b>
            <b class="mono up">${money(o.totalIn)}</b></div>
          ${bars(o.income, o.totalIn)}
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
            <b style="font-size:13px">📤 ${t('offline.expenseTitle')}</b>
            <b class="mono down">${money(o.totalOut)}</b></div>
          ${bars(o.expense, o.totalOut)}
        </div>
      </div>` : `<div class="dim" style="text-align:center;padding:20px;font-size:12.5px">${t('offline.nothing')}</div>`}

      <div class="summary" style="margin-top:16px">
        <div><span>${t('offline.net')}</span><span class="mono ${cls(o.cashFlow)}">${o.cashFlow >= 0 ? '+' : ''}${moneyFull(o.cashFlow)}</span></div>
        <div><span>${t('offline.valuation')}<br><span class="dim2" style="font-size:10.5px">${t('offline.valuationHint')}</span></span>
          <span class="mono ${cls(o.valuation)}">${o.valuation >= 0 ? '+' : ''}${moneyFull(o.valuation)}</span></div>
        <div class="tot"><span>${t('offline.nwChange')}</span>
          <span class="mono ${cls(o.nwDelta)}">${o.nwDelta >= 0 ? '+' : ''}${moneyFull(o.nwDelta)}</span></div>
      </div>

      ${o.highlights.length ? `<div style="margin-top:18px">
        <b style="font-size:13px">📰 ${t('offline.highlights')}</b>
        <div style="margin-top:6px">
          ${o.highlights.map(h => `<div class="news-item">
            <span class="news-time">${gShort(h.hour).split(' ')[0]}</span>
            <span style="flex-shrink:0">${h.icon || ''}</span>
            <span style="flex:1">${renderLedger(h.detail)}</span>
            ${h.amount ? `<b class="mono ${cls(h.amount)}">${h.amount > 0 ? '+' : ''}${money(h.amount)}</b>` : ''}
          </div>`).join('')}
        </div></div>` : ''}
    `,
    footer: `<button class="btn btn-primary" data-go>${t('offline.continue')}</button>`,
    onMount: (el, close) => { el.querySelector('[data-go]').onclick = close; },
  });
}
