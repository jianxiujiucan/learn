export const TASK_NAME_MAX = 20;

export function taskNameError(value: string): string | null {
  const name = value.trim();
  if (!name) return '请输入任务名称';
  if (name.length > TASK_NAME_MAX) return `任务名称最多 ${TASK_NAME_MAX} 个字`;
  return null;
}
