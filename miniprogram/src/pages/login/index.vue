<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Taro from '@tarojs/taro';
import { api, ApiError } from '../../api';
import { clearAuth, getToken, setAuth } from '../../utils/auth';
import { todayKey } from '../../utils/date';

const checking = ref(true);
const wechatLoading = ref(false);
const accountOpen = ref(false);
const accountLoading = ref(false);
const username = ref('');
const password = ref('');
const error = ref('');

function errorText(value: unknown): string {
  return value instanceof ApiError ? value.message : '网络连接失败，请稍后重试';
}

function goHome(): Promise<void> {
  return Taro.reLaunch({ url: '/pages/index/index' }).then(() => undefined);
}

onMounted(async () => {
  const token = getToken();
  if (!token) {
    checking.value = false;
    return;
  }

  try {
    const response = await api.me();
    setAuth(token, response.user);
    await goHome();
    return;
  } catch (value) {
    if (value instanceof ApiError && value.status === 401) {
      clearAuth();
    } else {
      error.value = '无法连接服务器，请确认后端已启动';
    }
  }
  checking.value = false;
});

async function wechatLogin(): Promise<void> {
  if (wechatLoading.value) return;
  wechatLoading.value = true;
  error.value = '';

  let code = '';
  try {
    const result = await Taro.login();
    code = result.code || '';
  } catch {
    // 测试号可能拿不到 code；后端本地模拟登录允许空 code。
  }

  try {
    const response = await api.wechatLogin(code, todayKey());
    setAuth(response.token, response.user);
    await goHome();
  } catch (value) {
    error.value = errorText(value);
  } finally {
    wechatLoading.value = false;
  }
}

function onUsername(event: { detail: { value: string } }): void {
  username.value = event.detail.value;
  error.value = '';
}

function onPassword(event: { detail: { value: string } }): void {
  password.value = event.detail.value;
  error.value = '';
}

async function accountLogin(): Promise<void> {
  if (accountLoading.value) return;
  const name = username.value.trim();
  if (!name) {
    error.value = '请输入用户名';
    return;
  }
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }

  accountLoading.value = true;
  error.value = '';
  try {
    const response = await api.login(name, password.value);
    setAuth(response.token, response.user);
    await goHome();
  } catch (value) {
    error.value = errorText(value);
  } finally {
    accountLoading.value = false;
  }
}

function toggleAccount(): void {
  accountOpen.value = !accountOpen.value;
  error.value = '';
}
</script>

<template>
  <view class="login-root">
    <view v-if="checking" class="checking-page">
      <view class="checking-spinner"></view>
      <text>正在打开成长打卡…</text>
    </view>

    <view v-else class="auth-page">
      <view class="auth-orb auth-orb-one"></view>
      <view class="auth-orb auth-orb-two"></view>

      <view class="auth-intro">
        <view class="auth-leaf">
          <view class="leaf-shape"></view>
        </view>
        <text class="auth-title">每天完成一点点</text>
        <text class="auth-subtitle">把小小的坚持，变成看得见的成长。</text>
      </view>

      <view class="auth-card">
        <view
          class="wechat-btn"
          :class="{ 'is-disabled': wechatLoading }"
          @tap="wechatLogin"
        >
          <view class="wechat-badge">
            <view class="wechat-badge-dot"></view>
          </view>
          <text>{{ wechatLoading ? '正在登录…' : '微信一键登录' }}</text>
        </view>
        <text class="auth-note">
          使用微信身份快速开始，打卡数据按微信账号独立保存
        </text>

        <view class="auth-divider">
          <view class="divider-line"></view>
          <text class="divider-text">或</text>
          <view class="divider-line"></view>
        </view>

        <view v-if="!accountOpen" class="link-btn" @tap="toggleAccount">
          使用已有账号登录
        </view>

        <view v-else class="account-form">
          <view class="input-shell">
            <input
              class="auth-input"
              :value="username"
              :maxlength="20"
              placeholder="请输入用户名"
              placeholder-style="color: #82917f"
              @input="onUsername"
            />
          </view>
          <view class="input-shell">
            <input
              class="auth-input"
              :value="password"
              :password="true"
              :maxlength="64"
              placeholder="请输入密码"
              placeholder-style="color: #82917f"
              @input="onPassword"
            />
          </view>
          <view
            class="auth-submit"
            :class="{ 'is-disabled': accountLoading }"
            @tap="accountLogin"
          >
            {{ accountLoading ? '请稍候…' : '登录并开始打卡' }}
          </view>
          <view class="auth-switch">
            <text class="link-btn" @tap="toggleAccount">收起账号登录</text>
          </view>
          <text class="auth-note">账号需先在网页端注册</text>
        </view>

        <text v-if="error" class="auth-error">{{ error }}</text>
      </view>
    </view>
  </view>
</template>
