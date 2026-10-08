<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, CheckCheck } from 'lucide-vue-next';
import AppPopover from '@/components/overlays/AppPopover.vue';
import EmptyState from '@/components/feedback/EmptyState.vue';
import { erpnextApi } from '@/services/erpnext-api';
import { sanitizeHtml } from '@/lib/sanitize';
import { relativeTime } from '@/lib/doctype';

/** The user's Frappe Notification Log, with unread state. */
interface NotificationLog { name: string; subject: string; document_type?: string; document_name?: string; read: number; creation: string; type?: string; from_user?: string }

const router = useRouter();
const logs = ref<NotificationLog[]>([]);
const loaded = ref(false);
const failed = ref(false);
const unread = computed(() => logs.value.filter((log) => !Number(log.read)).length);
const METHOD = 'frappe.desk.doctype.notification_log.notification_log';

async function load() {
  try {
    const response = await erpnextApi.call<{ notification_logs: NotificationLog[] }>(`${METHOD}.get_notification_logs`, { limit: 20 });
    logs.value = response.message?.notification_logs ?? [];
    failed.value = false;
  } catch {
    failed.value = true;
  } finally {
    loaded.value = true;
  }
}

async function open(log: NotificationLog, close: () => void) {
  close();
  if (!Number(log.read)) {
    log.read = 1;
    void erpnextApi.callPost(`${METHOD}.mark_as_read`, { docname: log.name }).catch(() => undefined);
  }
  if (log.document_type && log.document_name) {
    await router.push({ name: 'document-detail', params: { doctype: log.document_type, name: log.document_name } });
  }
}

async function markAll() {
  logs.value = logs.value.map((log) => ({ ...log, read: 1 }));
  await erpnextApi.callPost(`${METHOD}.mark_all_as_read`).catch(() => undefined);
}

let timer: number | undefined;
onMounted(() => {
  void load();
  timer = window.setInterval(load, 120_000);
});
onBeforeUnmount(() => window.clearInterval(timer));
</script>

<template>
  <AppPopover align="end" width="360px">
    <template #trigger="{ toggle, open: isOpen }">
      <button class="icon-button" :aria-label="unread ? `Notifications, ${unread} unread` : 'Notifications'" title="Notifications" :aria-expanded="isOpen" data-testid="button-notifications" @click="!isOpen && load(); toggle()">
        <Bell :size="17" /><span v-if="unread" class="badge-count tabular">{{ unread > 9 ? '9+' : unread }}</span>
      </button>
    </template>
    <template #default="{ close }">
      <header class="notif-head">
        <strong>Notifications</strong>
        <button v-if="unread" type="button" class="notif-mark" @click="markAll"><CheckCheck :size="13" />Mark all read</button>
      </header>
      <p v-if="failed" class="notif-error">Notifications could not be loaded.</p>
      <EmptyState v-else-if="loaded && !logs.length" compact title="You’re all caught up" description="Assignments, mentions and alerts from ERPNext appear here." :icon="Bell" />
      <ul v-else class="notif-list">
        <li v-for="log in logs" :key="log.name">
          <button type="button" :class="['notif-item', { unread: !Number(log.read) }]" @click="open(log, close)">
            <span class="notif-dot" />
            <span class="notif-copy">
              <span class="notif-subject" v-html="sanitizeHtml(log.subject)" />
              <small>{{ log.document_type }}<template v-if="log.document_name"> · {{ log.document_name }}</template> · {{ relativeTime(log.creation) }}</small>
            </span>
          </button>
        </li>
      </ul>
    </template>
  </AppPopover>
</template>

<style scoped>
.icon-button { position: relative; display: grid; width: 36px; height: 36px; place-items: center; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); transition: background-color .15s, color .15s; }
.icon-button:hover { color: var(--primary); background: var(--primary-softer); }
.badge-count { position: absolute; top: -5px; right: -5px; display: grid; min-width: 17px; height: 17px; padding: 0 4px; place-items: center; color: var(--danger-foreground); border: 2px solid var(--surface); border-radius: 999px; background: var(--danger); font-size: 9.5px; font-weight: 700; }
.notif-head { display: flex; align-items: center; justify-content: space-between; margin: -2px 0 8px; }
.notif-head strong { color: var(--foreground); font-size: 13.5px; }
.notif-mark { display: inline-flex; align-items: center; gap: 4px; padding: 0; color: var(--primary); border: 0; background: none; font-size: 12px; font-weight: 500; }
.notif-error { color: var(--danger); font-size: 12.5px; }
.notif-list { display: flex; max-height: 380px; flex-direction: column; gap: 2px; margin: 0 -6px; padding: 0; overflow-y: auto; list-style: none; }
.notif-item { display: flex; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: var(--radius-md); background: none; text-align: left; }
.notif-item:hover { background: var(--muted); }
.notif-dot { width: 7px; height: 7px; flex: none; margin-top: 6px; border-radius: 50%; background: transparent; }
.notif-item.unread .notif-dot { background: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.notif-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.notif-subject { color: var(--foreground); font-size: 12.5px; line-height: 1.45; }
.notif-item:not(.unread) .notif-subject { color: var(--muted-foreground); }
.notif-copy small { color: var(--subtle-foreground); font-size: 11.5px; }
</style>
