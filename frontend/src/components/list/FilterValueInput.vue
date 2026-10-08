<script setup lang="ts">
import { computed } from 'vue';
import LinkField from '@/components/forms/fields/LinkField.vue';
import { selectOptions } from '@/lib/doctype';
import { operatorGroup } from '@/lib/list-fields';
import type { ERPNextMetadataField } from '@/types/erp';

/** The value input for one Filter, chosen from the field's type and the operator. */
const props = defineProps<{ field?: ERPNextMetadataField; operator: string; modelValue: unknown; compact?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>();
const group = computed(() => operatorGroup(props.field));
const text = computed(() => (props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)));
</script>

<template>
  <select v-if="operator === 'is'" class="control" :value="text || 'set'" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option value="set">set</option><option value="not set">not set</option>
  </select>
  <select v-else-if="group === 'check'" class="control" :value="text" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value === '' ? '' : Number(($event.target as HTMLSelectElement).value))">
    <option value="">{{ compact ? `${field?.label}: any` : 'Any' }}</option><option value="1">{{ compact ? `${field?.label}: yes` : 'Yes' }}</option><option value="0">{{ compact ? `${field?.label}: no` : 'No' }}</option>
  </select>
  <select v-else-if="group === 'select'" class="control" :value="text" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option value="">{{ compact ? field?.label : 'Any' }}</option>
    <option v-for="option in selectOptions(field || {}).filter(Boolean)" :key="option" :value="option">{{ option }}</option>
  </select>
  <LinkField v-else-if="group === 'link' && operator !== 'like' && field?.fieldtype === 'Link'" :model-value="modelValue" :doctype="field.options" :placeholder="compact ? field.label : undefined" @update:model-value="emit('update:modelValue', $event)" />
  <input v-else-if="group === 'date'" class="control" :type="field?.fieldtype === 'Datetime' ? 'date' : 'date'" :value="text.slice(0, 10)" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  <input v-else-if="group === 'number'" class="control" inputmode="decimal" :value="text" :placeholder="compact ? field?.label : 'Value'" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value === '' ? '' : Number(($event.target as HTMLInputElement).value))" />
  <input v-else class="control" :value="text" :placeholder="compact ? field?.label : 'Value'" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
</template>
