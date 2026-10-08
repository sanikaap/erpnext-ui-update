<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { useThemeStore } from '@/stores/theme';

export interface TrendSeries {
  name: string;
  data: number[];
  /** Token name of the series color, e.g. '--chart-1'. */
  color: string;
}

const props = withDefaults(defineProps<{
  labels: string[];
  series: TrendSeries[];
  type?: 'bar' | 'line';
  height?: number;
  formatValue?: (value: number) => string;
  /** Counts: whole-number axis steps only. */
  integer?: boolean;
}>(), { type: 'bar', height: 260, integer: false });

const chartEl = ref<HTMLElement | null>(null);
const theme = useThemeStore();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

// Colors come from the design tokens so the chart follows the active theme.
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function render() {
  if (!chart) return;
  const axis = token('--subtle-foreground');
  const grid = token('--border');
  const format = props.formatValue ?? ((value: number) => value.toLocaleString());
  chart.setOption({
    animationDuration: 500,
    grid: { top: 12, right: 6, bottom: 4, left: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: props.type === 'bar' ? 'shadow' : 'line', shadowStyle: { color: token('--primary-softer') }, lineStyle: { color: token('--border-strong') } },
      backgroundColor: token('--surface-elevated'),
      borderColor: token('--border'),
      padding: [8, 12],
      textStyle: { color: token('--foreground'), fontSize: 12, fontFamily: 'Inter' },
      valueFormatter: (value: number) => format(Number(value)),
      extraCssText: 'border-radius: 10px; box-shadow: 0 8px 24px rgba(20,10,60,.14);',
    },
    xAxis: { type: 'category', data: props.labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: axis, fontSize: 11, fontFamily: 'Inter', margin: 10, hideOverlap: true } },
    yAxis: { type: 'value', splitNumber: 4, minInterval: props.integer ? 1 : undefined, axisLabel: { color: axis, fontSize: 11, fontFamily: 'Inter', formatter: (value: number) => format(value) }, splitLine: { lineStyle: { color: grid, type: 'dashed' } } },
    series: props.series.map((entry) => {
      const color = token(entry.color);
      return props.type === 'bar'
        ? { name: entry.name, type: 'bar', data: entry.data, barMaxWidth: 14, barGap: '30%', itemStyle: { color, borderRadius: [5, 5, 0, 0] }, emphasis: { itemStyle: { color } } }
        : {
          name: entry.name, type: 'line', data: entry.data, smooth: true, symbol: 'circle', symbolSize: 5, showSymbol: false,
          lineStyle: { color, width: 2.5 }, itemStyle: { color },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${color}55` }, { offset: 1, color: `${color}00` }]) },
        };
    }),
  }, true);
}

onMounted(() => {
  if (!chartEl.value) return;
  chart = echarts.init(chartEl.value);
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(chartEl.value);
});
watch(() => theme.isDark, () => nextTick(render));
watch(() => [props.labels, props.series], () => render(), { deep: true });
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>

<template><div ref="chartEl" class="trend-chart" :style="{ height: `${height}px` }" role="img" :aria-label="series.map((entry) => entry.name).join(' and ')" /></template>

<style scoped>.trend-chart { width: 100%; }</style>
