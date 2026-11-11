import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { closeDatabase, DEFAULT_TASKS, getPool, initDatabase } from './db.js';
import {
  createSession,
  destroySession,
  requireAuth,
  type SessionUser,
} from './auth.js';
import {
  isDateKey,
  isMonthKey,
  passwordError,
  taskNameError,
  usernameError,
} from '../shared/validation.js';

const app = express();
const port = Number(process.env.PORT || 3001);

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

/**
 * 微信小程序 wx.request 不支持 PATCH，客户端通过
 * `X-HTTP-Method-Override: PATCH` 发起 POST，这里还原真实方法。
 */
app.use((req, _res, next) => {
  const override = req.headers['x-http-method-override'];
  if (typeof override === 'string') {
    const method = override.toUpperCase();
    if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      req.method = method;
    }
  }
  next();
});

/**
 * 站点统一挂在 APP_BASE（默认 /daily）下：
 * 页面是 /daily/，接口是 /daily/api/*，内部再还原成 /api/* 交给原有路由。
 * 裸 /api/* 仍然可用，方便微信小程序端直连。
 */
const APP_BASE = (process.env.APP_BASE || '/daily').replace(/\/+$/, '');

app.use((req, _res, next) => {
  if (req.url.startsWith(`${APP_BASE}/api/`)) {
    req.url = req.url.slice(APP_BASE.length);
  }
  next();
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface TaskRow extends RowDataPacket {
  id: number;
  name: string;
  completed: number;
  completed_at: string | null;
}

interface DayStatsRow extends RowDataPacket {
  task_date: string;
  total: number;
  completed: number;
}

function requireUserId(req: Request): number {
  if (!req.user) throw new HttpError(401, '请先登录');
  return req.user.id;
}

function requireDate(value: string): string {
  if (!isDateKey(value)) throw new HttpError(400, '日期格式不正确');
  return value;
}

async function dayPayload(userId: number, date: string) {
  const [rows] = await getPool().query<TaskRow[]>(
    `SELECT t.id, t.name, dt.completed, dt.completed_at
     FROM day_tasks dt
     JOIN tasks t ON t.id = dt.task_id
     WHERE dt.user_id = ? AND dt.task_date = ?
     ORDER BY dt.created_at ASC, dt.id ASC`,
    [userId, date],
  );
  const tasks = rows.map((row) => ({
    id: row.id,
    name: row.name,
    completed: Boolean(row.completed),
    completedAt: row.completed_at,
  }));
  return {
    date,
    tasks,
    total: tasks.length,
    completed: tasks.filter((task) => task.completed).length,
  };
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function streakPayload(userId: number, today: string) {
  const [rows] = await getPool().query<DayStatsRow[]>(
    `SELECT task_date, COUNT(*) AS total, COALESCE(SUM(completed), 0) AS completed
     FROM day_tasks
     WHERE user_id = ? AND task_date <= ?
     GROUP BY task_date
     ORDER BY task_date DESC`,
    [userId, today],
  );
  const stats = new Map(
    rows.map((row) => [
      row.task_date,
      { total: Number(row.total), completed: Number(row.completed) },
    ]),
  );
  const todayStats = stats.get(today);
  let cursor = todayStats && todayStats.completed === todayStats.total && todayStats.total > 0
    ? today
    : shiftDate(today, -1);
  let streak = 0;
  while (true) {
    const current = stats.get(cursor);
    if (!current || current.total === 0 || current.completed !== current.total) break;
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return { streak };
}

async function insertDefaultTasks(
  connection: PoolConnection,
  userId: number,
  today: string,
): Promise<void> {
  const [taskResult] = await connection.query<ResultSetHeader>(
    'INSERT INTO tasks (user_id, name, is_default) VALUES ?',
    [DEFAULT_TASKS.map((name) => [userId, name, 1])],
  );
  await connection.query(
    'INSERT INTO day_tasks (user_id, task_date, task_id) VALUES ?',
    [DEFAULT_TASKS.map((_name, index) => [userId, today, taskResult.insertId + index])],
  );
}

interface WechatSessionResponse {
  openid?: string;
  errcode?: number;
  errmsg?: string;
}

function isLoopback(req: Request): boolean {
  const address = req.ip || req.socket.remoteAddress || '';
  return address === '::1' || address.endsWith('127.0.0.1');
}

function wechatUsername(openid: string): string {
  const suffix = createHash('sha256').update(openid).digest('hex').slice(0, 10);
  return `wx_${suffix}`;
}

function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * 换取微信 openid。
 * 本地开发者工具（请求来自 127.0.0.1）在没有配置 AppID 时使用模拟账号，
 * 方便先把流程跑通；生产环境永远不会启用模拟登录。
 */
async function resolveWechatOpenid(code: string, req: Request): Promise<string> {
  const appid = (process.env.WX_APPID || '').trim();
  const secret = (process.env.WX_SECRET || '').trim();
  const canMock = !isProduction()
    && (process.env.WX_LOGIN_MOCK === 'true' || (!appid && isLoopback(req)));
  if (canMock) {
    const mockOpenid = (process.env.WX_MOCK_OPENID || 'mock-openid-growth-checkin').trim();
    if (!mockOpenid || mockOpenid.length > 64) return 'mock-openid-growth-checkin';
    return mockOpenid;
  }

  if (!appid || !secret) {
    throw new HttpError(503, '微信登录尚未配置，请先设置 WX_APPID 和 WX_SECRET');
  }
  if (!code) throw new HttpError(400, '微信登录凭证已失效，请重试');

  const endpoint = new URL('https://api.weixin.qq.com/sns/jscode2session');
  endpoint.searchParams.set('appid', appid);
  endpoint.searchParams.set('secret', secret);
  endpoint.searchParams.set('js_code', code);
  endpoint.searchParams.set('grant_type', 'authorization_code');

  let payload: WechatSessionResponse;
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = (await response.json()) as WechatSessionResponse;
  } catch {
    throw new HttpError(502, '无法连接微信服务器，请稍后重试');
  }

  if (payload.errcode) {
    console.error(`[微信登录] jscode2session 返回错误：${payload.errcode} ${payload.errmsg || ''}`.trim());
    throw new HttpError(401, '微信登录失败，请重新尝试');
  }
  if (!payload.openid) throw new HttpError(502, '微信登录失败，请稍后重试');
  if (payload.openid.length > 64) throw new HttpError(502, '微信账号信息异常，请稍后重试');
  return payload.openid;
}

async function findOrCreateWechatUser(openid: string, today: string): Promise<SessionUser> {
  const pool = getPool();
  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id, username FROM users WHERE wechat_openid = ? LIMIT 1',
    [openid],
  );
  if (existing.length) {
    return {
      id: Number(existing[0].id),
      username: String(existing[0].username),
      isWechat: true,
    };
  }

  const username = wechatUsername(openid);
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, wechat_openid) VALUES (?, ?, ?)',
      [username, passwordHash, openid],
    );
    const userId = result.insertId;
    await insertDefaultTasks(connection, userId, today);
    await connection.commit();
    return { id: userId, username, isWechat: true };
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      const [retry] = await pool.query<RowDataPacket[]>(
        'SELECT id, username FROM users WHERE wechat_openid = ? LIMIT 1',
        [openid],
      );
      if (retry.length) {
        return {
          id: Number(retry[0].id),
          username: String(retry[0].username),
          isWechat: true,
        };
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const today = String(req.body?.today || '');
    const invalidUsername = usernameError(username);
    const invalidPassword = passwordError(password);
    if (invalidUsername) throw new HttpError(400, invalidUsername);
    if (invalidPassword) throw new HttpError(400, invalidPassword);
    if (!isDateKey(today)) throw new HttpError(400, '日期格式不正确');

    const passwordHash = await bcrypt.hash(password, 12);
    const pool = getPool();
    const connection = await pool.getConnection();
    let userId = 0;
    try {
      await connection.beginTransaction();
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash],
      );
      userId = result.insertId;
      await insertDefaultTasks(connection, userId, today);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, '该用户名已被注册');
      }
      throw error;
    } finally {
      connection.release();
    }

    const token = await createSession(userId, res);
    res.status(201).json({
      user: { id: userId, username, isWechat: false },
      token,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) throw new HttpError(400, '请输入用户名和密码');
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, username, password_hash, (wechat_openid IS NOT NULL) AS isWechat
       FROM users WHERE username = ? LIMIT 1`,
      [username],
    );
    const user = rows[0] as
      | { id: number; username: string; password_hash: string; isWechat: number | boolean }
      | undefined;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, '用户名或密码不正确');
    }
    const token = await createSession(user.id, res);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        isWechat: Boolean(user.isWechat),
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/wechat', async (req, res, next) => {
  try {
    const code = String(req.body?.code || '');
    const today = String(req.body?.today || '');
    if (!isDateKey(today)) throw new HttpError(400, '日期格式不正确');

    const openid = await resolveWechatOpenid(code, req);
    const user = await findOrCreateWechatUser(openid, today);
    const token = await createSession(user.id, res);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/tasks', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT id, name, is_default AS isDefault FROM tasks WHERE user_id = ? ORDER BY id ASC',
      [requireUserId(req)],
    );
    res.json({ tasks: rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const name = String(req.body?.name || '').trim();
    const invalidName = taskNameError(name);
    if (invalidName) throw new HttpError(400, invalidName);
    const [result] = await getPool().query<ResultSetHeader>(
      'INSERT INTO tasks (user_id, name, is_default) VALUES (?, ?, 0)',
      [userId, name],
    );
    res.status(201).json({ task: { id: result.insertId, name, isDefault: 0 } });
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      next(new HttpError(409, '任务库中已有同名任务'));
      return;
    }
    next(error);
  }
});

app.patch('/api/tasks/:taskId', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const taskId = Number(req.params.taskId);
    const name = String(req.body?.name || '').trim();
    if (!Number.isInteger(taskId) || taskId <= 0) {
      throw new HttpError(400, '任务编号不正确');
    }
    const invalidName = taskNameError(name);
    if (invalidName) throw new HttpError(400, invalidName);
    const pool = getPool();
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, is_default AS isDefault FROM tasks WHERE user_id = ? AND id = ? LIMIT 1',
      [userId, taskId],
    );
    if (!existing.length) throw new HttpError(404, '任务不存在或已被删除');
    await pool.query(
      'UPDATE tasks SET name = ? WHERE user_id = ? AND id = ?',
      [name, userId, taskId],
    );
    res.json({ task: { id: taskId, name, isDefault: existing[0].isDefault } });
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      next(new HttpError(409, '任务库中已有同名任务'));
      return;
    }
    next(error);
  }
});

app.delete('/api/tasks/:taskId', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      throw new HttpError(400, '任务编号不正确');
    }
    const [result] = await getPool().query<ResultSetHeader>(
      'DELETE FROM tasks WHERE user_id = ? AND id = ?',
      [userId, taskId],
    );
    if (!result.affectedRows) throw new HttpError(404, '任务不存在或已被删除');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/days/:date', requireAuth, async (req, res, next) => {
  try {
    const date = requireDate(String(req.params.date));
    res.json(await dayPayload(requireUserId(req), date));
  } catch (error) {
    next(error);
  }
});

app.put('/api/days/:date/tasks', requireAuth, async (req, res, next) => {
  const connection = await getPool().getConnection();
  try {
    const userId = requireUserId(req);
    const date = requireDate(String(req.params.date));
    const input = req.body?.taskIds;
    if (!Array.isArray(input) || input.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new HttpError(400, '任务安排格式不正确');
    }
    const taskIds = [...new Set(input)] as number[];
    if (taskIds.length > 100) throw new HttpError(400, '每天最多安排 100 项任务');
    if (taskIds.length) {
      const placeholders = taskIds.map(() => '?').join(',');
      const [owned] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM tasks WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...taskIds],
      );
      if (owned.length !== taskIds.length) throw new HttpError(400, '任务库中不存在所选任务');
    }

    await connection.beginTransaction();
    const [existingRows] = await connection.query<RowDataPacket[]>(
      'SELECT task_id FROM day_tasks WHERE user_id = ? AND task_date = ?',
      [userId, date],
    );
    const existingIds = new Set(existingRows.map((row) => Number(row.task_id)));
    const selectedIds = new Set(taskIds);
    const toRemove = [...existingIds].filter((id) => !selectedIds.has(id));
    const toAdd = taskIds.filter((id) => !existingIds.has(id));
    if (toRemove.length) {
      const placeholders = toRemove.map(() => '?').join(',');
      await connection.query(
        `DELETE FROM day_tasks WHERE user_id = ? AND task_date = ? AND task_id IN (${placeholders})`,
        [userId, date, ...toRemove],
      );
    }
    if (toAdd.length) {
      await connection.query(
        'INSERT INTO day_tasks (user_id, task_date, task_id) VALUES ?',
        [toAdd.map((taskId) => [userId, date, taskId])],
      );
    }
    await connection.commit();
    res.json(await dayPayload(userId, date));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post('/api/days/:date/tasks', requireAuth, async (req, res, next) => {
  const connection = await getPool().getConnection();
  try {
    const userId = requireUserId(req);
    const date = requireDate(String(req.params.date));
    const name = String(req.body?.name || '').trim();
    const invalidName = taskNameError(name);
    if (invalidName) throw new HttpError(400, invalidName);

    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO tasks (user_id, name, is_default) VALUES (?, ?, 0)',
      [userId, name],
    );
    await connection.query(
      'INSERT INTO day_tasks (user_id, task_date, task_id) VALUES (?, ?, ?)',
      [userId, date, result.insertId],
    );
    await connection.commit();
    res.status(201).json(await dayPayload(userId, date));
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      next(new HttpError(409, '任务库中已有同名任务'));
      return;
    }
    next(error);
  } finally {
    connection.release();
  }
});

app.patch('/api/days/:date/tasks/:taskId', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const date = requireDate(String(req.params.date));
    const taskId = Number(req.params.taskId);
    const completed = req.body?.completed;
    if (!Number.isInteger(taskId) || taskId <= 0 || typeof completed !== 'boolean') {
      throw new HttpError(400, '打卡状态格式不正确');
    }
    const [result] = await getPool().query<ResultSetHeader>(
      `UPDATE day_tasks
       SET completed = ?, completed_at = ${completed ? 'NOW()' : 'NULL'}
       WHERE user_id = ? AND task_date = ? AND task_id = ?`,
      [completed ? 1 : 0, userId, date, taskId],
    );
    if (!result.affectedRows) throw new HttpError(404, '当天没有安排该任务');
    res.json(await dayPayload(userId, date));
  } catch (error) {
    next(error);
  }
});

app.get('/api/calendar', requireAuth, async (req, res, next) => {
  try {
    const month = String(req.query.month || '');
    if (!isMonthKey(month)) throw new HttpError(400, '月份格式不正确');
    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    const [rows] = await getPool().query<DayStatsRow[]>(
      `SELECT task_date, COUNT(*) AS total, COALESCE(SUM(completed), 0) AS completed
       FROM day_tasks
       WHERE user_id = ? AND task_date >= ? AND task_date < ?
       GROUP BY task_date`,
      [requireUserId(req), `${month}-01`, nextMonth],
    );
    const days: Record<string, { total: number; completed: number }> = {};
    for (const row of rows) {
      days[row.task_date] = { total: Number(row.total), completed: Number(row.completed) };
    }
    res.json({ month, days });
  } catch (error) {
    next(error);
  }
});

app.get('/api/streak', requireAuth, async (req, res, next) => {
  try {
    const today = requireDate(String(req.query.today || ''));
    res.json(await streakPayload(requireUserId(req), today));
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, '../dist');
if (fs.existsSync(distDir)) {
  app.get('/', (_req, res) => {
    res.redirect(302, `${APP_BASE}/`);
  });

  app.use(APP_BASE, express.static(distDir));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) {
      next();
      return;
    }
    if (req.path === APP_BASE || req.path.startsWith(`${APP_BASE}/`)) {
      res.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: unknown) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ message: '请求内容不是有效的 JSON' });
    return;
  }
  console.error(error);
  res.status(500).json({ message: '服务器暂时无法处理请求，请稍后重试' });
});

await initDatabase();
if (!isProduction() && !process.env.WX_APPID) {
  console.warn(
    '[微信登录] 未配置 WX_APPID：本机开发者工具会使用模拟微信账号；上线前请配置 WX_APPID/WX_SECRET。',
  );
}
/**
 * 监听地址可通过 HOST 覆盖：服务器上只绑定 127.0.0.1，由 Nginx 对外，
 * 避免 3001 绕过反向代理直接暴露在公网。
 */
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Growth Check-in API listening on http://${host}:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
