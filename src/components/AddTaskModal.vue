<script setup lang="ts">
import { ref } from 'vue';
import { taskNameError } from '../../shared/validation';
import { formatDateLabel } from '../utils/date';
import BaseModal from './BaseModal.vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  date: string;
  saving: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  save: [name: string];
  clearError: [];
}>();
const name = ref('');
const localError = ref('');

function submit() {
  localError.value = taskNameError(name.value) || '';
  if (!localError.value) emit('save', name.value.trim());
}
</script>

<template>
  <BaseModal
    title="新增任务"
    :subtitle="`${formatDateLabel(date)} · 新任务会加入任务库`"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="submit">
      <label class="field-label" for="new-task-name">任务名称</label>
      <input
        id="new-task-name"
        v-model="name"
        class="task-input"
        :class="{ invalid: localError || props.error }"
        type="text"
        maxlength="20"
        placeholder="例如：阅读 20 分钟"
        @input="localError = ''; emit('clearError')"
      />
      <div class="field-meta">
        <p v-if="localError || props.error" class="error-text">{{ localError || props.error }}</p>
        <p v-else>让目标具体一点，更容易完成</p>
        <span>{{ name.length }}/20</span>
      </div>
      <button class="sheet-submit" type="submit" :disabled="saving">
        <AppIcon name="plus" :size="18" />
        {{ saving ? '正在添加…' : '添加并安排到当天' }}
      </button>
    </form>
  </BaseModal>
</template>

<style scoped lang="scss">
.field-label { display: block; margin: 1.25rem 0 0.5rem; font-size: 0.75rem; font-weight: 600; }
.task-input {
  width: 100%;
  min-height: 3.125rem;
  padding: 0.75rem 0.875rem;
  color: var(--color-text);
  background: var(--color-background);
  border: 0.0625rem solid var(--color-border-strong);
  border-radius: 0.8125rem;
  outline: 0;
}
.task-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 0.1875rem var(--color-focus); }
.task-input.invalid { border-color: var(--color-danger); }
.task-input::placeholder { color: var(--color-text-muted); }
.field-meta {
  min-height: 1.5625rem;
  margin-top: 0.375rem;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.625rem;
}
.error-text { color: var(--color-danger); }
.sheet-submit {
  width: 100%;
  min-height: 2.9375rem;
  margin-top: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4375rem;
  color: var(--color-primary-deep);
  background: var(--color-accent);
  border: 0;
  border-radius: 0.875rem;
  font-weight: 700;
}
</style>
