export interface User {
  id: number;
  username: string;
}

export interface LibraryTask {
  id: number;
  name: string;
  isDefault: number | boolean;
}

export interface DayTask {
  id: number;
  name: string;
  completed: boolean;
  completedAt: string | null;
}

export interface DayData {
  date: string;
  tasks: DayTask[];
  total: number;
  completed: number;
}

export interface DayStats {
  total: number;
  completed: number;
}

export type CalendarStats = Record<string, DayStats>;
