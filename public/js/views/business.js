import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { $, $$, money, moneyFull, pct, pctPlain, int, cls, esc, toast, modal, confirmBox, durText } from '../util.js';

let pickType = null, pickCity = 'city';

const bar = (v, color, max = 1) => `<div class="bar"><i style="width:${Math.min(100, v / max * 100)}%;background:${color}"></i></div>`;

export default {
  render(root, app) {
    const s = app.state, cat = app.catalog;
    const bs = s.businesses;
    const totalRev = bs.reduce((a, b) => a + b.revPerHour, 0);
    const totalCost = bs.reduce((a, b) => a + b.costPerHour, 0);
    const totalNet = totalRev - totalCost;

    root.innerHTML = `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat"><label>🏬 ${t('biz.title')}</label><div class="v">${bs.length}</div><div class="d">${t('biz.owned')}</div></div>
      <div class="stat"><label>📈 ${t('biz.revenue')}</label><div class="v up">${money(totalRev)}</div><div class="d">${t('common.perHour')} · ${money(totalRev * 24)}/${t('common.day')}</div></div>
      <div class="stat"><label>📉 ${t('biz.opcost')}</label><div class="v down">${money(totalCost)}</div><div class="d">${t('common.perHour')}</div></div>
      <div class="stat accent"><label>💰 ${t('biz.net')}</label><div class="v">${money(totalNet)}</div><div class="d">${t('dash.perDayNet')} <b>${money(totalNet * 24)}</b></div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-h"><h3>${t('biz.title')}</h3>
        <span class="sub">${t('common.prestige')} ${int(s.player.prestige)} · ${t('dash.prestigeBonus')} <b class="gold">+${pctPlain(s.player.prestigeBonus)}</b></span>
        <div class="right"><button class="btn btn-primary btn-sm" id="b-new">+ ${t('biz.open')}</button></div></div>
    </div>

    ${bs.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr))">
      ${bs.map(b => this.card(b, s, cat)).join('')}</div>`
      : `<div class="card"><div class="empty"><div class="e-ico">🏪</div><h4>${t('biz.empty')}</h4><p>${t('biz.emptyHint')}</p>
          <button class="btn btn-primary" style="margin-top:16px" id="b-new2">+ ${t('biz.open')}</button></div></div>`}`;

    $('#b-new') && ($('#b-new').onclick = () => this.openNew(app));
    $('#b-new2') && ($('#b-new2').onclick = () => this.openNew(app));
    this.wire(root, app);
  },

  card(b, s, cat) {
    const tier = cat.priceTiers.find(x => x.v === b.priceTier) || cat.priceTiers[2];
    const under = b.util < 0.98;
    return `<div class="biz-card" data-id="${b.id}">
      <div class="biz-top">
        <div class="ico lg">${b.emoji}</div>
        <div style="min-width:0;flex:1">
          <div class="biz-name">${esc(b.name)} <span class="tag">Lv.${b.level}</span>${b.marketing ? ` <span class="tag b">📣${b.marketing}</span>` : ''}</div>
          <div class="biz-meta">${esc(nm(b.type))} · ${esc(nm(b.city))} ·
            <span class="tag ${b.openNow ? 'g' : ''}">${b.allDay ? '🌃 24h' : `${String(b.hours[0]).padStart(2, '0')}:00–${String(b.hours[1]).padStart(2, '0')}:00`}
              ${b.openNow ? t('biz.openNow') : t('biz.closedNow')}</span></div>
        </div>
        <div class="biz-pl"><div class="n ${cls(b.netPerHour)}">${money(b.netPerHour)}</div><div class="l">${t('biz.net')}</div></div>
      </div>
      <div class="biz-body">
        <div class="biz-stats" style="grid-template-columns:repeat(5,1fr)">
          <div class="bs"><label>${t('biz.dailyNet')}</label><b class="${cls(b.dailyNet)}">${money(b.dailyNet)}</b></div>
          <div class="bs"><label>${t('biz.opcost')}</label><b class="down">${money(b.costPerHour)}</b></div>
          <div class="bs"><label>${t('biz.staff')}</label><b>${b.staff}<span class="dim2" style="font-size:10px"> / ${b.recStaff}</span></b></div>
          <div class="bs"><label>${t('biz.demand')}</label><b>${b.demand.toFixed(2)}<span class="dim2" style="font-size:10px"> → ${b.demandTarget.toFixed(2)}</span></b></div>
          <div class="bs"><label>${t('biz.rent')}</label><b class="down">${money(b.monthlyRent)}/${t('common.month')}</b></div>
        </div>
        <div style="display:flex;gap:14px;font-size:11px;margin-bottom:4px">
          <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span class="dim2">${t('biz.util')}</span><span class="mono ${under ? 'down' : 'up'}">${pctPlain(b.util, 0)}</span></div>
            ${bar(b.util, under ? 'var(--down)' : 'var(--up)')}</div>
          <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span class="dim2">${t('biz.condition')}</span><span class="mono ${b.condition < .6 ? 'down' : ''}">${pctPlain(b.condition, 0)}</span></div>
            ${bar(b.condition, b.condition < .6 ? 'var(--orange)' : 'var(--blue)')}</div>
        </div>
        ${under ? `<div class="down" style="font-size:11px;margin-top:7px">⚠️ ${t('biz.understaffed')}</div>` : ''}

        <div style="margin-top:12px">
          <div class="dim2" style="font-size:10px;font-weight:700;letter-spacing:.5px;margin-bottom:5px">${t('biz.price')} — ${esc(nm({ zh: tier.zh, en: tier.en }))}</div>
          <div class="segs" style="width:100%;display:flex">
            ${cat.priceTiers.map(x => `<button class="seg ${x.v === b.priceTier ? 'active' : ''}" style="flex:1;padding:5px 2px;font-size:11px"
              data-act="price" data-arg="${x.v}" title="${esc(nm({ zh: x.descZh, en: x.descEn }))}">${x.v < 0 ? '↓'.repeat(-x.v) : x.v > 0 ? '↑'.repeat(x.v) : '='}</button>`).join('')}
          </div>
          <div class="dim2" style="font-size:10.5px;margin-top:5px;line-height:1.5">${esc(nm({ zh: tier.descZh, en: tier.descEn }))}</div>
          <div class="dim2" style="font-size:10.5px;margin-top:6px">🕐 ${t('biz.hours')} <b>${b.openHrs}h</b> · ${t('biz.revenue')} ${money(b.revPerHour)}${t('common.perHour')} · ${t('biz.opcost')} ${money(b.idleCost)}${t('common.perHour')}（${lang === 'zh' ? '关门也要付' : 'even when closed'}）</div>
        </div>

        <div class="dim2" style="font-size:10.5px;margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">
          <span>🧾 ${t('biz.dailyRev')} <b>${money(b.dailyRev)}</b></span>
          <span>📦 ${t('biz.cogs')} <b class="down">${money(b.cogs * b.openHrs)}</b></span>
          <span>⏱️ ${t('biz.mgmt')} <b>${b.mgmt.toFixed(2)}h</b></span>
          <span>🏙️ ${t('biz.prosperity')} <b class="${(s.prosperity[b.cityId] || 1) >= 1 ? 'up' : 'down'}">${((s.prosperity[b.cityId] || 1) * 100).toFixed(0)}%</b></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:11px;flex-wrap:wrap">
          <span class="dim2" style="font-size:10.5px;font-weight:700">${t('biz.staff')}</span>
          <button class="btn btn-xs" data-act="staffm" ${b.autoStaff ? 'disabled' : ''}>−</button>
          <b class="mono" style="min-width:26px;text-align:center">${b.staff}</b>
          <button class="btn btn-xs" data-act="staffp" ${b.autoStaff ? 'disabled' : ''}>+</button>
          <span class="dim2" style="font-size:10.5px">${money(b.wages)}${t('common.perHour')}</span>
          <button class="switch ${b.autoStaff ? 'on' : ''}" data-act="autostaff"><i></i>${t('biz.autoStaff')}</button>
          <button class="switch ${b.autoRepair ? 'on' : ''}" data-act="autorepair"><i></i>${t('biz.autoRepair')}</button>
          <button class="switch ${b.manager ? 'on' : ''}" data-act="manager" data-arg="${b.manager ? '' : '1'}"
            title="${esc(t('biz.managerHint'))}"><i></i>🧑‍💼 ${t('biz.manager')} ${b.manager ? money(b.managerSalary) + '/' + t('common.month') : ''}</button>
        </div>
      </div>
      <div class="biz-ctrl">
        <button class="btn btn-sm" data-act="upgrade" ${b.upgradeCost == null ? 'disabled' : ''}>⬆ ${t('biz.upgrade')} ${b.upgradeCost != null ? money(b.upgradeCost) : 'MAX'}</button>
        <button class="btn btn-sm" data-act="marketing" ${b.marketingCost == null ? 'disabled' : ''}>📣 ${t('biz.doMarketing')} ${b.marketingCost != null ? money(b.marketingCost) : 'MAX'}</button>
        <button class="btn btn-sm" data-act="repair" ${b.repairCost <= 0 ? 'disabled' : ''}>🧹 ${t('biz.repair')} ${money(b.repairCost)}</button>
        <button class="btn btn-sm btn-ghost" data-act="rename">✏️</button>
        ${b.allDayCost ? `<button class="btn btn-sm" data-act="allday">🌃 ${t('biz.goAllDay')} ${money(b.allDayCost)}
          <span style="opacity:.7;font-weight:400">+${money(b.allDayGain)}/${t('common.day')}</span></button>` : ''}
        <button class="btn btn-sm btn-danger" data-act="sell" style="margin-left:auto">${t('biz.sellBiz')} ${money(b.sellValue)}</button>
      </div>
    </div>`;
  },

  wire(root, app) {
    $$('.biz-card').forEach(card => {
      const id = +card.dataset.id;
      const b = app.state.businesses.find(x => x.id === id);
      card.querySelectorAll('[data-act]').forEach(btn => btn.onclick = async e => {
        e.stopPropagation();
        const a = btn.dataset.act;
        try {
          if (a === 'price') await api.bizAction(id, 'price', { arg: +btn.dataset.arg });
          else if (a === 'staffm') await api.bizAction(id, 'staff', { arg: Math.max(0, b.staff - 1) });
          else if (a === 'staffp') await api.bizAction(id, 'staff', { arg: b.staff + 1 });
          else if (a === 'autostaff') await api.bizAction(id, 'autostaff', { arg: !b.autoStaff });
          else if (a === 'autorepair') await api.bizAction(id, 'autorepair', { arg: !b.autoRepair });
          else if (a === 'manager') await api.bizAction(id, 'manager', { arg: !b.manager });
          else if (a === 'rename') {
            const v = prompt(t('biz.rename'), b.name); if (!v) return;
            await api.bizAction(id, 'rename', { name: v });
          } else if (a === 'sell') {
            const ok = await confirmBox(t('biz.sellBiz'), `「${esc(b.name)}」 → <b class="gold">${moneyFull(b.sellValue)}</b>`, t('biz.sellBiz'));
            if (!ok) return;
            await api.bizAction(id, 'sell');
            toast(t('toast.success'), 'ok');
          } else await api.bizAction(id, a);
          await app.refresh(true);
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  },

  // ── 开新店 ────────────────────────────────────────────────
  openNew(app) {
    const cat = app.catalog, s = app.state;
    pickType = pickType || cat.biz[0].id;
    const render = el => {
      const def = cat.biz.find(x => x.id === pickType);
      const city = cat.cities.find(c => c.id === pickCity);
      const setup = Math.round(def.cost * city.costMult);
      const travel = Math.round(city.travelCost || 0);
      const cost = setup + travel;
      const rev = def.rev * city.revMult;
      const H = def.openHours;
      const wage = def.wage * city.wageMult;
      const staffN = Math.max(1, Math.ceil(rev / (wage * 4.5)));
      const dailyRev = H * rev;
      const cogs = dailyRev * (cat.cogsRate ?? 0.42);
      const wages = H * staffN * wage;
      const rentM = def.monthlyRent * city.rentMult;
      const net = dailyRev - cogs - wages - rentM / 30;
      const box = el.querySelector('#nb-body');
      box.innerHTML = `
      <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.6px;margin-bottom:7px">${t('biz.chooseType')}</div>
      <div class="opt-grid" style="max-height:230px;overflow:auto;margin-bottom:16px">
        ${cat.biz.map(x => {
          const c = Math.round(x.cost * city.costMult) + Math.round(city.travelCost || 0);
          const afford = s.player.cash >= c;
          return `<button class="opt ${x.id === pickType ? 'active' : ''}" data-type="${x.id}" ${afford ? '' : 'style="opacity:.45"'}>
            <div class="t">${x.emoji} ${esc(nm({ zh: x.name, en: x.en }))}</div>
            <div class="s">${money(c)} · ${x.hours[0]}:00–${x.hours[1]}:00 (${x.openHours}h)</div></button>`;
        }).join('')}
      </div>
      <div class="dim2" style="font-size:10.5px;font-weight:700;letter-spacing:.6px;margin-bottom:7px">${t('biz.chooseCity')}</div>
      <div class="opt-grid" style="margin-bottom:16px">
        ${cat.cities.map(c => `<button class="opt ${c.id === pickCity ? 'active' : ''}" data-city="${c.id}">
          <div class="t">${esc(nm({ zh: c.name, en: c.en }))}</div>
          <div class="s">${t('biz.costLabel')} ×${c.costMult} · ${t('biz.revenue')} ×${c.revMult}</div></button>`).join('')}
      </div>
      <label class="field"><span>${t('biz.nameIt')}</span><input id="nb-name" placeholder="${esc(nm({ zh: city.name + def.name, en: def.en + ' · ' + city.en }))}" maxlength="24"></label>
      <div class="summary">
        <div><span>${t('biz.setup')}</span><span class="mono">${moneyFull(setup)}</span></div>
        ${travel ? `<div><span>✈️ ${t('biz.travelCost')}（${city.travelDays} ${t('common.day')}）</span><span class="mono down">${moneyFull(travel)}</span></div>` : ''}
        <div><span>${t('biz.hours')}</span><span class="mono">${def.hours[0]}:00–${def.hours[1]}:00 · ${H}h</span></div>
        <div><span>${t('biz.dailyRev')}</span><span class="mono">${money(dailyRev)}</span></div>
        <div><span>${t('biz.cogs')}</span><span class="mono down">-${money(cogs)}</span></div>
        <div><span>${t('biz.wages')}（${staffN} ${t('biz.staff')}）</span><span class="mono down">-${money(wages)}</span></div>
        <div><span>${t('biz.rent')}</span><span class="mono down">-${money(rentM / 30)}/${t('common.day')}（${money(rentM)}/${t('common.month')}）</span></div>
        <div><span>${t('biz.mgmt')}</span><span class="mono">${def.mgmt.toFixed(1)} h/${t('common.day')}</span></div>
        <div><span>${t('biz.payback')}</span><span class="mono">${Math.round(def.payDays)} ${t('common.day')}</span></div>
        <div class="tot"><span>${t('biz.dailyNet')}</span><span class="mono ${net >= 0 ? 'up' : 'down'}">${money(net)}</span></div>
      </div>
      <p class="dim2" style="font-size:11px;margin-top:8px;line-height:1.6">🕐 ${t('biz.hoursHint')}</p>
      ${travel ? `<p style="font-size:11.5px;margin-top:8px;line-height:1.6;color:var(--orange)">✈️ ${t('biz.travelWarn', { n: city.travelDays })}</p>` : ''}
      <p class="dim2" style="font-size:11.5px;margin-top:10px;line-height:1.6">${esc(nm({ zh: def.desc, en: def.descEn }))}</p>`;
      box.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { pickType = b.dataset.type; render(el); });
      box.querySelectorAll('[data-city]').forEach(b => b.onclick = () => { pickCity = b.dataset.city; render(el); });
      const sub = el.querySelector('#nb-submit');
      sub.disabled = s.player.cash < cost;
      sub.textContent = s.player.cash < cost ? `${t('common.cash')} ${money(s.player.cash)} / ${money(cost)}` : `${t('biz.open')} · ${money(cost)}`;
    };
    modal({
      wide: true, title: t('biz.open'), icon: '🏪',
      body: `<div id="nb-body"></div>`,
      footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-primary" id="nb-submit"></button>`,
      onMount: (el, close) => {
        render(el);
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('#nb-submit').onclick = async () => {
          try {
            await api.bizBuy(pickType, pickCity, el.querySelector('#nb-name').value);
            close(); toast(t('toast.opened'), 'ok');
            await app.refresh(true);
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    });
  },

  patch(app) {
    // 只有在用户没有打开弹窗、也没有在输入时，才安全地整页刷新
    if (document.querySelector('.modal-mask')) return;
    const a = document.activeElement;
    if (a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) return;
    const root = document.getElementById('view');
    const top = root.scrollTop;
    this.render(root, app);
    root.scrollTop = top;
  }
};
