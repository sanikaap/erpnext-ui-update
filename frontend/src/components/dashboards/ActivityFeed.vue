<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

/** "Recent activity" list: tinted round icon, title, one-line description, time. */
export interface ActivityRow {
  key: string;
  icon: Component;
  /** Colour token for the icon tile, e.g. '--success'. */
  tone: string;
  title: string;
  /** Small secondary part of the title (document number…). */
  titleMeta?: string;
  subtitle?: string;
  time?: string;
  timeTitle?: string;
  to?: RouteLocationRaw;
}
defineProps<{ rows: ActivityRow[] }>();
</script>

<template>
  <ul class="activity-list">
    <li v-for="row in rows" :key="row.key">
      <component :is="row.to ? RouterLink : 'div'" :to="row.to" class="activity-row" :style="{ '--c': `var(${row.tone})` }">
        <span class="activity-icon" aria-hidden="true"><component :is="row.icon" :size="16" /></span>
        <span class="activity-copy">
          <strong :title="row.titleMeta ? `${row.title} ${row.titleMeta}` : row.title">{{ row.title }}<span v-if="row.titleMeta" class="activity-meta">{{ row.titleMeta }}</span></strong>
          <small v-if="row.subtitle" :title="row.subtitle">{{ row.subtitle }}</small>
        </span>
        <time v-if="row.time" class="activity-time" :title="row.timeTitle">{{ row.time }}</time>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.activity-list { display: flex; flex-direction: column; margin: -6px -10px; padding: 0; list-style: none; }
.activity-list li + li .activity-row { border-top: 1px solid var(--border); border-radius: 0; }
.activity-row { display: flex; align-items: center; gap: 12px; padding: 11px 10px; border-radius: var(--radius-md); transition: background-color var(--dur-fast) var(--ease); }
a.activity-row:hover { background: var(--surface-2); }
a.activity-row:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
.activity-icon { display: grid; width: 34px; height: 34px; flex: none; place-items: center; color: var(--c); border-radius: 50%; background: color-mix(in srgb, var(--c) 13%, transparent); }
.activity-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.activity-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.activity-meta { margin-left: 6px; color: var(--muted-foreground); font-weight: 500; }
.activity-copy small { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.activity-time { flex: none; align-self: flex-start; margin-top: 2px; color: var(--subtle-foreground); font-size: 11.5px; white-space: nowrap; }
</style>
