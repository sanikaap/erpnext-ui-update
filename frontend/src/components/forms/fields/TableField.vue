<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowDown, ArrowUp, Copy, Maximize2, Plus, Rows3, Trash2 } from 'lucide-vue-next';
import FieldRenderer from '@/components/forms/FieldRenderer.vue';
import DynamicForm from '@/components/forms/DynamicForm.vue';
import AppDrawer from '@/components/overlays/AppDrawer.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { fieldState, formatValue, listViewFields, newChildRow, NUMERIC_TYPES, type ValidationError } from '@/lib/doctype';
import { applyDynamicDefaults, applyFetchFrom } from '@/lib/fetch-from';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import type { ERPNextMetadataField } from '@/types/erp';

/**
 * Generic child-table grid. Columns come from the child DocType's `in_list_view`
 * fields; every cell is a FieldRenderer, so Link, numeric, date and check cells
 * behave exactly like their form counterparts. The full row opens in a drawer.
 */
const props = withDefaults(defineProps<{
  field: ERPNextMetadataField;
  modelValue: Record<string, unknown>[];
  childFields: ERPNextMetadataField[];
  allChildFields?: Record<string, ERPNextMetadataField[]>;
  parentDoc?: Record<string, unknown>;
  parentDoctype?: string;
  readOnly?: boolean;
  errors?: ValidationError[];
}>(), { readOnly: false, parentDoc: () => ({}), allChildFields: () => ({}), errors: () => [] });

const emit = defineEmits<{ 'update:modelValue': [rows: Record<string, unknown>[]] }>();
const { context } = useSessionDefaults();

const rows = computed(() => props.modelValue ?? []);
const columns = computed(() => listViewFields(props.childFields, { limit: 6 }));
const selected = ref<Set<unknown>>(new Set());
const editingIndex = ref<number | null>(null);
const editingRow = computed(() => (editingIndex.value === null ? null : rows.value[editingIndex.value] ?? null));

/** Inline-editable cell types; anything richer is edited in the row drawer. */
const INLINE = new Set(['Data', 'Link', 'Dynamic Link', 'Select', 'Int', 'Float', 'Currency', 'Percent', 'Date', 'Datetime', 'Time', 'Check', 'Autocomplete', 'Phone', 'Read Only', 'Small Text']);

const rowKey = (row: Record<string, unknown>, index: number) => (row.name as string) || (row.__key as string) || `row-${index}`;

function cellState(column: ERPNextMetadataField, row: Record<string, unknown>) {
  return fieldState(column, row, { parent: props.parentDoc, readOnly: props.readOnly });
}

const errorKeys = computed(() => new Set(props.errors.filter((error) => error.table === props.field.fieldname).map((error) => `${error.row}:${error.fieldname}`)));
const rowsWithErrors = computed(() => new Set(props.errors.filter((error) => error.table === props.field.fieldname).map((error) => error.row)));

function renumber(list: Record<string, unknown>[]) {
  list.forEach((row, index) => { row.idx = index + 1; });
  return list;
}

function addRow() {
  if (!props.field.options) return;
  const row = newChildRow(props.field.options, props.childFields, { doctype: props.parentDoctype || '', fieldname: props.field.fieldname, idx: rows.value.length + 1 }, context());
  emit('update:modelValue', renumber([...rows.value, row]));
  // Rows are reactive once inside the parent document, so resolve ":Company"-style defaults on that copy.
  void Promise.resolve().then(() => {
    const added = props.modelValue[props.modelValue.length - 1];
    if (added) void applyDynamicDefaults(added, props.childFields, props.parentDoc);
  });
}

function duplicateRow(index: number) {
  const source = rows.value[index];
  const copy: Record<string, unknown> = { ...source, __islocal: 1, __key: `copy-${Date.now().toString(36)}-${index}` };
  delete copy.name;
  const next = [...rows.value];
  next.splice(index + 1, 0, copy);
  emit('update:modelValue', renumber(next));
}

function moveRow(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= rows.value.length) return;
  const next = [...rows.value];
  [next[index], next[target]] = [next[target], next[index]];
  emit('update:modelValue', renumber(next));
}

function deleteRows(indexes: number[]) {
  const drop = new Set(indexes);
  emit('update:modelValue', renumber(rows.value.filter((_, index) => !drop.has(index))));
  selected.value = new Set();
  if (editingIndex.value !== null && drop.has(editingIndex.value)) editingIndex.value = null;
}

function deleteSelected() {
  deleteRows(rows.value.map((row, index) => (selected.value.has(rowKey(row, index)) ? index : -1)).filter((index) => index >= 0));
}

function toggle(row: Record<string, unknown>, index: number) {
  const key = rowKey(row, index);
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  selected.value = next;
}

const allSelected = computed(() => rows.value.length > 0 && rows.value.every((row, index) => selected.value.has(rowKey(row, index))));
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(rows.value.map(rowKey));
}

function setCell(row: Record<string, unknown>, column: ERPNextMetadataField, value: unknown) {
  row[column.fieldname] = value;
}

function onLinkSelect(row: Record<string, unknown>, column: ERPNextMetadataField, value: string) {
  void applyFetchFrom(row, props.childFields, column, value);
}

/** Numeric totals for currency/float columns, shown in the footer. */
const totals = computed(() => {
  const result: Record<string, number> = {};
  for (const column of columns.value) {
    if (!['Currency', 'Float'].includes(column.fieldtype) || !/amount|total|qty/i.test(column.fieldname)) continue;
    result[column.fieldname] = rows.value.reduce((sum, row) => sum + (Number(row[column.fieldname]) || 0), 0);
  }
  return result;
});
const hasTotals = computed(() => Object.keys(totals.value).length > 0 && rows.value.length > 1);
</script>

<template>
  <div :class="['grid-field', { 'grid-field--readonly': readOnly }]">
    <div class="grid-head">
      <div class="grid-title"><Rows3 :size="14" /><span>{{ field.label }}</span><span class="grid-count tabular">{{ rows.length }}</span></div>
      <div v-if="!readOnly" class="grid-actions">
        <BaseButton v-if="selected.size" variant="danger" size="xs" @click="deleteSelected"><Trash2 :size="13" />Delete {{ selected.size }}</BaseButton>
        <BaseButton variant="outline" size="xs" @click="addRow"><Plus :size="13" />Add row</BaseButton>
      </div>
    </div>

    <div v-if="!columns.length" class="grid-empty">ERPNext returned no fields for {{ field.options }}.</div>
    <div v-else class="grid-scroll">
      <table class="grid">
        <thead>
          <tr>
            <th v-if="!readOnly" class="grid-select"><input type="checkbox" :checked="allSelected" :aria-label="`Select all ${field.label} rows`" :disabled="!rows.length" @change="toggleAll" /></th>
            <th class="grid-idx">#</th>
            <th v-for="column in columns" :key="column.fieldname" :class="{ 'grid-num': NUMERIC_TYPES.has(column.fieldtype), 'grid-check': column.fieldtype === 'Check' }">
              {{ column.label }}<b v-if="column.reqd && !readOnly" class="grid-req">*</b>
            </th>
            <th class="grid-row-actions"><span class="sr-only">Row actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + (readOnly ? 2 : 3)" class="grid-none">
              No {{ field.label.toLowerCase() }} yet<template v-if="!readOnly"> · <button type="button" class="grid-inline-add" @click="addRow">Add the first row</button></template>
            </td>
          </tr>
          <tr v-for="(row, index) in rows" :key="rowKey(row, index)" :class="{ 'grid-row--selected': selected.has(rowKey(row, index)), 'grid-row--error': rowsWithErrors.has(index + 1) }">
            <td v-if="!readOnly" class="grid-select"><input type="checkbox" :checked="selected.has(rowKey(row, index))" :aria-label="`Select row ${index + 1}`" @change="toggle(row, index)" /></td>
            <td class="grid-idx tabular">{{ index + 1 }}</td>
            <td
              v-for="column in columns"
              :key="column.fieldname"
              :class="['grid-cell', { 'grid-num': NUMERIC_TYPES.has(column.fieldtype), 'grid-cell--error': errorKeys.has(`${index + 1}:${column.fieldname}`) }]"
            >
              <FieldRenderer
                v-if="INLINE.has(column.fieldtype) && cellState(column, row).visible"
                :field="column"
                :model-value="row[column.fieldname]"
                :doc="row"
                :parent="parentDoc"
                :doctype="parentDoctype"
                :read-only="cellState(column, row).readOnly"
                :invalid="errorKeys.has(`${index + 1}:${column.fieldname}`)"
                compact
                @update:model-value="setCell(row, column, $event)"
                @link-select="onLinkSelect(row, column, $event)"
              />
              <button v-else type="button" class="grid-open-cell" @click="editingIndex = index">{{ cellState(column, row).visible ? formatValue(row[column.fieldname], column, row, parentDoc) : '' }}</button>
            </td>
            <td class="grid-row-actions">
              <button type="button" class="grid-icon" :aria-label="`Open row ${index + 1}`" title="Edit full row" @click="editingIndex = index"><Maximize2 :size="13" /></button>
              <template v-if="!readOnly">
                <button type="button" class="grid-icon" :aria-label="`Duplicate row ${index + 1}`" title="Duplicate" @click="duplicateRow(index)"><Copy :size="13" /></button>
                <button type="button" class="grid-icon grid-icon--danger" :aria-label="`Delete row ${index + 1}`" title="Delete" @click="deleteRows([index])"><Trash2 :size="13" /></button>
              </template>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="hasTotals">
          <tr>
            <td v-if="!readOnly" />
            <td class="grid-total-label" />
            <td v-for="column in columns" :key="column.fieldname" class="grid-num grid-total tabular">
              {{ column.fieldname in totals ? formatValue(totals[column.fieldname], column, rows[0], parentDoc) : '' }}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>

    <AppDrawer
      :open="editingRow !== null"
      :title="`${field.label} · Row ${(editingIndex ?? 0) + 1}`"
      :subtitle="field.options"
      width="640px"
      @close="editingIndex = null"
    >
      <template #head-actions>
        <button type="button" class="grid-icon" aria-label="Previous row" :disabled="!editingIndex" @click="editingIndex = Math.max(0, (editingIndex ?? 0) - 1)"><ArrowUp :size="14" /></button>
        <button type="button" class="grid-icon" aria-label="Next row" :disabled="editingIndex === null || editingIndex >= rows.length - 1" @click="editingIndex = Math.min(rows.length - 1, (editingIndex ?? 0) + 1)"><ArrowDown :size="14" /></button>
      </template>
      <DynamicForm
        v-if="editingRow"
        :key="rowKey(editingRow, editingIndex ?? 0)"
        :doctype="field.options || ''"
        :fields="childFields"
        :child-fields="allChildFields"
        :doc="editingRow"
        :parent="parentDoc"
        :read-only="readOnly"
        :errors="errors.filter((error) => error.table === field.fieldname && error.row === (editingIndex ?? 0) + 1).map((error) => ({ fieldname: error.fieldname, label: error.label }))"
        dense
      />
      <template v-if="!readOnly && editingIndex !== null" #footer>
        <BaseButton variant="danger" size="sm" @click="deleteRows([editingIndex])"><Trash2 :size="14" />Delete row</BaseButton>
        <BaseButton variant="primary" size="sm" @click="editingIndex = null">Done</BaseButton>
      </template>
    </AppDrawer>
  </div>
</template>

<style scoped>
.grid-field { min-width: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.grid-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 6px 8px 6px 14px; border-bottom: 1px solid var(--border); background: var(--surface-tint); border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
.grid-title { display: flex; align-items: center; gap: 8px; color: var(--foreground); font-size: 13px; font-weight: 600; }
.grid-title svg { color: var(--primary); }
.grid-count { padding: 1px 7px; color: var(--primary-soft-foreground); border-radius: 999px; background: var(--primary-soft); font-size: 11px; font-weight: 600; }
.grid-actions { display: flex; gap: 6px; }
.grid-scroll { overflow-x: auto; }
.grid { width: 100%; min-width: 640px; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.grid th { height: 34px; padding: 0 8px; color: var(--muted-foreground); border-bottom: 1px solid var(--border); font-size: 11.5px; font-weight: 600; text-align: left; white-space: nowrap; }
.grid td { height: 40px; padding: 2px 4px; color: var(--foreground); border-bottom: 1px solid var(--border); vertical-align: middle; }
.grid tbody tr:last-child td { border-bottom: 0; }
.grid tbody tr { transition: background-color .1s; }
.grid tbody tr:hover { background: var(--primary-softer); }
.grid-row--selected { background: var(--primary-soft) !important; }
.grid-row--error .grid-idx { color: var(--danger); font-weight: 700; }
.grid-cell--error { box-shadow: inset 0 -2px 0 var(--danger); }
.grid-select { width: 34px; text-align: center !important; }
.grid-select input { accent-color: var(--primary); }
.grid-idx { width: 36px; color: var(--subtle-foreground) !important; font-size: 12px; text-align: center !important; }
.grid-num { text-align: right !important; }
.grid-check { text-align: center !important; }
.grid-req { margin-left: 2px; color: var(--danger); }
.grid-cell { min-width: 120px; }
.grid-open-cell { width: 100%; height: 30px; padding: 0 8px; overflow: hidden; color: var(--foreground); border: 0; border-radius: 6px; background: none; font-size: 13px; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.grid-open-cell:hover { background: var(--muted); }
.grid-row-actions { width: 1%; padding-right: 8px !important; text-align: right; white-space: nowrap; }
.grid-icon { display: inline-grid; width: 26px; height: 26px; place-items: center; color: var(--subtle-foreground); border: 0; border-radius: 6px; background: none; opacity: .7; transition: opacity .1s, background-color .1s, color .1s; }
.grid tbody tr:hover .grid-icon, .grid-icon:focus-visible { opacity: 1; }
.grid-icon:hover:not(:disabled) { color: var(--primary); background: var(--primary-soft); }
.grid-icon--danger:hover:not(:disabled) { color: var(--danger); background: var(--danger-soft); }
.grid-icon:disabled { opacity: .3; cursor: not-allowed; }
.grid-none { height: 64px !important; color: var(--muted-foreground) !important; font-size: 12.5px; text-align: center; }
.grid-inline-add { padding: 0; color: var(--primary); border: 0; background: none; font-weight: 500; }
.grid-inline-add:hover { text-decoration: underline; }
.grid-empty { padding: 16px; color: var(--muted-foreground); font-size: 12.5px; }
.grid tfoot td { height: 36px; padding: 0 12px; border-top: 1px solid var(--border); background: var(--surface-tint); font-weight: 600; }
.grid-total { color: var(--foreground); }
</style>
