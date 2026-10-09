<script setup lang="ts">
import { computed, type Component } from 'vue';
import { RouterLink } from 'vue-router';

/** One Level-2 destination (DocType list, record, report or page). */
const props = defineProps<{ label: string; to: string; icon?: Component; active?: boolean; count?: number | null }>();
const emit = defineEmits<{ navigate: [] }>();

const countLabel = computed(() => {
  const value = props.count;
  if (value === null || value === undefined) return '';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(value / 1000)}k`;
});
</script>

<template>
  <RouterLink :to="to" :class="['nav-item', { active }]" :aria-current="active ? 'page' : undefined" @click="emit('navigate')">
    <component :is="icon" v-if="icon" :size="16" :stroke-width="1.9" class="nav-item-icon" />
    <span class="nav-item-label">{{ label }}</span>
    <span v-if="countLabel" class="nav-item-count" :aria-label="`${count} records`">{{ countLabel }}</span>
  </RouterLink>
</template>

<style scoped>
.nav-item { position: relative; display: flex; align-items: center; gap: 12px; height: 36px; padding: 0 12px; color: var(--nav-muted); border-radius: 8px; font-size: 13.5px; font-weight: 500; white-space: nowrap; user-select: none; -webkit-user-select: none; -webkit-user-drag: none; transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.nav-item-icon { flex: none; color: var(--nav-subtle); opacity: .9; transition: color var(--dur-fast) var(--ease); }
.nav-item-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; }
.nav-item-count { flex: none; min-width: 20px; padding: 0 6px; color: var(--nav-subtle); border-radius: 999px; background: var(--nav-input); font-size: 10.5px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 18px; text-align: center; }
.nav-item:hover { color: var(--nav-fg); background: var(--nav-hover); }
.nav-item:hover .nav-item-icon { color: var(--nav-fg); }
.nav-item:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }
.nav-item.active { color: var(--nav-active-fg); background: var(--nav-active-bg); font-weight: 600; }
.nav-item.active .nav-item-icon { color: var(--nav-accent); }
.nav-item.active .nav-item-count { color: var(--nav-fg); background: var(--nav-hover); }
.nav-item.active::before { position: absolute; top: 9px; bottom: 9px; left: 0; width: 3px; content: ''; border-radius: 0 3px 3px 0; background: var(--nav-accent); }
</style>
