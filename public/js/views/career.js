import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast, durText } from '../util.js';

let cooldownTimer = null;

export default {
  render(root, app) {
    const s = app.state, j = s.job;
    const cur = j.current;
    const otLeft = j.otMax - j.otUsed;
    const next = s.job.list.find(x => !x.unlocked);
    const expToNext = next ? next.exp - j.exp : 0;
    const prog = next ? Math.min(1, j.exp / next.exp) : 1;

    root.innerHTML = `
    <div class="grid" style="grid-template-columns:1.15fr 1fr;margin-bottom:16px">
      <div class="hustle-card">
        <div style="display:flex;align-items:center;gap:13px;margin-bottom:14px">
          <div class="ico lg" style="font-size:26px">${cur ? cur.emoji : '🧳'}</div>
          <div style="flex:1;min-width:0">
            <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.5px">${t('career.current')}</div>
            <div style="font-size:19px;font-weight:800">${cur ? esc(nm({ zh: cur.zh, en: cur.en })) : t('career.resting')}</div>
            ${cur ? `<div class="dim" style="font-size:12px;margin-top:2px">${t('career.wage')} <b class="gold mono">${money(cur.wage)}</b>${t('common.perHour')}
              · ${t('career.dailyWage')} <b class="mono">${money(j.dailyWage)}</b>
              <span class="tag ${j.onShift ? 'g' : ''}">${j.onShift ? t('career.onShift') : t('career.offShift')}</span></div>` : ''}
          </div>
        </div>
        ${!j.working && cur ? `<div class="summary" style="border-color:var(--down);color:var(--down);margin-bottom:12px;font-size:12px">${t('career.needCar')} — ${t('career.carHint')}</div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px">
          <span class="dim">${t('career.otToday')}</span>
          <b class="mono ${otLeft > 0 ? 'gold' : 'dim2'}">${j.otUsed} / ${j.otMax} ${t('common.hour')}</b></div>
        <div class="bar" style="margin-bottom:11px"><i style="width:${j.otUsed / j.otMax * 100}%;background:linear-gradient(90deg,var(--gold),var(--orange))"></i></div>
        <button class="hustle-btn" id="hustle-btn" ${cur && otLeft > 0 ? '' : 'disabled'}>
          <span id="hb-label">${otLeft > 0 ? `💪 ${t('career.hustleBtn')} · +${money(j.hustlePay)}` : `😴 ${t('career.otFull')} · ${t('career.nextDay')} ${j.nextDayInHours}h`}</span>
          <span class="cd" id="hb-cd" style="width:0%"></span>
        </button>
        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:11px">${t('career.hint', { m: j.otMult, n: j.otMax })}</div>
        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:6px">🕘 ${t('career.shiftHint', { a: j.workStart, b: j.workEnd, h: j.workHours })}</div>
        <div class="mini-grid" style="margin-top:14px">
          <div class="mini"><label>${t('career.exp')}</label><b>${int(j.exp)}</b></div>
          <div class="mini"><label>${t('career.hours')}</label><b>${int(j.hours)}</b></div>
          <div class="mini"><label>${t('career.otPay')}</label><b class="gold">${money(j.hustlePay)}</b></div>
          <div class="mini"><label>${t('career.income')}</label><b class="gold">${money(j.income)}</b></div>
        </div>
      </div>

      <div class="card"><div class="card-b">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
          <span class="dim">${t('career.expToNext')}${next ? ` · ${esc(nm({ zh: next.zh, en: next.en }))}` : ''}</span>
          <b class="mono">${next ? `${int(j.exp)} / ${int(next.exp)}` : 'MAX'}</b></div>
        <div class="bar"><i style="width:${prog * 100}%;background:linear-gradient(90deg,var(--blue),var(--purple))"></i></div>
        ${s.netWorth.total < 3000 ? `<div class="summary" style="margin-top:14px;font-size:12.5px;line-height:1.7">${t('career.startHint')}</div>` : ''}
        <div class="mini-grid" style="margin-top:14px">
          <div class="mini"><label>${t('common.cash')}</label><b class="${s.player.cash < 0 ? 'down' : ''}">${money(s.player.cash)}</b></div>
          <div class="mini"><label>${t('common.netWorth')}</label><b>${money(s.netWorth.total)}</b></div>
          <div class="mini"><label>${t('rich.rank')}</label><b id="cr-rank">—</b></div>
        </div>
        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:12px">${t('career.carHint')}</div>
      </div></div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🧭 ${t('career.jobList')}</h3>
        ${cur ? `<div class="right"><button class="btn btn-xs btn-ghost" id="quit-job">${t('career.quit')}</button></div>` : ''}</div>
      <div class="card-b">
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:9px">
        ${j.list.map(x => {
          const locked = !x.unlocked || x.blocked;
          return `<button class="job-card ${x.current ? 'current' : ''} ${locked ? 'locked' : ''}" data-job="${x.id}" ${locked ? 'disabled' : ''}>
            <div class="ico">${x.emoji}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px">${esc(nm({ zh: x.zh, en: x.en }))}
                ${x.current ? `<span class="tag y">${t('career.current2')}</span>` : ''}
                ${x.car ? `<span class="tag b">🚗</span>` : ''}</div>
              <div class="dim2" style="font-size:11px;margin-top:2px;line-height:1.5">${esc(nm({ zh: x.descZh, en: x.descEn }))}</div>
              ${!x.unlocked ? `<div class="down" style="font-size:10.5px;margin-top:3px">${t('career.needExp', { n: int(x.exp) })}</div>`
                : x.blocked ? `<div class="down" style="font-size:10.5px;margin-top:3px">${t('career.needCar')}</div>` : ''}
            </div>
            <div class="jw"><b class="mono gold" style="font-size:14px">${money(x.wage)}</b>
              <div class="dim2" style="font-size:10px">${t('common.perHour')} · ${money(x.wage * (j.workHours + j.otMax * j.otMult))}/${t('common.day')}</div></div>
          </button>`;
        }).join('')}
        </div>
      </div>
    </div>`;

    const btn = $('#hustle-btn');
    if (btn) {
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const r = await api.hustle();
          app.state.job.otUsed = r.otUsed;
          const pop = document.createElement('div');
          pop.className = 'coin-pop';
          pop.textContent = '+' + money(r.pay);
          pop.style.left = '50%'; pop.style.top = '50%';
          btn.parentElement.appendChild(pop);
          setTimeout(() => pop.remove(), 900);
          btn.classList.add('pulse');
          setTimeout(() => btn.classList.remove('pulse'), 340);
          app.state.player.cash = r.cash;
          $('#tb-cash').textContent = money(r.cash);
          this.startCooldown(app.state.job.cooldownMs, app);
        } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
      };
      if (!j.hustleReady) this.startCooldown(j.hustleWaitMs, app);
    }
    $('#quit-job') && ($('#quit-job').onclick = () => app.act(() => api.takeJob(''), t('toast.success')).catch(() => {}));
    $$('[data-job]').forEach(b => b.onclick = () => app.act(() => api.takeJob(b.dataset.job), t('toast.success')).catch(() => {}));
    api.richlist().then(r => {
      const me = r.list.find(x => !x.npc);
      const el = $('#cr-rank'); if (el && me) el.textContent = '#' + me.rank;
    }).catch(() => {});
  },

  startCooldown(ms, app) {
    clearInterval(cooldownTimer);
    const btn = $('#hustle-btn'), cd = $('#hb-cd'), label = $('#hb-label');
    if (!btn) return;
    const total = app.state.job.cooldownMs;
    let left = ms;
    btn.disabled = true;
    const tick = () => {
      left -= 100;
      if (left <= 0) {
        clearInterval(cooldownTimer);
        btn.disabled = false;
        if (cd) cd.style.width = '0%';
        const jj = app.state.job;
        if (jj.otUsed >= jj.otMax) { btn.disabled = true; if (label) label.innerHTML = `😴 ${t('career.otFull')}`; return; }
        if (label) label.innerHTML = `💪 ${t('career.hustleBtn')} · +${money(jj.hustlePay)}`;
        return;
      }
      if (cd) cd.style.width = (left / total * 100) + '%';
      if (label) label.textContent = `${t('career.cooling')} ${(left / 1000).toFixed(1)}s`;
    };
    tick();
    cooldownTimer = setInterval(tick, 100);
  },

  patch(app) {
    const el = $('#cr-rank');
    if (!el) return;
    const j = app.state.job;
    const lbl = $('#hb-label'), btn = $('#hustle-btn');
    if (btn && !btn.disabled && lbl) lbl.innerHTML = `💪 ${t('career.hustleBtn')} · +${money(j.hustlePay)}`;
    const mini = $$('.mini b');
    if (mini[0]) mini[0].textContent = int(j.exp);
    if (mini[1]) mini[1].textContent = int(j.hours);
    if (mini[2]) mini[2].textContent = int(j.hustles);
    if (mini[3]) mini[3].textContent = money(j.income);
  },
};
