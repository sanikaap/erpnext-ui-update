<script setup lang="ts">
import { computed } from 'vue';
import { AlertCircle, Lock, RefreshCw, SearchX } from 'lucide-vue-next';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = withDefaults(defineProps<{ title?: string; message?: string | null; kind?: 'error' | 'permission' | 'not-found' | null; retry?: boolean }>(), { kind: 'error', retry: true });
const emit = defineEmits<{ retry: [] }>();

const icon = computed(() => (props.kind === 'permission' ? Lock : props.kind === 'not-found' ? SearchX : AlertCircle));
const heading = computed(() => props.title || (props.kind === 'permission' ? 'You don’t have permission' : props.kind === 'not-found' ? 'Not found' : 'Something went wrong'));
</script>

<template>
  <div :class="['error-state', `error-state--${kind || 'error'}`]" role="alert">
    <div class="error-mark" aria-hidden="true"><component :is="icon" :size="20" /></div>
    <h3>{{ heading }}</h3>
    <p v-if="message">{{ message }}</p>
    <BaseButton v-if="retry && kind !== 'permission'" variant="quiet" size="sm" class="error-retry" @click="emit('retry')"><RefreshCw :size="14" />Retry</BaseButton>
  </div>
</template>

<style scoped>
.error-state { display: flex; min-height: 240px; align-items: center; justify-content: center; flex-direction: column; gap: 6px; padding: 32px 24px; text-align: center; }
.error-mark { display: grid; width: 46px; height: 46px; margin-bottom: 8px; place-items: center; border-radius: 14px; color: var(--danger); background: var(--danger-soft); }
.error-state--permission .error-mark { color: var(--warning); background: var(--warning-soft); }
.error-state--not-found .error-mark { color: var(--accent-soft-foreground); background: var(--accent-soft); }
.error-state h3 { color: var(--foreground); font-size: 14px; font-weight: 600; }
.error-state p { max-width: 440px; color: var(--muted-foreground); font-size: 13px; overflow-wrap: anywhere; }
.error-retry { margin-top: 10px; }
</style>
