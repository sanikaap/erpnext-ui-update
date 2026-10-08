<script setup lang="ts">
import { computed, ref } from 'vue';
import { FileText, History, LoaderCircle, MessageSquare, Paperclip, Send, Upload, X } from 'lucide-vue-next';
import { documentApi, type DocInfo } from '@/services/document-api';
import { fileApi } from '@/services/file-api';
import { frappeErrorMessage } from '@/services/erpnext-api';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import { escapeHtml, sanitizeHtml } from '@/lib/sanitize';
import { formatDate, relativeTime } from '@/lib/doctype';
import { monogram, monogramTone } from '@/lib/display';
import { useConfirm } from '@/composables/useConfirm';

/** Comments, attachments and change history from Frappe's docinfo. */
const props = defineProps<{ doctype: string; name: string; docinfo: DocInfo; doc: Record<string, unknown>; canWrite: boolean }>();
const emit = defineEmits<{ refresh: [] }>();
const { user } = useCurrentUser();
const toast = useToast();
const { confirm } = useConfirm();

const comment = ref('');
const posting = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

interface TimelineEntry { key: string; kind: 'comment' | 'version' | 'email' | 'created'; who: string; when: string; html?: string; text?: string }

function versionSummary(data: string) {
  try {
    const parsed = JSON.parse(data) as { changed?: unknown[][]; added?: unknown[]; removed?: unknown[] };
    const changed = parsed.changed ?? [];
    if (changed.length) return `changed ${changed.slice(0, 3).map((change) => String(change[0]).replace(/_/g, ' ')).join(', ')}${changed.length > 3 ? ` and ${changed.length - 3} more` : ''}`;
    if (parsed.added?.length) return `added ${parsed.added.length} row${parsed.added.length === 1 ? '' : 's'}`;
    if (parsed.removed?.length) return `removed ${parsed.removed.length} row${parsed.removed.length === 1 ? '' : 's'}`;
  } catch { /* unreadable version payload */ }
  return 'updated this document';
}

const timeline = computed<TimelineEntry[]>(() => {
  const entries: TimelineEntry[] = [
    ...(props.docinfo.comments ?? []).map((item) => ({ key: `c-${item.name}`, kind: 'comment' as const, who: item.owner, when: item.creation, html: sanitizeHtml(item.content) })),
    ...(props.docinfo.versions ?? []).map((item) => ({ key: `v-${item.name}`, kind: 'version' as const, who: item.owner, when: item.creation, text: versionSummary(item.data) })),
    ...(props.docinfo.communications ?? []).map((item) => ({ key: `e-${item.name}`, kind: 'email' as const, who: item.sender || 'Email', when: item.creation, text: item.subject || 'sent an email' })),
  ];
  if (typeof props.doc.creation === 'string') entries.push({ key: 'created', kind: 'created', who: String(props.doc.owner || ''), when: props.doc.creation, text: 'created this document' });
  return entries.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 40);
});

async function postComment() {
  const text = comment.value.trim();
  if (!text || !user.value) return;
  posting.value = true;
  try {
    await documentApi.addComment(props.doctype, props.name, escapeHtml(text).replace(/\n/g, '<br>'), { email: user.value.email || user.value.id, fullName: user.value.fullName });
    comment.value = '';
    emit('refresh');
  } catch (cause) {
    toast.error('Comment not added', frappeErrorMessage(cause));
  } finally {
    posting.value = false;
  }
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    await fileApi.upload(file, { doctype: props.doctype, docname: props.name, isPrivate: true });
    toast.success('File attached', file.name);
    emit('refresh');
  } catch (cause) {
    toast.error('Upload failed', frappeErrorMessage(cause));
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

async function removeAttachment(fileName: string, name: string) {
  if (!(await confirm({ title: 'Remove attachment?', message: `${fileName} will be deleted from ERPNext.`, confirmLabel: 'Remove', tone: 'danger' }))) return;
  try {
    await fileApi.delete(name);
    emit('refresh');
  } catch (cause) {
    toast.error('Could not remove file', frappeErrorMessage(cause));
  }
}
</script>

<template>
  <aside class="activity">
    <section class="activity-card">
      <header class="activity-head"><Paperclip :size="14" /><h3>Attachments</h3><span class="activity-count tabular">{{ docinfo.attachments?.length || 0 }}</span>
        <button v-if="canWrite" type="button" class="activity-add" :disabled="uploading" :aria-label="'Attach a file'" @click="fileInput?.click()"><LoaderCircle v-if="uploading" :size="14" class="spin" /><Upload v-else :size="14" /></button>
        <input ref="fileInput" type="file" class="sr-only" tabindex="-1" @change="upload" />
      </header>
      <ul v-if="docinfo.attachments?.length" class="attachment-list">
        <li v-for="file in docinfo.attachments" :key="file.name">
          <FileText :size="14" />
          <a :href="fileApi.getUrl(file.file_url)" target="_blank" rel="noopener" :title="file.file_name">{{ file.file_name }}</a>
          <button v-if="canWrite" type="button" :aria-label="`Remove ${file.file_name}`" @click="removeAttachment(file.file_name, file.name)"><X :size="12" /></button>
        </li>
      </ul>
      <p v-else class="activity-empty">No files attached.</p>
    </section>

    <section class="activity-card">
      <header class="activity-head"><MessageSquare :size="14" /><h3>Activity</h3></header>
      <form class="comment-box" @submit.prevent="postComment">
        <textarea v-model="comment" class="control" rows="2" placeholder="Add a comment…" aria-label="Add a comment" @keydown.ctrl.enter="postComment" @keydown.meta.enter="postComment" />
        <button type="submit" class="comment-send" :disabled="!comment.trim() || posting" aria-label="Post comment"><LoaderCircle v-if="posting" :size="14" class="spin" /><Send v-else :size="14" /></button>
      </form>
      <ol class="timeline">
        <li v-for="entry in timeline" :key="entry.key" :class="['timeline-item', `timeline-item--${entry.kind}`]">
          <span v-if="entry.kind === 'comment'" :class="['timeline-avatar monogram', `tone-${monogramTone(entry.who)}`]">{{ monogram(entry.who) }}</span>
          <span v-else class="timeline-dot"><History v-if="entry.kind === 'version'" :size="11" /></span>
          <div class="timeline-copy">
            <p><strong>{{ entry.who.split('@')[0] }}</strong> <span v-if="entry.text">{{ entry.text }}</span></p>
            <div v-if="entry.html" class="timeline-comment" v-html="entry.html" />
            <time :datetime="entry.when" :title="formatDate(entry.when, true)">{{ relativeTime(entry.when) }}</time>
          </div>
        </li>
      </ol>
    </section>
  </aside>
</template>

<style scoped>
.activity { display: flex; min-width: 0; flex-direction: column; gap: 14px; }
.activity-card { padding: 14px 16px 16px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.activity-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: var(--primary); }
.activity-head h3 { color: var(--foreground); font-size: 13px; font-weight: 600; }
.activity-count { padding: 0 7px; color: var(--muted-foreground); border-radius: 999px; background: var(--muted); font-size: 11px; font-weight: 600; }
.activity-add { display: grid; width: 26px; height: 26px; margin-left: auto; place-items: center; color: var(--primary); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); }
.activity-add:hover { background: var(--primary-soft); }
.activity-empty { color: var(--subtle-foreground); font-size: 12.5px; }
.attachment-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.attachment-list li { display: flex; align-items: center; gap: 8px; padding: 6px 8px; color: var(--subtle-foreground); border-radius: var(--radius-md); background: var(--surface-tint); }
.attachment-list a { min-width: 0; flex: 1; overflow: hidden; color: var(--info); font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
.attachment-list button { display: grid; width: 20px; height: 20px; place-items: center; color: var(--subtle-foreground); border: 0; border-radius: 5px; background: none; }
.attachment-list button:hover { color: var(--danger); background: var(--danger-soft); }
.comment-box { position: relative; margin-bottom: 14px; }
.comment-box textarea { height: auto; min-height: 60px; padding: 8px 40px 8px 10px; resize: vertical; line-height: 1.5; }
.comment-send { position: absolute; right: 6px; bottom: 8px; display: grid; width: 28px; height: 28px; place-items: center; color: #fff; border: 0; border-radius: var(--radius-md); background: var(--primary); }
.comment-send:disabled { opacity: .4; cursor: not-allowed; }
.timeline { position: relative; display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.timeline::before { position: absolute; top: 6px; bottom: 6px; left: 13px; width: 1px; content: ''; background: var(--border); }
.timeline-item { position: relative; display: flex; gap: 10px; }
.timeline-avatar { position: relative; width: 27px; height: 27px; font-size: 10px; }
.timeline-dot { position: relative; display: grid; width: 27px; height: 18px; flex: none; place-items: center; color: var(--subtle-foreground); }
.timeline-dot::before { position: absolute; width: 9px; height: 9px; content: ''; border: 2px solid var(--surface); border-radius: 50%; background: var(--border-strong); }
.timeline-item--version .timeline-dot::before { display: none; }
.timeline-item--version .timeline-dot { width: 27px; height: 22px; border-radius: 50%; background: var(--surface); }
.timeline-item--created .timeline-dot::before { background: var(--secondary); }
.timeline-item--email .timeline-dot::before { background: var(--accent); }
.timeline-copy { min-width: 0; flex: 1; }
.timeline-copy p { color: var(--muted-foreground); font-size: 12.5px; }
.timeline-copy strong { color: var(--foreground); font-weight: 600; }
.timeline-copy time { color: var(--subtle-foreground); font-size: 11.5px; }
.timeline-comment { margin: 4px 0 2px; padding: 8px 10px; color: var(--foreground); border: 1px solid var(--border); border-radius: 4px var(--radius-lg) var(--radius-lg); background: var(--surface-tint); font-size: 12.5px; overflow-wrap: anywhere; }
.timeline-comment :deep(p) { margin: 0; }
</style>
