<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import type { StatusTone } from '@/types/erp';

/** "Stock alerts"-style list: round tinted icon, title + detail, a status badge. */
export interface AlertRow {
  key: string;
  icon: Component;
  /** Colour token for the icon tile, e.g. '--danger'. */
  tone: string;
  title: string;
  detail?: string;
  badge?: { label: string; tone: StatusTone; title?: string };
  to?: RouteLocationRaw;
}
defineProps<{ rows: AlertRow[] }>();
</script>

<template>
  <ul class="alert-list">
    <li v-for="row in rows" :key="row.key">
      <component :is="row.to ? RouterLink : 'div'" :to="row.to" class="alert-row" :style="{ '--c': `var(${row.tone})` }">
        <span class="alert-icon" aria-hidden="true"><component :is="row.icon" :size="15" /></span>
        <span class="alert-copy">
          <strong :title="row.title">{{ row.title }}</strong>
          <small v-if="row.detail" :title="row.detail">{{ row.detail }}</small>
        </span>
        <BaseBadge v-if="row.badge" :tone="row.badge.tone" :label="row.badge.label" :title="row.badge.title" />
      </component>
    </li>
  </ul>
</template>

<style scoped>
.alert-list { display: flex; flex-direction: column; margin: -6px -10px; padding: 0; list-style: none; }
.alert-list li + li .alert-row { border-top: 1px solid var(--border); border-radius: 0; }
.alert-row { display: flex; align-items: center; gap: 12px; padding: 11px 10px; border-radius: var(--radius-md); transition: background-color var(--dur-fast) var(--ease); }
a.alert-row:hover { background: var(--surface-2); }
a.alert-row:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
.alert-icon { display: grid; width: 34px; height: 34px; flex: none; place-items: center; color: var(--c); border-radius: 50%; background: color-mix(in srgb, var(--c) 13%, transparent); }
.alert-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.alert-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.alert-copy small { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
