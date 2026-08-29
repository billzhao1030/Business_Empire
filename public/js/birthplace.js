// 出生地选择：在世界地图上落 pin，自动吸附到最近的城市
import { t, nm, lang } from './i18n.js';
import { api } from './api.js';
import { $, $$, money, esc, toast, modal } from './util.js';
import { WorldMap } from './worldmap.js';

export async function chooseBirthplace(app) {
  const w = await api.world();
  const opts = w.homeOptions;
  let sel = opts.find(o => o.id === 'adelaide') || opts[0];
  let hovered = null;

  const m = modal({
    wide: true,
    title: `🌍 ${t('birth.title')}`,
    body: `<p class="dim" style="line-height:1.75;margin-bottom:14px;font-size:12.5px">${t('birth.intro')}</p>
      <div id="bp-map" style="position:relative;margin-bottom:10px;border-radius:10px;overflow:hidden;border:1px solid var(--line)"></div>
      <div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-xs" id="bp-in">＋</button>
        <button class="btn btn-xs" id="bp-out">－</button>
        <span class="dim2" style="font-size:11px;align-self:center">${t('world.mapHint')}</span></div>
      <div id="bp-info"></div>
      <div class="dim2" style="font-size:11px;margin-top:10px;line-height:1.6">${t('birth.pinHint')}</div>`,
    footer: `<button class="btn btn-primary" id="bp-ok"></button>`,
    onMount: (el, close) => {
      const holder = el.querySelector('#bp-map');
      const info = el.querySelector('#bp-info');
      const ok = el.querySelector('#bp-ok');
      const nearest = (lon, lat) => opts.reduce((best, o) => {
        const d = (o.lon - lon) ** 2 + ((o.lat - lat) * 1.4) ** 2;
        return d < best.d ? { d, o } : best;
      }, { d: Infinity, o: opts[0] }).o;
      const paint = () => {
        map.setData({ places: opts.map(o => ({ ...o, label: nm(o) })),
          home: { ...sel, label: nm(sel) }, selected: sel.id, visited: {} });
        info.innerHTML = `<div class="summary" style="display:flex;gap:12px;align-items:center">
          <span style="font-size:30px">${sel.flag}</span>
          <div style="flex:1">
            <b style="font-size:16px">${esc(nm(sel))}</b>
            <span class="dim" style="font-size:12px"> · ${esc(nm({ zh: sel.country, en: sel.countryEn }))}</span>
            <div class="dim2" style="font-size:11.5px;line-height:1.6;margin-top:3px">${esc(nm({ zh: sel.descZh, en: sel.descEn }))}</div>
          </div></div>`;
        ok.textContent = `${sel.flag} ${t('birth.confirm', { place: nm(sel) })}`;
      };
      const map = new WorldMap(holder, {
        ratio: 0.46,
        onSelect: (id, hit) => {
          sel = id ? opts.find(o => o.id === id) : nearest(hit.lon, hit.lat);
          paint();
        },
      });
      map.ready().then(paint);
      el.querySelector('#bp-in').onclick = () => map.zoomAt(1.5, map.size().w / 2, map.size().h / 2);
      el.querySelector('#bp-out').onclick = () => map.zoomAt(1 / 1.5, map.size().w / 2, map.size().h / 2);

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
    },
  });
  return m;
}
