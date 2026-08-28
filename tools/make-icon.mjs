// 零依赖生成 App 图标：手写 PNG 编码 + SDF 抗锯齿绘制
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
fs.mkdirSync(OUT, { recursive: true });

// ── PNG 编码 ────────────────────────────────────────────────
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── 绘制 ────────────────────────────────────────────────────
const S = 2048;                       // 超采样后缩到 1024
const buf = new Float64Array(S * S * 4);
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
function blend(i, r, g, b, a) {
  if (a <= 0) return;
  const o = buf[i + 3];
  const na = a + o * (1 - a);
  buf[i]     = (r * a + buf[i]     * o * (1 - a)) / (na || 1);
  buf[i + 1] = (g * a + buf[i + 1] * o * (1 - a)) / (na || 1);
  buf[i + 2] = (b * a + buf[i + 2] * o * (1 - a)) / (na || 1);
  buf[i + 3] = na;
}
const rrSDF = (px, py, cx, cy, w, h, r) => {
  const dx = Math.abs(px - cx) - (w / 2 - r), dy = Math.abs(py - cy) - (h / 2 - r);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - r;
};
function fillShape(sdf, colorFn, aa = 1.6) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = sdf(x + .5, y + .5);
    if (d > aa) continue;
    const a = 1 - smooth(-aa, aa, d);
    if (a <= 0.001) continue;
    const c = colorFn(x, y);
    blend((y * S + x) * 4, c[0], c[1], c[2], a * (c[3] ?? 1));
  }
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// 背景：圆角矩形 + 靛蓝→紫的对角渐变 + 顶部高光
const BG1 = [22, 30, 68], BG2 = [66, 40, 130], BG3 = [12, 16, 40];
fillShape((x, y) => rrSDF(x, y, S / 2, S / 2, S * 0.955, S * 0.955, S * 0.225),
  (x, y) => {
    const t = clamp01((x / S * 0.55 + y / S * 0.65));
    const base = t < 0.5 ? mix(BG1, BG2, t * 2) : mix(BG2, BG3, (t - 0.5) * 2);
    const glow = Math.max(0, 1 - Math.hypot(x - S * 0.28, y - S * 0.18) / (S * 0.62));
    return [...mix(base, [120, 90, 220], glow * 0.45), 1];
  });

// 金色公文包
const GOLD1 = [255, 216, 120], GOLD2 = [246, 168, 40], GOLD3 = [201, 118, 18];
const cx = S / 2, cy = S * 0.56, bw = S * 0.60, bh = S * 0.42;
// 提手
fillShape((x, y) => {
  const outer = rrSDF(x, y, cx, S * 0.335, S * 0.28, S * 0.20, S * 0.075);
  const inner = rrSDF(x, y, cx, S * 0.352, S * 0.19, S * 0.18, S * 0.045);
  return Math.max(outer, -inner);
}, () => [...GOLD2, 1]);
// 阴影
fillShape((x, y) => rrSDF(x, y, cx, cy + S * 0.022, bw, bh, S * 0.055), () => [0, 0, 0, 0.30]);
// 包体
fillShape((x, y) => rrSDF(x, y, cx, cy, bw, bh, S * 0.055),
  (x, y) => { const t = clamp01((y - (cy - bh / 2)) / bh); return [...(t < 0.5 ? mix(GOLD1, GOLD2, t * 2) : mix(GOLD2, GOLD3, (t - .5) * 2)), 1]; });
// 中缝
fillShape((x, y) => rrSDF(x, y, cx, cy - S * 0.012, bw, S * 0.028, S * 0.014), () => [150, 88, 12, 0.55]);
// 锁扣
fillShape((x, y) => rrSDF(x, y, cx, cy - S * 0.012, S * 0.075, S * 0.062, S * 0.018), () => [255, 240, 200, 1]);

// 上涨折线（放在包体上方偏右）
const pts = [[0.28, 0.755], [0.40, 0.685], [0.505, 0.715], [0.615, 0.605], [0.745, 0.505]].map(([a, b]) => [S * a, S * b]);
function segSDF(px, py, x1, y1, x2, y2, r) {
  const vx = x2 - x1, vy = y2 - y1, wx = px - x1, wy = py - y1;
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t)) - r;
}
fillShape((x, y) => {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segSDF(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], S * 0.0125));
  return d;
}, () => [64, 240, 176, 0.95]);
// 箭头端点
fillShape((x, y) => Math.hypot(x - pts[4][0], y - pts[4][1]) - S * 0.028, () => [64, 240, 176, 1]);

// ── 超采样降到 1024 ─────────────────────────────────────────
const N = 1024, out = Buffer.alloc(N * N * 4);
const k = S / N;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  let r = 0, g = 0, b = 0, a = 0;
  for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
    const i = ((y * k + dy) * S + (x * k + dx)) * 4;
    r += buf[i] * buf[i + 3]; g += buf[i + 1] * buf[i + 3]; b += buf[i + 2] * buf[i + 3]; a += buf[i + 3];
  }
  const n = k * k, o = (y * N + x) * 4;
  out[o] = a > 0 ? Math.round(r / a) : 0;
  out[o + 1] = a > 0 ? Math.round(g / a) : 0;
  out[o + 2] = a > 0 ? Math.round(b / a) : 0;
  out[o + 3] = Math.round(255 * a / n);
}
fs.writeFileSync(path.join(OUT, 'icon-1024.png'), encodePNG(N, N, out));
console.log('✅ build/icon-1024.png');
