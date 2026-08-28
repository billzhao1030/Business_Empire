import { t, nm, lang } from '../i18n.js';
import { api } from '../api.js';
import { setToken } from '../api.js';
import { $, $$, money, pctPlain, esc, toast, modal, confirmBox } from '../util.js';

const L = (zh, en) => lang === 'zh' ? zh : en;

export default {
  render(root, app) {
    const s = app.state, c = app.catalog;
    const mins = s.now.realMsPerHour / 60000;

    const S = (icon, title, body) => `<div class="about-sec"><h4>${icon} ${title}</h4>${body}</div>`;

    root.innerHTML = `
    <div class="grid" style="grid-template-columns:1.6fr 1fr;gap:16px">
      <div class="card"><div class="card-b" style="padding:24px 26px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
          <div style="font-size:38px">💼</div>
          <div><h2 style="font-size:22px;font-weight:800;letter-spacing:1px;background:linear-gradient(92deg,var(--gold),var(--orange));-webkit-background-clip:text;background-clip:text;color:transparent">BUSINESS EMPIRE</h2>
            <div class="dim" style="font-size:12.5px;margin-top:3px">${L('商业帝国 · 从一无所有到富可敌国', 'From nothing to everything')}</div></div>
          <div class="tag y" style="margin-left:auto">v1.1</div>
        </div>

        ${S('🎯', L('这是什么', 'What this is'), `<p>${L(
          '一个完全跑在你自己电脑上的商业模拟经营游戏。没有广告，没有内购，没有联网上传——所有数据都在本地的一个数据库文件里。你从 <b>$0</b> 开始，靠打零工攒下第一笔钱，开出第一家小摊，然后一步步走向股票、房产、商圈和跨国收购。',
          'A business tycoon simulation that runs entirely on your own machine. No ads, no purchases, no telemetry — everything lives in one local database file. You start with <b>$0</b>, hustle for your first dollars, open your first stall, and work up through equities, property, districts and hostile takeovers.')}</p>`)}

        ${S('⏱️', L('时间与节奏', 'Time & pace'), `<p>${L(
          `现实 <b>${mins} 分钟</b> = 游戏 <b>1 小时</b>。一个游戏日 = ${mins * 24} 分钟，一个游戏月（30 天）= ${(mins * 720 / 60).toFixed(0)} 小时现实时间，一个游戏年 = ${(mins * 8640 / 1440).toFixed(1)} 天。<br><b>关掉网页也照常结算</b>：店铺继续营业、利息继续滚、贷款继续扣、股价继续波动。回来时会一次性补算。`,
          `<b>${mins} real minutes</b> = <b>1 in-game hour</b>. One game day is ${mins * 24} minutes; one game month is ${(mins * 720 / 60).toFixed(0)} real hours; one game year is ${(mins * 8640 / 1440).toFixed(1)} days.<br><b>Everything accrues offline</b> — stores trade, interest compounds, loans are debited and prices move. It is all settled when you come back.`)}</p>`)}

        ${S('🧭', L('白手起家的路线', 'The path from zero'), `<ol style="padding-left:20px;color:var(--dim);line-height:2;font-size:13px">
          <li>${L('去<b>生涯</b>页点「接一单加班」——每单 = 干 1 个工时、按 1.6 倍加班费结算，每个游戏日最多 6 小时', 'On the <b>Career</b> page, work overtime — each click is one extra hour at 1.6× pay, capped at 6 hours per in-game day')}</li>
          <li>${L('$120 开一个<b>街头小摊</b>，它会 24 小时不停地替你赚钱', 'Open a <b>Street Stall</b> for $120 — it earns around the clock')}</li>
          <li>${L('攒到 $900 买一辆<b>二手电动车</b>，解锁网约车司机，时薪从 $18 跳到 $130', 'Buy a <b>$900 e-scooter</b> to unlock Rideshare Driver — wages jump from $18 to $130/hr')}</li>
          <li>${L('用店铺利润滚出更多店铺，同时开始<b>炒股</b>和买<b>商圈份额</b>', 'Compound store profits into more stores, then start <b>trading</b> and buying <b>district units</b>')}</li>
          <li>${L('信用分够了就<b>贷款</b>加杠杆，买<b>房产</b>吃租金与升值', 'Once your credit holds up, <b>borrow</b> to leverage and buy <b>property</b> for rent and appreciation')}</li>
          <li>${L('最终目标：买满一家公司的限购比例，发起<b>全面收购要约</b>，把它变成你的全资子公司', 'Endgame: max out a company’s tradable stake and launch a <b>tender offer</b> to own it outright')}</li>
        </ol>`)}

        ${S('📈', L('股市是怎么运转的', 'How the market actually works'), `
          <p>${L(
          '价格<b>不是</b>随机数，也没有固定的涨跌上下限。每一个游戏小时，每个标的的对数收益率由六部分叠加而成：',
          'Prices are <b>not</b> random numbers and there is no fixed band. Every in-game hour each asset’s log-return is the sum of six components:')}</p>
          <ul>
            <li><b>${L('大盘因子', 'Market factor')}</b> — ${L('全市场共同的涨跌，乘以该标的的 β 系数。β 越高，跟大盘涨跌越剧烈。', 'the common move of the whole market, scaled by the asset’s β. Higher β means it swings harder than the index.')}</li>
            <li><b>${L('板块因子与轮动', 'Sector factor & rotation')}</b> — ${L('每个板块有自己缓慢演化的动量，所以会出现「半导体连涨一周、能源连跌一周」这种轮动。', 'each sector carries slowly evolving momentum, which produces real rotation — semis run for a week while energy bleeds.')}</li>
            <li><b>${L('个股特异波动', 'Idiosyncratic move')}</b> — ${L('该公司独有的随机成分，幅度由它的年化波动率决定。', 'the company’s own random component, sized by its annualised volatility.')}</li>
            <li><b>${L('均值回归', 'Mean reversion')}</b> — ${L('每个标的有一个缓慢增长的<b>内在价值</b>。价格偏离越远，被拉回来的力越大。这就是为什么泡沫最终会破，暴跌之后又会修复。', 'each asset has a slowly growing <b>intrinsic value</b>. The further price strays, the harder it is pulled back — bubbles deflate and crashes repair.')}</li>
            <li><b>${L('波动率聚集', 'Volatility clustering')}</b> — ${L('剧烈波动之后更容易继续剧烈波动（GARCH 效应），所以行情会出现「平静期」和「疯狂期」。', 'big moves beget big moves (a GARCH effect), so the tape alternates between calm and chaos.')}</li>
            <li><b>${L('跳跃与新闻', 'Jumps & news')}</b> — ${L('小概率的突发跳空，加上会推动<b>内在价值</b>本身的新闻事件（财报暴雷、回购、被做空）。', 'rare gap moves, plus headline events that shift the intrinsic value itself (earnings shocks, buybacks, short reports).')}</li>
          </ul>
          <p style="margin-top:8px">${L(
          '此外：<b>你自己的大额交易会冲击价格</b>——买得越多，成交价被你推得越高，卖出同理。所以想吃下一家公司，越到后面越贵。',
          'On top of that, <b>your own size moves the price</b>: the more you buy, the higher you push your own fills. Cornering a company gets progressively more expensive.')}</p>
          <dl class="kv">
            <dt>${L('交易佣金', 'Commission')}</dt><dd>${pctPlain(s.fees.commission, 2)} (min ${money(s.fees.minCommission)})</dd>
            <dt>${L('买卖价差', 'Bid/ask spread')}</dt><dd>${pctPlain(s.fees.spread, 2)}</dd>
            <dt>${L('资本利得税', 'Capital gains tax')}</dt><dd>${pctPlain(s.tax.capGain, 0)}</dd>
            <dt>${L('股息税', 'Dividend tax')}</dt><dd>${pctPlain(s.tax.div, 0)}</dd>
            <dt>${L('可交易标的', 'Tradable assets')}</dt><dd>200 ${L('股票', 'stocks')} · 8 ${L('大宗', 'commodities')} · 23 ${L('加密货币', 'crypto')} · 12 ${L('商圈', 'districts')}</dd>
            <dt>${L('开局历史行情', 'Pre-seeded history')}</dt><dd>${L('30 个游戏日', '30 in-game days')}</dd>
          </dl>`)}

        ${S('🌍', L('宏观周期', 'Macro regimes'), `<p>${L(
          '世界不是静止的。每个游戏月会重掷一次宏观周期：繁荣 → 扩张 → 平稳 → 通胀 → 放缓 → 衰退 → 危机。它会<b>同时</b>改变四件事：股市的长期漂移、市场波动率、央行政策利率（进而改变你的存款和贷款利率），以及所有店铺的客流。偶尔还会砸下「金融危机」「可控核聚变商业化」这类世界事件，直接改写整个盘面。',
          'The world is not static. Every in-game month the macro regime is re-rolled: Boom → Expansion → Steady → Inflation → Slowdown → Recession → Crisis. It moves four things at once: equity drift, market volatility, the central bank policy rate (and therefore your deposit and loan rates), and footfall at every store. Occasionally a world event — a banking collapse, commercial fusion — rewrites the board outright.')}</p>`)}

        ${S('🏬', L('实业经营的六个杠杆', 'Six levers on every business'), `<ul>
          <li><b>${L('选址', 'Location')}</b> — ${L('大城市投入更高但单位回报更好，波动也更大', 'bigger cities cost more, return more, and swing harder')}</li>
          <li><b>${L('定价策略', 'Pricing')}</b> — ${L('低价拉客流、长期抬高客流基准；高价短期利润高但顾客会慢慢流失。这是最有深度的一个决策。', 'discounting builds long-run footfall; premium pricing harvests now and churns customers later. The most interesting decision in the game.')}</li>
          <li><b>${L('人手', 'Staffing')}</b> — ${L('每名员工支撑一定营收，人手不足会直接损失订单并赶走客人', 'each employee supports a slice of revenue; understaffing loses orders and drives customers away')}</li>
          <li><b>${L('扩建', 'Expansion')}</b> — ${L('营收 ×1.32/级，成本 ×1.18/级，最高 12 级', 'revenue ×1.32 per level, costs ×1.18, up to level 12')}</li>
          <li><b>${L('营销', 'Marketing')}</b> — ${L('直接提营收，并抬高客流基准', 'lifts revenue directly and raises the footfall baseline')}</li>
          <li><b>${L('翻新', 'Refurbishment')}</b> — ${L('店铺状况随时间衰减，状况差会同时压低营收、抬高成本', 'condition decays over time; a run-down store earns less and costs more')}</li>
        </ul>
        <p style="margin-top:8px">${L(
          '至于打工：正常班每个游戏日 8:00–20:00 共 12 小时自动结算，另外最多可以加班 6 小时（1.6 倍工资）。一天就 24 小时，剩下的时间留给睡觉——所以打工收入是有硬上限的，真正能无限放大的是生意。',
          'On employment: the regular shift runs 08:00–20:00 (12 hours, paid automatically), plus up to 6 overtime hours at 1.6× pay. A day is still 24 hours and you do need to sleep — wage income is hard-capped, while businesses scale without limit.')}</p>
        <p style="margin-top:8px">${L('另外，店铺所在城市的<b>商圈繁荣度</b>会直接乘在营收上——去「行情 → 商圈」可以投资它。', 'On top of that, the <b>district prosperity</b> of the host city multiplies store revenue directly — you can invest in it under Markets → Districts.')}</p>`)}

        ${S('🏦', L('银行、信用与房贷', 'Bank, credit & mortgages'), `<p>${L(
          `所有利率都跟随<b>央行政策利率</b>（当前 <b>${pctPlain(s.bank.policyRate)}</b>）浮动，而政策利率由宏观周期决定。你的<b>信用分</b>（300–850）决定在这个基准上加多少点：按时还款 +2，逾期 -35，负债率过高会持续扣分。房贷利率显著低于信用贷，因为有房产作抵押；卖房时会自动结清剩余贷款。`,
          `Every rate floats off the <b>central bank policy rate</b> (currently <b>${pctPlain(s.bank.policyRate)}</b>), which the macro regime sets. Your <b>credit score</b> (300–850) decides the spread on top: +2 per on-time payment, −35 for a miss, and sustained leverage grinds it down. Mortgages price well below unsecured loans because the property is collateral; selling settles the balance automatically.`)}</p>`)}

        ${S('🏛️', L('把公司整个买下来', 'Owning a company outright'), `<p>${L(
          '每家上市公司都有一个二级市场<b>限购比例</b>。买满之后，你可以发起<b>全面收购要约</b>：按 20%~65% 的溢价一次性吃下剩余全部股份，取得 100% 所有权。之后这家公司每月直接向你上缴利润（远高于分红）——但如果它是亏损公司，窟窿也得你自己填。<b>富豪榜上那些人的身家和这些公司的股价是联动的</b>：你买走多少，他们就少多少。',
          'Every listed company has a cap on how much you can accumulate in the open market. Once you hit it, you can launch a <b>tender offer</b>: buy out the remaining float at a 20–65% premium for 100% ownership. From then on it remits its profit to you monthly — far more than dividends — but if it is loss-making, you cover the losses. <b>The billionaires on the rich list are tied to these same share prices</b>: whatever you take, they lose.')}</p>`)}
      </div></div>

      <div>
        <div class="card" style="margin-bottom:16px"><div class="card-h"><h3>📊 ${L('当前世界状态', 'World state')}</h3></div>
          <div class="card-b">
            <div class="regime-chip regime-${s.macro.id}" style="margin-bottom:12px">${s.macro.emoji} ${esc(nm({ zh: s.macro.zh, en: s.macro.en }))}</div>
            <dl class="kv">
              <dt>${t('macro.policy')}</dt><dd>${pctPlain(s.macro.policyRate)}</dd>
              <dt>${t('mkt.marketIndex')}</dt><dd>${s.index.level.toFixed(1)}</dd>
              <dt>${L('游戏内日期', 'In-game date')}</dt><dd>${s.now.date.text}</dd>
              <dt>${L('时间流速', 'Time scale')}</dt><dd>${mins} min = 1 h</dd>
              <dt>${L('你已经营', 'Played')}</dt><dd>${s.player.playedHours} h</dd>
            </dl>
            <p class="dim2" style="font-size:11.5px;line-height:1.7;margin-top:12px">${t('macro.explain')}</p>
          </div></div>

        <div class="card"><div class="card-h"><h3>⚙️ ${t('about.account')}</h3></div>
          <div class="card-b">
            <dl class="kv" style="margin-bottom:16px">
              <dt>${L('昵称', 'Nickname')}</dt><dd>${esc(s.player.nickname)}</dd>
              <dt>${L('净资产', 'Net worth')}</dt><dd>${money(s.netWorth.total)}</dd>
              <dt>${L('存档位置', 'Save file')}</dt><dd style="font-size:11px">data/game.db</dd>
            </dl>
            <div style="border-top:1px solid var(--line);padding-top:14px">
              <div class="down" style="font-size:11px;font-weight:800;letter-spacing:.5px;margin-bottom:10px">⚠️ ${t('about.danger')}</div>
              <p class="dim2" style="font-size:11.5px;line-height:1.6;margin-bottom:8px">${t('about.resetDesc')}</p>
              <button class="btn btn-sm btn-danger btn-block" id="ab-reset" style="margin-bottom:14px">${t('about.resetSave')}</button>
              <p class="dim2" style="font-size:11.5px;line-height:1.6;margin-bottom:8px">${t('about.delDesc')}</p>
              <button class="btn btn-sm btn-danger btn-block" id="ab-del">${t('about.delAcc')}</button>
            </div>
          </div></div>
      </div>
    </div>`;

    $('#ab-reset').onclick = async () => {
      const ok = await confirmBox(t('about.resetSave'), t('about.resetDesc'), t('about.resetSave'));
      if (!ok) return;
      try { await api.reset(); toast(t('toast.success'), 'ok'); await app.refresh(true); }
      catch (e) { toast(e.message, 'err'); }
    };
    $('#ab-del').onclick = () => {
      modal({
        title: t('about.delAcc'), icon: '⚠️',
        body: `<p class="dim" style="line-height:1.8;margin-bottom:14px">${t('about.delDesc')}</p>
          <label class="field"><span>${t('about.delConfirm')}</span><input id="del-pw" type="password" autocomplete="off"></label>`,
        footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-danger" id="del-ok">${t('about.delAcc')}</button>`,
        onMount: (el, close) => {
          el.querySelector('[data-close]').onclick = close;
          el.querySelector('#del-ok').onclick = async () => {
            try {
              await fetch('/api/account/delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('be_token') },
                body: JSON.stringify({ password: el.querySelector('#del-pw').value }),
              }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); });
              setToken(null); location.reload();
            } catch (e) { toast(e.message, 'err'); }
          };
        }
      });
    };
  },
};
