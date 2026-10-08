import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const STORAGE_KEY = 'erp-sidebar-collapsed';

function readCollapsed() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

/** Widths of the two sidebar levels (keep in sync with Sidebar.vue). */
export const SIDEBAR_WIDTHS = { levelOne: 248, rail: 68, levelTwo: 236 } as const;

/**
 * Shell layout state: desktop collapse, mobile drawer, and the two-level
 * sidebar's own navigation (which module's Level 2 is open).
 */
export const useLayoutStore = defineStore('layout', () => {
  const sidebarCollapsed = ref(readCollapsed());
  const mobileSidebarOpen = ref(false);
  /** Module whose Level 2 panel is open; null shows Level 1. */
  const openModule = ref<string | null>(null);
  /** ⌘K command palette (opened from the topbar or the sidebar). */
  const paletteOpen = ref(false);

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    try { localStorage.setItem(STORAGE_KEY, sidebarCollapsed.value ? '1' : '0'); } catch { /* keep in memory only */ }
  }

  /**
   * Space the docked sidebar takes on desktop. Collapsed mode keeps just the rail:
   * its Level 2 floats over the page instead of pushing it.
   */
  const sidebarOffset = computed(() => {
    if (sidebarCollapsed.value) return SIDEBAR_WIDTHS.rail;
    return openModule.value ? SIDEBAR_WIDTHS.rail + SIDEBAR_WIDTHS.levelTwo : SIDEBAR_WIDTHS.levelOne;
  });

  return { sidebarCollapsed, mobileSidebarOpen, openModule, paletteOpen, sidebarOffset, toggleSidebar };
});
