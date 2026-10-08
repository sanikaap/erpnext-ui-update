<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
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
  /** 'line' draws a soft area under each line; 'bar' draws rounded columns. */
  type?: 'bar' | 'line';
  height?: number;
  formatValue?: (value: number) => string;
  /** Counts: whole-number axis steps only. */
  integer?: boolean;
  /** The parent already shows a legend for these series. */
  hideLegend?: boolean;
  /** Stack bar series into one column per label. */
  stacked?: boolean;
}>(), { type: 'bar', height: 260, integer: false, hideLegend: false, stacked: false });

const chartEl = ref<HTMLElement | null>(null);
const theme = useThemeStore();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

// A legend is required as soon as there are two series (identity is never colour alone).
const showLegend = computed(() => !props.hideLegend && props.series.length > 1);

// Colors and type come from the design tokens so the chart follows the active theme.
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Hex token → rgba() with alpha (tokens are 6-digit hex). */
function alpha(hex: string, value: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

function render() {
  if (!chart) return;
  const axis = token('--chart-axis');
  const grid = token('--chart-grid');
  const text = token('--foreground');
  const muted = token('--subtle-foreground');
  const surface = token('--surface-elevated');
  const font = token('--font-sans');
  const format = props.formatValue ?? ((value: number) => value.toLocaleString());
  const isLine = props.type === 'line';
  // Direct-label the line ends when there are few series (≤ 3); otherwise the legend carries identity.
  const directLabels = isLine && props.series.length <= 3 && props.labels.length > 1;

  chart.setOption({
    animation: !reducedMotion(),
    animationDuration: 450,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: font },
    grid: { top: 16, right: directLabels ? 56 : 8, bottom: 4, left: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: isLine
        ? { type: 'line', lineStyle: { color: token('--border-strong'), width: 1 } }
        : { type: 'shadow', shadowStyle: { color: token('--primary-softer') } },
      backgroundColor: surface,
      borderColor: token('--border'),
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: text, fontSize: 12, fontFamily: font },
      extraCssText: `border-radius: 10px; box-shadow: ${token('--shadow-lg')};`,
      formatter: (params: { axisValueLabel: string; seriesName: string; value: number; color: string }[]) => {
        const rows = params.map((entry) => `
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="width:8px;height:8px;border-radius:2px;background:${entry.color}"></span>
            <span style="flex:1;color:${muted}">${entry.seriesName}</span>
            <b style="font-variant-numeric:tabular-nums;color:${text};margin-left:12px">${format(Number(entry.value) || 0)}</b>
          </div>`).join('');
        return `<div style="min-width:150px"><div style="font-weight:600;color:${text}">${params[0]?.axisValueLabel ?? ''}</div>${rows}</div>`;
      },
    },
    xAxis: {
      type: 'category',
      data: props.labels,
      boundaryGap: !isLine,
      axisLine: { show: true, lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { color: axis, fontSize: 11, margin: 10, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      minInterval: props.integer ? 1 : undefined,
      axisLabel: { color: axis, fontSize: 11, formatter: (value: number) => format(value) },
      splitLine: { lineStyle: { color: grid, type: [3, 4] } },
    },
    series: props.series.map((entry) => {
      const color = token(entry.color);
      if (!isLine) {
        return {
          name: entry.name, type: 'bar', data: entry.data, stack: props.stacked ? 'total' : undefined,
          barMaxWidth: 18, barGap: '20%', barCategoryGap: '38%',
          itemStyle: { color, borderRadius: props.stacked ? 0 : [4, 4, 0, 0] },
          emphasis: { focus: 'series', itemStyle: { color } },
        };
      }
      return {
        name: entry.name, type: 'line', data: entry.data,
        smooth: 0.3, smoothMonotone: 'x',
        symbol: 'circle', symbolSize: 8, showSymbol: false,
        lineStyle: { color, width: 2 },
        itemStyle: { color, borderColor: surface, borderWidth: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: alpha(color, .22) }, { offset: 1, color: alpha(color, 0) }]) },
        emphasis: { focus: 'series' },
        endLabel: directLabels ? { show: true, color: text, fontSize: 11, fontWeight: 600, distance: 6, formatter: (params: { value: number }) => format(Number(params.value) || 0) } : undefined,
        labelLayout: directLabels ? { moveOverlap: 'shiftY' } : undefined,
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
watch(() => [props.labels, props.series, props.type], () => render(), { deep: true });
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>

<template>
  <div class="trend">
    <ul v-if="showLegend" class="trend-legend">
      <li v-for="entry in series" :key="entry.name">
        <i :style="{ background: `var(${entry.color})` }" />{{ entry.name }}
      </li>
    </ul>
    <div ref="chartEl" class="trend-chart" :style="{ height: `${height}px` }" role="img" :aria-label="`${series.map((entry) => entry.name).join(' and ')} by ${labels.length > 1 ? `${labels[0]} to ${labels[labels.length - 1]}` : 'period'}`" />
  </div>
</template>

<style scoped>
.trend { display: flex; min-width: 0; flex-direction: column; gap: 10px; }
.trend-chart { width: 100%; }
.trend-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; }
.trend-legend li { display: inline-flex; align-items: center; gap: 7px; color: var(--muted-foreground); font-size: 12px; }
.trend-legend i { width: 10px; height: 10px; flex: none; border-radius: 3px; }
</style>
