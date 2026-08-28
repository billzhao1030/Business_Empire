import { api, token, setToken } from './api.js';
import { t, nm, lang, setLang, onLangChange } from './i18n.js';
import { $, $$, money, moneyFull, price, pct, cls, esc, toast, closeAllModals, gDate } from './util.js';
import { showOfflineReport } from './offline.js';

import dashboard from './views/dashboard.js';
import business from './views/business.js';
import market from './views/market.js';
import portfolio from './views/portfolio.js';
import bank from './views/bank.js';
import luxury from './views/luxury.js';
import ledger from './views/ledger.js';
import rank from './views/rank.js';
import career from './views/career.js';
import about from './views/about.js';

const VIEWS = { dashboard, career, business, market, portfolio, bank, luxury, ledger, rank, about };
export const THEMES = ['neon', 'midnight', 'daylight'];
export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('be_theme', t);
  $$('#theme-switch button').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}

export const app = {
  state: null, catalog: null, view: 'dashboard', viewObj: null,
  clockBase: { hour: 0, progress: 0, at: 0 },

  async boot() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    applyTheme(localStorage.getItem('be_theme') || 'neon');
    try {
      const ping = await (await fetch('/api/ping')).json();
      this.serverBuild = ping.build;
      this.hourMinutes = 2;
    } catch {}
    this.paintAuthTexts();
    if (token) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await this.enter(); return; }
        catch (e) {
          if (e.status === 401) { setToken(null); break; }   // 凭证真的失效了
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));   // 网络/服务未就绪：重试，别登出
        }
      }
    }
    $('#auth').classList.remove('hidden');
    $('#app').classList.add('hidden');
  },

  paintAuthTexts() {
    const a = $('#auth');
    if (!a) return;
    a.querySelector('.auth-sub').textContent = t('auth.tagline');
    const tabs = a.querySelectorAll('.auth-tab');
    tabs[0].textContent = t('auth.login'); tabs[1].textContent = t('auth.register');
    const fields = a.querySelectorAll('.field');
    fields[0].querySelector('span').textContent = t('auth.user');
    fields[0].querySelector('input').placeholder = t('auth.userPh');
    fields[1].querySelector('span').textContent = t('auth.pass');
    fields[1].querySelector('input').placeholder = t('auth.passPh');
    fields[2].querySelector('span').textContent = t('auth.nick');
    fields[2].querySelector('input').placeholder = t('auth.nickPh');
    $('#auth-submit').textContent = t('auth.enter');
    const f = a.querySelector('.auth-foot');
    f.children[0].innerHTML = t('auth.foot1');
    f.children[1].textContent = t('auth.foot2', { m: this.hourMinutes ?? 2 });
  },

  async enter() {
    const [state, catalog] = await Promise.all([api.state(), api.catalog()]);
    this.state = state; this.catalog = catalog;
    this.syncClock();
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    this.paintNav();
    this.go(this.view, true);
    this.startLoops();
    if (state.offline) setTimeout(() => showOfflineReport(state.offline, this), 380);
  },

  paintNav() {
    $$('.nav-item[data-view]').forEach(b => {
      b.querySelector('.nt').textContent = t('nav.' + b.dataset.view);
    });
    $('#btn-logout').querySelector('.nt').textContent = t('common.logout');
    $('.brand-text').innerHTML = `BUSINESS<em>EMPIRE</em>`;
  },

  syncClock() {
    this.clockBase = { hour: this.state.now.hour, progress: this.state.now.progress, at: Date.now() };
  },
  liveHour() {
    const el = (Date.now() - this.clockBase.at) / 60000;
    const p = this.clockBase.progress + el;
    return { hour: this.clockBase.hour + Math.floor(p), frac: p % 1 };
  },

  startLoops() {
    clearInterval(this._t1); clearInterval(this._t2);
    this._t1 = setInterval(() => this.paintClock(), 250);
    this._t2 = setInterval(() => this.refresh(), 5000);
    this.paintClock();
  },

  paintClock() {
    const { hour, frac } = this.liveHour();
    const d = gDate(hour), hod = hour % 24;
    const dt = $('#tc-date'), tm = $('#tc-time'), pr = $('#tc-prog'), ph = $('#tc-phase');
    if (!dt) return;
    dt.textContent = d.slice(0, 10);
    tm.textContent = String(hod).padStart(2, '0') + ':' + String(Math.floor(frac * 60)).padStart(2, '0');
    pr.style.width = (frac * 100) + '%';
    const j = this.state?.job;
    const phase = hod >= (j?.sleepHour ?? 23) || hod < (j?.wakeHour ?? 7) ? 'sleep'
      : hod < (j?.workStart ?? 9) ? 'morning' : hod < (j?.workEnd ?? 17) ? 'shift' : 'evening';
    ph.className = 'tc-phase ' + phase;
    ph.textContent = t('phase.' + phase);
  },

  netFails: 0,
  setOnline(ok, msg) {
    const bar = $('#offline-bar');
    if (ok) { bar.classList.add('hidden'); this.netFails = 0; return; }
    bar.classList.remove('hidden');
    $('#offline-msg').textContent = msg || t('net.lost');
  },

  async refresh(full = false) {
    try {
      const prevOffline = this.state?.offline;
      this.state = await api.state();
      this.syncClock();
      this.paintTop();
      if (this.state.offline && !prevOffline) showOfflineReport(this.state.offline, this);
      // 只做增量更新。绝不在后台整页重绘——那会把用户正在进行的操作结果冲掉
      if (full) this.renderView();
      else if (this.viewObj?.patch && !this.busy) this.viewObj.patch(this);
      this.setOnline(true);
      if (this.build && this.build !== this.state.build) {
        this.build = this.state.build;
        toast(t('net.newBuild'), 'warn');
        setTimeout(() => location.reload(), 1500);
      } else if (!this.build) this.build = this.state.build;
    } catch (e) {
      if (e.status === 401) { setToken(null); location.reload(); return; }
      this.netFails++;
      if (this.netFails >= 2) this.setOnline(false, e.offline ? e.message : t('net.lost'));
    }
  },

  // 有请求在飞时挂起后台更新，避免打断正在进行的操作
  busy: false,
  async guard(fn) {
    this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  },

  paintTop() {
    const s = this.state;
    $('#view-title').textContent = t('nav.' + this.view);
    $('#view-sub').textContent = t('sub.' + this.view);
    $('#tb-nw').textContent = money(s.netWorth.total);
    $('#tb-nw').className = 'mono ' + (s.netWorth.total >= 0 ? '' : 'down');
    $('#tb-cash').textContent = money(s.player.cash);
    $('#tb-cash').className = 'mono ' + (s.player.cash < 0 ? 'down' : '');
    $('#tb-idx').innerHTML = `<span class="${cls(s.index.change)}">${s.index.level.toFixed(0)} ${pct(s.index.change)}</span>`;
    $('#tb-credit').innerHTML = `<span class="${s.player.creditScore >= 700 ? 'up' : s.player.creditScore >= 550 ? '' : 'down'}">${s.player.creditScore}</span>`;
    $('#tb-title-chip').textContent = `${s.title.icon} ${nm(s.title)}`;
    $$('.tbs label')[0].textContent = t('common.netWorth');
    $$('.tbs label')[1].textContent = t('common.cash');
    $$('.tbs label')[2].textContent = t('mkt.marketIndex');
    $$('.tbs label')[3].textContent = t('common.credit');
    $('#badge-biz').textContent = s.businesses.length || '';
    $('#badge-pf').textContent = s.holdings.length || '';
  },

  go(view, force) {
    if (!VIEWS[view]) return;
    if (view === this.view && !force) return;
    this.view = view;
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    this.paintTop();
    this.renderView();
  },

  renderView() {
    const v = VIEWS[this.view];
    this.viewObj = v;
    const root = $('#view');
    root.scrollTop = this._scroll?.[this.view] ?? 0;
    v.render(root, this);
  },

  async act(fn, okMsg) {
    try {
      const r = await this.guard(fn);
      if (okMsg) toast(okMsg, 'ok');
      await this.refresh(true);
      return r;
    } catch (e) { toast(e.message, 'err', t('toast.failed')); throw e; }
  },
};

// ── 登录页 ──────────────────────────────────────────────────
let authMode = 'login';
$$('.auth-tab').forEach(b => b.onclick = () => {
  authMode = b.dataset.mode;
  $$('.auth-tab').forEach(x => x.classList.toggle('active', x === b));
  $('#nick-field').classList.toggle('hidden', authMode !== 'register');
  $('#auth-err').textContent = '';
});
$('#auth-form').onsubmit = async e => {
  e.preventDefault();
  const u = $('#au-user').value.trim(), p = $('#au-pass').value, n = $('#au-nick').value.trim();
  const btn = $('#auth-submit'); btn.disabled = true;
  try {
    const r = authMode === 'login' ? await api.login(u, p) : await api.register(u, p, n);
    setToken(r.token);
    await app.enter();
    toast(t('toast.welcome'), 'ok');
  } catch (err) { $('#auth-err').textContent = err.message; }
  finally { btn.disabled = false; }
};
$$('.nav-item[data-view]').forEach(b => b.onclick = () => app.go(b.dataset.view));
$$('#theme-switch button').forEach(b => b.onclick = () => applyTheme(b.dataset.theme));
$$('#lang-switch button').forEach(b => {
  b.classList.toggle('active', b.dataset.lang === lang);
  b.onclick = () => {
    setLang(b.dataset.lang);
    $$('#lang-switch button').forEach(x => x.classList.toggle('active', x.dataset.lang === b.dataset.lang));
  };
});
$('#btn-logout').onclick = async () => {
  try { await api.logout(); } catch {}
  setToken(null); location.reload();
};
onLangChange(() => {
  app.paintAuthTexts();
  if (app.state) { app.paintNav(); app.paintTop(); app.renderView(); }
});
// 任何未捕获的前端错误都要看得见，而不是「点了没反应」
window.addEventListener('error', e => {
  if (e.message && !/ResizeObserver/.test(e.message)) toast(e.message, 'err', t('net.jsError'));
});
window.addEventListener('unhandledrejection', e => {
  const m = e.reason?.message || String(e.reason || '');
  if (m) toast(m, 'err', t('net.jsError'));
});
$('#offline-retry').onclick = () => app.refresh(true);
window.app = app;
app.boot();
