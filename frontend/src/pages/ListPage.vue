<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Download, Link2, Plus, RefreshCw, Rows3, Rows4, Search, Trash2, X } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
import { documentConfigs, routeFilters } from '@/config/navigation';
import { getModuleForPath } from '@/app/module-registry';
import { useDocType } from '@/composables/useDocType';
import { useDocuments, type DocumentQuery } from '@/composables/useDocuments';
import { useStatusTabs } from '@/composables/useStatusTabs';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import { documentApi } from '@/services/document-api';
import { hasDocTypePermission, metaRegistry } from '@/services/metadata-api';
import { isStaticDocType } from '@/services/static-data';
import { erpnextApi, frappeErrorMessage } from '@/services/erpnext-api';
import { listViewFields, formatValue } from '@/lib/doctype';
import DataTable from '@/components/data-display/DataTable.vue';
import EmptyState from '@/components/feedback/EmptyState.vue';
import ErrorState from '@/components/feedback/ErrorState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import FilterControl from '@/components/list/FilterControl.vue';
import QuickFilters from '@/components/list/QuickFilters.vue';
import SortBy from '@/components/list/SortBy.vue';
import ColumnSettings from '@/components/list/ColumnSettings.vue';
import type { DocumentListColumn, Filter, Sort } from '@/types/erp';

/**
 * One list page for every DocType. Columns, quick filters, search fields and default
 * sort come from metadata; the configured routes only add a friendly title.
 */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();

const config = computed(() => documentConfigs[route.path]);
const doctype = computed(() => config.value?.doctype || String(route.params.doctype || ''));
const title = computed(() => config.value?.title || doctype.value);
const module = computed(() => getModuleForPath(route.path, doctype.value));

const { meta, metadata, loading: metaLoading, error: metaError, errorKind, load: loadMeta } = useDocType(doctype);

/**
 * Filters from the URL (?customer=X or ?name=["in",[…]]), as used by Connections and form
 * scripts. A field may live on a child table, e.g. Purchase Order Item's material_request.
 */
const STANDARD_FILTER_FIELDS = new Set(['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus']);
const linkFilters = computed<Filter[]>(() => {
  if (!metadata.value.length) return [];
  const result: Filter[] = [];
  for (const [fieldname, raw] of Object.entries(route.query)) {
    if (typeof raw !== 'string' || !raw || fieldname.startsWith('_')) continue;
    let owner: string | undefined;
    if (!STANDARD_FILTER_FIELDS.has(fieldname) && !metadata.value.some((field) => field.fieldname === fieldname)) {
      const table = metadata.value.find((field) => field.is_table && field.options && metaRegistry.get(field.options)?.fields?.some((child) => child.fieldname === fieldname));
      if (!table) continue;
      owner = table.options;
    }
    let operator = '=';
    let value: unknown = raw;
    if (raw.startsWith('[')) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length === 2) { operator = String(parsed[0]); value = parsed[1]; } } catch { /* a literal value */ }
    }
    result.push({ ...(owner ? { doctype: owner } : {}), fieldname, operator, value });
  }
  return result;
});
const fixedFilters = computed<Filter[]>(() => [...(routeFilters[route.path] ?? []), ...linkFilters.value]);
const linkFilterLabel = computed(() => linkFilters.value.map((filter) => {
  const owner = filter.doctype ? metaRegistry.get(filter.doctype)?.fields?.find((field) => field.fieldname === filter.fieldname) : metadata.value.find((field) => field.fieldname === filter.fieldname);
  const label = owner?.label || (filter.fieldname === 'name' ? 'ID' : filter.fieldname);
  return `${label}: ${Array.isArray(filter.value) ? filter.value.join(', ') : filter.value}`;
}).join(' · '));
function clearLinkFilters() { void router.replace({ path: route.path }); }

// ---------- View state (Filters, Sorts, Columns), persisted per DocType for this viewer ----------
const search = ref('');
const filters = ref<Filter[]>([]);
const sort = ref<Sort[]>([]);
const columns = ref<DocumentListColumn[]>([]);
const page = ref(1);
const pageLength = ref(20);
const selected = ref<string[]>([]);
/** True once the viewer picked columns themselves; their choice then always wins over auto-hiding. */
const columnsCustomised = ref(false);
/** The viewer asked to see columns that are empty on this page anyway. */
const showEmptyColumns = ref(false);

const storageKey = computed(() => `erp-list-view:${route.path}`);
const fieldMap = computed(() => new Map(metadata.value.map((field) => [field.fieldname, field])));

function defaultColumns(): DocumentListColumn[] {
  const fields = metadata.value;
  const titleField = meta.value?.title_field;
  const hasStatus = fields.some((field) => field.fieldname === 'status');
  // Masters without a status field still have a state: disabled / enabled / is_active.
  const hasFlag = fields.some((field) => ['disabled', 'enabled', 'is_active'].includes(field.fieldname));
  const chosen = listViewFields(fields, { limit: 5 }).filter((field) => field.fieldname !== titleField && field.fieldname !== 'status' && !['disabled', 'enabled'].includes(field.fieldname));
  return [
    { fieldname: 'name', label: doctype.value },
    ...(hasStatus || meta.value?.is_submittable || hasFlag ? [{ fieldname: hasStatus ? 'status' : '__status', label: 'Status' }] : []),
    ...chosen.map((field) => ({ fieldname: field.fieldname, label: field.label, fieldtype: field.fieldtype, options: field.options })),
    { fieldname: 'modified', label: 'Updated', fieldtype: 'Datetime' },
  ];
}

function defaultSort(): Sort[] {
  const field = meta.value?.sort_field || 'modified';
  return [{ fieldname: field, direction: meta.value?.sort_order?.toLowerCase() === 'asc' ? 'asc' : 'desc' }];
}

function restoreView() {
  let saved: { filters?: Filter[]; sort?: Sort[]; columns?: string[]; pageLength?: number; customColumns?: boolean } = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey.value) || '{}'); } catch { saved = {}; }
  const defaults = defaultColumns();
  const known = new Map([...defaults.map((column) => [column.fieldname, column] as const), ...metadata.value.map((field) => [field.fieldname, { fieldname: field.fieldname, label: field.label, fieldtype: field.fieldtype, options: field.options }] as const)]);
  const restored = (saved.columns ?? []).map((fieldname) => known.get(fieldname) ?? (['modified', 'creation', 'owner'].includes(fieldname) ? { fieldname, label: fieldname === 'owner' ? 'Created By' : fieldname === 'creation' ? 'Created' : 'Updated', fieldtype: 'Datetime' } : undefined)).filter(Boolean) as DocumentListColumn[];
  const usesSaved = restored.length > 0 && restored[0].fieldname === 'name';
  columns.value = usesSaved ? restored : defaults;
  columnsCustomised.value = usesSaved && Boolean(saved.customColumns);
  showEmptyColumns.value = false;
  filters.value = (saved.filters ?? []).filter((filter) => fieldMap.value.has(filter.fieldname) || ['name', 'modified', 'creation', 'owner'].includes(filter.fieldname));
  sort.value = saved.sort?.length ? saved.sort : defaultSort();
  pageLength.value = [20, 50, 100].includes(saved.pageLength ?? 0) ? saved.pageLength! : 20;
  page.value = 1;
  search.value = '';
  selected.value = [];
}

function persistView() {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify({ filters: filters.value, sort: sort.value, columns: columns.value.map((column) => column.fieldname), pageLength: pageLength.value, customColumns: columnsCustomised.value }));
  } catch { /* storage unavailable: the view lasts this visit */ }
}

const ready = ref(false);
watch([meta, () => route.path], () => {
  if (!meta.value || meta.value.name !== doctype.value) { ready.value = false; return; }
  if (meta.value.issingle) {
    void router.replace({ name: 'document-detail', params: { doctype: doctype.value, name: doctype.value } });
    return;
  }
  restoreView();
  ready.value = true;
}, { immediate: true });

watch([filters, sort, columns, pageLength, columnsCustomised], () => { if (ready.value) persistView(); }, { deep: true });
watch([filters, search, pageLength], () => { page.value = 1; selected.value = []; }, { deep: true });

// ---------- Query ----------
const searchFields = computed(() => {
  const list = ['name'];
  if (meta.value?.title_field) list.push(meta.value.title_field);
  for (const field of (meta.value?.search_fields || '').split(',')) {
    const name = field.trim();
    if (name && fieldMap.value.has(name)) list.push(name);
  }
  return [...new Set(list)];
});

const fetchFields = computed(() => {
  const list = new Set<string>(['name', 'modified']);
  const add = (fieldname?: string) => { if (fieldname && (fieldMap.value.has(fieldname) || ['creation', 'owner', 'modified'].includes(fieldname))) list.add(fieldname); };
  for (const column of columns.value) {
    add(column.fieldname);
    if (column.fieldtype === 'Currency') add(column.options || 'currency');
  }
  add(meta.value?.title_field);
  add(meta.value?.image_field);
  add('status');
  if (meta.value?.is_submittable) list.add('docstatus');
  for (const flag of ['disabled', 'enabled', 'is_active', 'currency']) add(flag);
  return [...list];
});

const query = computed<DocumentQuery>(() => ({
  doctype: doctype.value,
  fields: fetchFields.value,
  search: search.value,
  searchFields: searchFields.value,
  filters: [...fixedFilters.value, ...filters.value],
  sort: sort.value,
  page: page.value,
  pageLength: pageLength.value,
}));

const { rows, total, loading, error, forbidden, load } = useDocuments(query, ready);

// ---------- Status tabs ----------
const statusTabs = useStatusTabs({ doctype, fields: metadata, filters, fixedFilters, search, searchFields, enabled: ready });
function refresh() {
  void load();
  void statusTabs.reloadCounts();
}

// ---------- Columns that are empty for every loaded row are hidden (unless the viewer chose them) ----------
const ALWAYS_SHOWN = new Set(['name', '__status', 'status', 'modified', 'creation']);
const isBlank = (value: unknown) => value === null || value === undefined || value === '';
const emptyColumns = computed(() => {
  if (!rows.value.length) return [];
  return columns.value.filter((column, index) => index > 0 && !ALWAYS_SHOWN.has(column.fieldname) && column.fieldtype !== 'Check' && rows.value.every((row) => isBlank(row[column.fieldname])));
});
const hidingEmpty = computed(() => !columnsCustomised.value && !showEmptyColumns.value && emptyColumns.value.length > 0);
const displayColumns = computed(() => {
  if (!columns.value.length) return [{ fieldname: 'name', label: doctype.value }];
  if (!hidingEmpty.value) return columns.value;
  const hidden = new Set(emptyColumns.value.map((column) => column.fieldname));
  return columns.value.filter((column) => !hidden.has(column.fieldname));
});
function chooseColumns(next: DocumentListColumn[]) {
  columns.value = next;
  columnsCustomised.value = true;
}
function resetColumns() {
  columns.value = defaultColumns();
  columnsCustomised.value = false;
}

// ---------- Density (per viewer, all lists) ----------
const DENSITY_KEY = 'erp-list-density';
const density = ref<'comfortable' | 'compact'>((() => { try { return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'; } catch { return 'comfortable'; } })());
function toggleDensity() {
  density.value = density.value === 'compact' ? 'comfortable' : 'compact';
  try { localStorage.setItem(DENSITY_KEY, density.value); } catch { /* storage unavailable: lasts this visit */ }
}
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageLength.value)));
const hasCriteria = computed(() => Boolean(search.value.trim() || filters.value.length));

// ---------- Permissions & actions ----------
const canCreate = ref(false);
const canDelete = ref(false);
const canExport = ref(false);
watch(doctype, async (value) => {
  if (!value) return;
  [canCreate.value, canDelete.value, canExport.value] = await Promise.all([
    hasDocTypePermission(value, 'create'), hasDocTypePermission(value, 'delete'), hasDocTypePermission(value, 'export'),
  ]);
}, { immediate: true });

function openRecord(row: { name: string }) {
  void router.push({ name: 'document-detail', params: { doctype: doctype.value, name: row.name } });
}

function createRecord() {
  void router.push({ name: 'document-create', params: { doctype: doctype.value } });
}

const deleting = ref(false);
/** Desk's list actions for submittable DocTypes; ERPNext validates each document and reports failures. */
const isSubmittableList = computed(() => Boolean((metaRegistry.get(doctype.value) as { is_submittable?: number } | undefined)?.is_submittable));
async function bulkTransition(action: 'submit' | 'cancel') {
  const names = [...selected.value];
  const verb = action === 'submit' ? 'Submit' : 'Cancel';
  if (!(await confirm({ title: `${verb} ${names.length} ${names.length === 1 ? 'record' : 'records'}?`, message: action === 'submit' ? 'Submitted documents can only be cancelled and amended afterwards.' : 'ERPNext will reverse the ledger and stock entries of these documents.', confirmLabel: verb, tone: action === 'submit' ? 'secondary' : 'danger' }))) return;
  try {
    await erpnextApi.callPost('frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs', { doctype: doctype.value, docnames: JSON.stringify(names), action });
    toast.success(`${verb} started for ${names.length} ${names.length === 1 ? 'record' : 'records'}`);
    selected.value = [];
    refresh();
  } catch (cause) {
    toast.error(`${verb} failed`, frappeErrorMessage(cause));
  }
}

async function deleteSelected() {
  const names = [...selected.value];
  if (!(await confirm({ title: `Delete ${names.length} ${names.length === 1 ? 'record' : 'records'}?`, message: 'ERPNext will permanently delete them. Submitted documents must be cancelled first.', confirmLabel: 'Delete', tone: 'danger' }))) return;
  deleting.value = true;
  const failed: string[] = [];
  for (const name of names) {
    try { await documentApi.delete(doctype.value, name); } catch (cause) { failed.push(`${name}: ${frappeErrorMessage(cause)}`); }
  }
  deleting.value = false;
  selected.value = [];
  if (failed.length) toast.error(`${failed.length} of ${names.length} could not be deleted`, failed[0]);
  if (failed.length < names.length) toast.success(`${names.length - failed.length} deleted`);
  refresh();
}

function exportCsv() {
  const source = selected.value.length ? rows.value.filter((row) => selected.value.includes(row.name)) : rows.value;
  const exportColumns = columns.value.filter((column) => !column.fieldname.startsWith('__'));
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [
    exportColumns.map((column) => escape(column.label)).join(','),
    ...source.map((row) => exportColumns.map((column) => {
      const value = row[column.fieldname];
      return escape(column.fieldtype === 'Currency' || column.fieldtype === 'Float' ? String(value ?? '') : formatValue(value, { fieldtype: column.fieldtype || 'Data', options: column.options }, row).replace(/^—$/, ''));
    }).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${doctype.value.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearCriteria() {
  search.value = '';
  filters.value = [];
}
</script>

<template>
  <div class="page list-page stagger-in" :style="module ? { '--module-color': `var(${module.color})` } : undefined">
    <section class="page-header">
      <div>
        <p class="eyebrow list-eyebrow"><span v-if="module" class="module-dot" />{{ module?.label || 'DocType' }} · {{ doctype }}</p>
        <h1 class="page-title">{{ title }}<span v-if="ready && total" class="count-pill tabular">{{ total.toLocaleString() }}</span></h1>
        <p v-if="config?.description" class="page-subtitle">{{ config.description }}</p>
        <p v-if="isStaticDocType(doctype)" class="demo-note">Demo data from the NGO Impact Console · read-only until the NGO app is installed</p>
      </div>
      <div class="page-actions">
        <BaseButton v-if="canCreate && ready" variant="primary" size="md" @click="createRecord"><Plus :size="15" />New {{ doctype }}</BaseButton>
      </div>
    </section>

    <p v-if="linkFilters.length" class="link-filter-note"><Link2 :size="14" /><span>Linked records · {{ linkFilterLabel }}</span><button type="button" aria-label="Show all records" title="Show all records" @click="clearLinkFilters"><X :size="14" /></button></p>

    <section class="list-card">
      <ErrorState v-if="metaError" :kind="errorKind" :message="metaError" @retry="loadMeta" />
      <template v-else>
        <nav v-if="ready && statusTabs.tabs.value.length" class="status-tabs" :aria-label="`${title} by status`">
          <button
            v-for="tab in statusTabs.tabs.value"
            :key="tab.key"
            type="button"
            :class="['status-tab', { 'status-tab--active': statusTabs.activeKey.value === tab.key }]"
            :aria-pressed="statusTabs.activeKey.value === tab.key"
            @click="statusTabs.select(tab)"
          >
            {{ tab.label }}<span class="status-tab-count tabular">{{ tab.count === null ? '–' : tab.count.toLocaleString() }}</span>
          </button>
        </nav>
        <div class="table-tools">
          <label class="search-field tool-search">
            <Search :size="14" />
            <input v-model="search" :placeholder="`Search ${title.toLowerCase()}…`" :aria-label="`Search ${title}`" />
            <button v-if="search" type="button" class="search-field-clear" aria-label="Clear search" @click="search = ''"><X :size="13" /></button>
          </label>
          <QuickFilters v-if="ready" v-model="filters" :fields="metadata" class="tool-quick" />
          <div class="tool-actions">
            <FilterControl v-if="ready" v-model="filters" :fields="metadata" />
            <SortBy v-if="ready" v-model="sort" :fields="metadata" />
            <ColumnSettings v-if="ready" :model-value="columns" :fields="metadata" @update:model-value="chooseColumns" @reset="resetColumns" />
            <button type="button" class="tool-button tool-button--icon" :aria-label="density === 'compact' ? 'Comfortable rows' : 'Compact rows'" :title="density === 'compact' ? 'Comfortable rows' : 'Compact rows'" :aria-pressed="density === 'compact'" @click="toggleDensity"><Rows4 v-if="density === 'compact'" :size="14" /><Rows3 v-else :size="14" /></button>
            <button type="button" class="tool-button tool-button--icon" aria-label="Refresh" title="Refresh" @click="refresh()"><RefreshCw :size="14" :class="{ spin: loading }" /></button>
          </div>
        </div>

        <div v-if="filters.length || fixedFilters.length" class="active-filters">
          <span v-for="filter in fixedFilters" :key="`fixed-${filter.fieldname}`" class="filter-chip filter-chip--fixed">{{ fieldMap.get(filter.fieldname)?.label || filter.fieldname }} {{ filter.operator }} {{ filter.value }}</span>
          <span v-for="(filter, index) in filters" :key="index" class="filter-chip">
            {{ fieldMap.get(filter.fieldname)?.label || filter.fieldname }} <em>{{ filter.operator === 'like' ? 'contains' : filter.operator }}</em> {{ filter.value === 1 ? 'Yes' : filter.value === 0 ? 'No' : filter.value }}
            <button type="button" :aria-label="`Remove filter ${filter.fieldname}`" @click="filters = filters.filter((_, position) => position !== index)"><X :size="11" /></button>
          </span>
          <button v-if="filters.length" type="button" class="clear-filters" @click="filters = []">Clear all</button>
        </div>

        <Transition name="fade">
          <div v-if="selected.length" class="bulk-bar" role="region" aria-label="Bulk actions">
            <strong role="status">{{ selected.length }} selected</strong>
            <button type="button" class="bulk-link" @click="selected = []">Clear</button>
            <span class="bulk-spacer" />
            <BaseButton v-if="canExport" variant="quiet" size="sm" @click="exportCsv"><Download :size="14" />Export CSV</BaseButton>
            <BaseButton v-if="isSubmittableList" variant="quiet" size="sm" @click="bulkTransition('submit')">Submit</BaseButton>
            <BaseButton v-if="isSubmittableList" variant="quiet" size="sm" @click="bulkTransition('cancel')">Cancel</BaseButton>
            <BaseButton v-if="canDelete" variant="danger" size="sm" :loading="deleting" @click="deleteSelected"><Trash2 :size="14" />Delete</BaseButton>
          </div>
        </Transition>

        <ErrorState v-if="error" :kind="forbidden ? 'permission' : 'error'" :title="forbidden ? `You don’t have access to ${title}` : `Unable to load ${title}`" :message="error" @retry="load" />
        <template v-else-if="(ready || metaLoading) && (loading || metaLoading || rows.length)">
          <DataTable
            v-model:selected="selected"
            v-model:sort="sort"
            :columns="displayColumns"
            :rows="rows"
            :loading="loading || metaLoading"
            :selectable="canDelete || canExport || isSubmittableList"
            :title-field="meta?.title_field"
            :image-field="meta?.image_field"
            :submittable="Boolean(meta?.is_submittable)"
            :skeleton-rows="Math.min(pageLength, 10)"
            sticky-header
            :density="density"
            @row-click="openRecord"
          />
        </template>
        <EmptyState
          v-else-if="hasCriteria"
          :title="`No ${title.toLowerCase()} match ${filters.length ? 'these filters' : 'this search'}`"
          :description="filters.length && search.trim() ? 'Try a different search or remove some filters.' : filters.length ? 'Remove a filter or clear them all.' : 'Check the spelling or try a shorter search.'"
          :icon="Search"
        ><BaseButton variant="quiet" size="sm" @click="clearCriteria"><X :size="14" />{{ filters.length ? 'Clear filters' : 'Clear search' }}</BaseButton></EmptyState>
        <EmptyState
          v-else
          :title="`No ${title} found`"
          :description="canCreate ? `Create your first ${doctype.toLowerCase()} to get started.` : `There are no ${title.toLowerCase()} you can see yet.`"
        ><BaseButton v-if="canCreate" variant="primary" size="sm" @click="createRecord"><Plus :size="14" />Create {{ doctype }}</BaseButton></EmptyState>

        <footer v-if="ready && total > 0" class="pagination">
          <span class="pagination-summary">
            <span class="tabular">{{ `${(page - 1) * pageLength + 1}–${Math.min(page * pageLength, total)} of ${total.toLocaleString()}` }}</span>
            <template v-if="!columnsCustomised && emptyColumns.length">
              <span aria-hidden="true">·</span>
              <span>{{ emptyColumns.length }} empty {{ emptyColumns.length === 1 ? 'column' : 'columns' }} {{ hidingEmpty ? 'hidden' : 'shown' }}</span>
              <button type="button" class="link-button" @click="showEmptyColumns = !showEmptyColumns">{{ hidingEmpty ? 'Show' : 'Hide' }}</button>
            </template>
          </span>
          <div class="pagination-controls">
            <label class="page-size">Rows
              <select v-model.number="pageLength" class="control" aria-label="Rows per page"><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select>
            </label>
            <button type="button" class="tool-button tool-button--icon" aria-label="Previous page" :disabled="page === 1 || loading" @click="page -= 1"><ChevronLeft :size="15" /></button>
            <span class="page-indicator tabular">{{ page }} / {{ totalPages }}</span>
            <button type="button" class="tool-button tool-button--icon" aria-label="Next page" :disabled="page >= totalPages || loading" @click="page += 1"><ChevronRight :size="15" /></button>
          </div>
        </footer>
      </template>
    </section>
  </div>
</template>

<style scoped>
.link-filter-note { display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: var(--primary-soft-foreground); border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent); border-radius: var(--radius-md); background: var(--primary-softer); font-size: 12.5px; }
.link-filter-note span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link-filter-note button { display: grid; width: 22px; height: 22px; flex: none; margin-left: auto; place-items: center; color: inherit; border: 0; border-radius: var(--radius-sm); background: none; }
.link-filter-note button:hover { background: var(--primary-soft); }
.demo-note { display: inline-flex; margin-top: 8px; padding: 3px 10px; color: var(--accent-soft-foreground); border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 999px; background: var(--accent-soft); font-size: 11.5px; font-weight: 600; }
.list-eyebrow { display: flex; align-items: center; gap: 7px; }
.module-dot { width: 8px; height: 8px; border-radius: 3px; background: var(--module-color, var(--primary)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--module-color, var(--primary)) 18%, transparent); }
.list-card { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.table-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
.tool-search { width: 280px; }
.tool-quick { flex: 1; }
.tool-actions { display: flex; gap: 6px; margin-left: auto; }

.active-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 14px; border-bottom: 1px solid var(--border); background: var(--surface-tint); }
.filter-chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 6px 0 10px; color: var(--primary-soft-foreground); border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent); border-radius: 999px; background: var(--primary-soft); font-size: 12px; font-weight: 500; }
.filter-chip em { color: var(--muted-foreground); font-style: normal; font-weight: 400; }
.filter-chip button { display: grid; width: 18px; height: 18px; place-items: center; color: inherit; border: 0; border-radius: 50%; background: none; }
.filter-chip button:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }
.filter-chip--fixed { padding-right: 10px; color: var(--accent-soft-foreground); border-color: color-mix(in srgb, var(--accent) 25%, transparent); background: var(--accent-soft); }
.clear-filters { padding: 0 4px; color: var(--muted-foreground); border: 0; background: none; font-size: 12px; }
.clear-filters:hover { color: var(--danger); }

.status-tabs { display: flex; gap: 2px; overflow-x: auto; padding: 0 10px; border-bottom: 1px solid var(--border); scrollbar-width: none; }
.status-tab { position: relative; display: inline-flex; flex: none; align-items: center; gap: 7px; height: 42px; padding: 0 10px; color: var(--muted-foreground); border: 0; background: none; font-size: 13px; font-weight: 500; white-space: nowrap; transition: color var(--dur-fast) var(--ease); }
.status-tab::after { position: absolute; right: 8px; bottom: -1px; left: 8px; height: 2px; content: ''; border-radius: 2px 2px 0 0; background: transparent; transition: background-color var(--dur-fast) var(--ease); }
.status-tab:hover { color: var(--foreground); }
.status-tab:focus-visible { outline: var(--focus-ring); outline-offset: -4px; border-radius: var(--radius-md); }
.status-tab--active { color: var(--foreground); font-weight: 600; }
.status-tab--active::after { background: var(--primary); }
.status-tab-count { min-width: 20px; padding: 0 6px; color: var(--subtle-foreground); border-radius: 999px; background: var(--muted); font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; }
.status-tab--active .status-tab-count { color: var(--primary-soft-foreground); background: var(--primary-soft); }
.pagination-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.link-button { padding: 0; color: var(--primary-soft-foreground); border: 0; background: none; font-size: inherit; font-weight: 600; }
.link-button:hover { text-decoration: underline; }
.link-button:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: 3px; }
.bulk-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border)); background: var(--primary-softer); box-shadow: inset 3px 0 var(--primary); }
.bulk-bar strong { color: var(--primary-soft-foreground); font-size: 13px; }
.bulk-link { padding: 0; color: var(--muted-foreground); border: 0; background: none; font-size: 12.5px; }
.bulk-link:hover { color: var(--foreground); text-decoration: underline; }
.bulk-spacer { flex: 1; }

.pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px 10px 18px; color: var(--muted-foreground); border-top: 1px solid var(--border); font-size: 12.5px; }
.pagination-controls { display: flex; align-items: center; gap: 6px; }
.page-size { display: flex; align-items: center; gap: 6px; margin-right: 8px; }
.page-size select { width: 70px; height: 30px; padding: 0 24px 0 9px; background-position: right 6px center; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.page-indicator { min-width: 54px; text-align: center; }
.pagination .tool-button { height: 30px; width: 30px; }

@media (max-width: 900px) {
  .tool-search { width: 100%; }
  .tool-quick { flex-basis: 100%; }
  .tool-actions { margin-left: 0; }
}
</style>
