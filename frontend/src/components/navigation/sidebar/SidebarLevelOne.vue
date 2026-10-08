<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { BookOpen, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-vue-next';
import SidebarModuleItem from './SidebarModuleItem.vue';
import { utilityNavigation } from '@/config/navigation';
import { useLayoutStore } from '@/stores/layout';
import { shortcutLabel } from '@/lib/utils';
import type { VisibleModule } from '@/composables/useNavigation';

/**
 * Level 1: modules grouped by workspace. Full width with labels, or an icon
 * rail (`compact`) while a Level-2 panel is open or the sidebar is collapsed.
 */
defineProps<{
  workspaces: { label: string; modules: VisibleModule[] }[];
  compact: boolean;
  activeKey?: string;
  openKey?: string | null;
  collapsed: boolean;
  showCollapseToggle: boolean;
}>();
const emit = defineEmits<{ select: [key: string]; navigate: []; toggleCollapse: [] }>();
const route = useRoute();
const layout = useLayoutStore();
const searchShortcut = shortcutLabel('K');

// Rail tooltips are fixed-positioned so the scrolling rail does not clip them.
const tip = ref<{ label: string; top: number } | null>(null);
function showTip(label: string, event: Event, compact: boolean) {
  if (!compact) return;
  const target = event.currentTarget as HTMLElement;
  // Focus shows the tip for keyboard users only; a mouse click must not leave it behind.
  if (event.type === 'focus' && !target.matches(':focus-visible')) return;
  const rect = target.getBoundingClientRect();
  tip.value = { label, top: rect.top + rect.height / 2 };
}
const hideTip = () => { tip.value = null; };
// A tip whose trigger re-renders never gets its mouseleave, so it would stay
// painted over the Level-2 panel; drop it whenever the page changes.
watch(() => route.fullPath, hideTip);
</script>

<template>
  <div :class="['level-one', { compact }]">
    <div class="brand-row">
      <RouterLink to="/" class="brand" aria-label="ERPNext home" @click="emit('navigate')">
        <span class="brand-mark" aria-hidden="true"><span /></span>
        <span v-if="!compact" class="brand-copy"><strong>ERPNext</strong><small>Modern workspace</small></span>
      </RouterLink>
      <button v-if="showCollapseToggle && !compact" type="button" class="icon-btn" aria-label="Collapse sidebar" title="Collapse sidebar" @click="emit('toggleCollapse')">
        <PanelLeftClose :size="16" />
      </button>
    </div>

    <div class="search-row">
      <button type="button" :class="['search', { compact }]" :aria-label="`Search (${searchShortcut})`" aria-keyshortcuts="Control+K Meta+K" @click="layout.paletteOpen = true" @mouseenter="showTip(`Search  ${searchShortcut}`, $event, compact)" @mouseleave="hideTip" @focus="showTip(`Search  ${searchShortcut}`, $event, compact)" @blur="hideTip" @pointerdown="hideTip">
        <Search :size="15" /><template v-if="!compact"><span>Search</span><kbd>{{ searchShortcut }}</kbd></template>
      </button>
    </div>

    <nav class="level-one-scroll" aria-label="Modules" @scroll="hideTip">
      <RouterLink
        to="/"
        :class="['overview', { active: route.path === '/', compact }]"
        :aria-label="compact ? 'Overview' : undefined"
        @click="emit('navigate')"
        @mouseenter="showTip('Overview', $event, compact)" @mouseleave="hideTip" @focus="showTip('Overview', $event, compact)" @blur="hideTip" @pointerdown="hideTip"
      >
        <LayoutDashboard :size="compact ? 18 : 17" :stroke-width="1.9" />
        <span v-if="!compact">Overview</span>
      </RouterLink>

      <template v-for="workspace in workspaces" :key="workspace.label">
        <p v-if="!compact" class="workspace-label">{{ workspace.label }}</p>
        <div v-else class="workspace-rule" />
        <SidebarModuleItem
          v-for="module in workspace.modules"
          :key="module.key"
          :label="module.label"
          :icon="module.icon"
          :color="module.color"
          :active="activeKey === module.key"
          :open="openKey === module.key"
          :compact="compact"
          :data-testid="`link-module-${module.key}`"
          @select="emit('select', module.key)"
          @mouseenter="showTip(`${workspace.label} · ${module.label}`, $event, compact)" @mouseleave="hideTip" @focus="showTip(`${workspace.label} · ${module.label}`, $event, compact)" @blur="hideTip" @pointerdown="hideTip"
        />
      </template>
    </nav>

    <footer :class="['level-one-foot', { compact }]">
      <a class="foot-link" href="https://docs.erpnext.com" target="_blank" rel="noopener noreferrer" aria-label="ERPNext documentation" @mouseenter="showTip('Help & documentation', $event, compact)" @mouseleave="hideTip" @focus="showTip('Help & documentation', $event, compact)" @blur="hideTip" @pointerdown="hideTip">
        <BookOpen :size="16" /><span v-if="!compact">Help &amp; docs</span>
      </a>
      <RouterLink v-for="entry in utilityNavigation" :key="entry.path" :to="entry.path" :class="['foot-link', { active: route.path === entry.path }]" :aria-label="entry.label" @click="emit('navigate')" @mouseenter="showTip(entry.label, $event, compact)" @mouseleave="hideTip" @focus="showTip(entry.label, $event, compact)" @blur="hideTip" @pointerdown="hideTip">
        <component :is="entry.icon" :size="16" /><span v-if="!compact">{{ entry.label }}</span>
      </RouterLink>
      <button v-if="showCollapseToggle && compact && collapsed" type="button" class="foot-link" aria-label="Expand sidebar" @click="emit('toggleCollapse')" @mouseenter="showTip('Expand sidebar', $event, compact)" @mouseleave="hideTip" @focus="showTip('Expand sidebar', $event, compact)" @blur="hideTip" @pointerdown="hideTip">
        <PanelLeftOpen :size="16" />
      </button>
    </footer>

    <div v-if="tip" class="rail-tip" :style="{ top: `${tip.top}px` }" role="tooltip">{{ tip.label }}</div>
  </div>
</template>

<style scoped>
.level-one { display: flex; width: 100%; height: 100%; flex-direction: column; background: var(--nav-bg-1); }

.brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: var(--topbar-height); flex: none; padding: 0 10px 0 16px; }
.compact .brand-row { justify-content: center; padding: 0; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand-mark { display: grid; width: 30px; height: 30px; flex: none; place-items: center; border-radius: 8px; background: #14b8a6; }
.brand-mark span { width: 10px; height: 10px; border: 2px solid #062a2b; border-radius: 3px; transform: rotate(45deg); }
.brand-copy { display: flex; min-width: 0; flex-direction: column; line-height: 1.2; }
.brand-copy strong { color: #fff; font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; }
.brand-copy small { color: var(--nav-subtle); font-size: 11px; }
.icon-btn { display: grid; width: 30px; height: 30px; flex: none; place-items: center; color: var(--nav-subtle); border: 0; border-radius: 7px; background: none; }
.icon-btn:hover { color: var(--nav-fg); background: var(--nav-hover); }

.search-row { padding: 0 10px 8px; }
.compact .search-row { display: flex; justify-content: center; padding: 0 0 8px; }
.search { display: flex; align-items: center; gap: 9px; width: 100%; height: 34px; padding: 0 8px 0 10px; color: var(--nav-subtle); border: 1px solid var(--nav-border); border-radius: 8px; background: var(--nav-input); font-size: 13px; text-align: left; transition: border-color .12s, color .12s; }
.search span { flex: 1; }
.search kbd { padding: 1px 6px; color: var(--nav-subtle); border: 1px solid var(--nav-border); border-radius: 5px; background: var(--nav-bg-1); font: 500 10.5px var(--font-sans); }
.search:hover { color: var(--nav-fg); border-color: var(--nav-subtle); }
.search.compact { width: 42px; height: 42px; justify-content: center; padding: 0; border-radius: 10px; }

.level-one-scroll { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 1px; overflow-x: hidden; overflow-y: auto; padding: 4px 10px 12px; scrollbar-width: none; }
.compact .level-one-scroll { align-items: center; gap: 4px; padding: 4px 0 12px; }
.workspace-label { user-select: none; margin: 18px 0 6px; padding: 0 10px; color: var(--nav-subtle); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.workspace-rule { width: 28px; height: 1px; flex: none; margin: 10px 0 6px; background: var(--nav-border); }

.overview { position: relative; display: flex; user-select: none; -webkit-user-select: none; -webkit-user-drag: none; align-items: center; gap: 11px; height: 36px; padding: 0 10px; color: var(--nav-muted); border-radius: 8px; font-size: 13.5px; font-weight: 500; transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.overview svg { flex: none; color: var(--nav-accent); }
.overview:hover { color: var(--nav-fg); background: var(--nav-hover); }
.overview:focus-visible, .foot-link:focus-visible, .search:focus-visible, .icon-btn:focus-visible, .brand:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }
.overview.active { color: #fff; background: var(--nav-active-bg); font-weight: 600; }
.overview.active::before { position: absolute; top: 8px; bottom: 8px; left: 0; width: 3px; content: ''; border-radius: 0 3px 3px 0; background: var(--nav-accent); }
.overview.compact { justify-content: center; width: 42px; height: 42px; padding: 0; border-radius: 10px; }
.overview.compact.active::before { left: -13px; top: 11px; bottom: 11px; }

.level-one-foot { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px 12px; border-top: 1px solid var(--nav-border); }
.level-one-foot.compact { align-items: center; gap: 4px; padding: 8px 0 12px; }
.foot-link { user-select: none; -webkit-user-select: none; -webkit-user-drag: none; display: flex; align-items: center; gap: 11px; height: 34px; padding: 0 10px; color: var(--nav-muted); border: 0; border-radius: 8px; background: none; font-size: 13px; font-weight: 500; }
.foot-link svg { flex: none; color: var(--nav-subtle); }
.foot-link:hover { color: var(--nav-fg); background: var(--nav-hover); }
.foot-link:hover svg { color: var(--nav-fg); }
.foot-link.active { color: #fff; background: var(--nav-active-bg); }
.compact .foot-link { justify-content: center; width: 42px; height: 38px; padding: 0; }

.rail-tip { position: fixed; z-index: 75; left: calc(var(--sidebar-rail-width) + 8px); padding: 5px 9px; color: #fff; border-radius: 6px; background: #062224; box-shadow: 0 6px 16px rgba(0, 0, 0, .25); font-size: 12px; font-weight: 500; pointer-events: none; transform: translateY(-50%); white-space: nowrap; }
</style>
