<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
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
 * Modes (see stores/layout.ts):
 *   open    Level 1 with labels, the selected module's Level 2 docked beside it
 *           (Level 1 shows icons beside Level 2 on screens < 1280px)
 *   closed  icon rail only; Level 2 opens as a floating panel next to the rail
 *   mobile  drawer that drills down from Level 1 into Level 2
 *
 * One open/close toggle, always in the sidebar's top-right corner: in Level 2's
 * header while it is docked, otherwise in Level 1's brand row.
 */
const props = defineProps<{ open: boolean }>();
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
/** Level 1 shows icons only (closed, or beside a docked Level 2 on narrower screens). */
const railMode = computed(() => !isMobile.value && layout.levelOneCompact);
const docked = computed(() => Boolean(openModule.value) && !floating.value && !isMobile.value);

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
  // Choosing the open module again closes its menu.
  layout.openModule = layout.openModule === key ? null : key;
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

// ---------- Mobile drawer: modal while open, unreachable while closed ----------
const aside = ref<HTMLElement | null>(null);
const drawerOpen = computed(() => isMobile.value && props.open);
let returnFocus: HTMLElement | null = null;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function focusables() {
  return [...(aside.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((element) => !element.closest('[inert]') && element.offsetParent !== null);
}
watch(drawerOpen, async (opened) => {
  if (opened) {
    returnFocus = document.activeElement as HTMLElement | null;
    await nextTick();
    focusables()[0]?.focus();
  } else if (returnFocus && isMobile.value) {
    // Navigating closes the drawer too; only hand focus back if it was left inside the drawer.
    if (!document.activeElement || document.activeElement === document.body || aside.value?.contains(document.activeElement)) returnFocus.focus();
    returnFocus = null;
  }
});
// Drilling between Level 1 and Level 2 inside the drawer hides the focused level: move focus along.
watch(() => layout.openModule, async () => {
  if (!drawerOpen.value) return;
  await nextTick();
  focusables()[0]?.focus();
});
function onDrawerKeydown(event: KeyboardEvent) {
  if (!drawerOpen.value) return;
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return; }
  if (event.key !== 'Tab') return;
  const items = focusables();
  if (!items.length) return;
  const active = document.activeElement;
  if (!active || !aside.value?.contains(active) || active.closest('[inert]')) { event.preventDefault(); items[0].focus(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
</script>

<template>
  <aside
    id="app-sidebar"
    ref="aside"
    :class="['sidebar', { 'sidebar-open': open, 'sidebar--rail': railMode, 'sidebar--docked': docked }]"
    aria-label="Sidebar"
    :role="drawerOpen ? 'dialog' : undefined"
    :aria-modal="drawerOpen || undefined"
    :inert="isMobile && !open"
    @keydown="onDrawerKeydown"
  >
    <!-- On mobile, Level 2 covers Level 1 completely: keep the hidden level out of the tab order. -->
    <div class="sidebar-level sidebar-level--one" :inert="isMobile && Boolean(openModule)">
      <SidebarLevelOne
        :workspaces="workspaces"
        :compact="railMode"
        :active-key="activeModule?.key"
        :open-key="layout.openModule"
        :collapsed="layout.sidebarCollapsed"
        :show-toggle="!isMobile && !docked"
        @select="select"
        @navigate="navigated"
        @toggle-collapse="layout.toggleSidebar()"
      />
    </div>

    <Transition :name="floating ? 'float' : 'slide'">
      <div v-if="openModule" :key="openModule.key" :class="['sidebar-level sidebar-level--two', { floating }]">
        <SidebarLevelTwo :module="openModule" :floating="floating" :show-toggle="docked" @back="back" @navigate="navigated" @toggle-collapse="layout.toggleSidebar()" />
      </div>
    </Transition>
    <div v-if="floating && openModule" class="float-scrim" aria-hidden="true" @click="back" />
  </aside>
</template>

<style scoped>
.sidebar {
  --l1-width: 232px;
  --rail-width: 68px;
  --l2-width: 240px;
  --l1-current: var(--l1-width);
  position: fixed; z-index: 50; inset: 0 auto 0 0;
  display: flex; width: var(--l1-current);
  color: var(--nav-fg); background: var(--nav-bg-1);
  transition: width .22s var(--ease), transform .22s var(--ease);
}
.sidebar--rail { --l1-current: var(--rail-width); }
.sidebar--docked { width: calc(var(--l1-current) + var(--l2-width)); }
.sidebar-level--one { position: relative; z-index: 3; width: var(--l1-current); flex: none; transition: width .22s var(--ease); }
.sidebar-level--two { position: relative; z-index: 2; width: var(--l2-width); flex: none; }
.sidebar-level--two.floating { position: absolute; top: 0; bottom: 0; left: var(--rail-width); }
.float-scrim { position: fixed; z-index: 1; inset: 0 0 0 calc(var(--rail-width) + var(--l2-width)); }

.slide-enter-active, .slide-leave-active { transition: opacity var(--dur-med) var(--ease), transform var(--dur-med) var(--ease); }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(-12px); }
.slide-leave-active { pointer-events: none; position: absolute; top: 0; bottom: 0; left: var(--l1-current); }
.float-enter-active, .float-leave-active { transition: opacity var(--dur-med) var(--ease), transform var(--dur-med) var(--ease); }
.float-enter-from, .float-leave-to { opacity: 0; transform: translateX(-10px); }

@media (max-width: 900px) {
  .sidebar, .sidebar--rail, .sidebar--docked { width: 288px; max-width: 86vw; overflow: hidden; transform: translateX(-101%); }
  .sidebar.sidebar-open { transform: none; box-shadow: var(--shadow-lg); }
  .sidebar-level--one { width: 100%; }
  /* Mobile drill-down: Level 2 slides over Level 1 inside the drawer. */
  .sidebar-level--two, .slide-leave-active { position: absolute; z-index: 4; inset: 0; width: 100%; }
}
</style>
