<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue';
import AppModal from '@/components/overlays/AppModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import DynamicForm from '@/components/forms/DynamicForm.vue';
import { FORM_BINDING } from '@/desk/binding';
import type { DeskDialog } from '@/desk/dialog';
import { sanitizeHtml } from '@/lib/sanitize';

/** One script dialog (frappe.ui.Dialog), rendered with the same form engine as documents. */
const props = defineProps<{ dialog: DeskDialog }>();
provide(FORM_BINDING, props.dialog);

const state = computed(() => props.dialog.state);
const width = computed(() => ({ small: '420px', large: '860px', 'extra-large': '1100px' }[state.value.size] ?? '560px'));
const bodyHost = ref<HTMLElement | null>(null);
onMounted(() => { bodyHost.value?.append(props.dialog.body); });
</script>

<template>
  <AppModal :open="true" :title="state.title" :width="width" @close="dialog.hide()">
    <div class="desk-dialog">
      <p v-if="state.message" class="desk-dialog-message" v-html="sanitizeHtml(state.message)" />
      <div ref="bodyHost" class="desk-dialog-body" />
      <DynamicForm :doctype="`Dialog ${state.title}`" :fields="dialog.fields" :child-fields="dialog.childFields" :doc="dialog.doc" dense />
    </div>
    <template v-if="state.primaryLabel || state.secondaryLabel || state.customActions.length" #footer>
      <BaseButton v-for="action in state.customActions" :key="action.label" variant="quiet" size="sm" @click="action.fn">{{ action.label }}</BaseButton>
      <BaseButton v-if="state.secondaryLabel" variant="quiet" size="sm" @click="dialog.runSecondary()">{{ state.secondaryLabel }}</BaseButton>
      <BaseButton v-if="state.primaryLabel" variant="primary" size="sm" :loading="state.busy" :disabled="state.primaryDisabled" @click="dialog.runPrimary()">{{ state.primaryLabel }}</BaseButton>
    </template>
  </AppModal>
</template>

<style scoped>
.desk-dialog-message { margin-bottom: 12px; color: var(--muted-foreground); font-size: 13px; }
.desk-dialog-body:empty { display: none; }
</style>
