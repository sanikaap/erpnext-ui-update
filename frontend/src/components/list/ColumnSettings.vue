<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDown, ArrowUp, Columns3, RotateCcw, X } from 'lucide-vue-next';
import AppPopover from '@/components/overlays/AppPopover.vue';
import { fieldOptions } from '@/lib/list-fields';
import type { DocumentListColumn, ERPNextMetadataField } from '@/types/erp';

/** Controlled: v-model is the ordered list of Columns (presence = shown, order = display order). */
const props = defineProps<{ modelValue: DocumentListColumn[]; fields: ERPNextMetadataField[] }>();
const emit = defineEmits<{ 'update:modelValue': [columns: DocumentListColumn[]]; reset: [] }>();

const available = computed(() => fieldOptions(props.fields).filter((field) => !props.modelValue.some((column) => column.fieldname === field.fieldname)));

function move(index: number, delta: number) {
  const next = [...props.modelValue];
  const target = index + delta;
  if (target < 1 || target >= next.length) return;
  [next[index], next[target]] = [next[target], next[index]];
  emit('update:modelValue', next);
}
function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, position) => position !== index));
}
function add(fieldname: string) {
  const field = fieldOptions(props.fields).find((candidate) => candidate.fieldname === fieldname);
  if (field) emit('update:modelValue', [...props.modelValue, { fieldname: field.fieldname, label: field.label, fieldtype: field.fieldtype, options: field.options }]);
}
</script>

<template>
  <AppPopover align="end" width="280px">
    <template #trigger="{ toggle }">
      <button type="button" class="tool-button" @click="toggle"><Columns3 :size="14" /><span class="column-label">Columns</span></button>
    </template>
    <p class="pop-title">Columns</p>
    <ul class="column-list">
      <li v-for="(column, index) in modelValue" :key="column.fieldname">
        <span>{{ column.label }}</span>
        <template v-if="index > 0">
          <button type="button" :aria-label="`Move ${column.label} up`" :disabled="index === 1" @click="move(index, -1)"><ArrowUp :size="12" /></button>
          <button type="button" :aria-label="`Move ${column.label} down`" :disabled="index === modelValue.length - 1" @click="move(index, 1)"><ArrowDown :size="12" /></button>
          <button type="button" :aria-label="`Hide ${column.label}`" @click="remove(index)"><X :size="12" /></button>
        </template>
      </li>
    </ul>
    <select class="control column-add" value="" aria-label="Add column" @change="add(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
      <option value="" disabled>+ Add a column…</option>
      <option v-for="field in available" :key="field.fieldname" :value="field.fieldname">{{ field.label }}</option>
    </select>
    <button type="button" class="column-reset" @click="emit('reset')"><RotateCcw :size="12" />Reset to ERPNext list view</button>
  </AppPopover>
</template>

<style scoped>
.column-list { display: flex; flex-direction: column; gap: 2px; margin: 0 0 10px; padding: 0; list-style: none; }
.column-list li { display: flex; align-items: center; gap: 2px; height: 30px; padding: 0 4px 0 8px; border-radius: var(--radius-md); background: var(--surface-tint); }
.column-list span { min-width: 0; flex: 1; overflow: hidden; color: var(--foreground); font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
.column-list button { display: grid; width: 22px; height: 22px; place-items: center; color: var(--subtle-foreground); border: 0; border-radius: 5px; background: none; }
.column-list button:hover:not(:disabled) { color: var(--primary); background: var(--primary-soft); }
.column-list button:disabled { opacity: .3; }
.column-add { height: 32px; font-size: 12.5px; }
.column-reset { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 0; color: var(--muted-foreground); border: 0; background: none; font-size: 12px; }
.column-reset:hover { color: var(--primary); }
@media (max-width: 760px) { .column-label { display: none; } }
</style>
