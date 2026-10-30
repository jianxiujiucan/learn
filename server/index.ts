import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { closeDatabase, DEFAULT_TASKS, getPool, initDatabase } from './db.js';
import { createSession, destroySession, requireAuth } from './auth.js';
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
      const taskValues = DEFAULT_TASKS.map((name) => [userId, name, 1]);
      const [taskResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO tasks (user_id, name, is_default) VALUES ?',
        [taskValues],
      );
      const dayValues = DEFAULT_TASKS.map((_name, index) => [
        userId,
        today,
        taskResult.insertId + index,
      ]);
      await connection.query(
        'INSERT INTO day_tasks (user_id, task_date, task_id) VALUES ?',
        [dayValues],
      );
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

    await createSession(userId, res);
    res.status(201).json({ user: { id: userId, username } });
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
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [username],
    );
    const user = rows[0] as { id: number; username: string; password_hash: string } | undefined;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, '用户名或密码不正确');
    }
    await createSession(user.id, res);
    res.json({ user: { id: user.id, username: user.username } });
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
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
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
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Growth Check-in API listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
