import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, price, pct, pctPlain, cls, arrow, esc, durText, hoursAgo, renderLedger, newsLine, gShort, toast, realPace } from '../util.js';
import { PriceChart, donut, sparkline } from '../chart.js';

let chart = null, sparks = null;

const COLORS = ['#f5b942', '#4d8bf5', '#16c784', '#a78bfa', '#22d3ee', '#fb923c'];

function statCard(label, value, sub, opts = {}) {
  return `<div class="stat ${opts.accent ? 'accent' : ''} ${opts.c || ''}">
    <label>${opts.icon || ''} ${label}</label>
    <div class="v ${opts.cls || ''}" ${opts.id ? `id="${opts.id}"` : ''}>${value}</div>
    <div class="d">${sub}</div></div>`;
}

export default {
  render(root, app) {
    const s = app.state, nw = s.netWorth;
    const segs = [
      { k: 'cash', label: t('common.cash'), v: nw.cash, color: COLORS[0] },
      { k: 'bank', label: t('common.bank') + '+' + t('common.deposit'), v: nw.bank + nw.deposits, color: COLORS[1] },
      { k: 'pf', label: t('dash.portfolioValue'), v: nw.portfolio, color: COLORS[2] },
      { k: 'biz', label: t('dash.bizValue'), v: nw.business, color: COLORS[3] },
      { k: 'item', label: t('dash.itemValue'), v: nw.items, color: COLORS[4] },
    ];
    const dayNet = nw.bizNetPerHour * 24;

    const showHustle = nw.total < 250_000;
    root.innerHTML = `
    <div class="card" style="margin-bottom:14px"><div class="card-b" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:12px 18px">
      <div class="regime-chip regime-${s.macro.id}">${s.macro.emoji} ${esc(nm({ zh: s.macro.zh, en: s.macro.en }))}</div>
      <div class="dim2" style="font-size:11.5px">${t('macro.policy')} <b class="mono gold">${pctPlain(s.macro.policyRate)}</b></div>
      <div class="dim2" style="font-size:11.5px">${t('mkt.marketIndex')} <b class="mono ${cls(s.index.change)}">${s.index.level.toFixed(1)} ${pct(s.index.change)}</b></div>
      <div class="dim2" style="font-size:11.5px">${t('dash.played')} <b class="mono">${durText(s.player.playedHours)}</b></div>
      <div class="dim2" style="margin-left:auto;font-size:11.5px">🕒 ${s.now.date.text}</div>
    </div></div>

    ${showHustle ? `<div class="grid" style="grid-template-columns:1fr 1.6fr;margin-bottom:16px">
      <div class="hustle-card">
        <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px">
          <div class="ico" style="font-size:20px">${s.job.current ? s.job.current.emoji : '🧳'}</div>
          <div><div class="dim2" style="font-size:10.5px;font-weight:700">${t('career.current')}</div>
            <div style="font-weight:800;font-size:15px">${s.job.current ? esc(nm({ zh: s.job.current.zh, en: s.job.current.en })) : t('career.resting')}</div></div>
          <div style="margin-left:auto;text-align:right"><b class="mono gold" style="font-size:15px">${money(s.job.current ? s.job.current.wage : 0)}</b>
            <div class="tc-phase ${s.job.phase}" style="font-size:10px">${t('phase.' + s.job.phase)}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="dim2" style="font-size:10.5px;font-weight:700">${t('career.stamina')}</span>
          <div class="bar thin" style="flex:1"><i style="width:${s.job.stamina}%;background:${s.job.stamina >= 60 ? 'var(--up)' : s.job.stamina >= 25 ? 'var(--gold)' : 'var(--down)'}"></i></div>
          <b class="mono" style="font-size:11px">${Math.round(s.job.stamina)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:9px">
          <span class="dim2">${t('career.otToday')} <b class="mono">${s.job.otUsed}/${s.job.otMax}</b></span>
          <span class="dim2">${t('career.efficiency')} <b class="mono">${pctPlain(s.job.efficiency, 0)}</b></span>
        </div>
        <button class="hustle-btn" id="d-hustle" ${s.job.canOvertime ? '' : 'disabled'}>
          <span id="d-hb-label">${s.job.canOvertime ? `${s.job.night ? '🌙' : '💪'} ${s.job.night ? t('career.nightShift') : t('career.otStart')} · +${money(s.job.otPay)}`
            : s.job.otBusy ? `⏳ ${t('career.otWorking')}` : `🚫 ${t('career.otBlock.' + s.job.otBlock)}`}</span>
          <span class="cd" id="d-hb-cd" style="width:0%"></span></button>
        <div class="dim2" style="font-size:11px;margin-top:9px;line-height:1.6">${t('career.startHint')}</div>
      </div>
      <div class="card"><div class="card-h"><h3>🧭 ${t('career.jobList')}</h3>
        <div class="right"><button class="btn btn-xs btn-ghost" id="d-go-career">${t('nav.career')} →</button></div></div>
        <div class="card-b" style="padding:10px 16px">
          ${s.job.list.filter(x => x.unlocked).slice(-3).reverse().map(x => `<div class="news-item">
            <span style="font-size:16px">${x.emoji}</span>
            <span style="flex:1">${esc(nm({ zh: x.zh, en: x.en }))}${x.current ? ` <span class="tag y">${t('career.current2')}</span>` : ''}</span>
            <b class="mono gold">${money(x.wage)}${t('common.perHour')}</b></div>`).join('')}
          <div class="news-item"><span class="dim2" style="font-size:11.5px;line-height:1.6">${t('career.carHint')}</span></div>
        </div></div>
    </div>` : ''}

    <div class="grid g4" style="margin-bottom:16px">
      ${statCard(t('dash.total'), `<span id="d-nw">${money(nw.total)}</span>`,
        `<span class="dim2">${t('dash.peak')} ${money(s.player.peak)}</span> · <span class="tag y">${s.title.icon} ${nm(s.title)}</span>`, { accent: true, icon: '💎', c: 'c1' })}
      ${statCard(t('common.cash'), `<span id="d-cash" class="${s.player.cash < 0 ? 'down' : ''}">${money(s.player.cash)}</span>`,
        `${t('common.bank')} ${money(s.player.bank)} · ${t('common.deposit')} ${money(nw.deposits)}`, { icon: '💵', c: 'c2' })}
      ${statCard(t('dash.perHourNet'), `<span id="d-bizh" class="${cls(nw.bizNetPerHour)}">${money(nw.bizNetPerHour)}</span>`,
        `${t('dash.perDayNet')} <b class="${cls(dayNet)}">${money(dayNet)}</b> · ${nw.counts.biz} ${t('biz.owned')}`, { icon: '🏬', c: 'c3' })}
      ${statCard(t('common.debt'), `<span id="d-debt" class="${nw.debt > 0 ? 'down' : 'dim'}">${money(nw.debt)}</span>`,
        `${t('dash.creditLine')} ${money(s.bank.creditLimit)} · ${t('common.credit')} ${s.player.creditScore}`, { icon: '🏦', c: 'c5' })}
    </div>

    ${s.player.cash < 0 ? `<div class="card" style="border-color:#5a2530;margin-bottom:16px"><div class="card-b" style="color:#ff8b9c;padding:12px 18px">${t('bank.overdraftWarn')}</div></div>` : ''}

    <div class="grid" style="grid-template-columns:1.9fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>${t('dash.trend')}</h3>
          <div class="right"><span class="sub">${t('dash.hint', { m: realPace(app.state.now.realMsPerHour) })}</span></div></div>
        <div class="card-b" style="padding:8px 12px 4px"><div id="nw-chart" style="height:230px"></div></div>
      </div>
      <div class="card">
        <div class="card-h"><h3>${t('dash.breakdown')}</h3></div>
        <div class="card-b" style="display:flex;gap:18px;align-items:center">
          <canvas id="nw-donut" style="flex-shrink:0"></canvas>
          <div style="flex:1;min-width:0">
            ${segs.map(x => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
              <i style="width:9px;height:9px;border-radius:3px;background:${x.color};flex-shrink:0"></i>
              <span class="dim" style="flex:1">${x.label}</span>
              <b class="mono">${money(x.v)}</b>
              <span class="dim2 mono" style="width:42px;text-align:right">${nw.total > 0 ? pctPlain(Math.max(0, x.v) / segs.reduce((a, b) => a + Math.max(0, b.v), 0), 0) : '-'}</span>
            </div>`).join('')}
            ${nw.debt > 0 ? `<div style="display:flex;align-items:center;gap:8px;padding:6px 0 0;margin-top:4px;border-top:1px solid var(--line);font-size:12px">
              <i style="width:9px;height:9px;border-radius:3px;background:var(--down);flex-shrink:0"></i>
              <span class="dim" style="flex:1">${t('dash.liabilities')}</span><b class="mono down">-${money(nw.debt)}</b></div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>📰 ${t('dash.news')}</h3></div>
        <div class="card-b" style="padding:6px 18px;max-height:290px;overflow:auto" id="news-list">
          ${s.news.length ? s.news.map(n => `<div class="news-item">
            <span class="news-time">${gShort(n.hour).split(' ')[0]}</span>
            <i class="news-dot" style="background:${n.impact >= 0 ? 'var(--up)' : 'var(--down)'}"></i>
            <span style="flex:1">${newsLine(n.headline)}
              <span class="dim2 mono" style="font-size:10.5px">${pct(n.impact)}</span></span>
          </div>`).join('') : `<div class="empty"><p>${t('dash.noNews')}</p></div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>🧾 ${t('dash.recent')}</h3>
          <div class="right"><button class="btn btn-xs btn-ghost" id="go-ledger">${t('led.title')} →</button></div></div>
        <div class="card-b" style="padding:6px 18px;max-height:290px;overflow:auto">
          ${s.ledger.slice(0, 14).map(l => `<div class="news-item">
            <span class="news-time">${gShort(l.hour).split(' ')[0]}</span>
            <span style="flex-shrink:0">${l.icon || ''}</span>
            <span style="flex:1">${renderLedger(l.detail)}</span>
            ${l.amount ? `<b class="mono ${cls(l.amount)}" style="flex-shrink:0">${l.amount > 0 ? '+' : ''}${money(l.amount)}</b>` : ''}
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🏘️ ${t('dash.indices')}</h3><div class="right"><span class="sub">${t('lux.indexHint')}</span></div></div>
      <div class="card-b">
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:11px">
          ${s.indices.map(ix => `<div class="stat" style="padding:12px 14px">
            <label>${esc(nm({ zh: ix.zh, en: ix.name }))}</label>
            <div style="display:flex;align-items:flex-end;gap:9px;margin-top:6px">
              <div class="v mono" style="font-size:19px">${ix.price.toFixed(1)}</div>
              <div class="${cls(ix.change)}" style="font-size:12px;font-weight:700;padding-bottom:3px">${arrow(ix.change)} ${pct(ix.change)}</div>
            </div>
            <canvas class="spark idx-spark" data-sym="${ix.symbol}" style="margin-top:6px;width:100%;height:30px"></canvas>
          </div>`).join('')}
        </div>
      </div>
    </div>`;

    $('#go-ledger').onclick = () => app.go('ledger');
    $('#d-go-career') && ($('#d-go-career').onclick = () => app.go('career'));
    const hb = $('#d-hustle');
    if (hb) hb.onclick = async () => {
      hb.disabled = true;
      try {
        const r = await api.hustle();
        const pop = document.createElement('div');
        pop.className = 'coin-pop'; pop.textContent = '⏳ ' + money(r.pay);
        pop.style.left = '50%'; pop.style.top = '40%';
        hb.parentElement.appendChild(pop);
        setTimeout(() => pop.remove(), 900);
        await app.refresh(true);
      } catch (e) { toast(e.message.split(' / ')[0], 'err'); hb.disabled = false; }
    };
  },

  async loadSparks() {
    try {
      if (!sparks) sparks = (await api.sparks()).spark;
      $$('.idx-spark').forEach(c => {
        const d = sparks[c.dataset.sym];
        if (d) sparkline(c, d, c.offsetWidth || 160, 30);
      });
    } catch {}
  },

  patch(app) {
    const s = app.state, nw = s.netWorth;
    const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
    set('d-nw', money(nw.total));
    set('d-cash', money(s.player.cash));
    set('d-bizh', money(nw.bizNetPerHour));
    set('d-debt', money(nw.debt));
    if (chart) chart.setData((s.nwHistory || []).map(p => ({ hour: p.hour, price: p.value })));
    const nl = $('#news-list');
    if (nl && s.news.length) {
      nl.innerHTML = s.news.map(n => `<div class="news-item">
        <span class="news-time">${gShort(n.hour).split(' ')[0]}</span>
        <i class="news-dot" style="background:${n.impact >= 0 ? 'var(--up)' : 'var(--down)'}"></i>
        <span style="flex:1">${newsLine(n.headline)} <span class="dim2 mono" style="font-size:10.5px">${pct(n.impact)}</span></span>
      </div>`).join('');
    }
    sparks = null;
    this.loadSparks();
  },
};
