<script setup lang="ts">
/** The one card used for dashboard panels, settings groups and tables. `#actions` sits beside the title. */
withDefaults(defineProps<{ title?: string; eyebrow?: string; actionLabel?: string; noPadding?: boolean }>(), { noPadding: false });
defineEmits<{ action: [] }>();
</script>

<template>
  <section class="panel-card" :class="{ 'panel-card--flush': noPadding }">
    <header v-if="title || eyebrow || actionLabel || $slots.actions" class="card-heading">
      <div class="card-titles"><h2 v-if="title">{{ title }}</h2><p v-if="eyebrow">{{ eyebrow }}</p></div>
      <div v-if="$slots.actions || actionLabel" class="card-actions">
        <slot name="actions" />
        <button v-if="actionLabel" class="card-action" @click="$emit('action')" data-testid="button-card-action">{{ actionLabel }}</button>
      </div>
    </header>
    <div :class="['card-body', { 'card-content': !noPadding }]"><slot /></div>
  </section>
</template>

<style scoped>
.panel-card { display: flex; min-width: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.card-heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 12px; padding: 18px 20px 0; }
.card-titles { min-width: 0; }
.card-titles h2 { color: var(--foreground); font-size: var(--text-lg); font-weight: 600; letter-spacing: -.01em; line-height: 1.3; }
.card-titles p { margin-top: 2px; color: var(--subtle-foreground); font-size: 12.5px; }
.card-actions { display: flex; flex: none; align-items: center; gap: 8px; }
.card-action { flex: none; height: 30px; padding: 0 12px; color: var(--foreground); border: 1px solid var(--input-border); border-radius: var(--radius-md); background: var(--surface); box-shadow: var(--shadow-sm); font-size: 12.5px; font-weight: 500; transition: background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease); }
.card-action:hover { border-color: var(--border-strong); background: var(--muted); }
.card-action:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.card-body { min-width: 0; flex: 1; }
.card-content { padding: 16px 20px 20px; }
/* Flush cards (tables) keep a divider so rows start cleanly under the title. */
.panel-card--flush .card-heading { padding-bottom: 14px; border-bottom: 1px solid var(--border); }
</style>
