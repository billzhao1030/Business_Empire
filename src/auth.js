import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_DAYS = 365;
const RENEW_WHEN_LEFT_DAYS = 300;   // 剩余不足此天数时自动续期（滑动过期）

function hash(pw, salt) {
  return crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
}

export function register(username, password, nickname) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!/^[A-Za-z0-9_一-龥]{2,20}$/.test(username)) throw new Error('用户名需为 2-20 位字母/数字/下划线/中文');
  if (password.length < 4) throw new Error('密码至少 4 位');
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exists) throw new Error('该用户名已被注册');
  const salt = crypto.randomBytes(16).toString('hex');
  const info = db.prepare('INSERT INTO users(username,pass_hash,salt,created_at,last_login) VALUES(?,?,?,?,?)')
    .run(username, hash(password, salt), salt, Date.now(), Date.now());
  return { id: Number(info.lastInsertRowid), username, nickname: nickname || username };
}

export function login(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || '').trim());
  if (!u) throw new Error('用户名或密码错误');
  const h = hash(String(password || ''), u.salt);
  const ok = h.length === u.pass_hash.length &&
    crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.pass_hash, 'hex'));
  if (!ok) throw new Error('用户名或密码错误');
  db.prepare('UPDATE users SET last_login=? WHERE id=?').run(Date.now(), u.id);
  return u;
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)')
    .run(token, userId, now, now + SESSION_DAYS * 864e5);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  return token;
}

export function userFromToken(token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!s) return null;
  const now = Date.now();
  if (s.expires_at < now) { db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null; }
  // 滑动续期：只要还在玩，登录状态就一直有效
  if (s.expires_at - now < RENEW_WHEN_LEFT_DAYS * 864e5)
    db.prepare('UPDATE sessions SET expires_at=? WHERE token=?').run(now + SESSION_DAYS * 864e5, token);
  return db.prepare('SELECT id,username,created_at FROM users WHERE id=?').get(s.user_id) || null;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}
