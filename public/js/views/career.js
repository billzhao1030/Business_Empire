import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast } from '../util.js';

let timer = null, flightCls = 'economy';

const stClass = s => s >= 60 ? 'st-good' : s >= 25 ? 'st-mid' : 'st-low';
const stressCls = v => v < 30 ? 'st-good' : v < 60 ? 'st-mid' : 'st-low';
const stressLabel = v => t(v < 25 ? 'life.calm' : v < 50 ? 'life.mild' : v < 70 ? 'life.tense' : v < 88 ? 'life.heavy' : 'life.crisis');

function dayBar(j) {
  // 24 小时作息条
  const segs = [];
  for (let h = 0; h < 24; h++) {
    const kind = (h >= j.sleepHour || h < j.wakeHour) ? 'sleep'
      : (h >= j.workStart && h < j.workEnd) ? 'shift' : 'free';
    if (segs.length && segs[segs.length - 1].kind === kind) segs[segs.length - 1].n++;
    else segs.push({ kind, n: 1, from: h });
  }
  const label = { sleep: lang === 'zh' ? '睡眠' : 'Sleep', shift: lang === 'zh' ? '正常班' : 'Shift', free: lang === 'zh' ? '可加班' : 'Overtime' };
  return `<div class="daybar" style="position:relative">
    ${segs.map(sg => `<div class="dseg-${sg.kind}" style="flex:${sg.n}">${sg.n >= 4 ? label[sg.kind] : ''}</div>`).join('')}
    <div class="now" style="left:${(j.hod / 24) * 100}%"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--dim2);margin-top:3px">
    <span>00:00</span><span>${String(j.workStart).padStart(2, '0')}:00</span>
    <span>${String(j.workEnd).padStart(2, '0')}:00</span><span>${String(j.sleepHour).padStart(2, '0')}:00</span><span>24:00</span></div>`;
}

export default {
  render(root, app) {
    clearInterval(timer);
    const s = app.state, j = s.job, cur = j.current, hl = s.health;
    const next = j.list.find(x => !x.unlocked);
    const prog = next ? Math.min(1, j.exp / next.exp) : 1;
    const minutesPerHour = s.now.realMsPerHour / 60000;

    root.innerHTML = `
    <div class="grid" style="grid-template-columns:1.15fr 1fr;margin-bottom:16px">
      <div class="hustle-card">
        <div style="display:flex;align-items:center;gap:13px;margin-bottom:14px">
          <div class="ico lg" style="font-size:26px">${cur ? cur.emoji : '🧳'}</div>
          <div style="flex:1;min-width:0">
            <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.5px">${t('career.current')}</div>
            <div style="font-size:19px;font-weight:800">${cur ? esc(nm({ zh: cur.zh, en: cur.en })) : t('career.resting')}</div>
            ${cur ? `<div class="dim" style="font-size:12px;margin-top:2px">${t('career.wage')} <b class="gold mono">${money(cur.wage)}</b>${t('common.perHour')}
              · ${t('career.sustainable')} <b class="mono">${money(j.sustainableWage)}</b></div>` : ''}
          </div>
          <div class="tc-phase ${j.phase}" style="font-size:12px;font-weight:700">${t('phase.' + j.phase)}</div>
        </div>

        <div style="margin-bottom:12px">${dayBar(j)}</div>

        <div class="stamina" style="margin-bottom:6px">
          <span class="dim2" style="font-size:11px;font-weight:700;width:44px">${t('career.stamina')}</span>
          <div class="sbar"><i class="${stClass(j.stamina)}" style="width:${j.stamina}%"></i></div>
          <b class="mono" style="font-size:12px;width:38px;text-align:right">${Math.round(j.stamina)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:12px">
          <span class="dim2">${t('career.efficiency')} <b class="${j.efficiency >= 0.95 ? 'up' : j.efficiency >= 0.75 ? 'gold' : 'down'}">${pctPlain(j.efficiency, 0)}</b></span>
          <span class="dim2">${t('career.otToday')} <b class="mono">${j.otUsed} / ${j.otMax}</b></span>
        </div>

        <button class="hustle-btn" id="ot-btn" ${j.canOvertime ? '' : 'disabled'}>
          <span id="ot-label">${j.canOvertime ? `${j.night ? '🌙' : '💪'} ${j.night ? t('career.nightShift') : t('career.otStart')} · +${money(j.otPay)}`
            : j.otBusy ? `⏳ ${t('career.otWorking')}` : `🚫 ${t('career.otBlock.' + j.otBlock)}`}</span>
          <span class="cd" id="ot-cd" style="width:0%"></span>
        </button>
        ${j.night ? `<div class="dim2" style="font-size:11.5px;line-height:1.6;margin-top:8px;color:var(--purple)">🌙 ${t('career.nightHint', { m: j.nightMult })}</div>` : ''}

        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:11px">${t('career.hint', { m: j.otMult, n: j.otMax })}</div>
        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:5px">🕘 ${t('career.scheduleHint', { a: j.workStart, b: j.workEnd, h: j.workHours, m: minutesPerHour })}</div>
        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:5px">🔋 ${t('career.staminaHint', { s: j.sleepHour, w: j.wakeHour, min: 15 })}</div>
      </div>

      <div class="card"><div class="card-b">
        <!-- 精神压力 -->
        <div class="stamina" style="margin-bottom:6px">
          <span class="dim2" style="font-size:11px;font-weight:700;width:52px">${t('life.stress')}</span>
          <div class="sbar"><i class="${stressCls(hl.stress)}" style="width:${hl.stress}%"></i></div>
          <b class="mono" style="font-size:12px;width:38px;text-align:right">${Math.round(hl.stress)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:12px">
          <span class="tag ${hl.stress < 30 ? 'g' : hl.stress < 55 ? '' : hl.stress < 78 ? 'y' : 'r'}">${stressLabel(hl.stress)}</span>
          <span class="dim2">${t('life.efficiency')} <b class="${hl.factor >= 0.99 ? 'up' : 'down'}">${pctPlain(hl.factor, 0)}</b>
            · ${t('life.riskPerDay')} <b class="${hl.sickRiskPerDay > 0.1 ? 'down' : 'dim'}">${pctPlain(hl.sickRiskPerDay, 0)}</b></span>
        </div>

        <!-- 健康 / 旅行状态 -->
        ${hl.sick ? `<div class="summary" style="border-color:var(--down);margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">
            <span style="font-size:20px">${hl.sick.emoji}</span>
            <div style="flex:1"><b>${esc(nm({ zh: hl.sick.zh, en: hl.sick.en }))}</b>
              <div class="dim2" style="font-size:11px">${esc(nm({ zh: hl.sick.descZh, en: hl.sick.descEn }))}</div></div>
            <div class="mono down">${t('life.recoverIn')} ${(hl.sick.hoursLeft / 24).toFixed(1)}${t('common.day')}</div>
          </div>
          ${hl.sick.treated ? `<div class="dim2" style="font-size:11.5px">🏥 ${t('life.treated')}</div>`
            : `<button class="btn btn-sm btn-primary btn-block" id="do-treat">🏥 ${t('life.treat')} · ${money(hl.sick.treatCost)}
                 <span style="font-weight:400;opacity:.75">（${t('life.treatFast', { n: hl.sick.treatDays })}）</span></button>
               <div class="dim2" style="font-size:11px;margin-top:6px">${t('life.untreated')}</div>`}
        </div>` : hl.trip ? `<div class="summary" style="border-color:var(--cyan);margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:9px">
            <span style="font-size:20px">${hl.trip.emoji}</span>
            <div style="flex:1"><b>${esc(nm({ zh: hl.trip.zh, en: hl.trip.en }))}</b>
              <div class="dim2" style="font-size:11px">${t('life.traveling')}</div></div>
            <div class="mono" style="color:var(--cyan)">${t('life.tripBack')} ${(hl.trip.hoursLeft / 24).toFixed(1)}${t('common.day')}</div>
          </div></div>`
          : `<div class="summary" style="margin-bottom:12px;color:var(--up);font-size:12.5px">💚 ${t('life.healthy')}</div>`}

        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
          <span class="dim">${t('career.expToNext')}${next ? ` · ${esc(nm({ zh: next.zh, en: next.en }))}` : ''}</span>
          <b class="mono">${next ? `${int(j.exp)} / ${int(next.exp)}` : 'MAX'}</b></div>
        <div class="bar"><i style="width:${prog * 100}%;background:linear-gradient(90deg,var(--blue),var(--purple))"></i></div>
        <div class="mini-grid" style="margin-top:14px">
          <div class="mini"><label>${t('career.exp')}</label><b>${int(j.exp)}</b></div>
          <div class="mini"><label>${t('career.hours')}</label><b>${int(j.hours)}</b></div>
          <div class="mini"><label>${t('career.income')}</label><b class="gold">${money(j.income)}</b></div>
          <div class="mini"><label>${t('common.cash')}</label><b class="${s.player.cash < 0 ? 'down' : ''}">${money(s.player.cash)}</b></div>
          <div class="mini"><label>${t('common.netWorth')}</label><b>${money(s.netWorth.total)}</b></div>
          <div class="mini"><label>${t('rich.rank')}</label><b id="cr-rank">—</b></div>
        </div>
        <div class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:12px">🧠 ${t('life.stressHint')}</div>
      </div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-h"><h3>✈️ ${t('life.travel')}</h3>
        <span class="sub">${t('life.travelHint')}</span>
        <div class="right"><div class="segs" id="fclass">
          ${hl.classes.map(c => `<button class="seg ${c.id === flightCls ? 'active' : ''} ${c.needJet && !hl.hasJet ? 'locked' : ''}"
            data-cls="${c.id}" ${c.needJet && !hl.hasJet ? 'disabled title="' + t('life.needJet') + '"' : ''}>${esc(nm({ zh: c.zh, en: c.en }))}</button>`).join('')}
        </div></div></div>
      <div class="card-b">
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
        ${hl.trips_catalog.map(tp => {
          const price = tp.price[flightCls] ?? tp.price.economy;
          const cls = hl.classes.find(c => c.id === flightCls) || hl.classes[0];
          const afford = s.player.cash >= price && !hl.sick && !hl.trip;
          return `<div class="card" style="background:var(--bg2)"><div class="card-b" style="padding:13px">
            <div style="display:flex;gap:9px;align-items:flex-start">
              <div class="ico">${tp.emoji}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px">${esc(nm({ zh: tp.zh, en: tp.en }))}</div>
                <div class="dim2" style="font-size:10.5px;margin-top:2px">${t('life.tripDays', { n: tp.days })} ·
                  <span style="color:var(--up)">${t('life.tripRelief', { n: Math.round(tp.relief * cls.relief) })}</span> ·
                  ⭐ ${Math.round(tp.prestige * cls.prestige)}</div>
              </div>
            </div>
            <div class="mono" style="font-size:16px;font-weight:800;margin:9px 0 5px">${money(price)}</div>
            <p class="dim2" style="font-size:11px;line-height:1.5;min-height:30px">${esc(nm({ zh: tp.descZh, en: tp.descEn }))}</p>
            <button class="btn btn-sm ${afford ? 'btn-primary' : ''} btn-block" data-trip="${tp.id}" ${afford ? '' : 'disabled'}>${t('life.book')}</button>
          </div></div>`;
        }).join('')}
        </div>
        <div class="mini-grid" style="margin-top:14px">
          <div class="mini"><label>${t('life.tripCount')}</label><b>${hl.trips}</b></div>
          <div class="mini"><label>${t('life.tripSpent')}</label><b>${money(hl.tripSpent)}</b></div>
          <div class="mini"><label>${t('life.medSpent')}</label><b class="down">${money(hl.medSpent)}</b></div>
        </div>
      </div>
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
              <div class="dim2" style="font-size:10px">${t('common.perHour')} · ${money(x.wage * j.workHours)}/${t('common.day')}</div></div>
          </button>`;
        }).join('')}
        </div>
      </div>
    </div>`;

    const btn = $('#ot-btn');
    if (btn) btn.onclick = async () => {
      btn.disabled = true;
      try {
        const r = await api.hustle();
        const pop = document.createElement('div');
        pop.className = 'coin-pop';
        pop.textContent = '⏳ ' + money(r.pay);
        pop.style.left = '50%'; pop.style.top = '50%';
        btn.parentElement.appendChild(pop);
        setTimeout(() => pop.remove(), 900);
        await app.refresh(true);
      } catch (e) { toast(e.message.split(' / ')[0], 'err'); btn.disabled = false; }
    };
    if (j.otBusy) this.countdown(app, j.otRemainMs);

    $('#do-treat') && ($('#do-treat').onclick = () => app.act(() => api.treat(), t('toast.success')).catch(() => {}));
    $$('[data-cls]').forEach(b => b.onclick = () => { flightCls = b.dataset.cls; this.render(root, app); });
    $$('[data-trip]').forEach(b => b.onclick = () => app.act(() => api.trip(b.dataset.trip, flightCls), t('toast.success')).catch(() => {}));
    $('#quit-job') && ($('#quit-job').onclick = () => app.act(() => api.takeJob(''), t('toast.success')).catch(() => {}));
    $$('[data-job]').forEach(b => b.onclick = () => app.act(() => api.takeJob(b.dataset.job), t('toast.success')).catch(() => {}));
    api.richlist().then(r => {
      const me = r.list.find(x => !x.npc);
      const el = $('#cr-rank'); if (el && me) el.textContent = '#' + me.rank;
    }).catch(() => {});
  },

  countdown(app, ms) {
    clearInterval(timer);
    const total = app.state.now.realMsPerHour;
    let left = ms;
    timer = setInterval(() => {
      left -= 200;
      const btn = $('#ot-btn'), cd = $('#ot-cd'), lb = $('#ot-label');
      if (!btn) return clearInterval(timer);
      if (left <= 0) { clearInterval(timer); app.refresh(true); return; }
      cd.style.width = (left / total * 100) + '%';
      const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
      lb.textContent = `⏳ ${t('career.otWorking')} · ${t('career.otDone')} ${m}:${String(sec).padStart(2, '0')}`;
    }, 200);
  },

  patch(app) {
    if (!$('#ot-btn')) return;
    const j = app.state.job;
    const el = $('.stamina .sbar > i');
    if (el) { el.style.width = j.stamina + '%'; el.className = stClass(j.stamina); }
    const num = $('.stamina b');
    if (num) num.textContent = Math.round(j.stamina);
    const btn = $('#ot-btn'), lb = $('#ot-label');
    if (btn && !j.otBusy) {
      btn.disabled = !j.canOvertime;
      lb.innerHTML = j.canOvertime ? `${j.night ? '🌙' : '💪'} ${j.night ? t('career.nightShift') : t('career.otStart')} · +${money(j.otPay)}`
        : `🚫 ${t('career.otBlock.' + j.otBlock)}`;
      const cd = $('#ot-cd'); if (cd) cd.style.width = '0%';
    }
  },
};
