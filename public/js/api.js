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
  state: () => req('/api/state'),
  market: kind => req('/api/market' + (kind ? '?kind=' + kind : '')),
  sparks: () => req('/api/sparks'),
  asset: (symbol, points = 300) => req(`/api/asset?symbol=${encodeURIComponent(symbol)}&points=${points}`),
  catalog: () => req('/api/catalog'),
  leaderboard: () => req('/api/leaderboard'),
  richlist: () => req('/api/richlist'),
  overview: () => req('/api/overview'),
  takeJob: jobId => post('/api/job', { jobId }),
  hustle: () => post('/api/hustle', {}),
  treat: () => post('/api/treat', {}),
  dayOff: () => post('/api/dayoff', {}),
  living: (mealId, homeId) => post('/api/living', { mealId, homeId }),
  lottery: (id, n) => post('/api/lottery', { id, n }),
  trip: (tripId, cls) => post('/api/trip', { tripId, cls }),
  trade: (symbol, side, qty) => post('/api/trade', { symbol, side, qty }),
  takeover: symbol => post('/api/takeover', { symbol }),
  bizBuy: (typeId, cityId, name) => post('/api/biz/buy', { typeId, cityId, name }),
  bizAction: (id, action, extra = {}) => post('/api/biz/action', { id, action, ...extra }),
  bank: (action, p = {}) => post('/api/bank', { action, ...p }),
  itemBuy: (typeId, fin) => post('/api/item/buy', { typeId, ...(fin || {}) }),
  itemAction: (id, action) => post('/api/item/action', { id, action }),
  reset: () => post('/api/reset', {}),
};
