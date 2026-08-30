// 数据库层：node:sqlite（Node 22.5+ 内置），零外部依赖
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.BE_DATA_DIR
  ? path.resolve(process.env.BE_DATA_DIR)
  : path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'game.db');
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
// 撞上别的写入时先等一会儿再重试，而不是当场抛 SQLITE_BUSY。
// WAL 下读不会被挡，但两个写入者仍然会互斥——没有这一行，第二个写入者
// 立刻就是一句 "database is locked"。
db.exec('PRAGMA busy_timeout = 8000');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL,
  pass_hash  TEXT NOT NULL,
  salt       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 玩家存档（一个账号一个存档）
CREATE TABLE IF NOT EXISTS players (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname       TEXT    NOT NULL,
  cash           REAL    NOT NULL,
  bank           REAL    NOT NULL DEFAULT 0,
  credit_score   INTEGER NOT NULL DEFAULT 680,
  last_hour      INTEGER NOT NULL,
  created_hour   INTEGER NOT NULL,
  prestige       REAL    NOT NULL DEFAULT 0,
  month_profit   REAL    NOT NULL DEFAULT 0,   -- 本月实业利润（用于计税）
  total_tax      REAL    NOT NULL DEFAULT 0,
  total_dividend REAL    NOT NULL DEFAULT 0,
  realized_pnl   REAL    NOT NULL DEFAULT 0,
  missed_pay     INTEGER NOT NULL DEFAULT 0,
  peak_networth  REAL    NOT NULL DEFAULT 0,
  bankrupt       INTEGER NOT NULL DEFAULT 0
);

-- 资产宇宙：股票 / 大宗商品 / 加密货币
CREATE TABLE IF NOT EXISTS assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol      TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  zh          TEXT NOT NULL,
  kind        TEXT NOT NULL,            -- stock | commodity | crypto
  sector      TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT '股',
  price       REAL NOT NULL,
  prev_close  REAL NOT NULL,
  day_open    REAL NOT NULL,
  day_high    REAL NOT NULL,
  day_low     REAL NOT NULL,
  fair        REAL NOT NULL,            -- 内在价值（价格向其均值回归）
  mu          REAL NOT NULL,            -- 年化基本面增速
  sigma       REAL NOT NULL,            -- 年化基础波动率
  vol_state   REAL NOT NULL DEFAULT 1,  -- 波动率聚集系数
  beta        REAL NOT NULL,
  div_yield   REAL NOT NULL DEFAULT 0,  -- 年化股息率
  shares      REAL NOT NULL,            -- 总股本 / 总供应量
  max_stake   REAL NOT NULL DEFAULT 1,  -- 可购买的最大股份比例
  eps         REAL NOT NULL DEFAULT 0,  -- 每股年收益
  last_ret    REAL NOT NULL DEFAULT 0,
  desc        TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);

CREATE TABLE IF NOT EXISTS prices (
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  hour     INTEGER NOT NULL,
  price    REAL NOT NULL,
  PRIMARY KEY (asset_id, hour)
);

CREATE TABLE IF NOT EXISTS holdings (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  qty      REAL NOT NULL DEFAULT 0,
  cost     REAL NOT NULL DEFAULT 0,   -- 累计成本（含手续费）
  PRIMARY KEY (user_id, asset_id)
);

CREATE TABLE IF NOT EXISTS businesses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  city        TEXT NOT NULL DEFAULT '本市',
  city_mult   REAL NOT NULL DEFAULT 1,
  level       INTEGER NOT NULL DEFAULT 1,
  marketing   INTEGER NOT NULL DEFAULT 0,
  demand      REAL NOT NULL DEFAULT 1,
  condition   REAL NOT NULL DEFAULT 1,
  invested    REAL NOT NULL DEFAULT 0,
  lifetime_profit REAL NOT NULL DEFAULT 0,
  month_revenue   REAL NOT NULL DEFAULT 0,
  month_cost      REAL NOT NULL DEFAULT 0,
  created_hour INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biz_user ON businesses(user_id);

-- 自己创办的公司：装着你的店铺，有估值，能融资，最终能上市
CREATE TABLE IF NOT EXISTS companies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_en       TEXT NOT NULL DEFAULT '',
  ticker        TEXT NOT NULL,
  sector        TEXT NOT NULL DEFAULT '消费',
  stage         TEXT NOT NULL DEFAULT 'private',
  founded_hour  INTEGER NOT NULL,
  cash          REAL NOT NULL DEFAULT 0,          -- 公司账上的钱，和你个人的钱是两笔
  shares        REAL NOT NULL DEFAULT 1000000,    -- 总股本
  player_shares REAL NOT NULL DEFAULT 1000000,    -- 创始人持股
  round_n       INTEGER NOT NULL DEFAULT 0,
  raised        REAL NOT NULL DEFAULT 0,          -- 累计融资额
  last_val      REAL NOT NULL DEFAULT 0,
  peak_val      REAL NOT NULL DEFAULT 0,
  round_val     REAL NOT NULL DEFAULT 0,          -- 上一轮的投后估值
  rate_fast     REAL NOT NULL DEFAULT 0,          -- 利润的快线（5 天半衰）
  rate_slow     REAL NOT NULL DEFAULT 0,          -- 利润的慢线（30 天半衰）
  growth        REAL NOT NULL DEFAULT 0,          -- 年化增长率
  lifetime_profit REAL NOT NULL DEFAULT 0,
  dividends_paid  REAL NOT NULL DEFAULT 0,
  asset_id      INTEGER NOT NULL DEFAULT 0,       -- 上市后对应 assets.id
  ipo_hour      INTEGER NOT NULL DEFAULT 0,
  ipo_price     REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_co_user2 ON companies(user_id);

-- 奢侈品 / 房产 / 收藏
CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id     TEXT NOT NULL,
  value       REAL NOT NULL,
  paid        REAL NOT NULL,
  rented      INTEGER NOT NULL DEFAULT 0,
  bought_hour INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

-- 消遣记录：同一项连着做效果递减，冷却过了才回满
CREATE TABLE IF NOT EXISTS leisure (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  act_id     TEXT NOT NULL,
  last_hour  INTEGER NOT NULL DEFAULT 0,
  times      INTEGER NOT NULL DEFAULT 0,
  spent      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, act_id)
);

CREATE TABLE IF NOT EXISTS loans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principal    REAL NOT NULL,
  balance      REAL NOT NULL,
  rate         REAL NOT NULL,           -- 年化
  term_months  INTEGER NOT NULL,
  months_left  INTEGER NOT NULL,
  payment      REAL NOT NULL,           -- 每月应还
  next_due     INTEGER NOT NULL,        -- 下次还款的游戏小时
  paid_total   REAL NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active',
  created_hour INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);

CREATE TABLE IF NOT EXISTS deposits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       REAL NOT NULL,
  rate         REAL NOT NULL,
  term_months  INTEGER NOT NULL,
  start_hour   INTEGER NOT NULL,
  mature_hour  INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_dep_user ON deposits(user_id);

CREATE TABLE IF NOT EXISTS ledger (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hour    INTEGER NOT NULL,
  kind    TEXT NOT NULL,
  amount  REAL NOT NULL,
  detail  TEXT NOT NULL,
  icon    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, id DESC);

CREATE TABLE IF NOT EXISTS networth (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hour    INTEGER NOT NULL,
  value   REAL NOT NULL,
  PRIMARY KEY (user_id, hour)
);

CREATE TABLE IF NOT EXISTS visits (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id   TEXT    NOT NULL,
  times      INTEGER NOT NULL DEFAULT 0,
  nights     INTEGER NOT NULL DEFAULT 0,
  spent      REAL    NOT NULL DEFAULT 0,
  first_hour INTEGER NOT NULL,
  last_hour  INTEGER NOT NULL,
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS news (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  hour     INTEGER NOT NULL,
  scope    TEXT NOT NULL,          -- market | sector | asset
  target   TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL,
  impact   REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_news_hour ON news(hour DESC);
`);

// ── 轻量迁移：为已存在的库补列 ──────────────────────────────
function addColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
addColumn('businesses', 'price_tier',  'INTEGER NOT NULL DEFAULT 0');
addColumn('businesses', 'staff',       'INTEGER NOT NULL DEFAULT 2');
addColumn('businesses', 'auto_staff',  'INTEGER NOT NULL DEFAULT 1');
addColumn('businesses', 'auto_repair', 'INTEGER NOT NULL DEFAULT 0');
addColumn('businesses', 'understaffed','REAL    NOT NULL DEFAULT 0');
addColumn('businesses', 'company_id', 'INTEGER NOT NULL DEFAULT 0');
addColumn('companies', 'rate_vslow', 'REAL NOT NULL DEFAULT 0');
// 开店时把当地的经营参数固化在店铺上：城市从 6 个抽象档位变成 7,330 座真实城市之后，
// bizRates 是每小时都要跑的热路径，不该每次再去推算一遍。0 表示老存档，回落到城市表。
addColumn('businesses', 'rev_mult',  'REAL NOT NULL DEFAULT 0');
addColumn('businesses', 'rent_mult', 'REAL NOT NULL DEFAULT 0');
addColumn('businesses', 'wage_mult', 'REAL NOT NULL DEFAULT 0');
addColumn('businesses', 'cost_mult', 'REAL NOT NULL DEFAULT 0');
addColumn('businesses', 'city_vol',  'REAL NOT NULL DEFAULT 0');
addColumn('businesses', 'city_name', "TEXT NOT NULL DEFAULT ''");
addColumn('businesses', 'city_en',   "TEXT NOT NULL DEFAULT ''");
addColumn('businesses', 'city_flag', "TEXT NOT NULL DEFAULT ''");

// 早期版本限制一人一家公司，靠的是这条唯一索引。现在可以开很多家了。
try { db.exec('DROP INDEX IF EXISTS idx_co_user'); } catch {}
addColumn('items', 'region',    "TEXT NOT NULL DEFAULT ''");
addColumn('items', 'index_sym', "TEXT NOT NULL DEFAULT ''");
addColumn('items', 'units',     'REAL NOT NULL DEFAULT 0');
addColumn('items', 'loan_id',   'INTEGER NOT NULL DEFAULT 0');
addColumn('loans', 'kind',      "TEXT NOT NULL DEFAULT 'personal'");
addColumn('loans', 'item_id',   'INTEGER NOT NULL DEFAULT 0');
addColumn('assets','link',      "TEXT NOT NULL DEFAULT ''");
addColumn('players','job_id',   "TEXT NOT NULL DEFAULT 'flyer'");
addColumn('players','job_exp',  'REAL NOT NULL DEFAULT 0');
addColumn('players','job_hours','REAL NOT NULL DEFAULT 0');
addColumn('players','job_income','REAL NOT NULL DEFAULT 0');
addColumn('players','last_hustle','INTEGER NOT NULL DEFAULT 0');
addColumn('players','hustles',  'INTEGER NOT NULL DEFAULT 0');
addColumn('players','last_seen_ms',   'INTEGER NOT NULL DEFAULT 0');
addColumn('players','last_seen_hour', 'INTEGER NOT NULL DEFAULT 0');
addColumn('players','last_seen_nw',   'REAL    NOT NULL DEFAULT 0');
addColumn('players','ot_hours',       'REAL    NOT NULL DEFAULT 0');
addColumn('players','ot_day',         'INTEGER NOT NULL DEFAULT -1');
addColumn('players','stamina',        'REAL    NOT NULL DEFAULT 100');
addColumn('players','ot_until',       'INTEGER NOT NULL DEFAULT 0');
addColumn('players','ot_pending',     'REAL    NOT NULL DEFAULT 0');
addColumn('players','stress',         'REAL    NOT NULL DEFAULT 0');
addColumn('players','sick_until',     'INTEGER NOT NULL DEFAULT 0');
addColumn('players','sick_id',        "TEXT    NOT NULL DEFAULT ''");
addColumn('players','sick_treated',   'INTEGER NOT NULL DEFAULT 0');
addColumn('players','trip_until',     'INTEGER NOT NULL DEFAULT 0');
addColumn('players','trip_id',        "TEXT    NOT NULL DEFAULT ''");
addColumn('players','med_spent',      'REAL    NOT NULL DEFAULT 0');
addColumn('players','trip_spent',     'REAL    NOT NULL DEFAULT 0');
addColumn('players','trips',          'INTEGER NOT NULL DEFAULT 0');
addColumn('players','trip_relief',    'REAL    NOT NULL DEFAULT 1');
addColumn('players','trip_stam',      'REAL    NOT NULL DEFAULT 0');
addColumn('players','trip_nights',    'INTEGER NOT NULL DEFAULT 0');
addColumn('players','trip_spent2',    'REAL    NOT NULL DEFAULT 0');
addColumn('players','birth_id',       "TEXT    NOT NULL DEFAULT ''");
addColumn('players','work_streak',    'INTEGER NOT NULL DEFAULT 0');
addColumn('players','worked_today',   'INTEGER NOT NULL DEFAULT 0');
addColumn('players','streak_day',     'INTEGER NOT NULL DEFAULT -1');
addColumn('players','off_day',        'INTEGER NOT NULL DEFAULT -1');
addColumn('players','meal_id',        "TEXT    NOT NULL DEFAULT 'canteen'");
addColumn('players','home_id',        "TEXT    NOT NULL DEFAULT 'shared'");
// 住进自己名下的哪一套房。0 = 还在租房；房子一旦租出去就不算住处了
addColumn('players','home_item_id',   'INTEGER NOT NULL DEFAULT 0');
// 人现在在哪儿。空 = 在出生地。买单程票飞走了就留在那儿，下一程从这里起算
addColumn('players','at_id',          "TEXT    NOT NULL DEFAULT ''");
// 人物：性别与穿在身上的那一套（每个部位存 items.id，0 = 空着）
addColumn('players','gender',         "TEXT    NOT NULL DEFAULT 'x'");
addColumn('players','wear_top',       'INTEGER NOT NULL DEFAULT 0');
addColumn('players','wear_bottom',    'INTEGER NOT NULL DEFAULT 0');
addColumn('players','wear_outer',     'INTEGER NOT NULL DEFAULT 0');
addColumn('players','wear_shoes',     'INTEGER NOT NULL DEFAULT 0');
addColumn('players','wear_acc',       'INTEGER NOT NULL DEFAULT 0');
addColumn('players','skin',           'INTEGER NOT NULL DEFAULT 2');   // 肤色 0-5
addColumn('players','hair',           'INTEGER NOT NULL DEFAULT 0');   // 发型 0-7
addColumn('players','haircol',        'INTEGER NOT NULL DEFAULT 0');   // 发色 0-7
addColumn('players','leisure_spent',  'REAL    NOT NULL DEFAULT 0');
addColumn('players','leisure_n',      'INTEGER NOT NULL DEFAULT 0');
// 正在做一件占时间的事（消遣），这段时间上不了班
addColumn('players','busy_until',     'INTEGER NOT NULL DEFAULT 0');
// 自动转存：手上现金超过这个数，多出来的自动进活期吃利息（0 = 关）
addColumn('players','sweep_keep',     'REAL    NOT NULL DEFAULT 0');
addColumn('players','food_spent',     'REAL    NOT NULL DEFAULT 0');
addColumn('players','rent_spent',     'REAL    NOT NULL DEFAULT 0');
addColumn('players','commute_id',     "TEXT    NOT NULL DEFAULT 'walk'");
addColumn('players','transit_spent',  'REAL    NOT NULL DEFAULT 0');
addColumn('players','lotto_spent',    'REAL    NOT NULL DEFAULT 0');
addColumn('players','lotto_won',      'REAL    NOT NULL DEFAULT 0');
addColumn('players','lotto_tickets',  'INTEGER NOT NULL DEFAULT 0');
addColumn('businesses','all_day',     'INTEGER NOT NULL DEFAULT 0');
addColumn('businesses','manager',     'INTEGER NOT NULL DEFAULT 0');

export function getMeta(key, def = null) {
  const row = db.prepare('SELECT value FROM meta WHERE key=?').get(key);
  return row ? row.value : def;
}
export function setMeta(key, value) {
  db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, String(value));
}

// 简单事务包装
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    throw e;
  }
}
