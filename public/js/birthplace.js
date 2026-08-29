// 出生地选择：在世界地图上落 pin，自动吸附到最近的城市
import { t, nm, lang } from './i18n.js';
import { api } from './api.js';
import { $, $$, money, esc, toast, modal } from './util.js';
import { drawWorld } from './worldmap.js';

export async function chooseBirthplace(app) {
  const w = await api.world();
  const opts = w.homeOptions;
  let sel = opts.find(o => o.id === 'adelaide') || opts[0];
  let hovered = null;

  const m = modal({
    wide: true,
    title: `🌍 ${t('birth.title')}`,
    body: `<p class="dim" style="line-height:1.75;margin-bottom:14px;font-size:12.5px">${t('birth.intro')}</p>
      <div style="position:relative;margin-bottom:12px"><canvas id="bp-map" style="display:block;cursor:crosshair"></canvas></div>
      <div id="bp-info"></div>
      <div class="dim2" style="font-size:11px;margin-top:10px;line-height:1.6">${t('birth.pinHint')}</div>`,
    footer: `<button class="btn btn-primary" id="bp-ok"></button>`,
    onMount: (el, close) => {
      const cv = el.querySelector('#bp-map');
      const info = el.querySelector('#bp-info');
      const ok = el.querySelector('#bp-ok');
      let geo;
      const paint = () => {
        geo = drawWorld(cv, { places: opts, home: sel, selected: sel.id, visited: {}, hovered });
        info.innerHTML = `<div class="summary" style="display:flex;gap:12px;align-items:center">
          <span style="font-size:30px">${sel.flag}</span>
          <div style="flex:1">
            <b style="font-size:16px">${esc(nm(sel))}</b>
            <span class="dim" style="font-size:12px"> · ${esc(nm({ zh: sel.country, en: sel.countryEn }))}</span>
            <div class="dim2" style="font-size:11.5px;line-height:1.6;margin-top:3px">${esc(nm({ zh: sel.descZh, en: sel.descEn }))}</div>
          </div></div>`;
        ok.textContent = `${sel.flag} ${t('birth.confirm', { place: nm(sel) })}`;
      };
      // 点地图任意位置 → 吸附到最近的可选城市
      const nearest = (lon, lat) => opts.reduce((best, o) => {
        const d = (o.lon - lon) ** 2 + ((o.lat - lat) * 1.4) ** 2;
        return d < best.d ? { d, o } : best;
      }, { d: Infinity, o: opts[0] }).o;
      const toGeo = e => {
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        return { lon: x / r.width * 360 - 180, lat: 85 - y / r.height * 170 };
      };
      cv.onmousemove = e => { const g = toGeo(e); const n = nearest(g.lon, g.lat);
        if (n.id !== hovered) { hovered = n.id; paint(); } };
      cv.onmouseleave = () => { if (hovered) { hovered = null; paint(); } };
      cv.onclick = e => { const g = toGeo(e); sel = nearest(g.lon, g.lat); paint(); };
      ok.onclick = async () => {
        ok.disabled = true;
        try {
          await api.birthplace(sel.id);
          close();
          toast(t('birth.done', { place: nm(sel) }), 'ok');
          await app.refresh(true);
        } catch (e) { toast(e.message.split(' / ')[0], 'err'); ok.disabled = false; }
      };
      paint();
      setTimeout(paint, 60);
    },
  });
  return m;
}
