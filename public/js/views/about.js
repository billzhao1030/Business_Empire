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
          `现实 <b>${mins} 分钟</b> = 游戏 <b>1 小时</b>。一个游戏日 = ${mins * 24} 分钟，一个游戏月（30 天）= ${(mins * 720 / 60).toFixed(0)} 小时现实时间，一个游戏年 = ${(mins * 8640 / 1440).toFixed(1)} 天。<br><b>关掉网页也照常结算</b>：店铺继续营业、利息继续滚、贷款继续扣、股价继续波动。回来时会一次性补算——但<b>离线收益最多只结算 ${s.offlineCap?.days ?? 7} 个游戏日</b>，生意不会替你无限囤积（行情本身仍会推进完整时长）。`,
          `<b>${mins} real minutes</b> = <b>1 in-game hour</b>. One game day is ${mins * 24} minutes; one game month is ${(mins * 720 / 60).toFixed(0)} real hours; one game year is ${(mins * 8640 / 1440).toFixed(1)} days.<br><b>Everything accrues offline</b> — stores trade, interest compounds, loans are debited and prices move. It is all settled when you come back, though <b>offline earnings settle at most ${s.offlineCap?.days ?? 7} in-game days</b>; the market itself still advances the full span.`)}</p>`)}

        ${S('🧭', L('白手起家的路线', 'The path from zero'), `<ol style="padding-left:20px;color:var(--dim);line-height:2;font-size:13px">
          <li>${L('开局身上是 <b>$0</b>。上班时间工资自动结算，非上班时间可以去<b>生涯</b>页接加班', 'You start with <b>$0</b>. Wages accrue automatically during your shift; outside it you can take overtime on the <b>Career</b> page')}</li>
          <li>${L('每单加班实打实占用 <b>1 个游戏工时</b>（现实 1 分钟），干完才到账。深夜加班有 2.2× 夜班津贴，但极耗体力', 'Each overtime hour genuinely occupies <b>one in-game work hour</b> (1 real minute) and pays when it finishes. Night shifts pay a 2.2× premium but drain stamina fast')}</li>
          <li>${L('攒到 <b>$50</b> 开出第一个街头小摊，它会替你 24 小时不停地赚钱', 'At <b>$50</b> you can open your first street stall, which then earns around the clock')}</li>
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
          <li><b>${L('营业时间', 'Opening hours')}</b> — ${L('煎饼摊只做 6:00–11:00 的早餐，夜市大排档 18:00 才开门。<b>只有营业时段才有营收和人工</b>，房租却是 24 小时都在烧。可以花钱改成 24 小时营业', 'the pancake cart only trades 06:00–11:00; the night market opens at 18:00. <b>Revenue and wages only accrue while open</b>, but rent burns around the clock. You can pay to go 24-hour')}</li>
          <li><b>${L('店长', 'Managers')}</b> — ${L('每家店每天要占用你 0.8~4.7 小时的管理精力，管理时间超过 8 小时你就没法再打工了。雇店长可以把这块时间买回来', 'each shop takes 0.8–4.7 hours of your day; past 8 hours of management you cannot hold a job at all. Hiring a manager buys that time back')}</li>
        </ul>
        <p style="margin-top:8px">${L(
          '成本是按真实生意拆开的：<b>进货成本</b>占营收 42%，<b>人工</b>约 22%（一名员工大约创造自身工资 4.5 倍的营收），<b>房租</b>按开办成本的比例逐月扣、关门也照付，净利率稳定在 26~30%。回本周期从小摊的 38 个游戏日到重资产的 330 天——不再是三天回本的童话。<br>大城市营收更高，但<b>房租涨得比营收更快</b>：同一家奶茶店，小镇 82 天回本，迪拜要 213 天。去大城市图的是单店能吃下更多资本，而不是更高的回报率。<br>而且<b>异地开店必须亲自飞过去</b>：往返机票 + 在当地待上几天，这期间你不能上班。',
          'Costs are broken out the way a real business is: <b>cost of goods</b> at 42% of takings, <b>wages</b> around 22% (one employee generates roughly 4.5× their own wage), and <b>rent</b> charged monthly against the fit-out cost whether the doors are open or not. Net margin settles at 26–30%, and payback runs from 38 in-game days for a stall to 330 for heavy industry — no more three-day miracles.<br>Bigger cities take more but <b>rent rises faster than revenue</b>: the same bubble tea shop pays back in 82 days in a small town and 213 in Dubai. You go to the big city to deploy more capital per shop, not for a better return.<br>And <b>opening in another city means flying there</b>: return airfare plus days on the ground, during which you cannot work.')}</p>
        <p style="margin-top:8px">${L(
          '工资是按现实标准定的：发传单 $8/小时、送外卖 $14、网约车司机 $28、软件工程师 $85、职业经理人 CEO $900。一天被切成三段——<b>23:00–07:00 睡觉</b>（恢复体力）、<b>09:00–17:00 正常班</b>（8 小时自动结算）、其余时间可以加班。每接一单加班就真的占用 1 个游戏工时，这一小时过完钱才到账，期间不能再接第二单。加班还会掉<b>体力</b>，体力低了工作效率直接下降，低于 15 就干不动了。每天加 4 小时以内可持续，加满 6 小时会把自己熬垮。所以打工收入被时间和身体双重封顶，真正能无限放大的是生意。',
          'Wages are set at realistic rates: $8/hr handing out flyers, $14 couriering, $28 driving rideshare, $85 engineering, $900 as a professional CEO. The day splits three ways — <b>23:00–07:00 sleep</b> (restores stamina), <b>09:00–17:00 regular shift</b> (8 hours, paid automatically), and the rest is available for overtime. Each overtime shift genuinely occupies one in-game work hour: the money lands when the hour is done, and you cannot start another until then. Overtime also burns <b>stamina</b>, which directly cuts your output when it runs low and blocks overtime entirely below 15. Up to 4 hours a day is sustainable; maxing 6 burns you out. Wage income is capped by both the clock and your body — businesses are the only thing that scales.')}</p>
        <p style="margin-top:8px">${L('另外，店铺所在城市的<b>商圈繁荣度</b>会直接乘在营收上——去「行情 → 商圈」可以投资它。', 'On top of that, the <b>district prosperity</b> of the host city multiplies store revenue directly — you can invest in it under Markets → Districts.')}</p>`)}

        ${S('🏆', L('富豪榜与公司榜：你做的事真的会动到他们', 'The leaderboards, and how you move them'), `<p>${L(
          '富豪榜上有 <b>218 个人</b>，覆盖全部 200 家上市公司——每一支股票背后都有具体的大股东，从马斯特、贝索夫这些招牌人物，到各家公司的创始人、二代掌门、家族信托实控人。公司榜按市值排全部 201 家公司，你自己的公司也在里面，未上市的按估值折算。<br>关键在于<b>这些人不是背景板</b>。有两条路能真的动到他们的钱：<br><b>一、买他们公司的股份。</b>你买走的部分就不再算在原股东名下——你持有 5%，他的股权价值就少 5%；买到 100%，他就从这家公司里被整个抹掉，只剩场外资产。<br><b>二、在同一个赛道上把生意做大。</b>你的公司年营收按市销率折成等效市值，和该板块所有上市公司的总市值相比，就是你的份额。份额越高，那个板块所有对手的<b>内在价值</b>被压得越快——拿到 10% 的份额，他们每年掉 5.5%，而且这是基本面下压，不是情绪波动，均值回归拉不回来。富豪榜的影响面板会一直记着<b>你累计从他们手里拿走了多少市值</b>，跨过 1%、5%、12%、25% 的门槛时，市场快讯里会出现你的名字。',
          'The rich list carries <b>218 people</b> and covers all 200 listed companies — every stock has a real major shareholder behind it, from the marquee names down to founders, second-generation heirs and family-trust controllers. The company board ranks all 201 companies by market cap, yours included, with private ones entered at their valuation.<br>What matters is that <b>these people are not scenery</b>. Two things genuinely move their money:<br><b>One: buy stock in their company.</b> Whatever you own stops counting as theirs — hold 5% and their equity is worth 5% less; reach 100% and they are erased from that company entirely, left with only their outside assets.<br><b>Two: build at scale in their sector.</b> Your company\'s annual revenue converts to an equivalent market value and is measured against the combined cap of every listed company in that sector — that is your share. The more you hold, the faster their <b>intrinsic value</b> is dragged down: at 10% share they lose 5.5% a year, and because it is a fundamental drag rather than sentiment, mean reversion does not pull it back. The impact panel keeps a running total of <b>how much market value you have taken off them</b>, and crossing 1%, 5%, 12% and 25% puts your name in the market wire.')}</p>`)}

        ${S('🕯️', L('市场传闻：会应验的隐晦信号', 'Rumours: signals that turn out to be true'), `<p>${L(
          '行情页上有一栏<b>市场传闻</b>。它们从来不说「哪个板块要涨」，只说上下游看得见的细节：<b>「港口的滚装船位排到了三个月之后」</b>、<b>「经销商的库存周转天数，悄悄从 18 天拉长到 41 天」</b>、<b>「封测厂开始三班倒，工程师的加班表排到了下个季度」</b>。板块会标出来，方向要你自己从字面里读。<br>这些不是气氛组。每条传闻背后都有一个<b>已经排好期的催化剂</b>：某个板块会在 30~110 个游戏小时后真的动起来，幅度 5%~18%，持续两天多，内在价值同步重估——涨上去是站得住的。<br>但也不是白送钱：<b>七成应验，两成不了了之，还有一成是放出来骗人的，会朝反方向走</b>。用二十八个游戏月、113 轮传闻实测：读懂方向后顺势操作，持有一个游戏周的平均收益 <b>+4.3%</b>、胜率 <b>67%</b>；作为对照，随机挑板块随机方向是 <b>−0.3%</b>。看得懂就是真的有优势，但会被骗，也会踩空。',
          'The market page carries a panel of <b>rumours</b>. They never say which way a sector is going — only what is visible up and down the supply chain: <b>"Ro-ro berths at the port are booked three months out."</b> <b>"Dealer inventory turns quietly stretched from 18 days to 41."</b> <b>"The packaging plants went to three shifts, with engineer overtime booked into next quarter."</b> The sector is tagged; the direction is yours to read.<br>They are not decoration. Behind each one is a <b>catalyst already on the schedule</b>: that sector really will move, 30 to 110 in-game hours later, by 5–18% over a couple of days, with intrinsic value re-rated alongside so the move holds.<br>Nor is it free money: <b>seven in ten come true, two in ten come to nothing, and one in ten is planted and moves against you</b>. Measured over 28 in-game months and 113 rumours: reading the direction correctly and trading it returned <b>+4.3%</b> on average over one in-game week with a <b>67%</b> hit rate, against <b>−0.3%</b> for picking a random sector and a random direction. The edge is real. So is getting burned.')}</p>`)}

        ${S('🌏', L('开店：全世界 7,330 座城市', 'Where to open: any of 7,330 cities'), `<p>${L(
          '原来只有六个抽象档位（乡镇 / 本市 / 区域中心…），现在<b>地图上的每一座城市都能开店</b>。当地的经营参数不是编出来的，而是从两件事推出来的：<b>物价水平</b>（所在国家的世界银行收入分组 × 城市规模溢价）和<b>客流</b>（人口，外加世界城市与首都的溢价）。你的家乡永远是 1.00 的基准，其余城市相对它有多贵、多热闹，一算就出来。<br><b>房租涨得比营收快</b>——这是大城市开店最难受的地方。以阿德莱德为基准，东京的营收是 2.06 倍，房租却是 <b>3.62 倍</b>；纽约 1.82 对 2.89。所以在东京开一家夜市大排档，日净利 $511（家乡 $261），但建店要 $43.7K（家乡 $16K），回本要 <b>86 天</b>（家乡 61 天）。<b>大城市是用更差的回报率换更高的绝对利润</b>，这正是现实中连锁扩张的取舍。<br>反过来，摩洛哥、肯尼亚、哈萨克斯坦这些中等物价的地方回本最快（约 39 天），但单店利润只有大城市的三分之一。设备与装修按国际价走（成本有下限），所以再穷的地方也不可能几乎白开一家店。<br>去外地开店要<b>亲自跑一趟</b>：机票按真实大圆距离算，加上在外面几天的食宿，这几天你不能上班。',
          'There used to be six abstract tiers — country town, your city, regional hub. <b>Now every city on the map can hold a shop</b>, and the local economics are not invented: they follow from two things, the <b>cost level</b> (the country\'s World Bank income group times a city-size premium) and the <b>footfall</b> (population, plus a premium for world cities and capitals). Your hometown is always the 1.00 baseline, and everywhere else is priced relative to it.<br><b>Rent rises faster than revenue</b> — that is what makes a big city hard. Against Adelaide, Tokyo does 2.06× the revenue on <b>3.62× the rent</b>; New York, 1.82 against 2.89. So a night-market stall in Tokyo nets $511 a day against $261 at home, but costs $43.7K to build against $16K, and takes <b>86 days</b> to pay back against 61. <b>A big city buys higher absolute profit with a worse return on capital</b> — which is exactly the trade a real chain faces.<br>The other way round, mid-cost countries like Morocco, Kenya and Kazakhstan pay back fastest at around 39 days, but each shop earns a third of what a global-city one does. Equipment and fit-out are priced internationally, so nowhere is ever nearly free to build in.<br>Opening abroad means <b>going there yourself</b>: airfare from the real great-circle distance plus a few nights\' board, and you cannot work those days.')}</p>`)}

        ${S('🏢', L('创业：从一家店到一家公司', 'Founding a company: from one shop to a business worth something'), `<p>${L(
          '一家店就是一家店，一家公司不一样——公司有<b>估值</b>。估值不是你投进去多少钱，而是<b>年利润的倍数</b>，倍数由三件事决定：<b>增长率</b>（每 +100% 年增长，倍数 +8，这是最要紧的一条）、<b>赛道热度</b>（跟着股市板块轮动走）和<b>规模</b>（店铺数每多一个数量级 +1.6）。基础是 6 倍，上限 45 倍。<br>估值取三种算法里最高的一个：<b>按利润</b>（年利润 × 倍数）、<b>按营收</b>（只留给还没盈利但年增长超过 50% 的公司——市场肯按营收给钱，正因为还没有利润可看）、<b>按清算</b>（店铺投入的残值 + 公司现金，这是兜底）。用的是<b>滚动平滑</b>的利润而不是此刻的瞬时值，否则小生意的客流波动会让市值一天砍半。<br>公司赚的钱进<b>公司账户</b>：拿去开更多店会推高估值，分红到自己手上要缴 20% 的税。这是这个游戏里最真实的一道选择题——<b>钱留在里面是复利，拿出来才是你能花的</b>。<br>估值和店铺数够了就能<b>融资</b>：天使轮、A、B、C，投资人给你钱、拿走股份。他们给的估值总比你自己算的低（天使轮压到 68%），增长越快、信用越好，压得越少。每融一轮你的持股就少一截——这是拿别人的钱把生意做大必须付的价钱。未上市的股权计入身家时打七折，因为卖不掉的钱不算钱。<br><b>公司不止能开一家</b>——最多同时经营 8 家。每家装不同的生意，估值、增长、融资进度、公司账户全部各算各的：一家分红不会动另一家的钱，一家上市也不影响另一家。开新店的时候可以指定由谁出钱，用哪家公司的钱开的店就归哪家。<br>融过两轮、估值过 <b>$5M</b>、名下 <b>12 家店</b>、并且真的在盈利，就可以<b>敲钟上市</b>。公开发行 25% 的新股，发行价按估值定——大盘火热时承销商敢溢价发行，冷的时候就得让利。上市之后<b>你的公司会变成行情页上一支真的股票</b>，和 Appel、Envidia 排在一起：股价按自己的经营基本面（估值 ÷ 总股本）做均值回归，公司越赚钱股价越有底。你手上的股份变成一条<b>普通持仓</b>——可以卖掉换现金，也可以在市场上一点点买回来。身家从此跟着股价一起波动，富豪榜上的名次也一样。',
          'A shop is a shop. A company is different: a company has a <b>valuation</b>, and a valuation is not what you put in. It is a <b>multiple of annual profit</b>, and the multiple is set by three things: <b>growth</b> (+8 to the multiple for every 100% of annual growth — by far the most important), <b>sector heat</b> (tracking the same rotation that moves the stock market) and <b>scale</b> (+1.6 per order of magnitude of shops). It starts at 6× and tops out at 45×.<br>The valuation is the highest of three methods: <b>earnings</b> (annual profit × multiple), <b>revenue</b> (reserved for companies not yet profitable but growing above 50% a year — the market pays on revenue precisely when there is no profit to look at), and <b>liquidation</b> (recoverable value of what you built plus company cash, which is the floor). It uses <b>smoothed</b> profit rather than the instantaneous rate; otherwise ordinary footfall noise in a small business would halve the company overnight.<br>What the company earns goes into the <b>company account</b>. Spent on more shops it compounds the valuation; paid out to you as a dividend it is taxed at 20%. That is the sharpest choice in this game — <b>money left inside compounds, money taken out is money you can spend</b>.<br>With enough valuation and enough shops you can <b>raise a round</b>: angel, A, B, C. Investors hand you cash and take equity, and they always price you below your own number — the angel round at 68% of it — narrowing as your growth and credit improve. Every round costs you a slice of the company. That is the price of building with someone else\'s money. Private equity counts toward your net worth at a 30% discount, because money you cannot sell is not money.<br><b>You are not limited to one company</b> — you can run up to eight. Each holds a different set of businesses and is valued, grown, funded and banked entirely separately: paying a dividend from one does not touch another, and listing one does not affect the rest. When you open a shop you choose who pays, and a shop bought with a company\'s money belongs to that company.<br>Two rounds raised, a valuation above <b>$5M</b>, <b>twelve businesses</b> and actual profit, and you can <b>ring the bell</b>. A quarter of the company is floated as new shares, priced off the valuation — underwriters price at a premium when the market is hot and have to leave money on the table when it is not. From then on <b>your company is a real stock on the market page</b>, listed alongside Appel and Envidia: its price mean-reverts to its own fundamentals (valuation divided by shares outstanding), so the more it earns the firmer the floor under it. Your stake becomes an <b>ordinary position</b> — sell it for cash, or buy it back share by share. Your net worth, and your place on the rich list, move with the price from then on.')}</p>`)}

        ${S('🍚', L('生活开销：钱是怎么没的', 'Cost of living: where the money goes'), `<p>${L(
          '每天都要吃饭，每月都要交房租，出门还得有路费——这几笔钱从你赚到第一块钱的那天起就没停过。<b>伙食</b>八档，从「饿着」($0) 到「私人厨师」($380/天)：吃得差会持续掉体力、涨压力，患病概率最高翻一倍；吃得好则相反。其中<b>「买菜做饭」($12/天) 和「精心下厨」($25/天) 是专门留给会过日子的人的</b>——比在外面吃便宜，也比在外面吃养人，代价是每天实打实要花 1.2~1.7 小时，直接从你能加班的时间里扣。<b>住处</b>三档，合租单间 $340/月到高档公寓 $2,200/月；买了自己的房子就不用再交房租。<br><b>通勤</b>四档：没有车就只能走路（免费，但每天 1.4 小时）或者挤公交（$6/天，0.9 小时），舍得花钱可以打车（$26/天，0.4 小时）；等你真买了车，油钱、停车和保险摊下来是 $13/天。路费只在出门那天扣，路上的时间却是天天照扣。<br>开局在发传单（$8/工时）时，自己做饭 + 合租 + 走路 = <b>每月 $700，占底薪的 42%</b>；换成路边摊 + 合租 + 公交则是 <b>$892，54%</b>。这就是为什么攒钱不容易。<br>如果连饭钱都拿不出来，你会自动变成「饿着」——身体撑不了几天。',
          'You eat every day, pay rent every month, and pay a fare every time you leave the house. None of it stops from the moment you earn your first dollar. <b>Meals</b> come in eight tiers, from skipping them ($0) to a private chef ($380/day): eating badly drains stamina, adds stress and doubles your chance of falling ill; eating well does the reverse. Two of those tiers — <b>cooking at home ($12/day) and cooking properly ($25/day)</b> — are cheaper than eating out and better for you than eating out, and they cost the one thing you cannot buy back: 1.2 to 1.7 hours every single day, taken straight out of the time you could have spent on overtime. <b>Housing</b> runs from a $340/month shared room to a $2,200 apartment — and once you own a home, the rent stops.<br><b>Getting to work</b> has four tiers. With no car you walk (free, but 1.4 hours a day) or take the bus ($6/day, 0.9 hours); ride-hailing buys the morning back at $26/day. Once you actually own a car, fuel, parking and insurance come to $13 a day. You only pay on days you go out — but the time comes out of every one of them.<br>On a flyer-handout wage ($8/hour), cooking plus a shared room plus walking is <b>$700 a month, 42% of your base pay</b>; street food plus the bus is <b>$892, or 54%</b>. That is why saving is hard.<br>If you cannot cover food at all you are forced to skip meals, and your body will not take much of that.')}</p>`)}

        ${S('🎫', L('彩票', 'The lottery'), `<p>${L(
          '三种彩票，中奖概率照搬真实彩种：刮刮乐（头奖 1/25 万）、福彩乐透（1/1398 万）、超级大乐透（<b>1/1.4 亿</b>——比被雷劈中的概率低得多）。期望回报分别是 <b>57% / 46% / 46%</b>，也就是说你每投入 $100，长期平均只能拿回四五十块。奖池会随销量累进，没人中就一直涨。<br>放在这里不是让你发财的，是让你亲眼看看这笔账。',
          'Three lotteries with odds lifted from real draws: scratch cards (1 in 250,000), Lotto 6/49 (1 in 13,983,816) and the Mega Jackpot (<b>1 in 139,838,160</b> — far longer odds than being struck by lightning). Expected returns are <b>57% / 46% / 46%</b>: for every $100 you put in, you get roughly $50 back over the long run. Jackpots roll over and grow until somebody wins.<br>It is not here to make you rich. It is here so you can watch the arithmetic yourself.')}</p>`)}

        ${S('🗺️', L('世界地图与人生足迹', 'The world map and where you have been'), `<p>${L(
          '人生是需要见世界的。开局时你会在地图上<b>落一个 pin</b> 决定出生地——24 座城市可选，从阿德莱德到东京、伦敦、圣保罗、拉各斯。出生地一旦确定就不能更改，因为此后<b>所有机票价格与飞行时长，都按你和目的地之间的真实大圆距离计算</b>：伦敦到巴黎 343 公里 $100，到阿德莱德 16,265 公里 $1,900。<br>41 个目的地遍布七大洲，每一趟行程要选<b>住几晚、什么舱位、什么档次的住宿</b>，费用拆成机票、住宿和日常开销三笔。行程越长、住得越好，压力缓解越多，声望也越高。<br>去过的每一个地方都会记进<b>人生足迹</b>：第一次抵达的日期、去过几次、住了多少晚、花了多少钱——这一辈子的历练，都在那张地图上。<br>地图本身是<b>真实的世界地图</b>：Natural Earth 公有领域数据，241 个国家与地区的实际海岸线与国界，加上<b>全球 7,330 座真实城市</b>——从东京、纽约到冰岛的雷克雅未克、乌干达的卡塞塞，全部带中英文名与真实人口。可以拖动平移、滚轮缩放到 14 倍；<b>放得越大，浮出来的城市越小</b>，标注按位置先到先得，不会整批闪现。<br><b>这 7,330 座城市每一座都能去。</b>机票按你和它之间的真实大圆距离算；酒店与日常开销按<b>所在国家的收入分组</b>（世界银行口径）乘上<b>城市规模溢价</b>推出来——同样住三星，苏黎世 $138 一晚，孟买 $66，拉各斯 $63。出生地也一样：两万人以上的城市共 5,479 座，任你挑，或者直接在地图上落一个 pin。所有数据随游戏一起离线打包，游戏运行期间不向任何外部服务器发一个请求。',
          'A life needs seeing the world. At the start you <b>drop a pin</b> on the map to choose where you were born — 24 cities from Adelaide to Tokyo, London, São Paulo and Lagos. It cannot be changed afterwards, because from then on <b>every airfare and flight time is computed from the real great-circle distance</b> between home and destination: London to Paris is 343 km and $100; London to Adelaide is 16,265 km and $1,900.<br>Forty-one destinations across seven continents. Each trip is configured — <b>how many nights, which cabin, what standard of accommodation</b> — and priced as airfare, lodging and daily spending. Longer and better trips relieve more stress and earn more standing.<br>Everywhere you go is recorded in your <b>footprint</b>: the date you first arrived, how many times you returned, nights spent and money spent. A lifetime of it, laid out on one map.<br>The map itself is a <b>real world map</b> — Natural Earth public-domain data: the actual coastlines and borders of 241 countries and territories, plus <b>7,330 real cities</b>, from Tokyo and New York to Reykjavík and Kasese, each with its English and Chinese name and its real population. Drag to pan, scroll to zoom to 14×; <b>the further you zoom, the smaller the cities that surface</b>, with labels claimed on a first-come basis so places emerge one at a time rather than appearing in batches.<br><b>Every one of those 7,330 cities can be visited.</b> Airfare is the real great-circle distance from wherever you were born. Hotel rates and daily spending are derived from the <b>World Bank income group of the country</b> multiplied by a <b>city-size premium</b> — the same three-star room is $138 a night in Zürich, $66 in Mumbai and $63 in Lagos. Birthplace works the same way: any of the 5,479 towns above 20,000 people, or just drop a pin on the map. All of it ships with the game; nothing is ever requested from an outside server while you play.')}</p>`)}

        ${S('⏱️', L('游戏速度', 'Game speed'), `<p>${L(
          '顶栏右侧可以随时调节世界的流速，从最慢的 <b>5 分钟 = 1 游戏小时</b> 到最快的 <b>12 秒 = 1 游戏小时</b>，共五档，上下相差 25 倍。调整时游戏时钟会以当前时刻为锚点重新对齐，不会跳变，存档也不受影响。',
          'The speed control in the top bar changes how fast the world runs, from <b>5 real minutes per in-game hour</b> down to <b>12 seconds</b> — five steps spanning a 25× range. The clock re-anchors on the current moment when you change it, so nothing jumps and no save is affected.')}</p>`)}

        ${S('🧠', L('压力、健康与旅游', 'Stress, health & travel'), `<p>${L(
          '借钱是有代价的，而且不只是利息。<b>负债率</b>超过 35%、<b>月供</b>吃掉超过三成收入，都会持续推高你的<b>精神压力</b>——而且这些是<b>累加</b>的；加班加剧，熬夜更甚。<b>连轴转同样要命</b>：连续工作超过 3 天，睡眠的恢复效率开始下降，第 14 天只剩 42%，压力还会额外每天涨十几点。想真正缓过来，得<b>请假</b>或者<b>出去旅游</b>——睡一觉不可能把什么都补回来。压力超过 50 开始拖累工作效率（最低降到 70%），超过 78 就干不动加班了，而超过 55 之后每小时都有<b>生病</b>的可能——重感冒、急性胃炎、焦虑性失眠、过劳衰竭，最严重的是心脏警报。<br>生病期间无法上班，生意也会因为老板不在而打折。你可以<b>去医院</b>花钱把康复时间砍掉一半以上，也可以硬扛——但硬扛的时候压力还在涨。<br>清空压力最有效的办法是<b>旅游</b>：从 $600 的周末短途到 $600 万的亚轨道太空飞行，七条线路，还能选经济舱/商务舱/头等舱——有私人飞机就不用买机票。<b>旅途中完全无法工作</b>（正常班和加班都停），但你的生意照常运转。',
          'Borrowing costs more than interest. Leverage above 35%, or repayments eating more than a third of your income, steadily raise your <b>stress</b>; overtime adds to it and night shifts more so. Past 50 it degrades your output (down to 70%), past 78 you cannot face overtime at all, and past 55 every hour carries a chance of <b>falling ill</b> — a bad cold, gastritis, anxiety insomnia, burnout, or at worst a cardiac scare.<br>While ill you cannot work, and your businesses take a hit with the owner absent. You can <b>see a doctor</b> to cut recovery time by more than half, or tough it out while the stress keeps climbing.<br>The most effective cure is <b>travel</b>: seven itineraries from a $600 weekend away to a $6M suborbital spaceflight, in economy, business or first — or free of airfare if you own a jet. <b>You cannot work at all while away</b> — neither shift nor overtime — though the businesses keep running.')}</p>`)}

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
              <dt>${L('访问地址', 'Origin')}</dt><dd style="font-size:11px">${esc(location.origin)}</dd>
              <dt>${L('服务版本', 'Server build')}</dt><dd style="font-size:11px" id="ab-build">${esc(String(s.build || '-')).slice(-8)}</dd>
            </dl>
            <div style="border-top:1px solid var(--line);padding-top:14px">
              <button class="btn btn-sm btn-ghost btn-block" id="ab-selftest" style="margin-bottom:10px">🩺 ${L('运行自检', 'Run self-test')}</button>
              <div id="ab-diag" class="summary hidden" style="font-size:11.5px;line-height:1.9;margin-bottom:14px"></div>
              <div class="down" style="font-size:11px;font-weight:800;letter-spacing:.5px;margin-bottom:10px">⚠️ ${t('about.danger')}</div>
              <p class="dim2" style="font-size:11.5px;line-height:1.6;margin-bottom:8px">${t('about.resetDesc')}</p>
              <button class="btn btn-sm btn-danger btn-block" id="ab-reset" style="margin-bottom:14px">${t('about.resetSave')}</button>
              <p class="dim2" style="font-size:11.5px;line-height:1.6;margin-bottom:8px">${t('about.delDesc')}</p>
              <button class="btn btn-sm btn-danger btn-block" id="ab-del">${t('about.delAcc')}</button>
            </div>
          </div></div>
      </div>
    </div>`;

    // 用事件委托绑在容器上：即使视图被重渲染，按钮也永远有效
    root.onclick = async ev => {
      const btn = ev.target.closest?.('#ab-reset, #ab-del, #ab-selftest');
      if (!btn) return;
      if (btn.id === 'ab-del') return doDelete();
      if (btn.id === 'ab-selftest') return selfTest(btn);
      await doReset(btn);
    };

    // 一键自检：把每一步是通是断都摆出来
    const selfTest = async btn => {
      const box = $('#ab-diag');
      box.classList.remove('hidden');
      const rows = [];
      const put = (name, ok, detail) => {
        rows.push(`<div style="display:flex;gap:8px"><span>${ok ? '✅' : '❌'}</span><span style="flex:1">${name}</span><span class="mono dim2" style="font-size:10.5px">${esc(detail || '')}</span></div>`);
        box.innerHTML = rows.join('');
      };
      btn.disabled = true; box.innerHTML = t('common.loading');
      app.busy = true;
      const hit = async (path, opts) => {
        const t0 = Date.now();
        const r = await fetch(path, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('be_token') || '') }, ...opts });
        let body = {}; try { body = await r.json(); } catch {}
        return { status: r.status, ok: r.ok, ms: Date.now() - t0, body, build: r.headers.get('X-Build') };
      };
      rows.length = 0;
      put(L('访问地址', 'Origin'), true, location.origin);
      try {
        const ping = await hit('/api/ping');
        put(L('服务连通', 'Server reachable'), ping.ok, ping.status + ' · ' + ping.ms + 'ms');
        const jsHead = await fetch('/js/views/about.js', { method: 'HEAD' });
        const jsBuild = jsHead.headers.get('X-Build');
        const same = !ping.body.build || !jsBuild || ping.body.build === jsBuild;
        put(L('前后端版本一致', 'Client/server build match'), same, String(ping.body.build || '').slice(-8));
        const me = await hit('/api/me');
        put(L('登录状态', 'Session valid'), me.ok, me.ok ? me.body.user?.username : (me.body.error || me.status));
        const st = await hit('/api/state');
        put(L('读取存档', 'Save readable'), st.ok, st.ok ? (L('现金 ', 'cash ') + Math.round(st.body.player?.cash)) : (st.body.error || st.status));
        const w = await hit('/api/biz/action', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('be_token') || '') }, body: JSON.stringify({ id: 999999, action: 'repair' }) });
        put(L('写入通道', 'Write channel'), w.status === 404 || w.status === 400, w.status + ' ' + (w.body.error || '').split(' / ')[0]);
      } catch (e) {
        put(L('请求失败', 'Request failed'), false, e.message);
      }
      app.busy = false;
      btn.disabled = false;
    };

    const doReset = async rb => {
      const ok = await confirmBox(t('about.resetSave'), t('about.resetDesc'), t('about.resetSave'));
      if (!ok) return;
      const old = rb.textContent;
      rb.disabled = true; rb.textContent = t('common.loading');
      try {
        const r = await app.guard(() => api.reset());
        const c = r.cleared || {};
        toast(t('career.resetDone', { biz: c.businesses ?? 0, hold: c.holdings ?? 0, items: c.items ?? 0,
          loans: c.loans ?? 0, from: money(c.netWorth ?? 0), to: money(r.now?.netWorth ?? 0),
          date: r.now?.date?.text || '' }), 'ok', t('about.resetSave'));
        await app.refresh(true);
      }
      catch (e) { toast(e.message, 'err', t('toast.failed')); rb.disabled = false; rb.textContent = old; }
    };
    const doDelete = () => {
      modal({
        title: t('about.delAcc'), icon: '⚠️',
        body: `<p class="dim" style="line-height:1.8;margin-bottom:14px">${t('about.delDesc')}</p>
          <label class="field"><span>${t('about.delConfirm')}</span><input id="del-pw" type="password" autocomplete="off"></label>`,
        footer: `<button class="btn btn-ghost" data-close>${t('common.cancel')}</button><button class="btn btn-danger" id="del-ok">${t('about.delAcc')}</button>`,
        onMount: (el, close) => {
          el.querySelector('[data-close]').onclick = close;
          const ok = el.querySelector('#del-ok');
          ok.onclick = async () => {
            ok.disabled = true; ok.textContent = t('common.loading');
            app.busy = true;
            try {
              await fetch('/api/account/delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('be_token') },
                body: JSON.stringify({ password: el.querySelector('#del-pw').value }),
              }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); });
              setToken(null); location.reload();
            } catch (e) {
              app.busy = false;
              toast(e.message, 'err', t('toast.failed'));
              ok.disabled = false; ok.textContent = t('about.delAcc');
            }
          };
        }
      });
    };
  },
};
