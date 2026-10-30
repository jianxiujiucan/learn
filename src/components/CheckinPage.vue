<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { api, ApiError } from "../api";
import type { CalendarStats, DayData, LibraryTask, User } from "../types";
import { monthKey, shiftMonth, todayKey } from "../utils/date";
import AppIcon from "./AppIcon.vue";
import HeroCard from "./HeroCard.vue";
import CheckinCalendar from "./CheckinCalendar.vue";
import TaskList from "./TaskList.vue";
import AddTaskModal from "./AddTaskModal.vue";
import ArrangeTasksModal from "./ArrangeTasksModal.vue";

const props = defineProps<{ user: User }>();
const emit = defineEmits<{ loggedOut: [] }>();

const selectedDate = ref(todayKey());
const viewMonth = ref(monthKey(new Date()));
const day = ref<DayData | null>(null);
const libraryTasks = ref<LibraryTask[]>([]);
const calendarStats = ref<CalendarStats>({});
const streak = ref(0);
const dayLoading = ref(true);
const calendarLoading = ref(false);
const updatingIds = ref(new Set<number>());
const arrangeOpen = ref(false);
const addOpen = ref(false);
const saving = ref(false);
const addError = ref("");
const pageError = ref("");
const toast = ref("");
let dayRequest = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const userInitial = computed(() =>
  props.user.username.trim().charAt(0).toUpperCase()
);
const selectedTaskIds = computed(
  () => day.value?.tasks.map((task) => task.id) || []
);
const isTodaySelected = computed(() => selectedDate.value === todayKey());

function showToast(message: string) {
  toast.value = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 2600);
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "网络连接失败，请稍后重试";
}

async function loadDay() {
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

async function loadCalendar() {
  calendarLoading.value = true;
  try {
    const response = await api.calendar(viewMonth.value);
    if (response.month === viewMonth.value) calendarStats.value = response.days;
  } catch (error) {
    pageError.value = errorText(error);
  } finally {
    calendarLoading.value = false;
  }
}

async function loadStreak() {
  try {
    const response = await api.streak(todayKey());
    streak.value = response.streak;
  } catch {
    streak.value = 0;
  }
}

async function refreshActivity() {
  await Promise.all([loadCalendar(), loadStreak()]);
}

async function initialize() {
  pageError.value = "";
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

async function selectDate(date: string) {
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

async function goToday() {
  selectedDate.value = todayKey();
  viewMonth.value = monthKey(new Date());
  await Promise.all([loadDay(), loadCalendar(), loadStreak()]);
}

async function toggleTask(taskId: number, completed: boolean) {
  const date = selectedDate.value;
  const previous = day.value;
  if (!previous) return;
  updatingIds.value = new Set([...updatingIds.value, taskId]);
  const optimisticTasks = previous.tasks.map((task) =>
    task.id === taskId ? { ...task, completed } : task
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
    if (
      response.total > 0 &&
      response.completed === response.total &&
      completed
    ) {
      showToast("当日任务全部完成，真棒！");
    }
  } catch (error) {
    if (selectedDate.value === date) day.value = previous;
    showToast(errorText(error));
  } finally {
    const next = new Set(updatingIds.value);
    next.delete(taskId);
    updatingIds.value = next;
  }
}

async function saveArrangement(taskIds: number[]) {
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

async function saveNewTask(name: string) {
  if (saving.value) return;
  saving.value = true;
  addError.value = "";
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

async function libraryTaskRenamed(task: LibraryTask) {
  libraryTasks.value = libraryTasks.value.map((item) =>
    item.id === task.id ? task : item
  );
  await Promise.all([loadDay(), refreshActivity()]);
}

async function libraryTaskDeleted(taskId: number) {
  libraryTasks.value = libraryTasks.value.filter((task) => task.id !== taskId);
  await Promise.all([loadDay(), refreshActivity()]);
}

async function logout() {
  try {
    await api.logout();
  } catch {
    /* 本地仍会退出 */
  }
  emit("loggedOut");
}

onMounted(initialize);
onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<template>
  <main class="checkin-shell" :class="{ 'modal-open': arrangeOpen || addOpen }">
    <div class="page-orb page-orb-one" aria-hidden="true"></div>
    <div class="page-orb page-orb-two" aria-hidden="true"></div>
    <div class="checkin-app">
      <header class="app-header">
        <div class="brand">
          <div class="brand-mark"><AppIcon name="leaf" :size="25" /></div>
          <div>
            <h1>成长打卡</h1>
            <p>每天完成一点点</p>
          </div>
        </div>
        <div class="header-actions">
          <button
            class="today-button"
            :class="{ selected: isTodaySelected }"
            type="button"
            :aria-pressed="isTodaySelected"
            @click="goToday"
          >
            今天
          </button>
          <div class="user-chip" :title="`当前账号：${user.username}`">
            <span class="user-avatar"><AppIcon name="user" :size="18" /></span>
            <span class="username">{{ user.username }}</span>
          </div>
          <button
            class="logout-button"
            type="button"
            aria-label="退出登录"
            title="退出登录"
            @click="logout"
          >
            <AppIcon name="logout" :size="24" />
          </button>
        </div>
      </header>

      <div v-if="pageError" class="page-error" role="alert">
        <span>{{ pageError }}</span>
        <button type="button" @click="initialize">重试</button>
      </div>

      <div class="hero-wrapper">
        <HeroCard
          :date="selectedDate"
          :completed="day?.completed || 0"
          :total="day?.total || 0"
          :streak="streak"
        />
      </div>

      <CheckinCalendar
        :view-month="viewMonth"
        :selected-date="selectedDate"
        :stats="calendarStats"
        :loading="calendarLoading"
        @navigate="
          viewMonth = shiftMonth(viewMonth, $event);
          loadCalendar();
        "
        @select="selectDate"
        @today="goToday"
      />

      <TaskList
        :day="day"
        :loading="dayLoading"
        :updating-ids="updatingIds"
        @toggle="toggleTask"
        @arrange="arrangeOpen = true"
        @add="
          addError = '';
          addOpen = true;
        "
      />

      <footer class="app-footer">
        <AppIcon name="check" :size="13" />
        所有记录已保存到当前账号
      </footer>
    </div>

    <ArrangeTasksModal
      v-if="arrangeOpen"
      :tasks="libraryTasks"
      :selected-ids="selectedTaskIds"
      :date="selectedDate"
      :saving="saving"
      @close="arrangeOpen = false"
      @save="saveArrangement"
      @renamed="libraryTaskRenamed"
      @deleted="libraryTaskDeleted"
    />
    <AddTaskModal
      v-if="addOpen"
      :date="selectedDate"
      :saving="saving"
      :error="addError"
      @close="addOpen = false"
      @save="saveNewTask"
      @clear-error="addError = ''"
    />
    <Transition name="toast">
      <div v-if="toast" class="toast-message" role="status">{{ toast }}</div>
    </Transition>
  </main>
</template>

<style scoped lang="scss">
.checkin-shell {
  position: relative;
  min-height: 100vh;
  padding: 0;
  overflow: hidden;
  background: var(--color-background-outer);
}
.page-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
}
.page-orb-one {
  width: 20rem;
  height: 20rem;
  top: -10rem;
  right: -6.875rem;
  background: var(--color-primary-muted);
}
.page-orb-two {
  width: 14.375rem;
  height: 14.375rem;
  left: -6.875rem;
  bottom: 5%;
  background: var(--color-backdrop-highlight);
}
.checkin-app {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  padding: 5.3333333vw 4.8vw 5.8666667vw;
  background: var(--color-background);
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
}
.brand {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
.brand-mark {
  width: 2.625rem;
  height: 2.625rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--color-primary-dark);
  background: var(--color-primary-soft);
  border-radius: 0.875rem;
}
.brand h1 {
  font-size: 1.125rem;
  line-height: 1.35;
}
.brand p {
  margin-top: 0.0625rem;
  color: var(--color-text-secondary);
  font-size: 0.625rem;
  letter-spacing: 0.06em;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.today-button {
  min-height: 2.125rem;
  padding: 0.375rem 0.625rem;
  color: var(--color-primary-dark);
  background: var(--color-primary-faint);
  border: 0.0625rem solid var(--color-border);
  border-radius: 0.625rem;
  font-size: 0.6875rem;
  transition: color 150ms ease, background-color 150ms ease,
    border-color 150ms ease;
}
.today-button.selected {
  color: var(--color-surface);
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  color: var(--color-text-secondary);
}
.user-avatar {
  width: 2.125rem;
  height: 2.125rem;
  display: grid;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-pale);
  border: 0.125rem solid var(--color-surface);
  border-radius: 50%;
}
.username {
  display: none;
}
.logout-button {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  background: var(--color-transparent);
  border: 0;
  border-radius: 0.5625rem;
}
.logout-button:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.hero-wrapper {
  margin-top: 1.4375rem;
}
.page-error {
  margin-top: 1rem;
  padding: 0.625rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-radius: 0.6875rem;
  font-size: 0.6875rem;
}
.page-error button {
  padding: 0.1875rem 0.5rem;
  color: var(--color-danger);
  background: var(--color-surface);
  border: 0;
  border-radius: 0.375rem;
}
.app-footer {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3125rem;
  color: var(--color-text-muted);
  font-size: 0.5625rem;
  letter-spacing: 0.03em;
}
.app-footer .app-icon {
  color: var(--color-primary);
}
.toast-message {
  position: fixed;
  z-index: 120;
  left: 50%;
  bottom: 1.625rem;
  max-width: calc(100vw - 2.25rem);
  padding: 0.6875rem 1.125rem;
  color: var(--color-surface);
  background: var(--color-primary-deep);
  border-radius: 62.4375rem;
  box-shadow: 0 0.625rem 1.875rem var(--color-shadow-soft);
  transform: translateX(-50%);
  font-size: 0.75rem;
  text-align: center;
  pointer-events: none;
}
.checkin-shell.modal-open .toast-message {
  top: 1.375rem;
  bottom: auto;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.5rem);
}
</style>
