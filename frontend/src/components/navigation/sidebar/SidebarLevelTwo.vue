<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, FileSpreadsheet, LayoutGrid, PanelLeftClose, Search, X } from 'lucide-vue-next';
import SidebarSection from './SidebarSection.vue';
import type { VisibleModule } from '@/composables/useNavigation';
import type { NavigationItem } from '@/types/erp';

/**
 * Level 2: one module's own navigation — Overview, its configured sections
 * (Masters, Transactions, Reports…) and a link to all of its reports. Identical for
 * ERPNext and custom (NGO) modules; everything comes from config/navigation.ts.
 * `showToggle`: this panel owns the sidebar's top-right open/close button.
 */
const props = defineProps<{ module: VisibleModule; floating?: boolean; showToggle?: boolean }>();
const emit = defineEmits<{ back: []; navigate: []; toggleCollapse: [] }>();
const route = useRoute();
const query = ref('');
watch(() => props.module.key, () => { query.value = ''; });

const overview = computed<NavigationItem>(() => ({ label: 'Overview', path: props.module.route, icon: LayoutGrid }));
const sections = computed(() => {
  const result = props.module.visibleSections.map((section) => ({ ...section, items: [...section.items] }));
  if (props.module.reportModules.length) {
    const all: NavigationItem = { label: 'All reports', path: props.module.reportsRoute, icon: FileSpreadsheet };
    const reports = result.find((section) => section.label === 'Reports');
    if (reports) reports.items.push(all); else result.push({ label: 'Reports', items: [all] });
  }
  return result;
});

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return sections.value;
  return sections.value
    .map((section) => ({ ...section, items: section.items.filter((item) => item.label.toLowerCase().includes(needle) || item.doctype?.toLowerCase().includes(needle)) }))
    .filter((section) => section.items.length);
});

// One active item: exact route first; on record/new pages, the item listing that DocType.
const activePath = computed(() => {
  const items = [overview.value, ...sections.value.flatMap((section) => section.items)];
  const exact = items.find((item) => item.path === route.path || `${item.path}/` === route.path);
  if (exact) return exact.path;
  const doctype = route.params.doctype ? String(route.params.doctype) : '';
  return doctype ? items.find((item) => item.doctype === doctype)?.path : undefined;
});
const isActive = (item: NavigationItem) => item.path === activePath.value;
</script>

<template>
  <div :class="['level-two', { floating }]" :style="{ '--c': `var(${module.color})` }" role="navigation" :aria-label="`${module.label} navigation`">
    <header class="level-two-head">
      <button type="button" class="back" :aria-label="`Close ${module.label} menu`" :title="`Back to all modules`" data-testid="button-sidebar-back" @click="emit('back')">
        <ArrowLeft :size="17" />
        <span class="back-title">{{ module.label }}</span>
      </button>
      <button v-if="showToggle" type="button" class="head-button" aria-label="Close sidebar" aria-controls="app-sidebar" aria-expanded="true" title="Close sidebar" @click="emit('toggleCollapse')"><PanelLeftClose :size="17" /></button>
      <button v-else-if="floating" type="button" class="head-button" aria-label="Close menu" title="Close menu" @click="emit('back')"><X :size="17" /></button>
    </header>

    <label class="module-search">
      <Search :size="14" />
      <input v-model="query" :placeholder="`Search ${module.label.toLowerCase()}…`" :aria-label="`Search ${module.label} pages`" @keydown.esc="query = ''" />
      <button v-if="query" type="button" aria-label="Clear search" @click="query = ''"><X :size="12" /></button>
    </label>

    <div class="level-two-scroll">
      <SidebarSection v-if="!query" :label="module.label" :items="[overview]" :is-active="isActive" @navigate="emit('navigate')" />
      <!-- A section named like the module continues the module's own heading. -->
      <SidebarSection v-for="section in filtered" :key="section.label" :label="section.label === module.label ? undefined : section.label" :items="section.items" :is-active="isActive" @navigate="emit('navigate')" />
      <p v-if="query && !filtered.length" class="no-match">No pages match “{{ query }}”.</p>
    </div>
  </div>
</template>

<style scoped>
.level-two { display: flex; width: 100%; height: 100%; flex-direction: column; border-left: 1px solid var(--nav-border); background: var(--nav-bg-2); }
.level-two.floating { border-right: 1px solid var(--nav-border); box-shadow: var(--nav-float-shadow); }

.level-two-head { display: flex; align-items: center; gap: 6px; height: var(--topbar-height); flex: none; padding: 0 10px 0 12px; border-bottom: 1px solid var(--nav-border); }
.back { display: inline-flex; min-width: 0; flex: 1; align-items: center; gap: 10px; height: 36px; padding: 0 8px; color: var(--nav-subtle); border: 0; border-radius: 8px; background: none; text-align: left; }
.back svg { flex: none; transition: transform var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.back-title { min-width: 0; overflow: hidden; color: var(--nav-active-fg); font-family: var(--font-display); font-size: 18px; font-weight: 700; letter-spacing: -.01em; text-overflow: ellipsis; white-space: nowrap; }
.back:hover { background: var(--nav-hover); }
.back:hover svg { color: var(--nav-fg); transform: translateX(-2px); }
.head-button { display: grid; width: 32px; height: 32px; flex: none; place-items: center; color: var(--nav-subtle); border: 1px solid transparent; border-radius: 8px; background: none; transition: color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease); }
.head-button:hover { color: var(--nav-fg); border-color: var(--nav-border); background: var(--nav-hover); }
.back:focus-visible, .head-button:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }

.module-search { display: flex; align-items: center; gap: 8px; height: 38px; margin: 14px 12px 6px; padding: 0 8px 0 12px; color: var(--nav-subtle); border: 1px solid var(--nav-border); border-radius: 9px; background: var(--nav-input); transition: border-color var(--dur-fast) var(--ease); }
.module-search:hover { border-color: color-mix(in srgb, var(--nav-subtle) 45%, transparent); }
.module-search:focus-within { border-color: var(--nav-accent); color: var(--nav-accent); }
.module-search input { min-width: 0; flex: 1; height: 100%; color: var(--nav-fg); border: 0; outline: 0; background: none; font-size: 13px; }
.module-search input::placeholder { color: var(--nav-subtle); }
.module-search button { display: grid; width: 20px; height: 20px; place-items: center; color: var(--nav-subtle); border: 0; border-radius: 5px; background: none; }
.module-search button:hover { color: var(--nav-fg); background: var(--nav-hover); }

.level-two-scroll { min-height: 0; flex: 1; overflow-y: auto; padding: 12px 12px 16px; scrollbar-width: thin; scrollbar-color: var(--nav-border) transparent; }
.no-match { padding: 8px 10px; color: var(--nav-subtle); font-size: 12.5px; }
</style>
