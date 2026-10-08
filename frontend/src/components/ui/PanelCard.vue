<script setup lang="ts">
withDefaults(defineProps<{ title?: string; eyebrow?: string; actionLabel?: string; noPadding?: boolean }>(), { noPadding: false });
defineEmits<{ action: [] }>();
</script>

<template>
  <section class="panel-card" :class="{ 'panel-card--flush': noPadding }">
    <header v-if="title || eyebrow || actionLabel" class="card-heading">
      <div class="card-titles"><h2 v-if="title">{{ title }}</h2><p v-if="eyebrow">{{ eyebrow }}</p></div>
      <button v-if="actionLabel" class="card-action" @click="$emit('action')" data-testid="button-card-action">{{ actionLabel }}</button>
    </header>
    <div :class="{ 'card-content': !noPadding }"><slot /></div>
  </section>
</template>

<style scoped>
.panel-card { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 0; }
.card-titles { min-width: 0; }
.card-titles h2 { color: var(--foreground); font-size: 15px; font-weight: 600; letter-spacing: -.01em; line-height: 1.3; }
.card-titles p { margin-top: 3px; color: var(--muted-foreground); font-size: 12.5px; }
.card-action { flex: none; height: 30px; padding: 0 12px; color: var(--foreground); border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 12.5px; font-weight: 500; transition: background-color .15s; }
.card-action:hover { background: var(--muted); }
.card-content { padding: 18px 22px 22px; }
/* Flush cards (tables) keep a divider so rows start cleanly under the title. */
.panel-card--flush .card-heading { padding-bottom: 16px; border-bottom: 1px solid var(--border); }
</style>
