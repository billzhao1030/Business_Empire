// 衣柜：买了能穿，穿了能看见。
//
// 每件衣服除了价格和声望，还带着画给你看的那几个数：
//   shape 剪影（决定画成什么形状）· col 主色 · col2 配色
// 人物界面按 底装 → 上装 → 外套 → 鞋 → 配饰 的顺序一层层画上去。
//
// style 用来判断这一身搭得配不配：整套同风格有加成，混搭要扣分——
// 西装配拖鞋，谁看了都别扭。

export const GENDERS = [
  { id:'m', zh:'男', en:'Male',   emoji:'👨' },
  { id:'f', zh:'女', en:'Female', emoji:'👩' },
  { id:'x', zh:'不透露', en:'Prefer not to say', emoji:'🧑' },
];

export const WEAR_SLOTS = [
  { id:'top',    zh:'上装', en:'Top',         emoji:'👕', order:2 },
  { id:'bottom', zh:'下装', en:'Bottoms',     emoji:'👖', order:1 },
  { id:'outer',  zh:'外套', en:'Outerwear',   emoji:'🧥', order:3 },
  { id:'shoes',  zh:'鞋',   en:'Shoes',       emoji:'👟', order:4 },
  { id:'acc',    zh:'配饰', en:'Accessories', emoji:'🕶️', order:5 },
];

export const STYLES = [
  { id:'street', zh:'街头',   en:'Street',   emoji:'🧢' },
  { id:'casual', zh:'休闲',   en:'Casual',   emoji:'🙂' },
  { id:'smart',  zh:'商务',   en:'Business', emoji:'💼' },
  { id:'luxe',   zh:'奢侈',   en:'Luxury',   emoji:'💎' },
  { id:'sport',  zh:'运动',   en:'Sport',    emoji:'🏃' },
];

// [id, 中文, English, emoji, slot, style, 价格, 声望, shape, 主色, 配色, 中文描述, English]
const W = [
// ── 上装 ────────────────────────────────────────────────────
['t_plain','白 T 恤','Plain Tee','👕','top','casual',12,0,'tee','#e8e8ea','#cfcfd4','三件装里的一件，洗到发黄也还能穿。','One of a three-pack. Still wearable long after it yellows.'],
['t_stripe','条纹 T 恤','Striped Tee','👕','top','casual',26,0,'tee','#dfe7f2','#4a6fa5','横条纹，永远不会出错。','Breton stripes never go wrong.'],
['t_band','乐队 T 恤','Band Tee','🤘','top','street',45,1,'tee','#2a2a2e','#c0392b','正版，不是夜市那种。','The real one, not the night-market print.'],
['t_polo','Polo 衫','Polo Shirt','👕','top','casual',70,1,'polo','#3f6f5f','#e8e8ea','周末球场和周一办公室都能穿。','Works on a Saturday course and a Monday floor.'],
['t_flannel','法兰绒衬衫','Flannel Shirt','🪵','top','casual',85,1,'shirt','#8c4a3f','#3a2a26','软到像穿着一床被子。','Soft enough to be bedding.'],
['t_oxford','牛津纺衬衫','Oxford Shirt','👔','top','smart',120,2,'shirt','#dfe6f0','#b9c6d8','扣领，笔挺，配什么都体面。','Button-down, pressed, defensible with anything.'],
['t_hoodie','连帽卫衣','Hoodie','🧢','top','street',95,1,'hoodie','#4a4a52','#2e2e34','程序员的正装。','The engineer’s formalwear.'],
['t_turtle','高领针织衫','Turtleneck','🧶','top','smart',210,3,'knit','#1e1e22','#3a3a42','黑色高领，一穿就像要发布点什么。','Black turtleneck. You look ready to announce something.'],
['t_silk','真丝衬衫','Silk Blouse','🎀','top','luxe',480,6,'shirt','#f0e2e6','#d9b8c4','贵在手感，别人一摸就知道。','The cost is in the hand-feel, and people can tell.'],
['t_dress_shirt','法式袖扣衬衫','French-Cuff Shirt','💠','top','smart',360,5,'shirt','#ffffff','#c9d4e4','要配袖扣，也就必须记得戴袖扣。','Needs cufflinks, so now you must remember cufflinks.'],
['t_jersey','球队球衣','Team Jersey','⚽','top','sport',130,1,'tee','#1a4f9c','#f0c419','背后印着别人的名字，你不介意。','Someone else’s name on the back. You do not mind.'],
['t_tank','运动背心','Training Tank','🏋️','top','sport',38,0,'tank','#2e2e34','#7ed957','健身房里唯一诚实的衣服。','The only honest garment in the gym.'],
['t_cashmere','羊绒衫','Cashmere Sweater','🐐','top','luxe',890,9,'knit','#cdbba4','#a8907a','轻得不像话，暖得也不像话。','Absurdly light, absurdly warm.'],
['t_couture','高定礼服上身','Couture Bodice','👗','top','luxe',9_500,34,'gown','#7d1f3d','#e0c068','有人量了你二十七个尺寸。','Someone took twenty-seven measurements.'],
['t_polo_lux','马球会 Polo','Polo Club Shirt','🏇','top','luxe',620,8,'polo','#f2f0ea','#1f4d3f','胸口的小马是真的马球会的。','The little horse is an actual club crest.'],
['t_workshirt','工装衬衫','Work Shirt','🔧','top','street',54,0,'shirt','#4a5a6a','#2e3a46','口袋能装下扳手，也能装下野心。','The pocket fits a wrench, and an ambition.'],
// ── 下装 ────────────────────────────────────────────────────
['b_jeans','牛仔裤','Jeans','👖','bottom','casual',60,0,'pants','#3b5578','#2a3d57','一条穿五年，越穿越合身。','Five years in and it fits better every year.'],
['b_jeans_raw','原色丹宁','Raw Denim','🪡','bottom','street',260,3,'pants','#22304a','#16223a','半年不洗，只为了那条褪色纹。','Six months unwashed, purely for the fades.'],
['b_chino','休闲卡其裤','Chinos','🧵','bottom','casual',85,1,'pants','#c2ab86','#a08e6e','什么场合都不会太错的那条。','The pair that is never quite wrong.'],
['b_slacks','西裤','Dress Trousers','👔','bottom','smart',180,2,'pants','#2b2f38','#1c1f26','有褶线的裤子，走路都不一样。','Creased. You walk differently in them.'],
['b_shorts','工装短裤','Cargo Shorts','🩳','bottom','casual',42,0,'shorts','#7a7a5e','#5c5c46','口袋多到自己都忘了放过什么。','More pockets than you can account for.'],
['b_track','运动束脚裤','Track Pants','🏃','bottom','sport',75,1,'pants','#26262c','#7ed957','从沙发到跑道，中间不用换。','Sofa to track, no change required.'],
['b_skirt','百褶裙','Pleated Skirt','👗','bottom','casual',95,1,'skirt','#3a4a6a','#26324a','走起来会说话的那种褶。','Pleats that talk when you walk.'],
['b_pencil','铅笔裙','Pencil Skirt','📐','bottom','smart',210,3,'skirt','#22222a','#3a3a44','剪裁利落，开会不怒自威。','Sharp enough to chair a meeting.'],
['b_wool','羊毛西裤','Wool Trousers','🐑','bottom','smart',420,5,'pants','#3a3f4a','#242830','冬天的西裤是另一种东西。','Winter trousers are a different animal.'],
['b_leather','皮裤','Leather Trousers','🖤','bottom','street',780,7,'pants','#1a1a1e','#0e0e12','穿上去要有底气，不然就是笑话。','Wear them with conviction or not at all.'],
['b_couture','高定长裙','Couture Skirt','✨','bottom','luxe',7_800,28,'gown','#7d1f3d','#e0c068','裙摆铺开要占半张沙发。','The train takes up half a sofa.'],
['b_gym','紧身训练裤','Training Tights','🦵','bottom','sport',68,0,'pants','#1e1e24','#4aa3df','该藏的藏不住，该露的都露。','It hides nothing and admits everything.'],
// ── 外套 ────────────────────────────────────────────────────
['o_denim','牛仔外套','Denim Jacket','🧥','outer','casual',140,1,'jacket','#4a6a94','#35507a','越旧越好看的少数几件之一。','One of the few things improved by age.'],
['o_bomber','飞行夹克','Bomber Jacket','✈️','outer','street',320,3,'jacket','#2e3a2e','#c8641e','橙色内衬是它的全部灵魂。','The orange lining is the whole point.'],
['o_leather','机车皮衣','Leather Jacket','🏍️','outer','street',890,8,'jacket','#1c1c20','#8a6a3a','肩上那块皮会记住你的形状。','The shoulders learn your shape.'],
['o_blazer','单排扣西装外套','Blazer','💼','outer','smart',560,7,'blazer','#2a3240','#1a2029','一件好西装，是能穿十年的投资。','A good jacket is a ten-year investment.'],
['o_suit','定制西装','Bespoke Suit','🕴️','outer','smart',3_200,22,'blazer','#22262e','#4a5464','量体、试身、再改三次，才到你手上。','Measured, fitted, and altered three times before you see it.'],
['o_trench','风衣','Trench Coat','🌧️','outer','smart',780,9,'coat','#c2ab86','#9c8a68','下雨天唯一让人显得从容的东西。','The one thing that makes rain look composed.'],
['o_puffer','羽绒服','Puffer Jacket','🧊','outer','casual',260,2,'coat','#2c3a52','#1e2a3e','难看，但零下十度谁在乎。','Ugly, but at minus ten nobody cares.'],
['o_overcoat','羊绒大衣','Cashmere Overcoat','🎩','outer','luxe',4_600,26,'coat','#4a4a44','#33332e','走进任何一个房间都不用先说话。','You do not have to speak first in any room.'],
['o_windbreak','跑步风衣','Running Shell','🏃','outer','sport',180,2,'jacket','#1a1a20','#7ed957','薄得能塞进拳头里。','Packs into a fist.'],
['o_tux','燕尾礼服','Tuxedo','🎭','outer','luxe',6_800,32,'blazer','#101014','#e8e0c8','一年穿两次，两次都值得。','Worn twice a year, and both times it earns its keep.'],
['o_varsity','棒球外套','Varsity Jacket','🅱️','outer','street',290,3,'jacket','#1a2a4a','#e8d8b8','袖子是皮的，这很重要。','The sleeves are leather. This matters.'],
// ── 鞋 ──────────────────────────────────────────────────────
['s_flipflop','人字拖','Flip-Flops','🩴','shoes','casual',6,0,'flat','#3a3a42','#6a6a74','$6，穿三年，最划算的一双。','Six dollars, three years. Best value here.'],
['s_canvas','帆布鞋','Canvas Sneakers','👟','shoes','casual',48,0,'sneak','#e8e8ea','#c4c4ca','脏了就洗，洗白了更好看。','Wash them; they look better faded.'],
['s_runner','跑鞋','Running Shoes','🏃','shoes','sport',140,1,'sneak','#1e1e24','#7ed957','买的时候都说要天天跑。','Bought with the best intentions.'],
['s_hype','限量球鞋','Hyped Sneakers','🔥','shoes','street',680,7,'sneak','#f0f0f2','#e8443a','抽签抽到的，转手能赚一倍。','Won in a raffle. Worth double on resale.'],
['s_boot','工装靴','Work Boots','🥾','shoes','street',220,2,'boot','#6a4a2e','#4a3220','鞋底能踩过任何一个工地。','The sole has been across every site.'],
['s_chelsea','切尔西靴','Chelsea Boots','👢','shoes','smart',420,4,'boot','#2a1e1a','#1a1210','没有鞋带，也不需要。','No laces, and none needed.'],
['s_loafer','乐福鞋','Loafers','🥿','shoes','smart',360,4,'flat','#4a2e22','#33201a','不穿袜子才是正确答案。','No socks is the correct answer.'],
['s_oxford','牛津皮鞋','Oxford Shoes','👞','shoes','smart',540,6,'flat','#26161a','#1a0e10','擦亮它，是一种自我要求。','Polishing them is a discipline.'],
['s_heels','高跟鞋','Heels','👠','shoes','smart',380,5,'heel','#8a1a2e','#6a1222','好看和舒服，只能选一个。','You may choose beauty or comfort.'],
['s_bespoke','手工定制皮鞋','Bespoke Shoes','🪡','shoes','luxe',5_200,24,'flat','#3a2018','#26120e','鞋楦按你的脚做的，只此一双。','A last carved to your foot, and only yours.'],
['s_stiletto','红底高跟','Red-Sole Heels','❤️','shoes','luxe',1_400,14,'heel','#1a1a1e','#d8232f','走过去的时候大家都会低头看。','People look down as you pass.'],
['s_trail','越野跑鞋','Trail Runners','⛰️','shoes','sport',260,2,'sneak','#3a4a2e','#e8a020','为了不在山上崴脚。','So the mountain does not take your ankle.'],
// ── 配饰 ────────────────────────────────────────────────────
['a_cap','棒球帽','Baseball Cap','🧢','acc','street',28,0,'cap','#26262c','#e8443a','头发没洗的通用解法。','The universal answer to unwashed hair.'],
['a_beanie','毛线帽','Beanie','🧶','acc','casual',35,0,'cap','#4a3a52','#33283a','冬天的第二层头皮。','A second scalp for winter.'],
['a_glasses','黑框眼镜','Black-Frame Glasses','👓','acc','casual',180,1,'glass','#1a1a1e','#3a3a44','度数是真的，别人以为是装的。','The prescription is real; everyone assumes otherwise.'],
['a_shades','太阳镜','Sunglasses','🕶️','acc','casual',120,1,'glass','#26262c','#4a4a54','阴天也戴，那才叫态度。','Worn on cloudy days. That is the attitude.'],
['a_shades_lux','意大利手作墨镜','Handmade Sunglasses','🌞','acc','luxe',760,9,'glass','#2a1a10','#c8a060','醋酸纤维板材，一副磨三天。','Acetate, three days on a single pair.'],
['a_scarf','羊绒围巾','Cashmere Scarf','🧣','acc','luxe',480,6,'scarf','#8a2a3a','#6a1e2c','系法有七种，你只会一种。','Seven ways to tie it. You know one.'],
['a_tie','真丝领带','Silk Tie','👔','acc','smart',160,2,'tie','#2a3a6a','#c8a060','酒窝打得好不好，行家一眼看穿。','A good dimple is noticed by people who notice.'],
['a_bowtie','手打领结','Hand-Tied Bow Tie','🎀','acc','luxe',260,4,'tie','#1a1a1e','#e8e8ea','夹式的不算。','Clip-ons do not count.'],
['a_belt','皮带','Leather Belt','🪢','acc','smart',140,1,'belt','#2e1e16','#c8a060','和鞋同色，是最低要求。','Matching the shoes is the minimum.'],
['a_backpack','双肩包','Backpack','🎒','acc','street',210,1,'bag','#2a2a32','#4a4a56','装得下电脑和一整天。','Holds a laptop and an entire day.'],
['a_tote','帆布托特包','Canvas Tote','👜','acc','casual',65,0,'bag','#d8cdb8','#a89878','书店送的那只，用得最久。','The one the bookshop gave away. It outlasted everything.'],
['a_briefcase','公文包','Briefcase','💼','acc','smart',680,7,'bag','#3a2418','#1f1410','里面装的东西比包贵。','What is inside costs more than the case.'],
['a_handbag','设计师手袋','Designer Handbag','👛','acc','luxe',12_000,42,'bag','#7d1f2e','#e0c068','排队两年才买到，还要看店员脸色。','Two years on a list, and you still had to be charming.'],
['a_gloves','小羊皮手套','Kidskin Gloves','🧤','acc','luxe',390,5,'glove','#3a2a22','#5a4436','薄到能感觉到硬币的花纹。','Thin enough to feel the milling on a coin.'],
['a_chain','金链','Gold Chain','⛓️','acc','street',1_800,13,'chain','#e0c068','#c8a850','分量要够，不然不如不戴。','It has to have weight or it is nothing.'],
['a_umbrella','手工长柄伞','Handmade Umbrella','☂️','acc','luxe',420,5,'stick','#1a2a3a','#c8a060','伞骨是木的，用一辈子。','Wooden ribs. It outlives the weather.'],
];

export const WEARABLES = W.map(([id,name,en,emoji,slot,style,price,prestige,shape,col,col2,desc,descEn]) =>
  ({ id, name, en, emoji, cat: slot, slot, style, price, prestige, shape, col, col2, desc, descEn,
     upkeep: 0, drift: -0.02, wearable: true }));

// 一整套搭得配不配：同风格越多越好看，风格越杂越难看
export function outfitScore(pieces) {
  const worn = pieces.filter(Boolean);
  if (!worn.length) return { score: 0, style: null, coherence: 0, prestige: 0, bonus: 0 };
  const count = {};
  for (const w of worn) count[w.style] = (count[w.style] || 0) + 1;
  const [topStyle, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const coherence = n / worn.length;                       // 主风格占比
  const prestige = worn.reduce((a, w) => a + (w.prestige || 0), 0);
  // 齐整度：五个格子填满才算一身完整的衣服
  const filled = worn.length / WEAR_SLOTS.length;
  const bonus = prestige * (0.55 + 0.75 * coherence) * (0.5 + 0.5 * filled);
  return { score: Math.round(bonus), style: topStyle, coherence, prestige, filled, worn: worn.length };
}
