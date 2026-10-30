<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarStats } from '../types';
import { calendarCells, formatMonthLabel } from '../utils/date';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  viewMonth: string;
  selectedDate: string;
  stats: CalendarStats;
  loading?: boolean;
}>();
const emit = defineEmits<{
  navigate: [offset: number];
  select: [date: string];
  today: [];
}>();

const cells = computed(() => calendarCells(props.viewMonth));
const monthLabel = computed(() => formatMonthLabel(props.viewMonth));
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

function cellState(key: string) {
  const stat = props.stats[key];
  return {
    complete: Boolean(stat && stat.total > 0 && stat.completed === stat.total),
    partial: Boolean(stat && stat.completed > 0 && stat.completed < stat.total),
  };
}

function ariaLabel(key: string, day: number) {
  const stat = props.stats[key];
  const status = stat ? `，${stat.completed}/${stat.total} 项完成` : '，无任务记录';
  return `${key}，${day}日${status}`;
}
</script>

<template>
  <section class="calendar-card" :class="{ loading }" aria-labelledby="calendar-title">
    <header class="calendar-header">
      <button class="month-title" type="button" title="回到今天" @click="emit('today')">
        <AppIcon name="calendar" :size="17" />
        <h2 id="calendar-title">{{ monthLabel }}</h2>
      </button>
      <div class="month-actions">
        <button type="button" aria-label="上个月" @click="emit('navigate', -1)">
          <AppIcon name="left" :size="16" />
        </button>
        <button type="button" aria-label="下个月" @click="emit('navigate', 1)">
          <AppIcon name="right" :size="16" />
        </button>
      </div>
    </header>
    <div class="weekdays" aria-hidden="true">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>
    <div class="calendar-grid" role="group" aria-label="选择日期">
      <button
        v-for="cell in cells"
        :key="cell.key"
        type="button"
        class="day-cell"
        :class="[
          cellState(cell.key),
          {
            outside: !cell.inCurrentMonth,
            selected: cell.key === selectedDate,
            today: cell.isToday,
          },
        ]"
        :aria-label="ariaLabel(cell.key, cell.day)"
        :aria-pressed="cell.key === selectedDate"
        @click="emit('select', cell.key)"
      >
        <span class="day-number">{{ cell.day }}</span>
        <span v-if="stats[cell.key]?.total" class="day-dot" aria-hidden="true"></span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.calendar-card {
  margin-top: 1.25rem;
  padding: 1.125rem 1.0625rem 1rem;
  background: var(--color-surface);
  border: 0.0625rem solid var(--color-border);
  border-radius: 1.5rem;
  box-shadow: 0 0.5rem 1.5rem var(--color-shadow-card);
  transition: opacity 160ms ease;
}
.calendar-card.loading { opacity: 0.65; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; }
.month-title {
  padding: 0.1875rem 0;
  display: flex;
  align-items: center;
  gap: 0.4375rem;
  color: var(--color-text);
  background: var(--color-transparent);
  border: 0;
}
.month-title .app-icon { color: var(--color-primary); }
.month-title h2 { font-size: 1rem; }
.month-actions { display: flex; gap: 0.25rem; }
.month-actions button {
  width: 1.9375rem;
  height: 1.9375rem;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  background: var(--color-primary-faint);
  border: 0;
  border-radius: 0.625rem;
}
.month-actions button:hover { color: var(--color-primary-dark); background: var(--color-primary-pale); }
.weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.weekdays {
  margin: 0.75rem 0 0.3125rem;
  color: var(--color-text-muted);
  font-size: 0.625rem;
  text-align: center;
}
.weekdays span { padding: 0.25rem 0; }
.calendar-grid { row-gap: 0.1875rem; }
.day-cell {
  position: relative;
  min-width: 0;
  height: 2.5rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  background: var(--color-transparent);
  border: 0;
  border-radius: 50%;
  font-size: 0.6875rem;
}
.day-number {
  width: 1.875rem;
  height: 1.875rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  transition: background-color 150ms ease, color 150ms ease;
}
.day-cell:hover .day-number { background: var(--color-primary-faint); }
.day-cell.complete .day-number { color: var(--color-primary-dark); background: var(--color-primary-pale); font-weight: 600; }
.day-cell.today:not(.selected) .day-number { box-shadow: inset 0 0 0 0.0625rem var(--color-primary); }
.day-cell.selected .day-number {
  color: var(--color-surface);
  background: var(--color-primary);
  box-shadow: 0 0.3125rem 0.75rem var(--color-shadow);
  font-weight: 700;
}
.day-cell.outside { color: var(--color-text-disabled); }
.day-dot {
  position: absolute;
  bottom: 0.0625rem;
  width: 0.25rem;
  height: 0.25rem;
  background: var(--color-primary);
  border-radius: 50%;
}
.day-cell.partial .day-dot { background: var(--color-accent); }
.day-cell.selected .day-dot { background: var(--color-accent); }
</style>
