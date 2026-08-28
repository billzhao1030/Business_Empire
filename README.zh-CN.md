<p align="center"><img src="build/banner.png" alt="Business Empire" width="100%"></p>

<p align="center"><a href="README.md">🇬🇧 English</a> · 中文</p>

# 💼 Business Empire · 商业帝国

一个可以在浏览器里玩的商业模拟经营游戏。**从 $0 开始**：先打零工攒第一笔钱，开出第一个街头小摊，
然后一路做到炒股、买房、投资商圈，最后把一家家上市公司整个收购下来，冲上世界富豪榜。

**零第三方依赖** —— 只需要 Node.js，不用 `npm install`，不联网也能玩，没有广告。
存档保存在本地 SQLite 数据库里，支持多账号，各自独立。界面支持**中文 / English**、**三套配色主题**。

---

## 🚀 快速开始

### macOS

桌面上已经有一个 **Business Empire** 图标，双击即可：

- 服务**没启动** → 后台自动拉起（约 0.7 秒），起来后自动打开浏览器
- 服务**已经在跑** → 直接打开浏览器（约 0.07 秒）
- 关掉浏览器不会停止服务；服务独立于启动器存活

启动器做了这些健壮性处理：严格校验 `/api/health` 返回 `{"ok":true}` 才算启动成功、
全部使用系统命令绝对路径（Finder 启动的 App 环境变量极简）、多路径搜索项目目录、
通过登录 shell 兜底查找 `node`、启动前先探测存档目录写权限、
日志写到 `~/Library/Logs/BusinessEmpire.log`（避开 TCC 保护目录）、App 已做 ad-hoc 签名。

移动过项目文件夹后，重新生成图标：

```bash
cd "Business Empire" && ./tools/make-desktop-icon.sh
```

也可以手动启动：`node server.js`，然后访问 <http://127.0.0.1:8020>。

### Windows

1. **安装 Node.js**（只需一次）。在 PowerShell 里执行：

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

   或去 <https://nodejs.org> 下载 **LTS** 安装包。装完**关闭并重新打开**终端。

2. **确认版本**（需要 v22.5 以上，推荐 v24 及以上）：`node -v`

3. **启动游戏**，二选一：
   - 双击 **`start.bat`**（会保留一个命令行窗口，关掉即停止服务）
   - 双击 **`Business Empire.vbs`**（无窗口后台启动，更像一个 App）
     → 右键它 → **发送到 → 桌面快捷方式**，就得到一个桌面图标，逻辑和 macOS 版一样：
     没启就启，启了就直接开网页

4. 停止服务：关掉命令行窗口，或在任务管理器里结束 `node.exe`。

> Node 是 v22 / v23 的话，改用 `node --experimental-sqlite server.js`（或 `npm run start:legacy`）。

### Linux

```bash
node -v && node server.js     # 然后打开 http://localhost:8020
```

---

## ⚙️ 常用操作

| 需求 | 做法 |
| --- | --- |
| **换端口** | PowerShell：`$env:PORT=9000; node server.js`　CMD：`set PORT=9000 && node server.js`　macOS/Linux：`PORT=9000 node server.js` |
| **改时间流速** | `GAME_HOUR_MS=60000 node server.js`（1 分钟 = 1 游戏小时，默认 120000 即 2 分钟）。改了不会丢档，游戏时钟会自动对齐。 |
| **手机 / 平板上玩** | 同一 WiFi 下访问 `http://电脑局域网IP:8020`（Windows 用 `ipconfig`，macOS 用 `ifconfig`），首次可能要在防火墙弹窗点"允许" |
| **切换语言 / 主题** | 右上角 `🌈 🌙 ☀️` 换配色，`中 / EN` 换语言，随时生效 |
| **重置存档 / 删除账号** | 游戏内 **关于** 页面底部（删除账号需输入密码） |
| **备份存档** | 复制整个 `data/` 文件夹 |
| **彻底重来** | 删掉 `data/game.db*` 三个文件，或 `npm run reset` |

---

## 🎮 玩法说明

### ⏱️ 时间

**现实 2 分钟 = 游戏 1 小时**。一个游戏日 = 48 分钟，一个游戏月（30 天）= 24 小时现实时间，
一个游戏年 = 12 天。

**离线也会照常结算**：关掉网页去睡觉，回来时店铺的营业额、银行利息、贷款月供、
股价波动、房价涨跌全部一次性补算。

再次打开游戏时会弹出一份「**欢迎回来**」报告，告诉你：离开了多久（现实时间与游戏时间）、
净资产变化了多少、这些钱**分别是从哪儿来的**（实业 / 打工 / 股息 / 租金 / 利息）、
花到哪儿去了（税 / 还贷 / 维护费），以及有多少来自资产估值波动。

### 🧳 白手起家（开局这么玩）

你的初始资金是 **$0**。

1. 开局有 **$144**（上一份工作结清的最后一笔工资），直接开一个 **$120 街头小摊**，
   它会替你 24 小时不停地赚钱
2. 下班后（17:00 之后）到**生涯**页接加班：每单实打实占用 **1 个游戏工时**，
   干完才到账，期间不能再接第二单
3. 攒到 **$900** 买一辆二手电动车 → 解锁「网约车司机」，时薪从 $18 跳到 $130
4. 用店铺利润滚出更多店铺，同时开始炒股、买商圈份额
5. 信用分够了就贷款加杠杆，买房吃租金
6. 终局：买满一家公司的限购比例，发起**全面收购要约**，把它变成全资子公司

**一天被切成三段，工时和身体双重封顶：**

| 时段 | 内容 |
| --- | --- |
| 23:00 – 07:00 | 睡觉，恢复体力 |
| 09:00 – 17:00 | 正常班 8 小时，自动结算工资 |
| 其余清醒时间 | 可以加班，每天最多 6 小时 |

**加班是真的要花时间的**：接一单 = 占用 **1 个游戏工时**（现实 2 分钟），
这一小时在游戏里真正过完钱才到账，期间**不能再接第二单**——不可能一分钟里连接两次。

加班还会消耗**体力**（0–100）。体力低于 60 工作效率开始下降，低于 15 就干不动加班了。
每天加 **4 小时以内可持续**，加满 6 小时会把自己熬垮，得停一两天补觉。

12 个职位（时薪 $18 → $3,200）：发传单 → 送外卖 → 便利店店员 → 餐厅服务员 →
**网约车司机**（需有车）→ **长途货车司机**（需有车）→ 销售代表 → 软件工程师 →
金融分析师 → 部门经理 → 投行副总裁 → 职业经理人 CEO。每工作 1 个工时 +1 点经验。

游戏内时间常驻在**界面顶部**，显示日期、时钟、当前小时进度和你所处的时段
（🌙 休息 / 🌅 清晨 / 💼 上班中 / 🌆 已下班）。

### 🏬 实业（36 种业态，6 个可调杠杆）

从 **$120 的街头小摊**到 **$50 亿的商业航天基地**。每家店可以调：

- **选址**：小镇 / 本市 / 省会 / 一线城市 / 纽约 / 迪拜。城市越大投入越高、单位回报越好、波动也越大
- **定价策略（5 档）**：最有深度的一个机制。低价拉客流并**长期抬高**客流基准；
  高价短期利润高但顾客会**慢慢流失**。想快速回血就"收割"，想做大就压价抢份额
- **员工**：每名员工支撑一定营收，人手不足会直接丢订单并赶走客人。可开**自动配人**
- **扩建**（最高 Lv.12）：营收 ×1.32/级，成本 ×1.18/级
- **营销**（最高 6 级）：提营收 + 抬高客流基准
- **翻新**：店铺状况随时间衰减，状况差会同时压低营收、抬高成本。可开**自动翻新**

另外，店铺所在城市的**商圈繁荣度**会直接乘在营收上。

### 📈 市场（143 个可交易标的）

| 类别 | 数量 | 说明 |
| --- | --- | --- |
| 股票 | **200** | 谐音真实公司（Appel / MicroHard / Envidia / Teslo / 腾讯达 / 阿里爸爸 / 贝莱德客 / 茅苔 / 优步尔…），横跨 54 个板块，各有市盈率、股息率、β、总股本 |
| 商圈 | 12 | 可投资的商业地产份额，按季分红，繁荣度直接影响你在该城市所有店铺的营收 |
| 大宗商品 | 8 | 黄金、白银、铂金、钻石、原油、铜、天然气、小麦。黄金与股市**负相关** |
| 加密货币 | 23 | 比特玉米、以太餐、币安希、狗狗块、柴犬仿、佩佩蛙…年化波动 100%~240%，另有一个稳定币可避险 |
| 指数 | 14 | 大盘指数 + 10 个地区房价指数 + 腕表 / 艺术品 / 经典车指数（不可直接交易，但有完整走势图） |

**新建存档时会先预热 30 个游戏日**，所以一进游戏每个标的就已经有一整月的历史行情和新闻，
不是从一个孤零零的点开始画线。

**价格是怎么来的**——不是随机数，也没有固定涨跌上下限。每个游戏小时，每个标的的
对数收益率由六部分叠加：

1. **大盘因子** × 该标的的 β
2. **板块因子与轮动**（每个板块有缓慢演化的动量，所以会出现半导体连涨一周这种行情）
3. **个股特异波动**（由它自己的年化波动率决定）
4. **均值回归**（每个标的有缓慢增长的**内在价值**，价格偏离越远被拉回来的力越大）
5. **波动率聚集**（GARCH 效应：大波动之后更容易继续大波动，行情有平静期和疯狂期）
6. **跳跃与新闻冲击**（突发跳空 + 会推动内在价值本身的新闻事件）

此外**你自己的大额交易会冲击价格**——买得越多，成交价被你推得越高。

游戏内的**行情 → 概览**页有大盘指数走势、涨跌家数分布、板块表现排行、涨跌幅榜和实时新闻流；
每个标的的详情页有折线 / K 线切换、4 档时间区间、MA5/MA20 均线、区间高低、波动率、β、内在价值。

### 🌍 宏观经济周期

世界不是静止的。每个游戏月重掷一次宏观周期：
**繁荣 → 扩张 → 平稳 → 通胀 → 放缓 → 衰退 → 危机**。

它会**同时**改变四件事：股市的长期漂移、市场波动率、**央行政策利率**（进而改变你的存贷款利率）、
以及所有店铺的客流。偶尔还会砸下世界事件——金融危机、可控核聚变商业化、地区冲突、
全球减税协议——直接改写整个盘面。

### 🏛️ 收购公司 & 世界富豪榜

每家上市公司有一个二级市场**限购比例**（苹裹只能买到 8%，小公司可以买到 100%）。
买满之后可以发起**全面收购要约**：按 20%~65% 溢价吃下剩余全部股份，取得 100% 所有权。
之后它每月直接向你上缴利润（远高于分红）——如果是亏损公司，窟窿也得你自己填。

**富豪榜上的 40 位化名富豪**（伊隆·马斯特 $364B、杰夫·贝索夫、马克·扎克伯特、沃伦·巴菲仕、
赵长朋、雷君、李佳诚…）
的身家与游戏内公司股价**实时联动**。你买走某家公司多少股份，创始人的财富就缩水多少——
**买下 100%，他直接从榜上掉下去**。

### 🏦 银行

所有利率跟随**央行政策利率**浮动，而政策利率由宏观周期决定：

- **活期**：政策利率 × 0.85，按小时计息
- **定期**：3 / 6 / 12 / 24 个月，提前支取只拿 30% 折算利息
- **信用贷**：利率 = 政策利率 + 2.2% + 信用分溢价（最高 +16%）
- **房贷**：利率 = 政策利率 + 0.4% + 信用分溢价，首付 20%~100%，5/10/20/30 年
- **信用分**（300~850）：按时还款 +2，逾期 -35 并加收 2% 罚息，负债率过高持续扣分
- **透支**：现金可以为负，按政策利率 + 19% 收罚息

### 🏘️ 房产与固定资产（94 件）

- **10 个地区**各有独立的**房价指数**实时涨跌：本市 / 省会 / 一线 / 纽约 / 伦敦 / 东京 /
  洛杉矶 / 迈阿密 / 迪拜 / 摩纳哥。迪拜波动最大，摩纳哥几乎只涨不跌
- **53 处房产**：$18 万的本市公寓 → $26 亿的摩纳哥海崖城堡，可**出租**收月租金
- **21 辆车**：$900 二手电动车 → $540 万柯尼赛格。**买任意一辆车就能解锁开车类工作**
- **游艇 / 私人飞机**：会折旧，但提供**声望**加成——声望直接提升你**所有店铺**的营收（最高 +60%）
- **腕表 / 艺术品**：跟随各自的收藏品指数波动，长期升值

### 🧾 税收与随机事件

企业所得税 25%（月结）、资本利得税 20%、股息税 10%、财产税每月 0.08%，
交易另收 0.1% 佣金和 0.04% 价差。

每个游戏月还有概率触发：超速罚单、税务稽查、门店失火、被网红打卡、中彩票、
当选年度商业人物……金额随你的身家等比缩放。

---

## 📁 目录结构

```
Business Empire/
├── server.js                启动器（环境自检 → 加载服务）
├── start.bat                Windows 一键启动（带命令行窗口）
├── Business Empire.vbs      Windows 无窗口启动（可发送到桌面快捷方式）
├── start.command            macOS 命令行启动
├── data/game.db             存档数据库（自动生成）
├── tools/
│   ├── make-icon.mjs        零依赖生成 App 图标（手写 PNG 编码）
│   └── make-desktop-icon.sh 重新生成 macOS 桌面图标
├── src/
│   ├── main.js              HTTP 服务与路由
│   ├── db.js                表结构与迁移
│   ├── auth.js              注册 / 登录 / 会话（scrypt 加盐）
│   ├── market.js            价格引擎、宏观周期、游戏时钟、新闻
│   ├── sim.js               玩家经济引擎（打工 / 经营 / 利息 / 税 / 事件）
│   ├── api.js               业务接口
│   ├── catalog-assets.js    100 股票 + 商品 + 加密货币 + 商圈 + 指数
│   └── catalog-content.js   业态 / 城市 / 地区 / 房产 / 车 / 工作 / 富豪 / 文案
└── public/
    ├── index.html
    ├── css/style.css        三套主题
    └── js/
        ├── app.js           应用外壳与路由
        ├── i18n.js          中英双语词典（280+ 词条）
        ├── chart.js         Canvas 图表（走势 / K线 / 均线 / 迷你图 / 环形图）
        ├── util.js          格式化与 UI 组件
        └── views/           10 个页面
```

---

## ❓ 常见问题

**Q：`Error: Cannot find module 'node:sqlite'`**
A：Node 版本太低。升级到 v24 LTS，或用 `node --experimental-sqlite server.js`。

**Q：端口被占用（`EADDRINUSE`）**
A：换端口 `PORT=9000 node server.js`；或关掉占用进程
（Windows：`netstat -ano | findstr 8020` 然后 `taskkill /PID <pid> /F`）。

**Q：桌面图标点了没反应**
A：启动日志在 `~/Library/Logs/BusinessEmpire.log`（Windows 在
`%LOCALAPPDATA%\BusinessEmpire\server.log`）。先看日志；也可以在项目目录手动
`node server.js` 看报错。

**Q：macOS 弹出"想要访问桌面文件夹"的权限询问**
A：点**允许**。存档要写在项目目录里，而桌面是受系统 TCC 保护的目录。
如果误点了拒绝，可以到「系统设置 → 隐私与安全性 → 文件与文件夹」重新打开；
或者把整个项目文件夹移到 `~/business-empire`，启动器会自动找到新位置。

**Q：数据会上传到网上吗**
A：不会。整个游戏跑在你自己的电脑上，没有任何外部请求。

---

## 🤖 给 AI 助手的部署提示

> 换一台机器（比如 Windows）时，把下面这段直接发给 Claude Code：

```
请帮我在这台电脑上运行 Business Empire 这个游戏项目：
1. 检查 node -v，如果没有或低于 v22.5，用 winget install OpenJS.NodeJS.LTS 安装 Node LTS
2. 进入项目目录执行 node server.js（不需要 npm install，这个项目零依赖）
3. 如果报 node:sqlite 找不到，改用 node --experimental-sqlite server.js
4. 如果 8020 端口被占用，用 $env:PORT=9000; node server.js 换端口
5. 启动成功后打开 http://localhost:8020
6. 顺便把 "Business Empire.vbs" 发送到桌面快捷方式，以后双击就能玩
```

---

## English

**Business Empire** is a browser-based tycoon simulation that runs entirely on your own machine.
You start with **$0**: hustle for gigs, open a $120 street stall, and work up through 36 business
formats, 143 tradable markets (100 parody-named stocks, 12 commercial districts, commodities,
23 cryptocurrencies), mortgaged property across 10 regions with live housing indices, a
macro-regime engine that moves rates and footfall, and finally tender offers to acquire listed
companies outright — which knocks their founders down the world rich list.

**Zero dependencies.** Node.js only, no `npm install`, no internet, no ads.

```bash
node -v          # needs v22.5+, v24 LTS or newer recommended
node server.js   # macOS: double-click the desktop app · Windows: start.bat or the .vbs
```

Then open <http://localhost:8020>. Use the top-right controls to switch between
中文 / English and three colour themes.

**New saves are pre-seeded with 30 in-game days of price history**, so every chart is
meaningful from the first second.

**Time:** 2 real minutes = 1 in-game hour; everything accrues while you are offline, and a
**Welcome back** report breaks down exactly where every dollar came from while you were away.
**Change it:** `GAME_HOUR_MS=60000 node server.js`.
**Reset:** the About page in-game, or delete `data/game.db*`.


---

## 版权与许可

**Copyright © 2026 赵勋屹 (Xunyi Zhao) — [@billzhao1030](https://github.com/billzhao1030)**
基于 [MIT License](LICENSE) 发布。

> **谐音免责声明**：游戏中出现的所有公司、品牌、产品与人物均为**虚构**。
> 诸如 *苹裹*、*微硬*、*英伟哒*、*特斯萝*、*伊隆·马斯特*、*杰夫·贝索夫* 等名称，
> 是出于讽刺与娱乐目的创作的戏仿，与任何真实公司或个人**无关联、无背书、无赞助关系**，
> 任何相似之处均属有意的评论性创作，而非声称存在关联。所有财务数据、价格序列与事件均为合成。
>
> **非投资建议**：这是一款游戏。其中任何内容都不构成投资建议；它的市场模型以娱乐性优先，
> 不应被用来推断真实市场。
