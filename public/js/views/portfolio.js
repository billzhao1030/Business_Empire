import { t, nm } from '../i18n.js';
import { $, $$, money, price, pct, pctPlain, qty as fq, cls, esc } from '../util.js';
import { donut } from '../chart.js';
import market from './market.js';

const KC = { stock: '#4d8bf5', commodity: '#f5b942', crypto: '#a78bfa' };

export default {
  render(root, app) {
    const s = app.state, hs = s.holdings;
    const total = hs.reduce((a, h) => a + h.value, 0);
    const cost = hs.reduce((a, h) => a + h.cost, 0);
    const pnl = total - cost;
    const divs = hs.reduce((a, h) => a + (h.monthlyDividend || 0), 0);
    const byKind = ['stock', 'commodity', 'crypto'].map(k => ({
      k, label: t('mkt.' + (k === 'stock' ? 'stocks' : k === 'commodity' ? 'commodities' : 'crypto')),
      v: hs.filter(h => h.kind === k).reduce((a, h) => a + h.value, 0), color: KC[k],
    }));

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat accent"><label>💼 ${t('pf.totalValue')}</label><div class="v">${money(total)}</div>
        <div class="d">${hs.length} ${t('pf.position')}</div></div>
      <div class="stat"><label>📊 ${t('pf.totalPnl')}</label><div class="v ${cls(pnl)}">${money(pnl)}</div>
        <div class="d ${cls(pnl)}">${cost > 0 ? pct(pnl / cost) : '--'}</div></div>
      <div class="stat"><label>✅ ${t('pf.realized')}</label><div class="v ${cls(s.player.realizedPnl)}">${money(s.player.realizedPnl)}</div>
        <div class="d">${t('dash.dividends')} ${money(s.player.totalDividend)}</div></div>
      <div class="stat"><label>💵 ${t('pf.divIncome')}</label><div class="v gold">${money(divs)}</div>
        <div class="d">${t('common.perMonth')}</div></div>
    </div>

    ${hs.length ? `
    <div class="grid" style="grid-template-columns:1fr 2.4fr;margin-bottom:16px">
      <div class="card"><div class="card-h"><h3>${t('pf.alloc')}</h3></div>
        <div class="card-b" style="display:flex;gap:16px;align-items:center">
          <canvas id="pf-donut" style="flex-shrink:0"></canvas>
          <div style="flex:1">
            ${byKind.map(x => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px">
              <i style="width:9px;height:9px;border-radius:3px;background:${x.color}"></i>
              <span class="dim" style="flex:1">${x.label}</span><b class="mono">${money(x.v)}</b></div>`).join('')}
          </div></div></div>
      <div class="card"><div class="card-h"><h3>👑 ${t('pf.control')} / ${t('pf.fullOwn')}</h3></div>
        <div class="card-b" style="padding:6px 18px;max-height:200px;overflow:auto">
          ${hs.filter(h => h.stake >= 0.05).length ? hs.filter(h => h.stake >= 0.05).map(h => `
            <div class="news-item"><span style="flex:1"><b class="sym">${h.symbol}</b> ${esc(nm({ zh: h.zh, en: h.name }))}</span>
            <span class="tag ${h.stake >= 0.9995 ? 'y' : h.stake >= 0.5 ? 'p' : 'b'}">${pctPlain(h.stake, 2)}</span>
            <b class="mono">${money(h.value)}</b></div>`).join('')
            : `<div class="dim2" style="padding:22px 0;text-align:center;font-size:12px">${t('common.none')}</div>`}
        </div></div>
    </div>

    <div class="card"><div class="card-h"><h3>${t('pf.holdings')}</h3></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>${t('mkt.symbol')}</th><th class="r">${t('common.qty')}</th><th class="r">${t('mkt.avgCost')}</th>
      <th class="r">${t('mkt.last')}</th><th class="r">${t('common.value')}</th><th class="r">${t('pf.pnl')}</th>
      <th class="r">${t('pf.pnlPct')}</th><th class="r">${t('pf.stakeCol')}</th><th class="r">${t('common.dividend')}</th>
    </tr></thead><tbody>
      ${hs.map(h => `<tr class="clickable" data-sym="${h.symbol}">
        <td><div class="sym">${h.symbol}</div><div class="nm">${esc(nm({ zh: h.zh, en: h.name }))}</div></td>
        <td class="r mono">${fq(h.qty)}<div class="nm">${h.unit}</div></td>
        <td class="r mono dim">${price(h.avg)}</td>
        <td class="r mono">${price(h.price)}<div class="nm ${cls(h.change)}">${pct(h.change)}</div></td>
        <td class="r mono"><b>${money(h.value)}</b></td>
        <td class="r mono ${cls(h.pnl)}">${money(h.pnl)}</td>
        <td class="r mono ${cls(h.pnl)}">${pct(h.pnlPct)}</td>
        <td class="r mono ${h.stake >= 0.5 ? 'gold' : 'dim'}">${h.stake >= 0.0001 ? pctPlain(h.stake, 2) : '<0.01%'}</td>
        <td class="r mono ${h.monthlyDividend > 0 ? 'gold' : 'dim2'}">${h.monthlyDividend > 0 ? money(h.monthlyDividend) : '—'}</td>
      </tr>`).join('')}
    </tbody></table></div></div>`
    : `<div class="card"><div class="empty"><div class="e-ico">📉</div><h4>${t('pf.empty')}</h4><p>${t('pf.emptyHint')}</p>
        <button class="btn btn-primary" style="margin-top:16px" id="pf-go">${t('nav.market')} →</button></div></div>`}`;

    if (hs.length) donut($('#pf-donut'), byKind, 120);
    $('#pf-go') && ($('#pf-go').onclick = () => app.go('market'));
    $$('tr[data-sym]').forEach(tr => tr.onclick = () => market.openDetail(tr.dataset.sym, app));
  },
};
