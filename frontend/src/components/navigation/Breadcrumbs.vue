<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ChevronRight } from 'lucide-vue-next';
import { documentConfigs, getDocumentRouteForDocType } from '@/config/navigation';
import { getModuleForPath, moduleRegistry } from '@/app/module-registry';

/** Page breadcrumbs: Dashboard › Module › List › Record. Shown above the page title. */
interface Crumb { label: string; to?: string; color?: string }
const route = useRoute();

const crumbs = computed<Crumb[]>(() => {
  const home: Crumb = { label: 'Dashboard', to: '/' };
  const doctype = route.params.doctype ? String(route.params.doctype) : documentConfigs[route.path]?.doctype;
  if (route.path === '/') return [];
  if (route.path === '/settings') return [home, { label: 'Preferences' }];
  if (route.path === '/profile') return [home, { label: 'Profile' }];
  const module = route.meta.moduleKey ? moduleRegistry.find((candidate) => candidate.key === route.meta.moduleKey) : getModuleForPath(route.path, doctype);
  const list: Crumb[] = [home, ...(module ? [{ label: module.label, to: route.meta.moduleKey ? undefined : module.route, color: module.color }] : [])];
  if (route.meta.moduleKey) return list;
  if (documentConfigs[route.path]) return [...list, { label: documentConfigs[route.path].title }];
  if (route.name === 'document-list') return [...list, { label: doctype || '' }];
  if (doctype) {
    const listRoute = getDocumentRouteForDocType(doctype);
    const listLabel = documentConfigs[listRoute]?.title || doctype;
    const single = route.params.name === doctype;
    return [...list, ...(single ? [] : [{ label: listLabel, to: listRoute }]), { label: route.params.name ? String(route.params.name) : `New ${doctype}` }];
  }
  return list;
});
</script>

<template>
  <nav v-if="crumbs.length > 1" class="breadcrumbs" aria-label="Breadcrumb">
    <template v-for="(crumb, index) in crumbs" :key="`${index}-${crumb.label}`">
      <ChevronRight v-if="index > 0" :size="13" class="crumb-sep" aria-hidden="true" />
      <RouterLink v-if="crumb.to && index < crumbs.length - 1" :to="crumb.to" class="crumb" :title="crumb.label">
        <span v-if="crumb.color" class="crumb-dot" :style="{ '--c': `var(${crumb.color})` }" /><span class="crumb-label">{{ crumb.label }}</span>
      </RouterLink>
      <span v-else class="crumb crumb--current" :title="crumb.label" aria-current="page">
        <span v-if="crumb.color" class="crumb-dot" :style="{ '--c': `var(${crumb.color})` }" /><span class="crumb-label">{{ crumb.label }}</span>
      </span>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumbs { display: flex; min-width: 0; align-items: center; gap: 6px; margin-bottom: 14px; overflow: hidden; font-size: 13px; }
.crumb { display: inline-flex; min-width: 2.5em; flex: 0 1 auto; align-items: center; gap: 6px; color: var(--muted-foreground); white-space: nowrap; }
.crumb-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
a.crumb { border-radius: var(--radius-sm); text-underline-offset: 3px; transition: color var(--dur-fast) var(--ease); }
a.crumb:hover { color: var(--foreground); }
a.crumb:hover .crumb-label { text-decoration: underline; }
a.crumb:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.crumb--current { min-width: 0; flex-shrink: 0; max-width: 70%; color: var(--foreground); font-weight: 500; }
.crumb-dot { width: 7px; height: 7px; flex: none; border-radius: 2px; background: var(--c); }
.crumb-sep { flex: none; color: var(--faint-foreground); }
</style>
