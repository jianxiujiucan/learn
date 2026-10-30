import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getPool } from './db.js';

export const SESSION_COOKIE = 'growth_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  username: string;
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

export async function createSession(userId: number, res: Response): Promise<void> {
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
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
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
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ message: '请先登录' });
    return;
  }

  const [rows] = await getPool().query(
    `SELECT u.id, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [hashToken(token)],
  );
  const user = (rows as SessionUser[])[0];
  if (!user) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(401).json({ message: '登录状态已失效，请重新登录' });
    return;
  }
  req.user = user;
  next();
}
