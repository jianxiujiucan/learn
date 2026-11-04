import Taro from '@tarojs/taro';
import type { User } from '../types';

const TOKEN_KEY = 'growth_token';
const USER_KEY = 'growth_user';

export function getToken(): string {
  const value = Taro.getStorageSync(TOKEN_KEY);
  return typeof value === 'string' ? value : '';
}

export function getStoredUser(): User | null {
  const value = Taro.getStorageSync(USER_KEY);
  if (value && typeof value === 'object' && typeof value.username === 'string') {
    return value as User;
  }
  return null;
}

export function setAuth(token: string, user: User): void {
  Taro.setStorageSync(TOKEN_KEY, token);
  Taro.setStorageSync(USER_KEY, user);
}

export function clearAuth(): void {
  Taro.removeStorageSync(TOKEN_KEY);
  Taro.removeStorageSync(USER_KEY);
}
