<script setup lang="ts">
import type { Component } from 'vue';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import Sparkline from '@/components/charts/Sparkline.vue';
import type { StatusTone } from '@/types/erp';

/**
 * The KPI tile used on the dashboard and every module overview. White card; the
 * tone colours only the icon (or dot), the sparkline and the hover border.
 */
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
  /** Optional: without one, a small tone dot marks the tile. */
  icon?: Component;
  to?: string;
  loading?: boolean;
  /** Next step shown instead of the hint when the value is empty (e.g. zero); also mutes the value. */
  emptyHint?: string;
  /** Recent values (oldest first) drawn as a small trend line beside the figure. */
  spark?: number[];
  /** Token name for the sparkline color (default: the tile's tone). */
  sparkColor?: string;
}

defineProps<{ metric: Metric }>();
</script>

<template>
  <component :is="metric.to ? RouterLink : 'article'" :to="metric.to" :class="['metric-card', `kpi-tone-${metric.tone}`, { 'metric-card--link': metric.to }]" data-testid="card-metric">
    <div class="metric-top">
      <span v-if="metric.icon" class="metric-icon"><component :is="metric.icon" :size="18" :stroke-width="2" /></span>
      <span class="metric-label" :title="metric.label">{{ metric.label }}</span>
      <span v-if="!metric.icon" class="metric-dot" aria-hidden="true" />
    </div>
    <div :class="['metric-value tabular', { 'metric-value--empty': metric.emptyHint && !metric.loading, 'metric-value--text': metric.value.length > 10 }]" :title="metric.value"><span v-if="metric.loading" class="skeleton" style="width: 60%; height: 28px" /><template v-else>{{ metric.value }}</template></div>
    <div class="metric-foot">
      <div class="metric-footer">
        <span v-if="metric.emptyHint && !metric.loading" class="metric-next">{{ metric.emptyHint }}</span>
        <template v-else-if="!metric.loading">
          <span v-if="metric.delta" :class="['trend', metric.trend === 'flat' || !metric.trend ? 'trend--flat' : (metric.trend === 'up') === (metric.upIsGood ?? true) ? 'trend--good' : 'trend--bad']">
            <ArrowUpRight v-if="metric.trend === 'up'" :size="13" /><ArrowDownRight v-else-if="metric.trend === 'down'" :size="13" /><Minus v-else :size="13" />{{ metric.delta }}
          </span>
          <span v-if="metric.hint" class="metric-hint">{{ metric.hint }}</span>
        </template>
      </div>
      <Sparkline v-if="metric.spark && !metric.loading && metric.spark.filter(Boolean).length >= 3" :data="metric.spark" :color="metric.sparkColor || '--tone'" :height="40" class="metric-spark" />
    </div>
  </component>
</template>

<style scoped>
.metric-card { position: relative; display: flex; min-width: 0; flex-direction: column; padding: 18px 18px 16px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-med) var(--ease), transform var(--dur-med) var(--ease); }
.metric-card--link:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.metric-card--link:hover { border-color: color-mix(in srgb, var(--tone) 40%, var(--border)); box-shadow: var(--shadow-hover); transform: translateY(-1px); }
.metric-top { display: flex; min-width: 0; align-items: center; gap: 12px; }
.metric-icon { display: grid; width: 40px; height: 40px; flex: none; place-items: center; color: var(--tone); border-radius: 50%; background: color-mix(in srgb, var(--tone) 12%, transparent); }
.metric-label { min-width: 0; flex: 1; overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.metric-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--tone); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 18%, transparent); }
.metric-value { min-height: 34px; margin: 14px 0 10px; overflow: hidden; color: var(--foreground); font-family: var(--font-display); font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.metric-value--text { font-size: 20px; line-height: 1.6; }
.metric-value--empty { color: var(--subtle-foreground); }
.metric-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: auto; }
.metric-footer { display: flex; min-width: 0; flex-direction: column; gap: 3px; min-height: 36px; color: var(--subtle-foreground); font-size: 12px; font-variant-numeric: tabular-nums; }
.metric-next { color: var(--muted-foreground); }
.metric-hint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.metric-spark { width: 44%; max-width: 104px; flex: none; }
.trend { display: inline-flex; align-items: center; gap: 3px; font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.trend--good { color: var(--success-soft-foreground); }
.trend--bad { color: var(--danger-soft-foreground); }
.trend--flat { color: var(--muted-foreground); }
</style>
