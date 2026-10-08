<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { useThemeStore } from '@/stores/theme';

/** Profile across a few dimensions (e.g. development domains), one shape per series (≤ 3). */
export interface RadarSeries { name: string; values: number[]; color: string }
const props = withDefaults(defineProps<{ axes: string[]; series: RadarSeries[]; max: number; height?: number; label: string }>(), { height: 300 });

const el = ref<HTMLElement | null>(null);
const theme = useThemeStore();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function alpha(hex: string, value: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

function render() {
  if (!chart) return;
  const grid = token('--chart-grid');
  chart.setOption({
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    tooltip: {
      trigger: 'item', confine: true,
      backgroundColor: token('--surface-elevated'), borderColor: token('--border'), borderWidth: 1, padding: [8, 12],
      textStyle: { color: token('--foreground'), fontSize: 12, fontFamily: token('--font-sans') },
      extraCssText: `border-radius: 10px; box-shadow: ${token('--shadow-lg')};`,
    },
    radar: {
      indicator: props.axes.map((name) => ({ name, max: props.max })),
      radius: '72%', splitNumber: 4, shape: 'polygon',
      axisName: { color: token('--muted-foreground'), fontSize: 11.5, fontFamily: token('--font-sans') },
      splitLine: { lineStyle: { color: grid } },
      splitArea: { areaStyle: { color: [alpha(token('--chart-track'), .35), 'transparent'] } },
      axisLine: { lineStyle: { color: grid } },
    },
    series: [{
      type: 'radar',
      data: props.series.map((entry) => {
        const color = token(entry.color);
        return { name: entry.name, value: entry.values, symbol: 'circle', symbolSize: 6, lineStyle: { color, width: 2 }, itemStyle: { color, borderColor: token('--surface'), borderWidth: 2 }, areaStyle: { color: alpha(color, .16) } };
      }),
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
watch(() => [props.axes, props.series], () => render(), { deep: true });
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>

<template>
  <div class="radar">
    <ul class="radar-legend">
      <li v-for="entry in series" :key="entry.name"><i :style="{ background: `var(${entry.color})` }" />{{ entry.name }}</li>
    </ul>
    <div ref="el" :style="{ height: `${height}px` }" role="img" :aria-label="`${label}: ${series.map((entry) => `${entry.name} ${axes.map((axis, index) => `${axis} ${entry.values[index]}`).join(', ')}`).join('; ')}`" />
  </div>
</template>

<style scoped>
.radar { display: flex; flex-direction: column; gap: 6px; }
.radar-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; }
.radar-legend li { display: inline-flex; align-items: center; gap: 7px; color: var(--muted-foreground); font-size: 12px; }
.radar-legend i { width: 10px; height: 10px; border-radius: 3px; }
</style>
