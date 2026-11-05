<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';
import AppModal from '@/components/overlays/AppModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import DeskDialog from '@/components/desk/DeskDialog.vue';
import { deskState, dismissMessage } from '@/desk/runtime';

/** Everything form scripts open globally: dialogs, messages and the "working…" overlay. */
</script>

<template>
  <DeskDialog v-for="dialog in deskState.dialogs" :key="dialog.uid" :dialog="dialog" />
  <AppModal v-for="entry in deskState.messages" :key="entry.id" :open="true" :title="entry.title || 'Message'" :width="entry.wide ? '760px' : '480px'" @close="dismissMessage(entry.id)">
    <div :class="['desk-message', entry.indicator && `desk-message--${entry.indicator}`]" v-html="entry.html" />
    <template #footer>
      <BaseButton v-if="entry.secondary" variant="quiet" size="sm" @click="entry.secondary.action">{{ entry.secondary.label }}</BaseButton>
      <BaseButton v-if="entry.primary" variant="primary" size="sm" @click="entry.primary.action">{{ entry.primary.label }}</BaseButton>
      <BaseButton v-else variant="quiet" size="sm" @click="dismissMessage(entry.id)">Close</BaseButton>
    </template>
  </AppModal>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="deskState.freezeCount > 0" class="desk-freeze" role="status" aria-live="polite">
        <span class="desk-freeze-card"><LoaderCircle :size="16" class="desk-spin" />{{ deskState.freezeMessage || 'Working…' }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.desk-message { color: var(--foreground); font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }
.desk-message--red { color: var(--danger); }
.desk-message :deep(ul) { margin: 6px 0; padding-left: 18px; list-style: disc; }
.desk-message :deep(table) { width: 100%; border-collapse: collapse; }
.desk-message :deep(td) { padding: 4px 8px; border: 1px solid var(--border); }
.desk-freeze { position: fixed; z-index: 120; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--background) 45%, transparent); }
.desk-freeze-card { display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px; color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-elevated); box-shadow: var(--shadow-lg); font-size: 13px; }
.desk-spin { color: var(--primary); animation: desk-spin .8s linear infinite; }
@keyframes desk-spin { to { transform: rotate(360deg); } }
</style>
