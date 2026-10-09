<script setup lang="ts">
import type { Component } from 'vue';
import { ChevronRight } from 'lucide-vue-next';

/** A Level-1 module entry. In the icon rail it shows only its icon. */
defineProps<{ label: string; icon: Component; color: string; active?: boolean; open?: boolean; compact?: boolean }>();
const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    :class="['module-item', { active, open, compact }]"
    :style="{ '--c': `var(${color})` }"
    :aria-label="compact ? label : undefined"
    :aria-expanded="open"
    @click="emit('select')"
  >
    <span class="module-icon"><component :is="icon" :size="18" :stroke-width="1.9" /></span>
    <span v-if="!compact" class="module-label">{{ label }}</span>
    <ChevronRight v-if="!compact" :size="14" class="module-chevron" />
  </button>
</template>

<style scoped>
.module-item { position: relative; display: flex; user-select: none; -webkit-user-select: none; align-items: center; gap: 12px; width: 100%; height: 40px; padding: 0 12px; color: var(--nav-muted); border: 0; border-radius: 9px; background: none; font-size: 14px; font-weight: 500; text-align: left; white-space: nowrap; transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.module-item:hover { color: var(--nav-fg); background: var(--nav-hover); }
.module-item:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }
.module-icon { display: grid; width: 20px; flex: none; place-items: center; color: var(--c); }
.module-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; }
.module-chevron { flex: none; color: var(--nav-subtle); opacity: 0; transition: opacity .12s, transform .15s var(--ease); }
.module-item:hover .module-chevron, .module-item.open .module-chevron { opacity: 1; }
.module-item.open:not(.compact) { color: var(--nav-fg); background: var(--nav-hover); }
.module-item.open .module-chevron { transform: rotate(0); color: var(--nav-accent); }
.module-item:hover .module-chevron { transform: translateX(2px); }
.module-item.active { color: var(--nav-active-fg); background: var(--nav-active-bg); font-weight: 600; }
.module-item.active::before { position: absolute; top: 10px; bottom: 10px; left: 0; width: 3px; content: ''; border-radius: 0 3px 3px 0; background: var(--nav-accent); }

/* Icon rail */
.compact { justify-content: center; width: 42px; height: 42px; margin: 0 auto; padding: 0; border-radius: 10px; }
.compact .module-icon { width: auto; }
.compact.open:not(.active) { background: var(--nav-hover); box-shadow: inset 0 0 0 1px var(--nav-border); }
.compact.active { background: var(--nav-active-bg); }
.compact.active::before { top: 11px; bottom: 11px; left: -13px; }
</style>
