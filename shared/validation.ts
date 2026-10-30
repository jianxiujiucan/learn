export const USERNAME_PATTERN = /^[\p{L}\p{N}_]{2,20}$/u;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

export function usernameError(value: string): string | null {
  const username = value.trim();
  if (!username) return '请输入用户名';
  if (!USERNAME_PATTERN.test(username)) {
    return '用户名需为 2–20 位中文、字母、数字或下划线';
  }
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return '请输入密码';
  if (!PASSWORD_PATTERN.test(value)) {
    return '密码需为 8–64 位，且同时包含字母和数字';
  }
  return null;
}

export function taskNameError(value: string): string | null {
  const name = value.trim();
  if (!name) return '请输入任务名称';
  if (name.length > 20) return '任务名称最多 20 个字';
  return null;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}
