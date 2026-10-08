<script setup lang="ts">
import type { Component } from 'vue';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
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
}

defineProps<{ metric: Metric }>();
</script>

<template>
  <component :is="metric.to ? RouterLink : 'article'" :to="metric.to" :class="['metric-card', `metric-card--${metric.tone}`, { 'metric-card--link': metric.to }]" data-testid="card-metric">
    <div class="metric-top">
      <span :class="['metric-icon', `tone-${metric.tone}`]"><component :is="metric.icon" :size="17" /></span>
      <span class="metric-label">{{ metric.label }}</span>
    </div>
    <div class="metric-value tabular"><span v-if="metric.loading" class="skeleton" style="width: 60%; height: 26px" /><template v-else>{{ metric.value }}</template></div>
    <div class="metric-footer">
      <span v-if="metric.delta && !metric.loading" :class="['trend-pill', metric.trend === 'flat' || !metric.trend ? 'trend-pill--flat' : (metric.trend === 'up') === (metric.upIsGood ?? true) ? 'trend-pill--good' : 'trend-pill--bad']">
        <ArrowUpRight v-if="metric.trend === 'up'" :size="12" /><ArrowDownRight v-else-if="metric.trend === 'down'" :size="12" /><Minus v-else :size="12" />{{ metric.delta }}
      </span>
      <span v-if="metric.hint">{{ metric.hint }}</span>
    </div>
  </component>
</template>

<style scoped>
.metric-card { position: relative; display: flex; flex-direction: column; overflow: hidden; padding: 16px 18px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); transition: border-color .15s, box-shadow .15s, transform .15s; }
.metric-card::before { position: absolute; inset: 0 0 auto; height: 3px; content: ''; opacity: .9; }
.metric-card--violet::before { background: linear-gradient(90deg, var(--primary), transparent); }
.metric-card--green::before { background: linear-gradient(90deg, var(--secondary), transparent); }
.metric-card--cyan::before { background: linear-gradient(90deg, var(--accent), transparent); }
.metric-card--blue::before { background: linear-gradient(90deg, var(--info), transparent); }
.metric-card--amber::before { background: linear-gradient(90deg, var(--warning), transparent); }
.metric-card--rose::before { background: linear-gradient(90deg, var(--danger), transparent); }
.metric-card--link:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.metric-top { display: flex; align-items: center; gap: 10px; }
.metric-icon { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 10px; }
.metric-label { color: var(--muted-foreground); font-size: 12.5px; font-weight: 500; }
.metric-value { min-height: 30px; margin: 14px 0 8px; color: var(--foreground); font-size: 26px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; }
.metric-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 20px; color: var(--subtle-foreground); font-size: 12px; }
.trend-pill { display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
.trend-pill--good { color: var(--secondary-soft-foreground); background: var(--secondary-soft); }
.trend-pill--bad { color: var(--danger); background: var(--danger-soft); }
.trend-pill--flat { color: var(--muted-foreground); background: var(--muted); }
</style>
