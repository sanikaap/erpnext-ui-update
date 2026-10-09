<script setup lang="ts">
import { computed } from 'vue';
import { useCurrentUser } from '@/composables/useCurrentUser';

/** Dashboard/overview header: "Good morning, <name>", a subtitle, and actions on the right. */
defineProps<{ subtitle?: string }>();
const { firstName } = useCurrentUser();
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
});
</script>

<template>
  <header class="page-header dashboard-header">
    <div>
      <h1 class="page-title">{{ greeting }}<template v-if="firstName">, <span class="greeting-name">{{ firstName }}</span></template></h1>
      <p v-if="subtitle || $slots.subtitle" class="page-subtitle"><slot name="subtitle">{{ subtitle }}</slot></p>
    </div>
    <div v-if="$slots.default" class="page-actions"><slot /></div>
  </header>
</template>

<style scoped>
.dashboard-header { margin-bottom: 4px; }
.greeting-name { color: var(--primary); }
</style>
