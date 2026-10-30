export interface CalendarCell {
  key: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function monthKey(date: Date): string {
  return dateKey(date).slice(0, 7);
}

export function shiftMonth(key: string, offset: number): string {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + offset, 1));
}

export function calendarCells(viewMonth: string): CalendarCell[] {
  const [year, month] = viewMonth.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const today = todayKey();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: dateKey(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month - 1,
      isToday: dateKey(date) === today,
    };
  });
}

export function formatDateLabel(key: string): string {
  const date = fromDateKey(key);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 · 星期${weekdays[date.getDay()]}`;
}

export function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${year}年${month}月`;
}
