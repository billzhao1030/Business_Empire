// 生成 public/data/cities.json —— 世界城市图集
//
// 数据源：Natural Earth（公有领域，无使用限制）
//   ne_10m_populated_places   7,342 座城市，含中英文名、人口、首都/世界城市标记
//   ne_10m_admin_0_countries  国家的中英文名、收入分组、所属大洲
// 用法：node tools/build-cities.mjs
//
// 输出是压缩过的数组格式：整份 GeoJSON 有 19MB，游戏只需要其中 8 个字段。
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const RAW = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const CACHE = process.env.NE_CACHE || '/tmp/ne-cache';
const OUT = 'public/data/cities.json';

async function load(name) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, name);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  process.stdout.write(`下载 ${name} …`);
  const r = await fetch(RAW + name);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const text = await r.text();
  writeFileSync(file, text);
  console.log(` ${(text.length / 1e6).toFixed(1)} MB`);
  return JSON.parse(text);
}

// 收入分组 → 物价指数。酒店、日常开销、房租、工资都按这个缩放。
const INCOME = { '1': 1.00, '2': 0.92, '3': 0.58, '4': 0.38, '5': 0.26 };
const tierOf = grp => (grp && /^[1-5]/.test(grp) ? grp[0] : '3');

// 大洲 → 游戏里的地区筛选
function regionOf(continent, subregion) {
  switch (continent) {
    case 'Oceania': return 'oceania';
    case 'Europe': return 'europe';
    case 'Africa': return subregion === 'Northern Africa' ? 'africa' : 'africa';
    case 'North America': return 'namerica';
    case 'South America': return 'samerica';
    case 'Antarctica': case 'Seven seas (open ocean)': return 'polar';
    case 'Asia': return subregion === 'Western Asia' ? 'mideast' : 'asia';
    default: return 'asia';
  }
}

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

const [places, countries] = await Promise.all([
  load('ne_10m_populated_places.geojson'),
  load('ne_10m_admin_0_countries.geojson'),
]);

// ── 国家表 ────────────────────────────────────────────────
const byIso = new Map();
for (const f of countries.features) {
  const p = f.properties;
  const iso = (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') ? p.ISO_A2_EH
            : (p.ISO_A2 && p.ISO_A2 !== '-99') ? p.ISO_A2 : null;
  if (!iso || byIso.has(iso)) continue;
  byIso.set(iso, {
    iso, zh: p.NAME_ZH || p.NAME_EN || p.NAME, en: p.NAME_EN || p.NAME,
    tier: tierOf(p.INCOME_GRP), region: regionOf(p.CONTINENT, p.SUBREGION),
  });
}
// 城市里出现、但国家表里没有的（法属圭亚那、留尼汪等），用城市自带的国名兜底
for (const f of places.features) {
  const p = f.properties, iso = p.ISO_A2;
  if (!iso || iso === '-99' || byIso.has(iso)) continue;
  byIso.set(iso, { iso, zh: p.ADM0NAME, en: p.ADM0NAME, tier: '3', region: 'asia' });
}

// ── 城市 ──────────────────────────────────────────────────
const seen = new Map();
const cities = [];
for (const f of places.features) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const iso = (p.ISO_A2 && p.ISO_A2 !== '-99') ? p.ISO_A2 : null;
  const c = iso ? byIso.get(iso) : null;
  if (!c) continue;
  const en = p.NAME_EN || p.NAME;
  const zh = p.NAME_ZH || en;
  const pop = Math.max(0, p.POP_MAX | 0);
  const flags = (p.ADM0CAP ? 1 : 0) | (p.WORLDCITY ? 2 : 0) | (p.MEGACITY ? 4 : 0);
  let id = slug(p.NAMEASCII || en) + '.' + iso.toLowerCase();
  if (seen.has(id)) { const n = seen.get(id) + 1; seen.set(id, n); id += '-' + n; } else seen.set(id, 1);
  cities.push([id, en, zh, iso, Math.round(lon * 1e3), Math.round(lat * 1e3), pop, flags]);
}
cities.sort((a, b) => b[6] - a[6]);      // 按人口降序：画标注时先大后小

const out = {
  source: 'Natural Earth 10m populated places + admin 0 countries (public domain)',
  fields: ['id', 'en', 'zh', 'iso', 'lon*1e3', 'lat*1e3', 'pop', 'flags(1=capital,2=world,4=mega)'],
  income: INCOME,
  countries: [...byIso.values()].map(c => [c.iso, c.zh, c.en, c.tier, c.region]),
  cities,
};
writeFileSync(OUT, JSON.stringify(out));
const kb = (readFileSync(OUT).length / 1024).toFixed(0);
console.log(`✅ ${OUT}  ${cities.length} 座城市 / ${out.countries.length} 个国家地区 / ${kb} KB`);
