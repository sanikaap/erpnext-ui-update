<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { FORM_BINDING } from '@/desk/binding';
import { ArrowDown, ArrowUp, Copy, Download, Maximize2, Plus, Rows3, Trash2, Upload } from 'lucide-vue-next';
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
const binding = inject(FORM_BINDING, null);
const flags = computed(() => binding?.gridFlags(props.field.fieldname) ?? { cannotAdd: false, cannotDelete: false });
// Submitted documents keep their rows; only "Allow on Submit" cells stay editable.
const rowsLocked = computed(() => props.readOnly || Number(props.parentDoc?.docstatus ?? 0) > 0);
const canAdd = computed(() => !rowsLocked.value && !flags.value.cannotAdd);
const canDelete = computed(() => !rowsLocked.value && !flags.value.cannotDelete);
onMounted(() => binding?.registerGrid(props.field.fieldname, () => rows.value.filter((row, index) => selected.value.has(rowKey(row, index))).map((row, index) => String(row.name ?? rowKey(row, index)))));

const rows = computed(() => props.modelValue ?? []);
const columns = computed(() => listViewFields(props.childFields, { limit: 8 }));
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

/** Desk's Insert Above / Insert Below: a new row at a position, keeping the rest in order. */
function insertRow(at: number) {
  addRow();
  void Promise.resolve().then(() => {
    const next = [...props.modelValue];
    const [added] = next.splice(next.length - 1, 1);
    next.splice(at, 0, added);
    emit('update:modelValue', renumber(next));
    editingIndex.value = at;
  });
}

// Desk's Download / Upload, offered on tables marked "Allow Bulk Edit".
const bulkEdit = computed(() => Boolean((props.field as { allow_bulk_edit?: number }).allow_bulk_edit));
const bulkColumns = computed(() => props.childFields.filter((column) => !column.hidden && !column.read_only && !['Section Break', 'Column Break', 'Tab Break', 'Fold', 'HTML', 'Button', 'Heading', 'Table', 'Table MultiSelect'].includes(column.fieldtype)));
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
function downloadRows() {
  const lines = [bulkColumns.value.map((column) => csvCell(column.label)).join(','), ...rows.value.map((row) => bulkColumns.value.map((column) => csvCell(row[column.fieldname])).join(','))];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  link.download = `${props.field.options ?? props.field.fieldname}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function parseCsv(text: string) {
  const table: string[][] = [[]];
  let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { table[table.length - 1].push(cell); cell = ''; } else if (char === '\n') { table[table.length - 1].push(cell); cell = ''; table.push([]); } else if (char !== '\r') cell += char;
  }
  table[table.length - 1].push(cell);
  return table.filter((line) => line.some(Boolean));
}
const uploadInput = ref<HTMLInputElement | null>(null);
async function uploadRows(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const [header, ...lines] = parseCsv(await file.text());
  if (!header) return;
  const fieldnames = header.map((label) => bulkColumns.value.find((column) => column.label === label.trim() || column.fieldname === label.trim())?.fieldname);
  const start = rows.value.length;
  lines.forEach(() => addRow());
  await Promise.resolve();
  lines.forEach((line, offset) => {
    const row = props.modelValue[start + offset];
    if (row) fieldnames.forEach((fieldname, column) => { if (fieldname && line[column] !== undefined && line[column] !== '') row[fieldname] = line[column]; });
  });
}

function addRow() {
  if (!props.field.options) return;
  const row = newChildRow(props.field.options, props.childFields, { doctype: props.parentDoctype || '', fieldname: props.field.fieldname, idx: rows.value.length + 1 }, context());
  row.parent = props.parentDoc?.name;
  emit('update:modelValue', renumber([...rows.value, row]));
  // Rows are reactive once inside the parent document, so resolve ":Company"-style defaults on that copy.
  void Promise.resolve().then(() => {
    const added = props.modelValue[props.modelValue.length - 1];
    if (!added) return;
    void applyDynamicDefaults(added, props.childFields, props.parentDoc);
    binding?.rowAdded(props.field, added);
  });
}

function duplicateRow(index: number) {
  const source = rows.value[index];
  const key = `copy-${Date.now().toString(36)}-${index}`;
  const copy: Record<string, unknown> = { ...source, __islocal: 1, __key: key, name: `new-${String(source.doctype ?? 'row').toLowerCase().replace(/ /g, '-')}-${key}` };
  const next = [...rows.value];
  next.splice(index + 1, 0, copy);
  emit('update:modelValue', renumber(next));
  void Promise.resolve().then(() => binding?.rowAdded(props.field, props.modelValue[index + 1]));
}

function moveRow(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= rows.value.length) return;
  const next = [...rows.value];
  [next[index], next[target]] = [next[target], next[index]];
  emit('update:modelValue', renumber(next));
  binding?.rowMoved(props.field);
}

function deleteRows(indexes: number[]) {
  const drop = new Set(indexes);
  const removed = rows.value.filter((_, index) => drop.has(index));
  emit('update:modelValue', renumber(rows.value.filter((_, index) => !drop.has(index))));
  binding?.rowsRemoved(props.field, removed);
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
  binding?.fieldChanged(column, row, value);
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
      <div class="grid-title"><span class="grid-title-icon" aria-hidden="true"><Rows3 :size="15" /></span><span>{{ field.label }}</span><span class="grid-count tabular">{{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }}</span></div>
      <div v-if="canAdd || canDelete || bulkEdit" class="grid-actions">
        <BaseButton v-if="selected.size && canDelete" variant="danger" size="sm" @click="deleteSelected"><Trash2 :size="13" />Delete {{ selected.size }}</BaseButton>
        <BaseButton v-if="bulkEdit" variant="quiet" size="sm" @click="downloadRows"><Download :size="13" />Download</BaseButton>
        <BaseButton v-if="bulkEdit && canAdd" variant="quiet" size="sm" @click="uploadInput?.click()"><Upload :size="13" />Upload</BaseButton>
        <input v-if="bulkEdit && canAdd" ref="uploadInput" type="file" accept=".csv,text/csv" hidden @change="uploadRows" />
        <BaseButton v-if="canAdd" variant="primary" size="sm" @click="addRow"><Plus :size="14" />Add row</BaseButton>
      </div>
    </div>

    <div v-if="!columns.length" class="grid-empty">ERPNext returned no fields for {{ field.options }}.</div>
    <div v-else class="grid-scroll">
      <table class="grid-table">
        <thead>
          <tr>
            <th v-if="!props.readOnly" class="grid-select"><input type="checkbox" :checked="allSelected" :aria-label="`Select all ${field.label} rows`" :disabled="!rows.length" @change="toggleAll" /></th>
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
              No {{ field.label.toLowerCase() }} yet<template v-if="canAdd"> · <button type="button" class="grid-inline-add" @click="addRow">Add the first row</button></template>
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
              <button v-if="canAdd" type="button" class="grid-icon" :aria-label="`Duplicate row ${index + 1}`" title="Duplicate" @click="duplicateRow(index)"><Copy :size="13" /></button>
              <button v-if="canDelete" type="button" class="grid-icon grid-icon--danger" :aria-label="`Delete row ${index + 1}`" title="Delete" @click="deleteRows([index])"><Trash2 :size="13" /></button>
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
        <BaseButton v-if="canDelete" variant="danger" size="sm" @click="deleteRows([editingIndex])"><Trash2 :size="14" />Delete row</BaseButton>
        <BaseButton v-if="canAdd" variant="quiet" size="sm" @click="insertRow(editingIndex)">Insert Above</BaseButton>
        <BaseButton v-if="canAdd" variant="quiet" size="sm" @click="insertRow(editingIndex + 1)">Insert Below</BaseButton>
        <BaseButton variant="primary" size="sm" @click="editingIndex = null">Done</BaseButton>
      </template>
    </AppDrawer>
  </div>
</template>

<style scoped>
.grid-field { min-width: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
/* Inside a table-only form section the card already draws the frame. */
:global(.form-section--table) .grid-field { border: 0; border-radius: 0; }
.grid-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 12px; min-height: 60px; padding: 12px 16px 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
.grid-title { display: flex; align-items: center; gap: 10px; color: var(--foreground); font-size: 15px; font-weight: 600; }
.grid-title-icon { display: grid; width: 28px; height: 28px; flex: none; place-items: center; color: var(--primary); border-radius: 8px; background: var(--primary-softer); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 16%, transparent); }
.grid-count { padding: 1px 8px; color: var(--muted-foreground); border-radius: 999px; background: var(--muted); font-size: 11.5px; font-weight: 500; }
.grid-actions { display: flex; gap: 6px; }
.grid-scroll { overflow-x: auto; }
.grid-row-actions { position: sticky; z-index: 1; right: 0; background: var(--surface); }
.grid-table th.grid-row-actions { background: var(--surface-2); }
.grid-table { width: 100%; min-width: 640px; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.grid-table th { height: 38px; padding: 0 8px; color: var(--subtle-foreground); border-bottom: 1px solid var(--border); background: var(--surface-2); font-size: 11.5px; font-weight: 600; text-align: left; white-space: nowrap; }
.grid-table td { height: 46px; padding: 3px 4px; color: var(--foreground); border-bottom: 1px solid var(--border); vertical-align: middle; }
.grid-table tbody tr:last-child td { border-bottom: 0; }
.grid-table tbody tr { transition: background-color .1s; }
.grid-table tbody tr:hover { background: var(--primary-softer); }
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
.grid-table tbody tr:hover .grid-icon, .grid-icon:focus-visible { opacity: 1; }
.grid-icon:hover:not(:disabled) { color: var(--primary); background: var(--primary-soft); }
.grid-icon--danger:hover:not(:disabled) { color: var(--danger); background: var(--danger-soft); }
.grid-icon:disabled { opacity: .3; cursor: not-allowed; }
.grid-none { height: 88px !important; color: var(--muted-foreground) !important; font-size: 13px; text-align: center; }
.grid-inline-add { padding: 0; color: var(--primary); border: 0; background: none; font-weight: 500; }
.grid-inline-add:hover { text-decoration: underline; }
.grid-empty { padding: 16px; color: var(--muted-foreground); font-size: 12.5px; }
.grid-table tfoot td { height: 44px; padding: 0 12px; border-top: 1px solid var(--border); background: var(--surface-2); font-weight: 600; }
.grid-total { color: var(--foreground); }
</style>
