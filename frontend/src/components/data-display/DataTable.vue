<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-vue-next';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import { documentStatus, monogram, monogramTone, statusTone } from '@/lib/display';
import { formatValue, relativeTime, formatDate, NUMERIC_TYPES } from '@/lib/doctype';
import { fileApi } from '@/services/file-api';
import { staticLinkTitle } from '@/services/static-data';
import type { DocumentListColumn, FrappeDocument, Sort } from '@/types/erp';

/**
 * Metadata-driven table for any DocType. The first column is the record's identity
 * (title + ID); `__status` is a virtual column built from status / docstatus.
 * Below 720px rows render as cards.
 */
const props = withDefaults(defineProps<{
  columns: DocumentListColumn[];
  rows?: FrappeDocument[];
  loading?: boolean;
  selectable?: boolean;
  selected?: string[];
  sort?: Sort[];
  titleField?: string;
  imageField?: string;
  submittable?: boolean;
  skeletonRows?: number;
}>(), { rows: () => [], loading: false, selectable: false, selected: () => [], sort: () => [], submittable: false, skeletonRows: 8 });

const emit = defineEmits<{ rowClick: [row: FrappeDocument]; 'update:selected': [names: string[]]; 'update:sort': [sort: Sort[]] }>();

const selectedSet = computed(() => new Set(props.selected));
const allSelected = computed(() => props.rows.length > 0 && props.rows.every((row) => selectedSet.value.has(row.name)));
const someSelected = computed(() => !allSelected.value && props.rows.some((row) => selectedSet.value.has(row.name)));

function toggleRow(row: FrappeDocument) {
  const next = new Set(selectedSet.value);
  if (next.has(row.name)) next.delete(row.name); else next.add(row.name);
  emit('update:selected', [...next]);
}
function toggleAll() {
  emit('update:selected', allSelected.value ? [] : props.rows.map((row) => row.name));
}

const sortState = computed(() => props.sort[0]);
function sortBy(column: DocumentListColumn) {
  if (column.fieldname.startsWith('__')) return;
  const current = sortState.value;
  const direction = current?.fieldname === column.fieldname && current.direction === 'desc' ? 'asc' : 'desc';
  emit('update:sort', [{ fieldname: column.fieldname, direction }]);
}

const isNumeric = (column: DocumentListColumn) => NUMERIC_TYPES.has(column.fieldtype || '');

function title(row: FrappeDocument) {
  const value = props.titleField ? row[props.titleField] : undefined;
  return typeof value === 'string' && value ? value : row.name;
}

function cell(row: FrappeDocument, column: DocumentListColumn) {
  const value = row[column.fieldname];
  if (column.fieldname === 'modified' || column.fieldname === 'creation') return relativeTime(value) || '—';
  if (column.fieldtype === 'Date') return formatDate(value);
  return formatValue(value, { fieldtype: column.fieldtype || 'Data', options: column.options }, row);
}

function status(row: FrappeDocument) {
  return documentStatus(row, { submittable: props.submittable });
}

function image(row: FrappeDocument) {
  const value = props.imageField ? row[props.imageField] : undefined;
  return typeof value === 'string' && value ? fileApi.getUrl(value) : '';
}
</script>

<template>
  <div class="table-wrap">
    <table :aria-busy="loading" data-testid="table-data">
      <thead>
        <tr>
          <th v-if="selectable" class="cell-select">
            <input type="checkbox" :checked="allSelected" :indeterminate="someSelected" aria-label="Select all rows on this page" :disabled="loading || !rows.length" @change="toggleAll" />
          </th>
          <th
            v-for="column in columns"
            :key="column.fieldname"
            :class="{ 'cell-numeric': isNumeric(column), sortable: !column.fieldname.startsWith('__'), sorted: sortState?.fieldname === column.fieldname }"
            :style="column.width ? { width: column.width } : undefined"
            :aria-sort="sortState?.fieldname === column.fieldname ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : undefined"
          >
            <button v-if="!column.fieldname.startsWith('__')" type="button" class="sort-button" @click="sortBy(column)">
              {{ column.label }}
              <ArrowUp v-if="sortState?.fieldname === column.fieldname && sortState.direction === 'asc'" :size="12" />
              <ArrowDown v-else-if="sortState?.fieldname === column.fieldname" :size="12" />
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
          <th class="cell-open"><span class="sr-only">Open</span></th>
        </tr>
      </thead>

      <tbody v-if="loading && !rows.length">
        <tr v-for="index in skeletonRows" :key="index" class="skeleton-row">
          <td v-if="selectable" class="cell-select"><span class="skeleton" style="width: 14px; height: 14px" /></td>
          <td v-for="(column, columnIndex) in columns" :key="column.fieldname" :data-label="column.label">
            <span class="skeleton" :style="{ width: `${columnIndex === 0 ? 60 : 30 + ((index * 7 + columnIndex * 13) % 40)}%`, height: '10px' }" />
          </td>
          <td />
        </tr>
      </tbody>

      <tbody v-else :class="{ refreshing: loading }">
        <tr
          v-for="row in rows"
          :key="row.name"
          :class="{ selected: selectedSet.has(row.name) }"
          tabindex="0"
          @click="emit('rowClick', row)"
          @keydown.enter="emit('rowClick', row)"
        >
          <td v-if="selectable" class="cell-select" @click.stop>
            <input type="checkbox" :checked="selectedSet.has(row.name)" :aria-label="`Select ${row.name}`" @change="toggleRow(row)" />
          </td>
          <td v-for="(column, index) in columns" :key="column.fieldname" :data-label="column.label" :class="{ 'cell-numeric': isNumeric(column), 'cell-first': index === 0 }">
            <span v-if="index === 0" class="cell-primary">
              <img v-if="image(row)" :src="image(row)" alt="" class="cell-image" loading="lazy" />
              <span v-else :class="['monogram', `tone-${monogramTone(row.name)}`]" aria-hidden="true">{{ monogram(title(row)) }}</span>
              <span class="cell-titles"><strong>{{ title(row) }}</strong><small v-if="title(row) !== row.name" class="mono">{{ row.name }}</small></span>
            </span>
            <template v-else-if="column.fieldname === '__status'">
              <BaseBadge v-if="status(row)" :tone="status(row)!.tone" :label="status(row)!.label" />
            </template>
            <BaseBadge v-else-if="column.fieldname === 'status'" :tone="statusTone(row.status)" :label="String(row.status || '—')" />
            <span v-else-if="column.fieldtype === 'Check'" :class="['check-value', { 'check-value--on': Number(row[column.fieldname]) === 1 }]">{{ Number(row[column.fieldname]) === 1 ? 'Yes' : 'No' }}</span>
            <span v-else-if="column.fieldtype === 'Link' && row[column.fieldname]" class="cell-link" :title="String(row[column.fieldname])">{{ staticLinkTitle(column.options, row[column.fieldname]) || row[column.fieldname] }}</span>
            <span v-else-if="column.fieldname === 'modified' || column.fieldname === 'creation'" class="cell-muted" :title="formatDate(row[column.fieldname], true)">{{ cell(row, column) }}</span>
            <span v-else :class="{ 'cell-empty': cell(row, column) === '—' }">{{ cell(row, column) }}</span>
          </td>
          <td class="cell-open"><ChevronRight :size="15" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; }
th { position: sticky; top: 0; z-index: 1; height: 38px; padding: 0 14px; color: var(--muted-foreground); border-bottom: 1px solid var(--border); background: var(--surface-2); font-size: var(--text-xs); font-weight: 600; letter-spacing: .01em; white-space: nowrap; }
td { height: 50px; padding: 0 14px; color: var(--muted-foreground); border-bottom: 1px solid var(--border); font-size: var(--text-base); font-variant-numeric: tabular-nums; white-space: nowrap; }
tbody tr:last-child td { border-bottom: 0; }
.sort-button { display: inline-flex; align-items: center; gap: 4px; padding: 0; color: inherit; border: 0; background: none; font: inherit; }
.sort-button:hover { color: var(--foreground); }
.sort-button:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); border-radius: var(--radius-sm); }
th.sorted { color: var(--primary-soft-foreground); }
th.sorted svg { color: var(--primary); }
.cell-numeric { font-variant-numeric: tabular-nums; text-align: right; }
.cell-numeric .sort-button { flex-direction: row-reverse; }
.cell-select { width: 40px; padding-right: 0; }
.cell-select input { width: 15px; height: 15px; accent-color: var(--primary); cursor: pointer; }
.cell-primary { display: inline-flex; align-items: center; gap: 10px; max-width: 360px; }
.cell-image { width: 28px; height: 28px; flex: none; border-radius: 8px; object-fit: cover; box-shadow: inset 0 0 0 1px var(--border); }
.cell-titles { display: flex; min-width: 0; flex-direction: column; line-height: 1.3; }
.cell-titles strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; }
.cell-titles small { overflow: hidden; color: var(--subtle-foreground); font-size: 11px; text-overflow: ellipsis; }
.cell-link { color: var(--info); font-weight: 500; }
.cell-muted { color: var(--subtle-foreground); font-size: 12.5px; }
.cell-empty { color: var(--subtle-foreground); }
.check-value { display: inline-flex; align-items: center; gap: 6px; color: var(--subtle-foreground); }
.check-value::before { width: 6px; height: 6px; content: ''; border-radius: 50%; background: var(--border-strong); }
.check-value--on { color: var(--foreground); }
.check-value--on::before { background: var(--secondary); box-shadow: 0 0 0 3px var(--secondary-soft); }
tbody tr { cursor: pointer; transition: background-color var(--dur-fast) var(--ease); }
tbody tr:hover, tbody tr:focus-visible { outline: 0; background: var(--primary-softer); }
tbody tr:focus-visible { box-shadow: inset 3px 0 var(--primary); }
tbody tr.selected { background: var(--primary-soft); }
tbody tr.selected td.cell-first { box-shadow: inset 3px 0 var(--primary); }
tbody.refreshing { opacity: .55; transition: opacity var(--dur-fast) var(--ease); }
.skeleton-row { cursor: default; }
.skeleton-row:hover { background: none; }
.cell-open { width: 36px; color: var(--subtle-foreground); text-align: right; }
.cell-open svg { opacity: 0; transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease); }
tbody tr:hover .cell-open svg { color: var(--primary); opacity: 1; transform: translateX(2px); }

/* Card layout for narrow screens */
@media (max-width: 720px) {
  table, thead, tbody, tr, td { display: block; }
  thead { display: none; }
  tbody tr { position: relative; margin: 10px 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
  tbody tr.selected { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
  td { display: flex; height: auto; min-height: 26px; align-items: center; justify-content: space-between; gap: 12px; padding: 3px 0; border: 0; white-space: normal; }
  td::before { content: attr(data-label); color: var(--subtle-foreground); font-size: 11.5px; font-weight: 500; }
  td.cell-first { padding: 2px 34px 8px 0; margin-bottom: 4px; border-bottom: 1px dashed var(--border); }
  td.cell-first::before, td.cell-select::before, td.cell-open::before { display: none; }
  td.cell-numeric { text-align: right; }
  .cell-select { position: absolute; top: 14px; right: 12px; width: auto; padding: 0; min-height: 0; }
  .cell-open { display: none; }
  tbody tr.selected td.cell-first { box-shadow: none; }
}
</style>
