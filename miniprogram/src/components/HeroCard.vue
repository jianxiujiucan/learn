<script setup lang="ts">
import { computed } from 'vue';
import { formatDateLabel } from '../utils/date';

const props = defineProps<{
  date: string;
  completed: number;
  total: number;
  streak: number;
}>();

const dateLabel = computed(() => formatDateLabel(props.date));
const progress = computed(() => (props.total ? props.completed / props.total : 0));
const ringStyle = computed(() => {
  const angle = Math.round(progress.value * 360);
  return [
    'background: conic-gradient(',
    '#fee33c 0deg, #fee33c ',
    `${angle}deg, rgba(255, 255, 255, 0.18) `,
    `${angle}deg, rgba(255, 255, 255, 0.18) 360deg)`,
  ].join('');
});
</script>

<template>
  <view class="hero-card">
    <view class="hero-copy">
      <text class="hero-date">{{ dateLabel }}</text>
      <text class="hero-title">小步向前</text>
      <text class="hero-subtitle">
        {{ total ? `今天已经完成了 ${completed} 项，继续保持吧` : '给今天安排一个小目标吧' }}
      </text>
      <view class="streak-pill">
        <view class="streak-dot"></view>
        <text>连续打卡 {{ streak }} 天</text>
      </view>
    </view>
    <view class="ring" :style="ringStyle">
      <view class="ring-inner">
        <text class="ring-value">{{ completed }}<text class="ring-total">/{{ total }}</text></text>
        <text class="ring-label">今日完成</text>
      </view>
    </view>
    <view class="hero-decoration"></view>
  </view>
</template>
