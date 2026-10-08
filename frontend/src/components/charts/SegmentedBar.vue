<script setup lang="ts">
import { computed } from 'vue';
import type { ChartSegment } from '@/types/erp';

const props = withDefaults(defineProps<{ segments: ChartSegment[]; label: string; /** Headline above the bar (e.g. "₹4.2L outstanding"). */ heading?: string }>(), { heading: undefined });
const total = computed(() => props.segments.reduce((sum, segment) => sum + segment.value, 0) || 1);
const percent = (value: number) => Math.round((value / total.value) * 100);
</script>

<template>
  <div class="segmented">
    <p v-if="heading" class="segmented-total tabular">{{ heading }}</p>
    <div class="bar" role="img" :aria-label="`${label}: ${segments.map((segment) => `${segment.label} ${percent(segment.value)}%`).join(', ')}`">
      <span v-for="segment in segments" :key="segment.label" :style="{ flexGrow: segment.value, background: `var(${segment.color})` }" :title="`${segment.label}: ${percent(segment.value)}%`" />
    </div>
    <ul :class="['legend', { 'legend--grid': segments.length > 4 }]">
      <li v-for="segment in segments" :key="segment.label">
        <span class="swatch" :style="{ background: `var(${segment.color})` }" />
        <span class="legend-label">{{ segment.label }}</span>
        <span v-if="segment.display" class="legend-value tabular">{{ segment.display }}</span>
        <span class="legend-percent tabular">{{ percent(segment.value) }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.segmented-total { margin-bottom: 10px; color: var(--foreground); font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
/* 2px surface gaps separate the fills; rounded only at the two ends. */
.bar { display: flex; gap: 2px; height: 14px; overflow: hidden; border-radius: 6px; }
.bar span { min-width: 6px; flex-basis: 0; transition: filter var(--dur-fast) var(--ease); }
.bar span:hover { filter: brightness(1.08); }
.legend { display: flex; flex-direction: column; margin: 16px 0 0; padding: 0; list-style: none; }
.legend--grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; }
.legend li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
.legend li:last-child { border-bottom: 0; }
.swatch { width: 10px; height: 10px; flex: none; border-radius: 3px; }
.legend-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 520px) { .legend--grid { grid-template-columns: 1fr; } }
.legend-label { flex: 1; color: var(--muted-foreground); }
.legend-value { color: var(--foreground); font-weight: 600; }
.legend-percent { width: 40px; color: var(--subtle-foreground); text-align: right; }
</style>
