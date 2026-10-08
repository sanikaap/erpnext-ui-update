<script setup lang="ts">
import { computed, ref } from 'vue';
import { Filter as FilterIcon, Plus, X } from 'lucide-vue-next';
import AppPopover from '@/components/overlays/AppPopover.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import FilterValueInput from '@/components/list/FilterValueInput.vue';
import { defaultOperator, fieldOptions, OPERATORS, operatorGroup } from '@/lib/list-fields';
import type { ERPNextMetadataField, Filter } from '@/types/erp';

/**
 * Controlled: v-model is the list of Filters. Edits happen on a draft and are
 * emitted on Apply, so typing a value doesn't refetch on every keystroke.
 */
const props = defineProps<{ modelValue: Filter[]; fields: ERPNextMetadataField[] }>();
const emit = defineEmits<{ 'update:modelValue': [filters: Filter[]] }>();

const options = computed(() => fieldOptions(props.fields));
const draft = ref<Filter[]>([]);
const fieldFor = (fieldname: string) => options.value.find((field) => field.fieldname === fieldname);

function start() {
  draft.value = props.modelValue.map((filter) => ({ ...filter }));
  if (!draft.value.length) add();
}

function add() {
  const field = options.value.find((candidate) => candidate.fieldname !== 'name') ?? options.value[0];
  if (field) draft.value.push({ fieldname: field.fieldname, operator: defaultOperator(field), value: '' });
}

function setField(filter: Filter, fieldname: string) {
  filter.fieldname = fieldname;
  filter.operator = defaultOperator(fieldFor(fieldname));
  filter.value = '';
}

function setOperator(filter: Filter, operator: string) {
  filter.operator = operator;
  if (operator === 'is') filter.value = 'set';
  else if (filter.value === 'set' || filter.value === 'not set') filter.value = '';
}

function apply(close: () => void) {
  emit('update:modelValue', draft.value.filter((filter) => filter.value !== '' && filter.value !== null && filter.value !== undefined));
  close();
}

function clearAll(close: () => void) {
  draft.value = [];
  emit('update:modelValue', []);
  close();
}
</script>

<template>
  <AppPopover width="560px">
    <template #trigger="{ toggle, open }">
      <button type="button" :class="['tool-button', { 'tool-button--active': modelValue.length }]" :aria-expanded="open" @click="!open && start(); toggle()">
        <FilterIcon :size="14" />Filter<span v-if="modelValue.length" class="tool-count">{{ modelValue.length }}</span>
      </button>
    </template>
    <template #default="{ close }">
      <p class="pop-title">Filters</p>
      <div class="filter-rows">
        <p v-if="!draft.length" class="filter-none">No filters applied.</p>
        <div v-for="(filter, index) in draft" :key="index" class="filter-row">
          <span class="filter-join">{{ index === 0 ? 'Where' : 'and' }}</span>
          <select class="control" :value="filter.fieldname" aria-label="Field" @change="setField(filter, ($event.target as HTMLSelectElement).value)">
            <option v-for="field in options" :key="field.fieldname" :value="field.fieldname">{{ field.label }}</option>
          </select>
          <select class="control filter-op" :value="filter.operator" aria-label="Operator" @change="setOperator(filter, ($event.target as HTMLSelectElement).value)">
            <option v-for="operator in OPERATORS[operatorGroup(fieldFor(filter.fieldname))]" :key="operator.value" :value="operator.value">{{ operator.label }}</option>
          </select>
          <div class="filter-value"><FilterValueInput v-model="filter.value" :field="fieldFor(filter.fieldname)" :operator="filter.operator" /></div>
          <button type="button" class="filter-remove" :aria-label="`Remove filter ${index + 1}`" @click="draft.splice(index, 1)"><X :size="14" /></button>
        </div>
      </div>
      <div class="filter-foot">
        <button type="button" class="filter-add" @click="add"><Plus :size="14" />Add filter</button>
        <div class="filter-actions">
          <BaseButton variant="ghost" size="sm" @click="clearAll(close)">Clear all</BaseButton>
          <BaseButton variant="primary" size="sm" @click="apply(close)">Apply</BaseButton>
        </div>
      </div>
    </template>
  </AppPopover>
</template>

<style scoped>
.filter-rows { display: flex; flex-direction: column; gap: 8px; }
.filter-none { padding: 6px 0; color: var(--muted-foreground); font-size: 12.5px; }
.filter-row { display: grid; grid-template-columns: 44px minmax(0, 1.2fr) minmax(0, .8fr) minmax(0, 1.4fr) 28px; align-items: center; gap: 6px; }
.filter-row .control { height: 32px; padding: 0 8px; font-size: 12.5px; }
.filter-value :deep(.control) { height: 32px; }
.filter-join { color: var(--subtle-foreground); font-size: 12px; text-align: right; }
.filter-remove { display: grid; width: 28px; height: 28px; place-items: center; color: var(--subtle-foreground); border: 0; border-radius: var(--radius-md); background: none; }
.filter-remove:hover { color: var(--danger); background: var(--danger-soft); }
.filter-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.filter-add { display: inline-flex; align-items: center; gap: 6px; padding: 0; color: var(--primary); border: 0; background: none; font-size: 13px; font-weight: 500; }
.filter-actions { display: flex; gap: 6px; }
@media (max-width: 600px) {
  .filter-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px; }
  .filter-join { display: none; }
  .filter-value { grid-column: 1 / 3; }
}
</style>
