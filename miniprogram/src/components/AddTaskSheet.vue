<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatDateLabel } from '../utils/date';
import { TASK_NAME_MAX, taskNameError } from '../utils/validation';

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
const dateLabel = computed(() => formatDateLabel(props.date));

function onInput(event: { detail: { value: string } }): void {
  name.value = event.detail.value;
  localError.value = '';
  emit('clearError');
}

function submit(): void {
  if (props.saving) return;
  const validationError = taskNameError(name.value);
  localError.value = validationError || '';
  if (validationError) return;
  emit('save', name.value.trim());
}
</script>

<template>
  <view class="sheet-overlay">
    <view class="sheet-backdrop" @tap="emit('close')"></view>
    <view class="sheet">
      <view class="sheet-handle"></view>
      <view class="sheet-header">
        <view class="sheet-header-main">
          <text class="sheet-title">新增任务</text>
          <text class="sheet-subtitle">{{ dateLabel }} · 新任务会加入任务库</text>
        </view>
        <view class="sheet-close" @tap="emit('close')">×</view>
      </view>

      <text class="field-label">任务名称</text>
      <input
        class="task-input"
        :value="name"
        :maxlength="20"
        placeholder="例如：阅读 20 分钟"
        placeholder-style="color: #82917f"
        @input="onInput"
      />
      <view class="field-meta">
        <text :class="localError || error ? 'error-text' : 'field-hint'">
          {{ localError || error || '让目标具体一点，更容易完成' }}
        </text>
        <text>{{ name.length }}/{{ TASK_NAME_MAX }}</text>
      </view>

      <view class="sheet-submit add-submit" :class="{ 'is-disabled': saving }" @tap="submit">
        {{ saving ? '正在添加…' : '添加并安排到当天' }}
      </view>
    </view>
  </view>
</template>
