<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useToast } from '@/composables/useToast';
import type { FormButton } from '@/desk/form';

/**
 * The buttons the DocType's own form script added (frm.add_custom_button): "Create ▾",
 * "Get Items From ▾", "Stop", "Update Items"… Grouped exactly as the script grouped them.
 */
const props = defineProps<{ buttons: FormButton[]; primaryGroup: string | null; workflowActions?: FormButton[] }>();
const toast = useToast();
const openGroup = ref<string | null>(null);

const singles = computed(() => props.buttons.filter((button) => !button.group));
const groups = computed(() => {
  const map = new Map<string, FormButton[]>();
  for (const button of props.buttons) if (button.group) map.set(button.group, [...(map.get(button.group) ?? []), button]);
  if (props.workflowActions?.length) map.set('Actions', props.workflowActions);
  return [...map.entries()].map(([label, items]) => ({ label, items }));
});

function run(button: FormButton) {
  openGroup.value = null;
  try {
    const result = button.fn() as unknown;
    if (result && typeof (result as Promise<unknown>).catch === 'function') (result as Promise<unknown>).catch((error) => console.error(`[desk] button "${button.label}"`, error));
  } catch (error) {
    if ((error as Error)?.constructor?.name !== 'ValidationStop') {
      console.error(`[desk] button "${button.label}"`, error);
      toast.error(`${button.label} failed`, (error as Error)?.message);
    }
  }
}
const variantOf = (button: FormButton) => (button.type === 'primary' ? 'primary' : button.type === 'danger' ? 'danger' : 'outline');
</script>

<template>
  <BaseButton v-for="button in singles" :key="button.label" :variant="variantOf(button)" size="md" @click="run(button)">{{ button.label }}</BaseButton>
  <div v-for="group in groups" :key="group.label" class="action-group">
    <BaseButton :variant="group.label === primaryGroup ? 'primary' : 'outline'" size="md" aria-haspopup="menu" :aria-expanded="openGroup === group.label" @click="openGroup = openGroup === group.label ? null : group.label">
      {{ group.label }}<ChevronDown :size="14" />
    </BaseButton>
    <Transition name="pop">
      <div v-if="openGroup === group.label" class="menu-panel action-menu" role="menu">
        <button v-for="button in group.items" :key="button.label" type="button" role="menuitem" class="menu-item" @click="run(button)">{{ button.label }}</button>
      </div>
    </Transition>
  </div>
  <div v-if="openGroup" class="action-scrim" @click="openGroup = null" />
</template>

<style scoped>
.action-group { position: relative; }
.action-menu { position: absolute; z-index: 20; top: calc(100% + 6px); right: 0; min-width: 200px; }
.action-scrim { position: fixed; z-index: 19; inset: 0; }
</style>
