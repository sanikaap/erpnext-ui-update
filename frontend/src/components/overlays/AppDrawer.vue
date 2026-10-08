<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(defineProps<{ open: boolean; title?: string; subtitle?: string; width?: string }>(), { width: '560px' });
const emit = defineEmits<{ close: [] }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
watch(() => props.open, (open) => {
  if (open) window.addEventListener('keydown', onKey);
  else window.removeEventListener('keydown', onKey);
}, { immediate: true });
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-root">
        <div class="drawer-scrim" @click="emit('close')" />
        <aside class="drawer" role="dialog" aria-modal="true" :aria-label="title" :style="{ width }">
          <header class="drawer-head">
            <div class="drawer-titles"><h2 v-if="title">{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div>
            <slot name="head-actions" />
            <button class="drawer-close" aria-label="Close" @click="emit('close')"><X :size="17" /></button>
          </header>
          <div class="drawer-body"><slot /></div>
          <footer v-if="$slots.footer" class="drawer-foot"><slot name="footer" /></footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-root { position: fixed; z-index: 80; inset: 0; }
.drawer-scrim { position: absolute; inset: 0; background: var(--overlay); backdrop-filter: blur(2px); }
.drawer { position: absolute; top: 0; right: 0; bottom: 0; display: flex; max-width: 100vw; flex-direction: column; border-left: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow-lg); }
.drawer-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px 14px 22px; border-bottom: 1px solid var(--border); }
.drawer-titles { min-width: 0; flex: 1; }
.drawer-titles h2 { color: var(--foreground); font-size: 15px; font-weight: 600; }
.drawer-titles p { margin-top: 2px; color: var(--muted-foreground); font-size: 12.5px; }
.drawer-close { display: grid; width: 32px; height: 32px; flex: none; place-items: center; color: var(--muted-foreground); border: 0; border-radius: var(--radius-md); background: none; }
.drawer-close:hover { color: var(--foreground); background: var(--muted); }
.drawer-body { flex: 1; overflow-y: auto; padding: 18px 22px 24px; }
.drawer-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border); background: var(--surface-tint); }
.drawer-enter-active, .drawer-leave-active { transition: opacity .2s ease; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform .22s var(--ease); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(24px); }
</style>
