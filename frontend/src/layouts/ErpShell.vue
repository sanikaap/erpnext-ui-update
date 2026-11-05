<script setup lang="ts">
import { watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import Sidebar from '@/components/navigation/Sidebar.vue';
import Topbar from '@/components/navigation/Topbar.vue';
import Breadcrumbs from '@/components/navigation/Breadcrumbs.vue';
import ToastHost from '@/components/feedback/ToastHost.vue';
import ConfirmHost from '@/components/feedback/ConfirmHost.vue';
import DeskHost from '@/components/desk/DeskHost.vue';
import { useLayoutStore } from '@/stores/layout';

const route = useRoute();
const layout = useLayoutStore();

// Navigating from the mobile drawer closes it.
watch(() => route.fullPath, () => { layout.mobileSidebarOpen = false; });
</script>

<template>
  <div class="app-shell" :style="{ '--sidebar-offset': `${layout.sidebarOffset}px` }">
    <Sidebar :open="layout.mobileSidebarOpen" @close="layout.mobileSidebarOpen = false" />
    <Transition name="fade"><div v-if="layout.mobileSidebarOpen" class="mobile-scrim" @click="layout.mobileSidebarOpen = false" /></Transition>
    <div class="main-column">
      <Topbar @toggle-menu="layout.mobileSidebarOpen = !layout.mobileSidebarOpen" />
      <main class="page-body">
        <Breadcrumbs />
        <RouterView v-slot="{ Component }">
          <Transition name="route-fade"><component :is="Component" :key="route.name === 'document-detail' ? undefined : route.path" /></Transition>
        </RouterView>
      </main>
    </div>
    <ToastHost />
    <ConfirmHost />
    <DeskHost />
  </div>
</template>

<style scoped>
.app-shell { min-height: 100dvh; }
.main-column { min-width: 0; min-height: 100dvh; margin-left: var(--sidebar-offset); transition: margin-left .22s var(--ease); }
.page-body { max-width: 1480px; margin: 0 auto; padding: 22px 28px 56px; }
.mobile-scrim { display: none; position: fixed; z-index: 45; inset: 0; background: var(--overlay); backdrop-filter: blur(2px); }
@media (max-width: 900px) {
  .main-column { margin-left: 0; }
  .page-body { padding: 16px 16px 40px; }
  .mobile-scrim { display: block; }
}
</style>
