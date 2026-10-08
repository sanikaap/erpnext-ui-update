<script setup lang="ts">
import { computed } from 'vue';

/** Allocated (track) versus utilised (colored) per row — "budget versus actual". */
export interface BudgetRow { label: string; allocated: number; used: number; color?: string; to?: string }
const props = defineProps<{ rows: BudgetRow[]; format: (value: number) => string }>();
const max = computed(() => Math.max(1, ...props.rows.map((row) => Math.max(row.allocated, row.used))));
const pct = (value: number) => `${Math.min(100, (value / max.value) * 100).toFixed(1)}%`;
</script>

<template>
  <ul class="budget-bars">
    <li v-for="row in rows" :key="row.label">
      <div class="budget-head">
        <component :is="row.to ? 'RouterLink' : 'span'" :to="row.to" class="budget-label">{{ row.label }}</component>
        <span class="budget-figures tabular">{{ format(row.used) }} <small>of {{ format(row.allocated) }}</small></span>
      </div>
      <div class="budget-track" role="img" :aria-label="`${row.label}: ${format(row.used)} utilised of ${format(row.allocated)}`">
        <i class="budget-allocated" :style="{ width: pct(row.allocated) }" />
        <i class="budget-used" :style="{ width: pct(row.used), background: `var(${row.color || '--chart-1'})` }" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.budget-bars { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.budget-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.budget-label { color: var(--foreground); font-size: 13px; font-weight: 500; }
a.budget-label:hover { color: var(--primary); text-decoration: underline; }
.budget-figures { color: var(--foreground); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.budget-figures small { color: var(--subtle-foreground); font-weight: 400; }
.budget-track { position: relative; height: 10px; border-radius: 999px; background: var(--chart-track); }
.budget-track i { position: absolute; top: 0; left: 0; height: 100%; border-radius: 999px; }
.budget-allocated { background: var(--border-strong); opacity: .6; }
.budget-used { box-shadow: 0 0 0 2px var(--surface); }
</style>
