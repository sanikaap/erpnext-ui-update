<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { useThemeStore } from '@/stores/theme';
import type { ChartSegment } from '@/types/erp';

/**
 * Part-to-whole ring with the total in the centre and a value legend beside it.
 * Segment colors are tokens in fixed slot order; 2px surface gaps separate slices.
 */
const props = withDefaults(defineProps<{
  segments: ChartSegment[];
  label: string;
  /** Text under the centre figure, e.g. "children". */
  centerLabel?: string;
  /** Centre figure; defaults to the summed value. */
  centerValue?: string;
  size?: number;
}>(), { centerLabel: 'total', centerValue: undefined, size: 200 });

const el = ref<HTMLElement | null>(null);
const theme = useThemeStore();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

const total = computed(() => props.segments.reduce((sum, segment) => sum + segment.value, 0));
const percent = (value: number) => (total.value ? Math.round((value / total.value) * 100) : 0);
const centre = computed(() => props.centerValue ?? total.value.toLocaleString());
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function render() {
  if (!chart) return;
  const surface = token('--surface');
  chart.setOption({
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration: 500,
    tooltip: {
      trigger: 'item', confine: true,
      backgroundColor: token('--surface-elevated'), borderColor: token('--border'), borderWidth: 1, padding: [8, 12],
      textStyle: { color: token('--foreground'), fontSize: 12, fontFamily: token('--font-sans') },
      extraCssText: `border-radius: 10px; box-shadow: ${token('--shadow-lg')};`,
      formatter: (params: { name: string; percent: number; data: { display?: string; value: number } }) => `<b>${params.name}</b><br/>${params.data.display ?? params.data.value.toLocaleString()} · ${Math.round(params.percent)}%`,
    },
    series: [{
      type: 'pie', radius: ['64%', '92%'], center: ['50%', '50%'], avoidLabelOverlap: true,
      label: { show: false }, labelLine: { show: false },
      itemStyle: { borderColor: surface, borderWidth: 2, borderRadius: 4 },
      emphasis: { scale: true, scaleSize: 5 },
      data: props.segments.map((segment) => ({ name: segment.label, value: segment.value, display: segment.display, itemStyle: { color: token(segment.color) } })),
    }],
  }, true);
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});
watch(() => theme.isDark, () => nextTick(render));
watch(() => props.segments, () => render(), { deep: true });
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>

<template>
  <div class="donut-chart">
    <div class="donut-ring" :style="{ width: `${size}px`, height: `${size}px` }">
      <div ref="el" class="ring-canvas" role="img" :aria-label="`${label}: ${segments.map((segment) => `${segment.label} ${percent(segment.value)}%`).join(', ')}`" />
      <div class="ring-centre"><strong class="tabular">{{ centre }}</strong><span>{{ centerLabel }}</span></div>
    </div>
    <ul class="ring-legend">
      <li v-for="segment in segments" :key="segment.label">
        <i :style="{ background: `var(${segment.color})` }" />
        <span class="ring-name">{{ segment.label }}</span>
        <b class="tabular">{{ segment.display ?? segment.value.toLocaleString() }}</b>
        <em class="tabular">{{ percent(segment.value) }}%</em>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut-chart { display: flex; flex-wrap: wrap; align-items: center; gap: 20px 28px; }
.donut-ring { position: relative; flex: none; }
.ring-canvas { width: 100%; height: 100%; }
.ring-centre { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 2px; pointer-events: none; text-align: center; }
.ring-centre strong { color: var(--foreground); font-family: var(--font-display); font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.ring-centre span { color: var(--subtle-foreground); font-size: 10.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.ring-legend { display: flex; min-width: 200px; flex: 1; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.ring-legend li { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
.ring-legend li:last-child { border-bottom: 0; }
.ring-legend i { width: 10px; height: 10px; flex: none; border-radius: 3px; }
.ring-name { min-width: 0; flex: 1; overflow: hidden; color: var(--muted-foreground); text-overflow: ellipsis; white-space: nowrap; }
.ring-legend b { color: var(--foreground); font-weight: 600; }
.ring-legend em { width: 38px; color: var(--subtle-foreground); font-style: normal; text-align: right; }
</style>
