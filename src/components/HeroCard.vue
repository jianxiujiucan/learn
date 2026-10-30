<script setup lang="ts">
import { computed } from 'vue';
import { formatDateLabel } from '../utils/date';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  date: string;
  completed: number;
  total: number;
  streak: number;
}>();

const circumference = 282.743;
const progress = computed(() => props.total ? props.completed / props.total : 0);
const dashOffset = computed(() => circumference * (1 - progress.value));
const dateLabel = computed(() => formatDateLabel(props.date));
</script>

<template>
  <section class="hero-card" aria-label="当日打卡概览">
    <div class="hero-copy">
      <p class="hero-date">{{ dateLabel }}</p>
      <h2>小步向前</h2>
      <p class="hero-subtitle">
        {{ total ? `今天已经完成了 ${completed} 项，继续保持吧` : '给今天安排一个小目标吧' }}
      </p>
      <div class="streak-pill">
        <AppIcon name="flame" :size="13" />
        连续打卡 {{ streak }} 天
      </div>
    </div>
    <div class="progress-ring" aria-label="今日完成进度">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring-track" cx="50" cy="50" r="45" />
        <circle
          class="ring-value"
          cx="50"
          cy="50"
          r="45"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
        />
      </svg>
      <div class="ring-label">
        <strong>{{ completed }}<span>/{{ total }}</span></strong>
        <small>今日完成</small>
      </div>
    </div>
    <svg class="hero-leaf" viewBox="0 0 67 43" fill="none" aria-hidden="true">
      <path d="M3 40C19 26 35 15 62 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <path d="M24 25C15 25 11 20 11 14c8-1 14 3 13 11ZM39 16c-2-8 2-13 8-15 3 7 0 13-8 15ZM45 14c7-1 12 2 14 7-6 4-12 1-14-7Z" fill="currentColor" />
    </svg>
  </section>
</template>

<style scoped lang="scss">
.hero-card {
  position: relative;
  min-height: 11rem;
  padding: 1.4375rem 1.5rem;
  overflow: hidden;
  color: var(--color-surface);
  background: linear-gradient(125deg, var(--color-primary) 0%, var(--color-primary) 64%, var(--color-gradient-end) 100%);
  border-radius: 1.75rem;
  box-shadow: 0 1rem 1.875rem var(--color-shadow);
}
.hero-card::before {
  content: '';
  position: absolute;
  width: 11.25rem;
  height: 11.25rem;
  top: -5.9375rem;
  right: -4.0625rem;
  border: 0.0625rem solid var(--color-white-alpha);
  border-radius: 50%;
}
.hero-copy { position: relative; z-index: 1; max-width: calc(100% - 7rem); }
.hero-date {
  color: var(--color-hero-muted);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
}
.hero-copy h2 {
  margin-top: 0.375rem;
  font-size: 1.625rem;
  line-height: 1.35;
  letter-spacing: 0;
}
.hero-subtitle {
  margin-top: 0.3125rem;
  color: var(--color-hero-text);
  font-size: 0.6875rem;
  line-height: 1.6;
}
.streak-pill {
  width: fit-content;
  margin-top: 0.875rem;
  padding: 0.3125rem 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  color: var(--color-primary-deep);
  background: var(--color-accent);
  border-radius: 62.4375rem;
  font-size: 0.625rem;
  font-weight: 600;
}
.streak-pill .app-icon { color: var(--color-primary); }
.progress-ring {
  position: absolute;
  z-index: 2;
  top: 1.75rem;
  right: 1.5rem;
  width: 7rem;
  height: 7rem;
}
.progress-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.progress-ring circle { fill: none; stroke-width: 7; }
.ring-track { stroke: var(--color-white-alpha); }
.ring-value {
  stroke: var(--color-accent);
  stroke-linecap: round;
  transition: stroke-dashoffset 300ms ease;
}
.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-label strong { font-size: 1.5625rem; line-height: 1.2; }
.ring-label strong span { color: var(--color-hero-muted); font-size: 0.8125rem; font-weight: 500; }
.ring-label small { margin-top: 0.25rem; color: var(--color-hero-muted); font-size: 0.5625rem; letter-spacing: 0.08em; }
.hero-leaf {
  position: absolute;
  right: 1.8125rem;
  bottom: 0.9375rem;
  width: 4.1875rem;
  color: var(--color-accent);
  opacity: 0.48;
  transform: rotate(-8deg);
}

</style>
