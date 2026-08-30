// 人物：你长什么样，穿什么，衣柜里有什么。
import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pctPlain, int, esc, toast, keepScroll } from '../util.js';
import { avatarSVG, SKINS, HAIRCOL } from '../avatar.js';

let tab = 'wear', slotF = 'all';

const STYLE_OF = (styles, id) => styles.find(x => x.id === id);

export default {
  render(root, app) {
    const s = app.state, cat = app.catalog;
    const lk = s.look;
    const mine = s.items.filter(i => i.wearable);
    const bySlot = {};
    for (const i of mine) (bySlot[i.slot] ??= []).push(i);
    const style = lk.style ? STYLE_OF(lk.styles, lk.style) : null;

    const TABS = [
      { id: 'wear',  emoji: '🚪', label: t('person.wardrobe') },
      { id: 'look',  emoji: '🧑', label: t('person.appearance') },
    ];

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat accent"><label>👗 ${t('person.outfitScore')}</label><div class="v">${int(lk.score)}</div>
        <div class="d">${lk.worn}/5 ${t('person.piecesWorn')}</div></div>
      <div class="stat"><label>🎨 ${t('person.styleNow')}</label>
        <div class="v" style="font-size:19px">${style ? style.emoji + ' ' + esc(nm(style)) : '—'}</div>
        <div class="d">${t('person.coherence')} ${pctPlain(lk.coherence || 0, 0)}</div></div>
      <div class="stat"><label>⭐ ${t('common.prestige')}</label><div class="v gold">${int(s.player.prestige)}</div>
        <div class="d">${t('person.fromOutfit')} <b class="gold">+${int(lk.score)}</b></div></div>
      <div class="stat"><label>🚪 ${t('person.closet')}</label><div class="v">${mine.length}</div>
        <div class="d">${t('person.ofTotal', { n: cat.items.filter(i => i.wearable).length })}</div></div>
    </div>

    <div class="grid" style="grid-template-columns:320px 1fr;gap:16px;align-items:start">
      <div class="card">
        <div class="card-b" style="text-align:center;padding:18px 14px">
          <div class="avatar-wrap">${avatarSVG(lk)}</div>
          <div style="font-weight:800;font-size:15px;margin-top:6px">${esc(s.player.nickname)}</div>
          <div class="dim2" style="font-size:11.5px;margin-top:2px">${esc(s.title?.zh ? nm(s.title) : '')}</div>
          <div class="wear-strip">
            ${lk.wearSlots.map(sl => { const w = lk.slots[sl.id];
              return `<div class="ws ${w ? 'on' : ''}" title="${esc(nm(sl))}">
                <div class="e">${w ? w.emoji : sl.emoji}</div>
                <div class="n">${w ? esc(nm({ zh: w.zh, en: w.en })) : t('person.empty')}</div></div>`; }).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="ptabs" style="margin-bottom:14px">
          ${TABS.map(x => `<button class="ptab ${tab === x.id ? 'active' : ''}" data-ptab="${x.id}">${x.emoji} ${x.label}</button>`).join('')}
        </div>

        ${tab === 'wear' ? this.wardrobe(app, mine, bySlot, lk) : this.appearance(app, lk)}
      </div>
    </div>`;

    $$('[data-ptab]').forEach(b => b.onclick = () => { tab = b.dataset.ptab; this.render(root, app); });
    $$('[data-slotf]').forEach(b => b.onclick = () => { slotF = b.dataset.slotf; keepScroll(() => this.render(root, app)); });
    $$('[data-wear]').forEach(b => b.onclick = () =>
      app.act(() => api.itemAction(+b.dataset.wear, 'wear'), t('toast.success')).catch(() => {}));
    $$('[data-strip]').forEach(b => b.onclick = () =>
      app.act(() => api.itemAction(+b.dataset.strip, 'wear'), t('toast.success')).catch(() => {}));
    $$('[data-shop]').forEach(b => b.onclick = () => app.go('luxury'));
    $$('[data-g]').forEach(b => b.onclick = () => app.act(() => api.setLook({ gender: b.dataset.g })).catch(() => {}));
    $$('[data-skin]').forEach(b => b.onclick = () => app.act(() => api.setLook({ skin: +b.dataset.skin })).catch(() => {}));
    $$('[data-hair]').forEach(b => b.onclick = () => app.act(() => api.setLook({ hair: +b.dataset.hair })).catch(() => {}));
    $$('[data-hcol]').forEach(b => b.onclick = () => app.act(() => api.setLook({ haircol: +b.dataset.hcol })).catch(() => {}));
  },

  wardrobe(app, mine, bySlot, lk) {
    const slots = lk.wearSlots;
    const list = slotF === 'all' ? mine : (bySlot[slotF] || []);
    if (!mine.length) return `<div class="card"><div class="empty"><div class="e-ico">🚪</div>
      <h4>${t('person.emptyCloset')}</h4><p>${t('person.emptyClosetHint')}</p>
      <button class="btn btn-primary" style="margin-top:14px" data-shop="1">🛍️ ${t('person.goShop')}</button></div></div>`;
    return `
    <div class="card">
      <div class="card-h"><h3>🚪 ${t('person.wardrobe')}</h3>
        <div class="right"><button class="btn btn-sm btn-ghost" data-shop="1">🛍️ ${t('person.goShop')}</button></div></div>
      <div class="card-b" style="padding:12px 16px;border-bottom:1px solid var(--line)">
        <div class="chips">
          <button class="chip ${slotF === 'all' ? 'active' : ''}" data-slotf="all">${t('mkt.all')} ${mine.length}</button>
          ${slots.map(sl => `<button class="chip ${slotF === sl.id ? 'active' : ''}" data-slotf="${sl.id}">
            ${sl.emoji} ${esc(nm(sl))} ${(bySlot[sl.id] || []).length}</button>`).join('')}
        </div>
      </div>
      <div class="card-b">
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
        ${list.map(i => `<button class="wear-card ${i.worn ? 'on' : ''}" data-wear="${i.id}">
          <div class="wc-sw" style="background:${i.col};border-color:${i.col2}"></div>
          <div class="wc-b">
            <div class="wc-t">${i.emoji} ${esc(nm(i.item))}</div>
            <div class="wc-s">${money(i.value)} · ⭐ ${i.prestige}
              <span class="tag">${esc(nm(STYLE_OF(lk.styles, i.style) || {}))}</span></div>
          </div>
          <div class="wc-x">${i.worn ? '✓' : ''}</div>
        </button>`).join('')}
        </div>
      </div>
    </div>`;
  },

  appearance(app, lk) {
    const HAIRS = ['短发','寸头','长发','马尾','爆炸头','中分','稀疏','光头'];
    const HAIRS_EN = ['Short','Buzz','Long','Ponytail','Afro','Parted','Thinning','Shaved'];
    return `
    <div class="card">
      <div class="card-h"><h3>🧑 ${t('person.appearance')}</h3><span class="sub">${t('person.appearanceSub')}</span></div>
      <div class="card-b">
        <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.5px;margin-bottom:7px">${t('person.gender')}</div>
        <div class="segs" style="display:flex;margin-bottom:16px">
          ${lk.genders.map(g => `<button class="seg ${lk.gender === g.id ? 'active' : ''}" data-g="${g.id}" style="flex:1">
            ${g.emoji} ${esc(nm(g))}</button>`).join('')}
        </div>

        <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.5px;margin-bottom:7px">${t('person.skin')}</div>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          ${SKINS.map((c, i) => `<button class="sw ${lk.skin === i ? 'on' : ''}" data-skin="${i}" style="background:${c}"></button>`).join('')}
        </div>

        <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.5px;margin-bottom:7px">${t('person.hair')}</div>
        <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr));margin-bottom:14px">
          ${HAIRS.map((h, i) => `<button class="opt ${lk.hair === i ? 'active' : ''}" data-hair="${i}">
            <div class="t" style="font-size:12px">${lang === 'zh' ? h : HAIRS_EN[i]}</div></button>`).join('')}
        </div>

        <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.5px;margin-bottom:7px">${t('person.hairCol')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${HAIRCOL.map((c, i) => `<button class="sw ${lk.haircol === i ? 'on' : ''}" data-hcol="${i}" style="background:${c}"></button>`).join('')}
        </div>
      </div>
    </div>`;
  },
};
