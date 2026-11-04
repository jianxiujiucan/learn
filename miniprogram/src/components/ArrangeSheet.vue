<script setup lang="ts">
import { computed, ref } from 'vue';
import { api, ApiError } from '../api';
import type { LibraryTask } from '../types';
import { formatDateLabel } from '../utils/date';
import { taskNameError } from '../utils/validation';

const props = defineProps<{
  tasks: LibraryTask[];
  selectedIds: number[];
  date: string;
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [taskIds: number[]];
  renamed: [task: LibraryTask];
  deleted: [taskId: number];
}>();

const selected = ref<number[]>([...props.selectedIds]);
const editingId = ref<number | null>(null);
const editingName = ref('');
const deleteTargetId = ref<number | null>(null);
const mutating = ref(false);
const actionError = ref('');

const dateLabel = computed(() => formatDateLabel(props.date));
const busy = computed(() => props.saving || mutating.value);
const listStyle = computed(() => {
  if (!props.tasks.length) return 'height: 80px;';
  return `height: ${Math.min(props.tasks.length * 51 + 2, 340)}px;`;
});

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : '操作失败，请检查网络后重试';
}

function isSelected(taskId: number): boolean {
  return selected.value.indexOf(taskId) >= 0;
}

function toggle(taskId: number): void {
  if (busy.value) return;
  if (isSelected(taskId)) {
    selected.value = selected.value.filter((id) => id !== taskId);
  } else {
    selected.value = [...selected.value, taskId];
  }
}

function selectAll(): void {
  if (busy.value) return;
  selected.value = props.tasks.map((task) => task.id);
}

function clearAll(): void {
  if (busy.value) return;
  selected.value = [];
}

function beginEdit(task: LibraryTask): void {
  if (busy.value) return;
  editingId.value = task.id;
  editingName.value = task.name;
  deleteTargetId.value = null;
  actionError.value = '';
}

function cancelEdit(): void {
  editingId.value = null;
  editingName.value = '';
}

function onEditInput(event: { detail: { value: string } }): void {
  editingName.value = event.detail.value;
  actionError.value = '';
}

async function saveEdit(): Promise<void> {
  if (editingId.value === null || busy.value) return;
  const taskId = editingId.value;
  const name = editingName.value.trim();
  const validationError = taskNameError(name);
  if (validationError) {
    actionError.value = validationError;
    return;
  }

  mutating.value = true;
  actionError.value = '';
  try {
    const response = await api.renameTask(taskId, name);
    emit('renamed', response.task);
    cancelEdit();
  } catch (error) {
    actionError.value = errorText(error);
  } finally {
    mutating.value = false;
  }
}

function requestDelete(task: LibraryTask): void {
  if (busy.value) return;
  deleteTargetId.value = task.id;
  editingId.value = null;
  actionError.value = '';
}

function cancelDelete(): void {
  deleteTargetId.value = null;
}

async function confirmDelete(): Promise<void> {
  if (deleteTargetId.value === null || busy.value) return;
  const taskId = deleteTargetId.value;
  mutating.value = true;
  actionError.value = '';
  try {
    await api.deleteTask(taskId);
    selected.value = selected.value.filter((id) => id !== taskId);
    emit('deleted', taskId);
    deleteTargetId.value = null;
  } catch (error) {
    actionError.value = errorText(error);
  } finally {
    mutating.value = false;
  }
}

function save(): void {
  if (busy.value) return;
  emit('save', [...selected.value]);
}
</script>

<template>
  <view class="sheet-overlay">
    <view class="sheet-backdrop" @tap="emit('close')"></view>
    <view class="sheet">
      <view class="sheet-handle"></view>
      <view class="sheet-header">
        <view class="sheet-header-main">
          <text class="sheet-title">安排当日任务</text>
          <text class="sheet-subtitle">{{ dateLabel }} · 管理任务库并选择当日事项</text>
        </view>
        <view class="sheet-close" @tap="emit('close')">×</view>
      </view>

      <view class="selection-tools">
        <text>已选择 {{ selected.length }} 项</text>
        <view class="selection-tool-actions">
          <view class="text-btn" @tap="selectAll">全选</view>
          <view class="text-btn" @tap="clearAll">清空</view>
        </view>
      </view>

      <text v-if="actionError" class="action-error">{{ actionError }}</text>

      <scroll-view :scroll-y="true" class="sheet-scroll" :style="listStyle">
        <view v-if="!tasks.length" class="library-empty">
          暂无任务，请先通过主页面新增任务。
        </view>
        <view v-else class="selection-list">
          <view v-for="task in tasks" :key="task.id" class="selection-row">
            <view v-if="deleteTargetId === task.id" class="delete-row">
              <view class="delete-message">
                <text class="delete-title">删除“{{ task.name }}”？</text>
                <text class="delete-sub">将从所有日期的安排中移除</text>
              </view>
              <view class="row-actions">
                <view class="mini-btn danger" @tap="confirmDelete">删除</view>
                <view class="mini-btn" @tap="cancelDelete">取消</view>
              </view>
            </view>

            <view v-else-if="editingId === task.id" class="edit-form">
              <input
                class="edit-input"
                :value="editingName"
                :maxlength="20"
                placeholder="任务名称"
                placeholder-style="color: #82917f"
                @input="onEditInput"
              />
              <view class="row-actions">
                <view class="mini-btn" @tap="saveEdit">保存</view>
                <view class="mini-btn" @tap="cancelEdit">取消</view>
              </view>
            </view>

            <view v-else class="task-select-row">
              <view class="task-select" @tap="toggle(task.id)">
                <view class="selection-check" :class="{ checked: isSelected(task.id) }">
                  <view class="check-mark"></view>
                </view>
                <text class="task-name">{{ task.name }}</text>
              </view>
              <view class="row-actions">
                <view class="mini-btn" @tap="beginEdit(task)">修改</view>
                <view class="mini-btn danger" @tap="requestDelete(task)">删除</view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="sheet-submit" :class="{ 'is-disabled': busy }" @tap="save">
        {{ saving ? '正在保存…' : `保存安排（${selected.length} 项）` }}
      </view>
    </view>
  </view>
</template>
