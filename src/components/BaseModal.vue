<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';

defineProps<{ title: string; subtitle?: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement | null>(null);
let previousFocus: Element | null = null;

onMounted(async () => {
  previousFocus = document.activeElement;
  await nextTick();
  const first = dialog.value?.querySelector<HTMLElement>('input, button');
  first?.focus();
});

onBeforeUnmount(() => {
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
});

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key !== 'Tab' || !dialog.value) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
  )];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @mousedown.self="emit('close')">
      <section
        ref="dialog"
        class="modal-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <div class="sheet-handle" aria-hidden="true"></div>
        <header class="sheet-header">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
          <button type="button" aria-label="关闭弹窗" @click="emit('close')">
            <AppIcon name="close" :size="20" />
          </button>
        </header>
        <slot></slot>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 2rem 0 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-overlay);
}
.modal-sheet {
  width: 100%;
  max-height: min(86vh, 42.5rem);
  padding: 0.75rem 1.375rem 1.375rem;
  overflow-y: auto;
  background: var(--color-surface);
  border-radius: 1.5rem 1.5rem 0 0;
  box-shadow: 0 1.5rem 3.75rem var(--color-shadow-soft);
  outline: 0;
}
.sheet-handle {
  width: 2.5rem;
  height: 0.25rem;
  margin: 0 auto 0.875rem;
  background: var(--color-border);
  border-radius: 6.1875rem;
}
.sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.sheet-header h2 { font-size: 1.25rem; }
.sheet-header p { margin-top: 0.1875rem; color: var(--color-text-secondary); font-size: 0.75rem; }
.sheet-header button {
  width: 2.375rem;
  height: 2.375rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  background: var(--color-primary-faint);
  border: 0;
  border-radius: 0.75rem;
}

</style>
