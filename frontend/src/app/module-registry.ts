import type { Component } from 'vue';
import { itemRoute, moduleReportsRoute, moduleRoute, navigationModules, type NavModuleConfig } from '@/config/navigation';
import type { NavigationItem } from '@/types/erp';

export interface ModuleSection {
  label: string;
  items: NavigationItem[];
}

export interface ModuleDefinition {
  key: string;
  label: string;
  /** Overview route of the module. */
  route: string;
  reportsRoute: string;
  icon: Component;
  /** CSS custom property with the module's accent color. */
  color: string;
  type: NavModuleConfig['type'];
  workspace: string;
  reportModules: string[];
  requires: string[];
  sections: ModuleSection[];
  /** All items, flattened (with `group` = section label). */
  items: NavigationItem[];
}

export const moduleRegistry: ModuleDefinition[] = navigationModules.map((module) => {
  const sections = module.sections.map((section) => ({
    label: section.label,
    items: section.items.map((item): NavigationItem & { report?: string } => ({
      label: item.label,
      path: itemRoute(module, item),
      icon: item.icon,
      group: section.label,
      doctype: item.single ? item.doctype : item.report ? undefined : item.doctype,
      description: item.description,
      report: item.report,
    })),
  }));
  return {
    key: module.id,
    label: module.label,
    route: moduleRoute(module),
    reportsRoute: moduleReportsRoute(module),
    icon: module.icon,
    color: module.color,
    type: module.type,
    workspace: module.workspace,
    reportModules: module.reportModules ?? [],
    requires: module.requires ?? [],
    sections,
    items: sections.flatMap((section) => section.items),
  };
});

export function getModuleByKey(key: string) {
  return moduleRegistry.find((module) => module.key === key);
}

/** The module owning a route: exact item match first (standard modules win), then DocType, then path prefix. */
export function getModuleForPath(path: string, doctype?: string) {
  const ordered = [...moduleRegistry].sort((a, b) => Number(a.type === 'custom') - Number(b.type === 'custom'));
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return ordered.find((module) => module.items.some((entry) => entry.path === path))
    ?? ordered.find((module) => normalized === module.route || path === module.reportsRoute)
    ?? (doctype ? ordered.find((module) => module.items.some((entry) => entry.doctype === doctype)) : undefined)
    ?? ordered.find((module) => path.startsWith(module.route));
}
