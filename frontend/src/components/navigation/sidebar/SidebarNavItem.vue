<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink } from 'vue-router';

/** One Level-2 destination (DocType list, record, report or page). */
defineProps<{ label: string; to: string; icon?: Component; active?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
</script>

<template>
  <RouterLink :to="to" :class="['nav-item', { active }]" :aria-current="active ? 'page' : undefined" @click="emit('navigate')">
    <component :is="icon" v-if="icon" :size="15" :stroke-width="1.9" class="nav-item-icon" />
    <span class="nav-item-label">{{ label }}</span>
  </RouterLink>
</template>

<style scoped>
.nav-item { position: relative; display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; color: var(--nav-muted); border-radius: 7px; font-size: 13px; font-weight: 500; white-space: nowrap; transition: background-color .12s, color .12s; }
.nav-item-icon { flex: none; color: var(--nav-subtle); transition: color .12s; }
.nav-item-label { overflow: hidden; text-overflow: ellipsis; }
.nav-item:hover { color: var(--nav-fg); background: var(--nav-hover); }
.nav-item:hover .nav-item-icon { color: var(--nav-fg); }
.nav-item:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }
.nav-item.active { color: var(--nav-active-fg); background: var(--nav-active-bg); font-weight: 600; }
.nav-item.active .nav-item-icon { color: var(--c, var(--nav-accent)); }
.nav-item.active::before { position: absolute; top: 8px; bottom: 8px; left: 0; width: 3px; content: ''; border-radius: 0 3px 3px 0; background: var(--c, var(--nav-accent)); }
</style>
