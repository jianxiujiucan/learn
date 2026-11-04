import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getPool } from './db.js';

export const SESSION_COOKIE = 'growth_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  username: string;
  isWechat: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 网页端使用 HttpOnly Cookie；小程序无法稳定携带 Cookie，
 * 因此同时接受 `Authorization: Bearer <token>`。
 */
function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header) {
    const [scheme, value] = header.split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer' && value) {
      return value.trim();
    }
  }

  const cookie = req.cookies?.[SESSION_COOKIE];
  if (typeof cookie === 'string' && cookie) return cookie;
  return undefined;
}

export async function createSession(userId: number, res: Response): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const pool = getPool();
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), userId, expiresAt],
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const token = readToken(req);
  if (token) {
    await getPool().query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ message: '请先登录' });
    return;
  }

  const [rows] = await getPool().query(
    `SELECT u.id, u.username, (u.wechat_openid IS NOT NULL) AS isWechat
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [hashToken(token)],
  );
  const row = (rows as Array<{ id: number; username: string; isWechat: number | boolean }>)[0];
  if (!row) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(401).json({ message: '登录状态已失效，请重新登录' });
    return;
  }
  req.user = {
    id: Number(row.id),
    username: row.username,
    isWechat: Boolean(row.isWechat),
  };
  next();
}
