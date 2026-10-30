<script setup lang="ts">
import { reactive, ref } from "vue";
import { api, ApiError } from "../api";
import { passwordError, usernameError } from "../../shared/validation";
import { todayKey } from "../utils/date";
import type { User } from "../types";
import AppIcon from "./AppIcon.vue";

const emit = defineEmits<{ authenticated: [user: User] }>();
const mode = ref<"login" | "register">("login");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirm = ref(false);
const submitting = ref(false);
const errors = reactive({
  username: "",
  password: "",
  confirm: "",
  general: "",
});

function clearErrors() {
  errors.username = "";
  errors.password = "";
  errors.confirm = "";
  errors.general = "";
}

function switchMode(next: "login" | "register") {
  mode.value = next;
  password.value = "";
  confirmPassword.value = "";
  clearErrors();
}

function validate(): boolean {
  clearErrors();
  errors.username = usernameError(username.value) || "";
  errors.password =
    mode.value === "register"
      ? passwordError(password.value) || ""
      : password.value
      ? ""
      : "请输入密码";
  if (mode.value === "register" && confirmPassword.value !== password.value) {
    errors.confirm = "两次输入的密码不一致";
  }
  return !errors.username && !errors.password && !errors.confirm;
}

async function submit() {
  if (!validate() || submitting.value) return;
  submitting.value = true;
  try {
    const response =
      mode.value === "register"
        ? await api.register(username.value.trim(), password.value, todayKey())
        : await api.login(username.value.trim(), password.value);
    emit("authenticated", response.user);
  } catch (error) {
    errors.general =
      error instanceof ApiError
        ? error.message
        : "无法连接服务器，请确认后端已启动";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-orb auth-orb-one" aria-hidden="true"></div>
    <div class="auth-orb auth-orb-two" aria-hidden="true"></div>
    <section class="auth-intro" aria-label="产品介绍">
      <div class="intro-leaf"><AppIcon name="leaf" :size="30" /></div>
      <p class="intro-eyebrow">GROWTH CHECK-IN</p>
      <h1>每天完成一点点</h1>
      <p>把小小的坚持，变成看得见的成长。</p>
    </section>

    <section
      class="auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
    >
      <!-- <header class="auth-header">
        <div class="auth-brand-icon"><AppIcon name="leaf" :size="25" /></div>
        <div>
          <h2 id="auth-title">成长打卡</h2>
          <p>
            {{
              mode === "login"
                ? "欢迎回来，继续今天的坚持"
                : "创建账号，记录每一次进步"
            }}
          </p>
        </div>
      </header> -->

      <div class="auth-tabs" role="tablist" aria-label="登录或注册">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'login'"
          :class="{ active: mode === 'login' }"
          @click="switchMode('login')"
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'register'"
          :class="{ active: mode === 'register' }"
          @click="switchMode('register')"
        >
          注册
        </button>
      </div>

      <form novalidate @submit.prevent="submit">
        <label class="field-label" for="auth-username">用户名</label>
        <div class="input-shell" :class="{ invalid: errors.username }">
          <AppIcon name="user" :size="19" />
          <input
            id="auth-username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
            maxlength="20"
            @input="errors.username = ''"
          />
        </div>
        <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
        <p v-else-if="mode === 'register'" class="field-hint">
          2–20 位中文、字母、数字或下划线
        </p>

        <label class="field-label" for="auth-password">密码</label>
        <div class="input-shell" :class="{ invalid: errors.password }">
          <AppIcon name="lock" :size="19" />
          <input
            id="auth-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            :autocomplete="
              mode === 'login' ? 'current-password' : 'new-password'
            "
            :placeholder="
              mode === 'login' ? '请输入密码' : '字母 + 数字，至少 8 位'
            "
            maxlength="64"
            @input="errors.password = ''"
          />
          <button
            class="password-toggle"
            type="button"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :title="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            <AppIcon :name="showPassword ? 'eye' : 'eye-off'" :size="20" />
          </button>
        </div>
        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        <p v-else-if="mode === 'register'" class="field-hint">
          8–64 位，需同时包含字母和数字
        </p>

        <template v-if="mode === 'register'">
          <label class="field-label" for="auth-confirm">确认密码</label>
          <div class="input-shell" :class="{ invalid: errors.confirm }">
            <AppIcon name="lock" :size="19" />
            <input
              id="auth-confirm"
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请再次输入密码"
              maxlength="64"
              @input="errors.confirm = ''"
            />
            <button
              class="password-toggle"
              type="button"
              :aria-label="showConfirm ? '隐藏确认密码' : '显示确认密码'"
              :title="showConfirm ? '隐藏确认密码' : '显示确认密码'"
              @click="showConfirm = !showConfirm"
            >
              <AppIcon :name="showConfirm ? 'eye' : 'eye-off'" :size="20" />
            </button>
          </div>
          <p v-if="errors.confirm" class="field-error">{{ errors.confirm }}</p>
        </template>

        <p v-if="errors.general" class="auth-error" role="alert">
          {{ errors.general }}
        </p>
        <button class="auth-submit" type="submit" :disabled="submitting">
          {{
            submitting
              ? "请稍候…"
              : mode === "login"
              ? "登录并开始打卡"
              : "注册并开始打卡"
          }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped lang="scss">
.auth-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 6.4vw 4.2666667vw;
  display: flex;
  flex-direction: column;
  align-items: stretch;

  gap: 1.25rem;
  overflow: hidden;
  background: var(--color-background);
}

.auth-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.auth-orb-one {
  width: 22.5rem;
  height: 22.5rem;
  top: -10.625rem;
  right: -5.625rem;
  background: var(--color-primary-muted);
}
.auth-orb-two {
  width: 15.625rem;
  height: 15.625rem;
  left: -6.875rem;
  bottom: -5rem;
  background: var(--color-backdrop-highlight);
}

.auth-intro {
  position: relative;
  z-index: 1;
  text-align: center;
}
.intro-leaf {
  width: 3.625rem;
  height: 3.625rem;
  margin: 0 auto 0.9375rem;
  display: grid;
  place-items: center;
  color: var(--color-primary-dark);
  background: var(--color-primary-soft);
  border-radius: 1.1875rem;
  transform: rotate(-5deg);
}
.intro-eyebrow {
  display: none;
  margin-bottom: 0.75rem;
  color: var(--color-primary);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.auth-intro h1 {
  margin-bottom: 0.3125rem;
  font-size: 1.4375rem;
  line-height: 1.25;
  letter-spacing: 0;
}
.auth-intro > p:last-child {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.auth-modal {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 1.375rem 1.25rem;
  background: var(--color-surface);
  border: 0.0625rem solid var(--color-border);
  border-radius: 1.4375rem;
  box-shadow: 0 1.5rem 3.75rem var(--color-shadow-soft);
}
.auth-header {
  display: flex;
  align-items: center;
  gap: 0.8125rem;
}
.auth-brand-icon {
  width: 2.875rem;
  height: 2.875rem;
  display: grid;
  place-items: center;
  color: var(--color-primary-dark);
  background: var(--color-primary-soft);
  border-radius: 0.9375rem;
}
.auth-header h2 {
  font-size: 1.3125rem;
}
.auth-header p {
  margin-top: 0.1875rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.auth-tabs {
  margin: 1.5rem 0 1.25rem;
  padding: 0.25rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
  background: var(--color-primary-faint);
  border-radius: 0.8125rem;
}
.auth-tabs button {
  min-height: 2.375rem;
  border: 0;
  border-radius: 0.625rem;
  color: var(--color-text-secondary);
  background: var(--color-transparent);
  font-weight: 600;
}
.auth-tabs button.active {
  color: var(--color-primary-deep);
  background: var(--color-surface);
  box-shadow: 0 0.1875rem 0.625rem var(--color-shadow-card);
}

.field-label {
  display: block;
  margin: 0.9375rem 0 0.4375rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.input-shell {
  min-height: 3rem;
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--color-text-muted);
  background: var(--color-background);
  border: 0.0625rem solid var(--color-border);
  border-radius: 0.8125rem;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.input-shell:focus-within {
  color: var(--color-primary-dark);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 0.1875rem var(--color-focus);
}
.input-shell.invalid {
  border-color: var(--color-danger);
}
.input-shell input {
  width: 100%;
  min-width: 0;
  height: 2.875rem;
  padding: 0;
  color: var(--color-text);
  background: var(--color-transparent);
  border: 0;
  outline: 0;
  font-size: 0.9rem;
}
.input-shell input::placeholder {
  color: var(--color-text-muted);
}
.password-toggle {
  width: 2.25rem;
  height: 2.25rem;
  margin-right: -0.4375rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  background: var(--color-transparent);
  border: 0;
  border-radius: 0.5625rem;
}
.password-toggle:hover {
  background: var(--color-primary-pale);
}
.field-hint,
.field-error {
  margin-top: 0.3125rem;
  font-size: 0.8rem;
}
.field-hint {
  color: var(--color-text-muted);
}
.field-error {
  color: var(--color-danger);
}
.auth-error {
  margin-top: 0.9375rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-radius: 0.625rem;
  font-size: 0.75rem;
}
.auth-submit {
  width: 100%;
  min-height: 3rem;
  margin-top: 1.375rem;
  color: var(--color-primary-deep);
  background: var(--color-accent);
  border: 0;
  border-radius: 0.875rem;
  box-shadow: 0 0.5rem 1.25rem var(--color-shadow);
  font-weight: 700;
}
.auth-submit:hover:not(:disabled) {
  filter: brightness(0.98);
}
.auth-footnote {
  margin-top: 1.0625rem;
  color: var(--color-text-muted);
  font-size: 0.625rem;
  text-align: center;
}
</style>
