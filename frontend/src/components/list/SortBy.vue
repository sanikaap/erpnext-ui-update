<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpDown } from 'lucide-vue-next';
import AppPopover from '@/components/overlays/AppPopover.vue';
import { fieldOptions } from '@/lib/list-fields';
import type { ERPNextMetadataField, Sort } from '@/types/erp';

/** Controlled: v-model is the list of Sorts; the host serializes it to order_by and refetches. */
const props = defineProps<{ modelValue: Sort[]; fields: ERPNextMetadataField[] }>();
const emit = defineEmits<{ 'update:modelValue': [sort: Sort[]] }>();

const options = computed(() => fieldOptions(props.fields));
const current = computed(() => props.modelValue[0] ?? { fieldname: 'modified', direction: 'desc' as const });
const label = computed(() => options.value.find((field) => field.fieldname === current.value.fieldname)?.label || current.value.fieldname);

function setField(fieldname: string) {
  emit('update:modelValue', [{ fieldname, direction: current.value.direction }]);
}
function flip() {
  emit('update:modelValue', [{ fieldname: current.value.fieldname, direction: current.value.direction === 'asc' ? 'desc' : 'asc' }]);
}
</script>

<template>
  <div class="sort-by">
    <button type="button" class="tool-button tool-button--icon sort-direction" :aria-label="current.direction === 'asc' ? 'Ascending — switch to descending' : 'Descending — switch to ascending'" :title="current.direction === 'asc' ? 'Ascending' : 'Descending'" @click="flip">
      <ArrowUpNarrowWide v-if="current.direction === 'asc'" :size="14" /><ArrowDownWideNarrow v-else :size="14" />
    </button>
    <AppPopover align="end" width="240px">
      <template #trigger="{ toggle }">
        <button type="button" class="tool-button sort-field" @click="toggle"><ArrowUpDown :size="14" /><span>{{ label }}</span></button>
      </template>
      <template #default="{ close }">
        <p class="pop-title">Sort by</p>
        <div class="sort-options">
          <button v-for="field in options" :key="field.fieldname" type="button" :class="['sort-option', { active: field.fieldname === current.fieldname }]" @click="setField(field.fieldname); close()">{{ field.label }}</button>
        </div>
      </template>
    </AppPopover>
  </div>
</template>

<style scoped>
.sort-by { display: inline-flex; }
.sort-direction { border-radius: var(--radius-md) 0 0 var(--radius-md) !important; }
.sort-field { margin-left: -1px; border-radius: 0 var(--radius-md) var(--radius-md) 0 !important; }
.sort-field span { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sort-options { display: flex; max-height: 300px; flex-direction: column; overflow-y: auto; }
.sort-option { padding: 6px 8px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; font-size: 13px; text-align: left; }
.sort-option:hover { background: var(--muted); }
.sort-option.active { color: var(--primary-soft-foreground); background: var(--primary-soft); font-weight: 600; }
</style>
