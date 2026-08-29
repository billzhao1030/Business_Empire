// 生成 src/catalog-rivals-gen.js —— 给每一家上市公司配上大股东
//
// 手写的 40 位是招牌（马斯特、贝索夫、巴菲仕…），保持不变。
// 其余 165 家公司各自生成 1~2 位创始人 / 家族股东，名字由中英文姓名池拼出来，
// 都带谐音的味道但不指向任何真人。这样每一支股票背后都有人，
// 玩家买它的股份、收购它、或者在同一个赛道上把它挤下去，才有人会掉名次。
import { writeFileSync } from 'node:fs';
import { STOCKS } from '../src/catalog-assets.js';
import { RIVALS } from '../src/catalog-content.js';

const SUR_ZH = ['陈','林','黄','王','李','张','刘','周','吴','徐','孙','马','朱','胡','郭','何','高','罗','郑','梁',
  '谢','宋','唐','许','邓','冯','韩','曹','曾','彭','萧','蔡','潘','田','董','袁','于','余','叶','蒋'];
const GIV_ZH = ['志远','怀安','若海','明轩','宗盛','家豪','景行','ನ'.replace('ನ','子谦'),'启帆','承业','敬之','守拙','长风','known'.replace('known','definitely').replace('definitely','立诚'),
  '思齐','慕白','行舟','未名','秉文','向晚','照临','逸群','怀瑾','致远','惟一','观澜','慎独','敏行','鹤鸣','斯年'];
const SUR_EN = ['Harding','Mercer','Whitlock','Ashford','Calloway','Prescott','Ravenhill','Sterling','Ashby','Locke',
  'Fairweather','Brandt','Kessler','Vantorre','Dunmore','Halloway','Quinn','Rothbury','Sandoval','Okonjo',
  'Tanaka','Berglund','Novak','Ferreira','Alvarado','Kowalski','Nakamura','Idris','Moreau','Petrova',
  'Haruki','Solberg','Castellan','Ibarra','Whitfield','Ekstrom','Dorsey','Lindqvist','Achebe','Marchetti'];
const GIV_EN = ['Adrian','Marta','Ivo','Celeste','Rowan','Ingrid','Desmond','Yara','Felix','Nadia',
  'Theo','Beatrix','Amos','Lena','Casper','Priya','Owen','Sonia','Elias','Mira',
  'Hugo','Anouk','Rafael','Iris','Milo','Zara','Anton','Freya','Kofi','Dagny'];
const EMOJI = ['🎩','🕶️','🧣','⛵','🏇','🍷','🎻','🗿','🪙','🧭','🎯','🪄','🛞','🧊','🪞','🔭','🎬','🧬','⚙️','🧱',
  '🪟','🛰️','🧪','📐','🗝️','🎺','🪝','🧰','🪧','🛎️'];

// 两种写法：一种是头衔（填进「X 的 ○○」），一种是描述（填进「X 的大股东，○○」）
const TITLES = [
  ['创始人兼董事长', 'founder and chairman'],
  ['第二代掌门人', 'second-generation head'],
  ['联合创始人', 'co-founder'],
  ['家族信托的实际控制人', 'controller of the family trust'],
  ['终身名誉主席', 'chairman emeritus'],
  ['最大的个人股东', 'largest individual shareholder'],
];
const TRAITS = [
  ['很少公开露面', 'rarely seen in public'],
  ['把公司从破产边缘救了回来', 'pulled the company back from the brink'],
  ['职业经理人出身，一路做到大股东', 'came up as a hired manager and ended up owning it'],
  ['技术出身，据说至今还在写代码', 'an engineer who reportedly still writes code'],
  ['靠一次押注赌对了整个行业', 'bet the company on one call and got it right'],
  ['以吝啬和准时闻名', 'known for thrift and punctuality'],
  ['在同行还在观望时就全押了进去', 'went all in while the industry was still watching'],
  ['三十年没换过办公室', 'has not changed offices in thirty years'],
  ['从不接受采访', 'has never given an interview'],
  ['把大半身家放进了慈善基金', 'has moved most of it into a foundation'],
];

// 稳定的伪随机：同一份股票表每次生成的结果一样
let seed = 20260829;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];

const taken = new Set(RIVALS.map(r => r.id));
const covered = new Set(RIVALS.map(r => r.symbol).filter(Boolean));
const zhSeen = new Set(RIVALS.map(r => r.zh));
const enSeen = new Set(RIVALS.map(r => r.en));

const out = [];
for (const [sym, name, zh, sector, price, sharesM] of STOCKS) {
  if (covered.has(sym)) continue;
  const cap = price * sharesM * 1e6;
  // 市值越大的公司，创始人越可能已经稀释得比较厉害
  const n = cap > 4e11 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    let zhName, enName, guard = 0;
    do { zhName = pick(SUR_ZH) + pick(GIV_ZH); } while (zhSeen.has(zhName) && ++guard < 50);
    guard = 0;
    do { enName = pick(GIV_EN) + ' ' + pick(SUR_EN); } while (enSeen.has(enName) && ++guard < 50);
    zhSeen.add(zhName); enSeen.add(enName);
    let id = sym.toLowerCase() + (i ? '-' + i : '');
    while (taken.has(id)) id += 'x';
    taken.add(id);
    // 持股：小公司创始人握得多，大公司早就摊薄了
    const base = cap > 1e12 ? 0.02 : cap > 2e11 ? 0.06 : cap > 5e10 ? 0.14 : 0.28;
    const stake = Math.round(base * (0.55 + rnd() * 0.95) / (i ? 2.2 : 1) * 1000) / 1000;
    // 场外财富：房产、艺术品、别的生意
    const other = Math.round(cap * stake * (0.05 + rnd() * 0.40) / 1e6) * 1e6;
    const en0 = name.replace(/\.$/, '');            // 公司名本身带句点的，别写成两个
    const bio = rnd() < 0.55
      ? (t => ({ zh: `${zh}的${t[0]}。`, en: `The ${t[1]} of ${en0}.` }))(pick(TITLES))
      : (t => ({ zh: `${zh}的大股东，${t[0]}。`, en: `A major holder of ${en0} — ${t[1]}.` }))(pick(TRAITS));
    out.push({ id, zh: zhName, en: enName, emoji: pick(EMOJI), symbol: sym, stake, other, bio });
  }
}

const src = `// 自动生成，请勿手改 —— 由 tools/build-rivals.mjs 从股票表生成。
// 每一支股票背后都有具体的人：你买它的股份、收购它、或者在同一个赛道上
// 把它挤下去，富豪榜上就真的有人往下掉。
export const RIVALS_GEN = ${JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};
`;
writeFileSync('src/catalog-rivals-gen.js', src);
console.log(`✅ src/catalog-rivals-gen.js  ${out.length} 位大股东 / 覆盖 ${new Set(out.map(o => o.symbol)).size} 家公司`);
