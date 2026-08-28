// 实业店铺 / 城市 / 房产地区 / 奢侈品 / 事件文案（中英双语）

// ── 实业 ────────────────────────────────────────────────────
// 实业：cost = 开店成本，pay = 目标回本周期（游戏小时），rev/opc 由下方自动推算
const BIZ_RAW = [
  ['streetvend','街头小摊','Street Stall','🧺','零售','Retail',120,55,'一块布、一堆小玩意，成本低到可以忽略。这就是你的第一桶金。','A blanket and a pile of trinkets. This is where the first dollar comes from.'],
  ['shoeshine','擦鞋摊','Shoeshine Stand','🥾','服务','Services',450,65,'火车站门口的老手艺，客人多是赶时间的生意人。','An old trade outside the station; your customers are always in a hurry.'],
  ['balloon','气球小贩','Balloon Vendor','🎈','零售','Retail',1_100,75,'公园门口的周末生意，孩子一哭家长就掏钱。','Weekend park trade — one crying child and the wallet opens.'],
  ['pancake','煎饼摊','Street Food Cart','🥞','餐饮','Food & Bev',2_400,85,'早高峰四十分钟，决定你一整天的收入。','Forty minutes of morning rush decides your whole day.'],
  ['scrap','废品回收站','Scrap Yard','♻️','工业','Industrial',5_200,95,'脏活累活，但现金流从不骗人。','Dirty work, but the cash flow never lies.'],
  ['nightstall','夜市大排档','Night Market Stall','🏮','餐饮','Food & Bev',9_500,110,'啤酒配烧烤，凌晨两点才是营业高峰。','Beer and skewers — peak hour is 2am.'],
  ['newsstand','报刊亭','Newsstand','📰','零售','Retail',18_000,140,'街角的小生意，卖报纸、香烟和彩票。','A corner kiosk selling papers, smokes and lottery tickets.'],
  ['coffeecart','流动咖啡车','Coffee Cart','☕','餐饮','Food & Bev',32_000,165,'一台意式咖啡机 + 一辆小推车，写字楼下的早高峰就是印钞机。','One espresso machine, one cart. The morning rush is a money printer.'],
  ['milktea','奶茶店','Bubble Tea Shop','🧋','餐饮','Food & Bev',58_000,195,'年轻人的快乐水。翻台率高，毛利惊人。','Liquid happiness for the young. High turnover, stunning margins.'],
  ['bakery','面包烘焙坊','Bakery','🥐','餐饮','Food & Bev',95_000,225,'凌晨四点开工，香味就是最好的广告。','Up at 4am. The smell is the only advertising you need.'],
  ['carwash','洗车行','Car Wash','🚿','服务','Services',150_000,255,'现金流稳定，几乎不受经济周期影响。','Steady cash flow, almost immune to the business cycle.'],
  ['barber','理发沙龙','Hair Salon','💈','服务','Services',210_000,285,'手艺活儿，办卡预付款让你提前收到钱。','A craft business — prepaid memberships put cash in your pocket early.'],
  ['convenience','便利店','Convenience Store','🏪','零售','Retail',330_000,320,'24 小时营业，社区的水电煤。','Open 24/7 — the utility of the neighbourhood.'],
  ['netcafe','电竞网咖','Esports Cafe','🖥️','娱乐','Entertainment',490_000,355,'显卡就是生产力，通宵包夜利润最高。','GPUs are productivity. The overnight package is where the margin is.'],
  ['fastfood','快餐店','Fast Food Outlet','🍔','餐饮','Food & Bev',760_000,390,'标准化出餐，可复制性极强的现金牛。','Standardised kitchen, endlessly replicable cash cow.'],
  ['gym','健身房','Fitness Gym','🏋️','服务','Services',1_150_000,425,'卖的是年卡，赚的是不来的人。','You sell annual passes; you profit from the people who never show up.'],
  ['autoshop','汽车修理厂','Auto Repair Shop','🔧','服务','Services',1_800_000,460,'配件加价率是行业公开的秘密。','The markup on parts is the industry open secret.'],
  ['clothing','服装精品店','Fashion Boutique','👗','零售','Retail',2_700_000,495,'时尚生意，压货是最大的敌人。','Fashion moves fast — dead stock is the enemy.'],
  ['pharmacy','连锁药房','Pharmacy Chain','💊','零售','Retail',4_000_000,530,'牌照壁垒高，抗周期能力一流。','Licensing moat, recession-proof demand.'],
  ['supermarket','大型超市','Supermarket','🛒','零售','Retail',6_000_000,565,'薄利多销，靠账期和规模挣钱。','Thin margins, huge volume — you earn on scale and payment terms.'],
  ['restaurant','高级餐厅','Fine Dining','🍽️','餐饮','Food & Bev',9_000_000,600,'米其林指南来的那天，你的排队会到街尾。','The day the Michelin inspector arrives, the queue reaches the corner.'],
  ['bar','夜店酒吧','Nightclub & Bar','🍸','娱乐','Entertainment',13_500_000,635,'夜里十点后才开始营业，酒水毛利 80%。','Opens at 10pm. Drinks carry an 80% gross margin.'],
  ['cinema','连锁影院','Cinema Chain','🎬','娱乐','Entertainment',20_000_000,670,'票房分账 + 爆米花暴利，档期决定一切。','Box-office splits plus popcorn margins.'],
  ['phonestore','数码旗舰店','Electronics Flagship','📱','零售','Retail',30_000_000,705,'新机发布日门口能排三百米。','On launch day the queue runs 300 metres.'],
  ['hotel','精品酒店','Boutique Hotel','🏨','地产','Property',45_000_000,740,'重资产、高入住率，旺季一房难求。','Asset-heavy, occupancy-driven.'],
  ['dealership','4S 汽车城','Car Dealership','🚗','零售','Retail',68_000_000,775,'卖车不赚钱，金融和售后才是利润中心。','Cars barely break even — financing and servicing are the profit centres.'],
  ['logistics','物流快运公司','Logistics Company','🚚','工业','Industrial',100_000_000,810,'电商时代的血管，规模即护城河。','The arteries of e-commerce. Scale is the moat.'],
  ['clinic','私立医院','Private Hospital','🏥','服务','Services',150_000_000,845,'高端医疗，客单价极高，口碑极难建立。','Premium healthcare: enormous ticket size, slow reputation building.'],
  ['software','软件公司','Software Company','💻','科技','Technology',230_000_000,880,'边际成本趋近于零的生意，人才就是资产。','Near-zero marginal cost. The talent is the balance sheet.'],
  ['tvstation','卫星电视台','TV Network','📺','传媒','Media',350_000_000,915,'掌握话语权。广告位按秒计价。','You own the narrative. Ad slots are priced by the second.'],
  ['resort','海岛度假村','Island Resort','🏝️','地产','Property',550_000_000,950,'把风景变成现金流，一价全包利润惊人。','Turning scenery into cash flow.'],
  ['factory','汽车制造厂','Auto Factory','🏭','工业','Industrial',850_000_000,985,'重工业帝国的基石，产能利用率决定生死。','The bedrock of an industrial empire.'],
  ['airline','航空公司','Airline','✈️','工业','Industrial',1_300_000_000,1020,'烧钱的浪漫。油价一涨，全年白干。','Romantic and ruinous. One fuel spike wipes out the year.'],
  ['chipfab','芯片晶圆厂','Semiconductor Fab','🔬','科技','Technology',2_000_000_000,1055,'现代工业的皇冠。一台光刻机就是一栋楼的钱。','The crown of modern industry.'],
  ['privbank','私人银行','Private Bank','🏦','金融','Finance',3_200_000_000,1090,'当你有钱到需要一家自己的银行时。','For when you are rich enough to need your own bank.'],
  ['spaceport','商业航天基地','Commercial Spaceport','🚀','科技','Technology',5_000_000_000,1130,'终极浪漫：把火箭和卫星做成一门生意。','The ultimate flex: turning rockets into a business.'],
];

// 由「回本周期」反推每小时营收与运营成本（含人工/固定/变动三部分后的真实净利）
export const BIZ_TYPES = BIZ_RAW.map(([id,name,en,emoji,cat,catEn,cost,pay,desc,descEn]) => {
  const net = cost / pay;
  const rev = net / 0.5275;          // 净利 = rev - (0.35+0.20)*opc - 2*0.25*opc，opc = 0.45*rev
  return { id, name, en, emoji, cat, catEn, cost, pay, rev, opc: rev * 0.45, desc, descEn };
});

export const CITIES = [
  { id:'town',   name:'小镇',     en:'Small Town',      costMult:0.65, revMult:0.70, vol:0.6, desc:'租金便宜，客流也少。', descEn:'Cheap rent, thin foot traffic.' },
  { id:'city',   name:'本市',     en:'Hometown',        costMult:1.00, revMult:1.00, vol:1.0, desc:'你最熟悉的地方。', descEn:'The city you know best.' },
  { id:'capital',name:'省会城市', en:'Provincial Capital',costMult:1.35, revMult:1.45, vol:1.15,desc:'消费力更强的区域中心。', descEn:'A regional hub with real spending power.' },
  { id:'tier1',  name:'一线城市', en:'Tier-1 City',     costMult:1.85, revMult:2.10, vol:1.35,desc:'寸土寸金，但客单价惊人。', descEn:'Brutal rents, but the ticket size is enormous.' },
  { id:'ny',     name:'纽约',     en:'New York',        costMult:2.50, revMult:3.00, vol:1.6, desc:'如果你能在这里成功，你能在任何地方成功。', descEn:'If you can make it here, you can make it anywhere.' },
  { id:'dubai',  name:'迪拜',     en:'Dubai',           costMult:3.20, revMult:4.00, vol:1.9, desc:'零税天堂与土豪之城，风险与暴利并存。', descEn:'Tax-free playground of the ultra-rich. Huge risk, huger upside.' },
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

const PROP_TIERS = [
  { id:'apt',   name:'公寓',     en:'Apartment',    emoji:'🏢', base:180_000,    prestige:4,   upkeep:0.0020, rent:0.0042, desc:'紧凑实用，最容易出租。', descEn:'Compact, practical, easiest to rent out.' },
  { id:'house', name:'独栋住宅', en:'Detached House',emoji:'🏡', base:620_000,    prestige:11,  upkeep:0.0020, rent:0.0040, desc:'带院子和车库，家庭首选。', descEn:'Yard and garage — the family choice.' },
  { id:'villa', name:'豪华别墅', en:'Luxury Villa', emoji:'🏘️', base:2_600_000,  prestige:28,  upkeep:0.0024, rent:0.0037, desc:'泳池、影音室、24 小时安保。', descEn:'Pool, screening room, round-the-clock security.' },
  { id:'penth', name:'顶层公寓', en:'Penthouse',    emoji:'🌆', base:6_800_000,  prestige:52,  upkeep:0.0028, rent:0.0035, desc:'整层视野，专属电梯直达。', descEn:'Full-floor views, private elevator access.' },
  { id:'manor', name:'庄园',     en:'Grand Estate', emoji:'🏰', base:24_000_000, prestige:120, upkeep:0.0032, rent:0.0032, desc:'占地数公顷，有自己的名字。', descEn:'Hectares of land, and a name of its own.' },
];

const ESTATES = [];
for (const r of REGIONS) for (const t of PROP_TIERS) {
  ESTATES.push({
    id: `est_${r.id}_${t.id}`, cat: 'estate', region: r.id, index: r.index, mortgage: true,
    name: `${r.name}·${t.name}`, en: `${t.en} · ${r.en}`, emoji: t.emoji,
    price: Math.round(t.base * r.mult / 1000) * 1000,
    prestige: Math.max(2, Math.round(t.prestige * Math.pow(r.mult, 0.38))),
    upkeep: t.upkeep, rent: t.rent, drift: 0,
    desc: t.desc, descEn: t.descEn,
  });
}

const LANDMARKS = [
  { id:'est_island', cat:'estate', region:'mia', index:'PIMI', mortgage:true, name:'加勒比私人海岛', en:'Private Caribbean Island', emoji:'🏝️', price:520_000_000, prestige:520, upkeep:0.0035, rent:0.0030, drift:0, desc:'整座岛都是你的，包括那片珊瑚礁。', descEn:'The whole island is yours — coral reef included.' },
  { id:'est_palm',   cat:'estate', region:'dxb', index:'PIDB', mortgage:true, name:'迪拜棕榈岛宫殿', en:'Palm Jumeirah Palace', emoji:'🕌', price:1_200_000_000, prestige:850, upkeep:0.0035, rent:0.0030, drift:0, desc:'金色的一切。土豪审美的巅峰。', descEn:'Everything is gold. Peak petro-baroque.' },
  { id:'est_castle', cat:'estate', region:'mc',  index:'PIMC', mortgage:true, name:'摩纳哥海崖城堡', en:'Monaco Cliffside Castle', emoji:'🏰', price:2_600_000_000, prestige:1400, upkeep:0.0038, rent:0.0028, drift:0, desc:'有六百年历史，和一间自己的私人小教堂。', descEn:'Six centuries of history and a private chapel.' },
];

const VEHICLES = [
  { id:'car_scooter',cat:'car', name:'二手电动车',      en:'Used E-Scooter',       emoji:'🛵', price:900,       prestige:0,   upkeep:0.004, drift:-0.022, car:1, desc:'风吹日晒，但它是你第一件属于自己的交通工具。', descEn:'Rain or shine — but it is the first vehicle you ever owned.' },
  { id:'car_moto',   cat:'car', name:'二手摩托车',      en:'Used Motorcycle',      emoji:'🏍️', price:2_600,     prestige:1,   upkeep:0.005, drift:-0.020, car:1, desc:'穿街过巷比谁都快，送外卖的神器。', descEn:'Quicker through traffic than anything — a courier legend.' },
  { id:'car_van',    cat:'car', name:'二手面包车',      en:'Used Cargo Van',       emoji:'🚐', price:7_500,     prestige:1,   upkeep:0.006, drift:-0.019, car:1, desc:'能拉货能睡觉，个体户的移动仓库。', descEn:'Hauls goods, doubles as a bed. The hustler mobile warehouse.' },
  { id:'car_used',   cat:'car', name:'二手代步车',      en:'Used Commuter Car',    emoji:'🚙', price:9_000,     prestige:2,   upkeep:0.006, drift:-0.018, car:1, desc:'能跑就行，先解决有没有的问题。', descEn:'It runs. That is the entire value proposition.' },
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

export const ITEM_TYPES = [...VEHICLES, ...ESTATES, ...LANDMARKS, ...COLLECTIBLES];

export const ITEM_CATS = {
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
export const LIFE_EVENTS = [
  { id:'ticket',   icon:'🚔', zh:'超速被开罚单',              en:'Speeding ticket',                     min:-8_000,  max:-500,   scaleNW:0.00002 },
  { id:'tax_audit',icon:'🧾', zh:'税务稽查，补缴税款',        en:'Tax audit — back taxes assessed',     min:-50_000, max:-2_000, scaleNW:0.0004 },
  { id:'medical',  icon:'🏥', zh:'突发疾病，支付高额医疗费',  en:'Sudden illness, hefty medical bills', min:-30_000, max:-1_000, scaleNW:0.0002 },
  { id:'lawsuit',  icon:'⚖️', zh:'商业纠纷败诉，赔偿对方',    en:'Lost a commercial dispute; damages paid', min:-80_000, max:-5_000, scaleNW:0.0006 },
  { id:'theft',    icon:'🥷', zh:'门店遭窃，损失现金与货品',  en:'Burglary at a store; cash and stock lost', min:-20_000, max:-1_000, scaleNW:0.00015 },
  { id:'charity',  icon:'🤝', zh:'参加慈善晚宴并慷慨捐赠',    en:'Generous pledge at a charity gala',   min:-100_000,max:-5_000, scaleNW:0.001, prestige:12 },
  { id:'lottery',  icon:'🎰', zh:'买彩票中了个小奖',          en:'A small lottery win',                 min:2_000,   max:60_000, scaleNW:0.0002 },
  { id:'refund',   icon:'💸', zh:'去年多缴税款获得退税',      en:'Tax refund from last year',           min:3_000,   max:80_000, scaleNW:0.0005 },
  { id:'award',    icon:'🏆', zh:'当选「年度商业人物」',      en:'Named Businessperson of the Year',    min:0,       max:0,      prestige:25 },
  { id:'interview',icon:'🎤', zh:'接受财经杂志封面专访',      en:'Cover interview in a finance magazine',min:0,      max:0,      prestige:15 },
  { id:'inherit',  icon:'📜', zh:'远房亲戚留下一笔遗产',      en:'A distant relative leaves an inheritance', min:20_000, max:400_000, scaleNW:0.002 },
  { id:'partner',  icon:'🤵', zh:'老同学入股你的生意，付了溢价', en:'An old classmate buys in at a premium', min:10_000, max:200_000, scaleNW:0.0012 },
  { id:'scandal',  icon:'📰', zh:'被小报曝出负面新闻，声望受损', en:'Tabloid hit piece damages your standing', min:0, max:0, prestige:-20 },
  { id:'fire',     icon:'🔥', zh:'一处物业失火，保险未能全额覆盖', en:'Fire at a property; insurance falls short', min:-150_000, max:-10_000, scaleNW:0.0012 },
  { id:'bonus',    icon:'🎁', zh:'供应商年终返利到账',        en:'Year-end supplier rebate lands',      min:5_000,   max:150_000,scaleNW:0.0008 },
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
export const JOBS = [
  { id:'flyer',    zh:'发传单',        en:'Flyer Handout',       emoji:'📄', wage:18,    exp:0,     descZh:'街口站一天，嗓子哑了，钱也就那么点。', descEn:'A day on the corner. Your voice goes; the money barely comes.' },
  { id:'delivery', zh:'送外卖',        en:'Food Courier',        emoji:'🛵', wage:30,   exp:8,    descZh:'风里雨里，超时就扣钱。', descEn:'Rain or shine — every late order costs you.' },
  { id:'clerk',    zh:'便利店店员',    en:'Store Clerk',         emoji:'🏪', wage:50,   exp:24,    descZh:'上夜班加班费更高，但生物钟废了。', descEn:'Night shifts pay more and wreck your sleep.' },
  { id:'waiter',   zh:'餐厅服务员',    en:'Restaurant Server',   emoji:'🍽️', wage:80,   exp:60,   descZh:'小费是真正的收入来源。', descEn:'Tips are the real income.' },
  { id:'rideshare',zh:'网约车司机',    en:'Rideshare Driver',    emoji:'🚕', wage:130,   exp:130,   car:true, descZh:'需要一辆自己的车。跑得越晚，单价越高。', descEn:'Requires your own car. The later you drive, the better the fares.' },
  { id:'trucker',  zh:'长途货车司机',  en:'Long-haul Trucker',   emoji:'🚚', wage:210,   exp:250,   car:true, descZh:'需要一辆车。一趟三天，路上全是风景和困意。', descEn:'Requires a vehicle. Three days out, all scenery and sleep debt.' },
  { id:'sales',    zh:'销售代表',      en:'Sales Rep',           emoji:'💼', wage:330,  exp:450, descZh:'底薪很低，提成才是本体。', descEn:'Low base, the commission is the job.' },
  { id:'coder',    zh:'软件工程师',    en:'Software Engineer',   emoji:'💻', wage:520,  exp:750, descZh:'一边写代码，一边看招聘网站。', descEn:'Writing code with the job board open in another tab.' },
  { id:'analyst',  zh:'金融分析师',    en:'Financial Analyst',   emoji:'📊', wage:820,  exp:1_200, descZh:'终于坐到了离钱最近的位置。', descEn:'Finally seated close to where the money is.' },
  { id:'manager',  zh:'部门经理',      en:'Department Manager',  emoji:'👔', wage:1_300,  exp:1_900, descZh:'开会的时间比干活多。', descEn:'More time in meetings than doing the work.' },
  { id:'vp',       zh:'投行副总裁',    en:'Investment Bank VP',  emoji:'🏦', wage:2_000,exp:3_000, descZh:'年终奖比年薪多，代价是没有周末。', descEn:'The bonus beats the salary; the cost is your weekends.' },
  { id:'ceo',      zh:'职业经理人 CEO',en:'Professional CEO',    emoji:'👑', wage:3_200,exp:4_500,descZh:'替别人打理帝国——直到你有自己的。', descEn:'Running someone else empire — until you build your own.' },
];

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
