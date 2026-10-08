<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, FileSpreadsheet, LayoutGrid, Search, X } from 'lucide-vue-next';
import SidebarSection from './SidebarSection.vue';
import type { VisibleModule } from '@/composables/useNavigation';
import type { NavigationItem } from '@/types/erp';

/**
 * Level 2: one module's own navigation — Overview, its configured sections, and a
 * link to all of its reports. Identical for ERPNext and custom (NGO) modules.
 */
const props = defineProps<{ module: VisibleModule; floating?: boolean }>();
const emit = defineEmits<{ back: []; navigate: [] }>();
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
const itemCount = computed(() => sections.value.reduce((sum, section) => sum + section.items.length, 0));

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
      <button type="button" class="back" :aria-label="`Back to all modules from ${module.label}`" data-testid="button-sidebar-back" @click="emit('back')">
        <ArrowLeft :size="14" /><span>All modules</span>
      </button>
      <button v-if="floating" type="button" class="close" aria-label="Close menu" @click="emit('back')"><X :size="15" /></button>
    </header>

    <div class="module-title">
      <span class="module-badge"><component :is="module.icon" :size="17" :stroke-width="2" /></span>
      <div class="module-copy">
        <h2>{{ module.label }}</h2>
        <p>{{ module.type === 'custom' ? module.workspace : 'ERPNext' }} · {{ itemCount }} pages</p>
      </div>
    </div>

    <label v-if="itemCount > 8" class="filter">
      <Search :size="13" />
      <input v-model="query" :placeholder="`Filter ${module.label}…`" :aria-label="`Filter ${module.label} pages`" @keydown.esc="query = ''" />
      <button v-if="query" type="button" aria-label="Clear filter" @click="query = ''"><X :size="12" /></button>
    </label>

    <div class="level-two-scroll">
      <SidebarSection v-if="!query" :items="[overview]" :is-active="isActive" @navigate="emit('navigate')" />
      <!-- A section named like the module continues the module's own heading. -->
      <SidebarSection v-for="section in filtered" :key="section.label" :label="section.label === module.label ? undefined : section.label" :items="section.items" :is-active="isActive" @navigate="emit('navigate')" />
      <p v-if="query && !filtered.length" class="no-match">No pages match “{{ query }}”.</p>
    </div>
  </div>
</template>

<style scoped>
.level-two { display: flex; width: 100%; height: 100%; flex-direction: column; border-left: 1px solid var(--nav-border); background: var(--nav-bg-2); }
.level-two.floating { border-right: 1px solid var(--nav-border); box-shadow: 12px 0 32px -12px rgba(0, 0, 0, .45); }
.level-two-head { display: flex; align-items: center; gap: 6px; height: var(--topbar-height); flex: none; padding: 0 12px; }
.back { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 10px 0 8px; color: var(--nav-muted); border: 0; border-radius: 7px; background: none; font-size: 12.5px; font-weight: 600; }
.back svg { transition: transform .15s var(--ease); }
.back:hover { color: var(--nav-fg); background: var(--nav-hover); }
.back:hover svg { transform: translateX(-2px); }
.back:focus-visible, .close:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: 1px; }
.close { display: grid; width: 30px; height: 30px; margin-left: auto; flex: none; place-items: center; color: var(--nav-muted); border: 0; border-radius: 7px; background: none; }
.close:hover { color: var(--nav-fg); background: var(--nav-hover); }

.module-title { display: flex; align-items: center; gap: 11px; padding: 2px 16px 14px; }
.module-badge { display: grid; width: 36px; height: 36px; flex: none; place-items: center; color: #062a2b; border-radius: 10px; background: var(--c); }
.module-copy { min-width: 0; }
.module-copy h2 { overflow: hidden; color: #fff; font-size: 16px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.module-copy p { margin-top: 2px; color: var(--nav-subtle); font-size: 11.5px; }

.filter { display: flex; align-items: center; gap: 8px; height: 32px; margin: 0 12px 10px; padding: 0 8px 0 10px; color: var(--nav-subtle); border: 1px solid var(--nav-border); border-radius: 8px; background: var(--nav-input); }
.filter:focus-within { border-color: var(--nav-accent); color: var(--nav-accent); }
.filter input { min-width: 0; flex: 1; height: 100%; color: var(--nav-fg); border: 0; outline: 0; background: none; font-size: 12.5px; }
.filter input::placeholder { color: var(--nav-subtle); }
.filter button { display: grid; width: 20px; height: 20px; place-items: center; color: var(--nav-subtle); border: 0; border-radius: 5px; background: none; }
.filter button:hover { color: var(--nav-fg); background: var(--nav-hover); }

.level-two-scroll { min-height: 0; flex: 1; overflow-y: auto; padding: 2px 12px 16px; border-top: 1px solid var(--nav-border); padding-top: 12px; scrollbar-width: thin; scrollbar-color: var(--nav-border) transparent; }
.no-match { padding: 8px 10px; color: var(--nav-subtle); font-size: 12.5px; }
</style>
