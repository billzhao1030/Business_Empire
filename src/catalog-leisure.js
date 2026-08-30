// 消遣：钱能买回来的松弛。
//
// 每一项都实打实占掉你的游戏时间——这段时间不能上班，也不能加班。
// 花钱买的是压力下降和体力恢复，有些还顺带涨见识（经验）或者涨面子（声望）。
// 便宜的项目效率不低，只是上限低；贵的项目一次能压下去很多，但钱包也知道。
//
// relief 压力下降 · stamina 体力变化 · exp 工作经验 · prestige 声望
// hours  占用的游戏小时 · cost 花费 · cool 冷却（同一项多久能再来一次）

export const LEISURE_CATS = [
  { id:'sport',   zh:'体育运动', en:'Sport',        emoji:'⚽' },
  { id:'screen',  zh:'看点什么', en:'Screens',      emoji:'🎬' },
  { id:'culture', zh:'文化艺术', en:'Culture',      emoji:'🎭' },
  { id:'social',  zh:'social',   en:'Going Out',    emoji:'🍻' },
  { id:'outdoor', zh:'户外自然', en:'Outdoors',     emoji:'⛰️' },
  { id:'home',    zh:'居家',     en:'At Home',      emoji:'🛋️' },
  { id:'learn',   zh:'学点东西', en:'Learning',     emoji:'📖' },
  { id:'thrill',  zh:'刺激',     en:'Thrills',      emoji:'🎢' },
  { id:'care',    zh:'照顾自己', en:'Self-care',    emoji:'🧖' },
  { id:'gamble',  zh:'博彩',     en:'Games of Chance', emoji:'🎰' },
];

// [id, 中文, English, emoji, 分类, 花费, 占用小时, 压力↓, 体力, 经验, 声望, 中文, English]
const A = [
// ── 体育运动 ────────────────────────────────────────────────
['jog','夜跑','Evening Run','🏃','sport',0,1,4,4,0,0,'一双鞋和一条路，最便宜的解药。','A pair of shoes and a road. The cheapest cure there is.'],
['pushup','在家撸铁','Home Workout','💪','sport',0,1,3,5,0,0,'客厅地板加一条瑜伽垫，没有借口。','Living-room floor and a mat. No excuses left.'],
['swim','游泳','Swimming','🏊','sport',12,2,8,6,0,0,'水里什么都听不见，包括你自己的念头。','Underwater you hear nothing, including yourself.'],
['basketball','打球','Pickup Basketball','🏀','sport',0,2,9,-2,0,0,'球场上没人问你月收入。','Nobody on the court asks what you earn.'],
['badminton','羽毛球','Badminton','🏸','sport',18,2,8,-1,0,0,'看着轻松，第二天腿是酸的。','Looks gentle. Your legs disagree tomorrow.'],
['gymday','健身房','Gym Session','🏋️','sport',25,2,7,7,0,0,'撸完铁的那半小时，什么事都想通了。','For half an hour afterwards, everything makes sense.'],
['yoga','瑜伽课','Yoga Class','🧘','sport',30,2,12,4,0,1,'一小时不看手机，本身就值这个钱。','An hour without a phone is worth the fee by itself.'],
['climbing','攀岩','Bouldering','🧗','sport',35,3,14,2,0,1,'手指记得每一块岩点。','Your fingers remember every hold.'],
['boxing','拳击课','Boxing Class','🥊','sport',45,2,16,3,0,1,'打沙袋比打人便宜，也比忍着强。','Cheaper than a fight and better than swallowing it.'],
['tennis','网球','Tennis','🎾','sport',60,3,13,1,0,3,'俱乐部里谈成的生意比球场上多。','More deals close in the clubhouse than on the court.'],
['surf','冲浪','Surfing','🏄','sport',80,4,22,0,0,3,'等浪的时候，人是空的。','Waiting for the set, your head is empty.'],
['golfday','打高尔夫','A Round of Golf','⛳','sport',180,5,18,-3,0,8,'四个小时，只有你们四个人和一片草。','Four hours, four people and a lot of grass.'],
['ski','滑雪周末','Ski Weekend','🎿','sport',900,20,45,-6,0,14,'从山顶往下的那一刻，什么都不用想。','From the top there is nothing left to think about.'],
['dive','潜水','Scuba Diving','🤿','sport',420,8,34,-2,0,10,'三十米以下，世界只剩呼吸声。','Below thirty metres the world is just breathing.'],
['sail','帆船出海','Sailing','⛵','sport',350,7,30,-2,0,11,'风怎么来，你就怎么走。','You go where the wind allows.'],
// ── 看点什么 ────────────────────────────────────────────────
['stream','刷剧','Streaming Binge','📺','screen',5,3,7,-1,0,0,'说好看一集，天亮了。','One episode, you said. Then it was morning.'],
['cinema','看电影','A Film','🎬','screen',22,3,12,0,0,0,'黑下来的那两个小时，是完全属于你的。','Two hours in the dark that belong entirely to you.'],
['imax','IMAX 大片','IMAX Blockbuster','🍿','screen',38,3,15,0,0,1,'座椅跟着爆炸一起震，值回票价。','The seat shakes with the explosions. Worth it.'],
['gaming','打游戏','Gaming Night','🎮','screen',0,3,9,-3,0,0,'再一把，就一把。','One more game. Just one.'],
['esports','看电竞决赛','Esports Final','🕹️','screen',65,4,14,-1,0,2,'现场比屏幕上吵一百倍。','A hundred times louder than the stream.'],
['filmfest','电影节','Film Festival','🎞️','screen',180,10,26,-2,0,9,'看六部片，其中两部你根本没看懂。','Six films, two of which you did not understand at all.'],
// ── 文化艺术 ────────────────────────────────────────────────
['museum','逛博物馆','Museum','🏛️','culture',18,3,11,-1,1,2,'走三个小时，记住三件东西。','Three hours of walking, three things remembered.'],
['gallery','看画展','Gallery Opening','🖼️','culture',30,3,12,-1,1,4,'酒是免费的，画不是。','The wine is free. The paintings are not.'],
['concert','音乐会','Concert','🎻','culture',95,4,20,-1,0,6,'第一个音符响起来的时候，肩膀会自己放下去。','Your shoulders drop on the first note.'],
['gig','livehouse','Live Gig','🎸','culture',55,4,18,-3,0,3,'站两小时，耳朵响一晚上。','Two hours standing, and a night of ringing.'],
['opera','歌剧','Opera','🎭','culture',260,5,24,-2,0,14,'听不懂也没关系，那身衣服值回票价。','You need not follow it. The outfit alone earns its keep.'],
['ballet','芭蕾','Ballet','🩰','culture',180,4,21,-1,0,11,'人可以做到那个样子，本身就很难得。','That a body can do that at all is the point.'],
['pottery','陶艺课','Pottery Class','🏺','culture',48,3,16,0,1,1,'做坏了七个，第八个还行。','Seven failures and one that will do.'],
['painting','油画班','Painting Class','🎨','culture',60,3,17,0,1,2,'画得不好没关系，那三小时是真的。','It need not be good. The three hours were real.'],
['calligraphy','写字','Calligraphy','🖌️','culture',25,2,14,0,1,2,'一笔下去不能改，人自然就静了。','A stroke cannot be undone, so you slow down.'],
['photo','扫街拍照','Street Photography','📷','culture',0,3,10,-1,1,1,'背着相机走路，看到的东西不一样。','You see differently with a camera on your shoulder.'],
// ── social ──────────────────────────────────────────────────
['coffee','和朋友喝咖啡','Coffee with a Friend','☕','social',9,1,7,0,0,0,'一杯咖啡换来的话，比什么都值钱。','What gets said over a coffee is worth more than the coffee.'],
['dinner','和朋友吃饭','Dinner Out','🍽️','social',55,3,15,1,0,2,'饭吃到一半，正事才开始说。','The real conversation starts halfway through.'],
['pub','酒吧小酌','A Few Drinks','🍺','social',45,4,16,-4,0,1,'第二天有点后悔，当时是真开心。','Some regret in the morning. Genuine joy at the time.'],
['karaokenight','KTV 通宵','All-night Karaoke','🎤','social',120,7,22,-8,0,1,'嗓子哑了，压力也跟着哑了。','Your voice goes, and so does the tension.'],
['bbq','朋友聚会烧烤','Backyard BBQ','🍖','social',80,5,20,0,0,2,'院子、炭火、和一群不用解释的人。','A yard, some coals, and people you do not have to explain yourself to.'],
['wedding','参加婚礼','A Wedding','💒','social',200,8,18,-3,0,6,'份子钱是压力，看到他们笑又不是了。','The gift envelope stings until you see them.'],
['gala','慈善晚宴','Charity Gala','🥂','social',2_500,6,26,-2,0,38,'捐的是钱，换的是那张桌子上的人脉。','You donate money and acquire a table of people.'],
['club','夜店','A Night Out','🕺','social',260,6,20,-9,0,5,'音乐大到听不见任何烦恼。','Loud enough to drown anything.'],
['boardgame','桌游局','Board Game Night','🎲','social',20,4,14,-1,0,0,'四个小时，撕破三次脸，还是朋友。','Four hours, three fallings-out, still friends.'],
// ── 户外自然 ────────────────────────────────────────────────
['walkpark','公园散步','A Walk in the Park','🌳','outdoor',0,1,5,1,0,0,'什么都不做，就是走走。','Doing nothing, just walking.'],
['picnic','野餐','Picnic','🧺','outdoor',30,4,16,2,0,1,'草地、面包、和一整个下午。','Grass, bread, and an entire afternoon.'],
['hike','徒步','Day Hike','🥾','outdoor',15,6,24,-4,0,2,'上山的时候骂自己，下山的时候想再来一次。','You curse on the way up and plan the next one on the way down.'],
['camp','露营','Camping','🏕️','outdoor',120,20,38,-2,0,4,'没有信号的一晚，抵得过一周的觉。','One night without signal is worth a week of sleep.'],
['fishing','钓鱼','Fishing','🎣','outdoor',40,6,26,2,0,1,'钓不到也无所谓，重点从来不是鱼。','Catching nothing is fine. It was never about the fish.'],
['garden','侍弄花草','Gardening','🪴','outdoor',25,2,12,1,0,0,'手上沾了土，脑子就清了。','Dirt on your hands clears your head.'],
['stargaze','看星星','Stargazing','🔭','outdoor',35,4,22,0,1,1,'开车两小时出城，才看得见。','Two hours out of the city before you can see any.'],
['roadtrip','公路旅行','Road Trip','🛣️','outdoor',260,24,42,-3,0,6,'目的地不重要，油箱和歌单才重要。','The destination is irrelevant. The tank and the playlist are not.'],
['hotspring','泡温泉','Hot Springs','♨️','outdoor',150,6,32,4,0,3,'热水里泡到手指发皱，值。','Until your fingers wrinkle. Worth it.'],
// ── 居家 ────────────────────────────────────────────────────
['nap','补个觉','A Long Nap','😴','home',0,2,8,9,0,0,'什么都解决不了，但先睡一觉。','It solves nothing. Sleep first anyway.'],
['read','读小说','Reading','📕','home',15,3,13,1,1,1,'翻页的声音是这个世界上最好的白噪音。','Turning pages is the best white noise there is.'],
['cookfun','认真做一顿饭','Cooking Properly','🍳','home',35,3,14,3,0,0,'不是为了吃饱，是为了那个过程。','Not to be fed. For the doing of it.'],
['bath','泡个澡','A Long Bath','🛁','home',8,2,11,3,0,0,'水温刚好的那二十分钟。','Twenty minutes at exactly the right temperature.'],
['music','听整张专辑','A Whole Album','🎧','home',0,2,9,0,0,0,'从头到尾，不跳曲。','Start to finish. No skipping.'],
['tidy','把家收拾一遍','Deep Clean','🧹','home',20,3,10,-2,0,0,'屋子干净了，人也松了。','A clean flat is a looser person.'],
['pet','陪宠物','Time with the Dog','🐕','home',12,2,15,2,0,0,'它不在乎你今天赚了多少。','It does not care what you earned today.'],
['journal','写日记','Writing it Down','✍️','home',0,1,8,0,1,0,'写下来的烦恼，会小一号。','A worry written down is a size smaller.'],
// ── 学点东西 ────────────────────────────────────────────────
['podcastwalk','边走边听播客','Podcast Walk','🎙️','learn',0,2,7,2,2,0,'走一小时，顺便懂了一点新东西。','An hour of walking and a little more understanding.'],
['course','上一门网课','Online Course','💻','learn',80,4,4,-2,10,1,'枯燥，但简历上会多一行。','Dull, and one more line on the résumé.'],
['language','学语言','Language Class','🗣️','learn',120,4,6,-1,12,3,'第一句能听懂的那天，值回全部学费。','The day you understand a whole sentence, it has paid for itself.'],
['workshop','行业工作坊','Industry Workshop','🛠️','learn',260,6,5,-2,18,7,'讲的东西一半没用，认识的人有用。','Half the content is useless. The people are not.'],
['mba','高管研修班','Executive Programme','🎓','learn',6_500,40,10,-6,90,42,'学费贵得离谱，同学名单值这个价。','The fee is absurd. The classmate list is not.'],
['coding','学写代码','Learning to Code','⌨️','learn',40,4,2,-3,14,1,'第一个跑通的程序，比什么都上头。','Nothing beats the first program that runs.'],
['reading_biz','读商业书','Business Reading','📚','learn',28,3,6,0,7,1,'十本里有一本真有东西。','One in ten actually contains something.'],
// ── 刺激 ────────────────────────────────────────────────────
['themeparkday','游乐园','Theme Park','🎢','thrill',110,8,26,-5,0,2,'排两小时队，坐两分钟，还是想再来。','Two hours queuing, two minutes riding, and you queue again.'],
['karting','卡丁车','Go-Karting','🏎️','thrill',75,3,20,-2,0,1,'离地十公分，感觉像两百码。','Ten centimetres off the ground and it feels like two hundred.'],
['skydive','跳伞','Skydiving','🪂','thrill',420,6,44,-6,0,16,'门开的那一秒，什么烦恼都记不起来。','The second the door opens you cannot recall a single worry.'],
['bungee','蹦极','Bungee Jump','🌉','thrill',180,4,36,-5,0,9,'跳下去之前想了一百遍，跳完只想再来。','A hundred second thoughts, then only one.'],
['track','赛道日','Track Day','🏁','thrill',900,8,38,-4,0,20,'把自己的车开到极限，合法的那种。','Your own car at its limit, legally.'],
['heli','直升机观光','Helicopter Tour','🚁','thrill',1_200,4,32,-1,0,26,'从上面看，你的城市小得很。','From up there your city is very small.'],
['balloon_ride','热气球','Hot-Air Balloon','🎈','thrill',380,5,34,0,0,12,'日出的时候升空，安静得吓人。','You rise at sunrise into an alarming quiet.'],
// ── 照顾自己 ────────────────────────────────────────────────
['massage','按摩','Massage','💆','care',70,2,20,4,0,1,'肩膀那块硬了半年的地方，被按开了。','The knot that had been there six months, gone.'],
['spa_day','水疗一天','Spa Day','🧖','care',280,7,38,8,0,5,'一整天不看手机，也没人找得到你。','A whole day unreachable, and nobody minds.'],
['barber_trip','理发','A Haircut','💈','care',45,1,10,1,0,2,'剪完头发，人是新的。','You walk out a slightly newer person.'],
['therapy','心理咨询','Therapy','🛋️','care',180,2,30,0,2,0,'花钱请人听你说话，这钱花得最值。','Paying someone to listen is the best money here.'],
['acupuncture','针灸','Acupuncture','🪡','care',90,2,22,3,0,0,'扎完躺半小时，整个人是软的。','Half an hour afterwards you are made of dough.'],
['retreat','静修营','Silent Retreat','🕯️','care',1_400,72,70,10,3,8,'三天不说话，回来像换了个人。','Three days without speaking. You come back different.'],
['sleepin','睡到自然醒','Sleeping In','🌤️','care',0,4,16,14,0,0,'没有闹钟的早晨，是奢侈品。','A morning without an alarm is a luxury good.'],
];

export const LEISURE = A.map(([id,name,en,emoji,cat,cost,hours,relief,stamina,exp,prestige,desc,descEn]) =>
  ({ id, name, en, emoji, cat, cost, hours, relief, stamina, exp, prestige, desc, descEn,
     // 同一项做完要隔一阵才有同样的效果——连着看三场电影，第三场就没意思了
     cool: Math.max(6, Math.round(hours * 3)) }));

export const LEISURE_BY_CAT = LEISURE_CATS.map(c => ({ ...c, items: LEISURE.filter(a => a.cat === c.id) }));
// 重复做同一项，效果递减：第一次满效，之后按这个比例往下掉，冷却过了回满
export const REPEAT_DECAY = 0.55;
