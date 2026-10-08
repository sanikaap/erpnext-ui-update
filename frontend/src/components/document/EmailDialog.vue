<script setup lang="ts">
import { ref, watch } from 'vue';
import { Send } from 'lucide-vue-next';
import AppModal from '@/components/overlays/AppModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { documentApi } from '@/services/document-api';
import { frappeErrorMessage } from '@/services/erpnext-api';
import { useToast } from '@/composables/useToast';
import { escapeHtml } from '@/lib/sanitize';

/** Sends a document by email through Frappe's Communication API. */
const props = defineProps<{ open: boolean; doctype: string; name: string; defaultRecipient?: string }>();
const emit = defineEmits<{ close: []; sent: [] }>();
const toast = useToast();

const recipients = ref('');
const subject = ref('');
const message = ref('');
const attachPrint = ref(true);
const sending = ref(false);

watch(() => props.open, (open) => {
  if (!open) return;
  recipients.value = props.defaultRecipient || '';
  subject.value = `${props.doctype}: ${props.name}`;
  message.value = '';
});

async function send() {
  sending.value = true;
  try {
    await documentApi.sendEmail({
      doctype: props.doctype,
      name: props.name,
      recipients: recipients.value,
      subject: subject.value,
      content: escapeHtml(message.value).replace(/\n/g, '<br>'),
      attachPrint: attachPrint.value,
    });
    toast.success('Email queued', `Sent to ${recipients.value}`);
    emit('sent');
    emit('close');
  } catch (cause) {
    toast.error('Email not sent', frappeErrorMessage(cause));
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AppModal :open="open" :title="`Email ${name}`" subtitle="Sent through ERPNext’s outgoing email account" width="560px" @close="emit('close')">
    <form id="email-form" class="email-form" @submit.prevent="send">
      <label>To<input v-model="recipients" class="control" type="text" required placeholder="name@company.com, …" /></label>
      <label>Subject<input v-model="subject" class="control" required /></label>
      <label>Message<textarea v-model="message" class="control" rows="6" /></label>
      <label class="email-check"><input v-model="attachPrint" type="checkbox" />Attach document print (PDF)</label>
    </form>
    <template #footer>
      <BaseButton variant="quiet" size="sm" @click="emit('close')">Cancel</BaseButton>
      <BaseButton variant="primary" size="sm" type="submit" form="email-form" :loading="sending"><Send :size="14" />Send</BaseButton>
    </template>
  </AppModal>
</template>

<style scoped>
.email-form { display: flex; flex-direction: column; gap: 12px; }
.email-form label { display: flex; flex-direction: column; gap: 5px; color: var(--muted-foreground); font-size: 12px; font-weight: 500; }
.email-form textarea { height: auto; padding: 8px 11px; resize: vertical; line-height: 1.5; }
.email-check { flex-direction: row !important; align-items: center; gap: 8px !important; color: var(--foreground) !important; font-size: 13px !important; }
.email-check input { accent-color: var(--primary); }
</style>
