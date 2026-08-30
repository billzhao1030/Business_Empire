// 人物：你长什么样，穿什么，衣柜里有什么。
import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pctPlain, int, esc, toast, modal, keepScroll } from '../util.js';
import { avatarSVG, SKINS, HAIRCOL } from '../avatar.js';
import { Avatar3D } from '../avatar3d.js';

let tab = 'wear', slotF = 'all';
let use3D = (localStorage.getItem('be_avatar3d') ?? '1') === '1';
let av3d = null;   // WebGL 人物，只在需要的时候建一次

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
      { id: 'attr',  emoji: '📊', label: t('person.attrs') },
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
          <div class="avatar-wrap${use3D ? ' is3d' : ''}">
            ${use3D ? `<canvas id="av3d"></canvas>
              <div class="av-hint">${t('person.dragHint')}</div>` : avatarSVG(lk)}
          </div>
          <div class="segs" style="display:flex;margin-top:9px">
            <button class="seg ${use3D ? 'active' : ''}" data-dim="3">🧍 ${t('person.d3')}</button>
            <button class="seg ${!use3D ? 'active' : ''}" data-dim="2">🖼️ ${t('person.d2')}</button>
          </div>
          <div style="font-weight:800;font-size:15px;margin-top:9px">${esc(s.player.nickname)}
            <button class="btn btn-xs btn-ghost" id="p-rename" title="${t('person.rename')}">✏️</button></div>
          <div class="dim2" style="font-size:11.5px;margin-top:2px">${esc(s.title?.zh ? nm(s.title) : '')}
            ${s.player.username ? `· @${esc(s.player.username)}` : ''}</div>
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

        ${tab === 'wear' ? this.wardrobe(app, mine, bySlot, lk)
          : tab === 'attr' ? this.attrPanel(app) : this.appearance(app, lk)}
      </div>
    </div>`;

    // 3D 人物：视图重绘会换掉画布，所以每次都重新接管一次
    if (use3D) {
      const cv = $('#av3d');
      if (cv) {
        try {
          if (av3d) av3d.dispose();
          av3d = new Avatar3D(cv);
          av3d.build(lk);
          if (typeof window !== 'undefined') window.__av = av3d;   // 供自动化测试固定视角
        } catch (e) {
          av3d = null; use3D = false;            // 显卡不给力就退回 2D，别让页面开天窗
          localStorage.setItem('be_avatar3d', '0');
          return this.render(root, app);
        }
      }
    } else if (av3d) { av3d.dispose(); av3d = null; }

    $$('[data-dim]').forEach(b => b.onclick = () => {
      use3D = b.dataset.dim === '3';
      localStorage.setItem('be_avatar3d', use3D ? '1' : '0');
      this.render(root, app);
    });
    $('#p-rename') && ($('#p-rename').onclick = () => this.renameModal(app));
    $('#at-go') && ($('#at-go').onclick = () => app.go('career'));
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

  // ── 属性：三条自己养出来的能力，各自在给你什么 ────────────
  // 一条属性只有能换成钱、换成机会，摆在这儿才有意义。所以每一行下面
  // 都直接写清楚它此刻正在做什么，而不是一个孤零零的数字。
  attrPanel(app) {
    const a = app.state.attrs, e = a.eff, s = app.state;
    const pctS = (v, d = 0) => (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
    // [emoji, 名字, 当前值, 上限, 颜色, 每日衰减, 说明, 效果行, 怎么涨]
    const rows = [
      { e: '📚', k: 'knowledge', v: a.knowledge, col: 'var(--blue)', decay: 0,
        eff: [[t('attr.effWage'), pctS(e.wage, 1)], [t('attr.effExp'), pctS(e.exp, 1)], [t('attr.effBiz'), pctS(e.biz, 1)]] },
      { e: '🍀', k: 'luck', v: a.luck, col: 'var(--up)', decay: a.decay.luck,
        eff: [[t('attr.effLotto'), pctS(e.lotto, 1)], [t('attr.effGood'), pctS(e.good, 1)], [t('attr.effSick'), '−' + (e.sick * 100).toFixed(1) + '%']] },
      { e: '✨', k: 'charm', v: a.charm, col: 'var(--gold)', decay: a.decay.charm,
        eff: [[t('attr.effRound'), pctS(e.round, 1)], [t('attr.effPrestige'), pctS(e.prestige, 1)], [t('attr.effOutfit'), pctS(e.outfit, 1)]] },
    ];
    // 身上带着的、不是靠消遣涨出来的那几条，单独摆一排
    const others = [
      { e: '🔋', label: t('attr.stamina'), v: int(a.stamina), max: 100, d: t('attr.staminaHint') },
      { e: '😮‍💨', label: t('attr.stress'), v: int(a.stress), max: 100, d: t('attr.stressHint') },
      { e: '⭐', label: t('common.prestige'), v: int(a.prestige), d: t('attr.prestigeHint') },
      { e: '💳', label: t('attr.credit'), v: int(s.player.creditScore), d: t('attr.creditHint') },
    ];
    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-h"><h3>📊 ${t('person.attrs')}</h3><span class="sub">${t('attr.sub')}</span></div>
      <div class="card-b">
        ${rows.map(r => `
          <div style="margin-bottom:16px">
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
              <span style="font-size:15px">${r.e}</span>
              <b style="font-size:13.5px">${t('attr.' + r.k)}</b>
              <span class="dim2" style="font-size:11px;flex:1">${t('attr.' + r.k + 'Desc')}</span>
              <span class="mono" style="font-size:15px;font-weight:800;color:${r.col}">${r.v.toFixed(1)}</span>
              <span class="dim2" style="font-size:11px">/ ${a.max}</span>
            </div>
            <div class="bar" style="height:7px;background:var(--line);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${Math.min(100, r.v / a.max * 100)}%;background:${r.col};transition:width .3s"></div>
            </div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:7px;font-size:11.5px">
              ${r.eff.map(([k, v]) => `<span class="dim2">${k} <b class="mono" style="color:${r.col}">${v}</b></span>`).join('')}
              ${r.decay ? `<span class="dim2" style="margin-left:auto">${t('attr.decay', { n: r.decay })}</span>`
                        : `<span class="dim2" style="margin-left:auto">${t('attr.noDecay')}</span>`}
            </div>
          </div>`).join('')}
        <div class="dim2" style="font-size:10.5px;line-height:1.7;border-top:1px solid var(--line);padding-top:11px">
          ${t('attr.note')}</div>
        <button class="btn btn-primary btn-block" id="at-go" style="margin-top:11px">🎯 ${t('attr.goTrain')}</button>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🧍 ${t('attr.stateNow')}</h3><span class="sub">${t('attr.stateSub')}</span></div>
      <div class="card-b"><div class="grid g4" style="gap:11px">
        ${others.map(o => `<div class="stat" style="padding:12px 14px">
          <label>${o.e} ${o.label}</label>
          <div class="v mono" style="font-size:19px">${o.v}${o.max ? `<span class="dim2" style="font-size:12px;font-weight:400"> / ${o.max}</span>` : ''}</div>
          <div class="d">${o.d}</div></div>`).join('')}
      </div></div>
    </div>`;
  },

  // 改名：昵称和登录用户名都能改
  renameModal(app) {
    const p = app.state.player;
    modal({
      title: t('person.rename'), icon: '✏️',
      body: `
        <label class="field"><span>${t('person.nickname')}</span>
          <input id="rn-nick" maxlength="16" value="${esc(p.nickname || '')}"></label>
        <label class="field"><span>${t('person.username')}
          <span class="dim2" style="font-weight:400">${t('person.usernameHint')}</span></span>
          <input id="rn-user" maxlength="16" value="${esc(p.username || '')}"></label>
        <p class="dim2" style="font-size:11px;line-height:1.6;margin-top:4px">${t('person.renameNote')}</p>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button>
               <button class="btn btn-primary" id="rn-go">${t('common.confirm')}</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#rn-go').onclick = async () => {
          const nick = el.querySelector('#rn-nick').value.trim();
          const user = el.querySelector('#rn-user').value.trim();
          try {
            await api.renameMe({ nickname: nick,
              username: user && user !== p.username ? user : undefined });
            close(); toast(t('toast.success'), 'ok'); await app.refresh(true);
          } catch (e) { toast(e.message.split(' / ')[0], 'err'); }
        };
      },
    });
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
