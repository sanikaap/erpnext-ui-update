<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft, Ban, CheckCircle2, Clock3, Copy, Eye, EyeOff, FilePen, Mail, MoreHorizontal, Printer, RefreshCw, RotateCcw, Save, Send, Trash2, UserRound,
} from 'lucide-vue-next';
import DynamicForm from '@/components/forms/DynamicForm.vue';
import ActivityPanel from '@/components/document/ActivityPanel.vue';
import EmailDialog from '@/components/document/EmailDialog.vue';
import ErrorState from '@/components/feedback/ErrorState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import { useDocType } from '@/composables/useDocType';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import { documentApi } from '@/services/document-api';
import { hasDocTypePermission } from '@/services/metadata-api';
import { frappeErrorMessage, missingFieldsFromError } from '@/services/erpnext-api';
import { getDocumentRouteForDocType } from '@/config/navigation';
import { applyDynamicDefaults } from '@/lib/fetch-from';
import { documentStatus, monogram, monogramTone } from '@/lib/display';
import { collapsibleFieldnames, newDocument, relativeTime, formatDate, validateDocument, type ValidationError } from '@/lib/doctype';
import type { FrappeDocument } from '@/types/erp';

/**
 * The universal document page: the same component renders a new Item, a draft
 * Sales Order or a submitted Journal Entry. Layout, fields and child tables come
 * from metadata; the available actions come from docstatus and Frappe permissions.
 */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();
const { context: defaultsContext, ready: defaultsReady } = useSessionDefaults();
const { user } = useCurrentUser();

const doctype = computed(() => String(route.params.doctype || ''));
const name = computed(() => (route.params.name ? String(route.params.name) : undefined));
const isNew = computed(() => !name.value);

const {
  meta, metadata, childFields, document, docinfo, permissions, isSubmittable, titleField, loading, error, errorKind, load, reloadDocument,
} = useDocType(doctype, name);

const form = ref<Record<string, unknown>>({});
const snapshot = ref('');
const errors = ref<ValidationError[]>([]);
const busy = ref<string | null>(null);
const hideEmpty = ref(false);
const emailOpen = ref(false);
const moreOpen = ref(false);
const canCreate = ref(false);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const serialize = (value: Record<string, unknown>) => JSON.stringify(value, (key, item) => (key === '__key' ? undefined : item));

function adopt(doc: FrappeDocument) {
  form.value = clone(doc);
  snapshot.value = serialize(form.value);
  errors.value = [];
}

// Existing documents: copy the loaded document into an editable buffer.
watch(document, (doc) => { if (doc) adopt(doc); });

// New documents: defaults from metadata, plus any values passed in the query (?customer=…).
watch([metadata, isNew], async () => {
  if (!isNew.value || !metadata.value.length) return;
  await defaultsReady;
  const draft = newDocument(doctype.value, metadata.value, defaultsContext());
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && metadata.value.some((field) => field.fieldname === key)) draft[key] = value;
  }
  await applyDynamicDefaults(draft, metadata.value);
  adopt(draft);
  canCreate.value = await hasDocTypePermission(doctype.value, 'create');
}, { immediate: true });

const docstatus = computed(() => Number(form.value.docstatus ?? 0));
const dirty = computed(() => Boolean(snapshot.value) && serialize(form.value) !== snapshot.value);
const can = (perm: keyof typeof permissions.value) => Boolean(permissions.value[perm]);

const editable = computed(() => (isNew.value ? canCreate.value : can('write') && docstatus.value === 0));
const showSubmit = computed(() => !isNew.value && isSubmittable.value && docstatus.value === 0 && can('submit'));
const showCancel = computed(() => !isNew.value && docstatus.value === 1 && can('cancel'));
const showAmend = computed(() => !isNew.value && docstatus.value === 2 && can('amend') && !docinfo.value.is_document_amended);
const showDelete = computed(() => !isNew.value && docstatus.value !== 1 && can('delete') && !meta.value?.issingle);
const showPrint = computed(() => !isNew.value && can('print'));
const showEmail = computed(() => !isNew.value && can('email'));
const showDuplicate = computed(() => !isNew.value && !meta.value?.issingle && !docinfo.value.is_static);

const status = computed(() => (isNew.value ? { label: 'Not saved', tone: 'amber' as const } : documentStatus(form.value, { submittable: isSubmittable.value })));
const title = computed(() => {
  if (isNew.value) return `New ${doctype.value}`;
  const fromTitle = titleField.value ? form.value[titleField.value] : undefined;
  return typeof fromTitle === 'string' && fromTitle ? fromTitle : name.value || '';
});
const listRoute = computed(() => getDocumentRouteForDocType(doctype.value));
const readOnlyNotice = computed(() => {
  if (docinfo.value.is_static) return 'Demo record from the NGO Impact Console dataset (illustrative figures). It is read-only until the NGO app is installed in ERPNext.';
  if (isNew.value && !loading.value && !canCreate.value && metadata.value.length) return `You don’t have permission to create ${doctype.value} records.`;
  if (!isNew.value && docstatus.value === 1) return 'This document is submitted. Cancel it to make changes, then amend the cancelled copy.';
  if (!isNew.value && docstatus.value === 2) return 'This document is cancelled. Amend it to create an editable copy.';
  if (!isNew.value && !can('write') && document.value) return 'You can view this document but not edit it.';
  return null;
});

function payload() {
  const doc = clone(form.value);
  doc.doctype = doctype.value;
  for (const value of Object.values(doc)) {
    if (Array.isArray(value)) value.forEach((row) => { if (row && typeof row === 'object') delete (row as Record<string, unknown>).__key; });
  }
  return doc;
}

/**
 * ERPNext decides what is missing: many required values (price list, exchange rate,
 * item name, UOM…) are filled server-side on save. When it reports a MandatoryError,
 * highlight those fields, using the client check to locate child-table rows.
 */
function markServerErrors(cause: unknown) {
  const missing = missingFieldsFromError(cause);
  if (!missing.length) return;
  const reported = new Set(missing);
  const located = clientErrors.value.filter((item) => reported.has(item.fieldname));
  const unlocated = missing
    .filter((fieldname) => !located.some((item) => item.fieldname === fieldname))
    .map((fieldname) => ({ fieldname, label: metadata.value.find((field) => field.fieldname === fieldname)?.label || fieldname }));
  errors.value = [...located, ...unlocated];
}

/** Runs a server action with busy state and toasts. `ok` is explicit because some calls resolve to nothing. */
async function run<T>(action: string, task: () => Promise<T>, success?: string): Promise<{ ok: true; result: T } | { ok: false }> {
  busy.value = action;
  try {
    const result = await task();
    if (success) toast.success(success);
    return { ok: true, result };
  } catch (cause) {
    markServerErrors(cause);
    toast.error(`${action} failed`, frappeErrorMessage(cause));
    return { ok: false };
  } finally {
    busy.value = null;
  }
}

/**
 * Mandatory check from metadata. Required fields in regular sections block the save
 * with a clear message; fields in collapsible sections and child-row gaps are left to
 * ERPNext, which fills many of them (price list, exchange rate, item name, UOM…) on save.
 */
const clientErrors = ref<ValidationError[]>([]);
function validate() {
  clientErrors.value = validateDocument(form.value, metadata.value, childFields.value, { user: user.value?.id });
  const deferred = collapsibleFieldnames(metadata.value);
  const blocking = clientErrors.value.filter((item) => !item.table && !deferred.has(item.fieldname));
  errors.value = blocking;
  if (blocking.length) {
    toast.error('Required fields are empty', blocking.slice(0, 4).map((item) => item.label).join(', ') + (blocking.length > 4 ? ` and ${blocking.length - 4} more` : ''));
    return false;
  }
  return true;
}

async function save() {
  if (!editable.value || busy.value || !validate()) return;
  const outcome = await run('Save', () => documentApi.save<FrappeDocument>(payload()), isNew.value ? `${doctype.value} created` : 'Changes saved');
  if (!outcome.ok) return;
  const saved = outcome.result;
  snapshot.value = '';
  if (isNew.value || saved.name !== name.value) {
    await router.replace({ name: 'document-detail', params: { doctype: doctype.value, name: saved.name } });
  } else {
    adopt(saved);
    void reloadDocument();
  }
}

async function submit() {
  if (dirty.value) {
    await save();
    if (dirty.value) return;
  }
  if (!(await confirm({ title: `Submit ${name.value}?`, message: 'Submitted documents are final: they can only be cancelled and amended afterwards.', confirmLabel: 'Submit', tone: 'secondary' }))) return;
  const outcome = await run('Submit', () => documentApi.submit<FrappeDocument>(payload()), `${name.value} submitted`);
  if (outcome.ok) { adopt(outcome.result); void reloadDocument(); }
}

async function cancelDocument() {
  if (!(await confirm({ title: `Cancel ${name.value}?`, message: 'ERPNext will reverse the ledger and stock entries created by this document.', confirmLabel: 'Cancel document', tone: 'danger' }))) return;
  const outcome = await run('Cancel', () => documentApi.cancel(doctype.value, name.value!), `${name.value} cancelled`);
  if (outcome.ok) await reloadDocument();
}

async function amend() {
  const outcome = await run('Amend', () => documentApi.amend<FrappeDocument>(form.value as FrappeDocument), 'Amended draft created');
  if (outcome.ok) await router.push({ name: 'document-detail', params: { doctype: doctype.value, name: outcome.result.name } });
}

async function remove() {
  if (!(await confirm({ title: `Delete ${name.value}?`, message: 'This permanently deletes the record from ERPNext.', confirmLabel: 'Delete', tone: 'danger' }))) return;
  const outcome = await run('Delete', () => documentApi.delete(doctype.value, name.value!), `${name.value} deleted`);
  if (outcome.ok) {
    snapshot.value = '';
    await router.push(listRoute.value);
  }
}

async function discard() {
  if (!(await confirm({ title: 'Discard changes?', message: 'Your unsaved edits will be lost.', confirmLabel: 'Discard', tone: 'danger' }))) return;
  if (document.value) adopt(document.value);
}

function duplicate() {
  // Open a new form pre-filled with this document's values (Desk's "Duplicate").
  const copy: Record<string, string> = {};
  for (const field of metadata.value) {
    const value = form.value[field.fieldname];
    if (typeof value === 'string' && value && !field.read_only && field.fieldtype !== 'Table') copy[field.fieldname] = value;
  }
  void router.push({ name: 'document-create', params: { doctype: doctype.value }, query: copy });
}

function print() {
  window.open(documentApi.printUrl(doctype.value, name.value!), '_blank', 'noopener');
}

const emailRecipient = computed(() => {
  for (const key of ['contact_email', 'email_id', 'email', 'customer_email', 'supplier_email']) {
    if (typeof form.value[key] === 'string' && form.value[key]) return form.value[key] as string;
  }
  return '';
});

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (editable.value && (dirty.value || isNew.value)) void save();
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

onBeforeRouteLeave(async () => {
  if (!dirty.value || busy.value) return true;
  return confirm({ title: 'Leave without saving?', message: 'You have unsaved changes on this document.', confirmLabel: 'Leave', tone: 'danger' });
});

// Keep sticky tabs below the sticky document header.
const header = ref<HTMLElement | null>(null);
const headerHeight = ref(0);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(() => { headerHeight.value = header.value?.offsetHeight ?? 0; });
  if (header.value) observer.observe(header.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="page document-page" :style="{ '--form-sticky-offset': `${headerHeight + 8}px` }">
    <ErrorState v-if="error && !loading" :kind="errorKind" :message="error" class="document-error" @retry="load" />

    <template v-else>
      <header ref="header" class="doc-header">
        <RouterLink :to="listRoute" class="back-link"><ArrowLeft :size="14" />{{ doctype }} list</RouterLink>
        <div class="doc-identity">
          <span v-if="!isNew" :class="['monogram monogram--lg', `tone-${monogramTone(name || '')}`]" aria-hidden="true">{{ monogram(title) }}</span>
          <span v-else class="doc-new-mark" aria-hidden="true"><FilePen :size="20" /></span>
          <div class="doc-titles">
            <div class="doc-title-row">
              <h1 class="page-title">
                <span v-if="loading && !form.doctype" class="skeleton" style="width: 220px; height: 22px" />
                <template v-else>{{ title }}</template>
              </h1>
              <BaseBadge v-if="status" :tone="status.tone" :label="status.label" size="md" />
              <span v-if="dirty && !isNew" class="dirty-pill">Unsaved changes</span>
            </div>
            <p class="doc-meta">
              <span v-if="!isNew && title !== name" class="mono doc-name">{{ name }}</span>
              <span v-if="form.modified"><Clock3 :size="12" />Updated {{ relativeTime(form.modified) }}</span>
              <span v-if="form.owner"><UserRound :size="12" />{{ String(form.owner).split('@')[0] }}</span>
              <span v-if="isNew">{{ doctype }} · fields from live ERPNext metadata</span>
            </p>
          </div>

          <div class="doc-actions">
            <BaseButton v-if="dirty && !isNew" variant="ghost" size="sm" @click="discard"><RotateCcw :size="14" />Discard</BaseButton>
            <div v-if="!isNew && document" class="more">
              <BaseButton variant="quiet" size="sm" aria-label="More actions" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen"><MoreHorizontal :size="15" /></BaseButton>
              <Transition name="pop">
                <div v-if="moreOpen" class="more-menu" role="menu" @click="moreOpen = false">
                  <button v-if="showPrint" type="button" role="menuitem" @click="print"><Printer :size="14" />Print / PDF</button>
                  <button v-if="showEmail" type="button" role="menuitem" @click="emailOpen = true"><Mail :size="14" />Email</button>
                  <button v-if="showDuplicate" type="button" role="menuitem" @click="duplicate"><Copy :size="14" />Duplicate</button>
                  <button type="button" role="menuitem" @click="load"><RefreshCw :size="14" />Reload</button>
                  <button type="button" role="menuitem" @click="hideEmpty = !hideEmpty"><component :is="hideEmpty ? Eye : EyeOff" :size="14" />{{ hideEmpty ? 'Show empty fields' : 'Hide empty fields' }}</button>
                  <button v-if="showDelete" type="button" role="menuitem" class="danger" @click="remove"><Trash2 :size="14" />Delete</button>
                </div>
              </Transition>
              <div v-if="moreOpen" class="more-scrim" @click="moreOpen = false" />
            </div>
            <BaseButton v-if="showCancel" variant="danger" size="sm" :loading="busy === 'Cancel'" @click="cancelDocument"><Ban :size="14" />Cancel</BaseButton>
            <BaseButton v-if="showAmend" variant="outline" size="sm" :loading="busy === 'Amend'" @click="amend"><FilePen :size="14" />Amend</BaseButton>
            <BaseButton v-if="editable && (dirty || isNew)" variant="primary" size="sm" :loading="busy === 'Save'" @click="save"><Save :size="14" />{{ isNew ? `Create ${doctype}` : 'Save' }}</BaseButton>
            <BaseButton v-else-if="showSubmit" variant="secondary" size="sm" :loading="busy === 'Submit'" @click="submit"><Send :size="14" />Submit</BaseButton>
            <span v-else-if="!isNew && docstatus === 1" class="doc-final"><CheckCircle2 :size="14" />Submitted</span>
          </div>
        </div>
        <p v-if="readOnlyNotice" class="doc-notice">{{ readOnlyNotice }}</p>
        <p v-if="errors.length" class="doc-errors" role="alert">
          <strong>{{ errors.length }} required {{ errors.length === 1 ? 'field is' : 'fields are' }} empty:</strong>
          {{ errors.slice(0, 6).map((item) => item.table ? `${item.label} (${item.tableLabel} row ${item.row})` : item.label).join(', ') }}{{ errors.length > 6 ? '…' : '' }}
        </p>
      </header>

      <div v-if="loading && !metadata.length" class="doc-skeleton" aria-busy="true">
        <div v-for="section in 3" :key="section" class="skeleton-section">
          <span class="skeleton" style="width: 140px; height: 12px" />
          <div class="skeleton-grid"><div v-for="index in 6" :key="index"><span class="skeleton" style="width: 40%; height: 9px" /><span class="skeleton" style="height: 34px; margin-top: 8px; border-radius: 8px" /></div></div>
        </div>
      </div>

      <div v-else-if="form.doctype || !isNew" :class="['doc-layout', { 'doc-layout--single': isNew || docinfo.is_static }]">
        <form class="doc-main" @submit.prevent="save">
          <DynamicForm
            :doctype="doctype"
            :fields="metadata"
            :child-fields="childFields"
            :doc="form"
            :docname="name"
            :read-only="!editable"
            :hide-empty="hideEmpty && !editable"
            :errors="errors"
          />
        </form>
        <ActivityPanel
          v-if="!isNew && document && !docinfo.is_static"
          :doctype="doctype"
          :name="name!"
          :doc="form"
          :docinfo="docinfo"
          :can-write="can('write')"
          class="doc-aside"
          @refresh="reloadDocument"
        />
      </div>

      <div v-if="editable && (dirty || isNew)" class="save-bar" role="region" aria-label="Unsaved changes">
        <span class="save-hint"><span class="save-dot" />{{ isNew ? `New ${doctype}` : 'Unsaved changes' }} · <kbd>Ctrl</kbd> <kbd>S</kbd> to save</span>
        <div class="page-actions">
          <BaseButton v-if="!isNew" variant="ghost" size="sm" @click="discard">Discard</BaseButton>
          <BaseButton v-else variant="ghost" size="sm" @click="router.back()">Cancel</BaseButton>
          <BaseButton variant="primary" size="sm" :loading="busy === 'Save'" @click="save"><Save :size="14" />{{ isNew ? 'Create' : 'Save changes' }}</BaseButton>
        </div>
      </div>
    </template>

    <EmailDialog v-if="!isNew" :open="emailOpen" :doctype="doctype" :name="name || ''" :default-recipient="emailRecipient" @close="emailOpen = false" @sent="reloadDocument" />
  </div>
</template>

<style scoped>
.document-page { gap: 14px; }
.document-error { border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }

.doc-header { position: sticky; z-index: 8; top: var(--topbar-height); display: flex; flex-direction: column; gap: 10px; margin: -6px -28px 0; padding: 10px 28px 12px; background: color-mix(in srgb, var(--background) 97%, transparent); backdrop-filter: blur(10px); }
.doc-identity { display: flex; align-items: center; gap: 14px; }
.doc-new-mark { display: grid; width: 48px; height: 48px; flex: none; place-items: center; color: #fff; border-radius: var(--radius-lg); background: var(--primary-gradient); box-shadow: var(--shadow-primary); }
.doc-titles { min-width: 0; flex: 1; }
.doc-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.doc-title-row .page-title { margin: 0; }
.dirty-pill { padding: 2px 9px; color: var(--warning); border: 1px dashed color-mix(in srgb, var(--warning) 45%, transparent); border-radius: 999px; font-size: 11.5px; font-weight: 600; }
.doc-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 4px; color: var(--muted-foreground); font-size: 12px; }
.doc-meta span { display: inline-flex; align-items: center; gap: 5px; }
.doc-meta svg { color: var(--subtle-foreground); }
.doc-name { padding: 0 6px; color: var(--primary-soft-foreground); border-radius: 5px; background: var(--primary-soft); font-size: 11.5px; }
.doc-actions { display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.doc-final { display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; height: 32px; color: var(--secondary-soft-foreground); border-radius: var(--radius-md); background: var(--secondary-soft); font-size: 12.5px; font-weight: 600; }
.doc-notice { padding: 8px 12px; color: var(--info); border: 1px solid color-mix(in srgb, var(--info) 20%, transparent); border-radius: var(--radius-md); background: var(--info-soft); font-size: 12.5px; }
.doc-errors { padding: 8px 12px; color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent); border-radius: var(--radius-md); background: var(--danger-soft); font-size: 12.5px; }

.more { position: relative; }
.more-scrim { position: fixed; z-index: 19; inset: 0; }
.more-menu { position: absolute; z-index: 20; top: calc(100% + 6px); right: 0; display: flex; min-width: 200px; flex-direction: column; padding: 5px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-elevated); box-shadow: var(--shadow-lg); }
.more-menu button { display: flex; align-items: center; gap: 9px; height: 34px; padding: 0 10px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; font-size: 13px; text-align: left; }
.more-menu button svg { color: var(--subtle-foreground); }
.more-menu button:hover { background: var(--primary-soft); }
.more-menu button:hover svg { color: var(--primary); }
.more-menu .danger { color: var(--danger); }
.more-menu .danger svg { color: var(--danger); }
.more-menu .danger:hover { background: var(--danger-soft); }

.doc-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: start; gap: 18px; }
.doc-layout--single { grid-template-columns: minmax(0, 1fr); }
.doc-main { min-width: 0; }
.doc-aside { position: sticky; top: calc(var(--topbar-height) + var(--form-sticky-offset, 0px)); max-height: calc(100dvh - var(--topbar-height) - var(--form-sticky-offset, 0px) - 16px); overflow-y: auto; }

.doc-skeleton { display: flex; flex-direction: column; gap: 14px; }
.skeleton-section { display: flex; flex-direction: column; gap: 16px; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }

.save-bar { position: sticky; z-index: 9; bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px 10px 18px; border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border)); border-radius: var(--radius-xl); background: color-mix(in srgb, var(--surface-elevated) 94%, transparent); backdrop-filter: blur(10px); box-shadow: var(--shadow-lg); animation: stagger-in .2s var(--ease) both; }
.save-hint { display: flex; align-items: center; gap: 8px; color: var(--muted-foreground); font-size: 12.5px; }
.save-hint kbd { padding: 1px 5px; border: 1px solid var(--border); border-radius: 4px; background: var(--muted); font: 500 11px var(--font-sans); }
.save-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--warning); box-shadow: 0 0 0 3px var(--warning-soft); }

@media (max-width: 1200px) {
  .doc-layout { grid-template-columns: minmax(0, 1fr); }
  .doc-aside { position: static; max-height: none; }
}
@media (max-width: 900px) { .doc-header { margin: -4px -16px 0; padding: 8px 16px 10px; } }
@media (max-width: 760px) {
  .doc-identity { flex-wrap: wrap; }
  .doc-actions { width: 100%; justify-content: flex-start; }
  .doc-header { position: static; }
  .save-hint { display: none; }
  .save-bar .page-actions { width: 100%; justify-content: flex-end; }
}
</style>
