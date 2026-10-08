<script setup lang="ts">
import type { Component } from 'vue';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import Sparkline from '@/components/charts/Sparkline.vue';
import type { StatusTone } from '@/types/erp';

export interface Metric {
  label: string;
  value: string;
  hint?: string;
  /** Change vs the previous period, already formatted (e.g. "+12%"). */
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  /** Whether "up" is good for this metric (sales) or bad (overdue). */
  upIsGood?: boolean;
  tone: StatusTone;
  icon: Component;
  to?: string;
  loading?: boolean;
  /** Next step shown instead of the hint when the value is empty (e.g. zero); also mutes the value. */
  emptyHint?: string;
  /** Recent values (oldest first) drawn as a small trend line beside the figure. */
  spark?: number[];
  /** Token name for the sparkline color (default --chart-1). */
  sparkColor?: string;
}

defineProps<{ metric: Metric }>();
</script>

<template>
  <component :is="metric.to ? RouterLink : 'article'" :to="metric.to" :class="['metric-card', `metric-card--${metric.tone}`, { 'metric-card--link': metric.to }]" data-testid="card-metric">
    <div class="metric-top">
      <span :class="['metric-icon', `tone-${metric.tone}`]"><component :is="metric.icon" :size="17" /></span>
      <span class="metric-label">{{ metric.label }}</span>
    </div>
    <div class="metric-body">
      <div :class="['metric-value tabular', { 'metric-value--empty': metric.emptyHint && !metric.loading }]"><span v-if="metric.loading" class="skeleton" style="width: 60%; height: 26px" /><template v-else>{{ metric.value }}</template></div>
      <Sparkline v-if="metric.spark && !metric.loading && metric.spark.some(Boolean)" :data="metric.spark" :color="metric.sparkColor || '--chart-1'" :height="34" class="metric-spark" />
    </div>
    <div class="metric-footer">
      <span v-if="metric.emptyHint && !metric.loading" class="metric-next">{{ metric.emptyHint }}</span>
      <template v-else>
      <span v-if="metric.delta && !metric.loading" :class="['trend-pill', metric.trend === 'flat' || !metric.trend ? 'trend-pill--flat' : (metric.trend === 'up') === (metric.upIsGood ?? true) ? 'trend-pill--good' : 'trend-pill--bad']">
        <ArrowUpRight v-if="metric.trend === 'up'" :size="12" /><ArrowDownRight v-else-if="metric.trend === 'down'" :size="12" /><Minus v-else :size="12" />{{ metric.delta }}
      </span>
      <span v-if="metric.hint">{{ metric.hint }}</span>
      </template>
    </div>
  </component>
</template>

<style scoped>
.metric-card { position: relative; display: flex; flex-direction: column; overflow: hidden; padding: var(--space-4) var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); transition: border-color var(--dur-fast) var(--ease); }
.metric-card--link:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.metric-card--link:hover { border-color: var(--border-strong); }
.metric-top { display: flex; align-items: center; gap: 10px; }
.metric-icon { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 10px; }
.metric-label { color: var(--muted-foreground); font-size: 12.5px; font-weight: 500; }
.metric-body { display: flex; align-items: flex-end; gap: 12px; margin: 14px 0 8px; }
.metric-spark { width: 42%; max-width: 120px; flex: none; }
.metric-value { min-width: 0; flex: 1; min-height: 30px; margin: 0; color: var(--foreground); font-family: var(--font-display); font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.metric-value--empty { color: var(--subtle-foreground); }
.metric-next { color: var(--muted-foreground); }
.metric-footer { font-variant-numeric: tabular-nums; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 20px; color: var(--subtle-foreground); font-size: 12px; }
.trend-pill { font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
.trend-pill--good { color: var(--secondary-soft-foreground); background: var(--secondary-soft); }
.trend-pill--bad { color: var(--danger); background: var(--danger-soft); }
.trend-pill--flat { color: var(--muted-foreground); background: var(--muted); }
</style>
