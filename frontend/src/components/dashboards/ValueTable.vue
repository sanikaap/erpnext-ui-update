<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { monogram, monogramTone } from '@/lib/display';

/** "Top items by value"-style table: name (with monogram), a group column, the value, an amount column. */
export interface ValueRow { key: string; label: string; group?: string; value: string; amount?: string; to?: RouteLocationRaw }
withDefaults(defineProps<{ rows: ValueRow[]; labelHeader?: string; groupHeader?: string; valueHeader?: string; amountHeader?: string }>(), {
  labelHeader: 'Name', groupHeader: '', valueHeader: 'Value', amountHeader: '',
});
</script>

<template>
  <table class="value-table">
    <colgroup>
      <col class="c-label" />
      <col v-if="groupHeader" class="c-group" />
      <col class="c-value" />
      <col v-if="amountHeader" class="c-amount" />
    </colgroup>
    <thead>
      <tr><th>{{ labelHeader }}</th><th v-if="groupHeader">{{ groupHeader }}</th><th class="num">{{ valueHeader }}</th><th v-if="amountHeader" class="num">{{ amountHeader }}</th></tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key">
        <td>
          <component :is="row.to ? RouterLink : 'span'" :to="row.to" class="label-cell">
            <span :class="['monogram', `tone-${monogramTone(row.key)}`]" aria-hidden="true">{{ monogram(row.label) }}</span>
            <span class="label-text" :title="row.label">{{ row.label }}</span>
          </component>
        </td>
        <td v-if="groupHeader" class="muted-cell" :title="row.group">{{ row.group || '—' }}</td>
        <td class="num strong">{{ row.value }}</td>
        <td v-if="amountHeader" class="num">{{ row.amount ?? '—' }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.value-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; table-layout: fixed; }
.value-table col.c-label { width: 42%; } .value-table col.c-group { width: 22%; } .value-table col.c-value { width: 23%; } .value-table col.c-amount { width: 13%; }
.value-table th { height: 36px; padding: 0 8px; overflow: hidden; color: var(--subtle-foreground); border-bottom: 1px solid var(--border); background: var(--surface-2); font-size: 11.5px; font-weight: 600; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.value-table th:first-child, .value-table td:first-child { padding-left: 18px; }
.value-table th:last-child, .value-table td:last-child { padding-right: 18px; }
.value-table td { height: 50px; padding: 0 8px; overflow: hidden; color: var(--foreground); border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.value-table tbody tr:last-child td { border-bottom: 0; }
.value-table tbody tr:hover td { background: var(--surface-2); }
.num { text-align: right !important; }
.strong { font-weight: 600; }
.muted-cell { color: var(--subtle-foreground) !important; }
.label-cell { display: flex; min-width: 0; align-items: center; gap: 9px; color: var(--foreground); font-weight: 600; }
a.label-cell { color: var(--primary-soft-foreground); }
a.label-cell:hover .label-text { text-decoration: underline; text-underline-offset: 3px; }
a.label-cell:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
.label-cell .monogram { width: 24px; height: 24px; border-radius: 7px; font-size: 10px; }
.label-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
</style>
