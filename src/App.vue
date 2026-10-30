<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from './api';
import AuthView from './components/AuthView.vue';
import CheckinPage from './components/CheckinPage.vue';
import type { User } from './types';

const user = ref<User | null>(null);
const checkingSession = ref(true);

function handleUnauthorized() {
  if (user.value) user.value = null;
}

onMounted(async () => {
  window.addEventListener('auth:unauthorized', handleUnauthorized);
  try {
    const response = await api.me();
    user.value = response.user;
  } catch {
    user.value = null;
  } finally {
    checkingSession.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('auth:unauthorized', handleUnauthorized);
});
</script>

<template>
  <div v-if="checkingSession" class="session-loading" role="status">
    <span class="session-spinner" aria-hidden="true"></span>
    正在打开成长打卡…
  </div>
  <AuthView v-else-if="!user" @authenticated="user = $event" />
  <CheckinPage v-else :user="user" @logged-out="user = null" />
</template>

<style scoped lang="scss">
.session-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--color-text-secondary);
  background: var(--color-background);
}

.session-spinner {
  width: 1.375rem;
  height: 1.375rem;
  border: 0.1875rem solid var(--color-primary-pale);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
