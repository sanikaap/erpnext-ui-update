<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

/**
 * Ranked horizontal bars ("top customers", "top items"): one series, so one color;
 * the label and value are text, the bar only shows proportion.
 */
export interface RankRow { key: string; label: string; value: number; display: string; sub?: string; to?: string | Record<string, unknown> }
const props = withDefaults(defineProps<{ rows: RankRow[]; color?: string; label: string; /** Give each row its own slot color (labels already carry identity). */ colorful?: boolean }>(), { color: '--chart-1', colorful: false });
const rowColor = (index: number) => (props.colorful ? `var(--chart-${(index % 6) + 1})` : `var(${props.color})`);
const max = computed(() => Math.max(1, ...props.rows.map((row) => row.value)));
const share = (value: number) => `${Math.max(2, (value / max.value) * 100).toFixed(1)}%`;
</script>

<template>
  <ol class="rank" :aria-label="label" :style="{ '--bar': `var(${color})` }">
    <li v-for="(row, index) in rows" :key="row.key">
      <component :is="row.to ? RouterLink : 'div'" :to="row.to" :class="['rank-row', { 'rank-row--link': row.to }]" :style="{ '--bar': rowColor(index) }" :title="`${row.label}: ${row.display}`">
        <span class="rank-index tabular">{{ index + 1 }}</span>
        <span class="rank-main">
          <span class="rank-head">
            <span class="rank-label">{{ row.label }}</span>
            <b class="rank-value tabular">{{ row.display }}</b>
          </span>
          <span class="rank-track"><i :style="{ width: share(row.value) }" /></span>
          <small v-if="row.sub" class="rank-sub">{{ row.sub }}</small>
        </span>
      </component>
    </li>
  </ol>
</template>

<style scoped>
.rank { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.rank-row { display: flex; align-items: flex-start; gap: 12px; margin: 0 -8px; padding: 8px; border-radius: var(--radius-md); }
.rank-row--link { transition: background-color var(--dur-fast) var(--ease); }
.rank-row--link:hover { background: var(--surface-2); }
.rank-row--link:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
.rank-index { display: grid; width: 22px; height: 22px; flex: none; place-items: center; color: var(--bar); border-radius: 6px; background: color-mix(in srgb, var(--bar) 14%, transparent); font-size: 11px; font-weight: 700; }
.rank-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 6px; }
.rank-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.rank-label { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.rank-value { flex: none; color: var(--foreground); font-size: 13px; font-weight: 600; }
.rank-track { display: block; height: 6px; overflow: hidden; border-radius: 999px; background: var(--chart-track); }
.rank-track i { display: block; height: 100%; border-radius: 999px; background: var(--bar); transition: width var(--dur-med) var(--ease); }
.rank-sub { color: var(--subtle-foreground); font-size: 11.5px; }
</style>
