<script setup lang="ts">
import type { DayData } from "../types";
import AppIcon from "./AppIcon.vue";

defineProps<{
  day: DayData | null;
  loading: boolean;
  updatingIds: Set<number>;
}>();
const emit = defineEmits<{
  toggle: [taskId: number, completed: boolean];
  arrange: [];
  add: [];
}>();
</script>

<template>
  <section class="task-section" aria-labelledby="task-title">
    <header class="task-heading">
      <div>
        <h2 id="task-title">当日任务</h2>
        <p>认真完成的每一件小事，都算数</p>
      </div>
      <span class="task-count"
        >{{ day?.completed || 0 }} / {{ day?.total || 0 }} 已完成</span
      >
    </header>
    <div
      class="task-progress"
      role="progressbar"
      aria-label="任务完成进度"
      :aria-valuenow="
        day?.total ? Math.round((day.completed / day.total) * 100) : 0
      "
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span
        :style="{
          width: `${day?.total ? (day.completed / day.total) * 100 : 0}%`,
        }"
      ></span>
    </div>

    <div v-if="loading" class="task-loading" role="status">
      正在读取当日任务…
    </div>
    <div v-else-if="!day?.tasks.length" class="empty-state">
      <AppIcon name="calendar" :size="34" />
      <h3>这一天还没有任务</h3>
      <p>点击“安排任务”选择事项，或新增一个专属任务。</p>
    </div>
    <div v-else class="task-list">
      <label
        v-for="task in day.tasks"
        :key="task.id"
        class="task-row"
        :class="{
          completed: task.completed,
          updating: updatingIds.has(task.id),
        }"
      >
        <input
          type="checkbox"
          :checked="task.completed"
          :disabled="updatingIds.has(task.id)"
          @change="
            emit('toggle', task.id, ($event.target as HTMLInputElement).checked)
          "
        />
        <span class="custom-check"><AppIcon name="check" :size="15" /></span>
        <span class="task-name">{{ task.name }}</span>
        <span class="task-tag">{{ task.completed ? "已完成" : "待完成" }}</span>
      </label>
    </div>

    <div class="task-actions">
      <button class="secondary-action" type="button" @click="emit('arrange')">
        <AppIcon name="list" :size="17" />安排任务
      </button>
      <button class="primary-action" type="button" @click="emit('add')">
        <AppIcon name="plus" :size="17" />新增任务
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.task-section {
  margin-top: 1.4375rem;
}
.task-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.task-heading h2 {
  font-size: 1.125rem;
}
.task-heading p {
  margin-top: 0.125rem;
  color: var(--color-text-muted);
  font-size: 0.6875rem;
}
.task-count {
  flex: 0 0 auto;
  padding: 0.3125rem 0.625rem;
  color: var(--color-primary-deep);
  background: var(--color-primary-soft);
  border-radius: 62.4375rem;
  font-size: 0.625rem;
  font-weight: 600;
}
.task-progress {
  height: 0.3125rem;
  margin-top: 0.8125rem;
  overflow: hidden;
  background: var(--color-track);
  border-radius: 62.4375rem;
}
.task-progress span {
  display: block;
  height: 100%;
  background: var(--color-accent);
  border-radius: inherit;
  transition: width 250ms ease;
}
.task-list {
  margin-top: 0.8125rem;
  display: flex;
  flex-direction: column;
  gap: 0.5625rem;
}
.task-row {
  min-height: 3.5625rem;
  padding: 0.625rem 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-surface);
  border: 0.0625rem solid var(--color-border);
  border-radius: 1.0625rem;
  box-shadow: 0 0.1875rem 0.625rem var(--color-shadow-card);
  cursor: pointer;
  transition: border-color 150ms ease, opacity 150ms ease;
}
.task-row:hover {
  border-color: var(--color-primary-soft);
}
.task-row.updating {
  opacity: 0.65;
}
.task-row input {
  position: absolute;
  width: 0.0625rem;
  height: 0.0625rem;
  opacity: 0;
}
.custom-check {
  width: 1.4375rem;
  height: 1.4375rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--color-surface);
  background: var(--color-surface);
  border: 0.0938rem solid var(--color-border-strong);
  border-radius: 0.5rem;
}
.custom-check .app-icon {
  opacity: 0;
}
.task-row input:focus-visible + .custom-check {
  outline: 0.1875rem solid var(--color-focus);
  outline-offset: 0.125rem;
}
.task-row.completed .custom-check {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.task-row.completed .custom-check .app-icon {
  opacity: 1;
}
.task-name {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  font-size: 0.8125rem;
  font-weight: 550;
}
.completed .task-name {
  color: var(--color-text-completed);
  text-decoration: line-through;
}
.task-tag {
  flex: 0 0 auto;
  padding: 0.2rem 0.5rem;
  color: var(--color-accent-ink);
  background: var(--color-accent-soft);
  border-radius: 0.375rem;
  font-size: 0.65rem;
}
.completed .task-tag {
  color: var(--color-text-tag);
  background: var(--color-primary-faint);
}
.task-actions {
  margin-top: 0.875rem;
  display: flex;
  gap: 0.625rem;
}
.task-actions button {
  min-height: 2.8125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4375rem;
  border-radius: 0.875rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.secondary-action {
  width: 39%;
  color: var(--color-primary-dark);
  background: var(--color-primary-pale);
  border: 0.0625rem solid var(--color-primary-soft);
}
.primary-action {
  flex: 1;
  color: var(--color-primary-deep);
  background: var(--color-accent);
  border: 0.0625rem solid var(--color-accent);
  box-shadow: 0 0.4375rem 0.9375rem var(--color-shadow);
}
.task-loading,
.empty-state {
  margin-top: 0.8125rem;
  padding: 2.1875rem 1.25rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 0.0625rem solid var(--color-border);
  border-radius: 1.125rem;
  text-align: center;
}
.empty-state .app-icon {
  margin: 0 auto 0.625rem;
  color: var(--color-primary);
}
.empty-state h3 {
  color: var(--color-text);
  font-size: 0.9375rem;
}
.empty-state p {
  margin-top: 0.3125rem;
  font-size: 0.6875rem;
}
</style>
