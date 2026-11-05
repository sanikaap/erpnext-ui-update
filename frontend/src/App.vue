<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import ErpShell from '@/layouts/ErpShell.vue';
import { useTheme } from '@/composables/useTheme';

const route = useRoute();
useTheme();
</script>

<template>
  <RouterView v-if="route.meta.public || route.meta.bare" />
  <ErpShell v-else />
</template>
