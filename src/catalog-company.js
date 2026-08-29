// ── 创业：注册公司、估值、融资 ──────────────────────────────
// 估值不是账面净资产，而是利润的倍数——现实里就是这么算的。
// 倍数由三件事决定：增长率（最重要）、赛道热度、规模。

export const FOUND_FEE = 2_000;          // 注册费：工商、律师、刻章
export const FOUND_MIN_SHOPS = 1;        // 至少得有一门生意才谈得上公司
export const INIT_SHARES = 1_000_000;    // 初始股本 100 万股，全在创始人手里

// 估值参数
export const BASE_MULT = 6;              // 不增长的传统生意，大概值 6 倍年利润
export const GROWTH_K = 8;               // 增长率每 +100%，倍数 +8
export const HEAT_K = 5;                 // 赛道热度
export const SCALE_K = 1.6;              // 每多一个数量级的店铺，倍数 +1.6
export const MULT_MIN = 2.5, MULT_MAX = 45;
export const DOWN_SENS = 0.45;       // 负增长对倍数的影响力（相对正增长）
export const BOOK_RECOVERY = 0.55;       // 店铺投入的清算回收率
export const ILLIQUID = 0.70;            // 未上市股权计入身家时打的折

// 增长率：快慢两条指数均线的领先差，换算成年化
// 增长率 = 30 天均线相对 120 天均线的比值，年化。
// 用两条长均线的比值，而不是某条线的瞬时斜率：一次性开十家店会让比值
// 平滑地抬起来再慢慢落回去，而斜率法会先冲到 +150% 再翻到 -59%，
// 明明利润一直在涨，估值却在过山车。
export const FAST_HALFLIFE_H = 5 * 24;
export const SLOW_HALFLIFE_H = 30 * 24;
export const VSLOW_HALFLIFE_H = 120 * 24;
export const LEAD_DAYS = 90;
export const GROWTH_MIN = -0.8, GROWTH_MAX = 2.5;
export const MATURE_DAYS = 30;       // 30 个游戏日之内，增长率按比例打折采信
export const REV_GROWTH_MIN = 0.5;   // 年增长 50% 以上，才轮得到按营收估值
export const TURNAROUND_G = 0.6;     // 刚扭亏为盈给的增长率，不能给满
export const GROWTH_SMOOTH = 0.006;  // 增长率的输出平滑（约 7 个游戏日的时间常数）

// ── 融资轮次 ────────────────────────────────────────────────
// sell   = 本轮出让的股份比例
// disc   = 投资人给的估值折扣（会因增长和信用而回升）
// minVal = 达到这个估值才有人愿意投
export const ROUNDS = [
  { id:'angel', zh:'天使轮', en:'Angel round',  minVal:0,          minShops:1,  sell:0.15, disc:0.68,
    descZh:'找亲友和天使投资人凑一笔启动的钱。估值压得最狠，但这是唯一能拿到钱的时候。',
    descEn:'Friends, family and an angel. The valuation they give you is the harshest you will ever take, and right now it is the only money on offer.' },
  { id:'a',     zh:'A 轮',   en:'Series A',     minVal:150_000,    minShops:3,  sell:0.18, disc:0.78,
    descZh:'机构第一次正经出手。他们看的是你能不能把一家店复制成十家。',
    descEn:'The first institutional cheque. What they are buying is whether one shop can become ten.' },
  { id:'b',     zh:'B 轮',   en:'Series B',     minVal:2_000_000,  minShops:8,  sell:0.15, disc:0.84,
    descZh:'规模化的钱。到这一步，增长率比利润重要得多。',
    descEn:'Money to scale with. By now your growth rate matters far more than your profit.' },
  { id:'c',     zh:'C 轮',   en:'Series C',     minVal:20_000_000, minShops:18, sell:0.12, disc:0.90,
    descZh:'上市前的最后一轮。投资人开始按公开市场的定价来谈了。',
    descEn:'The last round before the public market. They are pricing you the way the market will.' },
];
export const ROUND = Object.fromEntries(ROUNDS.map(r => [r.id, r]));

export const STAGES = [
  { id:'private', zh:'未融资',  en:'Bootstrapped' },
  { id:'angel',   zh:'天使轮',  en:'Angel-backed' },
  { id:'a',       zh:'A 轮',    en:'Series A' },
  { id:'b',       zh:'B 轮',    en:'Series B' },
  { id:'c',       zh:'C 轮',    en:'Series C' },
  { id:'public',  zh:'已上市',  en:'Public' },
];
export const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));

// 公司赛道：决定跟哪个板块的热度绑定
export const CO_SECTORS = [
  { id:'消费',   zh:'消费零售', en:'Consumer retail' },
  { id:'餐饮',   zh:'餐饮',     en:'Food & beverage' },
  { id:'服务',   zh:'生活服务', en:'Services' },
  { id:'科技',   zh:'科技',     en:'Technology' },
  { id:'地产',   zh:'地产',     en:'Property' },
  { id:'工业',   zh:'工业制造', en:'Industrials' },
];
export const CO_SECTOR = Object.fromEntries(CO_SECTORS.map(s => [s.id, s]));

// 分红：公司账上的钱发给股东，你按持股比例拿到手，要缴税
export const DIVIDEND_TAX = 0.20;
export const MIN_DIVIDEND = 100;

// ── 上市 ────────────────────────────────────────────────────
// 门槛：融过 A 轮、盈利、有规模。上市之后公司变成行情页上一支真的股票，
// 股价按基本面（估值 / 总股本）做均值回归，你的持股就是普通的持仓。
export const IPO_MIN_ROUNDS = 2;          // 至少走完天使 + A 轮
export const IPO_MIN_VAL = 5_000_000;
export const IPO_MIN_SHOPS = 12;
export const IPO_FLOAT = 0.25;            // 向公众增发的比例
export const IPO_DISCOUNT = 0.85;         // 发行价对估值的折让（真实 IPO 都要留出上涨空间）
export const IPO_FEE = 0.05;              // 承销费
export const IPO_HISTORY_HOURS = 168;     // 上市时补一段价格历史，图不至于是一个点

// 公司赛道 → 行情页里挂靠的板块（板块热度和轮动都跟着它走）
export const CO_SECTOR_MAP = {
  '消费': '日用消费', '餐饮': '餐饮', '服务': '本地生活',
  '科技': '软件服务', '地产': '控股集团', '工业': '工业集团',
};
