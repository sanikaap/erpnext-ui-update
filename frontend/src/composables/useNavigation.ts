import { computed, ref } from 'vue';
import { documentApi } from '@/services/document-api';
import { isStaticDocType, staticDocTypeNames } from '@/services/static-data';
import { moduleRegistry, type ModuleDefinition } from '@/app/module-registry';
import { selectedApp } from '@/app/app-context';
import type { NavigationItem } from '@/types/erp';

/*
 * Which configured DocTypes and Reports exist on this site. Checked once per page
 * load; items for apps that are not installed (HRMS, an NGO app…) are hidden.
 * If the check itself is not permitted, everything stays visible.
 */
const installedDoctypes = ref<Set<string> | null>(null);
const installedReports = ref<Set<string> | null>(null);
const loaded = ref(false);
let pending: Promise<void> | null = null;

async function loadAvailability() {
  const doctypes = new Set<string>();
  const reports = new Set<string>();
  for (const module of moduleRegistry) {
    module.requires.forEach((name) => doctypes.add(name));
    for (const item of module.items) {
      if (item.doctype) doctypes.add(item.doctype);
      if (item.report) reports.add(item.report);
    }
  }
  const serverDoctypes = [...doctypes].filter((name) => !isStaticDocType(name));
  const [foundDoctypes, foundReports] = await Promise.all([
    documentApi.list<{ name: string }>('DocType', { fields: ['name'], filters: [['name', 'in', serverDoctypes]], limit: serverDoctypes.length + 10 })
      // Static demo DocTypes (NGO) are always available.
      .then((rows) => new Set([...rows.map((row) => row.name), ...staticDocTypeNames()])).catch(() => null),
    documentApi.list<{ name: string }>('Report', { fields: ['name'], filters: [['name', 'in', [...reports]], ['disabled', '=', 0]], limit: reports.size + 10 })
      .then((rows) => new Set(rows.map((row) => row.name))).catch(() => null),
  ]);
  installedDoctypes.value = foundDoctypes;
  installedReports.value = foundReports;
  loaded.value = true;
}

export interface VisibleModule extends ModuleDefinition {
  visibleSections: { label: string; items: NavigationItem[] }[];
}

/**
 * Number of pages a module offers: its visible configured items (Overview and the
 * synthetic "All reports" link are not counted). The sidebar and the module page
 * both use this, so they always agree.
 */
export function modulePageCount(module: VisibleModule) {
  return module.visibleSections.reduce((sum, section) => sum + section.items.length, 0);
}

export function useNavigation() {
  if (!pending) pending = loadAvailability();
  const ready = computed(() => loaded.value);

  function isAvailable(item: NavigationItem) {
    if (item.report) return installedReports.value?.has(item.report) ?? true;
    if (item.doctype) return installedDoctypes.value?.has(item.doctype) ?? true;
    return true;
  }

  const modules = computed<VisibleModule[]>(() => moduleRegistry
    // Only the modules of the app chosen after sign-in (ERPNext or NGO).
    .filter((module) => !selectedApp.value || module.workspace === selectedApp.value.workspace)
    // Until the check finishes, modules that depend on an optional app stay hidden (no flash).
    .filter((module) => (loaded.value ? module.requires.every((name) => installedDoctypes.value?.has(name) ?? true) : !module.requires.length))
    .map((module) => ({
      ...module,
      visibleSections: module.sections
        .map((section) => ({ label: section.label, items: section.items.filter(isAvailable) }))
        .filter((section) => section.items.length),
    }))
    .filter((module) => module.visibleSections.length));

  /** Level-1 groups: workspace heading → modules, in config order. */
  const workspaces = computed(() => {
    const groups: { label: string; modules: VisibleModule[] }[] = [];
    for (const module of modules.value) {
      const group = groups.find((entry) => entry.label === module.workspace);
      if (group) group.modules.push(module); else groups.push({ label: module.workspace, modules: [module] });
    }
    // Standard ERPNext modules first, custom workspaces (NGO…) below them.
    return groups.sort((a, b) => Number(a.label !== 'ERPNext') - Number(b.label !== 'ERPNext'));
  });

  return { ready, modules, workspaces, isAvailable };
}
