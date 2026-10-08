<script setup lang="ts">
import SidebarNavItem from './SidebarNavItem.vue';
import type { NavigationItem } from '@/types/erp';

/** A labelled group of Level-2 items (Masters, Transactions, Reports…). */
defineProps<{ label?: string; items: NavigationItem[]; isActive: (item: NavigationItem) => boolean; counts?: Record<string, number | null> }>();
const emit = defineEmits<{ navigate: [] }>();
</script>

<template>
  <section class="nav-section">
    <h3 v-if="label" class="nav-section-label">{{ label }}</h3>
    <SidebarNavItem v-for="item in items" :key="item.path" :label="item.label" :to="item.path" :icon="item.icon" :active="isActive(item)" :count="counts?.[item.path]" @navigate="emit('navigate')" />
  </section>
</template>

<style scoped>
.nav-section { display: flex; flex-direction: column; gap: 1px; }
.nav-section + .nav-section { margin-top: 18px; }
.nav-section-label { margin: 0 0 6px; user-select: none; padding: 0 10px; color: var(--nav-subtle); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
</style>
