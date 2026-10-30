import mysql, { type Pool } from 'mysql2/promise';

export const DEFAULT_TASKS = [
  '语文作业',
  '英语校内作业',
  '英语校外作业',
  '数学作业',
  '吃药',
  '收拾书包',
  '收拾玩具',
] as const;

const databaseName = process.env.DB_NAME || 'growth_checkin';
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error('DB_NAME 只能包含字母、数字和下划线');
}

const connectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool: Pool;

export async function initDatabase(): Promise<void> {
  const connection = await mysql.createConnection(connectionOptions);
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }

  pool = mysql.createPool({
    ...connectionOptions,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    charset: 'utf8mb4',
  });

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(20) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_expiry (expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(20) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tasks_user_name (user_id, name),
      INDEX idx_tasks_user (user_id),
      CONSTRAINT fk_tasks_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS day_tasks (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      task_date DATE NOT NULL,
      task_id INT UNSIGNED NOT NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_day_tasks (user_id, task_date, task_id),
      INDEX idx_day_tasks_user_date (user_id, task_date),
      INDEX idx_day_tasks_task (task_id),
      CONSTRAINT fk_day_tasks_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_day_tasks_task FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

export function getPool(): Pool {
  if (!pool) throw new Error('数据库尚未初始化');
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
}
