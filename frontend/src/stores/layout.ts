import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const STORAGE_KEY = 'erp-sidebar-collapsed';

function readCollapsed() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

/** Widths of the two sidebar levels (keep in sync with Sidebar.vue). */
export const SIDEBAR_WIDTHS = { levelOne: 232, rail: 68, levelTwo: 240 } as const;

/** Below this width an open sidebar shows Level 1 as icons beside Level 2, to leave room for the page. */
const WIDE_QUERY = '(min-width: 1280px)';

/**
 * Shell layout state: the sidebar's open/closed state, the mobile drawer, and the
 * two-level sidebar's own navigation (which module's Level 2 is open).
 *
 *   open    Level 1 with labels; a selected module's Level 2 docks beside it
 *           (on screens < 1280px Level 1 shows as icons while Level 2 is docked)
 *   closed  icon rail only; choosing a module opens its Level 2 as a floating panel
 */
export const useLayoutStore = defineStore('layout', () => {
  const sidebarCollapsed = ref(readCollapsed());
  const mobileSidebarOpen = ref(false);
  /** Module whose Level 2 panel is open; null shows Level 1 only. */
  const openModule = ref<string | null>(null);
  /** ⌘K command palette (opened from the topbar or the sidebar). */
  const paletteOpen = ref(false);

  const wideQuery = typeof window === 'undefined' ? null : window.matchMedia(WIDE_QUERY);
  const wide = ref(wideQuery?.matches ?? true);
  wideQuery?.addEventListener('change', (event) => { wide.value = event.matches; });

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    try { localStorage.setItem(STORAGE_KEY, sidebarCollapsed.value ? '1' : '0'); } catch { /* keep in memory only */ }
  }

  /** Level 1 shows icons only: always when closed, and beside a docked Level 2 on narrower screens. */
  const levelOneCompact = computed(() => sidebarCollapsed.value || (Boolean(openModule.value) && !wide.value));
  /** Level 2 sits beside Level 1 (pushing the page) rather than floating over it. */
  const levelTwoDocked = computed(() => !sidebarCollapsed.value && Boolean(openModule.value));

  /** Space the sidebar takes on desktop; a floating Level 2 does not push the page. */
  const sidebarOffset = computed(() => (levelOneCompact.value ? SIDEBAR_WIDTHS.rail : SIDEBAR_WIDTHS.levelOne) + (levelTwoDocked.value ? SIDEBAR_WIDTHS.levelTwo : 0));

  return { sidebarCollapsed, mobileSidebarOpen, openModule, paletteOpen, wide, levelOneCompact, levelTwoDocked, sidebarOffset, toggleSidebar };
});
