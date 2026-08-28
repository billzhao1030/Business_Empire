// 数据库层：node:sqlite（Node 22.5+ 内置），零外部依赖
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
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
