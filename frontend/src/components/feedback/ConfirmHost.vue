<script setup lang="ts">
import AppModal from '@/components/overlays/AppModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useConfirm } from '@/composables/useConfirm';

const { request, settle } = useConfirm();
</script>

<template>
  <AppModal :open="Boolean(request)" :title="request?.title" width="420px" @close="settle(false)">
    <p class="confirm-message">{{ request?.message }}</p>
    <template #footer>
      <BaseButton variant="quiet" size="sm" @click="settle(false)">Cancel</BaseButton>
      <BaseButton :variant="request?.tone === 'danger' ? 'danger' : request?.tone === 'secondary' ? 'secondary' : 'primary'" size="sm" data-autofocus @click="settle(true)">{{ request?.confirmLabel || 'Confirm' }}</BaseButton>
    </template>
  </AppModal>
</template>

<style scoped>
.confirm-message { color: var(--muted-foreground); font-size: 13px; line-height: 1.55; }
</style>
