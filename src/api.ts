import type { CalendarStats, DayData, LibraryTask, User } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new ApiError(response.status, data.message || '请求失败，请稍后重试');
  }
  return data as T;
}

export const api = {
  async me() {
    return request<{ user: User }>('/api/auth/me');
  },
  async login(username: string, password: string) {
    return request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  async register(username: string, password: string, today: string) {
    return request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, today }),
    });
  },
  async logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },
  async tasks() {
    return request<{ tasks: LibraryTask[] }>('/api/tasks');
  },
  async renameTask(taskId: number, name: string) {
    return request<{ task: LibraryTask }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },
  async deleteTask(taskId: number) {
    return request<{ ok: boolean }>(`/api/tasks/${taskId}`, { method: 'DELETE' });
  },
  async day(date: string) {
    return request<DayData>(`/api/days/${date}`);
  },
  async arrange(date: string, taskIds: number[]) {
    return request<DayData>(`/api/days/${date}/tasks`, {
      method: 'PUT',
      body: JSON.stringify({ taskIds }),
    });
  },
  async addTask(date: string, name: string) {
    return request<DayData>(`/api/days/${date}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  async setCompleted(date: string, taskId: number, completed: boolean) {
    return request<DayData>(`/api/days/${date}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  },
  async calendar(month: string) {
    return request<{ month: string; days: CalendarStats }>(`/api/calendar?month=${month}`);
  },
  async streak(today: string) {
    return request<{ streak: number }>(`/api/streak?today=${today}`);
  },
};
