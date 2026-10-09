<script setup lang="ts">
import type { Component } from 'vue';
import { Inbox } from 'lucide-vue-next';

withDefaults(defineProps<{ title: string; description?: string; icon?: Component; compact?: boolean }>(), { icon: () => Inbox, compact: false });
</script>

<template>
  <div :class="['empty-state', { 'empty-state--compact': compact }]" data-testid="empty-state">
    <div class="empty-mark" aria-hidden="true"><component :is="icon" :size="compact ? 17 : 20" /></div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="empty-actions"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state { display: flex; min-height: 260px; align-items: center; justify-content: center; flex-direction: column; gap: 6px; padding: 36px 24px; text-align: center; }
.empty-state--compact { min-height: 0; padding: 22px 16px; }
.empty-mark { position: relative; display: grid; width: 48px; height: 48px; margin-bottom: 8px; place-items: center; border-radius: 14px; color: var(--primary); background: var(--primary-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent); }
.empty-state--compact .empty-mark { width: 38px; height: 38px; margin-bottom: 4px; border-radius: 11px; }
.empty-state h3 { color: var(--foreground); font-size: 14px; font-weight: 600; }
.empty-state p { max-width: 360px; color: var(--muted-foreground); font-size: 13px; }
.empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 10px; }
</style>
