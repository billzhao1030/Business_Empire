// ── 在全世界任何一座城市开店 ────────────────────────────────
// 六个抽象档位（乡镇/本市/区域中心…）换成 7,330 座真实城市。
// 每座城市的经营参数都是推出来的，基准是你自己的家乡 —— 在家门口开店
// 永远是 1.00，其余城市相对它有多贵、多热闹，由两件事决定：
//   物价水平 costIndex = 所在国家的收入分组 × 城市规模溢价
//   客流     人口，外加世界城市 / 首都的溢价
import { atlasCity, nearestCity, routeOf, distanceKm } from './catalog-world.js';
import { CITIES } from './catalog-content.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LEGACY = Object.fromEntries(CITIES.map(c => [c.id, c]));

// 客流：以 5 万人口为基准，每涨一个数量级抬 28%
const footfall = pop => clamp(0.60 + 0.28 * Math.log10(Math.max(5000, pop) / 50000), 0.55, 2.0);
// 世界城市和首都的商业地段本来就更旺、也更贵
const hub = c => 1 + ((c.flags & 2) ? 0.34 : 0) + ((c.flags & 1) ? 0.10 : 0);

export function cityEconomy(city, home) {
  if (!city || !home) return null;
  const rel = city.costIndex / home.costIndex;         // 相对家乡的物价
  const f = footfall(city.pop) / footfall(home.pop);   // 相对家乡的客流
  const h = hub(city) / hub(home);
  return {
    // 建店成本跟着物价和客流一起涨，而且涨得比营收快——黄金地段的铺位
    // 光是拿下来就是一笔钱。下限 0.40：设备、装修、执照是按国际价走的，
    // 再穷的地方也不可能几乎白开一家店。
    costMult: Math.max(0.40, Math.pow(rel, 1.15) * Math.pow(f, 1.00) * Math.pow(h, 0.95)),
    // 营收随物价和客流上升，但都不是线性的——大城市不会按人口成比例地更赚钱
    revMult: Math.pow(rel, 0.70) * Math.pow(f, 0.80) * Math.pow(h, 0.70),
    // 房租涨得比营收快，这是大城市开店最难受的地方。下限 0.18：地是有价的。
    rentMult: Math.max(0.18, Math.pow(rel, 1.40) * Math.pow(f, 1.30) * Math.pow(h, 1.25)),
    wageMult: rel,
    vol: clamp(0.70 + 0.30 * Math.log10(Math.max(5000, city.pop) / 50000), 0.55, 1.9),
  };
}

// 去外地开店要亲自跑一趟：机票按真实大圆距离算，人也要离开几天
export function cityTravel(city, home) {
  if (!city || !home || city.id === home.id) return { travelCost: 0, travelDays: 0, km: 0, hours: 0 };
  const rt = routeOf(home, city);
  const days = rt.hours <= 0 ? 0 : rt.hours < 2 ? 1 : rt.hours < 6 ? 2 : rt.hours < 12 ? 3 : 4;
  // 往返机票 + 在外面几天的食宿
  const stay = Math.round(city.hotel * 1.15 * days);
  return { travelCost: Math.round(rt.fare + stay), travelDays: days, km: rt.km, hours: rt.hours };
}

// 一座城市在开店系统里的完整档案。老存档里的抽象档位继续可用。
export function cityOf(id, home) {
  if (!id) return null;
  if (LEGACY[id]) return LEGACY[id];
  const c = atlasCity(id);
  if (!c) return null;
  if (!home) return null;
  const e = cityEconomy(c, home);
  const t = cityTravel(c, home);
  return {
    id: c.id, name: c.zh, en: c.en, flag: c.flag, atlas: true,
    country: c.country, countryEn: c.countryEn, region: c.region,
    lon: c.lon, lat: c.lat, pop: c.pop, capital: c.capital, worldCity: c.worldCity,
    ...e, ...t,
    desc: `${c.country} · 人口 ${popText(c.pop, 'zh')}${c.worldCity ? ' · 世界城市' : c.capital ? ' · 首都' : ''}`,
    descEn: `${c.countryEn} · population ${popText(c.pop, 'en')}${c.worldCity ? ' · world city' : c.capital ? ' · capital' : ''}`,
  };
}

export function popText(n, lang = 'zh') {
  if (!n) return '—';
  if (lang === 'en') return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : (n / 1e3).toFixed(0) + 'k';
  return n >= 1e4 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + ' 万' : String(n);
}
export { LEGACY as LEGACY_CITIES };
