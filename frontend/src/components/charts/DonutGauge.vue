<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  /** 0–100 */
  value: number;
  label: string;
  /** Token name of the arc color. */
  color?: string;
  size?: number;
}>(), { color: '--chart-1', size: 180 });

const STROKE = 14;
const radius = computed(() => (props.size - STROKE) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const dash = computed(() => `${(Math.min(Math.max(props.value, 0), 100) / 100) * circumference.value} ${circumference.value}`);
</script>

<template>
  <div class="donut" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="`${label}: ${value}%`">
    <svg :viewBox="`0 0 ${size} ${size}`">
      <circle :cx="size / 2" :cy="size / 2" :r="radius" fill="none" stroke="var(--chart-track)" :stroke-width="STROKE" />
      <circle :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke="`var(${color})`" :stroke-width="STROKE" stroke-linecap="round" :stroke-dasharray="dash" :transform="`rotate(-90 ${size / 2} ${size / 2})`" class="arc" />
    </svg>
    <div class="donut-center"><strong class="tabular">{{ value }}%</strong><span>{{ label }}</span></div>
  </div>
</template>

<style scoped>
.donut { position: relative; flex: none; }
.donut svg { display: block; width: 100%; height: 100%; }
.arc { transition: stroke-dasharray .6s ease; }
.donut-center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 2px; text-align: center; }
.donut-center strong { color: var(--foreground); font-size: 28px; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
.donut-center span { color: var(--muted-foreground); font-size: 12.5px; }
</style>
