<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(defineProps<{ open: boolean; title?: string; subtitle?: string; width?: string }>(), { width: '480px' });
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
    <Transition name="modal">
      <div v-if="open" class="modal-root" @mousedown.self="emit('close')">
        <section class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ width }">
          <header v-if="title" class="modal-head">
            <div><h2>{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div>
            <button class="modal-close" aria-label="Close" @click="emit('close')"><X :size="16" /></button>
          </header>
          <div class="modal-body"><slot /></div>
          <footer v-if="$slots.footer" class="modal-foot"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-root { position: fixed; z-index: 90; inset: 0; display: grid; padding: 16px; place-items: start center; padding-top: 12vh; background: var(--overlay); backdrop-filter: blur(2px); }
.modal { display: flex; max-width: 100%; max-height: 76vh; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface-elevated); box-shadow: var(--shadow-lg); }
.modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 18px 0 22px; }
.modal-head h2 { color: var(--foreground); font-size: 15px; font-weight: 600; }
.modal-head p { margin-top: 3px; color: var(--muted-foreground); font-size: 12.5px; }
.modal-close { display: grid; width: 30px; height: 30px; flex: none; place-items: center; color: var(--muted-foreground); border: 0; border-radius: var(--radius-md); background: none; }
.modal-close:hover { color: var(--foreground); background: var(--muted); }
.modal-body { overflow-y: auto; padding: 16px 22px 20px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border); background: var(--surface-tint); }
.modal-enter-active, .modal-leave-active { transition: opacity .16s ease; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform .18s var(--ease); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: translateY(-6px) scale(.98); }
</style>
