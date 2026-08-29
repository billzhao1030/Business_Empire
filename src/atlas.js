// ── 世界城市图集：7,330 座真实城市 ────────────────────────────
// 数据由 tools/build-cities.mjs 从 Natural Earth（公有领域）生成。
// 精选的 41 个目的地有手写的文案与数值；其余城市的物价、声望和放松程度
// 都是推出来的：国家的收入分组决定物价水平，城市人口决定规模溢价。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(HERE, '..', 'public', 'data', 'cities.json'), 'utf8'));

// 收入分组 → 物价指数（1 = 高收入 OECD 国家的水平）
const INCOME = RAW.income;

export const COUNTRIES = new Map(RAW.countries.map(([iso, zh, en, tier, region]) =>
  [iso, { iso, zh, en, tier, region, cost: INCOME[tier] ?? 0.58 }]));

// ISO 双字母码 → 国旗（区域指示符）
const flagOf = iso => String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));

// 大城市什么都贵：以 5 万人口为基准，每涨一个数量级加两成
const sizeMult = pop => Math.min(1.60, Math.max(0.70, 0.72 + 0.20 * Math.log10(Math.max(pop, 5000) / 50000)));

const CAP = 1, WORLD = 2, MEGA = 4;

function derive(row) {
  const [id, en, zh, iso, lonI, latI, pop, flags] = row;
  const c = COUNTRIES.get(iso);
  const size = sizeMult(pop);
  const cost = c.cost * size;
  const hotel = Math.max(12, Math.round(140 * cost));      // 三星标准每晚
  const spend = Math.max(8, Math.round(hotel * 0.6));      // 每日餐饮交通杂费
  const relief = 5 + (flags & WORLD ? 1 : 0) + (flags & CAP ? 1 : 0) + (pop >= 5e6 ? 1 : 0);
  const prestige = Math.min(8, (flags & WORLD ? 4 : 0) + (flags & CAP ? 1 : 0)
    + (pop >= 10e6 ? 2 : pop >= 3e6 ? 1 : 0) + (c.tier <= '2' ? 1 : 0));
  return {
    id, zh, en, iso, pop, flags,
    // 搜索用的键：去掉重音，Reykjavik 也要能搜到 Reykjavík
    key: en.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    country: c.zh, countryEn: c.en, flag: flagOf(iso), region: c.region,
    lon: lonI / 1e3, lat: latI / 1e3,
    hotel, spend, relief, prestige, atlas: true,
    capital: !!(flags & CAP), worldCity: !!(flags & WORLD), costIndex: cost,
  };
}

// 7,330 座城市全部展开一次（约 6 MB 内存），之后都是 O(1) 查表
export const ATLAS = RAW.cities.map(derive);                 // 已按人口降序
export const ATLAS_BY_ID = new Map(ATLAS.map(c => [c.id, c]));
export const CITY_COUNT = ATLAS.length;

export function atlasCity(id) { return ATLAS_BY_ID.get(id) || null; }

// 搜索：中英文都能搜，按人口排序，前缀匹配优先
export function searchCities(q, limit = 40) {
  const s = String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (!s) return [];
  const pre = [], mid = [];
  for (const c of ATLAS) {                                   // 已按人口降序，先命中的就是大城市
    const i = c.key.indexOf(s), j = c.zh.indexOf(s);
    if (i === 0 || j === 0) pre.push(c);
    else if (i > 0 || j > 0) mid.push(c);
    else if (c.countryEn.toLowerCase().startsWith(s) || c.country.startsWith(s)) mid.push(c);
    if (pre.length >= limit) break;
  }
  return pre.concat(mid).slice(0, limit);
}

// 落 pin：找离这个经纬度最近的城市
export function nearestCity(lon, lat, minPop = 0) {
  let best = null, bd = Infinity;
  const rad = Math.PI / 180, cl = Math.cos(lat * rad);
  for (const c of ATLAS) {
    if (c.pop < minPop) continue;
    const dx = (c.lon - lon) * cl, dy = c.lat - lat;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
