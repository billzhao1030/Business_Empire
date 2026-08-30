const KEY = 'be_token';
export let token = localStorage.getItem(KEY) || null;
export function setToken(t) { token = t; t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); }

const OFFLINE_MSG = () => (localStorage.getItem('be_lang') || 'zh') === 'zh'
  ? '连接不上游戏服务，请确认它还在运行（双击桌面图标即可重启）'
  : 'Cannot reach the game server — make sure it is still running (double-click the desktop icon to restart it)';

async function req(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
    method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error(OFFLINE_MSG()); e.offline = true; throw e;
  }
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
  return data;
}
const post = (p, b) => req(p, { method: 'POST', body: b });

export const api = {
  register: (username, password, nickname) => post('/api/register', { username, password, nickname }),
  login: (username, password) => post('/api/login', { username, password }),
  logout: () => post('/api/logout', {}),
  state: (active = true) => req('/api/state?active=' + (active ? 1 : 0)),
  market: kind => req('/api/market' + (kind ? '?kind=' + kind : '')),
  sparks: () => req('/api/sparks'),
  asset: (symbol, points = 300) => req(`/api/asset?symbol=${encodeURIComponent(symbol)}&points=${points}`),
  catalog: () => req('/api/catalog'),
  leaderboard: () => req('/api/leaderboard'),
  richlist: () => req('/api/richlist'),
  companyBoard: () => req('/api/companyboard'),
  overview: () => req('/api/overview'),
  takeJob: jobId => post('/api/job', { jobId }),
  hustle: () => post('/api/hustle', {}),
  treat: () => post('/api/treat', {}),
  dayOff: () => post('/api/dayoff', {}),
  living: (mealId, homeId, commuteId) => post('/api/living', { mealId, homeId, commuteId }),
  company: (coId, want) => post('/api/company', { coId, ...(want || {}) }),
  coFound: (name, nameEn, ticker, sector, shopIds) => post('/api/company/found', { name, nameEn, ticker, sector, shopIds }),
  coShops: (add, remove, coId) => post('/api/company/shops', { add, remove, coId }),
  coRaise: (coId) => post('/api/company/raise', { coId }),
  coDividend: (amount, coId) => post('/api/company/dividend', { amount, coId }),
  coFund: (amount, coId) => post('/api/company/fund', { amount, coId }),
  coIpo: (coId, price, float) => post('/api/company/ipo', { coId, price, float }),
  bizCities: (q, typeId) => post('/api/biz/cities', { q, typeId }),
  place: (id) => post('/api/place', { id }),
  citySearch: (q, limit) => post('/api/citysearch', { q, limit }),
  nearest: (lon, lat, minPop) => post('/api/nearest', { lon, lat, minPop }),
  lottery: (id, n) => post('/api/lottery', { id, n }),
  world: () => req('/api/world'),
  birthplace: id => post('/api/birthplace', { id }),
  speed: ms => post('/api/speed', { ms }),
  travel: (destId, nights, cabin, hotel, oneWay) => post('/api/trip', { destId, nights, cabin, hotel, oneWay }),
  trip: (tripId, cls) => post('/api/trip', { tripId, cls }),
  trade: (symbol, side, qty) => post('/api/trade', { symbol, side, qty }),
  takeover: symbol => post('/api/takeover', { symbol }),
  bizBuy: (typeId, cityId, name, coId) => post('/api/biz/buy', { typeId, cityId, name, coId, useCompany: !!coId }),
  bizAction: (id, action, extra = {}) => post('/api/biz/action', { id, action, ...extra }),
  bank: (action, p = {}) => post('/api/bank', { action, ...p }),
  itemBuy: (typeId, fin) => post('/api/item/buy', { typeId, ...(fin || {}) }),
  itemAction: (id, action) => post('/api/item/action', { id, action }),
  setLook: (o) => post('/api/look', o),
  setSweep: (keep) => post('/api/sweep', { keep }),
  renameMe: (o) => post('/api/rename', o),
  coRename: (name, nameEn, coId) => post('/api/company/rename', { name, nameEn, coId }),
  coSplit: (ratio, reverse, coId) => post('/api/company/split', { ratio, reverse, coId }),
  leisure: (actId) => post('/api/leisure', { actId }),
  reset: () => post('/api/reset', {}),
};
