// ── 市场传闻：会应验的隐晦信号 ──────────────────────────────
// 每条传闻背后都有一个已经排好期的「催化剂」：某个板块会在几十个游戏小时后
// 真的动一下。传闻只描述上下游看得见的迹象，从不直说「要涨」——
// 方向要你自己从字面里读出来。
//
// 但也不是白送钱：约三成的传闻最后不了了之（catalyst.real === false），
// 就像现实里大部分小道消息一样。

// 54 个板块归到 9 个家族，每个家族有自己的一套行话
export const FAMILY_OF = {
  消费电子:'tech', 软件服务:'tech', 互联网:'tech', 社交媒体:'tech', 短视频:'tech',
  游戏:'tech', 云服务:'tech', 网络安全:'tech', 数据分析:'tech', 金融科技:'tech',
  半导体:'chip', 通信设备:'chip', 电信:'chip',
  汽车:'auto', 汽车零部件:'auto', 出行平台:'auto', 新能源:'auto',
  银行:'fin', 投行:'fin', 支付:'fin', 保险:'fin', 资产管理:'fin', 券商:'fin', 控股集团:'fin',
  石油:'energy', 油服:'energy', 矿业金属:'energy', 基础化工:'energy', 公用事业:'energy',
  制药:'health', 生物科技:'health', 医疗保险:'health', 医疗器械:'health',
  饮料:'consumer', 餐饮:'consumer', 服装:'consumer', 零售:'consumer', 奢侈品:'consumer',
  日用消费:'consumer', 电商零售:'consumer', 家用电器:'consumer', 农业食品:'consumer',
  烟酒:'consumer', 本地生活:'consumer', 教育:'consumer',
  航空制造:'industry', 国防军工:'industry', 工程机械:'industry', 工业集团:'industry',
  航空运输:'industry', 物流快递:'industry',
  传媒娱乐:'media', 有线电视:'media', 流媒体:'media',
};

// 每个家族的看多 / 看空暗示。都是从侧面写的：说的是订单、库存、招聘、
// 排期、运价这些先行指标，不是股价。
export const HINTS = {
  tech: {
    up: [
      ['园区的班车表悄悄加了两班夜车，工位却还在往外扩', 'The campus quietly added two more night shuttles, and desks are still going in'],
      ['几家大厂同时把明年的算力采购提前到了这个季度', 'Several big buyers pulled next year’s compute procurement forward into this quarter'],
      ['猎头开始为同一批岗位加价，开的还是三年前的老项目', 'Recruiters are bidding up the same roles again, for a project everyone wrote off three years ago'],
      ['开发者论坛上，那套被嘲笑了很久的接口突然有人认真提交补丁了', 'On the dev forums, patches are landing seriously against an API everyone used to mock'],
    ],
    down: [
      ['两家头部公司的续约率被放进了脚注，字号比去年小了一号', 'Two leaders moved their renewal rate into a footnote, in smaller type than last year'],
      ['招聘页上的岗位一夜之间少了三分之一，公告里只字未提', 'A third of the job listings vanished overnight, with no announcement'],
      ['服务器订单的交付日期被客户主动往后推了两个季度', 'Customers themselves asked to push server deliveries back two quarters'],
      ['连续第三个月，用户时长的图表换成了「累计注册数」', 'For the third month running, the engagement chart was replaced with cumulative sign-ups'],
    ],
  },
  chip: {
    up: [
      ['封测厂开始三班倒，工程师的加班表排到了下个季度', 'The packaging plants went to three shifts, with engineer overtime booked into next quarter'],
      ['一批原本要退役的旧产线被重新通电了', 'A line that was scheduled for decommissioning has been powered back up'],
      ['光刻胶的现货报价连着七周走高，下游没有一家喊停', 'Photoresist spot prices have climbed seven weeks running and not one buyer has flinched'],
      ['代工的产能预订窗口从三个月缩短到了两周', 'The foundry booking window has shortened from three months to two weeks'],
    ],
    down: [
      ['渠道商的芯片库存周转天数，从 21 天悄悄拉长到 58 天', 'Channel inventory turns quietly stretched from 21 days to 58'],
      ['两条先进产线的扩产计划从年报里消失了', 'Two capacity-expansion plans disappeared from the annual report'],
      ['晶圆的现货价第一次跌破了长约价', 'Wafer spot prices have fallen below contract prices for the first time'],
      ['一家大客户把明年的订单拆成了四次小批量', 'A major customer split next year’s order into four small batches'],
    ],
  },
  auto: {
    up: [
      ['港口的滚装船位排到了三个月之后', 'Ro-ro berths at the port are booked three months out'],
      ['经销商开始收回上个月刚发下去的折扣券', 'Dealers are quietly clawing back the discount vouchers they issued last month'],
      ['上游的锂盐现货价连涨七周，下游没人喊停', 'Lithium spot prices are up seven straight weeks and nobody downstream has blinked'],
      ['一家车企把二班的招工启事贴到了县城', 'A carmaker is advertising second-shift jobs as far out as the county towns'],
    ],
    down: [
      ['经销商的库存周转天数，悄悄从 18 天拉长到 41 天', 'Dealer inventory turns quietly stretched from 18 days to 41'],
      ['港口停车场的新车停放天数，破了三年来的纪录', 'New cars are sitting in port car parks longer than at any time in three years'],
      ['两家整车厂把八月的排产计划下调后没有再更新', 'Two assembly plants cut their August schedule and have not updated it since'],
      ['零部件供应商开始主动提出延长账期', 'Parts suppliers have started volunteering longer payment terms'],
    ],
  },
  fin: {
    up: [
      ['同业拆借利率连着五天走低，没人解释为什么', 'Interbank rates have eased five days running and nobody will say why'],
      ['几家机构同时把风控模型里的坏账假设调松了一档', 'Several institutions loosened the bad-debt assumption in their risk models at the same time'],
      ['并购部门的会议室连着两周订满到晚上十点', 'The M&A floor’s meeting rooms have been booked to 10pm for a fortnight'],
      ['一批停了很久的 IPO 材料重新开始补充申报', 'A batch of long-dormant IPO filings has started updating again'],
    ],
    down: [
      ['一家银行把拨备覆盖率的口径改了，改法藏在附注第 47 页', 'A bank changed how it defines provision coverage, on page 47 of the notes'],
      ['同业存单的发行利率，一周之内跳了 40 个基点', 'Certificate-of-deposit issuance rates jumped 40 basis points in a week'],
      ['风控部门开始要求所有新增额度上会', 'Risk has started requiring committee sign-off on every new credit line'],
      ['两家机构的首席风险官在同一个月离职', 'Two chief risk officers resigned in the same month'],
    ],
  },
  energy: {
    up: [
      ['几个主要产区的检修计划被同时推迟了', 'Maintenance windows at several major fields were all pushed back at once'],
      ['油轮的运费一周之内翻了倍，货主还在抢船', 'Tanker rates doubled in a week and charterers are still fighting for hulls'],
      ['库存报告连续四周低于五年均值，没上头条', 'Inventories came in under the five-year average four weeks running, and nobody led with it'],
      ['一批闲置了两年的钻机开始重新招工', 'Rigs idle for two years are hiring crews again'],
    ],
    down: [
      ['两个大产区同时上调了下半年的产量指引', 'Two major producing regions both raised second-half output guidance'],
      ['浮仓的存量创了三年新高，租金还在涨', 'Floating storage hit a three-year high and the rates are still climbing'],
      ['一家炼厂把计划外检修改成了「长期停车」', 'A refinery relabelled an unplanned outage as an indefinite shutdown'],
      ['下游的采购合同开始按月签，不再签年度', 'Downstream buyers have switched from annual contracts to monthly'],
    ],
  },
  health: {
    up: [
      ['一项三期试验的中期分析被提前召开，理由没写', 'An interim analysis for a phase-three trial was convened early, with no reason given'],
      ['原料药的采购量翻了三倍，产品还没上市', 'API procurement tripled for a product that has not launched yet'],
      ['监管的沟通会从两小时延长到了一整天', 'A regulatory meeting was extended from two hours to a full day'],
      ['两家公司同时把同一个适应症写进了年度重点', 'Two companies put the same indication into their annual priorities'],
    ],
    down: [
      ['一份主要试验的入组进度，在年报里被换算成了百分比', 'A pivotal trial’s enrolment was reported as a percentage instead of a number'],
      ['两位主要研究者在同一季度退出了指导委员会', 'Two principal investigators left the steering committee in the same quarter'],
      ['集采的报量文件比去年厚了四十页', 'The tender documents came back forty pages longer than last year'],
      ['一家药企把销售团队从「拓展」改称「维护」', 'A drugmaker renamed its sales force from "expansion" to "coverage"'],
    ],
  },
  consumer: {
    up: [
      ['几个仓库同时开始招夜班分拣工，招的是长期工', 'Several warehouses started hiring night-shift pickers, on permanent contracts'],
      ['门店的排班表上，周中的班次多了两个人', 'Store rosters added two people to the midweek shifts'],
      ['一批本来要关的门店，续签了五年租约', 'Stores that were on the closure list have signed five-year renewals'],
      ['供应商的备货指令比往年提前了六周下发', 'Restocking orders went out to suppliers six weeks earlier than usual'],
    ],
    down: [
      ['促销从「限时」变成了「常态」，海报没换', 'The promotion went from "limited time" to permanent, and nobody changed the poster'],
      ['一家连锁把同店销售增速从财报正文挪进了附表', 'A chain moved same-store growth out of the main text and into an appendix'],
      ['门店的营业时间悄悄提前了一小时打烊', 'Stores quietly started closing an hour earlier'],
      ['退货率的口径在这一季被重新定义了', 'The definition of the return rate was quietly restated this quarter'],
    ],
  },
  industry: {
    up: [
      ['一批停在跑道尽头的机身开始重新喷漆', 'Airframes parked at the end of the runway are being repainted'],
      ['几个总装厂同时把交付节奏从月度改成了周度', 'Several assembly halls switched their delivery cadence from monthly to weekly'],
      ['港口的集装箱吞吐连续三周超过设计能力', 'Container throughput has run over design capacity three weeks running'],
      ['二手工程机械的挂牌量，一个月里少了一半', 'Used-equipment listings halved in a month'],
    ],
    down: [
      ['一批新机的交付被客户要求「暂缓安排」', 'Customers have asked for new deliveries to be "held pending scheduling"'],
      ['两条总装线的夜班取消了，公告里说是「优化排产」', 'Two assembly lines dropped the night shift, described as "schedule optimisation"'],
      ['干散货运价指数跌回了两年前的位置', 'Dry bulk freight rates are back where they were two years ago'],
      ['设备租赁的开机小时数，连着五个月往下走', 'Equipment utilisation hours have fallen five months in a row'],
    ],
  },
  media: {
    up: [
      ['几个大制作同时把开机时间提前到了年内', 'Several big productions pulled their start dates into this year'],
      ['广告位的刊例价没变，但折扣不给了', 'Rate cards are unchanged, but the discounts have stopped'],
      ['一批版权到期后没有续约，被人整批买走了', 'A block of expiring rights was not renewed — someone bought the lot'],
      ['转播权的招标从邀请制改成了公开竞价', 'Broadcast rights moved from invitation-only to open auction'],
    ],
    down: [
      ['付费订阅数在财报里第一次和「注册数」合并披露', 'Paid subscribers were reported together with sign-ups for the first time'],
      ['两个头部节目的续订决定被推迟到了下个财年', 'Renewal decisions on two flagship shows slipped into next fiscal year'],
      ['广告主开始按周签，不再按季', 'Advertisers have started buying weekly instead of quarterly'],
      ['一家平台把内容支出的口径改成了「含摊销」', 'A platform restated content spend to be "inclusive of amortisation"'],
    ],
  },
};

// 传闻应验之后的确认新闻：这时候才说得明白，但也来不及了
export const CONFIRM = {
  up: [['{X}板块全线走强，此前的迹象终于连成了线', 'The {X} sector is broadly higher — the signs finally joined up']],
  down: [['{X}板块集体回调，之前那些细节原来都是伏笔', 'The {X} sector sold off — those small details were the tell all along']],
};

// ── 点名到公司的传闻 ────────────────────────────────────────
// {X} 会替换成具体那家公司。说法仍然是隐晦的——只讲看得见的迹象，
// 不说「要涨」——但你至少知道该盯哪一支股票了。
export const CO_HINTS = {
  up: [
    ['{X} 的供应链最近突然紧了，上游几家都在加班赶货', '{X}’s supply chain has tightened; its upstream suppliers are all running overtime'],
    ['{X} 悄悄把明年的产能预订提前签掉了一半', '{X} quietly locked in half of next year’s capacity ahead of schedule'],
    ['{X} 的招聘页一周里多出了四十个岗位，公告里一个字没提', 'Forty new roles appeared on {X}’s careers page in a week, with no announcement'],
    ['有人看见 {X} 的高管连着两周飞同一个城市', '{X}’s executives have flown to the same city two weeks running'],
    ['{X} 的几个核心供应商同时上调了报价，对方还照单全收', 'Several of {X}’s key suppliers raised prices at once — and {X} paid without arguing'],
    ['{X} 的园区停车场周末满了，保安说这个月一直如此', '{X}’s car park is full at weekends, and the guard says it has been all month'],
    ['{X} 把一笔本来要发的分红改成了留存', '{X} converted a dividend it had planned to pay into retained earnings'],
    ['{X} 的法务这个季度注册了异常多的商标', '{X}’s legal team filed an unusual number of trademarks this quarter'],
    ['{X} 的老对手悄悄停掉了对标那条产品线', '{X}’s oldest rival quietly shut down the line that competed with it'],
    ['券商内部把 {X} 从「观察」挪进了「重点跟踪」，但没发研报', 'A broker moved {X} from watch list to priority coverage without publishing a note'],
    ['{X} 的仓库这个月租了两倍的面积', '{X} leased twice the warehouse space this month'],
    ['{X} 的一个沉寂两年的专利族突然续了费', 'A patent family {X} had let go quiet for two years was suddenly renewed'],
    ['{X} 的员工在社交网络上删掉了「正在找机会」的标签', '{X}’s staff have been removing "open to work" from their profiles'],
    ['{X} 的物流合作方临时加开了一条夜间线路', '{X}’s logistics partner has added an overnight lane at short notice'],
    ['{X} 的董事在窗口期结束后第一时间增持了', '{X}’s directors bought the moment the closed period ended'],
    ['{X} 的客服排班表上，下个季度的人手翻了一倍', '{X}’s support rota for next quarter has twice the headcount'],
  ],
  down: [
    ['{X} 的两家主力供应商把付款账期从 60 天改成了预付', 'Two of {X}’s main suppliers moved it from 60-day terms to payment up front'],
    ['{X} 的招聘页一夜之间少了三分之一的岗位', 'A third of the roles on {X}’s careers page vanished overnight'],
    ['{X} 的财报里，那个指标被挪进了脚注，字号还小了一号', 'In {X}’s filing, that metric moved into a footnote, in smaller type'],
    ['{X} 的几位中层同时更新了简历', 'Several of {X}’s middle managers updated their CVs in the same week'],
    ['{X} 把年度发布会从三月推到了「稍后公布」', '{X} moved its annual launch from March to "a date to be confirmed"'],
    ['{X} 的客户主动要求把交付往后推两个季度', '{X}’s customers themselves asked to push delivery back two quarters'],
    ['{X} 的园区里，有一整层的灯这个月没再亮过', 'One whole floor at {X} has not had its lights on this month'],
    ['{X} 的审计换了一家事务所，公告写在第七页', '{X} changed auditors; the notice was on page seven'],
    ['{X} 的高管在窗口期一开就减了持，理由是「个人资金需求」', '{X}’s executives sold as soon as the window opened, citing "personal liquidity"'],
    ['{X} 的经销商开始在清库存，折扣力度是三年来最大的', '{X}’s dealers are clearing stock at the steepest discounts in three years'],
    ['{X} 的续约率今年不再单独披露了', '{X} has stopped disclosing its renewal rate separately'],
    ['{X} 的一个海外仓提前解约了', '{X} broke the lease on one of its overseas warehouses early'],
    ['{X} 的研发预算被拆进了「其他」这一栏', '{X}’s R&D budget has been folded into "other"'],
    ['{X} 门口的班车从每天六班减到了三班', 'The shuttle to {X} has gone from six runs a day to three'],
    ['{X} 的两个长期大客户今年没有出现在名单里', 'Two of {X}’s long-standing major customers are missing from this year’s list'],
    ['{X} 的法务突然开始批量处置非核心资产', '{X}’s legal team has started disposing of non-core assets in batches'],
  ],
};
// 兑现那一刻的新闻
export const CO_CONFIRM = {
  up: [
    ['{X} 大幅上涨，之前那些迹象终于连成了线', '{X} jumps — the signs finally joined up'],
    ['{X} 放出超预期的消息，盘中拉升', '{X} surprises to the upside and rips through the session'],
  ],
  down: [
    ['{X} 大幅下挫，之前那些细节原来都是伏笔', '{X} slides — those small details were the tell all along'],
    ['{X} 的坏消息落地，开盘即杀', '{X}’s bad news lands and the stock is sold from the open'],
  ],
};

export function familyOf(sector) { return FAMILY_OF[sector] || 'consumer'; }
