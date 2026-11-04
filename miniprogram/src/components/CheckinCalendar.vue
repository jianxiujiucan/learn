<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarStats } from '../types';
import { calendarCells, formatMonthLabel } from '../utils/date';

const props = defineProps<{
  viewMonth: string;
  selectedDate: string;
  stats: CalendarStats;
  loading: boolean;
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

function hasTasks(key: string): boolean {
  return Boolean(props.stats[key] && props.stats[key].total > 0);
}
</script>

<template>
  <view class="calendar-card" :class="{ 'is-loading': loading }">
    <view class="calendar-header">
      <view class="month-title" @tap="emit('today')">
        <view class="calendar-icon"></view>
        <text class="month-title-text">{{ monthLabel }}</text>
      </view>
      <view class="month-actions">
        <view class="month-arrow" @tap="emit('navigate', -1)">‹</view>
        <view class="month-arrow" @tap="emit('navigate', 1)">›</view>
      </view>
    </view>
    <view class="weekdays">
      <text v-for="day in weekdays" :key="day" class="weekday">{{ day }}</text>
    </view>
    <view class="calendar-grid">
      <view
        v-for="cell in cells"
        :key="cell.key"
        class="day-cell"
        :class="[
          cellState(cell.key),
          {
            outside: !cell.inCurrentMonth,
            selected: cell.key === selectedDate,
            today: cell.isToday,
          },
        ]"
        @tap="emit('select', cell.key)"
      >
        <text class="day-number">{{ cell.day }}</text>
        <view v-if="hasTasks(cell.key)" class="day-dot"></view>
      </view>
    </view>
  </view>
</template>
