import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, esc, durText, cls } from '../util.js';
import market from './market.js';

export default {
  async render(root, app) {
    root.innerHTML = `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`;
    let list = [];
    try { list = (await api.richlist()).list; } catch {}
    const s = app.state;
    const me = list.find(x => !x.npc) || { rank: list.length, value: s.netWorth.total };
    const top = list[0];
    const gap = top ? top.value - me.value : 0;
    const target = list[Math.max(0, me.rank - 2)] || top;
    const medal = i => ['🥇', '🥈', '🥉'][i] || `<span class="mono dim2">${i + 1}</span>`;

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat c1"><label>👑 ${t('rich.rank')}</label><div class="v">#${me.rank}</div><div class="d">/ ${list.length}</div></div>
      <div class="stat c2 accent"><label>💎 ${t('common.netWorth')}</label><div class="v">${money(s.netWorth.total)}</div>
        <div class="d">${s.title.icon} ${esc(nm(s.title))}</div></div>
      <div class="stat c4"><label>🎯 ${t('rich.chase')}</label><div class="v" style="font-size:19px">${target && target.npc ? esc(nm({ zh: target.zh, en: target.en })) : '—'}</div>
        <div class="d">${target ? money(target.value - me.value) + ' ' + t('rich.gap') : ''}</div></div>
      <div class="stat c5"><label>🏔️ ${t('rich.gap')}</label><div class="v">${money(gap)}</div>
        <div class="d">${top ? esc(nm({ zh: top.zh, en: top.en })) : ''}</div></div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🏆 ${t('rich.title')}</h3><span class="sub">${t('rich.hint')}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th class="c" style="width:64px">${t('rich.rank')}</th>
        <th>${t('rich.person')}</th>
        <th>${t('rich.source')}</th>
        <th class="r">${t('rich.stake')}</th>
        <th class="r">${t('rich.equity')}</th>
        <th class="r">${t('rich.other')}</th>
        <th class="r">${t('rich.wealth')}</th>
      </tr></thead><tbody>
        ${list.map((r, i) => `<tr class="${r.npc ? 'clickable' : ''}" ${r.symbol ? `data-sym="${r.symbol}"` : ''}
            ${!r.npc ? 'style="background:linear-gradient(90deg,var(--glow3),transparent)"' : ''}>
          <td class="c" style="font-size:16px">${medal(i)}</td>
          <td><div style="display:flex;align-items:center;gap:9px">
            <span style="font-size:18px">${r.emoji}</span>
            <div><b>${esc(nm({ zh: r.zh, en: r.en }))}</b>${!r.npc ? ` <span class="tag y">${t('rich.you')}</span>` : ''}
              ${r.bio ? `<div class="nm">${esc(nm(r.bio))}</div>` : ''}</div></div></td>
          <td>${r.company ? `<span class="sym">${r.symbol}</span> <span class="dim" style="font-size:11.5px">${esc(nm(r.company))}</span>` : '<span class="dim2">—</span>'}</td>
          <td class="r mono dim">${r.stake ? pctPlain(r.stake, 1) : '—'}</td>
          <td class="r mono">${r.equity != null ? money(r.equity) : '—'}</td>
          <td class="r mono dim">${r.other != null ? money(r.other) : '—'}</td>
          <td class="r mono" style="font-weight:800;font-size:14px">${money(r.value)}</td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>`;
    $$('tr[data-sym]').forEach(tr => tr.onclick = () => market.openDetail(tr.dataset.sym, app));
  },
};
