<script setup lang="ts">
import { computed, ref } from 'vue';
import { X } from 'lucide-vue-next';
import LinkField from '@/components/forms/fields/LinkField.vue';
import { newChildRow } from '@/lib/doctype';
import type { ERPNextMetadataField } from '@/types/erp';

/**
 * Table MultiSelect: a child table whose rows each hold one Link.
 * Shown as chips with a Link search to add more.
 */
const props = withDefaults(defineProps<{
  field: ERPNextMetadataField;
  modelValue: Record<string, unknown>[];
  childFields: ERPNextMetadataField[];
  parentDoctype?: string;
  readOnly?: boolean;
  invalid?: boolean;
}>(), { readOnly: false, invalid: false });
const emit = defineEmits<{ 'update:modelValue': [rows: Record<string, unknown>[]] }>();

const linkField = computed(() => props.childFields.find((field) => field.fieldtype === 'Link'));
const rows = computed(() => props.modelValue ?? []);
const draft = ref('');

function values() {
  return rows.value.map((row) => String(row[linkField.value?.fieldname || ''] ?? '')).filter(Boolean);
}

function add(value: string) {
  draft.value = '';
  if (!value || !linkField.value || !props.field.options || values().includes(value)) return;
  const row = newChildRow(props.field.options, props.childFields, { doctype: props.parentDoctype || '', fieldname: props.field.fieldname, idx: rows.value.length + 1 });
  row[linkField.value.fieldname] = value;
  emit('update:modelValue', [...rows.value, row]);
}

function remove(index: number) {
  emit('update:modelValue', rows.value.filter((_, position) => position !== index).map((row, position) => ({ ...row, idx: position + 1 })));
}
</script>

<template>
  <div :class="['multi', { 'multi--readonly': readOnly }]">
    <div v-if="rows.length" class="multi-chips">
      <span v-for="(row, index) in rows" :key="(row.name as string) || (row.__key as string) || index" class="multi-chip">
        {{ row[linkField?.fieldname || ''] }}
        <button v-if="!readOnly" type="button" :aria-label="`Remove ${row[linkField?.fieldname || '']}`" @click="remove(index)"><X :size="11" /></button>
      </span>
    </div>
    <span v-else-if="readOnly" class="multi-empty">—</span>
    <LinkField v-if="!readOnly && linkField" v-model="draft" :doctype="linkField.options" :invalid="invalid" :placeholder="`Add ${field.label.toLowerCase()}…`" @select="add" />
  </div>
</template>

<style scoped>
.multi { display: flex; flex-direction: column; gap: 8px; }
.multi-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.multi-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 6px 0 10px; color: var(--primary-soft-foreground); border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent); border-radius: 999px; background: var(--primary-soft); font-size: 12.5px; font-weight: 500; }
.multi--readonly .multi-chip { padding-right: 10px; }
.multi-chip button { display: grid; width: 18px; height: 18px; place-items: center; padding: 0; color: inherit; border: 0; border-radius: 50%; background: none; }
.multi-chip button:hover { background: color-mix(in srgb, var(--primary) 20%, transparent); }
.multi-empty { color: var(--subtle-foreground); }
</style>
