<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Taro from '@tarojs/taro';
import { api, ApiError } from '../../api';
import { clearAuth, getStoredUser, getToken, setAuth } from '../../utils/auth';
import { monthKey, shiftMonth, todayKey } from '../../utils/date';
import type { CalendarStats, DayData, LibraryTask, User } from '../../types';
import HeroCard from '../../components/HeroCard.vue';
import CheckinCalendar from '../../components/CheckinCalendar.vue';
import TaskList from '../../components/TaskList.vue';
import ArrangeSheet from '../../components/ArrangeSheet.vue';
import AddTaskSheet from '../../components/AddTaskSheet.vue';

const user = ref<User | null>(null);
const selectedDate = ref(todayKey());
const viewMonth = ref(monthKey(new Date()));
const day = ref<DayData | null>(null);
const libraryTasks = ref<LibraryTask[]>([]);
const calendarStats = ref<CalendarStats>({});
const streak = ref(0);
const dayLoading = ref(true);
const calendarLoading = ref(false);
const updatingIds = ref<number[]>([]);
const arrangeOpen = ref(false);
const addOpen = ref(false);
const saving = ref(false);
const addError = ref('');
const pageError = ref('');
let dayRequest = 0;

const displayName = computed(() => {
  if (!user.value) return '';
  return user.value.isWechat ? '微信用户' : user.value.username;
});
const userInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '成');
const selectedTaskIds = computed(() => {
  if (!day.value || day.value.date !== selectedDate.value) return [];
  return day.value.tasks.map((task) => task.id);
});
const isTodaySelected = computed(() => selectedDate.value === todayKey());

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : '网络连接失败，请稍后重试';
}

function showToast(message: string): void {
  void Taro.showToast({ title: message, icon: 'none', duration: 2200 });
}

async function loadDay(): Promise<void> {
  const request = ++dayRequest;
  const date = selectedDate.value;
  dayLoading.value = true;
  try {
    const response = await api.day(date);
    if (request === dayRequest) day.value = response;
  } catch (error) {
    if (request === dayRequest) pageError.value = errorText(error);
  } finally {
    if (request === dayRequest) dayLoading.value = false;
  }
}

async function loadCalendar(): Promise<void> {
  calendarLoading.value = true;
  const month = viewMonth.value;
  try {
    const response = await api.calendar(month);
    if (response.month === viewMonth.value) calendarStats.value = response.days;
  } catch (error) {
    pageError.value = errorText(error);
  } finally {
    calendarLoading.value = false;
  }
}

async function loadStreak(): Promise<void> {
  try {
    const response = await api.streak(todayKey());
    streak.value = response.streak;
  } catch {
    streak.value = 0;
  }
}

async function refreshActivity(): Promise<void> {
  await Promise.all([loadCalendar(), loadStreak()]);
}

async function initialize(): Promise<void> {
  pageError.value = '';
  dayLoading.value = true;
  try {
    const [tasks] = await Promise.all([
      api.tasks(),
      loadDay(),
      loadCalendar(),
      loadStreak(),
    ]);
    libraryTasks.value = tasks.tasks;
  } catch (error) {
    pageError.value = errorText(error);
    dayLoading.value = false;
  }
}

async function selectDate(date: string): Promise<void> {
  if (date === selectedDate.value) return;
  selectedDate.value = date;
  const nextMonth = date.slice(0, 7);
  const monthChanged = nextMonth !== viewMonth.value;
  viewMonth.value = nextMonth;
  await Promise.all([
    loadDay(),
    monthChanged ? loadCalendar() : Promise.resolve(),
  ]);
}

async function goToday(): Promise<void> {
  selectedDate.value = todayKey();
  viewMonth.value = monthKey(new Date());
  await Promise.all([loadDay(), loadCalendar(), loadStreak()]);
}

function navigateMonth(offset: number): void {
  viewMonth.value = shiftMonth(viewMonth.value, offset);
  void loadCalendar();
}

async function toggleTask(taskId: number, completed: boolean): Promise<void> {
  const previous = day.value;
  if (!previous || updatingIds.value.indexOf(taskId) >= 0) return;
  const date = selectedDate.value;

  updatingIds.value = [...updatingIds.value, taskId];
  const optimisticTasks = previous.tasks.map((task) =>
    task.id === taskId ? { ...task, completed } : task,
  );
  day.value = {
    ...previous,
    tasks: optimisticTasks,
    completed: optimisticTasks.filter((task) => task.completed).length,
  };

  try {
    const response = await api.setCompleted(date, taskId, completed);
    if (selectedDate.value === date) day.value = response;
    await refreshActivity();
    if (response.total > 0 && response.completed === response.total && completed) {
      showToast('当日任务全部完成，真棒！');
    }
  } catch (error) {
    if (selectedDate.value === date) day.value = previous;
    showToast(errorText(error));
  } finally {
    updatingIds.value = updatingIds.value.filter((id) => id !== taskId);
  }
}

async function saveArrangement(taskIds: number[]): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  const date = selectedDate.value;
  try {
    const response = await api.arrange(date, taskIds);
    if (selectedDate.value === date) day.value = response;
    arrangeOpen.value = false;
    await refreshActivity();
    showToast(`已安排 ${taskIds.length} 项任务`);
  } catch (error) {
    showToast(errorText(error));
  } finally {
    saving.value = false;
  }
}

async function saveNewTask(name: string): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  addError.value = '';
  const date = selectedDate.value;
  try {
    const response = await api.addTask(date, name);
    if (selectedDate.value === date) day.value = response;
    const tasks = await api.tasks();
    libraryTasks.value = tasks.tasks;
    addOpen.value = false;
    await refreshActivity();
    showToast(`已添加“${name}”`);
  } catch (error) {
    addError.value = errorText(error);
  } finally {
    saving.value = false;
  }
}

async function libraryTaskRenamed(task: LibraryTask): Promise<void> {
  libraryTasks.value = libraryTasks.value.map((item) =>
    item.id === task.id ? task : item,
  );
  await Promise.all([loadDay(), refreshActivity()]);
}

async function libraryTaskDeleted(taskId: number): Promise<void> {
  libraryTasks.value = libraryTasks.value.filter((task) => task.id !== taskId);
  await Promise.all([loadDay(), refreshActivity()]);
}

function openArrange(): void {
  if (dayLoading.value) {
    showToast('正在加载当日任务，请稍候');
    return;
  }
  arrangeOpen.value = true;
}

function openAdd(): void {
  addError.value = '';
  addOpen.value = true;
}

async function logout(): Promise<void> {
  const result = await Taro.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    confirmText: '退出',
    cancelText: '取消',
  });
  if (!result.confirm) return;

  try {
    await api.logout();
  } catch {
    // 本地仍然退出，避免卡在失效状态。
  }
  clearAuth();
  await Taro.reLaunch({ url: '/pages/login/index' });
}

onMounted(async () => {
  const token = getToken();
  if (!token) {
    await Taro.reLaunch({ url: '/pages/login/index' });
    return;
  }

  const stored = getStoredUser();
  if (stored) user.value = stored;

  try {
    const response = await api.me();
    user.value = response.user;
    setAuth(token, response.user);
  } catch (error) {
    pageError.value = errorText(error);
    return;
  }

  await initialize();
});
</script>

<template>
  <view class="app-shell">
    <view class="page-orb orb-one"></view>
    <view class="page-orb orb-two"></view>

    <view class="page-content">
      <view class="app-header">
        <view class="brand">
          <view class="brand-mark">
            <view class="leaf-shape"></view>
          </view>
          <view>
            <text class="brand-title">成长打卡</text>
            <text class="brand-sub">每天完成一点点</text>
          </view>
        </view>
        <view class="header-actions">
          <view
            class="today-btn"
            :class="{ 'is-selected': isTodaySelected }"
            @tap="goToday"
          >
            今天
          </view>
          <view class="avatar">{{ userInitial }}</view>
          <view class="logout-btn" @tap="logout">退出</view>
        </view>
      </view>

      <view v-if="pageError" class="page-error">
        <text class="page-error-text">{{ pageError }}</text>
        <view class="page-error-retry" @tap="initialize">重试</view>
      </view>

      <HeroCard
        :date="selectedDate"
        :completed="day ? day.completed : 0"
        :total="day ? day.total : 0"
        :streak="streak"
      ></HeroCard>

      <CheckinCalendar
        :view-month="viewMonth"
        :selected-date="selectedDate"
        :stats="calendarStats"
        :loading="calendarLoading"
        @navigate="navigateMonth"
        @select="selectDate"
        @today="goToday"
      ></CheckinCalendar>

      <TaskList
        :day="day"
        :loading="dayLoading"
        :updating-ids="updatingIds"
        @toggle="toggleTask"
        @arrange="openArrange"
        @add="openAdd"
      ></TaskList>

      <view class="app-footer">
        <view class="footer-dot"></view>
        <text>所有记录已保存到当前账号</text>
      </view>
    </view>

    <ArrangeSheet
      v-if="arrangeOpen"
      :tasks="libraryTasks"
      :selected-ids="selectedTaskIds"
      :date="selectedDate"
      :saving="saving"
      @close="arrangeOpen = false"
      @save="saveArrangement"
      @renamed="libraryTaskRenamed"
      @deleted="libraryTaskDeleted"
    ></ArrangeSheet>

    <AddTaskSheet
      v-if="addOpen"
      :date="selectedDate"
      :saving="saving"
      :error="addError"
      @close="addOpen = false"
      @save="saveNewTask"
      @clear-error="addError = ''"
    ></AddTaskSheet>
  </view>
</template>
