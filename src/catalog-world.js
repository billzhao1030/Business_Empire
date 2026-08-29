// ── 世界地图：出生地阿德莱德，机票与酒店按现实价位设定 ──────
// flight = 经济舱往返机票；hours = 单程飞行时长（游戏小时）
// hotel = 三星标准每晚房价；spend = 每日餐饮交通杂费；relief = 每晚压力缓解
export const DEFAULT_HOME = 'adelaide';

// 机票与飞行时长按大圆距离推算（经济舱往返）
export function fareFor(km) {
  if (km <= 1) return 0;
  return Math.round((60 + km * 0.112) / 5) * 5;
}
export function flightHoursFor(km) {
  if (km <= 1) return 0;
  return Math.round((km / 850 + 1.5) * 2) / 2;
}

export const REGIONS_W = [
  { id:'domestic', zh:'澳洲境内', en:'Around Australia', emoji:'🦘' },
  { id:'oceania',  zh:'大洋洲',   en:'Oceania',          emoji:'🏝️' },
  { id:'asia',     zh:'亚洲',     en:'Asia',             emoji:'🏯' },
  { id:'mideast',  zh:'中东',     en:'Middle East',      emoji:'🕌' },
  { id:'europe',   zh:'欧洲',     en:'Europe',           emoji:'🏛️' },
  { id:'africa',   zh:'非洲',     en:'Africa',           emoji:'🦁' },
  { id:'namerica', zh:'北美洲',   en:'North America',    emoji:'🗽' },
  { id:'samerica', zh:'南美洲',   en:'South America',    emoji:'🌴' },
  { id:'polar',    zh:'极地',     en:'Polar',            emoji:'🐧' },
];

export const DESTINATIONS = [
  // ── 出生地候选 & 澳洲境内 ────────────────────────────────
  { id:'adelaide',  zh:'阿德莱德', en:'Adelaide',   country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:138.60, lat:-34.93, hotel:150, spend:85,  relief:5,  prestige:0, home:true,
    descZh:'教堂之城，节庆之都，生活节奏刚刚好。', descEn:'City of churches and festivals, at exactly the right pace.' },
  { id:'melbourne', home:true, zh:'墨尔本',   en:'Melbourne',  country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:144.96, lat:-37.81, hotel:150, spend:90,  relief:5,  prestige:0,
    descZh:'咖啡、涂鸦巷和永远猜不透的天气。', descEn:'Coffee, laneway art and famously unreliable weather.' },
  { id:'sydney', home:true,    zh:'悉尼',     en:'Sydney',     country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:151.21, lat:-33.87, hotel:190, spend:110, relief:5,  prestige:1,
    descZh:'歌剧院、海港大桥，和贵得离谱的房价。', descEn:'Opera House, harbour bridge, and absurd property prices.' },
  { id:'goldcoast', zh:'黄金海岸', en:'Gold Coast', country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:153.43, lat:-28.02, hotel:165, spend:100, relief:6,  prestige:1,
    descZh:'冲浪者天堂，一整片金色的沙滩。', descEn:'Surfers Paradise and a long stretch of gold.' },
  { id:'uluru', fareMult:1.9,     zh:'乌鲁鲁',   en:'Uluru',      country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:131.04, lat:-25.34, hotel:240, spend:120, relief:8,  prestige:4,
    descZh:'红色大地中央的巨石，日落时会变色。', descEn:'A monolith in the red centre that changes colour at sunset.' },
  { id:'cairns',    zh:'凯恩斯',   en:'Cairns',     country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:145.77, lat:-16.92, hotel:180, spend:130, relief:8,  prestige:3,
    descZh:'大堡礁的门户，下水就是另一个世界。', descEn:'Gateway to the Great Barrier Reef; another world underwater.' },
  { id:'perth',     zh:'珀斯',     en:'Perth',      country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:115.86, lat:-31.95, hotel:160, spend:95,  relief:5,  prestige:1,
    descZh:'全世界最孤独的大城市之一。', descEn:'One of the most isolated big cities on earth.' },
  { id:'hobart',    zh:'霍巴特',   en:'Hobart',     country:'澳大利亚', countryEn:'Australia', flag:'🇦🇺', region:'domestic',
    lon:147.33, lat:-42.88, hotel:150, spend:90,  relief:6,  prestige:1,
    descZh:'塔斯马尼亚的清冷空气与荒野。', descEn:'Tasmania: cold clean air and real wilderness.' },
  // ── 大洋洲 ──────────────────────────────────────────────
  { id:'queenstown', home:true,zh:'皇后镇',   en:'Queenstown', country:'新西兰',   countryEn:'New Zealand', flag:'🇳🇿', region:'oceania',
    lon:168.66, lat:-45.03, hotel:200, spend:140, relief:9,  prestige:5,
    descZh:'雪山湖泊，和全世界最疯的极限运动。', descEn:'Alpine lakes and the world capital of throwing yourself off things.' },
  { id:'fiji', fareMult:1.3,      zh:'斐济',     en:'Fiji',       country:'斐济',     countryEn:'Fiji',      flag:'🇫🇯', region:'oceania',
    lon:178.44, lat:-18.14, hotel:280, spend:120, relief:11, prestige:7,
    descZh:'礁湖、椰林，和完全停摆的时间。', descEn:'Lagoons, palms, and time that simply stops.' },
  { id:'bali',      zh:'巴厘岛',   en:'Bali',       country:'印度尼西亚', countryEn:'Indonesia', flag:'🇮🇩', region:'oceania',
    lon:115.19, lat:-8.41,  hotel:95,  spend:60,  relief:10, prestige:4,
    descZh:'便宜、热带、到处是别人的度假照片。', descEn:'Cheap, tropical, and all over everyone else’s holiday photos.' },
  // ── 亚洲 ────────────────────────────────────────────────
  { id:'singapore', home:true, zh:'新加坡',   en:'Singapore',  country:'新加坡',   countryEn:'Singapore', flag:'🇸🇬', region:'asia',
    lon:103.82, lat:1.35,   hotel:240, spend:150, relief:9,  prestige:6,
    descZh:'干净、高效、贵，一座被管理得很好的城市。', descEn:'Clean, efficient, expensive — a very well-run city.' },
  { id:'bangkok', home:true,   zh:'曼谷',     en:'Bangkok',    country:'泰国',     countryEn:'Thailand',  flag:'🇹🇭', region:'asia',
    lon:100.50, lat:13.76,  hotel:110, spend:65,  relief:10, prestige:5,
    descZh:'街边摊、寺庙和永不停歇的车流。', descEn:'Street food, temples, and traffic that never stops.' },
  { id:'tokyo', home:true,     zh:'东京',     en:'Tokyo',      country:'日本',     countryEn:'Japan',     flag:'🇯🇵', region:'asia',
    lon:139.69, lat:35.68,  hotel:220, spend:170, relief:11, prestige:10,
    descZh:'秩序与霓虹，细节讲究到偏执。', descEn:'Order and neon, detailed to the point of obsession.' },
  { id:'seoul', home:true,     zh:'首尔',     en:'Seoul',      country:'韩国',     countryEn:'South Korea', flag:'🇰🇷', region:'asia',
    lon:126.98, lat:37.57,  hotel:180, spend:140, relief:10, prestige:8,
    descZh:'凌晨三点依然亮着的城市。', descEn:'A city still lit at three in the morning.' },
  { id:'hongkong', home:true,  zh:'香港',     en:'Hong Kong',  country:'中国',     countryEn:'China',     flag:'🇭🇰', region:'asia',
    lon:114.17, lat:22.32,  hotel:250, spend:150, relief:9,  prestige:9,
    descZh:'维港夜景，和竖着长的城市。', descEn:'Victoria Harbour, and a city that grew upward.' },
  { id:'shanghai', home:true,  zh:'上海',     en:'Shanghai',   country:'中国',     countryEn:'China',     flag:'🇨🇳', region:'asia',
    lon:121.47, lat:31.23,  hotel:170, spend:120, relief:9,  prestige:8,
    descZh:'外滩两岸，一百年隔着一条江。', descEn:'The Bund: a century of history across one river.' },
  { id:'kathmandu', fareMult:1.25, zh:'加德满都', en:'Kathmandu',  country:'尼泊尔',   countryEn:'Nepal',     flag:'🇳🇵', region:'asia',
    lon:85.32,  lat:27.72,  hotel:80,  spend:55,  relief:14, prestige:14,
    descZh:'喜马拉雅的入口，海拔与心境一起升高。', descEn:'The gateway to the Himalaya; altitude and perspective rise together.' },
  // ── 中东 ────────────────────────────────────────────────
  { id:'dubaicity', home:true, zh:'迪拜',     en:'Dubai',      country:'阿联酋',   countryEn:'UAE',       flag:'🇦🇪', region:'mideast',
    lon:55.27,  lat:25.20,  hotel:300, spend:220, relief:10, prestige:12,
    descZh:'沙漠里长出来的摩天楼群。', descEn:'A skyline grown straight out of the desert.' },
  { id:'istanbul', home:true,  zh:'伊斯坦布尔', en:'Istanbul', country:'土耳其',   countryEn:'Türkiye',   flag:'🇹🇷', region:'mideast',
    lon:28.98,  lat:41.01,  hotel:150, spend:110, relief:12, prestige:11,
    descZh:'一座城横跨两个大洲。', descEn:'One city standing on two continents.' },
  // ── 欧洲 ────────────────────────────────────────────────
  { id:'london', home:true,    zh:'伦敦',     en:'London',     country:'英国',     countryEn:'United Kingdom', flag:'🇬🇧', region:'europe',
    lon:-0.13,  lat:51.51,  hotel:270, spend:200, relief:12, prestige:15,
    descZh:'雨、博物馆，和六百年的老钱。', descEn:'Rain, museums, and six centuries of old money.' },
  { id:'paris', home:true,     zh:'巴黎',     en:'Paris',      country:'法国',     countryEn:'France',    flag:'🇫🇷', region:'europe',
    lon:2.35,   lat:48.86,  hotel:290, spend:210, relief:13, prestige:16,
    descZh:'塞纳河、卢浮宫，以及被过度描写的浪漫。', descEn:'The Seine, the Louvre, and romance that has been over-written.' },
  { id:'rome', home:true,      zh:'罗马',     en:'Rome',       country:'意大利',   countryEn:'Italy',     flag:'🇮🇹', region:'europe',
    lon:12.50,  lat:41.90,  hotel:230, spend:170, relief:13, prestige:15,
    descZh:'走在两千年的石头上吃冰淇淋。', descEn:'Eating gelato on two thousand years of stone.' },
  { id:'santorini', zh:'圣托里尼', en:'Santorini',  country:'希腊',     countryEn:'Greece',    flag:'🇬🇷', region:'europe',
    lon:25.43,  lat:36.39,  hotel:340, spend:180, relief:15, prestige:18,
    descZh:'蓝顶白墙，和爱琴海的落日。', descEn:'Blue domes, white walls, and the Aegean at sunset.' },
  { id:'reykjavik', zh:'雷克雅未克', en:'Reykjavik', country:'冰岛',    countryEn:'Iceland',   flag:'🇮🇸', region:'europe',
    lon:-21.94, lat:64.15,  hotel:280, spend:200, relief:16, prestige:22,
    descZh:'火山、冰川，和运气好时的极光。', descEn:'Volcanoes, glaciers, and the aurora if you are lucky.' },
  { id:'zurich',    zh:'苏黎世',   en:'Zurich',     country:'瑞士',     countryEn:'Switzerland', flag:'🇨🇭', region:'europe',
    lon:8.54,   lat:47.37,  hotel:380, spend:260, relief:14, prestige:20,
    descZh:'阿尔卑斯山脚下最贵的一杯咖啡。', descEn:'The most expensive coffee at the foot of the Alps.' },
  // ── 非洲 ────────────────────────────────────────────────
  { id:'cairo',     zh:'开罗',     en:'Cairo',      country:'埃及',     countryEn:'Egypt',     flag:'🇪🇬', region:'africa',
    lon:31.24,  lat:30.04,  hotel:130, spend:90,  relief:13, prestige:16,
    descZh:'金字塔在城市的边上，一抬头就是四千年。', descEn:'The pyramids sit at the city’s edge; four thousand years, one glance.' },
  { id:'maasaimara', fareMult:1.6,zh:'马赛马拉', en:'Maasai Mara',country:'肯尼亚',   countryEn:'Kenya',     flag:'🇰🇪', region:'africa',
    lon:35.14,  lat:-1.49,  hotel:420, spend:200, relief:18, prestige:28,
    descZh:'角马迁徙的季节，草原上什么都可能发生。', descEn:'Migration season on the savannah, where anything can happen.' },
  { id:'capetown', home:true,  zh:'开普敦',   en:'Cape Town',  country:'南非',     countryEn:'South Africa', flag:'🇿🇦', region:'africa',
    lon:18.42,  lat:-33.92, hotel:190, spend:130, relief:14, prestige:18,
    descZh:'桌山下的两洋交汇处。', descEn:'Where two oceans meet under Table Mountain.' },
  // ── 北美 ────────────────────────────────────────────────
  { id:'newyork', home:true,   zh:'纽约',     en:'New York',   country:'美国',     countryEn:'United States', flag:'🇺🇸', region:'namerica',
    lon:-74.01, lat:40.71,  hotel:340, spend:240, relief:12, prestige:20,
    descZh:'永远不睡，也永远不等人。', descEn:'It never sleeps, and it never waits.' },
  { id:'losangeles', home:true,zh:'洛杉矶',   en:'Los Angeles',country:'美国',     countryEn:'United States', flag:'🇺🇸', region:'namerica',
    lon:-118.24,lat:34.05,  hotel:270, spend:200, relief:12, prestige:16,
    descZh:'阳光、公路，和一整座城市的野心。', descEn:'Sunshine, freeways, and a whole city of ambition.' },
  { id:'vancouver', home:true, zh:'温哥华',   en:'Vancouver',  country:'加拿大',   countryEn:'Canada',    flag:'🇨🇦', region:'namerica',
    lon:-123.12,lat:49.28,  hotel:230, spend:170, relief:14, prestige:15,
    descZh:'山和海挤在同一个取景框里。', descEn:'Mountains and ocean in the same frame.' },
  // ── 南美 ────────────────────────────────────────────────
  { id:'rio',       zh:'里约热内卢', en:'Rio de Janeiro', country:'巴西', countryEn:'Brazil',  flag:'🇧🇷', region:'samerica',
    lon:-43.17, lat:-22.91, hotel:170, spend:120, relief:15, prestige:20,
    descZh:'基督像下的海滩与鼓点。', descEn:'Beaches and drums beneath the outstretched arms.' },
  { id:'machu', fareMult:1.5,     zh:'马丘比丘', en:'Machu Picchu', country:'秘鲁',   countryEn:'Peru',      flag:'🇵🇪', region:'samerica',
    lon:-72.55, lat:-13.16, hotel:200, spend:140, relief:19, prestige:32,
    descZh:'云雾里的失落之城，走完印加古道才配看见。', descEn:'A lost city in the clouds — the Inca Trail earns you the view.' },
  { id:'patagonia', fareMult:1.5, zh:'巴塔哥尼亚', en:'Patagonia', country:'阿根廷',  countryEn:'Argentina', flag:'🇦🇷', region:'samerica',
    lon:-72.30, lat:-50.34, hotel:260, spend:160, relief:20, prestige:35,
    descZh:'世界尽头的风，能把人吹清醒。', descEn:'The wind at the end of the world will clear your head.' },
  { id:'mumbai',    zh:'孟买',     en:'Mumbai',     country:'印度',     countryEn:'India',     flag:'🇮🇳', region:'asia',
    lon:72.88,  lat:19.08,  hotel:120, spend:70,  relief:11, prestige:9, home:true,
    descZh:'一千八百万人挤在一起，机会和拥挤一样多。', descEn:'Eighteen million people; as much opportunity as congestion.' },
  { id:'berlin',    zh:'柏林',     en:'Berlin',     country:'德国',     countryEn:'Germany',   flag:'🇩🇪', region:'europe',
    lon:13.40,  lat:52.52,  hotel:200, spend:150, relief:12, prestige:13, home:true,
    descZh:'不漂亮，但真实、便宜、有意思。', descEn:'Not pretty — but honest, cheap and interesting.' },
  { id:'toronto',   zh:'多伦多',   en:'Toronto',    country:'加拿大',   countryEn:'Canada',    flag:'🇨🇦', region:'namerica',
    lon:-79.38, lat:43.65,  hotel:240, spend:180, relief:12, prestige:14, home:true,
    descZh:'北美最多元的城市，冬天很长。', descEn:'The most diverse city in North America, with a very long winter.' },
  { id:'saopaulo',  zh:'圣保罗',   en:'São Paulo',  country:'巴西',     countryEn:'Brazil',    flag:'🇧🇷', region:'samerica',
    lon:-46.63, lat:-23.55, hotel:150, spend:110, relief:11, prestige:12, home:true,
    descZh:'南半球最大的城市，没有尽头的钢筋森林。', descEn:'The largest city in the southern hemisphere, concrete without end.' },
  { id:'lagos',     zh:'拉各斯',   en:'Lagos',      country:'尼日利亚', countryEn:'Nigeria',   flag:'🇳🇬', region:'africa',
    lon:3.38,   lat:6.52,   hotel:140, spend:95,  relief:11, prestige:13, home:true,
    descZh:'非洲最有活力也最混乱的商业心脏。', descEn:'Africa’s most energetic and most chaotic commercial heart.' },
  // ── 极地 ────────────────────────────────────────────────
  { id:'antarctica', fareMult:9.0,zh:'南极洲',   en:'Antarctica', country:'南极',     countryEn:'Antarctica', flag:'🇦🇶', region:'polar',
    lon:-60.0,  lat:-64.0,  hotel:1_400, spend:400, relief:26, prestige:120, minNights:8,
    descZh:'破冰船、企鹅，和一片不属于任何国家的白。', descEn:'An icebreaker, penguins, and a whiteness that belongs to no country.' },
];

// 舱位与酒店档次
export const CABINS = [
  { id:'economy',  zh:'经济舱',  en:'Economy',   mult:1.0,  relief:1.0,  prestige:1.0 },
  { id:'premium',  zh:'豪华经济',en:'Premium',   mult:1.9,  relief:1.08, prestige:1.3 },
  { id:'business', zh:'商务舱',  en:'Business',  mult:3.6,  relief:1.18, prestige:1.8 },
  { id:'first',    zh:'头等舱',  en:'First',     mult:7.0,  relief:1.30, prestige:2.6 },
  { id:'jet',      zh:'私人飞机',en:'Private jet', mult:0,  relief:1.45, prestige:3.4, needJet:true },
];
export const HOTELS = [
  { id:'hostel', zh:'青旅 / 民宿', en:'Hostel',      mult:0.35, relief:0.75, prestige:0.6 },
  { id:'std',    zh:'三星酒店',    en:'Standard',    mult:1.0,  relief:1.0,  prestige:1.0 },
  { id:'lux',    zh:'五星酒店',    en:'Five-star',   mult:2.7,  relief:1.25, prestige:1.7 },
  { id:'resort', zh:'顶级度假村',  en:'Luxury resort',mult:6.2, relief:1.45, prestige:2.8 },
];

// 两点之间的大圆距离（公里）
export function distanceKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
export const HOMES_AVAILABLE = () => DESTINATIONS.filter(d => d.home);
// 某条航线的票价与时长（含偏远地区的交通溢价）
export function routeOf(home, dest) {
  const km = distanceKm(home, dest);
  const mult = dest.fareMult || 1;
  return { km, fare: Math.round(fareFor(km) * mult / 5) * 5, hours: flightHoursFor(km) * (dest.fareMult > 2 ? 1.6 : 1) };
}
export const DEST = Object.fromEntries(DESTINATIONS.map(d => [d.id, d]));
