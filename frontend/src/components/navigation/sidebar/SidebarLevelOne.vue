<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { BookOpen, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';
import SidebarModuleItem from './SidebarModuleItem.vue';
import WorkspaceSwitcher from './WorkspaceSwitcher.vue';
import { utilityNavigation } from '@/config/navigation';
import type { VisibleModule } from '@/composables/useNavigation';
import { useCompanyBrand } from '@/composables/useCompanyBrand';
import { appHome, selectedApp } from '@/app/app-context';

/**
 * Level 1: modules grouped by workspace. Full width with labels, or an icon
 * rail (`compact`) when the sidebar is closed or Level 2 is docked on a narrow screen.
 * `showToggle`: this level owns the sidebar's top-right open/close button.
 */
defineProps<{
  workspaces: { label: string; modules: VisibleModule[] }[];
  compact: boolean;
  activeKey?: string;
  openKey?: string | null;
  collapsed: boolean;
  showToggle: boolean;
}>();
const emit = defineEmits<{ select: [key: string]; navigate: []; toggleCollapse: [] }>();
const route = useRoute();
// Company name and logo (Company › Company Logo); a generic mark until a logo is set or if it fails to load.
const { name: companyName, logo: companyLogo } = useCompanyBrand();
const logoFailed = ref(false);
watch(companyLogo, () => { logoFailed.value = false; });

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
      <RouterLink :to="appHome" class="brand" :aria-label="`${companyName} home`" :title="companyName" @click="emit('navigate')">
        <span v-if="companyLogo && !logoFailed" class="brand-logo" aria-hidden="true"><img :src="companyLogo" alt="" @error="logoFailed = true" /></span>
        <span v-else class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
            <path d="M16 4 27 10.5v11L16 28 5 21.5v-11L16 4Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
            <path d="M16 11.5 21 14.5v5.5L16 23l-5-3v-5.5l5-3Z" fill="currentColor" />
          </svg>
        </span>
        <span v-if="!compact" class="brand-copy"><strong>{{ companyName }}</strong><small>{{ selectedApp ? `${selectedApp.label} workspace` : 'Workspace' }}</small></span>
      </RouterLink>
      <button v-if="showToggle && !compact" type="button" class="toggle" aria-label="Close sidebar" aria-controls="app-sidebar" aria-expanded="true" title="Close sidebar" @click="emit('toggleCollapse')">
        <PanelLeftClose :size="17" />
      </button>
    </div>

    <div v-if="showToggle && compact && collapsed" class="expand-row">
      <button type="button" class="toggle toggle--rail" aria-label="Open sidebar" aria-controls="app-sidebar" aria-expanded="false" @click="emit('toggleCollapse')" @mouseenter="showTip('Open sidebar', $event, compact)" @mouseleave="hideTip" @focus="showTip('Open sidebar', $event, compact)" @blur="hideTip" @pointerdown="hideTip">
        <PanelLeftOpen :size="17" />
      </button>
    </div>

    <WorkspaceSwitcher :compact="compact" @navigate="emit('navigate')" @tip="(label, event) => showTip(label, event, compact)" @hide-tip="hideTip" />

    <nav class="level-one-scroll" aria-label="Modules" @scroll="hideTip">
      <!-- The ERPNext dashboard; the NGO app opens on its own Projects overview instead. -->
      <RouterLink
        v-if="!selectedApp || selectedApp.key === 'erpnext'"
        to="/"
        :class="['overview', { active: route.path === '/', compact }]"
        :aria-current="route.path === '/' ? 'page' : undefined"
        :aria-label="compact ? 'Dashboard' : undefined"
        @click="emit('navigate')"
        @mouseenter="showTip('Dashboard', $event, compact)" @mouseleave="hideTip" @focus="showTip('Dashboard', $event, compact)" @blur="hideTip" @pointerdown="hideTip"
      >
        <LayoutDashboard :size="18" :stroke-width="1.9" />
        <span v-if="!compact">Dashboard</span>
      </RouterLink>

      <template v-for="(workspace, index) in workspaces" :key="workspace.label">
        <!-- ERPNext's own modules need no heading; custom workspaces get one ("NGO Operations"). -->
        <template v-if="index > 0 || workspace.label !== 'ERPNext'">
          <p v-if="!compact" class="workspace-label">{{ workspace.label === 'ERPNext' ? 'Modules' : `${workspace.label} Operations` }}</p>
          <div v-else class="workspace-rule" />
        </template>
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
      <RouterLink v-for="entry in utilityNavigation" :key="entry.path" :to="entry.path" :class="['foot-link', { active: route.path === entry.path }]" :aria-current="route.path === entry.path ? 'page' : undefined" :aria-label="entry.label" @click="emit('navigate')" @mouseenter="showTip(entry.label, $event, compact)" @mouseleave="hideTip" @focus="showTip(entry.label, $event, compact)" @blur="hideTip" @pointerdown="hideTip">
        <component :is="entry.icon" :size="16" /><span v-if="!compact">{{ entry.label }}</span>
      </RouterLink>
    </footer>

    <div v-if="tip" class="rail-tip" :style="{ top: `${tip.top}px` }" role="tooltip">{{ tip.label }}</div>
  </div>
</template>

<style scoped>
.level-one { display: flex; width: 100%; height: 100%; flex-direction: column; background: var(--nav-bg-1); }

.brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: var(--topbar-height); flex: none; padding: 0 12px 0 18px; border-bottom: 1px solid var(--nav-border); }
.compact .brand-row { justify-content: center; padding: 0; }
.brand { display: flex; align-items: center; gap: 11px; min-width: 0; border-radius: 8px; }
.brand-mark { display: grid; width: 34px; height: 34px; flex: none; place-items: center; color: var(--nav-brand-ink); border-radius: 10px; background: var(--nav-brand); }
/* Uploaded logos keep their own colours on a light tile so dark marks stay visible. */
.brand-logo { display: grid; width: 34px; height: 34px; flex: none; place-items: center; overflow: hidden; border-radius: 10px; background: #fff; }
.brand-logo img { width: 100%; height: 100%; object-fit: contain; padding: 3px; }
.brand-copy { display: flex; min-width: 0; flex-direction: column; line-height: 1.2; }
.brand-copy strong { overflow: hidden; color: var(--nav-active-fg); text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
.brand-copy small { color: var(--nav-subtle); font-size: 11px; }

/* The sidebar's open/close button (top-right corner). */
.toggle { display: grid; width: 32px; height: 32px; flex: none; place-items: center; color: var(--nav-subtle); border: 1px solid transparent; border-radius: 8px; background: none; transition: color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease); }
.toggle:hover { color: var(--nav-fg); border-color: var(--nav-border); background: var(--nav-hover); }
.toggle--rail { width: 42px; height: 36px; border-color: var(--nav-border); }
.expand-row { display: flex; justify-content: center; padding: 10px 0 2px; }

.level-one-scroll { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 2px; overflow-x: hidden; overflow-y: auto; padding: 12px 10px; scrollbar-width: none; }
.compact .level-one-scroll { align-items: center; gap: 4px; padding: 10px 0 12px; }
.workspace-label { user-select: none; margin: 18px 0 6px; padding: 0 12px; color: var(--nav-subtle); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.workspace-rule { width: 28px; height: 1px; flex: none; margin: 10px 0 6px; background: var(--nav-border); }

.overview { position: relative; display: flex; user-select: none; -webkit-user-select: none; -webkit-user-drag: none; align-items: center; gap: 12px; height: 40px; padding: 0 12px; color: var(--nav-muted); border-radius: 9px; font-size: 14px; font-weight: 500; transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.overview svg { flex: none; color: var(--nav-fg); }
.overview:hover { color: var(--nav-fg); background: var(--nav-hover); }
.overview:focus-visible, .foot-link:focus-visible, .toggle:focus-visible, .brand:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }
.overview.active { color: var(--nav-active-fg); background: var(--nav-active-bg); font-weight: 600; }
.overview.active::before { position: absolute; top: 9px; bottom: 9px; left: 0; width: 3px; content: ''; border-radius: 0 3px 3px 0; background: var(--nav-accent); }
.overview.compact { justify-content: center; width: 42px; height: 42px; padding: 0; border-radius: 10px; }
.overview.compact.active::before { left: -13px; top: 11px; bottom: 11px; }

.level-one-foot { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px 12px; border-top: 1px solid var(--nav-border); }
.level-one-foot.compact { align-items: center; gap: 4px; padding: 8px 0 12px; }
.foot-link { user-select: none; -webkit-user-select: none; -webkit-user-drag: none; display: flex; align-items: center; gap: 12px; height: 34px; padding: 0 12px; color: var(--nav-muted); border: 0; border-radius: 8px; background: none; font-size: 13px; font-weight: 500; }
.foot-link svg { flex: none; color: var(--nav-subtle); }
.foot-link:hover { color: var(--nav-fg); background: var(--nav-hover); }
.foot-link:hover svg { color: var(--nav-fg); }
.foot-link.active { color: var(--nav-active-fg); background: var(--nav-active-bg); }
.compact .foot-link { justify-content: center; width: 42px; height: 38px; padding: 0; }

.rail-tip { position: fixed; z-index: 75; left: calc(var(--rail-width, 68px) + 8px); padding: 5px 9px; color: var(--nav-active-fg); border-radius: 6px; background: var(--nav-tooltip-bg); box-shadow: var(--shadow-lg); font-size: 12px; font-weight: 500; pointer-events: none; transform: translateY(-50%); white-space: nowrap; }
</style>
