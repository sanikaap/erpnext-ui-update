<script setup lang="ts">
import { computed } from 'vue';

/**
 * Tiny trend line for KPI tiles. Decorative: the tile states the figure in text,
 * so the sparkline is hidden from assistive tech. Needs at least two points.
 */
const props = withDefaults(defineProps<{
  data: number[];
  /** Token name of the line color. */
  color?: string;
  height?: number;
}>(), { color: '--chart-1', height: 36 });

const W = 100;
const id = `spark-${Math.random().toString(36).slice(2, 9)}`;

const points = computed(() => {
  const values = props.data.map((value) => Number(value) || 0);
  if (values.length < 2) return [];
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  // 3px headroom top and bottom so the 2px line never clips.
  return values.map((value, index) => ({ x: (index / (values.length - 1)) * W, y: 3 + (1 - (value - min) / span) * (props.height - 6) }));
});
const line = computed(() => points.value.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));
const area = computed(() => (points.value.length ? `${line.value} L${W},${props.height} L0,${props.height} Z` : ''));
const last = computed(() => points.value[points.value.length - 1]);
</script>

<template>
  <div v-if="points.length" class="sparkline" :style="{ height: `${height}px`, '--spark': `var(${color})` }" aria-hidden="true">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="id" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity=".2" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="area" :fill="`url(#${id})`" />
      <path :d="line" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
    <!-- The end dot lives outside the stretched SVG so it stays round. -->
    <span v-if="last" class="spark-dot" :style="{ left: `${last.x}%`, top: `${(last.y / height) * 100}%` }" />
  </div>
</template>

<style scoped>
.sparkline { position: relative; width: 100%; color: var(--spark); }
.sparkline svg { display: block; width: 100%; height: 100%; overflow: visible; }
.spark-dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: var(--spark); box-shadow: 0 0 0 2px var(--surface); transform: translate(-50%, -50%); }
</style>
