// 出生地选择：在世界地图上落 pin，自动吸附到最近的城市
import { t, nm, lang } from './i18n.js';
import { api } from './api.js';
import { $, $$, money, esc, toast, modal } from './util.js';
import { WorldMap } from './worldmap.js';

export async function chooseBirthplace(app) {
  const w = await api.world();
  const opts = w.homeOptions;                       // 精选的那几座，作为快捷选项
  const minPop = w.atlas.birthMinPop;
  let sel = opts.find(o => o.id === 'adelaide') || opts[0];
  let busy = false;

  const m = modal({
    wide: true,
    title: `🌍 ${t('birth.title')}`,
    body: `<p class="dim" style="line-height:1.75;margin-bottom:14px;font-size:12.5px">${t('birth.intro')}</p>
      <div id="bp-map" style="position:relative;margin-bottom:10px;border-radius:10px;overflow:hidden;border:1px solid var(--line)"></div>
      <div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-xs" id="bp-in">＋</button>
        <button class="btn btn-xs" id="bp-out">－</button>
        <span class="dim2" style="font-size:11px;align-self:center">${t('world.mapHint')}</span></div>
      <input id="bp-search" type="search" placeholder="${t('world.searchPh')}"
        style="width:100%;padding:8px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--txt);font-size:12.5px;margin-bottom:10px">
      <div id="bp-hits" class="chips" style="margin-bottom:10px"></div>
      <div id="bp-info"></div>
      <div class="dim2" style="font-size:11px;margin-top:10px;line-height:1.6">${t('birth.pinHint')}
        · ${t('birth.anyCity', { n: w.atlas.cities.toLocaleString(), p: minPop.toLocaleString() })}</div>`,
    footer: `<button class="btn btn-primary" id="bp-ok"></button>`,
    onMount: (el, close) => {
      const holder = el.querySelector('#bp-map');
      const info = el.querySelector('#bp-info');
      const ok = el.querySelector('#bp-ok');
      const hits = el.querySelector('#bp-hits');
      const search = el.querySelector('#bp-search');
      // 落 pin 由服务端在 7,330 座城市里找最近的一座
      const snap = async (lon, lat) => {
        if (busy) return;
        busy = true;
        try { const c = await api.nearest(lon, lat, minPop); sel = c; paint(); }
        catch (e) { toast(e.message.split(' / ')[0], 'err'); }
        finally { busy = false; }
      };
      const paint = () => {
        map.setData({ places: opts.map(o => ({ ...o, label: nm(o) })),
          home: { ...sel, label: nm(sel) }, selected: sel.id, visited: {}, lang,
          minCityPop: minPop });                       // 太小的地方不能当出生地，索性不画
        info.innerHTML = `<div class="summary" style="display:flex;gap:12px;align-items:center">
          <span style="font-size:30px">${sel.flag}</span>
          <div style="flex:1">
            <b style="font-size:16px">${esc(nm(sel))}</b>
            <span class="dim" style="font-size:12px"> · ${esc(nm({ zh: sel.country, en: sel.countryEn }))}</span>
            <div class="dim2" style="font-size:11.5px;line-height:1.6;margin-top:3px">${sel.descZh || sel.descEn
              ? esc(nm({ zh: sel.descZh, en: sel.descEn }))
              : t('birth.plainDesc', { pop: (sel.pop || 0).toLocaleString(),
                  tag: sel.capital ? t('birth.capital') : sel.worldCity ? t('birth.worldCity') : t('birth.city') })}</div>
          </div></div>`;
        ok.textContent = `${sel.flag} ${t('birth.confirm', { place: nm(sel) })}`;
      };
      const map = new WorldMap(holder, {
        ratio: 0.46,
        onSelect: (id, hit) => {
          const known = opts.find(o => o.id === id);
          if (known) { sel = known; paint(); }
          else if (id) { snap(hit.lon, hit.lat); }      // 点中图集城市：用它的坐标回查一次
          else snap(hit.lon, hit.lat);                  // 点在空白处：吸附到最近的城市
        },
      });
      map.ready().then(paint);
      el.querySelector('#bp-in').onclick = () => map.zoomAt(1.5, map.size().w / 2, map.size().h / 2);
      el.querySelector('#bp-out').onclick = () => map.zoomAt(1 / 1.5, map.size().w / 2, map.size().h / 2);

      // 搜索：直接打出你想出生的城市
      let timer = null;
      search.oninput = () => {
        clearTimeout(timer);
        const q = search.value.trim();
        if (!q) { hits.innerHTML = ''; return; }
        timer = setTimeout(async () => {
          let rs = [];
          try { rs = (await api.citySearch(q, 12)).results.filter(c => c.pop >= minPop); } catch {}
          hits.innerHTML = rs.length
            ? rs.map(c => `<button class="chip" data-city="${c.id}">${c.flag} ${esc(nm(c))}</button>`).join('')
            : `<span class="dim2" style="font-size:11px">${t('world.searchNone', { q: esc(q) })}</span>`;
          hits.querySelectorAll('[data-city]').forEach(b => b.onclick = async () => {
            try { sel = await api.place(b.dataset.city);
              map.zoom = Math.max(map.zoom, 3.5);
              map.cx = (sel.lon + 180) / 360; map.cy = (90 - sel.lat) / 180; map.clampView();
              paint();
            } catch (e) { toast(e.message.split(' / ')[0], 'err'); }
          });
        }, 220);
      };

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
