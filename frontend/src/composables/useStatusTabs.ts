import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { documentApi } from '@/services/document-api';
import type { ERPNextMetadataField, Filter } from '@/types/erp';

/*
 * Status tabs above a list (All / Enabled / Disabled, or a short `status` Select).
 * A tab is just an "=" filter on the status field in the list's own filters, so chips,
 * saved views and the query all keep working as before. Counts reuse documentApi.count
 * with the list's other filters and search, and are refreshed after a short pause.
 */

export interface StatusTab { key: string; label: string; filter: Filter | null; count: number | null }

/** A `status` Select with more options than this is left to the regular filters. */
const MAX_STATUS_OPTIONS = 6;
const STATUS_FIELDS = ['status', 'disabled', 'enabled'];

interface StatusTabSource {
  doctype: Ref<string>;
  fields: Ref<ERPNextMetadataField[]>;
  filters: Ref<Filter[]>;
  fixedFilters: Ref<Filter[]>;
  search: Ref<string>;
  searchFields: Ref<string[]>;
  enabled: Ref<boolean>;
}

export function useStatusTabs(source: StatusTabSource) {
  const definition = computed(() => {
    // A route that already pins the status (e.g. "Open issues") gets no tabs.
    if (source.fixedFilters.value.some((filter) => STATUS_FIELDS.includes(filter.fieldname))) return null;
    const fields = source.fields.value;
    const status = fields.find((field) => field.fieldname === 'status' && field.fieldtype === 'Select');
    const options = (status?.options || '').split('\n').map((option) => option.trim()).filter(Boolean);
    if (status && options.length >= 2 && options.length <= MAX_STATUS_OPTIONS) {
      return { fieldname: 'status', values: options.map((option) => ({ label: option, value: option as unknown })) };
    }
    if (fields.some((field) => field.fieldname === 'disabled')) return { fieldname: 'disabled', values: [{ label: 'Enabled', value: 0 as unknown }, { label: 'Disabled', value: 1 as unknown }] };
    if (fields.some((field) => field.fieldname === 'enabled')) return { fieldname: 'enabled', values: [{ label: 'Enabled', value: 1 as unknown }, { label: 'Disabled', value: 0 as unknown }] };
    return null;
  });

  const counts = ref<Record<string, number | null>>({});

  const tabs = computed<StatusTab[]>(() => {
    const current = definition.value;
    if (!current) return [];
    return [
      { key: 'all', label: 'All', filter: null, count: counts.value.all ?? null },
      ...current.values.map(({ label, value }) => ({
        key: `${current.fieldname}:${String(value)}`, label, filter: { fieldname: current.fieldname, operator: '=', value }, count: counts.value[`${current.fieldname}:${String(value)}`] ?? null,
      })),
    ];
  });

  /** Filters on anything but the status field (the tabs' counts are taken across these). */
  const otherFilters = computed(() => source.filters.value.filter((filter) => filter.fieldname !== definition.value?.fieldname));

  const activeKey = computed(() => {
    const fieldname = definition.value?.fieldname;
    if (!fieldname) return null;
    const own = source.filters.value.filter((filter) => filter.fieldname === fieldname);
    if (!own.length) return 'all';
    if (own.length > 1 || own[0].operator !== '=') return null;
    return tabs.value.find((tab) => tab.filter && String(tab.filter.value) === String(own[0].value))?.key ?? null;
  });

  function select(tab: StatusTab) {
    source.filters.value = [...otherFilters.value, ...(tab.filter ? [tab.filter] : [])];
  }

  // ---------- Counts (same wire format as listDocuments) ----------
  const wire = (filters: Filter[]) => filters
    .filter((filter) => filter.value !== '' && filter.value !== undefined && filter.value !== null)
    .map((filter) => [source.doctype.value, filter.fieldname, filter.operator, filter.operator === 'like' ? `%${filter.value}%` : filter.value]);

  let generation = 0;
  let timer: number | undefined;
  async function loadCounts() {
    const current = definition.value;
    if (!current || !source.enabled.value || !source.doctype.value) { counts.value = {}; return; }
    const run = (generation += 1);
    const base = wire([...source.fixedFilters.value, ...otherFilters.value]);
    const search = source.search.value.trim();
    const orFilters = search ? [...new Set(source.searchFields.value)].map((fieldname) => [source.doctype.value, fieldname, 'like', `%${search}%`]) : [];
    const count = (extra: unknown[][]) => documentApi.count(source.doctype.value, [...base, ...extra], orFilters).catch(() => null);
    const entries = await Promise.all([
      count([]).then((value) => ['all', value] as const),
      ...current.values.map(({ value }) => count([[source.doctype.value, current.fieldname, '=', value]]).then((result) => [`${current.fieldname}:${String(value)}`, result] as const)),
    ]);
    if (run === generation) counts.value = Object.fromEntries(entries);
  }

  watch(
    () => JSON.stringify([source.doctype.value, definition.value?.fieldname, source.enabled.value, source.fixedFilters.value, otherFilters.value, source.search.value.trim()]),
    () => { window.clearTimeout(timer); timer = window.setTimeout(() => void loadCounts(), 300); },
    { immediate: true },
  );
  onBeforeUnmount(() => window.clearTimeout(timer));

  return { tabs, activeKey, select, reloadCounts: loadCounts };
}
