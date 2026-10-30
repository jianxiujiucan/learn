<script setup lang="ts">
import { computed, ref } from 'vue';
import { api, ApiError } from '../api';
import { taskNameError } from '../../shared/validation';
import type { LibraryTask } from '../types';
import { formatDateLabel } from '../utils/date';
import BaseModal from './BaseModal.vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  tasks: LibraryTask[];
  selectedIds: number[];
  date: string;
  saving: boolean;
}>();
const emit = defineEmits<{
  close: [];
  save: [taskIds: number[]];
  created: [task: LibraryTask];
  renamed: [task: LibraryTask];
  deleted: [taskId: number];
}>();

const selected = ref(new Set(props.selectedIds));
const newTaskName = ref('');
const editingId = ref<number | null>(null);
const editingName = ref('');
const deleteTarget = ref<LibraryTask | null>(null);
const mutating = ref(false);
const actionError = ref('');
const selectedCount = computed(() => selected.value.size);
const busy = computed(() => props.saving || mutating.value);

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : '操作失败，请检查网络后重试';
}

function toggle(taskId: number) {
  const next = new Set(selected.value);
  if (next.has(taskId)) next.delete(taskId);
  else next.add(taskId);
  selected.value = next;
}

async function createTask() {
  const name = newTaskName.value.trim();
  const validationError = taskNameError(name);
  if (validationError) {
    actionError.value = validationError;
    return;
  }
  if (busy.value) return;
  mutating.value = true;
  actionError.value = '';
  try {
    const response = await api.createTask(name);
    emit('created', response.task);
    selected.value = new Set([...selected.value, response.task.id]);
    newTaskName.value = '';
  } catch (error) {
    actionError.value = errorText(error);
  } finally {
    mutating.value = false;
  }
}

function beginEdit(task: LibraryTask) {
  editingId.value = task.id;
  editingName.value = task.name;
  deleteTarget.value = null;
  actionError.value = '';
}

async function saveEdit() {
  if (editingId.value === null || busy.value) return;
  const name = editingName.value.trim();
  const validationError = taskNameError(name);
  if (validationError) {
    actionError.value = validationError;
    return;
  }
  const taskId = editingId.value;
  mutating.value = true;
  actionError.value = '';
  try {
    const response = await api.renameTask(taskId, name);
    emit('renamed', response.task);
    editingId.value = null;
  } catch (error) {
    actionError.value = errorText(error);
  } finally {
    mutating.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value || busy.value) return;
  const taskId = deleteTarget.value.id;
  mutating.value = true;
  actionError.value = '';
  try {
    await api.deleteTask(taskId);
    const next = new Set(selected.value);
    next.delete(taskId);
    selected.value = next;
    emit('deleted', taskId);
    deleteTarget.value = null;
  } catch (error) {
    actionError.value = errorText(error);
  } finally {
    mutating.value = false;
  }
}
</script>

<template>
  <BaseModal
    title="安排当日任务"
    :subtitle="`${formatDateLabel(date)} · 管理任务库并选择当日事项`"
    @close="emit('close')"
  >
    <div class="selection-tools">
      <span>已选择 {{ selectedCount }} 项</span>
      <div>
        <button type="button" :disabled="busy" @click="selected = new Set(tasks.map(task => task.id))">全选</button>
        <button type="button" :disabled="busy" @click="selected = new Set()">清空</button>
      </div>
    </div>

    <form class="library-add" @submit.prevent="createTask">
      <input
        id="arrange-new-task"
        v-model="newTaskName"
        type="text"
        maxlength="20"
        placeholder="添加新的任务事项"
        :disabled="busy"
        @input="actionError = ''"
      />
      <button id="arrange-add-submit" type="submit" :disabled="busy">
        <AppIcon name="plus" :size="16" />添加
      </button>
    </form>
    <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>

    <div v-if="!tasks.length" class="library-empty">暂无任务，请先在上方添加。</div>
    <div v-else class="selection-list">
      <div v-for="task in tasks" :key="task.id" class="selection-row">
        <template v-if="deleteTarget?.id === task.id">
          <div class="delete-message">
            <strong>删除“{{ task.name }}”？</strong>
            <span>将从所有日期的安排中移除</span>
          </div>
          <div class="row-actions">
            <button class="confirm-delete" type="button" :disabled="busy" @click="confirmDelete">删除</button>
            <button class="cancel-action" type="button" :disabled="busy" @click="deleteTarget = null">取消</button>
          </div>
        </template>

        <form v-else-if="editingId === task.id" class="edit-form" @submit.prevent="saveEdit">
          <input
            v-model="editingName"
            class="edit-input"
            type="text"
            maxlength="20"
            aria-label="任务名称"
            :disabled="busy"
            @input="actionError = ''"
          />
          <button class="icon-action" type="submit" aria-label="保存修改" :disabled="busy">
            <AppIcon name="check" :size="16" />
          </button>
          <button class="icon-action" type="button" aria-label="取消修改" :disabled="busy" @click="editingId = null">
            <AppIcon name="close" :size="16" />
          </button>
        </form>

        <template v-else>
          <label class="task-select">
            <input
              type="checkbox"
              :checked="selected.has(task.id)"
              :disabled="busy"
              @change="toggle(task.id)"
            />
            <span class="selection-check"><AppIcon name="check" :size="14" /></span>
            <span class="task-name">{{ task.name }}</span>
          </label>
          <div class="row-actions">
            <button
              class="icon-action"
              type="button"
              :aria-label="`修改任务 ${task.name}`"
              :disabled="busy"
              @click="beginEdit(task)"
            ><AppIcon name="edit" :size="16" /></button>
            <button
              class="icon-action danger"
              type="button"
              :aria-label="`删除任务 ${task.name}`"
              :disabled="busy"
              @click="deleteTarget = task; editingId = null; actionError = ''"
            ><AppIcon name="trash" :size="16" /></button>
          </div>
        </template>
      </div>
    </div>

    <button class="sheet-submit" type="button" :disabled="busy" @click="emit('save', [...selected])">
      {{ saving ? '正在保存…' : `保存安排（${selectedCount} 项）` }}
    </button>
  </BaseModal>
</template>

<style scoped lang="scss">
.selection-tools {
  margin-top: 1.125rem;
  padding-bottom: 0.5625rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text-muted);
  font-size: 0.6875rem;
}
.selection-tools > div { display: flex; gap: 0.5rem; }
.selection-tools button {
  padding: 0.1875rem 0.4375rem;
  color: var(--color-primary-dark);
  background: var(--color-primary-faint);
  border: 0;
  border-radius: 0.375rem;
  font-size: 0.625rem;
}
.library-add { margin-bottom: 0.75rem; display: flex; gap: 0.5rem; }
.library-add input {
  min-width: 0;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  flex: 1;
  color: var(--color-text);
  background: var(--color-background);
  border: 0.0625rem solid var(--color-border);
  border-radius: 0.6875rem;
  outline: 0;
  font-size: 0.75rem;
}
.library-add input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 0.1875rem var(--color-focus); }
.library-add input::placeholder { color: var(--color-text-muted); }
.library-add button {
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  color: var(--color-primary-deep);
  background: var(--color-primary-soft);
  border: 0;
  border-radius: 0.6875rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.action-error { margin: -0.25rem 0 0.625rem; color: var(--color-danger); font-size: 0.6875rem; }
.library-empty { padding: 1.5rem 0; color: var(--color-text-muted); text-align: center; font-size: 0.75rem; }
.selection-list { border-top: 0.0625rem solid var(--color-border); }
.selection-row {
  min-height: 3.1875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 0.0625rem solid var(--color-border);
}
.task-select {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6875rem;
  flex: 1;
  cursor: pointer;
}
.task-select input { position: absolute; width: 0.0625rem; height: 0.0625rem; opacity: 0; }
.selection-check {
  width: 1.375rem;
  height: 1.375rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--color-surface);
  border: 0.0938rem solid var(--color-border-strong);
  border-radius: 0.4375rem;
}
.selection-check .app-icon { opacity: 0; }
.task-select input:checked + .selection-check { background: var(--color-primary); border-color: var(--color-primary); }
.task-select input:checked + .selection-check .app-icon { opacity: 1; }
.task-select input:focus-visible + .selection-check { outline: 0.1875rem solid var(--color-focus); }
.task-name { min-width: 0; overflow-wrap: anywhere; font-size: 0.8125rem; }
.row-actions { display: flex; align-items: center; gap: 0.25rem; flex: 0 0 auto; }
.icon-action {
  width: 1.875rem;
  height: 1.875rem;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  background: var(--color-primary-faint);
  border: 0;
  border-radius: 0.5rem;
}
.icon-action.danger { color: var(--color-danger); background: var(--color-danger-soft); }
.edit-form { width: 100%; display: flex; align-items: center; gap: 0.375rem; }
.edit-input {
  min-width: 0;
  height: 2.25rem;
  padding: 0.375rem 0.625rem;
  flex: 1;
  color: var(--color-text);
  background: var(--color-background);
  border: 0.0625rem solid var(--color-primary);
  border-radius: 0.5625rem;
  outline: 0;
  font-size: 0.75rem;
}
.delete-message { min-width: 0; flex: 1; }
.delete-message strong { display: block; overflow-wrap: anywhere; color: var(--color-danger); font-size: 0.75rem; }
.delete-message span { display: block; margin-top: 0.125rem; color: var(--color-text-muted); font-size: 0.625rem; }
.confirm-delete,
.cancel-action {
  min-height: 1.875rem;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: 0.5rem;
  font-size: 0.6875rem;
}
.confirm-delete { color: var(--color-danger); background: var(--color-danger-soft); }
.cancel-action { color: var(--color-text-secondary); background: var(--color-primary-faint); }
.sheet-submit {
  width: 100%;
  min-height: 2.9375rem;
  margin-top: 1.125rem;
  color: var(--color-primary-deep);
  background: var(--color-accent);
  border: 0;
  border-radius: 0.875rem;
  font-weight: 700;
}
</style>
