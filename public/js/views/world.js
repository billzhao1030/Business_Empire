import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast, durText, gDate, keepScroll} from '../util.js';
import { WorldMap } from '../worldmap.js';

let data = null, selected = null, hovered = null, nights = 5, cabin = 'economy', hotel = 'std', regionF = '';
// 图集里的城市不在 data.places 里，选中时单独去服务端要一份
let picked = null, query = '', results = null, searching = false;

// 1,145,000 → 114.5 万 / 1.1M
function popText(n) {
  if (!n) return '—';
  if (lang === 'en') return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : (n / 1e3).toFixed(0) + 'k';
  return n >= 1e4 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + ' 万' : String(n);
}

export default {
  async render(root, app) {
    if (!data) { try { data = await api.world(); } catch { data = null; } }
    if (!data) { root.innerHTML = `<div class="card"><div class="card-b"><div class="empty"><p>${t('common.loading')}</p></div></div></div>`; return; }
    const s = app.state, fp = data.footprint;
    const view = this.map ? this.map.viewState() : null;      // 重画前先记住视角
    const visited = Object.fromEntries(data.places.filter(p => p.visit).map(p => [p.id, p.visit]));
    const featured = data.places.filter(p => !regionF || p.region === regionF);
    const list = results || featured;
    const sel = (picked && picked.id === selected) ? picked : data.places.find(p => p.id === selected);
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
      <div class="card-b" style="padding:12px">
        <div id="wmap" style="position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--line)"></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-xs" id="wm-in">＋</button><button class="btn btn-xs" id="wm-out">－</button>
          <button class="btn btn-xs btn-ghost" id="wm-home">🏠 ${t('world.centerHome')}</button>
          <button class="btn btn-xs btn-ghost" id="wm-reset">${t('world.resetView')}</button>
          <span class="dim2" style="font-size:11px;margin-left:auto">${t('world.mapHint')}</span>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1.35fr 1fr;margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>✈️ ${t('world.destinations')}</h3>
          <span class="sub">${t('world.atlasCount', { n: data.atlas.cities.toLocaleString(), c: data.atlas.countries })}</span>
          <div class="right"><div class="chips">
            <button class="chip ${!regionF ? 'active' : ''}" data-reg="">${t('mkt.all')}</button>
            ${data.regions.map(r => `<button class="chip ${regionF === r.id ? 'active' : ''}" data-reg="${r.id}">${r.emoji} ${esc(nm(r))}</button>`).join('')}
          </div></div></div>
        <div style="padding:10px 12px 0">
          <input id="w-search" type="search" placeholder="${t('world.searchPh')}" value="${esc(query)}"
            style="width:100%;padding:8px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--txt);font-size:12.5px">
          ${results ? `<div class="dim2" style="font-size:11px;margin-top:6px">${results.length
              ? t('world.searchHits', { n: results.length, q: esc(query) })
              : t('world.searchNone', { q: esc(query) })} · <a href="#" id="w-clear" class="gold">${t('world.searchClear')}</a></div>`
            : `<div class="dim2" style="font-size:11px;margin-top:6px">${t('world.featured')}</div>`}
        </div>
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
                ${p.hotel ? `<span>🏨 ${money(p.hotel)}/${t('world.night')}</span>` : ''}
                ${p.relief ? `<span class="up">😌 -${p.relief}/${t('world.night')}</span>`
                  : p.pop ? `<span class="dim2">👥 ${t('world.pop', { n: popText(p.pop) })}</span>` : ''}
              </div>
            </div>
            <div class="i-act"><b class="mono">${money(p.flight)}</b></div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>🎫 ${t('world.book')}</h3></div>
        <div class="card-b">
          ${!sel ? `<div class="empty" style="padding:36px 12px"><div class="e-ico">🗺️</div><p>${t('world.pick')}</p></div>`
            : sel.isHome || sel.id === data.home.id ? `<div class="empty" style="padding:36px 12px"><div class="e-ico">🏠</div>
                <h4>${sel.flag} ${esc(nm(sel))}</h4><p>${t('world.isHome')}</p></div>` : (() => {
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

    // 选中一个地方：精选目的地直接用，图集城市去服务端取一份完整资料
    const pick = async (id) => {
      if (!id) return;
      selected = id;
      const known = data.places.find(x => x.id === id) || (results || []).find(x => x.id === id);
      if (known && known.hotel) { picked = known; keepScroll(() => this.render(root, app)); return; }
      picked = null; keepScroll(() => this.render(root, app));
      try { const r = await api.place(id); if (selected === r.id) { picked = r; keepScroll(() => this.render(root, app)); } }
      catch (e) { toast(e.message.split(' / ')[0], 'err'); }
    };
    this.pick = pick;

    // 地图：真实矢量国界 + 7,330 座城市 + 拖拽平移 + 滚轮缩放
    // innerHTML 重写会换掉容器，所以每次都要把 canvas 挪过来、把视角放回去，
    // 否则轮询一刷新，玩家刚放大的地方就被弹回全球视图了。
    const holder = $('#wmap');
    if (!this.map) {
      this.map = new WorldMap(holder, {
        onSelect: (id) => { if (id) this.pick(id); },
        onHover: () => {},
      });
      this.map.ready();
      if (typeof window !== 'undefined') window.__wm = this.map;   // 供自动化测试驱动视图
    } else {
      this.map.el = holder;
      holder.appendChild(this.map.canvas);
      this.map.restoreView(view);
    }
    this.map.setData({
      places: data.places.map(p => ({ ...p, label: nm(p) })),
      home: { ...data.home, label: nm(data.home) },
      selected, visited, lang,
      aliasSkip: new Set(Object.keys(data.atlas.alias)),   // 精选目的地由上面那层画
    });
    if (this.map.geo) this.map.draw();
    $('#wm-in').onclick = () => this.map.zoomAt(1.5, this.map.size().w / 2, this.map.size().h / 2);
    $('#wm-out').onclick = () => this.map.zoomAt(1 / 1.5, this.map.size().w / 2, this.map.size().h / 2);
    $('#wm-home').onclick = () => { const m = this.map;
      m.zoom = Math.max(m.zoom, 3.2); m.cx = (data.home.lon + 180) / 360; m.cy = (90 - data.home.lat) / 180;
      m.clampView(); m.draw(); };
    $('#wm-reset').onclick = () => { const m = this.map; m.zoom = 1; m.cx = 0.5; m.cy = 0.5; m.draw(); };

    $$('[data-reg]').forEach(b => b.onclick = () => { regionF = b.dataset.reg; keepScroll(() => this.render(root, app)); });
    $$('[data-dest]').forEach(b => b.onclick = () => {
      const id = b.dataset.dest;
      const d = list.find(x => x.id === id) || data.places.find(x => x.id === id);
      if (d && this.map) { this.map.zoom = Math.max(this.map.zoom, 2.6);
        this.map.cx = (d.lon + 180) / 360; this.map.cy = (90 - d.lat) / 180; this.map.clampView(); }
      this.pick(id);
    });

    // ── 搜索：全世界 7,330 座城市，中英文都能搜 ──
    const sb = $('#w-search');
    if (sb) {
      sb.oninput = () => {
        query = sb.value;
        clearTimeout(this._st);
        this._st = setTimeout(async () => {
          const q = query.trim();
          if (!q) { results = null; keepScroll(() => this.render(root, app)); return; }
          if (searching) return;
          searching = true;
          try { results = (await api.citySearch(q, 40)).results; }
          catch { results = []; }
          finally { searching = false; }
          if (query.trim() === q) {
            keepScroll(() => this.render(root, app));
            const nb = $('#w-search'); if (nb) { nb.focus(); nb.setSelectionRange(nb.value.length, nb.value.length); }
          }
        }, 220);
      };
    }
    const cl = $('#w-clear');
    if (cl) cl.onclick = (e) => { e.preventDefault(); query = ''; results = null; keepScroll(() => this.render(root, app)); };
    $$('[data-cab]').forEach(b => b.onclick = () => { cabin = b.dataset.cab; keepScroll(() => this.render(root, app)); });
    $$('[data-hot]').forEach(b => b.onclick = () => { hotel = b.dataset.hot; keepScroll(() => this.render(root, app)); });
    const rg = $('#w-nights');
    if (rg) rg.oninput = () => { nights = +rg.value; keepScroll(() => this.render(root, app)); };
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

  // 轮询：只有真的有变化才重画。地图是要用手操作的，不能每 5 秒推倒一次。
  async patch(app) {
    if (document.querySelector('.modal-mask')) return;
    const a = document.activeElement;
    if (a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) return;
    if (this.map && this.map.dragging) return;
    const s = app.state;
    const sig = [s.player.cash | 0, s.health.trip ? s.health.trip.hoursLeft | 0 : -1,
                 data ? data.footprint.places : -1, data ? data.footprint.trips : -1].join('|');
    if (sig === this._sig) return;
    this._sig = sig;
    data = null;
    const root = document.getElementById('view');
    const top = root.scrollTop;
    await keepScroll(() => keepScroll(() => this.render(root, app)));
    root.scrollTop = top;
  },
};
