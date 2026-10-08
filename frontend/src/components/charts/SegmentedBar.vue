<script setup lang="ts">
import { computed } from 'vue';
import type { ChartSegment } from '@/types/erp';

const props = defineProps<{ segments: ChartSegment[]; label: string }>();
const total = computed(() => props.segments.reduce((sum, segment) => sum + segment.value, 0) || 1);
const percent = (value: number) => Math.round((value / total.value) * 100);
</script>

<template>
  <div class="segmented">
    <div class="bar" role="img" :aria-label="label">
      <span v-for="segment in segments" :key="segment.label" :style="{ flexGrow: segment.value, background: `var(${segment.color})` }" :title="`${segment.label}: ${percent(segment.value)}%`" />
    </div>
    <ul class="legend">
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
.bar { display: flex; gap: 4px; height: 12px; overflow: hidden; border-radius: 999px; }
.bar span { min-width: 6px; flex-basis: 0; }
.bar span:first-child { border-radius: 999px 0 0 999px; }
.bar span:last-child { border-radius: 0 999px 999px 0; }
.legend { display: flex; flex-direction: column; margin: 18px 0 0; padding: 0; list-style: none; }
.legend li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
.legend li:last-child { border-bottom: 0; }
.swatch { width: 10px; height: 10px; flex: none; border-radius: 3px; }
.legend-label { flex: 1; color: var(--muted-foreground); }
.legend-value { color: var(--foreground); font-weight: 600; }
.legend-percent { width: 40px; color: var(--subtle-foreground); text-align: right; }
</style>
