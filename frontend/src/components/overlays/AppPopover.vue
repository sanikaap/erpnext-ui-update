<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

/** Anchored popover; closes on outside click and Escape. */
const props = withDefaults(defineProps<{ align?: 'start' | 'end'; width?: string }>(), { align: 'start', width: '320px' });
const open = ref(false);
const root = ref<HTMLElement | null>(null);

function onDocument(event: MouseEvent) {
  const target = event.target as Node;
  // Link search results are teleported to <body>; clicks there belong to the popover.
  if (root.value?.contains(target) || (target as Element).closest?.('.link-panel')) return;
  open.value = false;
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}
watch(open, (value) => {
  if (value) {
    window.setTimeout(() => document.addEventListener('mousedown', onDocument));
    window.addEventListener('keydown', onKey);
  } else {
    document.removeEventListener('mousedown', onDocument);
    window.removeEventListener('keydown', onKey);
  }
});
onBeforeUnmount(() => { open.value = false; });

const toggle = () => { open.value = !open.value; };
const close = () => { open.value = false; };
defineExpose({ close });
void props;
</script>

<template>
  <div ref="root" class="popover-root">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Transition name="pop">
      <div v-if="open" :class="['popover', `popover--${align}`]" :style="{ width }" role="dialog">
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.popover-root { position: relative; display: inline-flex; }
.popover { position: absolute; z-index: 30; top: calc(100% + 6px); max-width: calc(100vw - 32px); padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-elevated); box-shadow: var(--shadow-lg); }
.popover--start { left: 0; }
.popover--end { right: 0; }
</style>
