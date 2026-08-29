// 实业目录：行业分类 → 店铺类型。
//
// 每个行业有一组「性格」默认值，单个店铺只写和同行不一样的地方。
// 这些性格不是装饰——它们真的进模拟：
//   cogs  进货/原料占营收的比例。酒吧两成，超市七成，这是零售和餐饮的根本差别
//   cyc   经济周期敏感度。1 = 随大盘走；药房 0.3 几乎不受影响，夜店 1.8 繁荣时爆赚、衰退时关门
//   vol   生意本身的波动。服装看季节脸色，殡葬业一年到头一个样
//   wear  折旧速度。汽修厂的举升机和软件公司的服务器，磨损完全不是一回事
//   mktg  营销弹性。投广告对奶茶店立竿见影，对废品回收站基本没用
//   labor 人效：一名员工能撑起多少营收。软件公司人少而贵，超市人多而廉
//   season [旺季月份, 振幅]。冰淇淋七月，滑雪一月，殡仪馆没有旺季
//
// 风险溢价：波动大、周期性强的生意回本更快，稳的生意回本更慢——
// 天下没有又稳又快的生意，这条规矩在这里也一样。

export const BIZ_CATS = [
  { id:'retail',  zh:'零售',   en:'Retail',        emoji:'🛍️', cogs:0.58, cyc:1.05, vol:1.00, wear:1.00, mktg:1.10, labor:1.00 },
  { id:'food',    zh:'餐饮',   en:'Food & Drink',  emoji:'🍜', cogs:0.34, cyc:1.10, vol:1.10, wear:1.60, mktg:1.20, labor:0.85 },
  { id:'service', zh:'服务',   en:'Services',      emoji:'🛠️', cogs:0.22, cyc:1.00, vol:0.90, wear:1.10, mktg:1.00, labor:0.75 },
  { id:'leisure', zh:'娱乐',   en:'Entertainment', emoji:'🎭', cogs:0.28, cyc:1.55, vol:1.50, wear:1.50, mktg:1.50, labor:0.90 },
  { id:'beauty',  zh:'美业',   en:'Beauty',        emoji:'💅', cogs:0.26, cyc:1.15, vol:1.00, wear:1.20, mktg:1.40, labor:0.70 },
  { id:'health',  zh:'医疗',   en:'Healthcare',    emoji:'🩺', cogs:0.34, cyc:0.35, vol:0.50, wear:0.90, mktg:0.70, labor:0.90 },
  { id:'edu',     zh:'教育',   en:'Education',     emoji:'📚', cogs:0.16, cyc:0.70, vol:0.70, wear:0.80, mktg:1.20, labor:0.80 },
  { id:'sport',   zh:'运动',   en:'Sport',         emoji:'⚽', cogs:0.24, cyc:1.25, vol:1.10, wear:1.40, mktg:1.30, labor:0.80 },
  { id:'pet',     zh:'宠物',   en:'Pets',          emoji:'🐾', cogs:0.44, cyc:0.65, vol:0.80, wear:1.00, mktg:1.10, labor:0.80 },
  { id:'farm',    zh:'农业',   en:'Agriculture',   emoji:'🌾', cogs:0.48, cyc:0.55, vol:1.40, wear:1.30, mktg:0.60, labor:1.10 },
  { id:'transit', zh:'交通',   en:'Transport',     emoji:'🚕', cogs:0.40, cyc:1.30, vol:1.30, wear:2.20, mktg:0.70, labor:1.20 },
  { id:'estate',  zh:'地产',   en:'Property',      emoji:'🏨', cogs:0.26, cyc:1.40, vol:1.20, wear:1.20, mktg:1.10, labor:0.90 },
  { id:'industry',zh:'工业',   en:'Industrial',    emoji:'🏭', cogs:0.62, cyc:1.45, vol:1.20, wear:2.00, mktg:0.50, labor:1.30 },
  { id:'energy',  zh:'能源',   en:'Energy',        emoji:'⚡', cogs:0.30, cyc:0.80, vol:1.50, wear:1.10, mktg:0.50, labor:2.00 },
  { id:'tech',    zh:'科技',   en:'Technology',    emoji:'💻', cogs:0.18, cyc:1.20, vol:1.60, wear:0.40, mktg:1.00, labor:1.80 },
  { id:'media',   zh:'传媒',   en:'Media',         emoji:'📺', cogs:0.30, cyc:1.60, vol:1.70, wear:0.60, mktg:1.40, labor:1.40 },
  { id:'finance', zh:'金融',   en:'Finance',       emoji:'🏦', cogs:0.12, cyc:1.70, vol:1.80, wear:0.30, mktg:0.80, labor:2.20 },
];

// [id, 中文名, English, emoji, 分类, 开办成本, 营业时段, 中文简介, English blurb, 特性覆盖]
const RAW = [
// ── 零售 ────────────────────────────────────────────────────
['streetvend','街头小摊','Street Stall','🧺','retail',400,[8,20],'一块布、一堆小玩意，成本低到可以忽略。这就是你的第一桶金。','A blanket and a pile of trinkets. This is where the first dollar comes from.',{vol:1.3,wear:0.6}],
['balloon','气球小贩','Balloon Vendor','🎈','retail',2_200,[10,20],'公园门口的周末生意，孩子一哭家长就掏钱。','Weekend park trade — one crying child and the wallet opens.',{cogs:0.30,vol:1.4,season:[7,0.35]}],
['flower','街角花店','Corner Florist','💐','retail',12_000,[8,20],'情人节一天能顶三个月，剩下的日子看着花烂在桶里。','Valentine’s Day pays for three months; the rest of the year you watch stems rot in the bucket.',{cogs:0.46,vol:1.9,season:[2,0.55]}],
['newsstand','报刊亭','Newsstand','📰','retail',26_000,[6,20],'街角的小生意，卖报纸、香烟和彩票。','A corner kiosk selling papers, smokes and lottery tickets.',{cogs:0.68,cyc:0.55,vol:0.55,mktg:0.5}],
['bookshop','独立书店','Independent Bookshop','📖','retail',70_000,[10,22],'利润薄得像书页，但来的人愿意待一下午。','Margins thin as the pages, but people stay all afternoon.',{cogs:0.62,cyc:0.85,vol:0.7,labor:0.7}],
['toystore','玩具店','Toy Shop','🧸','retail',140_000,[10,21],'一年的账，全押在十二月那三个星期上。','The whole year’s books ride on three weeks in December.',{cogs:0.55,vol:1.5,season:[12,0.62]}],
['convenience','便利店','Convenience Store','🏪','retail',330_000,[0,24],'24 小时营业，社区的水电煤。','Open 24/7 — the utility of the neighbourhood.',{cogs:0.70,cyc:0.60,vol:0.5,mktg:0.6}],
['thrift','二手循环店','Thrift & Resale','🧥','retail',480_000,[10,20],'经济越差生意越好——这是少数逆周期的零售。','The worse the economy, the better the trade. One of the few counter-cyclical shops on the street.',{cogs:0.30,cyc:-0.55,vol:0.9}],
['clothing','服装精品店','Fashion Boutique','👗','retail',2_700_000,[10,22],'时尚生意，压货是最大的敌人。','Fashion moves fast — dead stock is the enemy.',{cogs:0.48,cyc:1.5,vol:1.8,mktg:1.7,season:[10,0.28]}],
['pharmacy','连锁药房','Pharmacy Chain','💊','retail',4_000_000,[8,22],'牌照壁垒高，抗周期能力一流。','Licensing moat, recession-proof demand.',{cogs:0.64,cyc:0.20,vol:0.35,mktg:0.5}],
['supermarket','大型超市','Supermarket','🛒','retail',6_000_000,[8,22],'薄利多销，靠账期和规模挣钱。','Thin margins, huge volume — you earn on scale and payment terms.',{cogs:0.74,cyc:0.45,vol:0.4,labor:1.5}],
['furniture','家居卖场','Furniture Warehouse','🛋️','retail',11_000_000,[10,21],'客单价高，但没人一年买两次沙发。','Big tickets — but nobody buys a sofa twice a year.',{cogs:0.52,cyc:1.7,vol:1.3}],
['jewelry','高级珠宝行','Fine Jewellery','💍','retail',24_000_000,[10,20],'库存就是黄金本身，最不怕通胀的零售。','The inventory is bullion. The one shop that welcomes inflation.',{cogs:0.56,cyc:1.6,vol:1.6,mktg:1.5}],
['phonestore','数码旗舰店','Electronics Flagship','📱','retail',30_000_000,[10,22],'新机发布日门口能排三百米。','On launch day the queue runs 300 metres.',{cogs:0.72,cyc:1.35,vol:1.4,mktg:1.5}],
['dutyfree','机场免税城','Airport Duty-Free','🛂','retail',85_000_000,[0,24],'旅客量决定一切，护照就是你的客流表。','Passenger numbers are the whole business; passports are your footfall report.',{cogs:0.50,cyc:1.75,vol:1.7,season:[8,0.30]}],
['dealership','4S 汽车城','Car Dealership','🚗','retail',68_000_000,[9,19],'卖车不赚钱，金融和售后才是利润中心。','Cars barely break even — financing and servicing are the profit centres.',{cogs:0.80,cyc:1.7,vol:1.4,labor:1.6}],
['deptstore','城市百货公司','Department Store','🏬','retail',210_000_000,[10,22],'一整栋楼的租金，和一整栋楼的客流。','A whole building of rent, and a whole building of footfall.',{cogs:0.60,cyc:1.5,vol:1.3,labor:1.4}],
// ── 餐饮 ────────────────────────────────────────────────────
['pancake','煎饼摊','Street Food Cart','🥞','food',4_000,[6,11],'早高峰四十分钟，决定你一整天的收入。','Forty minutes of morning rush decides your whole day.',{cogs:0.30,vol:1.2}],
['icecream','冰淇淋摊','Ice Cream Stand','🍦','food',9_000,[11,21],'夏天排长队，冬天连电费都不够。','Queues down the block in July; in January you cannot cover the power bill.',{cogs:0.26,vol:1.6,season:[7,0.70]}],
['nightstall','夜市大排档','Night Market Stall','🏮','food',16_000,[18,2],'啤酒配烧烤，凌晨两点才是营业高峰。','Beer and skewers — peak hour is 2am.',{cogs:0.32,vol:1.3,wear:1.9}],
['coffeecart','流动咖啡车','Coffee Cart','☕','food',32_000,[7,15],'一台意式咖啡机 + 一辆小推车，写字楼下的早高峰就是印钞机。','One espresso machine, one cart. The morning rush is a money printer.',{cogs:0.24,cyc:0.75,vol:0.8}],
['milktea','奶茶店','Bubble Tea Shop','🧋','food',58_000,[10,22],'年轻人的快乐水。翻台率高，毛利惊人。','Liquid happiness for the young. High turnover, stunning margins.',{cogs:0.28,mktg:1.8,vol:1.4,season:[7,0.25]}],
['bakery','面包烘焙坊','Bakery','🥐','food',95_000,[6,20],'凌晨四点开工，香味就是最好的广告。','Up at 4am. The smell is the only advertising you need.',{cogs:0.36,cyc:0.70,vol:0.7,wear:1.8}],
['noodle','面馆','Noodle House','🍜','food',130_000,[10,21],'一碗面撑起一家人，经济再差也有人要吃饭。','One bowl feeds a family. However bad it gets, people still eat.',{cogs:0.38,cyc:0.35,vol:0.5}],
['pizzeria','披萨外送店','Pizza & Delivery','🍕','food',280_000,[11,23],'一半营收来自外卖平台，抽成也来自外卖平台。','Half the revenue comes from delivery apps. So does half the commission.',{cogs:0.40,cyc:0.80,vol:0.9,mktg:1.5}],
['brunch','早午餐馆','Brunch Cafe','🥞','food',420_000,[7,15],'周末两天的营业额，超过工作日五天。','Two weekend days out-earn five weekdays.',{cogs:0.35,cyc:1.3,vol:1.1,mktg:1.4}],
['fastfood','快餐店','Fast Food Outlet','🍔','food',760_000,[7,23],'标准化出餐，可复制性极强的现金牛。','Standardised kitchen, endlessly replicable cash cow.',{cogs:0.33,cyc:0.60,vol:0.6,labor:1.2}],
['hotpot','火锅连锁','Hotpot Chain','🍲','food',1_600_000,[11,2],'翻台三轮，冬天是它的黄金季。','Three seatings a night, and winter is its season.',{cogs:0.36,vol:1.2,season:[12,0.30]}],
['brewery','精酿啤酒厂','Craft Brewery','🍺','food',3_400_000,[12,24],'自己酿、自己卖，毛利高到不像餐饮。','Brew it and pour it yourself — margins no restaurant ever sees.',{cogs:0.22,cyc:1.4,vol:1.3,wear:1.4,season:[7,0.24]}],
['restaurant','高级餐厅','Fine Dining','🍽️','food',9_000_000,[11,23],'米其林指南来的那天，你的排队会到街尾。','The day the Michelin inspector arrives, the queue reaches the corner.',{cogs:0.31,cyc:1.7,vol:1.5,mktg:1.4}],
['catering','大型餐饮配送','Contract Catering','🍱','food',22_000_000,[5,20],'给医院、学校、工地供餐，签的是三年合同。','Feeding hospitals, schools and building sites on three-year contracts.',{cogs:0.55,cyc:0.30,vol:0.30,mktg:0.4,labor:1.4}],
// ── 服务 ────────────────────────────────────────────────────
['shoeshine','擦鞋摊','Shoeshine Stand','🥾','service',1_000,[8,18],'火车站门口的老手艺，客人多是赶时间的生意人。','An old trade outside the station; your customers are always in a hurry.',{cogs:0.12,vol:0.8}],
['keycut','配钥匙修鞋','Key Cutting & Repairs','🔑','service',5_500,[9,19],'门口两平米，修的都是别人不想扔的东西。','Two square metres by the door, mending what people cannot bear to throw away.',{cogs:0.18,cyc:-0.30,vol:0.5}],
['laundry','洗衣店','Laundrette','🧺','service',45_000,[7,22],'水电是最大成本，客流像时钟一样准。','Utilities are the big line item; the footfall runs like a clock.',{cogs:0.20,cyc:0.30,vol:0.4,wear:1.5}],
['printshop','图文快印店','Print & Copy Shop','🖨️','service',88_000,[8,20],'开学季和年报季，机器一天都停不下来。','Term start and reporting season — the machines never cool down.',{cogs:0.34,vol:0.9,wear:1.7,season:[9,0.32]}],
['carwash','洗车行','Car Wash','🚿','service',150_000,[8,19],'现金流稳定，几乎不受经济周期影响。','Steady cash flow, almost immune to the business cycle.',{cogs:0.16,cyc:0.35,vol:0.6,wear:1.6}],
['locksmith','开锁与安防','Locksmith & Security','🔐','service',260_000,[0,24],'半夜三点的电话，收的是加急费。','The three-in-the-morning call is the one that pays.',{cogs:0.24,cyc:0.25,vol:0.5}],
['movers','搬家公司','Removals Company','📦','service',540_000,[7,20],'房子在换手，你就在赚钱。','You earn whenever houses change hands.',{cogs:0.28,cyc:1.5,vol:1.3,wear:1.9,season:[7,0.26]}],
['cleaning','保洁服务公司','Commercial Cleaning','🧹','service',900_000,[5,23],'办公楼合同一签就是几年，最稳的现金流之一。','Office contracts run for years — one of the steadiest cash flows there is.',{cogs:0.14,cyc:0.40,vol:0.35,labor:1.6}],
['autoshop','汽车修理厂','Auto Repair Shop','🔧','service',1_800_000,[8,18],'配件加价率是行业公开的秘密。','The markup on parts is the industry open secret.',{cogs:0.42,cyc:-0.25,vol:0.7,wear:1.8}],
['funeral','殡仪服务','Funeral Home','🕯️','service',3_200_000,[0,24],'这门生意从不看经济脸色，也从不缺客户。','A trade that never checks the economy, and never runs short of customers.',{cogs:0.30,cyc:0.05,vol:0.20,mktg:0.3}],
['security','安保服务公司','Security Firm','🛡️','service',7_500_000,[0,24],'卖的是人力和安心，合同期越长越好。','You sell manpower and peace of mind; the longer the contract the better.',{cogs:0.12,cyc:0.50,vol:0.4,labor:1.7}],
['lawfirm','法律事务所','Law Firm','⚖️','service',26_000_000,[9,19],'经济好的时候做并购，经济差的时候做破产——两头都是生意。','Mergers in the boom, bankruptcies in the bust. Both are billable.',{cogs:0.08,cyc:0.30,vol:0.9,labor:2.4}],
['consult','管理咨询公司','Consulting Firm','📊','service',60_000_000,[9,21],'卖的是 PPT 和确定性，按人天计费。','Slides and certainty, billed by the person-day.',{cogs:0.10,cyc:1.8,vol:1.6,labor:2.6}],
// ── 娱乐 ────────────────────────────────────────────────────
['arcade','街机游戏厅','Arcade','🕹️','leisure',75_000,[10,23],'一枚硬币一条命，机器越旧越有人怀旧。','One coin, one life. The older the cabinets, the stronger the nostalgia.',{cogs:0.12,vol:1.4,wear:1.9}],
['karaoke','KTV 量贩','Karaoke Bar','🎤','leisure',320_000,[14,3],'包厢费只是入场券，酒水才是利润。','The room fee is the ticket; the drinks are the profit.',{cogs:0.24,cyc:1.6,vol:1.5,wear:1.8}],
['netcafe','电竞网咖','Esports Cafe','🖥️','leisure',490_000,[0,24],'显卡就是生产力，通宵包夜利润最高。','GPUs are productivity. The overnight package is where the margin is.',{cogs:0.16,cyc:1.3,vol:1.4,wear:2.2}],
['bowling','保龄球馆','Bowling Alley','🎳','leisure',1_400_000,[11,24],'球道二十年不换，翻新一次能再撑十年。','The lanes last twenty years; one refit buys another ten.',{cogs:0.20,cyc:1.4,vol:1.2,wear:1.5}],
['escape','密室逃脱','Escape Rooms','🗝️','leisure',900_000,[12,23],'主题三个月就腻，换新主题就是全部的成本。','A theme goes stale in three months; building the next one is the whole cost base.',{cogs:0.14,cyc:1.6,vol:1.9,mktg:2.0,wear:2.0}],
['bar','夜店酒吧','Nightclub & Bar','🍸','leisure',13_500_000,[20,4],'夜里十点后才开始营业，酒水毛利 80%。','Opens at 10pm. Drinks carry an 80% gross margin.',{cogs:0.20,cyc:1.85,vol:1.9,mktg:1.7,wear:1.9}],
['cinema','连锁影院','Cinema Chain','🎬','leisure',20_000_000,[10,24],'票房分账 + 爆米花暴利，档期决定一切。','Box-office splits plus popcorn margins.',{cogs:0.44,cyc:1.5,vol:1.7,season:[7,0.30]}],
['themepark','主题乐园','Theme Park','🎢','leisure',400_000_000,[9,22],'暑假两个月赚一年的钱，剩下十个月养设备。','Two summer months earn the year; ten months maintain the rides.',{cogs:0.22,cyc:1.7,vol:1.5,wear:2.0,season:[7,0.55]}],
['casino','综合度假赌场','Casino Resort','🎰','leisure',900_000_000,[0,24],'数学站在你这边，波动也站在你这边。','The mathematics is on your side. So is the variance.',{cogs:0.10,cyc:1.9,vol:2.2,mktg:1.6}],
// ── 美业 ────────────────────────────────────────────────────
['nailbar','美甲工作室','Nail Studio','💅','beauty',38_000,[10,21],'一双手做两小时，回头客决定生死。','Two hours a pair of hands; repeat customers are the entire business.',{cogs:0.22,vol:0.9,mktg:1.6}],
['barber','理发沙龙','Hair Salon','💈','beauty',210_000,[9,20],'手艺活儿，办卡预付款让你提前收到钱。','A craft business — prepaid memberships put cash in your pocket early.',{cogs:0.20,cyc:0.70,vol:0.7}],
['spa','养生水疗馆','Day Spa','🧖','beauty',780_000,[10,22],'卖的是两小时的与世隔绝，压力越大生意越好。','You sell two hours away from the world. The more stressed the city, the better the trade.',{cogs:0.24,cyc:1.4,vol:1.1,mktg:1.5}],
['tattoo','纹身工作室','Tattoo Studio','🖋️','beauty',300_000,[12,22],'一个好师傅能带走一半客人，这是它最大的风险。','A good artist can walk out with half your clients. That is the risk.',{cogs:0.18,cyc:1.3,vol:1.5,labor:0.6}],
['medspa','医美中心','Aesthetic Clinic','💉','beauty',5_200_000,[10,21],'客单价高得吓人，口碑和执照一样重要。','Ticket sizes that startle. Reputation matters as much as the licence.',{cogs:0.28,cyc:1.6,vol:1.4,mktg:1.8}],
['cosmetics','化妆品连锁','Cosmetics Chain','💄','beauty',18_000_000,[10,22],'口红效应：经济越差，小奢侈品卖得越好。','The lipstick effect: the worse things get, the better small luxuries sell.',{cogs:0.42,cyc:-0.35,vol:0.9,mktg:1.9}],
// ── 医疗 ────────────────────────────────────────────────────
['gpclinic','社区诊所','Community Clinic','🩺','health',420_000,[8,20],'看的是头疼脑热，赚的是稳定和信任。','Coughs and colds. What you earn is steadiness and trust.',{cogs:0.30,cyc:0.15,vol:0.30}],
['dental','口腔诊所','Dental Practice','🦷','health',1_900_000,[9,19],'种植牙一颗的利润，抵得上补一百次牙。','One implant is worth a hundred fillings.',{cogs:0.32,cyc:0.60,vol:0.5}],
['optical','视光眼镜中心','Optical Centre','👓','health',900_000,[10,21],'镜片成本三十块，卖三百块，这行一直如此。','Thirty dollars of lens sold for three hundred. It has always been this way.',{cogs:0.24,cyc:0.45,vol:0.4}],
['physio','康复理疗中心','Physiotherapy Centre','🧑‍⚕️','health',1_400_000,[8,20],'运动损伤和久坐办公，给你送来两拨完全不同的客人。','Sports injuries and desk jobs send you two entirely different crowds.',{cogs:0.16,cyc:0.40,vol:0.4}],
['lab','医学检验中心','Diagnostics Lab','🔬','health',14_000_000,[0,24],'设备一次投入，样本量决定单位成本。','One capital outlay; sample volume decides the unit cost.',{cogs:0.26,cyc:0.20,vol:0.35,labor:1.8}],
['eldercare','高端养老社区','Senior Living','🏡','health',95_000_000,[0,24],'入住率一旦上去就极其稳定，人口结构站在你这边。','Once occupancy climbs it barely moves. Demographics are on your side.',{cogs:0.30,cyc:0.15,vol:0.20,labor:1.2}],
['clinic','私立医院','Private Hospital','🏥','health',150_000_000,[0,24],'高端医疗，客单价极高，口碑极难建立。','Premium healthcare: enormous ticket size, slow reputation building.',{cogs:0.36,cyc:0.30,vol:0.4}],
// ── 教育 ────────────────────────────────────────────────────
['tutoring','课后辅导班','Tutoring Centre','📚','edu',60_000,[15,21],'开学一到，报名的队伍能排到楼下。','Come term time, the queue to enrol reaches the stairwell.',{cogs:0.10,cyc:0.45,vol:0.8,season:[9,0.40]}],
['musicschool','音乐培训学校','Music School','🎻','edu',180_000,[13,21],'预收学费是这门生意最好的部分。','Fees collected up front are the best part of this trade.',{cogs:0.12,cyc:0.90,vol:0.6,season:[9,0.30]}],
['drivingschool','驾驶培训学校','Driving School','🚙','edu',650_000,[7,20],'车、油、教练，成本都在路上跑。','Cars, fuel and instructors — the cost base is out driving around.',{cogs:0.34,cyc:0.80,vol:0.6,wear:2.2}],
['language','国际语言中心','Language Institute','🗣️','edu',2_400_000,[9,21],'留学季是旺季，签证政策一变就换天。','Peak season is application season; one visa rule can change everything.',{cogs:0.14,cyc:1.1,vol:1.2,season:[8,0.35]}],
['codecamp','编程训练营','Coding Bootcamp','⌨️','edu',5_500_000,[9,22],'就业率就是招生广告，经济好坏都有人来。','The placement rate is the advertising. People come in booms and busts alike.',{cogs:0.12,cyc:0.55,vol:1.3,mktg:1.7,labor:1.6}],
['privschool','国际私立学校','Private School','🎓','edu',180_000_000,[7,18],'学费一年一收，家长排队排三年。','Fees once a year, and a three-year waiting list.',{cogs:0.18,cyc:0.35,vol:0.25,labor:0.9}],
// ── 运动 ────────────────────────────────────────────────────
['bikeshop','自行车行','Bike Shop','🚲','sport',55_000,[9,20],'卖车赚一点，修车赚得更久。','Selling bikes pays a little; fixing them pays for longer.',{cogs:0.52,vol:1.0,season:[5,0.35]}],
['climbing','攀岩馆','Climbing Gym','🧗','sport',1_100_000,[10,23],'会员制的黏性极强，来的人一周来四次。','Membership stickiness is extraordinary — regulars come four times a week.',{cogs:0.14,cyc:1.3,vol:1.0,wear:1.5}],
['gym','健身房','Fitness Gym','🏋️','sport',1_150_000,[6,23],'卖的是年卡，赚的是不来的人。','You sell annual passes; you profit from the people who never show up.',{cogs:0.12,cyc:1.2,vol:0.9,mktg:1.5,season:[1,0.30]}],
['swimpool','游泳馆','Swimming Centre','🏊','sport',3_600_000,[6,22],'水电和加热是永远的成本，夏天才是回本的季节。','Heating and water never stop. Summer is when it pays back.',{cogs:0.26,vol:1.1,wear:1.6,season:[7,0.40]}],
['golf','高尔夫球场','Golf Course','⛳','sport',120_000_000,[6,19],'土地、草坪和会员费，最贵的是那片草。','Land, turf and membership dues. The turf is the expensive part.',{cogs:0.18,cyc:1.7,vol:1.2,wear:1.4,season:[6,0.35]}],
['stadium','职业球队与球场','Pro Club & Stadium','🏟️','sport',700_000_000,[0,24],'成绩决定票房，票房决定转会费，转会费决定成绩。','Results drive gate receipts, gate receipts drive transfers, transfers drive results.',{cogs:0.34,cyc:1.5,vol:2.0,mktg:1.6,season:[10,0.35]}],
// ── 宠物 ────────────────────────────────────────────────────
['petgroom','宠物美容店','Pet Grooming','🐩','pet',48_000,[9,20],'宠物经济从不衰退，主人对自己抠对狗大方。','The pet economy never contracts. People economise on themselves, never on the dog.',{cogs:0.20,cyc:0.40,vol:0.6}],
['petshop','宠物用品店','Pet Supplies','🐾','pet',260_000,[9,21],'粮食是复购生意，一养就是十几年。','Food is a repeat purchase, and a dog lasts a decade.',{cogs:0.58,cyc:0.35,vol:0.4}],
['pethotel','宠物寄养酒店','Pet Boarding','🏨','pet',700_000,[0,24],'节假日一房难求，平时靠老客户撑着。','Fully booked every holiday, carried by regulars the rest of the year.',{cogs:0.24,cyc:0.9,vol:0.9,season:[1,0.35]}],
['vet','宠物医院','Veterinary Hospital','🐕‍🦺','pet',4_500_000,[0,24],'半夜的急诊电话，主人从来不问价格。','On the midnight emergency call, nobody asks the price.',{cogs:0.34,cyc:0.20,vol:0.35}],
// ── 农业 ────────────────────────────────────────────────────
['veggie','蔬菜大棚','Market Garden','🥬','farm',18_000,[5,18],'看天吃饭，一场冰雹就是一季的收成。','You farm at the weather’s pleasure. One hailstorm is one season gone.',{cogs:0.40,vol:2.0,season:[6,0.40]}],
['orchard','果园','Orchard','🍎','farm',260_000,[6,19],'种下去三年才结果，之后二十年都是它。','Three years to the first fruit, then twenty years of it.',{cogs:0.42,vol:1.8,season:[9,0.60]}],
['fishfarm','水产养殖场','Fish Farm','🐟','farm',1_200_000,[0,24],'水温、饲料和病害，任何一样出问题都是全池。','Water temperature, feed and disease. Any one of them takes the whole pond.',{cogs:0.52,vol:2.1,wear:1.5}],
['vineyard','酒庄葡萄园','Vineyard & Winery','🍇','farm',26_000_000,[9,19],'今年的活儿，三年后才卖得出去。','This year’s work does not sell for another three.',{cogs:0.34,cyc:1.4,vol:1.7,season:[9,0.45]}],
['ranch','大型牧场','Cattle Ranch','🐄','farm',90_000_000,[0,24],'土地本身就在升值，牛只是附带的。','The land appreciates on its own. The cattle are almost incidental.',{cogs:0.56,cyc:0.60,vol:1.5,labor:1.5}],
['agritech','智能垂直农场','Vertical Farm','🌱','farm',150_000_000,[0,24],'把农业搬进楼里，电费替代了天气。','Farming indoors: the power bill replaces the weather.',{cogs:0.30,cyc:0.70,vol:1.1,labor:2.0,wear:0.8}],
// ── 交通 ────────────────────────────────────────────────────
['tuktuk','三轮摩的','Rickshaw Service','🛺','transit',3_000,[6,22],'一辆车、一双手，跑得越多挣得越多。','One vehicle and two hands. The more you drive, the more you take home.',{cogs:0.30,vol:1.1,wear:2.4}],
['taxi','出租车队','Taxi Fleet','🚕','transit',380_000,[0,24],'油价一涨，利润就没了一半。','One fuel spike takes half the margin.',{cogs:0.46,cyc:1.4,vol:1.4,wear:2.5}],
['courier','同城快递','City Courier','🛵','transit',720_000,[7,23],'电商越热闹，你的电动车跑得越快。','The louder e-commerce gets, the faster your scooters run.',{cogs:0.38,cyc:1.3,vol:1.2,wear:2.5,labor:1.5}],
['coach','长途客运','Coach Operator','🚌','transit',6_500_000,[5,23],'节假日一票难求，平常空座率吓人。','Sold out at every holiday, alarmingly empty in between.',{cogs:0.44,cyc:1.2,vol:1.3,wear:2.3,season:[2,0.35]}],
['ferry','轮渡航线','Ferry Line','⛴️','transit',48_000_000,[6,22],'航线一旦拿到就是牌照生意，天气是唯一的变数。','Once you hold the route it is a licence. Weather is the only variable.',{cogs:0.36,cyc:1.1,vol:1.3,wear:1.8,season:[7,0.32]}],
['logistics','物流快运公司','Logistics Company','🚚','transit',100_000_000,[0,24],'电商时代的血管，规模即护城河。','The arteries of e-commerce. Scale is the moat.',{cogs:0.52,cyc:1.5,vol:1.2,wear:2.2,labor:1.5}],
['airline','航空公司','Airline','✈️','transit',1_300_000_000,[0,24],'烧钱的浪漫。油价一涨，全年白干。','Romantic and ruinous. One fuel spike wipes out the year.',{cogs:0.62,cyc:1.9,vol:2.1,wear:2.0,labor:1.6}],
// ── 地产 ────────────────────────────────────────────────────
['parking','停车场','Car Park','🅿️','estate',420_000,[0,24],'一块地，一个道闸，几乎没有运营成本。','A patch of land and a barrier. Almost no cost of operation.',{cogs:0.06,cyc:1.1,vol:0.7,labor:2.2,wear:0.6}],
['storage','自助仓储','Self Storage','📦','estate',2_800_000,[0,24],'客户搬进来就不走了，这是最省心的地产生意。','Tenants move in and never leave. The most restful property business there is.',{cogs:0.08,cyc:0.60,vol:0.5,labor:2.4,wear:0.7}],
['coworking','联合办公空间','Co-working Space','🪑','estate',5_800_000,[0,24],'转租生意：长租进来，短租出去，中间是利润也是风险。','Sublease arbitrage: take it long, let it short. The spread is both the profit and the risk.',{cogs:0.14,cyc:1.8,vol:1.8,mktg:1.4}],
['hostel','青年旅舍','Hostel','🎒','estate',1_600_000,[0,24],'床位便宜，入住率是全部。','Cheap beds — occupancy is everything.',{cogs:0.18,cyc:1.5,vol:1.4,season:[7,0.38]}],
['hotel','精品酒店','Boutique Hotel','🏨','estate',45_000_000,[0,24],'重资产、高入住率，旺季一房难求。','Asset-heavy, occupancy-driven.',{cogs:0.24,cyc:1.6,vol:1.4,season:[8,0.30]}],
['mall','购物中心','Shopping Mall','🏬','estate',320_000_000,[10,22],'你不卖东西，你收所有卖东西的人的租金。','You sell nothing. You collect rent from everyone who does.',{cogs:0.10,cyc:1.5,vol:1.1,labor:2.2}],
['resort','海岛度假村','Island Resort','🏝️','estate',550_000_000,[0,24],'把风景变成现金流，一价全包利润惊人。','Turning scenery into cash flow.',{cogs:0.26,cyc:1.8,vol:1.6,season:[1,0.35]}],
// ── 工业 ────────────────────────────────────────────────────
['scrap','废品回收站','Scrap Yard','♻️','industry',8_000,[8,17],'脏活累活，但现金流从不骗人。','Dirty work, but the cash flow never lies.',{cogs:0.55,cyc:1.3,vol:1.5,mktg:0.25,wear:1.6}],
['woodshop','木工作坊','Joinery Workshop','🪚','industry',120_000,[8,18],'定制家具，接一单做一个月。','Bespoke furniture — one order fills a month.',{cogs:0.50,cyc:1.4,vol:1.2,wear:1.7}],
['printing','印刷厂','Printing Plant','🖨️','industry',1_900_000,[0,24],'机器停一小时就是钱，所以它从不停。','An idle hour costs money, so the presses never stop.',{cogs:0.58,cyc:1.2,vol:0.9,wear:2.1,labor:1.4}],
['packaging','包装材料厂','Packaging Plant','📦','industry',12_000_000,[0,24],'谁都要用箱子，这是最不起眼的必需品生意。','Everyone needs boxes. The least glamorous necessity there is.',{cogs:0.64,cyc:0.75,vol:0.7,labor:1.6}],
['steel','钢铁厂','Steel Mill','🏗️','industry',380_000_000,[0,24],'周期之王：好年份印钞，坏年份流血。','The cyclical king. It prints money in good years and bleeds in bad ones.',{cogs:0.72,cyc:2.0,vol:1.9,wear:2.2,labor:1.6}],
['factory','汽车制造厂','Auto Factory','🏭','industry',850_000_000,[0,24],'重工业帝国的基石，产能利用率决定生死。','The bedrock of an industrial empire.',{cogs:0.68,cyc:1.8,vol:1.5,wear:2.0,labor:1.5}],
['shipyard','造船厂','Shipyard','🛳️','industry',1_500_000_000,[0,24],'一张订单管三年，一次空窗也是三年。','One order fills three years. So does one empty book.',{cogs:0.66,cyc:1.9,vol:2.0,wear:1.8,labor:1.4}],
// ── 能源 ────────────────────────────────────────────────────
['solarroof','屋顶光伏安装','Rooftop Solar','🔆','energy',340_000,[8,18],'装完就走，赚的是安装费和补贴。','Fit it and leave. You earn on installation and subsidy.',{cogs:0.50,cyc:0.90,vol:1.3,wear:1.2,season:[6,0.28]}],
['evcharge','充电桩网络','EV Charging Network','🔌','energy',4_200_000,[0,24],'占好车位就是护城河，电价差就是利润。','Owning the bay is the moat; the spread on electricity is the profit.',{cogs:0.56,cyc:0.85,vol:1.2,labor:2.4,wear:1.0}],
['solarfarm','光伏电站','Solar Farm','☀️','energy',85_000_000,[0,24],'建完基本无人值守，二十五年只看太阳的脸色。','Once built it runs itself for twenty-five years, answering only to the sun.',{cogs:0.06,cyc:0.45,vol:1.3,labor:3.0,wear:0.7,season:[6,0.30]}],
['windfarm','风力发电场','Wind Farm','🌬️','energy',260_000_000,[0,24],'风不来的那个月，账上就是空的。','In a month with no wind, the books are simply empty.',{cogs:0.08,cyc:0.40,vol:1.9,labor:3.0,wear:1.0,season:[1,0.30]}],
['datacenter','绿色数据中心','Green Data Centre','🗄️','energy',600_000_000,[0,24],'卖的是电力和机位，客户签的是十年合同。','You sell power and rack space on ten-year contracts.',{cogs:0.34,cyc:0.70,vol:0.6,labor:2.8,wear:0.9}],
// ── 科技 ────────────────────────────────────────────────────
['repairshop','手机维修店','Phone Repair','🔩','tech',22_000,[10,21],'换屏、换电池，靠的是手艺和配件差价。','Screens and batteries — skill plus the margin on parts.',{cogs:0.44,cyc:0.50,vol:0.8,wear:0.9}],
['webstudio','网页设计工作室','Web Studio','🖱️','tech',150_000,[9,21],'三个人一台咖啡机，接单就能开工。','Three people and a coffee machine. All you need is the next brief.',{cogs:0.08,cyc:1.5,vol:1.6,labor:2.0,wear:0.3}],
['appstudio','独立游戏工作室','Indie Game Studio','🎮','tech',1_800_000,[10,24],'十款里有九款赔钱，第十款让你忘掉前九款。','Nine of ten lose money. The tenth makes you forget the nine.',{cogs:0.10,cyc:1.3,vol:2.4,mktg:1.8,labor:1.9}],
['saas','SaaS 订阅平台','SaaS Platform','☁️','tech',12_000_000,[0,24],'边际成本趋近于零，续费率就是一切。','Marginal cost near zero. Renewal rate is the whole story.',{cogs:0.12,cyc:1.1,vol:1.4,labor:2.4,wear:0.2}],
['robotics','工业机器人公司','Robotics Company','🦾','tech',95_000_000,[0,24],'卖给工厂的东西，跟着工厂一起过周期。','You sell to factories, so you ride the factory cycle.',{cogs:0.40,cyc:1.7,vol:1.6,labor:2.0}],
['software','软件公司','Software Company','💻','tech',230_000_000,[9,21],'边际成本趋近于零的生意，人才就是资产。','Near-zero marginal cost. The talent is the balance sheet.',{cogs:0.14,cyc:1.3,vol:1.5,labor:2.4,wear:0.2}],
['chipfab','芯片晶圆厂','Semiconductor Fab','🔬','tech',2_000_000_000,[0,24],'现代工业的皇冠。一台光刻机就是一栋楼的钱。','The crown of modern industry.',{cogs:0.48,cyc:1.9,vol:2.0,wear:1.6,labor:2.2}],
['spaceport','商业航天基地','Commercial Spaceport','🚀','tech',5_000_000_000,[0,24],'终极浪漫：把火箭和卫星做成一门生意。','The ultimate flex: turning rockets into a business.',{cogs:0.42,cyc:1.6,vol:2.2,labor:2.0}],
// ── 传媒 ────────────────────────────────────────────────────
['podcast','播客工作室','Podcast Studio','🎙️','media',95_000,[10,22],'设备便宜，听众很贵。','The equipment is cheap. The audience is not.',{cogs:0.12,cyc:1.5,vol:2.0,mktg:1.9,labor:1.6}],
['adagency','广告代理公司','Ad Agency','📣','media',3_800_000,[9,21],'经济一冷，客户第一个砍的就是你的预算。','When things cool, your budget is the first line the client cuts.',{cogs:0.22,cyc:2.0,vol:1.9,labor:2.0}],
['musiclabel','独立唱片公司','Record Label','🎧','media',9_000_000,[0,24],'签十个艺人，指望其中一个。','You sign ten artists and hope for one.',{cogs:0.26,cyc:1.4,vol:2.3,mktg:1.8,labor:1.8}],
['filmstudio','影视制作公司','Film Production','🎥','media',120_000_000,[0,24],'一部片子能救活公司，也能拖垮公司。','One picture can save the company. One picture can sink it.',{cogs:0.40,cyc:1.6,vol:2.4,mktg:1.7}],
['tvstation','卫星电视台','TV Network','📺','media',350_000_000,[0,24],'掌握话语权。广告位按秒计价。','You own the narrative. Ad slots are priced by the second.',{cogs:0.30,cyc:1.7,vol:1.6,labor:1.6}],
['streaming','流媒体平台','Streaming Platform','📡','media',1_100_000_000,[0,24],'内容烧钱，订阅回血，中间隔着好几年。','Content burns cash and subscriptions refill it, several years apart.',{cogs:0.36,cyc:1.2,vol:1.8,labor:2.2}],
// ── 金融 ────────────────────────────────────────────────────
['pawnshop','当铺','Pawnbroker','💰','finance',85_000,[9,20],'经济越差，进来的人越多——最纯粹的逆周期生意。','The worse it gets, the more people walk in. The purest counter-cyclical trade.',{cogs:0.14,cyc:-0.80,vol:1.0,labor:1.6}],
['exchange','外币兑换点','Currency Exchange','💱','finance',400_000,[8,21],'赚的是买卖价差，波动越大越好。','You earn on the spread. The wilder the market, the better.',{cogs:0.06,cyc:0.9,vol:1.7,labor:2.2}],
['insurance','保险经纪公司','Insurance Brokerage','📋','finance',7_000_000,[9,19],'佣金是续期的，卖出去一单能收很多年。','Commission renews. One policy pays for years.',{cogs:0.10,cyc:0.55,vol:0.7,labor:2.4}],
['microloan','小额信贷公司','Microlending Firm','🏧','finance',24_000_000,[9,20],'利率很高，坏账率也很高。','The rates are high. So are the write-offs.',{cogs:0.16,cyc:1.9,vol:2.1,labor:2.6}],
['assetmgmt','资产管理公司','Asset Manager','📈','finance',180_000_000,[9,19],'按管理规模抽成，牛市里躺着数钱。','Fees on assets under management. In a bull market you simply count.',{cogs:0.06,cyc:2.0,vol:2.0,labor:3.0}],
['privbank','私人银行','Private Bank','🏦','finance',3_200_000_000,[9,17],'当你有钱到需要一家自己的银行时。','For when you are rich enough to need your own bank.',{cogs:0.08,cyc:1.8,vol:1.7,labor:2.8}],
];

export const BIZ_RAW = RAW;
