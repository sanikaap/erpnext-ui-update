<script setup lang="ts">
import { computed } from 'vue';
import FilterValueInput from '@/components/list/FilterValueInput.vue';
import { defaultOperator } from '@/lib/list-fields';
import type { ERPNextMetadataField, Filter } from '@/types/erp';

/**
 * Quick Filters: the DocType's `in_standard_filter` fields shown inline.
 * Each is a projection over the Filter list, so it stays in sync with the Filter control.
 */
const props = defineProps<{ modelValue: Filter[]; fields: ERPNextMetadataField[] }>();
const emit = defineEmits<{ 'update:modelValue': [filters: Filter[]] }>();

const quickFields = computed(() => props.fields.filter((field) => field.in_standard_filter && !['Text Editor', 'Table', 'Table MultiSelect', 'Long Text', 'Text', 'Date', 'Datetime', 'Time'].includes(field.fieldtype)).slice(0, 4));

function current(field: ERPNextMetadataField) {
  return props.modelValue.find((filter) => filter.fieldname === field.fieldname && filter.operator === defaultOperator(field))?.value ?? '';
}

let timer: number | undefined;
function set(field: ERPNextMetadataField, value: unknown) {
  const operator = defaultOperator(field);
  const write = () => {
    const others = props.modelValue.filter((filter) => !(filter.fieldname === field.fieldname && filter.operator === operator));
    emit('update:modelValue', value === '' || value === null || value === undefined ? others : [...others, { fieldname: field.fieldname, operator, value }]);
  };
  // Free-text quick filters wait for a pause in typing.
  window.clearTimeout(timer);
  if (operator === 'like') timer = window.setTimeout(write, 350);
  else write();
}
</script>

<template>
  <div v-if="quickFields.length" class="quick-filters">
    <div v-for="field in quickFields" :key="field.fieldname" class="quick-filter" :title="field.label">
      <FilterValueInput :field="field" :operator="defaultOperator(field)" :model-value="current(field)" compact @update:model-value="set(field, $event)" />
    </div>
  </div>
</template>

<style scoped>
.quick-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.quick-filter { width: 160px; }
.quick-filter :deep(.control) { height: 34px; font-size: 12.5px; }
.quick-filter :deep(select.control) { padding-right: 8px; }
@media (max-width: 640px) { .quick-filter { width: calc(50% - 3px); } }
</style>
