<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import SidebarLevelOne from './sidebar/SidebarLevelOne.vue';
import SidebarLevelTwo from './sidebar/SidebarLevelTwo.vue';
import { useNavigation } from '@/composables/useNavigation';
import { getModuleForPath } from '@/app/module-registry';
import { useLayoutStore } from '@/stores/layout';

/**
 * Two-level sidebar.
 *   Level 1  modules (ERPNext, NGO…)          → SidebarLevelOne
 *   Level 2  the selected module's navigation  → SidebarLevelTwo
 *
 * The sidebar keeps its own navigation state (layout.openModule): choosing a module
 * opens its Level 2 without changing the page, and "← Module" returns to Level 1
 * without touching browser history.
 *
 * Modes:
 *   expanded   Level 1 full width; with Level 2 open, Level 1 becomes an icon rail beside it
 *   collapsed  icon rail only; Level 2 opens as a floating panel next to the rail
 *   mobile     drawer that drills down from Level 1 into Level 2
 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const route = useRoute();
const layout = useLayoutStore();
const { workspaces, modules } = useNavigation();

const mobileQuery = window.matchMedia('(max-width: 900px)');
const isMobile = ref(mobileQuery.matches);
const onMedia = (event: MediaQueryListEvent) => { isMobile.value = event.matches; };
mobileQuery.addEventListener('change', onMedia);
onBeforeUnmount(() => mobileQuery.removeEventListener('change', onMedia));

const activeModule = computed(() => getModuleForPath(route.path, route.params.doctype ? String(route.params.doctype) : undefined));
const openModule = computed(() => modules.value.find((module) => module.key === layout.openModule) ?? null);

/** Desktop collapsed mode: Level 2 floats instead of docking. */
const floating = computed(() => layout.sidebarCollapsed && !isMobile.value);
/** Level 1 shows as icons when collapsed, or when Level 2 is docked beside it. */
const railMode = computed(() => !isMobile.value && (layout.sidebarCollapsed || Boolean(openModule.value)));

// Follow the page: entering a module's page opens its Level 2 (docked mode only;
// a floating panel closes after you pick a page).
watch(() => route.fullPath, () => {
  if (floating.value) { layout.openModule = null; return; }
  if (isMobile.value) return;
  layout.openModule = activeModule.value?.key ?? null;
}, { immediate: true });

// Switching between docked and floating modes should not leave a stale floating panel.
watch(floating, (value) => { layout.openModule = value ? null : activeModule.value?.key ?? null; });

function select(key: string) {
  layout.openModule = layout.openModule === key && floating.value ? null : key;
}

function back() {
  layout.openModule = null;
}

function navigated() {
  if (floating.value) layout.openModule = null;
  emit('close');
}

// The mobile drawer opens on the current module's Level 2.
watch(() => isMobile.value && layout.mobileSidebarOpen, (opened) => {
  if (opened) layout.openModule = activeModule.value?.key ?? null;
});
</script>

<template>
  <aside
    :class="['sidebar', { 'sidebar-open': open, 'sidebar--rail': railMode, 'sidebar--docked': openModule && !floating && !isMobile }]"
    aria-label="Sidebar"
  >
    <div class="sidebar-level sidebar-level--one">
      <SidebarLevelOne
        :workspaces="workspaces"
        :compact="railMode"
        :active-key="activeModule?.key"
        :open-key="layout.openModule"
        :collapsed="layout.sidebarCollapsed"
        :show-collapse-toggle="!isMobile"
        @select="select"
        @navigate="navigated"
        @toggle-collapse="layout.toggleSidebar()"
      />
    </div>

    <Transition :name="floating ? 'float' : 'slide'">
      <div v-if="openModule" :key="openModule.key" :class="['sidebar-level sidebar-level--two', { floating }]">
        <SidebarLevelTwo :module="openModule" :floating="floating" @back="back" @navigate="navigated" />
      </div>
    </Transition>
    <div v-if="floating && openModule" class="float-scrim" aria-hidden="true" @click="back" />
  </aside>
</template>

<style scoped>
.sidebar {
  --sidebar-rail-width: 68px;
  position: fixed; z-index: 50; inset: 0 auto 0 0;
  display: flex; width: 248px;
  color: var(--nav-fg); background: var(--nav-bg-1);
  transition: width .22s var(--ease), transform .22s var(--ease);
}
.sidebar-level--one { position: relative; z-index: 3; width: 100%; flex: none; transition: width .22s var(--ease); }
.sidebar--rail .sidebar-level--one { width: var(--sidebar-rail-width); }
.sidebar--rail { width: var(--sidebar-rail-width); }
.sidebar--docked { width: calc(var(--sidebar-rail-width) + 236px); }
.sidebar-level--two { position: relative; z-index: 2; width: 236px; flex: none; }
.sidebar-level--two.floating { position: absolute; top: 0; bottom: 0; left: var(--sidebar-rail-width); }
.float-scrim { position: fixed; z-index: 1; inset: 0 0 0 calc(var(--sidebar-rail-width) + 236px); }

.slide-enter-active, .slide-leave-active { transition: opacity .2s ease, transform .22s var(--ease); }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(-12px); }
.slide-leave-active { position: absolute; top: 0; bottom: 0; left: var(--sidebar-rail-width); }
.float-enter-active, .float-leave-active { transition: opacity .16s ease, transform .2s var(--ease); }
.float-enter-from, .float-leave-to { opacity: 0; transform: translateX(-10px); }

@media (max-width: 900px) {
  .sidebar, .sidebar--rail, .sidebar--docked { width: 288px; max-width: 86vw; overflow: hidden; transform: translateX(-101%); }
  .sidebar.sidebar-open { transform: none; box-shadow: var(--shadow-lg); }
  .sidebar-level--one, .sidebar--rail .sidebar-level--one { width: 100%; }
  /* Mobile drill-down: Level 2 slides over Level 1 inside the drawer. */
  .sidebar-level--two, .slide-leave-active { position: absolute; z-index: 4; inset: 0; width: 100%; }
}
</style>
