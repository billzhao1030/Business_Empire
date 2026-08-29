import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast } from '../util.js';

let timer = null, flightCls = 'economy';

const stClass = s => s >= 60 ? 'st-good' : s >= 25 ? 'st-mid' : 'st-low';
const stressCls = v => v < 30 ? 'st-good' : v < 60 ? 'st-mid' : 'st-low';
const stressLabel = v => t(v < 25 ? 'life.calm' : v < 50 ? 'life.mild' : v < 70 ? 'life.tense' : v < 88 ? 'life.heavy' : 'life.crisis');

function dayBar(j, live) {
  // 24 小时作息条。游标位置由 app.paintClock() 每 250ms 推一次，
  // 跟顶栏的钟走的是同一个时间源，所以两者永远对得上。
  const segs = [];
  for (let h = 0; h < 24; h++) {
    const kind = (h >= j.sleepHour || h < j.wakeHour) ? 'sleep'
      : (h >= j.workStart && h < j.workEnd) ? 'shift' : 'free';
    if (segs.length && segs[segs.length - 1].kind === kind) segs[segs.length - 1].n++;
    else segs.push({ kind, n: 1, from: h });
  }
  const label = { sleep: lang === 'zh' ? '睡眠' : 'Sleep', shift: lang === 'zh' ? '正常班' : 'Shift', free: lang === 'zh' ? '可加班' : 'Overtime' };
  // 首帧就用实时值定位，免得渲染出来先跳一下
  const at = live != null ? live : j.hod;
  // 游标要放在 .daybar 外面：.daybar 是 overflow:hidden 的（为了圆角），
  // 放在里面的话游标上方那个时刻标签会被裁掉。
  return `<div class="daybar-wrap">
    <div class="daybar" id="daybar">
      ${segs.map(sg => `<div class="dseg-${sg.kind}" data-from="${sg.from}" data-n="${sg.n}" style="flex:${sg.n}">${sg.n >= 4 ? label[sg.kind] : ''}</div>`).join('')}
    </div>
    <div class="now" id="daybar-now" style="left:${(at / 24) * 100}%"><i id="daybar-time"></i></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--dim2);margin-top:3px">
    <span>00:00</span><span>${String(j.workStart).padStart(2, '0')}:00</span>
    <span>${String(j.workEnd).padStart(2, '0')}:00</span><span>${String(j.sleepHour).padStart(2, '0')}:00</span><span>24:00</span></div>`;
}

// 生涯页分四块：干活、找活、过日子、消遣。挤在一页里谁也看不清。
let tab = 'work';
const TABS = [
  { id: 'work',   emoji: '🧑‍💼' },
  { id: 'jobs',   emoji: '🧭' },
  { id: 'living', emoji: '🍚' },
  { id: 'fun',    emoji: '🎲' },
];

// 页签上的小标：不切过去也知道那边出没出事
function badge(id, app) {
  const s = app.state, j = s.job, hl = s.health, lv = s.living;
  if (id === 'work') {
    if (hl.sick) return { text: hl.sick.emoji, cls: 'r' };
    if (hl.trip) return { text: hl.trip.emoji, cls: 'c' };
    if (!j.current) return { text: t('career.resting'), cls: 'y' };
    if (hl.stress >= 55) return { text: Math.round(hl.stress), cls: hl.stress >= 78 ? 'r' : 'y' };
    if (j.canOvertime) return { text: '+' + money(j.otPay), cls: 'g' };
    return null;
  }
  if (id === 'jobs') {
    const open = j.list.filter(x => x.unlocked && !x.blocked && !x.current).length;
    if (open) return { text: open, cls: 'g' };            // 有更好的岗位可以马上换
    const next = j.list.find(x => !x.unlocked);           // 否则显示离下一级还有多远
    return next ? { text: next.emoji + ' ' + Math.round(Math.min(1, j.exp / next.exp) * 100) + '%' } : null;
  }
  if (id === 'living') return { text: money(lv.monthlyCost) + t('living.perMonth'), cls: 'r' };
  if (id === 'fun') return lv.lottoTickets ? { text: lv.lottoTickets } : null;
  return null;
}

export default {
  render(root, app) {
    clearInterval(timer);
    const s = app.state, j = s.job, cur = j.current, hl = s.health, lv = s.living;
    const next = j.list.find(x => !x.unlocked);
    const prog = next ? Math.min(1, j.exp / next.exp) : 1;
    const minutesPerHour = s.now.realMsPerHour / 60000;

    root.innerHTML = `
    <div class="ptabs">
      ${TABS.map(x => `<button class="ptab ${tab === x.id ? 'active' : ''}" data-tab="${x.id}">
        <span class="e">${x.emoji}</span><span>${t('career.' + x.id + 'Tab')}</span>
        ${badge(x.id, app) ? `<span class="b ${badge(x.id, app).cls || ''}">${badge(x.id, app).text}</span>` : ''}
      </button>`).join('')}
    </div>

    ${tab === 'work' ? `
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

        <div style="margin:20px 0 10px">${dayBar(j, app.liveHod ? app.liveHod() : null)}</div>
        <div style="display:flex;gap:12px;font-size:11px;margin-bottom:12px;flex-wrap:wrap">
          <span class="dim2">${t('career.timeBudget')}:</span>
          <span>🏬 ${t('career.mgmtTime')} <b class="mono ${j.mgmtHours > j.mgmtMax ? 'down' : ''}">${j.mgmtHours.toFixed(1)}h</b></span>
          <span>💼 ${t('career.shiftTime')} <b class="mono">${j.shiftHours.toFixed(0)}h</b></span>
          ${j.choreHours > 0 ? `<span>🍳🚌 ${t('career.choreTime')} <b class="mono">${j.choreHours.toFixed(1)}h</b></span>` : ''}
          <span>🕐 ${t('career.freeTime')} <b class="mono">${j.freeHours.toFixed(1)}h</b></span>
        </div>
        ${!j.canJob ? `<div class="summary" style="border-color:var(--orange);color:var(--orange);font-size:11.5px;margin-bottom:10px">
          👔 ${t('career.ownerNote', { n: j.mgmtHours.toFixed(1), max: j.mgmtMax })}</div>` : ''}
        <div style="display:flex;gap:10px;align-items:center;font-size:11px;margin-bottom:10px;flex-wrap:wrap">
          <span class="dim2">🔁 ${t('career.streak')} <b class="mono ${j.streak >= 5 ? 'down' : ''}">${j.streak} ${t('common.day')}</b></span>
          <span class="dim2">😴 ${t('career.restQuality')} <b class="mono ${j.restQuality < 0.8 ? 'down' : 'up'}">${pctPlain(j.restQuality, 0)}</b></span>
          ${j.onLeave ? `<span class="tag g">${t('career.onLeave')}</span>`
            : `<button class="btn btn-xs" id="day-off">🛌 ${t('career.dayOff')}</button>`}
        </div>
        ${j.streak >= 5 ? `<div class="summary" style="border-color:var(--orange);color:var(--orange);font-size:11.5px;margin-bottom:10px">
          ⚠️ ${t('career.streakWarn', { n: j.streak, q: Math.round(j.restQuality * 100) })}</div>` : ''}

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
    ` : ''}

    ${tab === 'work' ? `
    <div class="card">
      <div class="card-h"><h3>🪜 ${t('career.ladder')}</h3>
        <span class="sub">${t('career.ladderHint')}</span>
        <div class="right"><button class="btn btn-xs btn-ghost" data-tab="jobs">${t('career.allJobs')} →</button></div></div>
      <div class="card-b">
        <div class="ladder">
          ${(() => {
            const i = Math.max(0, j.list.findIndex(x => x.current));
            const from = Math.max(0, Math.min(i - 1, j.list.length - 5));
            return j.list.slice(from, from + 5).map(x => {
              const st = x.current ? 'now' : x.unlocked && !x.blocked ? 'open' : 'locked';
              const pc = x.current ? 100 : Math.round(Math.min(1, j.exp / Math.max(1, x.exp)) * 100);
              return `<div class="rung ${st}">
                <div class="e">${x.emoji}</div>
                <div class="n">${esc(nm({ zh: x.zh, en: x.en }))}</div>
                <b class="mono gold">${money(x.wage)}${t('common.perHour')}</b>
                <div class="bar" style="height:4px;margin-top:6px"><i style="width:${pc}%"></i></div>
                <div class="s">${x.current ? t('career.current2')
                  : x.blocked ? '🚗 ' + t('career.needCarShort')
                  : x.unlocked ? t('career.canTake')
                  : `${int(j.exp)} / ${int(x.exp)}`}</div>
              </div>`;
            }).join('');
          })()}
        </div>
      </div>
    </div>
    ` : ''}

    ${tab === 'jobs' ? `
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
    ` : ''}

    ${tab === 'living' ? `
      <div class="card" style="max-width:760px"><div class="card-h"><h3>🍚 ${t('living.title')}</h3>
        <span class="sub">${t('living.hint')}</span></div>
        <div class="card-b">
          <div class="summary" style="margin-bottom:12px">
            <div><span>${t('living.food')} (${esc(nm({ zh: lv.meal.zh, en: lv.meal.en }))})</span>
              <span class="mono down">${money(lv.meal.cost)}${t('living.perDay')} · ${money(lv.monthlyFood)}${t('living.perMonth')}</span></div>
            <div><span>${t('living.rent')} (${esc(nm({ zh: lv.home.zh, en: lv.home.en }))})</span>
              <span class="mono ${lv.home.rent ? 'down' : 'up'}">${lv.home.rent ? money(lv.home.rent) + t('living.perMonth') : t('living.owned')}</span></div>
            <div><span>${t('living.fare')} (${esc(nm({ zh: lv.commute.zh, en: lv.commute.en }))})</span>
              <span class="mono ${lv.commute.cost ? 'down' : 'up'}">${lv.commute.cost
                ? money(lv.commute.cost) + t('living.perDay') + ' · ' + money(lv.monthlyCommute) + t('living.perMonth')
                : t('living.free')}</span></div>
            <div class="tot"><span>${t('living.monthlyCost')}</span>
              <span class="mono down">${money(lv.monthlyCost)}
                <span class="dim2" style="font-weight:400">(${t('living.costShare', { p: lv.monthlyWage ? pctPlain(lv.monthlyCost / lv.monthlyWage, 0) : '—' })})</span></span></div>
          </div>
          <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('living.meal')}</div>
          <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(132px,1fr));margin-bottom:12px">
            ${lv.meals.map(mm => `<button class="opt ${mm.id === lv.meal.id ? 'active' : ''}" data-meal="${mm.id}">
              <div class="t">${mm.emoji} ${esc(nm({ zh: mm.zh, en: mm.en }))}</div>
              <div class="s">${money(mm.cost)}${t('living.perDay')}
                ${mm.hours ? `<span class="dim2">· ${mm.hours}h</span>` : ''}
                ${mm.stamina ? `<span class="${mm.stamina > 0 ? 'up' : 'down'}">${t('career.stamina')}${mm.stamina > 0 ? '+' : ''}${mm.stamina}</span>` : ''}</div></button>`).join('')}
          </div>
          <div class="dim2" style="font-size:10.5px;margin:-6px 0 12px">🍳 ${t('living.cookHint')}</div>
          ${lv.ownsEstate ? `<div class="dim2" style="font-size:11.5px">🏡 ${t('living.owned')}</div>` : `
          <div class="dim2" style="font-size:10.5px;font-weight:700;margin-bottom:6px">${t('living.home')}</div>
          <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(132px,1fr))">
            ${lv.homes.map(hh => `<button class="opt ${hh.id === lv.home.id ? 'active' : ''}" data-home="${hh.id}">
              <div class="t">${hh.emoji} ${esc(nm({ zh: hh.zh, en: hh.en }))}</div>
              <div class="s">${money(hh.rent)}${t('living.perMonth')}</div></button>`).join('')}
          </div>`}
          <div class="dim2" style="font-size:10.5px;font-weight:700;margin:12px 0 6px">${t('living.commute')}</div>
          <div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(132px,1fr))">
            ${lv.commutes.map(cc => { const locked = cc.needsCar && !lv.carOwned; return `
              <button class="opt ${cc.id === lv.commute.id ? 'active' : ''}" data-commute="${cc.id}"
                ${locked ? 'disabled' : ''} style="${locked ? 'opacity:.45' : ''}">
              <div class="t">${cc.emoji} ${esc(nm({ zh: cc.zh, en: cc.en }))}</div>
              <div class="s">${cc.cost ? money(cc.cost) + t('living.perDay') : t('living.free')}
                <span class="dim2">· ${cc.hours}h</span>
                ${locked ? `<span class="down">${t('living.needCar')}</span>` : ''}</div></button>`; }).join('')}
          </div>
          <div class="dim2" style="font-size:10.5px;margin-top:6px">🚌 ${t('living.commuteHint')}
            ${lv.monthlyCommute ? `(${t('living.workDays', { n: lv.commuteDays })})` : ''}</div>
          <div class="mini-grid" style="margin-top:12px">
            <div class="mini"><label>${t('living.foodSpent')}</label><b class="down">${money(lv.foodSpent)}</b></div>
            <div class="mini"><label>${t('living.rentSpent')}</label><b class="down">${money(lv.rentSpent)}</b></div>
            <div class="mini"><label>${t('living.fareSpent')}</label><b class="down">${money(lv.transitSpent)}</b></div>
          </div>
        </div></div>
    ` : ''}

    ${tab === 'fun' ? `
    <div class="card" style="margin-bottom:16px;max-width:760px"><div class="card-b" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <span style="font-size:26px">🗺️</span>
      <div style="flex:1;min-width:200px"><b style="font-size:14px">${t('life.travel')}</b>
        <div class="dim2" style="font-size:11.5px;line-height:1.6">${t('life.travelHint')}</div></div>
      <button class="btn btn-primary btn-sm" id="go-world">${t('world.title')} →</button>
    </div></div>

      <div class="card" style="max-width:760px"><div class="card-h"><h3>🎫 ${t('living.lottery')}</h3>
        <span class="sub">${t('living.lotteryHint')}</span></div>
        <div class="card-b">
          ${lv.lotteries.map(l => `<div class="item-row" style="padding:11px 0">
            <div class="ico">${l.emoji}</div>
            <div class="i-main">
              <div class="i-title">${esc(nm({ zh: l.zh, en: l.en }))} <span class="tag">${money(l.price)}</span></div>
              <div class="i-sub"><span>${t('living.jackpot')} <b class="gold">${money(l.jackpot)}</b></span>
                <span>${t('living.odds')} 1/${l.topOdds.toLocaleString()}</span></div>
            </div>
            <div class="i-act">
              <button class="btn btn-xs" data-lot="${l.id}" data-n="1">×1</button>
              <button class="btn btn-xs" data-lot="${l.id}" data-n="10">×10</button>
              <button class="btn btn-xs btn-ghost" data-lot="${l.id}" data-n="${l.maxBuy}">×${l.maxBuy}</button>
            </div></div>`).join('')}
          <div class="mini-grid" style="margin-top:12px">
            <div class="mini"><label>${t('living.tickets')}</label><b>${int(lv.lottoTickets)}</b></div>
            <div class="mini"><label>${t('living.spent')}</label><b class="down">${money(lv.lottoSpent)}</b></div>
            <div class="mini"><label>${t('living.won')}</label><b class="up">${money(lv.lottoWon)}</b></div>
            <div class="mini"><label>${lv.lottoWon >= lv.lottoSpent ? t('living.netWin') : t('living.netLoss')}</label>
              <b class="${lv.lottoWon >= lv.lottoSpent ? 'up' : 'down'}">${money(Math.abs(lv.lottoWon - lv.lottoSpent))}</b></div>
          </div>
        </div></div>
    ` : ''}`;

    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; this.render(root, app); });


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

    $('#go-world') && ($('#go-world').onclick = () => app.go('world'));
    $$('[data-meal]').forEach(b => b.onclick = () => app.act(() => api.living(b.dataset.meal, null), t('toast.success')).catch(() => {}));
    $$('[data-home]').forEach(b => b.onclick = () => app.act(() => api.living(null, b.dataset.home), t('toast.success')).catch(() => {}));
    $$('[data-commute]').forEach(b => b.onclick = () => app.act(() => api.living(null, null, b.dataset.commute), t('toast.success')).catch(() => {}));
    $$('[data-lot]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await app.guard(() => api.lottery(b.dataset.lot, +b.dataset.n));
        const msg = r.jackpotHit ? t('living.jackpotWin', { amt: money(r.won) })
          : r.won > 0 ? t('living.wonAmount', { n: r.wins.length, amt: money(r.won) })
          : t('living.noWin');
        toast(`${msg}　(${money(-r.spend)} → ${r.net >= 0 ? '+' : ''}${money(r.net)})`,
          r.jackpotHit ? 'ok' : r.net >= 0 ? 'ok' : 'warn', t('living.result'));
        await app.refresh(true);
      } catch (e) { toast(e.message.split(' / ')[0], 'err'); b.disabled = false; }
    });
    $('#day-off') && ($('#day-off').onclick = () => app.act(() => api.dayOff(), t('toast.success')).catch(() => {}));
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
    if (tab !== 'work' || !$('#ot-btn')) return;
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
