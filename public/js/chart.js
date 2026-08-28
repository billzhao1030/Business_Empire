// 纯 canvas 图表：走势图 / K线 / 迷你图 / 环形图 / 柱状图
import { price as fmtPrice, money, gShort, pct } from './util.js';

const CSSVAR = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function dpi(canvas, w, h) {
  const r = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(w * r));
  canvas.height = Math.max(1, Math.round(h * r));
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return ctx;
}
const niceStep = range => {
  if (range <= 0) return 1;
  const raw = range / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
};

// ── 迷你走势 ────────────────────────────────────────────────
export function sparkline(canvas, data, w = 76, h = 26) {
  if (!data || data.length < 2) return;
  const ctx = dpi(canvas, w, h);
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const up = data[data.length - 1] >= data[0];
  const col = up ? CSSVAR('--up') : CSSVAR('--down');
  const X = i => (i / (data.length - 1)) * (w - 2) + 1;
  const Y = v => h - 3 - ((v - min) / rng) * (h - 6);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, col + '3d'); g.addColorStop(1, col + '00');
  ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
  ctx.lineTo(X(data.length - 1), h); ctx.lineTo(X(0), h); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
  ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
}

// ── 主图表 ──────────────────────────────────────────────────
export class PriceChart {
  constructor(container, opts = {}) {
    this.el = container;
    this.h = opts.height || 300;
    this.type = opts.type || 'line';
    this.bucket = opts.bucket || 6;
    this.unitLabel = opts.unitLabel || '';
    this.el.classList.add('chart-box');
    this.canvas = document.createElement('canvas');
    this.tip = document.createElement('div');
    this.tip.className = 'chart-tip'; this.tip.style.display = 'none';
    this.el.append(this.canvas, this.tip);
    this.data = [];
    this._onMove = e => this.hover(e);
    this._onLeave = () => { this.hoverIdx = null; this.tip.style.display = 'none'; this.draw(); };
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mouseleave', this._onLeave);
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.el);
  }
  destroy() { this.ro.disconnect(); this.el.innerHTML = ''; }
  setData(points, { type, bucket, overlays } = {}) {
    this.data = (points || []).filter(p => isFinite(p.price));
    if (type) this.type = type;
    if (bucket) this.bucket = bucket;
    if (overlays !== undefined) this.overlays = overlays;
    this.draw();
  }
  candles() {
    const out = [], b = this.bucket;
    let cur = null;
    for (const p of this.data) {
      const k = Math.floor(p.hour / b);
      if (!cur || cur.k !== k) { if (cur) out.push(cur); cur = { k, hour: p.hour, o: p.price, h: p.price, l: p.price, c: p.price }; }
      else { cur.h = Math.max(cur.h, p.price); cur.l = Math.min(cur.l, p.price); cur.c = p.price; }
    }
    if (cur) out.push(cur);
    return out;
  }
  geom() {
    const w = this.el.clientWidth || 600, h = this.h;
    return { w, h, pl: 8, pr: 62, pt: 14, pb: 24, iw: w - 70, ih: h - 38 };
  }
  draw() {
    const d = this.data;
    const { w, h, pl, pr, pt, pb, iw, ih } = this.geom();
    const ctx = dpi(this.canvas, w, h);
    ctx.clearRect(0, 0, w, h);
    if (!d.length) {
      ctx.fillStyle = CSSVAR('--dim2'); ctx.font = '12px ' + CSSVAR('--sans'); ctx.textAlign = 'center';
      ctx.fillText('—', w / 2, h / 2); return;
    }
    const isCandle = this.type === 'candle';
    const series = isCandle ? this.candles() : d;
    let min = Infinity, max = -Infinity;
    for (const p of series) {
      if (isCandle) { min = Math.min(min, p.l); max = Math.max(max, p.h); }
      else { min = Math.min(min, p.price); max = Math.max(max, p.price); }
    }
    const pad = (max - min) * 0.10 || Math.abs(max) * 0.02 || 1;
    min -= pad; max += pad;
    const rng = max - min || 1;
    const X = i => pl + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
    const Y = v => pt + ih - ((v - min) / rng) * ih;
    this._X = X; this._Y = Y; this._series = series; this._isCandle = isCandle;

    // 网格
    const step = niceStep(rng);
    ctx.strokeStyle = CSSVAR('--line'); ctx.lineWidth = 1;
    ctx.font = '10.5px ' + CSSVAR('--mono'); ctx.fillStyle = CSSVAR('--dim2'); ctx.textAlign = 'left';
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
      const y = Math.round(Y(v)) + .5;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + iw, y); ctx.stroke();
      ctx.fillText(fmtPrice(v), pl + iw + 7, y + 3.5);
    }
    // 时间轴
    ctx.textAlign = 'center';
    const ticks = Math.min(6, series.length);
    for (let i = 0; i < ticks; i++) {
      const idx = Math.round(i * (series.length - 1) / Math.max(1, ticks - 1));
      const x = X(idx);
      ctx.beginPath(); ctx.strokeStyle = CSSVAR('--line');
      ctx.moveTo(Math.round(x) + .5, pt); ctx.lineTo(Math.round(x) + .5, pt + ih); ctx.stroke();
      ctx.fillStyle = CSSVAR('--dim2');
      ctx.fillText(gShort(series[idx].hour), x, h - 7);
    }

    if (isCandle) {
      const bw = Math.max(1.5, Math.min(11, iw / series.length * 0.66));
      for (let i = 0; i < series.length; i++) {
        const c = series[i], up = c.c >= c.o;
        const col = up ? CSSVAR('--up') : CSSVAR('--down');
        const x = X(i);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, Y(c.h)); ctx.lineTo(Math.round(x) + .5, Y(c.l)); ctx.stroke();
        const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
        ctx.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
      }
    } else {
      const first = series[0].price, last = series[series.length - 1].price;
      const col = last >= first ? CSSVAR('--up') : CSSVAR('--down');
      const g = ctx.createLinearGradient(0, pt, 0, pt + ih);
      g.addColorStop(0, col + '38'); g.addColorStop(1, col + '02');
      ctx.beginPath(); ctx.moveTo(X(0), Y(series[0].price));
      for (let i = 1; i < series.length; i++) ctx.lineTo(X(i), Y(series[i].price));
      ctx.lineTo(X(series.length - 1), pt + ih); ctx.lineTo(X(0), pt + ih); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.moveTo(X(0), Y(series[0].price));
      for (let i = 1; i < series.length; i++) ctx.lineTo(X(i), Y(series[i].price));
      ctx.strokeStyle = col; ctx.lineWidth = 1.9; ctx.lineJoin = 'round'; ctx.stroke();
      // 末端光点
      const lx = X(series.length - 1), ly = Y(last);
      ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, 7); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(lx, ly, 7, 0, 7); ctx.fillStyle = col + '33'; ctx.fill();
    }

    // 均线等叠加线
    for (const ov of (this.overlays || [])) {
      const pts = ov.data;
      if (!pts || pts.length < 2) continue;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < series.length; i++) {
        const v = pts[i];
        if (v == null || !isFinite(v)) { started = false; continue; }
        const x = X(i), y = Y(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ov.color; ctx.lineWidth = ov.width || 1.3;
      ctx.setLineDash(ov.dash || []); ctx.stroke(); ctx.setLineDash([]);
    }

    // 十字光标
    if (this.hoverIdx != null && series[this.hoverIdx]) {
      const p = series[this.hoverIdx];
      const x = X(this.hoverIdx), y = Y(isCandle ? p.c : p.price);
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = CSSVAR('--line2'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ih); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + iw, y); ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = CSSVAR('--txt'); ctx.fill();
    }
  }
  hover(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const s = this._series || [];
    if (!s.length) return;
    const { pl, iw } = this.geom();
    let idx = Math.round(((x - pl) / iw) * (s.length - 1));
    idx = Math.max(0, Math.min(s.length - 1, idx));
    this.hoverIdx = idx;
    const p = s[idx];
    const prev = idx > 0 ? s[idx - 1] : p;
    const pv = this._isCandle ? prev.c : prev.price;
    const cv = this._isCandle ? p.c : p.price;
    const ch = pv ? (cv - pv) / pv : 0;
    this.tip.innerHTML = this._isCandle
      ? `<div class="dim2">${gShort(p.hour)}</div>开 <b>${fmtPrice(p.o)}</b> 高 <b>${fmtPrice(p.h)}</b><br>低 <b>${fmtPrice(p.l)}</b> 收 <b>${fmtPrice(p.c)}</b>`
      : `<div class="dim2">${gShort(p.hour)}</div><b style="font-size:14px">${fmtPrice(cv)}</b> <span class="${ch >= 0 ? 'up' : 'down'}">${pct(ch)}</span>`;
    this.tip.style.display = 'block';
    const tw = this.tip.offsetWidth;
    const px = Math.min(Math.max(4, this._X(idx) - tw / 2), this.el.clientWidth - tw - 4);
    this.tip.style.left = px + 'px';
    this.tip.style.top = '6px';
    this.draw();
  }
}

// ── 环形图 ──────────────────────────────────────────────────
export function donut(canvas, segs, size = 150) {
  const ctx = dpi(canvas, size, size);
  const total = segs.reduce((s, x) => s + Math.max(0, x.v), 0);
  const cx = size / 2, cy = size / 2, r = size / 2 - 6, ir = r * 0.62;
  ctx.clearRect(0, 0, size, size);
  if (total <= 0) {
    ctx.beginPath(); ctx.arc(cx, cy, (r + ir) / 2, 0, 7);
    ctx.strokeStyle = CSSVAR('--line'); ctx.lineWidth = r - ir; ctx.stroke(); return;
  }
  let a = -Math.PI / 2;
  for (const s of segs) {
    const v = Math.max(0, s.v); if (!v) continue;
    const da = (v / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, (r + ir) / 2, a, a + da);
    ctx.strokeStyle = s.color; ctx.lineWidth = r - ir; ctx.stroke();
    a += da;
  }
}

// ── 柱状图（现金流） ────────────────────────────────────────
export function bars(canvas, items, w, h = 120) {
  const ctx = dpi(canvas, w, h);
  ctx.clearRect(0, 0, w, h);
  if (!items.length) return;
  const max = Math.max(...items.map(i => Math.abs(i.v)), 1);
  const bw = Math.max(4, w / items.length - 6);
  items.forEach((it, i) => {
    const x = (i + .5) * (w / items.length);
    const bh = (Math.abs(it.v) / max) * (h - 26);
    ctx.fillStyle = it.v >= 0 ? CSSVAR('--up') : CSSVAR('--down');
    ctx.globalAlpha = .85;
    ctx.beginPath();
    const y = h - 20 - bh;
    ctx.roundRect(x - bw / 2, y, bw, bh, 3); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = CSSVAR('--dim2'); ctx.font = '9.5px ' + CSSVAR('--mono'); ctx.textAlign = 'center';
    ctx.fillText(it.label, x, h - 6);
  });
}

// 简单移动平均（返回与输入等长、前 n-1 项为 null 的数组）
export function movingAvg(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}
