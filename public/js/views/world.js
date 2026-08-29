import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast, durText, gDate } from '../util.js';
import { drawWorld } from '../worldmap.js';

let data = null, selected = null, hovered = null, nights = 5, cabin = 'economy', hotel = 'std', regionF = '';

export default {
  async render(root, app) {
    if (!data) { try { data = await api.world(); } catch { data = null; } }
    if (!data) { root.innerHTML = `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`; return; }
    const s = app.state, fp = data.footprint;
    const visited = Object.fromEntries(data.places.filter(p => p.visit).map(p => [p.id, p.visit]));
    const list = data.places.filter(p => !regionF || p.region === regionF);
    const sel = data.places.find(p => p.id === selected);
    const away = s.health.trip;

    root.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
      <div class="stat c5"><label>🏠 ${t('birth.home')}</label><div class="v" style="font-size:20px">${data.home.flag} ${esc(nm(data.home))}</div>
        <div class="d">${esc(nm({ zh: data.home.country, en: data.home.countryEn }))}</div></div>
      <div class="stat c3"><label>🗺️ ${t('world.placesVisited')}</label><div class="v">${fp.places} <span class="dim2" style="font-size:15px">/ ${fp.total}</span></div>
        <div class="d">${t('world.countries')} ${fp.countries} / ${fp.totalCountries}</div></div>
      <div class="stat c2"><label>🧳 ${t('world.trips')}</label><div class="v">${fp.trips}</div><div class="d">${t('world.nights')} ${fp.nights}</div></div>
      <div class="stat c1"><label>💸 ${t('world.spent')}</label><div class="v">${money(fp.spent)}</div><div class="d">${t('world.spentHint')}</div></div>
      <div class="stat c4"><label>🌏 ${t('world.regions')}</label><div class="v">${fp.regions} / ${fp.totalRegions}</div>
        <div class="d">${data.regions.filter(r => fp.list.some(x => x.region === r.id)).map(r => r.emoji).join(' ') || '—'}</div></div>
    </div>

    ${away ? `<div class="card" style="margin-bottom:16px;border-color:var(--cyan)"><div class="card-b" style="display:flex;gap:12px;align-items:center">
      <span style="font-size:26px">${away.emoji}</span>
      <div style="flex:1"><b style="font-size:15px">${t('life.traveling')} · ${esc(nm({ zh: away.zh, en: away.en }))}</b>
        <div class="dim" style="font-size:12px">${t('world.cannotWork')}</div></div>
      <b class="mono" style="color:var(--cyan)">${t('life.tripBack')} ${(away.hoursLeft / 24).toFixed(1)}${t('common.day')}</b>
    </div></div>` : ''}

    <div class="card" style="margin-bottom:16px">
      <div class="card-h"><h3>🗺️ ${t('world.title')}</h3>
        <span class="sub">${t('world.hint', { home: nm({ zh: data.home.zh, en: data.home.en }) })}</span></div>
      <div class="card-b" style="padding:12px"><div style="position:relative"><canvas id="wmap" style="display:block;cursor:pointer"></canvas></div></div>
    </div>

    <div class="grid" style="grid-template-columns:1.35fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>✈️ ${t('world.destinations')}</h3>
          <div class="right"><div class="chips">
            <button class="chip ${!regionF ? 'active' : ''}" data-reg="">${t('mkt.all')}</button>
            ${data.regions.map(r => `<button class="chip ${regionF === r.id ? 'active' : ''}" data-reg="${r.id}">${r.emoji} ${esc(nm(r))}</button>`).join('')}
          </div></div></div>
        <div style="max-height:460px;overflow:auto">
          ${list.map(p => `<div class="item-row clickable ${p.id === selected ? 'sel' : ''}" data-dest="${p.id}" style="cursor:pointer">
            <div class="ico">${p.flag}</div>
            <div class="i-main">
              <div class="i-title">${esc(nm(p))}
                ${p.visit ? `<span class="tag g">✓ ${t('world.been', { n: p.visit.times })}</span>` : ''}
                <span class="dim2" style="font-weight:400;font-size:11px">${esc(nm({ zh: p.country, en: p.countryEn }))}</span></div>
              <div class="i-sub">
                <span>${int(p.km)} km</span>
                <span>✈️ ${p.hours}h</span>
                <span>🏨 ${money(p.hotel)}/${t('world.night')}</span>
                <span class="up">😌 -${p.relief}/${t('world.night')}</span>
              </div>
            </div>
            <div class="i-act"><b class="mono">${money(p.flight)}</b></div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>🎫 ${t('world.book')}</h3></div>
        <div class="card-b">
          ${!sel ? `<div class="empty" style="padding:36px 12px"><div class="e-ico">🗺️</div><p>${t('world.pick')}</p></div>` : (() => {
            const c = data.cabins.find(x => x.id === cabin) || data.cabins[0];
            const ht = data.hotels.find(x => x.id === hotel) || data.hotels[1];
            const n = Math.max(sel.minNights || 1, nights);
            const air = Math.round(sel.flight * (c.mult || 0));
            const stay = Math.round(sel.hotel * ht.mult * n);
            const daily = Math.round(sel.spend * n * (ht.mult > 1 ? 1.3 : 1));
            const total = air + stay + daily;
            const hours = Math.round(sel.hours * 2 + n * 24);
            const relief = Math.min(100, Math.round(sel.relief * n * c.relief * ht.relief * 0.55));
            const prestige = Math.round(sel.prestige * c.prestige * ht.prestige);
            const afford = s.player.cash >= total && !away && !s.health.sick;
            return `
            <div style="display:flex;gap:11px;align-items:center;margin-bottom:10px">
              <span style="font-size:28px">${sel.flag}</span>
              <div><b style="font-size:16px">${esc(nm(sel))}</b>
                <div class="dim2" style="font-size:11.5px">${esc(nm({ zh: sel.country, en: sel.countryEn }))} · ${int(sel.km)} km · ${t('world.flightTime')} ${sel.hours}h</div></div>
            </div>
            <p class="dim2" style="font-size:11.5px;line-height:1.6;margin-bottom:12px">${esc(nm({ zh: sel.descZh, en: sel.descEn }))}</p>

            <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:5px">${t('world.nightsLabel')} · <b class="gold">${n}</b></div>
            <input class="rng" id="w-nights" type="range" min="${sel.minNights || 1}" max="30" value="${n}">

            <div class="dim2" style="font-size:10.5px;font-weight:700;margin:8px 0 5px">${t('world.cabin')}</div>
            <div class="segs" style="width:100%;display:flex;flex-wrap:wrap">
              ${data.cabins.map(x => `<button class="seg ${x.id === cabin ? 'active' : ''}" data-cab="${x.id}"
                ${x.needJet && !data.hasJet ? 'disabled title="' + t('life.needJet') + '"' : ''} style="flex:1;font-size:11px">${esc(nm(x))}</button>`).join('')}
            </div>
            <div class="dim2" style="font-size:10.5px;font-weight:700;margin:8px 0 5px">${t('world.hotel')}</div>
            <div class="segs" style="width:100%;display:flex">
              ${data.hotels.map(x => `<button class="seg ${x.id === hotel ? 'active' : ''}" data-hot="${x.id}" style="flex:1;font-size:11px">${esc(nm(x))}</button>`).join('')}
            </div>

            <div class="summary" style="margin-top:12px">
              <div><span>✈️ ${t('world.airfare')}（${esc(nm(c))}）</span><span class="mono">${moneyFull(air)}</span></div>
              <div><span>🏨 ${t('world.hotelCost')}（${n} ${t('world.night')}）</span><span class="mono">${moneyFull(stay)}</span></div>
              <div><span>🍽️ ${t('world.dailySpend')}</span><span class="mono">${moneyFull(daily)}</span></div>
              <div><span>⏱️ ${t('world.duration')}</span><span class="mono">${(hours / 24).toFixed(1)} ${t('common.day')}</span></div>
              <div><span>😌 ${t('world.relief')}</span><span class="mono up">-${relief}</span></div>
              <div><span>⭐ ${t('common.prestige')}</span><span class="mono gold">+${prestige}</span></div>
              <div class="tot"><span>${t('common.total')}</span><span class="mono ${total > s.player.cash ? 'down' : ''}">${moneyFull(total)}</span></div>
            </div>
            <button class="btn ${afford ? 'btn-primary' : ''} btn-block" id="w-go" ${afford ? '' : 'disabled'} style="margin-top:12px">
              ${away ? t('life.traveling') : s.health.sick ? t('career.otBlock.sick') : total > s.player.cash ? `${t('common.cash')} ${money(s.player.cash)} / ${money(total)}` : `✈️ ${t('world.depart')}`}
            </button>
            <div class="dim2" style="font-size:11px;margin-top:8px;line-height:1.6">${t('world.workWarn', { n: (hours / 24).toFixed(1) })}</div>`;
          })()}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>👣 ${t('world.footprint')}</h3><span class="sub">${t('world.footprintHint')}</span></div>
      <div style="max-height:330px;overflow:auto">
        ${fp.list.length ? fp.list.map((v, i) => `<div class="item-row">
          <div class="ico">${v.flag}</div>
          <div class="i-main">
            <div class="i-title">${esc(nm(v))} <span class="dim2" style="font-weight:400;font-size:11px">${esc(nm({ zh: v.country, en: v.countryEn }))}</span>
              ${v.times > 1 ? `<span class="tag b">×${v.times}</span>` : ''}</div>
            <div class="i-sub"><span>${t('world.firstVisit')} ${gDate(v.firstHour).slice(0, 10)}</span>
              <span>${v.nights} ${t('world.night')}</span><span>${money(v.spent)}</span></div>
          </div>
          <div class="i-act dim2 mono">#${i + 1}</div>
        </div>`).join('') : `<div class="empty" style="padding:40px"><div class="e-ico">👣</div>
          <h4>${t('world.noneYet')}</h4><p>${t('world.noneHint')}</p></div>`}
      </div>
    </div>`;

    // 地图交互
    const cv = $('#wmap');
    let geo = drawWorld(cv, { places: data.places, home: data.home, selected, visited, hovered });
    const redraw = () => { geo = drawWorld(cv, { places: data.places, home: data.home, selected, visited, hovered }); };
    cv.onmousemove = e => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const hit = geo.pts.find(p => Math.hypot(p.x - mx, p.y - my) <= p.r);
      const id = hit ? hit.id : null;
      if (id !== hovered) { hovered = id; cv.style.cursor = id ? 'pointer' : 'default'; redraw(); }
    };
    cv.onmouseleave = () => { if (hovered) { hovered = null; redraw(); } };
    cv.onclick = () => { if (hovered) { selected = hovered; this.render(root, app); } };
    window.addEventListener('resize', redraw, { once: true });

    $$('[data-reg]').forEach(b => b.onclick = () => { regionF = b.dataset.reg; this.render(root, app); });
    $$('[data-dest]').forEach(b => b.onclick = () => { selected = b.dataset.dest; this.render(root, app); });
    $$('[data-cab]').forEach(b => b.onclick = () => { cabin = b.dataset.cab; this.render(root, app); });
    $$('[data-hot]').forEach(b => b.onclick = () => { hotel = b.dataset.hot; this.render(root, app); });
    const rg = $('#w-nights');
    if (rg) rg.oninput = () => { nights = +rg.value; this.render(root, app); };
    const go = $('#w-go');
    if (go) go.onclick = async () => {
      go.disabled = true;
      try {
        const r = await app.guard(() => api.travel(selected, nights, cabin, hotel));
        toast(t('world.departed', { place: nm(sel), d: (r.hours / 24).toFixed(1) }), 'ok');
        data = null;
        await app.refresh(true);
      } catch (e) { toast(e.message.split(' / ')[0], 'err'); go.disabled = false; }
    };
  },

  async patch(app) {
    if (document.querySelector('.modal-mask')) return;
    const a = document.activeElement;
    if (a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) return;
    data = null;
    const root = document.getElementById('view');
    const top = root.scrollTop;
    await this.render(root, app);
    root.scrollTop = top;
  },
};
