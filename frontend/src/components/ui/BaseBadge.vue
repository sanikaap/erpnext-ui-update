<script setup lang="ts">
import type { StatusTone } from '@/types/erp';

withDefaults(defineProps<{ tone?: StatusTone; label?: string; size?: 'sm' | 'md' }>(), { tone: 'slate', size: 'sm' });
</script>

<template>
  <span :class="['badge', `badge--${tone}`, `badge--${size}`]" data-testid="status-badge">
    <span class="badge-dot" />
    <slot>{{ label }}</slot>
  </span>
</template>

<style scoped>
.badge { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px 0 8px; border: 1px solid transparent; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; white-space: nowrap; }
.badge--md { height: 26px; padding: 0 11px 0 10px; font-size: 12.5px; }
.badge-dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: currentColor; }
.badge--violet { color: var(--primary-soft-foreground); border-color: color-mix(in srgb, var(--primary) 18%, transparent); background: var(--primary-soft); }
.badge--green { color: var(--secondary-soft-foreground); border-color: color-mix(in srgb, var(--secondary) 20%, transparent); background: var(--secondary-soft); }
.badge--amber { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 20%, transparent); background: var(--warning-soft); }
.badge--rose { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 18%, transparent); background: var(--danger-soft); }
.badge--cyan { color: var(--accent-soft-foreground); border-color: color-mix(in srgb, var(--accent) 20%, transparent); background: var(--accent-soft); }
.badge--blue { color: var(--info); border-color: color-mix(in srgb, var(--info) 20%, transparent); background: var(--info-soft); }
.badge--slate { color: var(--muted-foreground); border-color: var(--border); background: var(--muted); }
</style>
