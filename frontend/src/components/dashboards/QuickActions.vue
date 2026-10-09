<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { ChevronRight } from 'lucide-vue-next';

/** "Quick actions": full-width rows with an icon, label and chevron. */
export interface QuickAction { label: string; icon: Component; to: RouteLocationRaw }
defineProps<{ actions: QuickAction[] }>();
</script>

<template>
  <div class="action-list">
    <RouterLink v-for="action in actions" :key="action.label" :to="action.to" class="action">
      <component :is="action.icon" :size="16" class="action-icon" />
      <span>{{ action.label }}</span>
      <ChevronRight :size="15" class="action-arrow" />
    </RouterLink>
  </div>
</template>

<style scoped>
.action-list { display: flex; flex-direction: column; gap: 10px; }
.action { display: flex; align-items: center; gap: 12px; height: 46px; padding: 0 14px; color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-sm); font-size: 13px; font-weight: 500; transition: border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease); }
.action:hover { border-color: color-mix(in srgb, var(--primary) 35%, var(--border)); background: var(--primary-softer); }
.action:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.action span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-icon { flex: none; color: var(--primary); }
.action-arrow { flex: none; color: var(--icon-foreground); transition: transform var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.action:hover .action-arrow { color: var(--primary); transform: translateX(2px); }
</style>
