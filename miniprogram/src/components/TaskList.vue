<script setup lang="ts">
import { computed } from 'vue';
import type { DayData } from '../types';

const props = defineProps<{
  day: DayData | null;
  loading: boolean;
  updatingIds: number[];
}>();

const emit = defineEmits<{
  toggle: [taskId: number, completed: boolean];
  arrange: [];
  add: [];
}>();

const tasks = computed(() => (props.day ? props.day.tasks : []));
const total = computed(() => (props.day ? props.day.total : 0));
const completed = computed(() => (props.day ? props.day.completed : 0));
const progressWidth = computed(() => {
  if (!total.value) return '0%';
  return `${Math.round((completed.value / total.value) * 100)}%`;
});

function isUpdating(taskId: number): boolean {
  return props.updatingIds.indexOf(taskId) >= 0;
}
</script>

<template>
  <view class="task-section">
    <view class="task-heading">
      <view class="task-heading-main">
        <text class="task-heading-title">当日任务</text>
        <text class="task-heading-sub">认真完成的每一件小事，都算数</text>
      </view>
      <text class="task-count">{{ completed }} / {{ total }} 已完成</text>
    </view>
    <view class="task-progress">
      <view class="task-progress-fill" :style="{ width: progressWidth }"></view>
    </view>

    <view v-if="loading" class="task-loading">正在读取当日任务…</view>
    <view v-else-if="!tasks.length" class="empty-state">
      <view class="empty-icon"></view>
      <text class="empty-title">这一天还没有任务</text>
      <text class="empty-text">点击“安排任务”选择事项，或新增一个专属任务。</text>
    </view>
    <view v-else class="task-list">
      <view
        v-for="task in tasks"
        :key="task.id"
        class="task-row"
        :class="{ completed: task.completed, updating: isUpdating(task.id) }"
        @tap="emit('toggle', task.id, !task.completed)"
      >
        <view class="custom-check">
          <view class="check-mark"></view>
        </view>
        <text class="task-name">{{ task.name }}</text>
        <text class="task-tag">{{ task.completed ? '已完成' : '待完成' }}</text>
      </view>
    </view>

    <view class="task-actions">
      <view class="action-btn action-secondary" @tap="emit('arrange')">安排任务</view>
      <view class="action-btn action-primary" @tap="emit('add')">＋ 新增任务</view>
    </view>
  </view>
</template>
