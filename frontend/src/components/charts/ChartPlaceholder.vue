<script setup lang="ts">
import type { Component } from 'vue';
import { BarChart3 } from 'lucide-vue-next';

/**
 * Empty chart area: a faint, clearly-unlabelled outline of the chart that will
 * appear (no axes, no numbers, so it can't be mistaken for data) with the empty
 * message and next step on top. Keeps the card the same size with or without data.
 */
withDefaults(defineProps<{
  kind?: 'line' | 'bar' | 'donut' | 'rows';
  title: string;
  description?: string;
  icon?: Component;
  height?: number;
}>(), { kind: 'line', icon: () => BarChart3, height: 220 });

// Fixed decorative shapes (not data).
const bars = [38, 56, 44, 70, 52, 80, 62, 74, 48, 66, 58, 84];
</script>

<template>
  <div class="placeholder" :style="{ minHeight: `${height}px` }">
    <div class="ghost" aria-hidden="true">
      <svg v-if="kind === 'line'" viewBox="0 0 400 160" preserveAspectRatio="none">
        <line v-for="row in 4" :key="row" x1="0" :y1="row * 36" x2="400" :y2="row * 36" class="ghost-grid" />
        <path d="M0,118 C40,112 60,90 100,96 S160,70 200,74 S260,48 300,58 S360,30 400,36 L400,160 L0,160 Z" class="ghost-area" />
        <path d="M0,118 C40,112 60,90 100,96 S160,70 200,74 S260,48 300,58 S360,30 400,36" class="ghost-line" />
      </svg>
      <div v-else-if="kind === 'bar'" class="ghost-bars">
        <i v-for="(bar, index) in bars" :key="index" :style="{ height: `${bar}%` }" />
      </div>
      <div v-else-if="kind === 'donut'" class="ghost-donut" />
      <div v-else class="ghost-rows">
        <span v-for="row in 4" :key="row"><i /><b :style="{ width: `${90 - row * 14}%` }" /></span>
      </div>
    </div>
    <div class="placeholder-copy">
      <span class="placeholder-icon" aria-hidden="true"><component :is="icon" :size="16" /></span>
      <strong>{{ title }}</strong>
      <p v-if="description">{{ description }}</p>
      <div v-if="$slots.default" class="placeholder-actions"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.placeholder { position: relative; display: grid; place-items: center; overflow: hidden; border-radius: var(--radius-lg); }
.ghost { position: absolute; inset: 8px 4px 4px; display: flex; align-items: flex-end; }
.ghost svg { width: 100%; height: 75%; }
.ghost-grid { stroke: var(--chart-grid); stroke-dasharray: 3 4; vector-effect: non-scaling-stroke; }
.ghost-line { fill: none; stroke: color-mix(in srgb, var(--chart-neutral) 55%, transparent); stroke-width: 2.5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.ghost-area { fill: var(--chart-track); opacity: .8; }
.ghost-bars { display: flex; width: 100%; height: 75%; align-items: flex-end; gap: 2.5%; padding: 0 4%; }
.ghost-bars i { flex: 1; border-radius: 4px 4px 0 0; background: var(--chart-track); }
.ghost-donut { width: 170px; height: 170px; margin: auto; border: 14px dashed color-mix(in srgb, var(--chart-neutral) 45%, transparent); border-radius: 50%; }
.ghost-rows { display: flex; width: 100%; height: 100%; flex-direction: column; justify-content: center; gap: 18px; padding: 0 6px; }
.ghost-rows span { display: flex; align-items: center; gap: 12px; }
.ghost-rows i { width: 22px; height: 22px; flex: none; border-radius: 6px; background: var(--chart-track); }
.ghost-rows span { opacity: .9; }
.ghost-rows b { height: 8px; border-radius: 999px; background: var(--chart-track); }
/* Copy sits on a soft halo of the card surface so it reads over the outline. */
.placeholder-copy { position: relative; z-index: 1; display: flex; max-width: 320px; flex-direction: column; align-items: center; gap: 4px; padding: 14px 18px; border-radius: var(--radius-lg); background: color-mix(in srgb, var(--surface) 92%, transparent); box-shadow: 0 0 18px 6px color-mix(in srgb, var(--surface) 92%, transparent); text-align: center; }
.placeholder-icon { display: grid; width: 32px; height: 32px; margin-bottom: 4px; place-items: center; color: var(--primary); border-radius: 9px; background: var(--primary-soft); }
.placeholder-copy strong { color: var(--foreground); font-size: 13.5px; font-weight: 600; }
.placeholder-copy p { color: var(--subtle-foreground); font-size: 12.5px; }
.placeholder-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px; }
</style>
