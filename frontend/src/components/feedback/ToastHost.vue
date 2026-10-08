<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

const { toasts, dismiss } = useToast();
const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast', `toast--${toast.tone}`]" :role="toast.tone === 'error' ? 'alert' : 'status'">
        <component :is="icons[toast.tone]" :size="17" class="toast-icon" />
        <div class="toast-copy"><strong>{{ toast.title }}</strong><p v-if="toast.description">{{ toast.description }}</p></div>
        <button class="toast-close" aria-label="Dismiss" @click="dismiss(toast.id)"><X :size="14" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host { position: fixed; z-index: 100; right: 20px; bottom: 20px; display: flex; width: min(380px, calc(100vw - 32px)); flex-direction: column; gap: 8px; pointer-events: none; }
.toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 14px; border: 1px solid var(--border); border-left-width: 3px; border-radius: var(--radius-lg); background: var(--surface-elevated); box-shadow: var(--shadow-lg); pointer-events: auto; }
.toast--success { border-left-color: var(--secondary); } .toast--success .toast-icon { color: var(--secondary); }
.toast--error { border-left-color: var(--danger); } .toast--error .toast-icon { color: var(--danger); }
.toast--info { border-left-color: var(--primary); } .toast--info .toast-icon { color: var(--primary); }
.toast--warning { border-left-color: var(--warning); } .toast--warning .toast-icon { color: var(--warning); }
.toast-icon { flex: none; margin-top: 1px; }
.toast-copy { min-width: 0; flex: 1; }
.toast-copy strong { display: block; color: var(--foreground); font-size: 13px; font-weight: 600; }
.toast-copy p { margin-top: 2px; color: var(--muted-foreground); font-size: 12.5px; overflow-wrap: anywhere; }
.toast-close { display: grid; width: 24px; height: 24px; flex: none; place-items: center; color: var(--subtle-foreground); border: 0; border-radius: 6px; background: none; }
.toast-close:hover { color: var(--foreground); background: var(--muted); }
.toast-enter-active, .toast-leave-active { transition: opacity .18s var(--ease), transform .18s var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px) scale(.98); }
@media (max-width: 600px) { .toast-host { right: 16px; bottom: 16px; } }
</style>
