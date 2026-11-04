import Taro from '@tarojs/taro';
import type { CalendarStats, DayData, LibraryTask, User } from '../types';
import { clearAuth, getToken } from '../utils/auth';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const FALLBACK_API_BASE = 'http://127.0.0.1:3001';
const configuredBase =
  typeof API_BASE_URL === 'string' ? API_BASE_URL.trim() : '';
const BASE_URL = (configuredBase || FALLBACK_API_BASE).replace(/\/+$/, '');

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  data?: unknown;
}

function redirectToLogin(): void {
  const pages = Taro.getCurrentPages();
  const current = pages[pages.length - 1];
  if (current?.route?.includes('pages/login/index')) return;
  void Taro.reLaunch({ url: '/pages/login/index' }).catch(() => undefined);
}

function handleUnauthorized(): void {
  clearAuth();
  redirectToLogin();
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = getToken();
    if (token) header.Authorization = `Bearer ${token}`;

    // 微信 wx.request 不支持 PATCH，改用 POST + 方法覆盖头。
    const method = options.method || 'GET';
    const requestMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' =
      method === 'PATCH' ? 'POST' : method;
    if (method === 'PATCH') header['X-HTTP-Method-Override'] = 'PATCH';

    void Taro.request({
      url: `${BASE_URL}${path}`,
      method: requestMethod,
      data: options.data,
      header,
      timeout: 12000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }

        const body = response.data as { message?: unknown } | undefined;
        const message = body && typeof body.message === 'string' ? body.message : '';
        if (response.statusCode === 401) handleUnauthorized();
        reject(new ApiError(response.statusCode, message || '请求失败，请稍后重试'));
      },
      fail() {
        reject(new ApiError(0, '网络连接失败，请检查网络后重试'));
      },
    });
  });
}

export const api = {
  me() {
    return request<{ user: User }>('/api/auth/me');
  },
  login(username: string, password: string) {
    return request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      data: { username, password },
    });
  },
  wechatLogin(code: string, today: string) {
    return request<{ user: User; token: string }>('/api/auth/wechat', {
      method: 'POST',
      data: { code, today },
    });
  },
  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },
  tasks() {
    return request<{ tasks: LibraryTask[] }>('/api/tasks');
  },
  renameTask(taskId: number, name: string) {
    return request<{ task: LibraryTask }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      data: { name },
    });
  },
  deleteTask(taskId: number) {
    return request<{ ok: boolean }>(`/api/tasks/${taskId}`, { method: 'DELETE' });
  },
  day(date: string) {
    return request<DayData>(`/api/days/${date}`);
  },
  arrange(date: string, taskIds: number[]) {
    return request<DayData>(`/api/days/${date}/tasks`, {
      method: 'PUT',
      data: { taskIds },
    });
  },
  addTask(date: string, name: string) {
    return request<DayData>(`/api/days/${date}/tasks`, {
      method: 'POST',
      data: { name },
    });
  },
  setCompleted(date: string, taskId: number, completed: boolean) {
    return request<DayData>(`/api/days/${date}/tasks/${taskId}`, {
      method: 'PATCH',
      data: { completed },
    });
  },
  calendar(month: string) {
    return request<{ month: string; days: CalendarStats }>(`/api/calendar?month=${month}`);
  },
  streak(today: string) {
    return request<{ streak: number }>(`/api/streak?today=${today}`);
  },
};
