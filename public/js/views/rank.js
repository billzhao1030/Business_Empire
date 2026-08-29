import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, esc, durText, cls } from '../util.js';
import market from './market.js';

let tab = 'rich', impact = null, board = null, page = 0;
const PAGE = 60;

export default {
  async render(root, app) {
    root.innerHTML = `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`;
    let list = [];
    try { const r = await api.richlist(); list = r.list; impact = r.impact; } catch {}
    if (tab === 'co' && !board) { try { board = await api.companyBoard(); } catch { board = null; } }
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

    ${this.impactCard(impact)}

    <div class="ptabs" style="margin-bottom:14px">
      <button class="ptab ${tab === 'rich' ? 'active' : ''}" data-rtab="rich">
        <span class="e">🏆</span><span>${t('rich.title')}</span><span class="b">${list.length}</span></button>
      <button class="ptab ${tab === 'co' ? 'active' : ''}" data-rtab="co">
        <span class="e">🏢</span><span>${t('rich.coBoard')}</span>${board ? `<span class="b">${board.total}</span>` : ''}</button>
    </div>

    ${tab === 'co' ? this.coBoard(board, s) : `
    <div class="card">
      <div class="card-h"><h3>🏆 ${t('rich.title')}</h3><span class="sub">${t('rich.hint')}</span>
        <div class="right"><span class="dim2" style="font-size:11px">${t('rich.showing', {
          a: page * PAGE + 1, b: Math.min(list.length, (page + 1) * PAGE), n: list.length })}</span></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th class="c" style="width:64px">${t('rich.rank')}</th>
        <th>${t('rich.person')}</th>
        <th>${t('rich.source')}</th>
        <th class="r">${t('rich.stake')}</th>
        <th class="r">${t('rich.equity')}</th>
        <th class="r">${t('rich.other')}</th>
        <th class="r">${t('rich.wealth')}</th>
      </tr></thead><tbody>
        ${list.map((r, i) => [r, i]).filter(([r, i]) => (i >= page * PAGE && i < (page + 1) * PAGE) || !r.npc)
          .map(([r, i]) => `<tr class="${r.npc ? 'clickable' : ''}" ${r.symbol ? `data-sym="${r.symbol}"` : ''}
            ${!r.npc ? 'style="background:linear-gradient(90deg,var(--glow3),transparent)"' : ''}>
          <td class="c" style="font-size:16px">${medal(i)}</td>
          <td><div style="display:flex;align-items:center;gap:9px">
            <span style="font-size:18px">${r.emoji}</span>
            <div><b>${esc(nm({ zh: r.zh, en: r.en }))}</b>${!r.npc ? ` <span class="tag y">${t('rich.you')}</span>` : ''}
              ${r.bio ? `<div class="nm">${esc(nm(r.bio))}</div>` : ''}</div></div></td>
          <td>${r.company ? `<span class="sym">${r.symbol}</span> <span class="dim" style="font-size:11.5px">${esc(nm(r.company))}</span>` : '<span class="dim2">—</span>'}</td>
          <td class="r mono dim">${r.stake ? pctPlain(r.stake, 1) : '—'}${
            r.yourStake > 0.001 ? `<div class="nm ${r.takenOver ? 'down' : 'gold'}">${
              r.takenOver ? t('rich.takenOver') : t('rich.youHold', { p: pctPlain(r.yourStake, 1) })}</div>` : ''}</td>
          <td class="r mono">${r.equity != null ? money(r.equity) : '—'}</td>
          <td class="r mono dim">${r.other != null ? money(r.other) : '—'}</td>
          <td class="r mono" style="font-weight:800;font-size:14px">${money(r.value)}</td>
        </tr>`).join('')}
      </tbody></table></div>
      <div class="card-b" style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-xs" id="rk-prev" ${page ? '' : 'disabled'}>← ${t('rich.prev')}</button>
        <span class="dim2" style="font-size:11.5px;align-self:center">${page + 1} / ${Math.ceil(list.length / PAGE)}</span>
        <button class="btn btn-xs" id="rk-next" ${(page + 1) * PAGE >= list.length ? 'disabled' : ''}>${t('rich.next')} →</button>
      </div>
    </div>`}`;
    $$('tr[data-sym]').forEach(tr => tr.onclick = () => market.openDetail(tr.dataset.sym, app));
    $$('[data-rtab]').forEach(b => b.onclick = () => { tab = b.dataset.rtab; this.render(root, app); });
    $('#rk-prev') && ($('#rk-prev').onclick = () => { page = Math.max(0, page - 1); this.render(root, app); });
    $('#rk-next') && ($('#rk-next').onclick = () => { page++; this.render(root, app); });
  },

  // ── 你对这个世界做了什么 ──────────────────────────────────
  impactCard(im) {
    if (!im || (!im.pressure.length && !im.stakes.length)) return '';
    return `<div class="card" style="margin-bottom:16px;border-color:rgba(245,185,66,.35)">
      <div class="card-h"><h3>⚔️ ${t('rich.impact')}</h3><span class="sub">${t('rich.impactSub')}</span></div>
      <div class="card-b">
        ${im.pressure.length ? `<div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:7px">${t('rich.squeeze')}</div>
        ${im.pressure.map(p => `<div class="summary" style="margin-bottom:8px">
          <div><span>${esc(p.sector)} · ${esc(p.names.join(' / '))}</span>
            <span class="mono gold">${t('rich.shareOf', { p: pctPlain(p.share, 1) })}</span></div>
          <div><span>${t('rich.dragging')}</span><span class="mono down">−${pctPlain(p.annualDrag, 1)}/${t('common.year')}</span></div>
          <div class="tot"><span>${t('rich.taken')}</span><span class="mono down">${money(p.removed)}</span></div>
          ${p.hitting.length ? `<div><span class="dim2">${t('rich.hitting')}</span>
            <span class="dim2">${p.hitting.map(h => esc(nm(h))).join('、')}</span></div>` : ''}
        </div>`).join('')}` : ''}
        ${im.stakes.length ? `<div class="dim2" style="font-size:10.5px;font-weight:700;margin:12px 0 7px">${t('rich.viaStake')}</div>
        <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
          ${im.stakes.map(x => `<div class="opt" style="cursor:default">
            <div class="t">${esc(nm({ zh: x.zh, en: x.en }))}</div>
            <div class="s">${esc(nm(x.company))} · ${x.takenOver
              ? `<b class="down">${t('rich.takenOver')}</b>`
              : `${t('rich.youHold', { p: pctPlain(x.yourStake, 1) })}`}</div></div>`).join('')}
        </div>` : ''}
        <div class="dim2" style="font-size:10.5px;line-height:1.7;margin-top:10px">${t('rich.impactHint')}</div>
      </div></div>`;
  },

  // ── 公司榜 ────────────────────────────────────────────────
  coBoard(b, s) {
    if (!b) return `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`;
    const mine = b.rows.filter(r => r.mine);
    const show = b.rows.filter((r, i) => i < 80 || r.mine);
    return `<div class="card">
      <div class="card-h"><h3>🏢 ${t('rich.coBoard')}</h3><span class="sub">${t('rich.coBoardSub', { n: b.total })}</span>
        ${mine.length ? `<div class="right"><span class="tag y">${t('rich.yourBest', { n: mine[0].rank })}</span></div>` : ''}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th class="c" style="width:60px">#</th><th>${t('rich.company')}</th><th>${t('common.sector')}</th>
        <th class="r">${t('co.marketCap')}</th><th class="r">${t('co.peRatio')}</th><th class="r">${t('common.change')}</th>
      </tr></thead><tbody>
        ${show.map(r => `<tr class="${r.listed ? 'clickable' : ''}" ${r.listed ? `data-sym="${r.symbol}"` : ''}
            ${r.mine ? 'style="background:linear-gradient(90deg,var(--glow3),transparent)"' : ''}>
          <td class="c mono dim2">${r.rank}</td>
          <td><b>${esc(nm({ zh: r.zh, en: r.en }))}</b>
            ${r.mine ? ` <span class="tag y">${t('rich.you')}</span>` : ''}
            ${!r.listed ? ` <span class="tag">${t('rich.unlisted')}</span>` : ''}
            <span class="sym" style="margin-left:5px">${r.symbol}</span></td>
          <td class="dim" style="font-size:11.5px">${esc(r.sector)}</td>
          <td class="r mono" style="font-weight:800">${money(r.cap)}</td>
          <td class="r mono dim">${r.pe ? r.pe.toFixed(1) : '—'}</td>
          <td class="r mono ${cls(r.change)}">${r.listed ? pct(r.change) : '—'}</td>
        </tr>`).join('')}
      </tbody></table></div></div>`;
  },
};
