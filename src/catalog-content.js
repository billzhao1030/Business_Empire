// 实业店铺 / 城市 / 房产地区 / 奢侈品 / 事件文案（中英双语）

// ── 实业：目录见 catalog-biz.js（17 个行业 · 134 种店铺）──────
import { BIZ_RAW, BIZ_CATS } from './catalog-biz.js';
export { BIZ_CATS };

// 由「回本周期」反推每小时营收与运营成本（含人工/固定/变动三部分后的真实净利）
// ── 成本结构（按现实经营逻辑拆开）──────────────────────────
// 进货/原料成本：占营收的固定比例，只在营业时才发生
export const COGS_RATE = 0.42;
// 月租金占开办成本的比例：小店铺租金压力大，重资产项目自有土地占比高
export const rentRate = cost => 0.115 * Math.pow(50 / Math.max(cost, 50), 0.10);
// 员工时薪：与玩家自己的打工工资体系同一量级（$9 起步 → 大厂 $40+）
export const staffWage = cost => 9 * Math.pow(Math.max(cost, 50) / 50, 0.09);
// 回本周期（游戏日）：小生意几十天，重资产要几百天——比之前拉长了一个数量级
export const payDays = cost => 38 * Math.pow(Math.max(cost, 400) / 400, 0.13);
// 一名员工大约能创造自身工资 4.5 倍的营收——人工占营收约 22%，符合零售餐饮的实际水平
export const REV_PER_WAGE = 4.5;
// 管理精力：每家店每天要占用老板多少小时（店长上任后降到 0.15）
export const mgmtHours = cost => Math.min(5, 0.8 + 0.55 * Math.log10(Math.max(cost, 400) / 400));
export const MGMT_WITH_MANAGER = 0.15;
// 店长月薪：约为普通员工的 2 倍全职工资
export const managerSalary = cost => staffWage(cost) * 360;
export const AWAKE_HOURS = 16;          // 07:00–23:00
export const MGMT_MAX_WITH_JOB = 8;     // 管理时间超过这个数就没法再打工了

export function openHours(h) { return h[1] > h[0] ? h[1] - h[0] : 24 - h[0] + h[1]; }
export function isOpenAt(h, hod) {
  return h[1] > h[0] ? (hod >= h[0] && hod < h[1]) : (hod >= h[0] || hod < h[1]);
}

// 风险溢价：越靠周期、波动越大的生意，回本越快；稳的生意回本越慢。
// 又稳又快的生意是不存在的，这条在游戏里也一样。
export function riskPremium(cyc, vol) {
  const score = 0.5 * Math.abs(cyc) + 0.5 * vol;      // 逆周期的店同样承担周期风险
  return Math.pow(Math.max(0.25, score), -0.45);
}
// 旺季：peak 月份需求最高，反相 6 个月最低
export function seasonMult(season, month) {
  if (!season) return 1;
  const [peak, amp] = season;
  return 1 + amp * Math.cos((month - peak) * Math.PI / 6);
}
const CAT = Object.fromEntries(BIZ_CATS.map(c => [c.id, c]));

export const BIZ_TYPES = BIZ_RAW.map(([id,name,en,emoji,catId,cost,hours,desc,descEn,over={}]) => {
  const c = CAT[catId];
  const tr = { cogs: c.cogs, cyc: c.cyc, vol: c.vol, wear: c.wear, mktg: c.mktg, labor: c.labor,
               season: null, ...over };
  const H = openHours(hours);
  const days = payDays(cost) * riskPremium(tr.cyc, tr.vol);
  const dailyNet = cost / days;                       // 目标日净利
  const monthlyRent = cost * rentRate(cost);
  const hourlyRent = monthlyRent / (30 * 24);         // 关门也要付
  const wage = staffWage(cost);
  const revPerWage = REV_PER_WAGE * tr.labor;         // 人效：软件公司人少而贵，超市人多而廉
  // 营收与人数互相决定，迭代几次收敛：
  //   日净利 = H*(营收*(1-进货率) - 人数*工资) - 24*房租
  //   人数   = ceil(营收 / (工资 * 人效))
  let staff = 1, rev = 0;
  for (let i = 0; i < 8; i++) {
    rev = (dailyNet + 24 * hourlyRent + H * staff * wage) / (H * (1 - tr.cogs));
    staff = Math.max(1, Math.ceil(rev / (wage * revPerWage)));
  }
  return { id, name, en, emoji, cat: c.zh, catEn: c.en, catId, catEmoji: c.emoji,
           cost, hours, openHours: H,
           payDays: days, rev, wage, staff, monthlyRent, hourlyRent, dailyNetBase: dailyNet,
           cogs: tr.cogs, cyc: tr.cyc, vol: tr.vol, wear: tr.wear, mktg: tr.mktg,
           labor: tr.labor, revPerWage, season: tr.season,
           mgmt: mgmtHours(cost), managerSalary: managerSalary(cost), desc, descEn };
});

// revMult 营收系数 / rentMult 房租系数 / wageMult 当地工资水平
// 大城市营收更高，但房租涨得比营收更快——这才是真实的商业地理
export const CITIES = [
  { id:'town',   name:'乡镇',       en:'Country Town',        costMult:0.62, revMult:0.72, rentMult:0.50, wageMult:0.75, vol:0.6, travelCost:0,     travelDays:0,
    desc:'租金便宜，客流也少。', descEn:'Cheap rent, thin foot traffic.' },
  { id:'city',   name:'本市',       en:'Your home city',          costMult:1.00, revMult:1.00, rentMult:1.00, wageMult:1.00, vol:1.0, travelCost:0,     travelDays:0,
    desc:'你出生和长大的地方，人脉和路都最熟。', descEn:'Where you grew up — you know the streets and the people.' },
  { id:'capital',name:'区域中心',   en:'Regional Hub',costMult:1.25, revMult:1.22, rentMult:1.40, wageMult:1.15, vol:1.15, travelCost:450,  travelDays:1,
    desc:'邻近的区域中心，消费力更强，房租也更贵。', descEn:'A nearby regional centre: more spending power, dearer rent.' },
  { id:'tier1',  name:'全国最大都市', en:'Major Metropolis',       costMult:1.65, revMult:1.55, rentMult:2.10, wageMult:1.35, vol:1.35, travelCost:1_600, travelDays:2,
    desc:'全国最贵的商圈，客流强劲但房租吓人。', descEn:'The priciest retail in the country — strong footfall, brutal rent.' },
  { id:'ny',     name:'国际金融中心', en:'Global Financial Hub',          costMult:2.05, revMult:1.90, rentMult:2.90, wageMult:1.60, vol:1.6, travelCost:7_500, travelDays:3,
    desc:'如果你能在这里成功，你能在任何地方成功——前提是先付得起房租。', descEn:'If you can make it here you can make it anywhere — if you can cover the rent.' },
  { id:'dubai',  name:'免税繁荣之城', en:'Tax-free Boomtown',             costMult:2.40, revMult:2.30, rentMult:3.20, wageMult:1.60, vol:1.9, travelCost:9_800, travelDays:3,
    desc:'零税、高客单价，但商场铺位的租金冠绝全球。', descEn:'No tax and huge tickets, but mall rents like nowhere else.' },
];

// ── 房产地区（各自对应一个会涨跌的房价指数）────────────────
export const REGIONS = [
  { id:'home', name:'本市',     en:'Hometown',        index:'PIHM', mult:1.0,  flag:'🏙️' },
  { id:'cap',  name:'省会',     en:'Provincial Capital', index:'PICP', mult:2.2, flag:'🌇' },
  { id:'t1',   name:'一线城市', en:'Tier-1 City',     index:'PIT1', mult:5.0,  flag:'🌃' },
  { id:'ny',   name:'纽约',     en:'New York',        index:'PINY', mult:12,   flag:'🗽' },
  { id:'lon',  name:'伦敦',     en:'London',          index:'PILN', mult:11,   flag:'🎡' },
  { id:'tyo',  name:'东京',     en:'Tokyo',           index:'PITK', mult:8,    flag:'🗼' },
  { id:'la',   name:'洛杉矶',   en:'Los Angeles',     index:'PILA', mult:10,   flag:'🌴' },
  { id:'mia',  name:'迈阿密',   en:'Miami',           index:'PIMI', mult:7,    flag:'🌊' },
  { id:'dxb',  name:'迪拜',     en:'Dubai',           index:'PIDB', mult:9,    flag:'🕌' },
  { id:'mc',   name:'摩纳哥',   en:'Monaco',          index:'PIMC', mult:25,   flag:'🏰' },
];

// live：自己住进去的体验。房子是拿来住的——住得越好，人越松弛，精力也回得越快。
// 出租出去的房子不算住处：房客住着，你就得另外租房。
const PROP_TIERS = [
  { id:'room',  name:'单间出租屋', en:'Studio Room', emoji:'🚪', base:32_000,     prestige:1,   upkeep:0.0018, rent:0.0048, live:{ stress:-0.02, stamina:0.01 }, desc:'十几平米，厨卫共用，但它是你的。', descEn:'Fifteen square metres, shared bathroom — but it is yours.' },
  { id:'old',   name:'老式两居',  en:'Old Two-Bed',  emoji:'🏚️', base:88_000,     prestige:3,   upkeep:0.0020, rent:0.0045, live:{ stress:-0.05, stamina:0.03 }, desc:'楼梯房、没电梯，胜在便宜又好租。', descEn:'Walk-up, no lift — cheap and easy to let.' },
  { id:'apt',   name:'公寓',     en:'Apartment',    emoji:'🏢', base:180_000,    prestige:4,   upkeep:0.0020, rent:0.0042, live:{ stress:-0.09, stamina:0.06 }, desc:'紧凑实用，最容易出租。', descEn:'Compact, practical, easiest to rent out.' },
  { id:'loft',  name:'旧厂房 Loft',en:'Warehouse Loft',emoji:'🧱', base:320_000,   prestige:7,   upkeep:0.0022, rent:0.0041, live:{ stress:-0.10, stamina:0.06 }, desc:'挑高六米，暖气费也是六米的。', descEn:'Six-metre ceilings, and a heating bill to match.' },
  { id:'town',  name:'联排别墅', en:'Townhouse',    emoji:'🏘️', base:430_000,    prestige:9,   upkeep:0.0020, rent:0.0041, live:{ stress:-0.11, stamina:0.07 }, desc:'三层带小院，邻居就在一墙之隔。', descEn:'Three floors and a courtyard, with neighbours through the wall.' },
  { id:'house', name:'独栋住宅', en:'Detached House',emoji:'🏡', base:620_000,    prestige:11,  upkeep:0.0020, rent:0.0040, live:{ stress:-0.12, stamina:0.08 }, desc:'带院子和车库，家庭首选。', descEn:'Yard and garage — the family choice.' },
  { id:'cabin', name:'湖畔木屋', en:'Lakeside Cabin',emoji:'🛶', base:880_000,    prestige:15,  upkeep:0.0026, rent:0.0036, live:{ stress:-0.16, stamina:0.11 }, desc:'手机没信号，这正是它最贵的地方。', descEn:'No signal. That is the expensive part.' },
  { id:'farm',  name:'乡间农庄', en:'Country Farmhouse',emoji:'🌾', base:1_300_000,prestige:19,  upkeep:0.0028, rent:0.0035, live:{ stress:-0.15, stamina:0.10 }, desc:'几公顷地，一口井，和很多要修的东西。', descEn:'A few hectares, a well, and a great many things to fix.' },
  { id:'villa', name:'豪华别墅', en:'Luxury Villa', emoji:'🏘️', base:2_600_000,  prestige:28,  upkeep:0.0024, rent:0.0037, live:{ stress:-0.15, stamina:0.10 }, desc:'泳池、影音室、24 小时安保。', descEn:'Pool, screening room, round-the-clock security.' },
  { id:'penth', name:'顶层公寓', en:'Penthouse',    emoji:'🌆', base:6_800_000,  prestige:52,  upkeep:0.0028, rent:0.0035, live:{ stress:-0.17, stamina:0.11 }, desc:'整层视野，专属电梯直达。', descEn:'Full-floor views, private elevator access.' },
  { id:'ski',   name:'雪山别墅', en:'Ski Chalet',   emoji:'🎿', base:4_200_000,  prestige:40,  upkeep:0.0030, rent:0.0034, live:{ stress:-0.17, stamina:0.12 }, desc:'推开门就是雪道，一年用得上四个月。', descEn:'The piste starts at the door, four months a year.' },
  { id:'beach', name:'海景别墅', en:'Beachfront Villa',emoji:'🏖️', base:9_500_000, prestige:64,  upkeep:0.0032, rent:0.0033, live:{ stress:-0.18, stamina:0.12 }, desc:'浪声是免费的，防潮维护不是。', descEn:'The surf is free. The salt-air maintenance is not.' },
  { id:'manor', name:'庄园',     en:'Grand Estate', emoji:'🏰', base:24_000_000, prestige:120, upkeep:0.0032, rent:0.0032, live:{ stress:-0.18, stamina:0.12 }, desc:'占地数公顷，有自己的名字。', descEn:'Hectares of land, and a name of its own.' },
];

const ESTATES = [];
for (const r of REGIONS) for (const t of PROP_TIERS) {
  ESTATES.push({
    id: `est_${r.id}_${t.id}`, cat: 'estate', region: r.id, index: r.index, mortgage: true,
    name: `${r.name}·${t.name}`, en: `${t.en} · ${r.en}`, emoji: t.emoji,
    price: Math.round(t.base * r.mult / 1000) * 1000,
    prestige: Math.max(2, Math.round(t.prestige * Math.pow(r.mult, 0.38))),
    upkeep: t.upkeep, rent: t.rent, drift: 0, live: t.live,
    desc: t.desc, descEn: t.descEn,
  });
}

const LANDMARKS = [
  { id:'est_island', cat:'estate', region:'mia', index:'PIMI', mortgage:true, name:'加勒比私人海岛', en:'Private Caribbean Island', emoji:'🏝️', price:520_000_000, prestige:520, upkeep:0.0035, rent:0.0030, drift:0, live:{ stress:-0.20, stamina:0.13 }, desc:'整座岛都是你的，包括那片珊瑚礁。', descEn:'The whole island is yours — coral reef included.' },
  { id:'est_palm',   cat:'estate', region:'dxb', index:'PIDB', mortgage:true, name:'迪拜棕榈岛宫殿', en:'Palm Jumeirah Palace', emoji:'🕌', price:1_200_000_000, prestige:850, upkeep:0.0035, rent:0.0030, drift:0, live:{ stress:-0.20, stamina:0.13 }, desc:'金色的一切。土豪审美的巅峰。', descEn:'Everything is gold. Peak petro-baroque.' },
  { id:'est_castle', cat:'estate', region:'mc',  index:'PIMC', mortgage:true, name:'摩纳哥海崖城堡', en:'Monaco Cliffside Castle', emoji:'🏰', price:2_600_000_000, prestige:1400, upkeep:0.0038, rent:0.0028, drift:0, live:{ stress:-0.20, stamina:0.13 }, desc:'有六百年历史，和一间自己的私人小教堂。', descEn:'Six centuries of history and a private chapel.' },
];

const VEHICLES = [
  // ── 两个轮子的：买不起车的时候，这些才是真的交通工具 ──
  // bike:1 表示能骑着上下班——比走路快，比公交自由，而且不烧油
  { id:'bike_used',  cat:'car', name:'二手自行车',      en:'Second-hand Bicycle',  emoji:'🚲', price:60,        prestige:0,   upkeep:0.010, drift:-0.030, bike:1, desc:'链条会响，刹车要捏两下，但它带你去任何地方。', descEn:'The chain rattles and the brakes need two pulls, but it goes anywhere.' },
  { id:'bike_city',  cat:'car', name:'通勤自行车',      en:'City Bicycle',         emoji:'🚲', price:280,       prestige:0,   upkeep:0.008, drift:-0.026, bike:1, desc:'带挡泥板和车筐，为下雨天和买菜准备的。', descEn:'Mudguards and a basket — built for rain and groceries.' },
  { id:'bike_road',  cat:'car', name:'公路车',          en:'Road Bike',            emoji:'🚴', price:1_400,     prestige:1,   upkeep:0.009, drift:-0.022, bike:1, desc:'碳纤维车架，周末能骑一百公里回来还想再骑。', descEn:'Carbon frame. A hundred kilometres on Sunday and you want more.' },
  { id:'bike_ebike', cat:'car', name:'电助力自行车',    en:'E-Bike',               emoji:'🔋', price:2_200,     prestige:1,   upkeep:0.012, drift:-0.024, bike:1, desc:'上坡不喘气，到公司也不用换衣服。', descEn:'Hills without sweat, and no change of shirt at the office.' },
  { id:'bike_cargo', cat:'car', name:'载货自行车',      en:'Cargo Bike',           emoji:'📦', price:3_800,     prestige:1,   upkeep:0.011, drift:-0.021, bike:1, desc:'前面那个斗能装两箱货，或者两个小孩。', descEn:'The front box takes two crates, or two children.' },
  { id:'bike_track', cat:'car', name:'手工钢架车',      en:'Hand-built Steel Frame',emoji:'🛠️', price:9_500,     prestige:3,   upkeep:0.008, drift:-0.012, bike:1, desc:'有人花了三个月给你焊这一副车架。', descEn:'Someone spent three months brazing this frame for you.' },
  { id:'car_scooter',cat:'car', name:'二手电动车',      en:'Used E-Scooter',       emoji:'🛵', price:900,       prestige:0,   upkeep:0.004, drift:-0.022, car:1, desc:'风吹日晒，但它是你第一件属于自己的交通工具。', descEn:'Rain or shine — but it is the first vehicle you ever owned.' },
  { id:'car_moto',   cat:'car', name:'二手摩托车',      en:'Used Motorcycle',      emoji:'🏍️', price:2_600,     prestige:1,   upkeep:0.005, drift:-0.020, car:1, desc:'穿街过巷比谁都快，送外卖的神器。', descEn:'Quicker through traffic than anything — a courier legend.' },
  { id:'car_van',    cat:'car', name:'二手面包车',      en:'Used Cargo Van',       emoji:'🚐', price:7_500,     prestige:1,   upkeep:0.006, drift:-0.019, car:1, desc:'能拉货能睡觉，个体户的移动仓库。', descEn:'Hauls goods, doubles as a bed. The hustler mobile warehouse.' },
  { id:'car_used',   cat:'car', name:'二手代步车',      en:'Used Commuter Car',    emoji:'🚙', price:9_000,     prestige:2,   upkeep:0.006, drift:-0.018, car:1, desc:'能跑就行，先解决有没有的问题。', descEn:'It runs. That is the entire value proposition.' },
  { id:'car_kei',    cat:'car', name:'日规小车',        en:'Kei Car',              emoji:'🚗', price:13_000,    prestige:2,   upkeep:0.004, drift:-0.016, car:1, desc:'方盒子，一箱油能跑很远，停哪儿都塞得下。', descEn:'A little box that sips fuel and parks anywhere.' },
  { id:'car_corolla',cat:'car', name:'丰田野 卡罗兰',   en:'Toyoda Corolla',       emoji:'🚗', price:19_000,    prestige:3,   upkeep:0.005, drift:-0.014, car:1, desc:'全世界卖得最多的车，理由只有一个：它不坏。', descEn:'The best-selling car on earth for one reason: it never breaks.' },
  { id:'car_civic',  cat:'car', name:'本田 思阈',       en:'Handa Civix',          emoji:'🚙', price:26_000,    prestige:4,   upkeep:0.005, drift:-0.014, car:1, desc:'年轻人的第一台改装车。', descEn:'Everyone first tuner project.' },
  { id:'car_golf',   cat:'car', name:'大众高尔夫 GTI',  en:'Volks Golf GTI',       emoji:'🚗', price:32_000,    prestige:3,   upkeep:0.006, drift:-0.015, desc:'钢炮之王，年轻人的第一台性能车。', descEn:'The hot hatch king — everyone’s first fast car.' },
  { id:'car_audi',   cat:'car', name:'奥迪奥 A4',       en:'Audio A4',             emoji:'🚘', price:48_000,    prestige:5,   upkeep:0.006, drift:-0.015, car:1, desc:'商务与家用之间最稳妥的答案。', descEn:'The safest answer between business and family.' },
  { id:'car_bmw',    cat:'car', name:'宝驰 M3',         en:'Bemer M3',             emoji:'🚘', price:78_000,    prestige:7,   upkeep:0.007, drift:-0.014, car:1, desc:'开着它去谈生意，对方会多听你五分钟。', descEn:'Show up in this and they listen five minutes longer.' },
  { id:'car_benz',   cat:'car', name:'奔弛 S 级',       en:'Mercedez S-Class',     emoji:'🚔', price:120_000,   prestige:11,  upkeep:0.008, drift:-0.015, car:1, desc:'后排老板位，商务接待的标准答案。', descEn:'The executive rear bench — the default answer for business.' },
  { id:'car_tesla',  cat:'car', name:'特斯萝 Model S',  en:'Teslo Model S Plaid',  emoji:'⚡', price:125_000,   prestige:9,   upkeep:0.004, drift:-0.016, car:1, desc:'2.1 秒破百，还能省下一大笔油钱。', descEn:'0-60 in 2.1s, and the fuel bill disappears.' },
  { id:'car_range',  cat:'car', name:'路虎揽剩',        en:'Land Rover Ranger',    emoji:'🚜', price:148_000,   prestige:13,  upkeep:0.010, drift:-0.017, car:1, desc:'上山下海都行，唯一的问题是修车费。', descEn:'Goes anywhere. The only issue is the repair bill.' },
  { id:'car_p911',   cat:'car', name:'保世捷 911 Turbo S', en:'Porsch 911 Turbo S',emoji:'🏎️', price:230_000,   prestige:16,  upkeep:0.009, drift:-0.010, car:1, desc:'日常可用的超跑，保值率的天花板。', descEn:'A supercar you can drive daily, with legendary residuals.' },
  { id:'car_maybach',cat:'car', name:'迈巴嗨 S680',      en:'Maybak S680',          emoji:'🖤', price:265_000,   prestige:22,  upkeep:0.011, drift:-0.011, car:1, desc:'加长轴距、后排冰箱，董事长的移动办公室。', descEn:'Long wheelbase, rear fridge — the chairman rolling office.' },
  { id:'car_bentley',cat:'car', name:'宾利驰 欧陆 GT',   en:'Bentlee Continental',  emoji:'🤍', price:295_000,   prestige:25,  upkeep:0.012, drift:-0.010, car:1, desc:'英国手工内饰，开起来像一块会飞的丝绒。', descEn:'Hand-stitched British interior; drives like flying velvet.' },
  { id:'car_mclaren',cat:'car', name:'迈凯轮 750S',      en:'McLarren 750S',        emoji:'🧡', price:355_000,   prestige:27,  upkeep:0.014, drift:-0.009, car:1, desc:'碳纤维单体壳，赛道上最不讲道理的那一个。', descEn:'Carbon monocoque — the most unreasonable thing on track.' },
  { id:'car_f8',     cat:'car', name:'法拉力 F8',       en:'Ferrar-E F8 Tributo',  emoji:'🔴', price:420_000,   prestige:28,  upkeep:0.012, drift:-0.008, car:1, desc:'红色，V8，跃马车标。', descEn:'Red. V8. The prancing horse.' },
  { id:'car_lambo',  cat:'car', name:'兰博鸡尼 Revuelto', en:'Lamborgini Revuelto',emoji:'🟡', price:620_000,   prestige:32,  upkeep:0.013, drift:-0.008, desc:'剪刀门打开的瞬间，整条街都在看你。', descEn:'The scissor doors open and the whole street turns.' },
  { id:'car_rolls',  cat:'car', name:'劳斯莱丝 幻影',   en:'Royce Phantom',        emoji:'👑', price:850_000,   prestige:42,  upkeep:0.011, drift:-0.007, desc:'后座才是主角。星空顶下谈成的合同格外顺利。', descEn:'The back seat is the point. Deals close easier under the starlight headliner.' },
  { id:'car_gwagon', cat:'car', name:'大 G 越野',        en:'G-Wagen',              emoji:'🟩', price:195_000,   prestige:18,  upkeep:0.011, drift:-0.012, car:1, desc:'方得理直气壮，四十年没换过设计。', descEn:'Unapologetically square, and unchanged in forty years.' },
  { id:'car_gt3',    cat:'car', name:'保世捷 GT3 RS',    en:'Porsch GT3 RS',        emoji:'🏁', price:520_000,   prestige:30,  upkeep:0.013, drift:-0.006, car:1, desc:'尾翼大得像块门板，为赛道而生。', descEn:'A wing the size of a door. Built for the track and nothing else.' },
  { id:'car_ff',     cat:'car', name:'法拉力 SF90',      en:'Ferrar-E SF90',        emoji:'⚡', price:780_000,   prestige:38,  upkeep:0.014, drift:-0.007, car:1, desc:'混动的跃马，一千匹马力还能纯电进城。', descEn:'A hybrid prancing horse: a thousand horsepower that can creep into town silently.' },
  { id:'car_vintage',cat:'car', name:'1962 经典跑车',    en:'1962 Classic Roadster',emoji:'🏆', price:1_900_000, prestige:55,  upkeep:0.016, drift:0.012,  index:'CIDX', desc:'越放越值钱的那一种车，开一次要请技师随行。', descEn:'The kind that appreciates. You take a mechanic along when you drive it.' },
  { id:'car_bugatti',cat:'car', name:'布加缇 Chiron',   en:'Bugati Chiron',        emoji:'💠', price:3_600_000, prestige:80,  upkeep:0.018, drift:0, index:'CIDX', desc:'1500 匹马力，换一次轮胎够买一台车。', descEn:'1500 hp. A set of tyres costs more than a car.' },
  { id:'car_koenig', cat:'car', name:'柯尼赛格 Jesko',  en:'Koenigsig Jesko',      emoji:'🛸', price:5_400_000, prestige:110, upkeep:0.020, drift:0, index:'CIDX', car:1, desc:'全球限量，交付名单比钱更难搞定。', descEn:'Strictly limited — the allocation list is harder to get than the money.' },
  { id:'yacht_speed',cat:'yacht', name:'12 米快艇',     en:'12m Speedboat',        emoji:'🚤', price:280_000,   prestige:10,  upkeep:0.014, drift:-0.012, desc:'周末去海上兜风的入门票。', descEn:'Your weekend ticket to open water.' },
  { id:'yacht_30',   cat:'yacht', name:'30 米豪华游艇', en:'30m Luxury Yacht',     emoji:'⛵', price:2_400_000, prestige:38,  upkeep:0.016, drift:-0.010, desc:'四间客舱，一名船长，两名船员。', descEn:'Four cabins, one captain, two crew.' },
  { id:'yacht_50',   cat:'yacht', name:'50 米超级游艇', en:'50m Superyacht',       emoji:'🛥️', price:14_000_000,prestige:90,  upkeep:0.018, drift:-0.009, desc:'带直升机停机坪，地中海的夏天从这里开始。', descEn:'Helipad included. Mediterranean summers start here.' },
  { id:'yacht_80',   cat:'yacht', name:'80 米巨型游艇', en:'80m Megayacht',        emoji:'🛳️', price:70_000_000,prestige:190, upkeep:0.020, drift:-0.008, desc:'20 名船员常驻，泳池、影院、潜水器一应俱全。', descEn:'20 permanent crew, pool, cinema and a submersible.' },
  { id:'yacht_120',  cat:'yacht', name:'120 米私人邮轮',en:'120m Private Liner',   emoji:'🚢', price:300_000_000,prestige:420,upkeep:0.022, drift:-0.007, desc:'它有自己的邮编。', descEn:'It has its own postcode.' },
  { id:'jet_heli',   cat:'jet', name:'私人直升机',      en:'Private Helicopter',   emoji:'🚁', price:3_200_000, prestige:45,  upkeep:0.020, drift:-0.011, desc:'再也不用堵在早高峰。', descEn:'Never sit in morning traffic again.' },
  { id:'jet_g280',   cat:'jet', name:'湾流 G280',       en:'Gulfstreem G280',      emoji:'🛩️', price:16_000_000,prestige:95,  upkeep:0.019, drift:-0.010, desc:'中型公务机，覆盖 90% 的国内航线。', descEn:'Midsize business jet covering 90% of domestic routes.' },
  { id:'jet_g650',   cat:'jet', name:'湾流 G650ER',     en:'Gulfstreem G650ER',    emoji:'✈️', price:68_000_000,prestige:200, upkeep:0.018, drift:-0.009, desc:'洲际直飞，商务舱？那是给别人准备的。', descEn:'Intercontinental nonstop. Business class is for other people.' },
  { id:'jet_bbj',    cat:'jet', name:'波音因 BBJ 787',  en:'Boing BBJ 787',        emoji:'🛫', price:220_000_000,prestige:380,upkeep:0.021, drift:-0.008, desc:'把一整架宽体客机改成你的空中行宫。', descEn:'A widebody airliner converted into a flying palace.' },
  { id:'jet_acj',    cat:'jet', name:'空客斯 ACJ350',   en:'Airbust ACJ350',       emoji:'🌌', price:450_000_000,prestige:600,upkeep:0.022, drift:-0.008, desc:'带主卧、办公室与会议室的空中总部。', descEn:'Master suite, office and boardroom at 40,000 feet.' },
];

const COLLECTIBLES = [
  { id:'wat_omega', cat:'watch', index:'WIDX', name:'欧米茄 海马 300', en:'Omeg Seamaster 300', emoji:'⌚', price:9_500,   prestige:2,  upkeep:0.0004, drift:0, desc:'第一块像样的机械表。', descEn:'Your first serious mechanical watch.' },
  { id:'wat_rolex', cat:'watch', index:'WIDX', name:'劳力士 黑水鬼',   en:'Rolux Submariner',   emoji:'⏱️', price:18_000,  prestige:5,  upkeep:0.0004, drift:0, desc:'公价买不到，二级市场永远溢价。', descEn:'Never available at retail; always over list on the grey market.' },
  { id:'wat_vc',    cat:'watch', index:'WIDX', name:'江诗丹顿 纵横四海',en:'Vachron Overseas',  emoji:'🕰️', price:135_000, prestige:16, upkeep:0.0004, drift:0, desc:'表王之一，日内瓦印记。', descEn:'One of the holy trinity, stamped in Geneva.' },
  { id:'wat_patek', cat:'watch', index:'WIDX', name:'百达翡丽 鹦鹉螺', en:'Patrek Nautilus',    emoji:'🐚', price:480_000, prestige:40, upkeep:0.0005, drift:0, desc:'没有人真正拥有它，只是为下一代保管。', descEn:'You never actually own one; you merely look after it.' },
  { id:'wat_rm',    cat:'watch', index:'WIDX', name:'理查德米勒 RM011',en:'Richie Mille RM011',emoji:'💎', price:2_800_000,prestige:95, upkeep:0.0006, drift:0, desc:'亿万富豪的入场券，戴在手腕上的超跑。', descEn:'A supercar for the wrist — the billionaire’s badge.' },
  { id:'art_contemp',cat:'art', index:'AIDX', name:'当代艺术画作',    en:'Contemporary Canvas', emoji:'🖼️', price:220_000, prestige:14, upkeep:0.0008, drift:0, desc:'新锐艺术家，赌的是十年后的名气。', descEn:'An emerging artist — you are betting on the next decade.' },
  { id:'art_picasso',cat:'art', index:'AIDX', name:'毕加锁 素描真迹',  en:'Picaso Original Sketch',emoji:'✏️', price:3_400_000,prestige:60,upkeep:0.0010, drift:0, desc:'拍卖行的常客，永远有人接盘。', descEn:'An auction regular — there is always another bidder.' },
  { id:'art_monet', cat:'art', index:'AIDX', name:'莫奈特 睡莲',      en:'Monay Water Lilies', emoji:'🎨', price:48_000_000,prestige:190,upkeep:0.0012, drift:0, desc:'印象派的光影，博物馆级藏品。', descEn:'Impressionist light — museum grade.' },
  { id:'art_vango', cat:'art', index:'AIDX', name:'梵谷 向日葵',      en:'Van Gough Sunflowers',emoji:'🌻', price:190_000_000,prestige:400,upkeep:0.0014,drift:0, desc:'世界上只有几幅，每一次易主都是新闻。', descEn:'Only a handful exist; every sale makes the news.' },
  { id:'art_davin', cat:'art', index:'AIDX', name:'达文西 失落手稿',  en:'Da Vinchi Lost Codex',emoji:'📜', price:640_000_000,prestige:900,upkeep:0.0016,drift:0, desc:'不只是收藏品，是人类文明的一部分。', descEn:'Not merely a collectible — a piece of civilisation.' },
];

import { WEARABLES, WEAR_SLOTS } from './catalog-wardrobe.js';
export const ITEM_TYPES = [...VEHICLES, ...ESTATES, ...LANDMARKS, ...COLLECTIBLES, ...WEARABLES];

export const ITEM_CATS = {
  top:    { name:'上装',   en:'Tops',        emoji:'👕', wear:1 },
  bottom: { name:'下装',   en:'Bottoms',     emoji:'👖', wear:1 },
  outer:  { name:'外套',   en:'Outerwear',   emoji:'🧥', wear:1 },
  shoes:  { name:'鞋',     en:'Shoes',       emoji:'👟', wear:1 },
  acc:    { name:'配饰',   en:'Accessories', emoji:'🕶️', wear:1 },
  car:    { name:'座驾',   en:'Vehicles',    emoji:'🚗' },
  yacht:  { name:'游艇',   en:'Yachts',      emoji:'🛥️' },
  jet:    { name:'飞机',   en:'Aircraft',    emoji:'✈️' },
  estate: { name:'房产',   en:'Real Estate', emoji:'🏠' },
  watch:  { name:'腕表',   en:'Watches',     emoji:'⌚' },
  art:    { name:'艺术品', en:'Fine Art',    emoji:'🖼️' },
};

// ── 新闻模板 ────────────────────────────────────────────────
export const NEWS_ASSET_GOOD = [
  ['{X} 发布财报大幅超出市场预期，盘后暴涨', '{X} smashes earnings expectations; shares surge after hours'],
  ['{X} 宣布史上最大规模股票回购计划', '{X} announces its largest ever share buyback'],
  ['{X} 拿下一份创纪录的政府订单', '{X} wins a record government contract'],
  ['知名机构上调 {X} 评级至「强烈买入」', 'Top broker upgrades {X} to Strong Buy'],
  ['{X} 新产品发布会引爆社交网络，预售秒罄', '{X} product launch breaks the internet; pre-orders sell out'],
  ['{X} 宣布分拆旗下高增长业务独立上市', '{X} to spin off its high-growth unit in a separate IPO'],
  ['{X} 与行业龙头达成战略合作', '{X} signs a strategic alliance with an industry leader'],
  ['{X} 获主权基金大举增持', 'Sovereign wealth fund builds a major stake in {X}'],
  ['{X} 突破关键技术瓶颈，专利已获批', '{X} clears a key technical hurdle; patent granted'],
  ['{X} 宣布提高派息，股息率创五年新高', '{X} lifts its dividend to a five-year high'],
];
export const NEWS_ASSET_BAD = [
  ['{X} 财报不及预期，管理层下调全年指引', '{X} misses estimates and cuts full-year guidance'],
  ['{X} 被监管机构立案调查，股价承压', 'Regulators open a formal probe into {X}'],
  ['{X} 曝出重大产品质量问题，宣布全球召回', '{X} issues a global recall over quality defects'],
  ['{X} 首席执行官意外辞职，公司陷入动荡', '{X} CEO resigns unexpectedly, leaving a vacuum'],
  ['做空机构发布报告，直指 {X} 财务造假', 'Short seller accuses {X} of accounting fraud'],
  ['{X} 遭遇大规模数据泄露，面临集体诉讼', '{X} hit by a major data breach and class action'],
  ['{X} 核心专利诉讼败诉，需支付巨额赔偿', '{X} loses a landmark patent suit and faces huge damages'],
  ['{X} 宣布裁员 15%，市场解读为需求疲软', '{X} cuts 15% of staff; market reads it as weak demand'],
  ['{X} 供应链断裂，交付周期大幅延长', '{X} supply chain snaps; lead times blow out'],
  ['{X} 被主要客户取消长期订单', '{X} loses a long-term contract with a key customer'],
];
export const NEWS_SECTOR_GOOD = [
  ['政策利好落地，{X} 板块集体走强', 'Policy tailwind lifts the entire {X} sector'],
  ['资金大举流入 {X} 赛道，成交量创年内新高', 'Money floods into {X}; volumes hit a yearly high'],
  ['行业景气度回升，{X} 板块获多家券商上调评级', 'Brokers upgrade {X} as the cycle turns'],
  ['{X} 需求超预期爆发，产业链全线受益', 'Demand for {X} explodes; the whole supply chain benefits'],
];
export const NEWS_SECTOR_BAD = [
  ['监管新规出台，{X} 板块承压下挫', 'New rules hit the {X} sector hard'],
  ['{X} 行业陷入价格战，利润率预期被下修', 'A price war breaks out in {X}; margin forecasts slashed'],
  ['资金撤离 {X} 赛道，估值面临重构', 'Capital flees {X}; valuations reset'],
  ['{X} 板块高位回调，机构提示风险', '{X} pulls back from highs as institutions flag risk'],
];
export const NEWS_MARKET_GOOD = [
  ['央行意外降息，全球股市普涨', 'Surprise rate cut sends global equities higher'],
  ['通胀数据低于预期，风险资产集体反弹', 'Cooler inflation print sparks a risk-asset rally'],
  ['就业数据强劲，市场情绪转向乐观', 'Strong jobs data flips sentiment bullish'],
  ['主要经济体达成贸易协议，避险情绪消退', 'Major trade deal signed; haven demand fades'],
  ['大规模基建刺激计划获批，市场信心大增', 'Huge infrastructure package approved; confidence soars'],
];
export const NEWS_MARKET_BAD = [
  ['央行超预期加息，市场剧烈震荡', 'Central bank out-hikes expectations; markets convulse'],
  ['通胀数据爆表，恐慌指数飙升', 'Inflation shocks to the upside; the fear index spikes'],
  ['地缘冲突升级，全球市场避险情绪浓厚', 'Geopolitical escalation drives a flight to safety'],
  ['大型金融机构爆雷，流动性危机蔓延', 'A major lender blows up; liquidity fears spread'],
  ['经济数据全面走弱，衰退担忧笼罩市场', 'Data deteriorates across the board; recession fears mount'],
];

// ── 人生随机事件 ────────────────────────────────────────────
// 金额 = clamp(净资产 × nwRate × 随机, floor, cap)——穷的时候是小钱，富的时候才是大钱
export const LIFE_EVENTS = [
  { id:'ticket',   icon:'🚔', zh:'超速被开罚单',              en:'Speeding ticket',                      gain:false, nwRate:0.004, floor:40,   cap:8_000 },
  { id:'tax_audit',icon:'🧾', zh:'税务稽查，补缴税款',        en:'Tax audit — back taxes assessed',      gain:false, nwRate:0.020, floor:60,   cap:400_000 },
  { id:'medical',  icon:'🏥', zh:'突发小病，自费看诊',        en:'A minor illness, paid out of pocket',  gain:false, nwRate:0.008, floor:35,   cap:60_000 },
  { id:'lawsuit',  icon:'⚖️', zh:'商业纠纷败诉，赔偿对方',    en:'Lost a dispute; damages paid',         gain:false, nwRate:0.030, floor:120,  cap:900_000 },
  { id:'theft',    icon:'🥷', zh:'东西被偷了',                en:'Something got stolen',                 gain:false, nwRate:0.010, floor:50,   cap:120_000 },
  { id:'charity',  icon:'🤝', zh:'参加慈善晚宴并慷慨捐赠',    en:'Generous pledge at a charity gala',    gain:false, nwRate:0.025, floor:200,  cap:2_000_000, prestige:12 },
  { id:'fire',     icon:'🔥', zh:'一处物业失火，保险未能全额覆盖', en:'Fire at a property; insurance falls short', gain:false, nwRate:0.035, floor:300, cap:1_500_000 },
  { id:'lottery',  icon:'🎰', zh:'买彩票中了个小奖',          en:'A small lottery win',                  gain:true,  nwRate:0.012, floor:30,   cap:80_000 },
  { id:'refund',   icon:'💸', zh:'去年多缴税款获得退税',      en:'Tax refund from last year',            gain:true,  nwRate:0.018, floor:50,   cap:150_000 },
  { id:'inherit',  icon:'📜', zh:'远房亲戚留下一笔遗产',      en:'A distant relative leaves an inheritance', gain:true, nwRate:0.060, floor:400, cap:3_000_000 },
  { id:'partner',  icon:'🤵', zh:'老同学入股你的生意，付了溢价', en:'An old classmate buys in at a premium', gain:true, nwRate:0.040, floor:250, cap:2_000_000 },
  { id:'bonus',    icon:'🎁', zh:'供应商年终返利到账',        en:'Year-end supplier rebate lands',       gain:true,  nwRate:0.022, floor:80,   cap:600_000 },
  { id:'award',    icon:'🏆', zh:'当选「年度商业人物」',      en:'Named Businessperson of the Year',     gain:true,  nwRate:0,     floor:0, cap:0, prestige:25 },
  { id:'interview',icon:'🎤', zh:'接受财经杂志封面专访',      en:'Cover interview in a finance magazine', gain:true, nwRate:0,     floor:0, cap:0, prestige:15 },
  { id:'scandal',  icon:'📰', zh:'被小报曝出负面新闻，声望受损', en:'Tabloid hit piece damages your standing', gain:false, nwRate:0, floor:0, cap:0, prestige:-20 },
];


// 板块中英对照
export const SECTOR_EN = {
  '消费电子':'Consumer Electronics','软件服务':'Software','互联网':'Internet','电商零售':'E-Commerce',
  '社交媒体':'Social Media','传媒娱乐':'Media & Entertainment','半导体':'Semiconductors','汽车':'Automotive',
  '银行':'Banks','投行':'Investment Banking','支付':'Payments','控股集团':'Holding Company','石油':'Oil & Gas',
  '油服':'Oilfield Services','新能源':'Clean Energy','制药':'Pharmaceuticals','生物科技':'Biotech',
  '医疗保险':'Health Insurance','饮料':'Beverages','餐饮':'Restaurants','服装':'Apparel','零售':'Retail',
  '奢侈品':'Luxury Goods','日用消费':'Consumer Staples','电信':'Telecom','有线电视':'Cable TV',
  '流媒体':'Streaming','短视频':'Short Video','游戏':'Gaming','航空制造':'Aerospace','国防军工':'Defense',
  '工程机械':'Heavy Machinery','工业集团':'Industrial Conglomerate','航空运输':'Airlines',
  '本地生活':'Local Services','通信设备':'Telecom Equipment','大宗商品':'Commodities',
  '加密货币':'Cryptocurrency','房地产':'Real Estate','收藏品':'Collectibles','商圈':'Districts','大盘':'Broad Market',
  '保险':'Insurance','资产管理':'Asset Management','券商':'Brokerage','基础化工':'Chemicals',
  '矿业金属':'Mining & Metals','农业食品':'Agrifood','烟酒':'Tobacco & Spirits','公用事业':'Utilities',
  '家用电器':'Home Appliances','汽车零部件':'Auto Parts','医疗器械':'Medical Devices',
  '出行平台':'Mobility Platforms','金融科技':'Fintech','物流快递':'Logistics','教育':'Education',
  '数据分析':'Data Analytics','云服务':'Cloud Services','网络安全':'Cybersecurity',
};
export const sectorEn = s => SECTOR_EN[s] || s;

// ── 打工：白手起家的第一步（wage = 每游戏小时工资，exp = 解锁所需工作经验）──
// ── 职业阶梯 ────────────────────────────────────────────────
// track 行业方向 · 同一条线上往上走比横跳快，但横跳能换更高的天花板。
// exp 是入职门槛（每工作一小时 +1）；wage 是时薪，按真实水平定。
export const JOB_TRACKS = [
  { id:'odd',     zh:'零工',   en:'Odd Jobs',   emoji:'🧢' },
  { id:'service', zh:'服务业', en:'Service',    emoji:'🍽️' },
  { id:'trade',   zh:'技术工', en:'Trades',     emoji:'🔧' },
  { id:'drive',   zh:'驾驶',   en:'Driving',    emoji:'🚗' },
  { id:'office',  zh:'白领',   en:'Office',     emoji:'💼' },
  { id:'tech',    zh:'技术',   en:'Technology', emoji:'💻' },
  { id:'finance', zh:'金融',   en:'Finance',    emoji:'🏦' },
  { id:'care',    zh:'医护',   en:'Healthcare', emoji:'🩺' },
  { id:'edu',     zh:'教育',   en:'Education',  emoji:'📚' },
  { id:'create',  zh:'创意',   en:'Creative',   emoji:'🎨' },
  { id:'exec',    zh:'管理层', en:'Leadership', emoji:'👑' },
];

const J = [
// [id, 中文, English, emoji, track, 时薪, 门槛经验, 需要车?, 中文, English]
// ── 零工：$0 起家的人从这里开始 ──
['flyer','发传单','Flyer Handout','📄','odd',8,0,0,'街口站一天，嗓子哑了，钱也就那么点。','A day on the corner. Your voice goes; the money barely comes.'],
['dishwash','洗碗工','Dishwasher','🍽️','odd',11,4,0,'后厨最热的那个角落，但没人管你。','The hottest corner of the kitchen, and nobody bothers you.'],
['mover','搬运工','Removals Hand','📦','odd',13,10,0,'一天下来腰是直不起来的，现钱当天结。','Your back gives out by evening and you are paid in cash.'],
['carwasher','洗车工','Car Washer','🚿','odd',12,6,0,'夏天还行，冬天的水是刺骨的。','Bearable in summer. In winter the water bites.'],
['shelver','超市理货','Shelf Stacker','🛒','odd',13,12,0,'凌晨四点补货，超市空得像另一个世界。','Restocking at four. The empty aisles are another planet.'],
['petsit','遛狗','Dog Walker','🐕','odd',15,8,0,'一次遛四条，全程都在被拖着走。','Four leads at once, and they decide the route.'],
// ── 服务业 ──
['delivery','送外卖','Food Courier','🛵','service',14,8,0,'风里雨里，超时就扣钱。','Rain or shine — every late order costs you.'],
['clerk','便利店店员','Store Clerk','🏪','service',16,24,0,'上夜班加班费更高，但生物钟废了。','Night shifts pay more and wreck your sleep.'],
['barista','咖啡师','Barista','☕','service',18,40,0,'拉花练了三个月，客人只看有没有糖。','Three months on latte art; they only ask about sugar.'],
['waiter','餐厅服务员','Restaurant Server','🍽️','service',20,60,0,'小费是真正的收入来源。','Tips are the real income.'],
['bartend','调酒师','Bartender','🍸','service',26,120,0,'听了太多别人的故事，自己的没人听。','You hear everyone’s story and tell none of your own.'],
['concierge','酒店礼宾','Hotel Concierge','🛎️','service',30,200,0,'能搞定一切，前提是对方给得起小费。','You can arrange anything, for the right gratuity.'],
['chef','主厨','Head Chef','👨‍🍳','service',52,620,0,'菜单是你的名字，压力也是。','The menu carries your name, and so does the pressure.'],
// ── 技术工：不需要学位，需要手艺 ──
['apprentice','学徒工','Trade Apprentice','🔩','trade',15,20,0,'师傅让你递工具的那两年。','Two years of handing someone else the tools.'],
['painter','油漆工','Painter','🎨','trade',24,90,0,'刷完一整栋楼，指甲缝里三个月都是白的。','A whole building later, your nails stay white for months.'],
['welder','焊工','Welder','⚡','trade',34,240,0,'手稳的人到哪儿都缺。','A steady hand is short everywhere.'],
['plumber','水管工','Plumber','🔧','trade',42,380,0,'半夜的急修，收的是加急费。','The midnight call-out is the one that pays.'],
['electrician','电工','Electrician','💡','trade',46,460,0,'牌照难考，考到就不愁活。','The licence is hard to get and never idle afterwards.'],
['crane','塔吊司机','Crane Operator','🏗️','trade',58,700,0,'一个人在天上待一整天，风大的时候摇。','A whole day alone up there. It sways in the wind.'],
// ── 驾驶 ──
['courier_bike','骑手快递','Bike Courier','🚲','drive',17,30,0,'城里最快的两个轮子。','The fastest two wheels in the city.'],
['rideshare','网约车司机','Rideshare Driver','🚕','drive',28,130,1,'需要一辆自己的车。跑得越晚，单价越高。','Requires your own car. The later you drive, the better the fares.'],
['trucker','长途货车司机','Long-haul Trucker','🚚','drive',38,250,1,'一趟三天，路上全是风景和困意。','Three days out, all scenery and sleep debt.'],
['busdriver','公交司机','Bus Driver','🚌','drive',34,300,1,'同一条路线开五年，闭着眼都知道下一站。','Five years on one route. You could do it blind.'],
['chauffeur','私人司机','Private Chauffeur','🎩','drive',48,520,1,'后座说的话，你一句都不能往外说。','Whatever is said in the back stays in the back.'],
['pilot','商业飞行员','Commercial Pilot','✈️','drive',150,2_400,0,'训练花了六位数，回本要十年。','Six figures of training and a decade to earn it back.'],
// ── 白领 ──
['admin','行政助理','Office Admin','📎','office',22,110,0,'谁都能给你派活，这就是这份工作。','Anyone can hand you work. That is the job.'],
['csr','客服专员','Customer Support','🎧','office',24,160,0,'一天一百通电话，九十通是骂人的。','A hundred calls a day, ninety of them angry.'],
['hr','人力资源专员','HR Officer','📋','office',38,340,0,'知道所有人的工资，除了自己满意的那份。','You know everyone’s salary except a satisfying one.'],
['sales','销售代表','Sales Rep','💼','office',55,450,0,'底薪很低，提成才是本体。','Low base, the commission is the job.'],
['marketer','市场经理','Marketing Manager','📣','office',72,900,0,'一半预算花得有道理，问题是不知道哪一半。','Half the budget works. Nobody knows which half.'],
['manager','部门经理','Department Manager','👔','office',165,1_900,0,'开会的时间比干活多。','More time in meetings than doing the work.'],
// ── 技术 ──
['itsupport','IT 支持','IT Support','🖥️','tech',30,220,0,'「你重启过没有？」——真的有用。','"Have you restarted it?" — it genuinely works.'],
['qa','测试工程师','QA Engineer','🐞','tech',48,520,0,'专门找别人的错，还得说得客气。','Paid to find other people’s mistakes, politely.'],
['coder','软件工程师','Software Engineer','💻','tech',85,750,0,'一边写代码，一边看招聘网站。','Writing code with the job board open in another tab.'],
['datasci','数据科学家','Data Scientist','📈','tech',105,1_400,0,'八成时间在洗数据，两成在做模型。','Eighty percent cleaning data, twenty percent modelling.'],
['secops','安全工程师','Security Engineer','🛡️','tech',120,1_800,0,'做得好的时候，没人知道你在。','When you do it well, nobody knows you exist.'],
['archit','架构师','Principal Architect','🏛️','tech',185,3_200,0,'画一张图，五十个人照着干半年。','One diagram, fifty people, six months.'],
// ── 金融 ──
['teller','银行柜员','Bank Teller','🏧','finance',24,180,0,'数别人的钱，数到手上起茧。','Counting other people’s money until your fingers callus.'],
['bookkeep','会计','Bookkeeper','🧾','finance',36,300,0,'两边对不上的时候，天塌下来也得对上。','When the two columns disagree, nothing else happens until they agree.'],
['analyst','金融分析师','Financial Analyst','📊','finance',115,1_200,0,'终于坐到了离钱最近的位置。','Finally seated close to where the money is.'],
['trader','交易员','Trader','⚡','finance',175,2_200,0,'一天的盈亏比一年的工资多。','A day’s P&L exceeds a year’s salary.'],
['vp','投行副总裁','Investment Bank VP','🏦','finance',260,3_000,0,'年终奖比年薪多，代价是没有周末。','The bonus beats the salary; the cost is your weekends.'],
['pm_fund','基金经理','Fund Manager','💹','finance',420,4_000,0,'替别人管一百亿，替自己管不好情绪。','Ten billion of other people’s money, and none of your own composure.'],
// ── 医护 ──
['aide','护工','Care Assistant','🧑‍⚕️','care',19,70,0,'最累也最被需要的一份工作。','The hardest job, and the most needed.'],
['nurse','护士','Nurse','💉','care',52,760,0,'十二小时的班，中间坐下的时间不到十分钟。','Twelve-hour shifts with under ten minutes seated.'],
['pharma','药剂师','Pharmacist','💊','care',72,1_300,0,'柜台后面站一天，救过的人自己都不知道。','A day behind the counter, saving people who never find out.'],
['dentist','牙医','Dentist','🦷','care',140,2_600,0,'所有人都怕你，但都得来。','Everyone fears you and everyone comes anyway.'],
['surgeon','外科医生','Surgeon','🔬','care',230,4_200,0,'十年的书，换手上那八个小时。','A decade of study for eight hours of hands.'],
// ── 教育 ──
['tutor','家教','Private Tutor','📖','edu',26,140,0,'一对一两小时，比上一天班还费嗓子。','Two hours one-to-one costs more voice than a full day.'],
['teacher','中学教师','School Teacher','🍎','edu',44,600,0,'寒暑假是真的，备课到半夜也是真的。','The holidays are real. So is planning until midnight.'],
['lecturer','大学讲师','University Lecturer','🎓','edu',68,1_500,0,'台下四百人，认识你的不到十个。','Four hundred in the room and fewer than ten know your name.'],
['prof','教授','Professor','📜','edu',105,3_000,0,'一半时间做研究，一半时间申请经费。','Half research, half applying for the money to do research.'],
// ── 创意 ──
['designer','平面设计','Graphic Designer','🖌️','create',38,280,0,'「能不能再大一点」——第七版了。','"Can it be a bit bigger" — this is version seven.'],
['photog','摄影师','Photographer','📷','create',45,420,0,'拍一天，修图三天。','One day shooting, three days retouching.'],
['writer','文案／编剧','Writer','✍️','create',52,560,0,'写得好没人提，写砸了全世界都知道。','Nobody mentions the good ones. Everyone sees the bad one.'],
['artdir','艺术总监','Art Director','🎬','create',110,1_700,0,'最后拍板的那个人，也是被骂的那个人。','The one who decides, and the one who gets blamed.'],
// ── 管理层 ──
['coo','运营总监','Operations Director','⚙️','exec',300,3_600,0,'把一团乱麻理成流程，是门手艺。','Turning a mess into a process is a craft.'],
['cfo','首席财务官','CFO','💰','exec',480,4_200,0,'每一分钱都要向你解释。','Every dollar has to explain itself to you.'],
['ceo','职业经理人 CEO','Professional CEO','👑','exec',650,4_500,0,'替别人打理帝国——直到你有自己的。','Running someone else’s empire — until you build your own.'],
['chair','跨国集团董事长','Group Chairman','🗿','exec',980,6_000,0,'不再管事，只决定谁来管事。','You no longer run anything. You decide who does.'],
// ── 顶层：这些位置不是靠工时熬出来的 ──
// 猎头找上门的前提是你本来就有身家和名声。exp 之外还卡净资产（worth），
// 两个条件都够了才轮得到你——但到了那一步，一天的报酬是六位数。
['pubchair','上市公司董事长','Listed Chairman','🔔','exec',2_400,7_000,0,'敲过钟的人，才会被请去敲别人的钟。','Once you have rung the bell, people ask you to ring theirs.',50e6],
['sovpm','主权基金操盘手','Sovereign Fund PM','🏛️','exec',4_500,8_000,0,'管的是一个国家的钱，签字之前要想三遍。','You manage a country\'s money. You think three times before signing.',200e6],
['ibchair','全球投行主席','Global IB Chairman','🌐','exec',8_000,9_000,0,'每一笔跨国并购的最后一通电话，都打给你。','Every cross-border deal ends with a call to you.',500e6],
['petitan','私募巨头合伙人','Private Equity Partner','💠','exec',15_000,10_000,0,'你买下的公司，比大多数国家的企业还多。','You have bought more companies than most countries have.',1e9],
['conglom','财团总裁','Conglomerate President','🏯','exec',26_000,12_000,0,'从港口到银行到芯片厂，都在你这一张组织架构图上。','Ports, banks, fabs — all on one org chart, and it is yours.',3e9],
['familyoffice','家族办公室掌门','Family Office Principal','👑','exec',45_000,15_000,0,'不再有人给你发工资，是你给别人发。这个位置只有一个。','Nobody pays you a salary any more; you pay everyone else. There is one seat.',10e9],
];

export const JOBS = J.map(([id,zh,en,emoji,track,wage,exp,car,descZh,descEn,worth]) =>
  ({ id, zh, en, emoji, track, wage, exp, car: !!car, worth: worth || 0, descZh, descEn }));

// ── 世界富豪榜（化名，财富与游戏内公司股价实时联动）──
export const RIVALS = [
  { id:'tusk',   zh:'伊隆·马斯特',    en:'Elon Tusk',        emoji:'🚀', symbol:'TSLO', stake:0.21, other:180e9,  bio:{zh:'电动车与火箭，外加一个社交平台。',en:'Electric cars, rockets, and a social platform.'} },
  { id:'bezoz',  zh:'杰夫·贝索夫',    en:'Jeff Bezoz',       emoji:'📦', symbol:'AMZO', stake:0.09, other:62e9,  bio:{zh:'从车库书店做到全球物流帝国。',en:'From a garage bookstore to a logistics empire.'} },
  { id:'zuck',   zh:'马克·扎克伯特',  en:'Mark Zuckerbird',  emoji:'🕶️', symbol:'MTTA', stake:0.13, other:12e9,  bio:{zh:'大学宿舍里写出来的社交网络。',en:'A social network written in a dorm room.'} },
  { id:'ellisen',zh:'拉里·埃里松',    en:'Larry Ellisen',    emoji:'🛥️', symbol:'ORKL', stake:0.41, other:15e9,  bio:{zh:'数据库之王，也是游艇之王。',en:'King of databases, and of yachts.'} },
  { id:'arnaud', zh:'贝尔纳·阿诺特',  en:'Bernard Arnaud',   emoji:'👜', symbol:'LVMX', stake:0.48, other:8e9,   bio:{zh:'把奢侈品做成了工业。',en:'Turned luxury into an industry.'} },
  { id:'huong',  zh:'黄任勋',         en:'Jensen Huong',     emoji:'🧥', symbol:'NVDX', stake:0.035,other:6e9,   bio:{zh:'皮衣与显卡，一个人定义了一个时代。',en:'Leather jacket and GPUs — one man defined an era.'} },
  { id:'gaits',  zh:'比尔·盖兹',      en:'Bill Gaits',       emoji:'🩺', symbol:'MSHD', stake:0.012,other:100e9, bio:{zh:'早已把大部分股份换成了慈善基金。',en:'Long since converted most shares into philanthropy.'} },
  { id:'buffay', zh:'沃伦·巴菲仕',    en:'Warren Buffay',    emoji:'🥤', symbol:'BRKX', stake:0.15, other:5e9,   bio:{zh:'一辈子只做一件事：买好公司，然后等。',en:'One thing for a lifetime: buy good businesses, then wait.'} },
  { id:'ballmar',zh:'史蒂夫·鲍默尔',  en:'Steve Ballmar',    emoji:'🏀', symbol:'MSHD', stake:0.04, other:8e9,   bio:{zh:'离开后买了一支球队。',en:'Left, then bought a basketball team.'} },
  { id:'paige',  zh:'拉里·佩吉',      en:'Larry Paige',      emoji:'🔍', symbol:'GGLE', stake:0.055,other:12e9,  bio:{zh:'把整个互联网做成了索引。',en:'Indexed the entire internet.'} },
  { id:'brinn',  zh:'谢尔盖·布霖',    en:'Sergey Brinn',     emoji:'🪂', symbol:'GGLE', stake:0.052,other:10e9,  bio:{zh:'另一半搜索引擎。',en:'The other half of the search engine.'} },
  { id:'dellman',zh:'麦克·戴尔曼',    en:'Michael Dellman',  emoji:'🖥️', symbol:'BRDM', stake:0.09, other:30e9,  bio:{zh:'直销模式的发明者之一。',en:'A pioneer of direct-to-consumer hardware.'} },
  { id:'ambanni',zh:'穆克什·安巴利',  en:'Mukesh Ambanni',   emoji:'🏙️', symbol:'PTRC', stake:0.34, other:25e9,  bio:{zh:'能源、电信、零售，一个国家的半部经济史。',en:'Energy, telecom, retail — half a nation economic history.'} },
  { id:'adanni', zh:'高塔姆·阿达利',  en:'Gautam Adanni',    emoji:'⚓', symbol:'CATX', stake:0.20, other:20e9,  bio:{zh:'港口、机场与电网的收藏家。',en:'A collector of ports, airports and power grids.'} },
  { id:'slimm',  zh:'卡洛斯·斯利姆',  en:'Carlos Slimm',     emoji:'📞', symbol:'ATTX', stake:0.10, other:40e9,  bio:{zh:'电信起家，几乎买下了半个国家。',en:'Built on telecom; owns nearly half a country.'} },
  { id:'sanshan',zh:'钟晱晱',         en:'Zhong Sanshan',    emoji:'💧', symbol:'COKA', stake:0.06, other:18e9,  bio:{zh:'卖水的，也是最赚钱的生意之一。',en:'Sells water — one of the best businesses there is.'} },
  { id:'ponymaa',zh:'马化滕',         en:'Pony Maa',         emoji:'🐧', symbol:'TENC', stake:0.085,other:6e9,   bio:{zh:'社交、游戏与投资的三重奏。',en:'Social, games and investments in one.'} },
  { id:'yiminh', zh:'张一明',         en:'Zhang Yiminh',     emoji:'🎵', symbol:'TIKT', stake:0.20, other:8e9,   bio:{zh:'用算法重新定义了人们打发时间的方式。',en:'Redefined how the world kills time, with an algorithm.'} },
  { id:'jackmaa',zh:'马芸',           en:'Jack Maa',         emoji:'🐱', symbol:'BABU', stake:0.045,other:14e9,  bio:{zh:'退休了，但传说还在。',en:'Retired, but the legend remains.'} },
  { id:'yanaii', zh:'柳井政',         en:'Tadashi Yanaii',   emoji:'🧵', symbol:'ADDS', stake:0.22, other:12e9,  bio:{zh:'把基础款卖到了全世界。',en:'Sold basics to the entire planet.'} },
  { id:'walton', zh:'沃尔屯家族',      en:'The Waltton Family', emoji:'🛒', symbol:'WLMT', stake:0.11, other:9e9,   bio:{zh:'三代人守着全球最大的零售帝国。',en:'Three generations guarding the largest retail empire on earth.'} },
  { id:'schwarz',zh:'迪特·施瓦兹',    en:'Dieter Schwarz',   emoji:'🏬', symbol:'IKEA', stake:0.33, other:4e9,   bio:{zh:'折扣超市之王，几乎从不接受采访。',en:'The discount-retail king who never gives interviews.'} },
  { id:'bettancourt',zh:'弗朗索·贝当古',en:'Françoise Bettencor',emoji:'💄', symbol:'PRGB', stake:0.08, other:6e9,   bio:{zh:'化妆品帝国的继承人。',en:'Heir to a cosmetics empire.'} },
  { id:'koch',   zh:'朱莉·科克',      en:'Julia Kock',       emoji:'🧪', symbol:'DOWE', stake:0.20, other:55e9,  bio:{zh:'化工与能源的私人帝国。',en:'A private empire built on chemicals and energy.'} },
  { id:'griffn', zh:'肯·格里分',      en:'Ken Griffn',       emoji:'🎯', symbol:'BLKR', stake:0.02, other:41e9,  bio:{zh:'对冲基金之王，也是艺术品市场的常客。',en:'Hedge-fund king and a fixture of the art market.'} },
  { id:'ortegga',zh:'阿曼西·奥特佳',  en:'Amancio Ortegga',  emoji:'👗', symbol:'ADDS', stake:0.16, other:38e9,  bio:{zh:'快时尚的发明者，衣服两周上一次新。',en:'Invented fast fashion — new racks every two weeks.'} },
  { id:'knightt',zh:'菲尔·耐特',      en:'Phil Knightt',     emoji:'👟', symbol:'NIKX', stake:0.19, other:5e9,   bio:{zh:'从后备箱卖鞋开始的运动帝国。',en:'A sports empire that began selling shoes from a car boot.'} },
  { id:'sonn',   zh:'孙正意',         en:'Masa Sonn',        emoji:'🎲', symbol:'SONI', stake:0.05, other:22e9,  bio:{zh:'最激进的科技投资人，赌赢过也赌崩过。',en:'The boldest tech investor alive — spectacular wins and losses.'} },
  { id:'lika',   zh:'李佳诚',         en:'Li Kacheng',       emoji:'🏗️', symbol:'HSBK', stake:0.05, other:26e9,  bio:{zh:'港口、地产与电信，横跨半个世纪。',en:'Ports, property and telecom across half a century.'} },
  { id:'leijun', zh:'雷君',           en:'Lei Junn',         emoji:'📱', symbol:'XIAM', stake:0.045,other:3e9,   bio:{zh:'性价比信徒，把手机做成了生态。',en:'A value-for-money zealot who turned phones into an ecosystem.'} },
  { id:'wangcf', zh:'王传富',         en:'Wang Chuanfoo',    emoji:'🔋', symbol:'BYDD', stake:0.17, other:2e9,   bio:{zh:'从电池做到整车，垂直整合的极致。',en:'From batteries to whole cars — vertical integration taken to the limit.'} },
  { id:'dinglei',zh:'丁垒',           en:'Ding Leii',        emoji:'🎮', symbol:'NTEZ', stake:0.13, other:3e9,   bio:{zh:'游戏、音乐和养猪，兴趣广泛。',en:'Games, music and pig farming — a man of broad interests.'} },
  { id:'huangz', zh:'黄争',           en:'Colin Huangg',     emoji:'🧺', symbol:'PNTG', stake:0.25, other:2e9,   bio:{zh:'用拼团重新定义了下沉市场。',en:'Redefined the mass market with group buying.'} },
  { id:'liuqd',  zh:'刘强栋',         en:'Richard Liuu',     emoji:'📦', symbol:'JOYD', stake:0.12, other:5e9,   bio:{zh:'自建物流的偏执狂。',en:'Obsessive about owning the logistics end to end.'} },
  { id:'hexj',   zh:'何享建',         en:'He Xiangjian',     emoji:'❄️', symbol:'MIDE', stake:0.30, other:3e9,   bio:{zh:'家电制造业的隐形冠军。',en:'The quiet champion of home appliances.'} },
  { id:'cz',     zh:'赵长朋',         en:'CZ Zhaoo',         emoji:'🪙', symbol:'BNBX', stake:0.20, other:3e9,   bio:{zh:'全球最大加密交易所的创始人。',en:'Founder of the largest crypto exchange in the world.'} },
  { id:'saylor', zh:'迈克尔·塞勒',    en:'Michael Saylorr',  emoji:'₿',  symbol:'MSTG', stake:0.10, other:2e9,   bio:{zh:'把公司资产负债表变成了比特币金库。',en:'Turned a corporate balance sheet into a bitcoin vault.'} },
  { id:'armstr', zh:'布莱恩·阿姆斯壮',en:'Brian Armstrng',   emoji:'🔐', symbol:'CONB', stake:0.18, other:2e9,   bio:{zh:'把加密货币带进了合规世界。',en:'Brought crypto into the regulated world.'} },
  { id:'karpp',  zh:'亚历克·卡普',    en:'Alex Karpp',       emoji:'🛰️', symbol:'PLTR', stake:0.06, other:3e9,   bio:{zh:'为政府和军队做数据分析，争议不断。',en:'Data analytics for governments and armies — endlessly controversial.'} },
  { id:'altmann',zh:'萨姆·奥特曼',    en:'Sam Altmann',      emoji:'🧠', symbol:null,   stake:0,    other:28e9,  bio:{zh:'人工智能时代最有影响力的人，股份却不多。',en:'The most influential figure of the AI era — with surprisingly little equity.'} },
];

// ── 疾病：压力与疲劳的代价 ──────────────────────────────────
// days = 自愈天数，treatDays = 就医后天数，cost = 医疗费（按净资产比例，有下限）
export const ILLNESSES = [
  { id:'cold',    emoji:'🤧', zh:'重感冒',      en:'Bad Cold',           days:3,  treatDays:1, base:120,    nwRate:0.0004, minStress:40,
    descZh:'连着熬夜加班，扛不住了。', descEn:'Too many late shifts in a row.' },
  { id:'gastric', emoji:'🍜', zh:'急性胃炎',    en:'Acute Gastritis',    days:4,  treatDays:2, base:600,    nwRate:0.0012, minStress:55,
    descZh:'三餐不定时，胃先罢工了。', descEn:'Skipped meals; your stomach quit first.' },
  { id:'insomnia',emoji:'😵', zh:'焦虑性失眠',  en:'Anxiety Insomnia',   days:5,  treatDays:2, base:1_500,  nwRate:0.0020, minStress:65,
    descZh:'躺下就开始算账，越算越睡不着。', descEn:'You lie down and start doing sums. Then you stop sleeping.' },
  { id:'burnout', emoji:'🫠', zh:'过劳性衰竭',  en:'Burnout',            days:7,  treatDays:3, base:5_000,  nwRate:0.0045, minStress:75,
    descZh:'身体先于意志停机了。', descEn:'Your body shut down before your will did.' },
  { id:'cardiac', emoji:'💔', zh:'心脏警报',    en:'Cardiac Scare',      days:10, treatDays:4, base:25_000, nwRate:0.0090, minStress:85,
    descZh:'医生说：再这样下去，下次就不是警报了。', descEn:'The doctor said: next time it will not be a warning.' },
];

// ── 旅游：花钱买回精神状态 ──────────────────────────────────
// days = 行程天数，relief = 压力削减，stamina = 体力恢复，prestige = 声望
export const TRIPS = [
  { id:'weekend', emoji:'🏕️', zh:'周边周末游',   en:'Weekend Getaway',      cost:600,       days:2,  relief:22, stamina:35,  prestige:0,   flight:false,
    descZh:'开车两小时，住一晚民宿，够回一口气。', descEn:'Two hours out, one night in a guesthouse. Just enough air.' },
  { id:'beach',   emoji:'🏖️', zh:'海边度假',     en:'Beach Holiday',        cost:2_800,     days:4,  relief:38, stamina:60,  prestige:2,   flight:true,
    descZh:'什么都不干，就是躺着。', descEn:'Doing nothing, professionally.' },
  { id:'europe',  emoji:'🗼', zh:'欧洲深度游',   en:'Grand European Tour',  cost:14_000,    days:7,  relief:55, stamina:80,  prestige:8,   flight:true,
    descZh:'博物馆、火车、咖啡馆，和很多脚酸。', descEn:'Museums, trains, cafés and very sore feet.' },
  { id:'safari',  emoji:'🦁', zh:'非洲野生动物营',en:'Safari Expedition',   cost:48_000,    days:9,  relief:68, stamina:90,  prestige:18,  flight:true,
    descZh:'在没有信号的地方待九天，手机变成了砖头。', descEn:'Nine days without signal; the phone becomes a brick.' },
  { id:'cruise',  emoji:'🛳️', zh:'环球邮轮',     en:'Round-the-World Cruise',cost:180_000,  days:14, relief:82, stamina:100, prestige:35,  flight:true,
    descZh:'两周不看行情，回来发现世界还在转。', descEn:'Two weeks without a chart. The world kept turning anyway.' },
  { id:'island',  emoji:'🏝️', zh:'私人岛屿假期', en:'Private Island Retreat',cost:900_000,  days:10, relief:95, stamina:100, prestige:80,  flight:true,
    descZh:'整座岛只有你和五名员工。', descEn:'The whole island, you, and five staff.' },
  { id:'space',   emoji:'🚀', zh:'亚轨道太空飞行',en:'Suborbital Spaceflight',cost:6_000_000,days:5, relief:100,stamina:100, prestige:260, flight:true,
    descZh:'十一分钟的失重，和一辈子的谈资。', descEn:'Eleven minutes of weightlessness and a lifetime of dinner-party material.' },
];

// 机票舱位：花更多钱换更好的恢复与声望
export const FLIGHT_CLASSES = [
  { id:'economy',  zh:'经济舱',   en:'Economy',       mult:1.0, relief:1.0,  prestige:1.0 },
  { id:'business', zh:'商务舱',   en:'Business',      mult:2.6, relief:1.15, prestige:1.6 },
  { id:'first',    zh:'头等舱',   en:'First Class',   mult:5.5, relief:1.28, prestige:2.4 },
  { id:'private',  zh:'私人飞机', en:'Private Jet',   mult:0,   relief:1.40, prestige:3.2, needJet:true },
];

// ── 一日三餐：吃什么直接影响身体状态 ──────────────────────
// cost = 每游戏日伙食费；stamina/stress 为每小时修正；sick 为患病概率倍率
// ── 一日三餐：cost 是一整天的伙食费，hours 是每天要花在这上面的时间 ──
// 自己买菜做饭最省钱也最养人，代价是每天实打实地少掉一两个小时。
export const MEALS = [
  { id:'skip',     emoji:'🚱', zh:'饿着',        en:'Skipping meals',  cost:0,   hours:0,   stamina:-0.40, stress:0.35, sick:2.0,
    descZh:'省下饭钱，代价是身体。撑不了几天。', descEn:'Saves money, costs your body. It will not last.' },
  { id:'instant',  emoji:'🍜', zh:'泡面度日',    en:'Instant noodles', cost:5,   hours:0.2, stamina:-0.12, stress:0.12, sick:1.35,
    descZh:'最便宜的活法，每天都在透支。', descEn:'The cheapest way to stay alive, and a daily overdraft on your health.' },
  { id:'cook',     emoji:'🍳', zh:'买菜做饭',    en:'Cooking at home', cost:12,  hours:1.2, stamina:0.06,  stress:0.02, sick:0.82,
    descZh:'去菜市场，回来自己开火。每天多花一个多小时，钱和身体都省下来了。',
    descEn:'Shop for groceries, cook them yourself. Over an hour a day, and it pays you back twice.' },
  { id:'canteen',  emoji:'🍱', zh:'路边摊 / 食堂',en:'Street food',    cost:14,  hours:0,   stamina:0,     stress:0,    sick:1.0,
    descZh:'管饱，谈不上好，但过得去。', descEn:'Filling, unremarkable, good enough.' },
  { id:'cookfine', emoji:'🥘', zh:'精心下厨',    en:'Cooking properly', cost:25, hours:1.7, stamina:0.20,  stress:-0.10, sick:0.62,
    descZh:'好食材，认真做，饭点是一天里最踏实的时候。',
    descEn:'Good ingredients, properly cooked. Mealtimes become the steadiest hour of your day.' },
  { id:'diner',    emoji:'🍚', zh:'普通餐馆',    en:'Casual dining',   cost:32,  hours:0,   stamina:0.10,  stress:-0.06, sick:0.85,
    descZh:'一天两顿正经饭，人有精神。', descEn:'Two proper meals a day. You feel like a person.' },
  { id:'healthy',  emoji:'🥗', zh:'健康轻食',    en:'Healthy meals',   cost:68,  hours:0,   stamina:0.22,  stress:-0.14, sick:0.62,
    descZh:'配比讲究，睡得也踏实。', descEn:'Properly balanced. You sleep better too.' },
  { id:'chef',     emoji:'👨‍🍳', zh:'私人厨师',   en:'Private chef',    cost:380, hours:0,   stamina:0.35,  stress:-0.24, sick:0.45, prestige:5,
    descZh:'厨师住在你家，按你的作息做饭。', descEn:'A chef who lives in and cooks to your schedule.' },
];

// ── 通勤：没有车就得走路或者坐公交，出门的日子每天都在花 ──
// cost 是出门那天的往返交通费，hours 是路上耗掉的时间，会直接吃掉加班的余量。
export const COMMUTES = [
  { id:'walk',  emoji:'🚶', zh:'走路',     en:'Walk',            cost:0,    hours:1.4,  stamina:-6,   stress:0.10,
    descZh:'一分钱不花，一个半小时的腿脚。刚起步时你也只有这个选择。',
    descEn:'Costs nothing but an hour and a half on your feet. At the start it is the only option you have.' },
  // 一辆 $60 的二手自行车，就能把每天路上的一小时买回来，而且不烧一分钱油
  { id:'bike',  emoji:'🚲', zh:'骑车',     en:'Cycle',           cost:0,    hours:0.65, stamina:-3,   stress:-0.05, needsBike:true,
    descZh:'不花钱，比走路快一倍，还顺便把身体练了。前提是有一辆车。',
    descEn:'Free, twice as fast as walking, and it counts as exercise. You need a bicycle first.' },
  { id:'transit', emoji:'🚌', zh:'公共交通', en:'Public transport', cost:6,    hours:0.9,  stamina:-2.5, stress:0.45,
    descZh:'公交加地铁，一天一张日票。挤是挤了点，比走路快。',
    descEn:'Bus and metro on a day pass. Crowded, but faster than walking.' },
  { id:'rideshare', emoji:'🚕', zh:'打车通勤', en:'Ride-hailing',   cost:26,   hours:0.4,  stamina:0,    stress:-0.10,
    descZh:'门到门，最省时间的花钱办法。',
    descEn:'Door to door. The most expensive way to buy back your morning.' },
  { id:'car',   emoji:'🚗', zh:'自己开车', en:'Drive yourself',    cost:13,   hours:0.45, stamina:-1,   stress:0.20, needsCar:true,
    descZh:'油钱、停车、保险摊下来一天十几块。需要先有一辆车。',
    descEn:'Fuel, parking and insurance come to a bit over ten a day. You need to own a car first.' },
];

// ── 住处：没房就得租，租金按月扣 ──────────────────────────
export const HOMES = [
  { id:'shared', emoji:'🛏️', zh:'合租单间',  en:'Shared room',     rent:340,  stress:0.05,  stamina:-0.03,
    descZh:'厨卫共用，隔壁的动静你都听得见。', descEn:'Shared kitchen and bath; you hear everything next door.' },
  { id:'onebed', emoji:'🏠', zh:'一居室',    en:'One-bedroom flat', rent:850,  stress:0,     stamina:0,
    descZh:'不大，但门一关就是自己的地方。', descEn:'Small, but behind a door that is yours.' },
  { id:'nice',   emoji:'🏙️', zh:'高档公寓',  en:'Nice apartment',  rent:2_200, stress:-0.06, stamina:0.05, prestige:3,
    descZh:'有电梯、有物业、有阳光。', descEn:'Lift, concierge, and actual sunlight.' },
];

// ── 彩票：中奖率按真实彩种设定，期望回报 45%~60% ──────────
// tiers: [中奖概率的分母, 奖金]；jackpot 为累进奖池
export const LOTTERIES = [
  { id:'scratch', emoji:'🎫', zh:'刮刮乐',   en:'Scratch Card',  price:2, maxBuy:200,
    tiers:[[250_000, 50_000], [10_000, 1_000], [500, 100], [50, 20], [8, 2]],
    descZh:'两块钱一张，撕开就知道结果。', descEn:'Two dollars, and you know instantly.' },
  { id:'lotto',   emoji:'🎰', zh:'福彩乐透', en:'Lotto 6/49',    price:5, maxBuy:100, jackpotBase:8_000_000, jackpotGrow:2.2,
    tiers:[[13_983_816, 'JACKPOT'], [2_330_636, 600_000], [55_491, 15_000], [1_033, 400], [57, 45]],
    descZh:'六个号码，一千三百九十八万分之一。', descEn:'Six numbers, one in 13,983,816.' },
  { id:'mega',    emoji:'💎', zh:'超级大乐透', en:'Mega Jackpot', price:10, maxBuy:100, jackpotBase:60_000_000, jackpotGrow:5.5,
    tiers:[[139_838_160, 'JACKPOT'], [12_607_306, 3_000_000], [931_001, 200_000], [14_547, 4_000], [700, 1_200], [89, 150]],
    descZh:'一亿四千万分之一。你比被雷劈中的概率还低得多。', descEn:'One in 139 million — far less likely than being struck by lightning.' },
];
