// 真实矢量世界地图：Natural Earth 1:50m 国界数据（公有领域）
// 支持拖拽平移、滚轮缩放、国家高亮与命中检测。零依赖，数据本地加载。
const CSSVAR = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ── TopoJSON 解码（约 40 行，够用即可）──────────────────────
function decodeArcs(topo) {
  const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
  return topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
}
function ringOf(arcs, indices) {
  const pts = [];
  for (const idx of indices) {
    const rev = idx < 0;
    const a = arcs[rev ? ~idx : idx];
    const seg = rev ? a.slice().reverse() : a;
    for (let i = pts.length ? 1 : 0; i < seg.length; i++) pts.push(seg[i]);
  }
  return pts;
}
function featuresOf(topo, objName) {
  const arcs = decodeArcs(topo);
  return topo.objects[objName].geometries.map(g => {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    return { id: g.id, name: g.properties?.name || '', rings: polys.map(p => p.map(r => ringOf(arcs, r))) };
  }).filter(f => f.rings.length);
}

// 等距圆柱投影：经纬度 → 归一化世界坐标 [0,1]
const PX = lon => (lon + 180) / 360;
const PY = lat => (90 - lat) / 180;

let CACHE = null;
export async function loadGeo() {
  if (CACHE) return CACHE;
  const topo = await (await fetch('/data/countries-50m.json')).json();
  const feats = featuresOf(topo, 'countries');
  for (const f of feats) {
    const path = new Path2D();
    let minx = 2, maxx = -1, miny = 2, maxy = -1;
    // 逐块统计：国名要标在最大的那块陆地上。若取整个国家的包围盒中心，
    // 跨换日线的（俄罗斯、新西兰、斐济）和带海外领地的（法国、葡萄牙、荷兰）
    // 会把国名甩到大洋正中间。
    let best = 0, bx = 0.5, by = 0.5, mbox = null;
    for (const poly of f.rings) {
      let px0 = 2, px1 = -1, py0 = 2, py1 = -1, a2 = 0, sx = 0, sy = 0;
      poly.forEach((ring, ri) => {
        // 换日线展开：把经度接续成连续曲线，否则跨 ±180° 的国家（俄罗斯远东、
        // 斐济）会被画成横贯整幅地图的一条长条。
        const pts = [];
        let prev = null;
        for (const [lon, lat] of ring) {
          let x = PX(lon);
          if (prev !== null) {
            while (x - prev > 0.5) x -= 1;
            while (prev - x > 0.5) x += 1;
          }
          prev = x;
          pts.push([x, PY(lat)]);
        }
        let rx0 = 2, rx1 = -1;
        for (const [x, y] of pts) {
          if (x < rx0) rx0 = x; if (x > rx1) rx1 = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
        if (rx0 < minx) minx = rx0; if (rx1 > maxx) maxx = rx1;
        // 展开后落在世界之外的部分，用 ±1 的副本补回来（画布裁剪掉多余的一份）
        for (let k = -1; k <= 1; k++) {
          if (rx0 + k >= 1 || rx1 + k <= 0) continue;
          pts.forEach(([x, y], i) => (i ? path.lineTo(x + k, y) : path.moveTo(x + k, y)));
          path.closePath();
        }
        if (ri) return;                                  // 只按外环算面积与形心
        for (const [x, y] of pts) {
          if (x < px0) px0 = x; if (x > px1) px1 = x;
          if (y < py0) py0 = y; if (y > py1) py1 = y;
        }
        for (let i = 0, n = pts.length; i < n; i++) {
          const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
          const c = x1 * y2 - x2 * y1;
          a2 += c; sx += (x1 + x2) * c; sy += (y1 + y2) * c;
        }
      });
      const area = Math.abs(a2) / 2;
      if (area > best) {
        best = area;
        mbox = [px0, py0, px1, py1];
        bx = a2 ? sx / (3 * a2) : (px0 + px1) / 2;
        by = a2 ? sy / (3 * a2) : (py0 + py1) / 2;
        // 形心可能落在凹形国家（挪威、克罗地亚）之外，越界就退回该块的中心
        if (bx < px0 || bx > px1 || by < py0 || by > py1) { bx = (px0 + px1) / 2; by = (py0 + py1) / 2; }
      }
    }
    bx -= Math.floor(bx);                                 // 展开后的形心绕回 [0,1)
    f.path = path; f.box = [minx, miny, maxx, maxy];
    f.mainBox = mbox || f.box;
    f.cx = bx; f.cy = by; f.area = best;
  }
  CACHE = feats;
  return feats;
}

// ── 城市图集：7,330 座真实城市（Natural Earth，公有领域）──
let CITIES = null;
export async function loadCities() {
  if (CITIES) return CITIES;
  const raw = await (await fetch('/data/cities.json')).json();
  const co = new Map(raw.countries.map(([iso, zh, en]) => [iso, { zh, en }]));
  // 文件里已按人口降序排好，画标注时先大后小，正好是要的顺序
  CITIES = raw.cities.map(([id, en, zh, iso, lonI, latI, pop, flags]) => {
    const lon = lonI / 1e3, lat = latI / 1e3, c = co.get(iso);
    return { id, en, zh, iso, lon, lat, pop, flags, x: PX(lon), y: PY(lat),
             country: c ? c.zh : iso, countryEn: c ? c.en : iso };
  });
  return CITIES;
}
export function citiesLoaded() { return CITIES; }

// 大圆航线：按球面插值，跨越换日线时自动断开
function greatCircle(a, b, n = 96) {
  const rad = Math.PI / 180;
  const lo1 = a.lon * rad, la1 = a.lat * rad, lo2 = b.lon * rad, la2 = b.lat * rad;
  const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
  if (!d || !isFinite(d)) return [];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    out.push([Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad]);
  }
  return out;
}

export class WorldMap {
  constructor(el, opts = {}) {
    this.el = el;
    this.onSelect = opts.onSelect || (() => {});
    this.onHover = opts.onHover || (() => {});
    this.ratio = opts.ratio || 0.52;
    this.zoom = 1; this.cx = 0.5; this.cy = 0.5;     // 视图中心（世界坐标）
    this.places = []; this.home = null; this.selected = null; this.hovered = null; this.visited = {};
    this.cities = null; this.aliasSkip = null; this.showCities = opts.showCities !== false;
    this.minCityPop = 0;                              // 只显示这个人口以上的城市（0 = 不限）
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';
    this.el.appendChild(this.canvas);
    this._bind();
  }
  setData(d) { Object.assign(this, d); this.draw(); }
  async ready() {
    const [geo, cities] = await Promise.all([loadGeo(), this.showCities ? loadCities() : null]);
    this.geo = geo; this.cities = cities;
    this.draw();
  }

  size() {
    const w = this.el.clientWidth || 900;
    return { w, h: Math.round(w * this.ratio) };
  }
  toScreen(lon, lat) {
    const { w, h } = this.size();
    const s = w * this.zoom, sh = s / 2;           // 等距圆柱：高 = 宽/2
    return [w / 2 + (PX(lon) - this.cx) * s, h / 2 + (PY(lat) - this.cy) * sh];
  }
  toWorld(px, py) {
    const { w, h } = this.size();
    const s = w * this.zoom, sh = s / 2;
    return { x: this.cx + (px - w / 2) / s, y: this.cy + (py - h / 2) / sh };
  }
  clampView() {
    const half = 0.5 / this.zoom;
    this.cx = Math.min(1 - half, Math.max(half, this.cx));
    const { w, h } = this.size();
    const vh = (h / (w * this.zoom / 2)) / 2;      // 视口在世界纵向坐标中占的半高
    this.cy = Math.min(1 - vh, Math.max(vh, this.cy));
    if (this.zoom <= 1) { this.cx = 0.5; this.cy = 0.5; }
  }
  zoomAt(factor, px, py) {
    const before = this.toWorld(px, py);
    this.zoom = Math.min(14, Math.max(1, this.zoom * factor));
    const after = this.toWorld(px, py);
    this.cx += before.x - after.x; this.cy += before.y - after.y;
    this.clampView(); this.draw();
  }
  _bind() {
    const cv = this.canvas;
    let drag = null, moved = 0;
    cv.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy }; moved = 0; cv.style.cursor = 'grabbing'; });
    window.addEventListener('mouseup', () => { if (drag) { drag = null; cv.style.cursor = 'grab'; } });
    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      if (drag) {
        const { w } = this.size(), s = w * this.zoom;
        moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
        this.cx = drag.cx - (e.clientX - drag.x) / s;
        this.cy = drag.cy - (e.clientY - drag.y) / (s / 2);
        this.clampView(); this.draw();
        return;
      }
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const hit = this._hitPlace(mx, my);
      const id = hit ? hit.id : null;
      if (id !== this.hovered) { this.hovered = id; cv.style.cursor = id ? 'pointer' : 'grab'; this.onHover(id); this.draw(); }
      this._mouse = [mx, my];
    });
    cv.addEventListener('mouseleave', () => { if (this.hovered) { this.hovered = null; this.onHover(null); this.draw(); } this._mouse = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.deltaY < 0 ? 1.22 : 1 / 1.22, e.offsetX, e.offsetY); }, { passive: false });
    cv.addEventListener('dblclick', e => this.zoomAt(1.9, e.offsetX, e.offsetY));
    cv.addEventListener('click', e => {
      if (moved > 5) return;
      const r = cv.getBoundingClientRect();
      const hit = this._hitPlace(e.clientX - r.left, e.clientY - r.top);
      if (hit) this.onSelect(hit.id, hit);
      else {
        const wpt = this.toWorld(e.clientX - r.left, e.clientY - r.top);
        this.onSelect(null, { lon: wpt.x * 360 - 180, lat: 90 - wpt.y * 180 });
      }
    });
  }
  _hitPlace(mx, my) {
    let best = null, bd = 18 * 18;
    for (const p of this.places) {
      const [x, y] = this.toScreen(p.lon, p.lat);
      const d = (x - mx) ** 2 + (y - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) return best;
    // 精选目的地没命中，就在这一帧画出来的城市里找最近的
    let cd = 15 * 15;
    for (const c of (this._drawn || [])) {
      const d = (c.sx - mx) ** 2 + (c.sy - my) ** 2;
      if (d < cd) { cd = d; best = c.c; }
    }
    return best;
  }

  draw() {
    if (!this.geo) return;
    const { w, h } = this.size();
    const r = window.devicePixelRatio || 1;
    const cv = this.canvas;
    cv.width = w * r; cv.height = h * r;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(r, 0, 0, r, 0, 0);

    // 海洋
    const og = ctx.createLinearGradient(0, 0, 0, h);
    og.addColorStop(0, CSSVAR('--bg2')); og.addColorStop(1, CSSVAR('--bg'));
    ctx.fillStyle = og; ctx.fillRect(0, 0, w, h);

    const s = w * this.zoom, sh = s / 2;
    const ox = w / 2 - this.cx * s, oy = h / 2 - this.cy * sh;

    // 经纬网
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = CSSVAR('--line'); ctx.lineWidth = 0.6; ctx.globalAlpha = 0.45;
    const step = this.zoom > 6 ? 5 : this.zoom > 3 ? 10 : 30;
    for (let lon = -180; lon <= 180; lon += step) { const x = ox + PX(lon) * s; if (x > -5 && x < w + 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } }
    for (let lat = -80; lat <= 80; lat += step) { const y = oy + PY(lat) * sh; if (y > -5 && y < h + 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
    ctx.globalAlpha = 1;

    // 陆地：用变换一次性绘制矢量路径
    ctx.save();
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.translate(ox, oy); ctx.scale(s, sh);
    ctx.lineWidth = 1 / s * 1.2;
    const landFill = CSSVAR('--panel2'), border = CSSVAR('--line2');
    const hovCountry = this._hoverCountry;
    for (const f of this.geo) {
      ctx.fillStyle = f === hovCountry ? CSSVAR('--panel3') : landFill;
      ctx.fill(f.path);
    }
    ctx.strokeStyle = border;
    for (const f of this.geo) ctx.stroke(f.path);
    ctx.restore();

    // 赤道
    ctx.strokeStyle = CSSVAR('--line2'); ctx.setLineDash([5, 6]); ctx.globalAlpha = .6;
    const ey = oy + PY(0) * sh;
    ctx.beginPath(); ctx.moveTo(0, ey); ctx.lineTo(w, ey); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // 国家名（放大后显示）
    if (this.zoom >= 2.2) {
      ctx.font = `600 ${Math.min(13, 8 + this.zoom * 0.5)}px ${CSSVAR('--sans')}`;
      ctx.fillStyle = CSSVAR('--dim2'); ctx.textAlign = 'center';
      for (const f of this.geo) {
        if (f.area * this.zoom < 0.0008) continue;
        const x = ox + f.cx * s, y = oy + f.cy * sh;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        ctx.fillText(f.name, x, y);
      }
    }

    // ── 城市图集 ────────────────────────────────────────────
    // 放得越大，露出的城市越小。标注不按缩放档位开关，而是谁先占住位置谁显示——
    // 这样缩放时城市是一座座浮出来的，不会整批闪现。
    this._drawn = [];
    if (this.cities && this.showCities) {
      const minPop = Math.max(this.minCityPop, 1_000_000 / Math.pow(this.zoom, 1.8));
      const boxes = [];
      const fits = (x0, y0, x1, y1) => {
        for (const b of boxes) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return false;
        boxes.push([x0, y0, x1, y1]); return true;
      };
      const sans = CSSVAR('--sans'), bg = CSSVAR('--bg');
      const dotFill = CSSVAR('--dim2'), txtFill = CSSVAR('--dim');
      let dots = 0, labels = 0;
      ctx.textAlign = 'center';
      for (const c of this.cities) {
        if (dots >= 1400) break;
        if (c.pop < minPop) break;                        // 已按人口降序，后面只会更小
        if (this.aliasSkip && this.aliasSkip.has(c.id)) continue;   // 精选目的地会单独画
        const x = ox + c.x * s, y = oy + c.y * sh;
        if (x < -30 || x > w + 30 || y < -20 || y > h + 20) continue;
        dots++;
        const big = c.pop >= 5e6, mid = c.pop >= 1e6;
        const rad = big ? 3.2 : mid ? 2.5 : 1.9;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 7);
        ctx.fillStyle = dotFill; ctx.globalAlpha = big ? .95 : mid ? .8 : .62; ctx.fill();
        ctx.globalAlpha = 1;
        if (labels >= 130) continue;
        const fs = big ? 11.5 : mid ? 10.5 : 9.5;
        ctx.font = `600 ${fs}px ${sans}`;
        const label = this.lang === 'en' ? c.en : (c.zh || c.en);
        const tw = ctx.measureText(label).width;
        const ty = y - rad - 3;
        if (!fits(x - tw / 2 - 2, ty - fs, x + tw / 2 + 2, ty + 2)) continue;
        labels++;
        ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.strokeText(label, x, ty);
        ctx.fillStyle = txtFill; ctx.fillText(label, x, ty);
        this._drawn.push({ c, sx: x, sy: y });
      }
      this._shown = { dots, labels, minPop };
    }

    // 航线
    const target = this.places.find(p => p.id === (this.hovered || this.selected));
    if (this.home && target) {
      const pts = greatCircle(this.home, target);
      ctx.beginPath();
      let prev = null;
      for (const [lon, lat] of pts) {
        const x = ox + PX(lon) * s, y = oy + PY(lat) * sh;
        if (prev && Math.abs(x - prev) > w * 0.6) ctx.moveTo(x, y); else prev === null ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        prev = x;
      }
      ctx.strokeStyle = CSSVAR('--gold'); ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = .9; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // 目的地
    const labelZoom = this.zoom >= 1.8;
    for (const p of this.places) {
      const [x, y] = this.toScreen(p.lon, p.lat);
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      const been = !!this.visited[p.id];
      const act = p.id === this.selected || p.id === this.hovered;
      const rad = act ? 6.5 : been ? 5 : 3.8;
      if (been) { ctx.beginPath(); ctx.arc(x, y, rad + 5, 0, 7); ctx.fillStyle = CSSVAR('--up') + '30'; ctx.fill(); }
      if (act) { ctx.beginPath(); ctx.arc(x, y, rad + 7, 0, 7); ctx.fillStyle = CSSVAR('--gold') + '33'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7);
      ctx.fillStyle = been ? CSSVAR('--up') : act ? CSSVAR('--gold') : CSSVAR('--dim');
      ctx.fill(); ctx.strokeStyle = CSSVAR('--bg'); ctx.lineWidth = 1.5; ctx.stroke();
      if (labelZoom || act) {
        ctx.font = `700 ${act ? 12 : 10.5}px ${CSSVAR('--sans')}`;
        ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = CSSVAR('--bg');
        const txt = (p.flag || '') + ' ' + (p.label || p.zh || p.en || '');
        ctx.strokeText(txt, x, y - rad - 6); ctx.fillStyle = act ? CSSVAR('--gold') : CSSVAR('--txt');
        ctx.fillText(txt, x, y - rad - 6);
      }
    }

    // 家
    if (this.home) {
      const [hx, hy] = this.toScreen(this.home.lon, this.home.lat);
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, 7); ctx.fillStyle = CSSVAR('--gold') + '3a'; ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, 7); ctx.fillStyle = CSSVAR('--gold'); ctx.fill();
      ctx.strokeStyle = CSSVAR('--bg'); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.font = `700 11.5px ${CSSVAR('--sans')}`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = CSSVAR('--bg');
      const t = '🏠 ' + (this.home.label || this.home.zh || this.home.en || '');
      ctx.strokeText(t, hx, hy + 20); ctx.fillStyle = CSSVAR('--gold'); ctx.fillText(t, hx, hy + 20);
    }
    ctx.restore();

    // 缩放指示
    ctx.font = `600 10.5px ${CSSVAR('--mono')}`; ctx.textAlign = 'left';
    ctx.fillStyle = CSSVAR('--dim2');
    const info = this._shown && this.showCities
      ? `${this.zoom.toFixed(1)}×   ${this._shown.dots} / ${this.cities.length}`
      : `${this.zoom.toFixed(1)}×`;
    ctx.fillText(info, 10, h - 10);
  }
}
