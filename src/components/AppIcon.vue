<script setup lang="ts">
withDefaults(defineProps<{
  name: 'leaf' | 'user' | 'logout' | 'left' | 'right' | 'flame' | 'check' | 'plus' | 'list' | 'close' | 'eye' | 'eye-off' | 'lock' | 'calendar' | 'edit' | 'trash';
  size?: number;
}>(), { size: 20 });
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="name === 'leaf'">
      <path d="M20 4C12 4.2 6.4 7.4 6 13c-.2 3 1.8 5.4 4.8 5.6C16.4 19 19.5 13.2 20 4Z" fill="currentColor" />
      <path d="M4 21c1.8-6 5.5-10 11-12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8" />
      <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'left'">
      <path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'right'">
      <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'flame'">
      <path d="M13 3c.5 3.5-2.5 4.5-2.5 7-1.5-.8-2.2-2.2-2-3.8C5.5 8.5 4.5 11 5.5 14c.8 3 3.2 5 6.5 5 4 0 6.5-2.2 6.5-6 0-4.5-3-7.5-5.5-10Z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'lock'">
      <rect x="5" y="10" width="14" height="10" rx="3" stroke="currentColor" stroke-width="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" stroke-width="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="m14.5 5.5 4 4M4 20l1-4L15.5 5.5a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 19l-4 1Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'eye'">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.8" />
    </template>
    <template v-else-if="name === 'eye-off'">
      <path d="m4 4 16 16M10.5 6.2c.5-.1 1-.2 1.5-.2 6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.8M6.3 7.3A16.6 16.6 0 0 0 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.2-1M9.8 9.8a3 3 0 0 0 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
