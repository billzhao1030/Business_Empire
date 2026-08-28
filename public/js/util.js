import { lang, t } from './i18n.js';

// ── 数字格式化 ──────────────────────────────────────────────
export function money(n, dp) {
  if (n == null || !isFinite(n)) return '--';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(dp ?? 2) + 'T';
  if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(dp ?? 2) + 'B';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(dp ?? 2) + 'M';
  if (a >= 1e4) return s + '$' + (a / 1e3).toFixed(dp ?? 1) + 'K';
  if (a >= 1) return s + '$' + a.toLocaleString('en-US', { maximumFractionDigits: dp ?? 0 });
  return s + '$' + a.toFixed(dp ?? 2);
}
export function moneyFull(n) {
  if (n == null || !isFinite(n)) return '--';
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function price(n) {
  if (n == null || !isFinite(n)) return '--';
  const a = Math.abs(n);
  if (a >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (a >= 1) return '$' + n.toFixed(2);
  if (a >= 0.01) return '$' + n.toFixed(4);
  if (a >= 0.0001) return '$' + n.toFixed(6);
  return '$' + n.toExponential(3);
}
export function pct(x, dp = 2) {
  if (x == null || !isFinite(x)) return '--';
  return (x >= 0 ? '+' : '') + (x * 100).toFixed(dp) + '%';
}
export function pctPlain(x, dp = 1) { return (x * 100).toFixed(dp) + '%'; }
export function qty(n) {
  if (n == null) return '--';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (a >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
export function int(n) { return Math.round(n).toLocaleString('en-US'); }
export const cls = x => x > 0 ? 'up' : x < 0 ? 'down' : 'dim';
export const arrow = x => x > 0 ? '▲' : x < 0 ? '▼' : '·';

// 游戏时间
export function gDate(h) {
  const y = 2026 + Math.floor(h / 8640), r1 = h % 8640;
  const m = Math.floor(r1 / 720) + 1, r2 = r1 % 720;
  const d = Math.floor(r2 / 24) + 1, hh = r2 % 24;
  const p = n => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)} ${p(hh)}:00`;
}
export function gShort(h) {
  const r1 = h % 8640, m = Math.floor(r1 / 720) + 1, r2 = r1 % 720;
  const d = Math.floor(r2 / 24) + 1, hh = r2 % 24;
  const p = n => String(n).padStart(2, '0');
  return `${p(m)}/${p(d)} ${p(hh)}:00`;
}
export function hoursAgo(h, now) {
  const d = now - h;
  if (d < 1) return t('time.now');
  if (d < 24) return lang === 'zh' ? `${d} 小时前` : `${d}h ago`;
  if (d < 720) return lang === 'zh' ? `${Math.floor(d / 24)} 天前` : `${Math.floor(d / 24)}d ago`;
  return lang === 'zh' ? `${Math.floor(d / 720)} 个月前` : `${Math.floor(d / 720)}mo ago`;
}
export function durText(hours) {
  const d = Math.floor(hours / 24), h = Math.round(hours % 24);
  if (hours >= 720) { const mo = Math.floor(hours / 720); return lang === 'zh' ? `${mo} 个月` : `${mo} mo`; }
  if (d > 0) return lang === 'zh' ? `${d} 天 ${h} 小时` : `${d}d ${h}h`;
  return lang === 'zh' ? `${h} 小时` : `${h}h`;
}

// ── DOM ─────────────────────────────────────────────────────
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, kind = 'ok', title) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = (title ? `<b>${esc(title)}</b>` : '') + esc(msg);
  root.appendChild(el);
  setTimeout(() => { el.style.transition = '.3s'; el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}

let modalStack = [];
export function modal({ title, icon = '', body, footer = '', wide = false, onMount }) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">
    <div class="modal-h">${icon ? `<div class="ico">${icon}</div>` : ''}<h3>${title}</h3><button class="x">&times;</button></div>
    <div class="modal-b">${body}</div>
    ${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  document.body.appendChild(mask);
  const close = () => { mask.remove(); modalStack = modalStack.filter(m => m !== mask); };
  mask.querySelector('.x').onclick = close;
  mask.onclick = e => { if (e.target === mask) close(); };
  modalStack.push(mask);
  onMount?.(mask, close);
  return { el: mask, close };
}
export function closeAllModals() { modalStack.forEach(m => m.remove()); modalStack = []; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalStack.length) modalStack.pop().remove(); });

export function confirmBox(title, text, okText) {
  return new Promise(res => {
    const m = modal({
      title, body: `<p style="line-height:1.75;color:var(--dim)">${text}</p>`,
      footer: `<button class="btn btn-ghost" data-no>${t('common.cancel')}</button><button class="btn btn-primary" data-yes>${okText || t('common.confirm')}</button>`,
      onMount(el, close) {
        el.querySelector('[data-no]').onclick = () => { close(); res(false); };
        el.querySelector('[data-yes]').onclick = () => { close(); res(true); };
      }
    });
  });
}

// ── 账本条目本地化渲染 ──────────────────────────────────────
import { nm, lifeText } from './i18n.js';
const MONEY_K = new Set(['amt','cost','rev','value','gain','tax','fee','pen','interest','total','left','payment','down','profit','payoff','price']);
const PRICE_K = new Set(['px']);
const PCT_K = new Set(['rate','premium']);
export function renderLedger(detail) {
  let o;
  try { o = JSON.parse(detail); } catch { return esc(detail); }
  if (!o || !o.k) return esc(detail);
  const p = { ...(o.p || {}) };
  if (o.k === 'led.life') return `${esc(lifeText(p.id))}${p.amt ? `（${p.amt > 0 ? '+' : ''}${money(p.amt)}）` : ''}${p.prestige ? `，${nm({ zh: '声望', en: 'prestige' })} ${p.prestige > 0 ? '+' : ''}${p.prestige}` : ''}`;
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v && typeof v === 'object') p[k] = esc(nm(v));
    else if (typeof v === 'number') {
      if (MONEY_K.has(k)) p[k] = money(v);
      else if (PRICE_K.has(k)) p[k] = price(v);
      else if (PCT_K.has(k)) p[k] = pctPlain(v);
      else if (k === 'qty') p[k] = qty(v);
      else p[k] = String(v);
    } else p[k] = esc(v);
  }
  return t(o.k, p);
}
export function newsLine(headline) {
  try { const o = JSON.parse(headline); return esc(nm(o)); } catch { return esc(headline); }
}
