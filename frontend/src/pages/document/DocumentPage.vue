<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
  Ban, Bell, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDot, ClipboardCopy, Coins, Copy, Eye, EyeOff, FilePen, FilePlus, FileText, Hash, Link2, ListChecks, LocateFixed, Mail, MoreHorizontal, PanelRight, Printer, Redo2, RefreshCw, Repeat, RotateCcw, Save, Send, Settings2, Trash2, Undo2, UserRound,
} from 'lucide-vue-next';
import DynamicForm from '@/components/forms/DynamicForm.vue';
import ActivityPanel from '@/components/document/ActivityPanel.vue';
import EmailDialog from '@/components/document/EmailDialog.vue';
import ConnectionsPanel from '@/components/document/ConnectionsPanel.vue';
import FormActionBar from '@/components/document/FormActionBar.vue';
import DocMetaCard from '@/components/document/DocMetaCard.vue';
import { FORM_BINDING, type FormBinding } from '@/desk/binding';
import { FormController, type FormButton } from '@/desk/form';
import { createMandatoryChildren, ensureDeskRuntime, indexDoc } from '@/desk/runtime';
import { sanitizeHtml } from '@/lib/sanitize';
import { erpnextApi } from '@/services/erpnext-api';
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
import { documentStatus } from '@/lib/display';
import { collapsibleFieldnames, fieldState, formatValue, isTruthyValue, newDocument, NO_VALUE_TYPES, relativeTime, formatDate, stripHtml, TABLE_TYPES, validateDocument, type ValidationError } from '@/lib/doctype';
import type { ERPNextMetadataField } from '@/types/erp';
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

const form = ref<Record<string, any>>({});
const dirtyFlag = ref(false);
const win = window as any;
const errors = ref<ValidationError[]>([]);
const busy = ref<string | null>(null);
const hideEmpty = ref(false);
const emailOpen = ref(false);
const moreOpen = ref(false);
const canCreate = ref(false);
const asideHidden = ref(false);
const formRef = ref<InstanceType<typeof DynamicForm> | null>(null);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function adopt(doc: FrappeDocument) {
  form.value = clone(doc);
  dirtyFlag.value = Boolean((doc as Record<string, unknown>).__unsaved) && !isNew.value;
  errors.value = [];
}

// ---------- Form scripts: the DocType's own client code runs against this page ----------
const frm = shallowRef<FormController | null>(null);
const emptyUi = reactive({ buttons: [] as FormButton[], primaryGroup: null as string | null, menu: [] as FormButton[], primaryAction: null as FormButton | null, secondaryAction: null as FormButton | null, indicator: null as { label: string; color: string } | null, intro: null as { html: string; color: string } | null, headline: null as { html: string; color: string } | null, comments: [] as { html: string; color: string }[], progress: [] as { title: string; percent: number; message?: string }[], badges: [] as { label: string; color: string }[], saveDisabled: false, readOnly: false, transactionsExtra: [] as { label: string; items: string[] }[] });
const ui = computed(() => frm.value?.ui ?? emptyUi);
const binding = new Proxy({} as FormBinding, {
  get(_target, key: keyof FormBinding) {
    const current = frm.value;
    if (current) { const member = current[key]; return typeof member === 'function' ? (member as (...args: unknown[]) => unknown).bind(current) : member; }
    if (key === 'htmlFilled') return {};
    if (key === 'gridFlags') return () => ({ cannotAdd: false, cannotDelete: false });
    if (key === 'linkArgs' || key === 'htmlWrapper') return () => undefined;
    return () => { dirtyFlag.value = true; };
  },
});
provide(FORM_BINDING, binding);

const host = {
  doc: () => form.value,
  docinfo: () => docinfo.value,
  permissions: () => permissions.value,
  setDirty: (value: boolean) => { dirtyFlag.value = value; },
  isDirty: () => dirtyFlag.value,
  save: (action?: string) => (action === 'Submit' ? submit() : save(action === 'Update' ? 'Update' : 'Save')),
  cancel: () => cancelDocument(),
  amend: () => amend(),
  reload: () => reloadFromServer(),
  print: () => print(),
  email: () => { emailOpen.value = true; },
};

/** Runs setup/onload/refresh for the document now in the buffer. */
async function runFormScripts() {
  if (!meta.value || meta.value.name !== doctype.value) return;
  if (frm.value?.doctype !== doctype.value) frm.value = new FormController(meta.value, metadata.value, childFields.value, host);
  await frm.value.documentLoaded();
  // Values passed along with a route to a saved or single document, as Desk applies them.
  const routeOptions = isNew.value ? null : win.frappe?.route_options;
  if (routeOptions) {
    win.frappe.route_options = null;
    for (const [fieldname, value] of Object.entries(routeOptions)) if (metadata.value.some((field) => field.fieldname === fieldname)) void frm.value.set_value(fieldname, value);
  }
  void loadWorkflow();
}

// ---------- Workflow ----------
const workflow = computed(() => (meta.value?.__workflow_docs ?? []).find((entry) => entry.is_active !== 0) ?? null);
const workflowActions = ref<FormButton[]>([]);
async function loadWorkflow() {
  workflowActions.value = [];
  if (!workflow.value || isNew.value || dirtyFlag.value) return;
  try {
    const response = await erpnextApi.callPost<Array<{ action: string; next_state: string }>>('frappe.model.workflow.get_transitions', { doc: payload() });
    workflowActions.value = (response.message ?? []).map((transition) => ({ label: transition.action, fn: () => applyWorkflow(transition.action) }));
  } catch (cause) {
    console.error('[desk] workflow transitions', cause);
  }
}
async function applyWorkflow(action: string) {
  const outcome = await run(action, () => erpnextApi.callPost<FrappeDocument>('frappe.model.workflow.apply_workflow', { doc: payload(), action }), `${action}: done`);
  if (outcome.ok) await reloadFromServer();
}

// Existing documents: copy the loaded document into an editable buffer.
watch(document, (doc) => { if (doc) { adopt(doc); void runFormScripts(); } });

// New documents: defaults from metadata, plus any values passed in the query (?customer=…).
watch([metadata, isNew], async () => {
  if (!isNew.value || !metadata.value.length) return;
  await defaultsReady;
  canCreate.value = await hasDocTypePermission(doctype.value, 'create');
  // Mapped, duplicated and amended documents arrive as unsaved local documents.
  await ensureDeskRuntime().catch(() => undefined);
  const localName = typeof route.query.__local === 'string' ? route.query.__local : '';
  const local = localName ? win.locals?.[doctype.value]?.[localName] : undefined;
  if (local) {
    form.value = clone(local);
    win.locals[doctype.value][localName] = form.value;
    errors.value = [];
    dirtyFlag.value = true;
    await runFormScripts();
    return;
  }
  const draft: Record<string, any> = newDocument(doctype.value, metadata.value, defaultsContext());
  draft.name = `new-${doctype.value.toLowerCase().replace(/ /g, '-')}-${Math.random().toString(36).slice(2, 12)}`;
  draft.__unsaved = 1;
  const options = { ...(win.frappe?.route_options ?? {}) };
  if (win.frappe) win.frappe.route_options = null;
  for (const [key, value] of [...Object.entries(route.query), ...Object.entries(options)]) {
    if (value !== undefined && metadata.value.some((field) => field.fieldname === key)) draft[key] = value;
  }
  await applyDynamicDefaults(draft, metadata.value);
  if (win.frappe) createMandatoryChildren(draft);
  adopt(draft as FrappeDocument);
  dirtyFlag.value = false;
  indexDoc(form.value);
  await runFormScripts();
}, { immediate: true });

watch(doctype, async (current) => { canCreate.value = await hasDocTypePermission(current, 'create'); }, { immediate: true });

const docstatus = computed(() => Number(form.value.docstatus ?? 0));
const dirty = computed(() => dirtyFlag.value);
const can = (perm: keyof typeof permissions.value) => Boolean(permissions.value[perm]);

const hasWorkflow = computed(() => Boolean(workflow.value));
/** Submitted documents can still change their "Allow on Submit" fields (saved as an Update). */
const hasAllowOnSubmit = computed(() => metadata.value.some((field) => field.allow_on_submit) || Object.values(childFields.value).some((fields) => fields.some((field) => field.allow_on_submit)));
const updatable = computed(() => !isNew.value && docstatus.value === 1 && can('write') && hasAllowOnSubmit.value);
const editable = computed(() => !ui.value.readOnly && (isNew.value ? canCreate.value : can('write') && (docstatus.value === 0 || updatable.value)));
const showSubmit = computed(() => !isNew.value && isSubmittable.value && docstatus.value === 0 && can('submit') && !hasWorkflow.value);
const showCancel = computed(() => !isNew.value && docstatus.value === 1 && can('cancel') && !hasWorkflow.value);
const showSave = computed(() => editable.value && !ui.value.saveDisabled && !ui.value.primaryAction && (docstatus.value === 0 || dirty.value));
const showRename = computed(() => !isNew.value && Boolean(meta.value?.allow_rename) && can('write') && !docinfo.value.is_static);
const showAmend = computed(() => !isNew.value && docstatus.value === 2 && can('amend') && !docinfo.value.is_document_amended);
const showDelete = computed(() => !isNew.value && docstatus.value !== 1 && can('delete') && !meta.value?.issingle);
const showPrint = computed(() => !isNew.value && can('print'));
const showEmail = computed(() => !isNew.value && can('email') && docstatus.value < 2);
const showDuplicate = computed(() => !isNew.value && canCreate.value && !meta.value?.issingle && !(meta.value as { allow_copy?: number } | null)?.allow_copy && !docinfo.value.is_static);
const showRepeat = computed(() => !isNew.value && Boolean((meta.value as { allow_auto_repeat?: number } | null)?.allow_auto_repeat) && !form.value.auto_repeat);
const showCustomize = computed(() => !meta.value?.issingle && Boolean(win.frappe?.user_roles?.includes?.('System Manager') ?? user.value?.id === 'Administrator'));
const canNavigate = computed(() => !isNew.value && !meta.value?.issingle && !docinfo.value.is_static);

const INDICATOR_TONES: Record<string, 'green' | 'blue' | 'amber' | 'rose' | 'slate' | 'cyan' | 'violet'> = { green: 'green', blue: 'blue', orange: 'amber', yellow: 'amber', red: 'rose', gray: 'slate', grey: 'slate', darkgrey: 'slate', cyan: 'cyan', purple: 'violet', pink: 'rose', lightblue: 'blue' };
const status = computed(() => {
  if (isNew.value) return { label: 'Not saved', tone: 'amber' as const };
  const scripted = ui.value.indicator;
  if (scripted) return { label: scripted.label, tone: INDICATOR_TONES[scripted.color] ?? 'slate' };
  const workflowState = workflow.value?.workflow_state_field ? form.value[workflow.value.workflow_state_field] : undefined;
  if (typeof workflowState === 'string' && workflowState) return { label: workflowState, tone: 'blue' as const };
  return documentStatus(form.value, { submittable: isSubmittable.value });
});
const title = computed(() => {
  if (isNew.value) return `New ${doctype.value}`;
  const fromTitle = titleField.value ? form.value[titleField.value] : undefined;
  if (typeof fromTitle !== 'string' || !fromTitle) return name.value || '';
  // Title fields may be templates such as "{customer_name}", filled from the document.
  return fromTitle.replace(/\{(\w+)\}/g, (match, fieldname) => (form.value[fieldname] !== undefined && form.value[fieldname] !== null ? String(form.value[fieldname]) : match));
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

/** Subtitle: the DocType's own description from metadata, otherwise a neutral line. */
const subtitle = computed(() => {
  const description = stripHtml(String((meta.value as { description?: string } | null)?.description ?? '')).trim();
  if (description) return description;
  return isNew.value ? `Fill in the details below to create a new ${doctype.value.toLowerCase()}.` : '';
});
const showTitleLine = computed(() => !isNew.value && title.value && title.value !== name.value);

// ---------- Summary strip: key facts from the DocType's own list-view fields ----------
const PARTY_LINKS = new Set(['Customer', 'Supplier', 'Employee', 'Lead', 'Contact', 'User', 'Student', 'Patient', 'Member']);
function factIcon(field: ERPNextMetadataField) {
  if (field.fieldtype === 'Link') return field.options === 'Company' ? Building2 : PARTY_LINKS.has(field.options || '') ? UserRound : Link2;
  if (field.fieldtype === 'Currency') return Coins;
  if (['Int', 'Float', 'Percent'].includes(field.fieldtype)) return Hash;
  if (['Date', 'Datetime'].includes(field.fieldtype)) return CalendarDays;
  return FileText;
}
const facts = computed(() => {
  if (isNew.value || !metadata.value.length) return [];
  const usable = (field: ERPNextMetadataField) => !NO_VALUE_TYPES.has(field.fieldtype) && !TABLE_TYPES.has(field.fieldtype) && !['status', 'naming_series', 'docstatus'].includes(field.fieldname)
    && !field.hidden && field.fieldtype !== 'Check' && field.fieldtype !== 'Text Editor' && isTruthyValue(form.value[field.fieldname])
    // Already in the header: the record's name and title.
    && form.value[field.fieldname] !== name.value && form.value[field.fieldname] !== title.value;
  // Who it is for, how much, when: party links first, then amounts, then dates.
  const rank = (field: ERPNextMetadataField) => {
    if (field.fieldtype === 'Link' && PARTY_LINKS.has(field.options || '')) return 0;
    if (field.fieldtype === 'Currency') return 1;
    if (['Date', 'Datetime'].includes(field.fieldtype)) return 2;
    if (field.in_list_view) return 3;
    return field.fieldtype === 'Link' && field.options !== 'Company' ? 4 : 5;
  };
  const candidates = metadata.value
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => (field.in_list_view || field.bold || field.reqd) && usable(field))
    .sort((a, b) => rank(a.field) - rank(b.field) || Number(!a.field.in_list_view) - Number(!b.field.in_list_view) || a.index - b.index);
  // One amount is enough (Grand Total, not also Rounded Total).
  const picked = candidates.filter(({ field }, position) => field.fieldtype !== 'Currency' || candidates.findIndex((entry) => entry.field.fieldtype === 'Currency') === position);
  return picked.slice(0, 3).map(({ field }) => ({
    field, label: field.label, icon: factIcon(field),
    value: formatValue(form.value[field.fieldname], field, form.value),
  }));
});

// ---------- Side panel ----------
/** Required, visible, editable fields of a new document, and whether each has a value yet. */
const requiredChecklist = computed(() => {
  if (!isNew.value) return [];
  return metadata.value
    .filter((field) => !NO_VALUE_TYPES.has(field.fieldtype))
    .map((field) => ({ field, state: fieldState(field, form.value, { context: { user: user.value?.id } }) }))
    .filter(({ state }) => state.visible && state.required && !state.readOnly)
    .map(({ field }) => {
      const value = form.value[field.fieldname];
      return { fieldname: field.fieldname, label: field.label, done: TABLE_TYPES.has(field.fieldtype) ? Array.isArray(value) && value.length > 0 : isTruthyValue(value) || value === 0 };
    });
});
const requiredDone = computed(() => requiredChecklist.value.filter((item) => item.done).length);
/** Lifecycle from docstatus (and creation/modified); no invented events. */
const lifecycle = computed(() => {
  if (isNew.value) return [];
  const created = { label: 'Created', detail: [formatDate(form.value.creation as string, true), String(form.value.owner || '').split('@')[0]].filter((part) => part && part !== '—').join(' · '), state: 'done' };
  if (!isSubmittable.value) {
    return [created, { label: 'Last updated', detail: [relativeTime(form.value.modified as string), String(form.value.modified_by || '').split('@')[0]].filter(Boolean).join(' · '), state: 'current' }];
  }
  const steps = [{ ...created, label: 'Draft' }, { label: 'Submitted', detail: docstatus.value >= 1 ? 'Final; cancel to change' : 'Not yet submitted', state: docstatus.value >= 1 ? 'done' : 'pending' }];
  if (docstatus.value === 2) steps.push({ label: 'Cancelled', detail: `Updated ${relativeTime(form.value.modified as string)}`, state: 'done' });
  const last = steps.reduce((index, step, position) => (step.state === 'done' ? position : index), 0);
  return steps.map((step, position) => ({ ...step, state: position === last ? 'current' : step.state }));
});
const showAside = computed(() => !docinfo.value.is_static && (isNew.value ? requiredChecklist.value.length >= 2 : Boolean(document.value)));

function payload() {
  const doc = clone(form.value);
  doc.doctype = doctype.value;
  if (isNew.value) doc.__islocal = 1;
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

/** Runs the form scripts' pre-save hooks; returns false if one of them stopped the save. */
async function runBeforeHooks(events: string[]) {
  if (!frm.value || !win.frappe) return true;
  win.frappe.validated = true;
  for (const event of events) {
    await frm.value.trigger(event);
    if (win.frappe.validated === false) return false;
  }
  return true;
}

async function reloadFromServer() {
  dirtyFlag.value = false;
  await reloadDocument();
}

async function save(action: 'Save' | 'Update' = 'Save') {
  if (!editable.value || busy.value) return;
  const saveAction = action === 'Save' && docstatus.value === 1 ? 'Update' : action;
  if (!(await runBeforeHooks(['validate', 'before_save']))) return;
  if (!validate()) return;
  const wasNew = isNew.value;
  const outcome = await run('Save', () => documentApi.saveDocs<FrappeDocument>(payload(), saveAction), wasNew ? `${doctype.value} created` : 'Saved');
  if (!outcome.ok) return;
  const saved = outcome.result;
  dirtyFlag.value = false;
  if (!saved) { await reloadFromServer(); return; }
  if (win.locals?.[doctype.value] && wasNew && form.value.name) delete win.locals[doctype.value][form.value.name];
  if (wasNew || saved.name !== name.value) {
    await router.replace({ name: 'document-detail', params: { doctype: doctype.value, name: saved.name } });
  } else {
    await reloadFromServer();
    void frm.value?.trigger('after_save');
  }
}

async function submit() {
  if (dirty.value) {
    await save();
    if (dirty.value) return;
  }
  if (!(await confirm({ title: `Submit ${name.value}?`, message: 'Submitted documents are final: they can only be cancelled and amended afterwards.', confirmLabel: 'Submit', tone: 'secondary' }))) return;
  if (!(await runBeforeHooks(['before_submit']))) return;
  const outcome = await run('Submit', () => documentApi.saveDocs<FrappeDocument>(payload(), 'Submit'), `${name.value} submitted`);
  if (!outcome.ok) return;
  dirtyFlag.value = false;
  await reloadFromServer();
  void frm.value?.trigger('on_submit');
}

async function cancelDocument() {
  if (!(await confirm({ title: `Cancel ${name.value}?`, message: 'ERPNext will reverse the ledger and stock entries created by this document.', confirmLabel: 'Cancel document', tone: 'danger' }))) return;
  if (!(await runBeforeHooks(['before_cancel']))) return;
  const outcome = await run('Cancel', () => documentApi.cancel(doctype.value, name.value!), `${name.value} cancelled`);
  if (!outcome.ok) return;
  await reloadFromServer();
  void frm.value?.trigger('after_cancel');
}

/** Desk's amend: an unsaved copy linked through amended_from, opened for review before saving. */
async function amend() {
  await ensureDeskRuntime();
  const copy = win.frappe.model.copy_doc(form.value, true);
  copy.amended_from = name.value;
  if (metadata.value.some((field) => field.fieldname === 'amendment_date')) copy.amendment_date = win.frappe.datetime.get_today();
  await win.frappe.set_route('Form', doctype.value, copy.name);
}

async function remove() {
  if (!(await confirm({ title: `Delete ${name.value}?`, message: 'This permanently deletes the record from ERPNext.', confirmLabel: 'Delete', tone: 'danger' }))) return;
  const outcome = await run('Delete', () => documentApi.delete(doctype.value, name.value!), `${name.value} deleted`);
  if (outcome.ok) {
    dirtyFlag.value = false;
    await router.push(listRoute.value);
  }
}

async function discard() {
  if (!(await confirm({ title: 'Discard changes?', message: 'Your unsaved edits will be lost.', confirmLabel: 'Discard', tone: 'danger' }))) return;
  if (document.value) { adopt(document.value); dirtyFlag.value = false; void runFormScripts(); }
}

/** Desk's Duplicate: the whole document including child rows, honouring "No Copy" fields. */
async function duplicate() {
  await ensureDeskRuntime();
  const copy = win.frappe.model.copy_doc(form.value);
  await win.frappe.set_route('Form', doctype.value, copy.name);
}

async function rename() {
  await ensureDeskRuntime();
  win.frappe.prompt([{ fieldname: 'name', fieldtype: 'Data', label: `New name for ${name.value}`, reqd: 1, default: name.value }], async (values: { name: string }) => {
    if (values.name === name.value) return;
    const outcome = await run('Rename', () => erpnextApi.callPost<string>('frappe.model.rename_doc.update_document_title', { doctype: doctype.value, docname: name.value, name: values.name, merge: 0 }), 'Renamed');
    if (outcome.ok) { dirtyFlag.value = false; await router.replace({ name: 'document-detail', params: { doctype: doctype.value, name: outcome.result.message } }); }
  }, 'Rename', 'Rename');
}

function print() {
  window.open(documentApi.printUrl(doctype.value, name.value!, meta.value?.default_print_format || 'Standard'), '_blank', 'noopener');
}

// ---------- The rest of Desk's form menu ----------
/** Previous / next record, by the same server call Desk uses. */
async function navigateRecords(previous: boolean) {
  const outcome = await run('Navigate', () => erpnextApi.call<string>('frappe.desk.form.utils.get_next', { doctype: doctype.value, value: name.value, prev: previous ? 1 : 0, filters: '[]', sort_field: 'creation', sort_order: 'desc' }));
  if (outcome.ok && outcome.result.message) await router.push({ name: 'document-detail', params: { doctype: doctype.value, name: outcome.result.message } });
}

const showDiscard = computed(() => !isNew.value && isSubmittable.value && docstatus.value === 0 && !hasWorkflow.value && can('write'));
/** Desk's "Discard": a draft that will not be submitted is closed rather than deleted. */
async function discardDocument() {
  if (!(await confirm({ title: `Discard ${name.value}?`, message: 'The draft is permanently closed and cannot be submitted afterwards.', confirmLabel: 'Discard', tone: 'danger' }))) return;
  const outcome = await run('Discard', () => erpnextApi.callPost('frappe.desk.form.save.discard', { doctype: doctype.value, name: name.value }), `${name.value} discarded`);
  if (outcome.ok) await reloadFromServer();
}

async function jumpToField() {
  await ensureDeskRuntime();
  const options = metadata.value
    .filter((field) => !['Section Break', 'Column Break', 'Tab Break', 'Fold', 'HTML'].includes(field.fieldtype) && field.label && fieldState(field, form.value, { context: { user: user.value?.id } }).visible)
    .map((field) => ({ label: field.label, value: field.fieldname }));
  win.frappe.prompt([{ fieldname: 'field', fieldtype: 'Select', label: 'Select Field', reqd: 1, options: [{ label: '', value: '' }, ...options] }], (values: { field: string }) => { void formRef.value?.jumpToField(values.field); }, 'Jump to field', 'Go');
}

/** Desk's "Show Links": every document that links to this one, from frappe.desk.form.linked_with. */
async function showLinks() {
  const outcome = await run('Show Links', () => erpnextApi.call<Record<string, { docs?: Array<{ name: string; title?: string; docstatus?: number }>; hidden_count?: number }>>('frappe.desk.form.linked_with.get', { doctype: doctype.value, docname: name.value }));
  if (!outcome.ok) return;
  await ensureDeskRuntime();
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] as string);
  const sections = Object.entries(outcome.result.message ?? {})
    .filter(([, entry]) => entry.docs?.length || entry.hidden_count)
    .map(([linked, entry]) => {
      const rows = (entry.docs ?? []).map((doc) => `<li><a href="/record/${encodeURIComponent(linked)}/${encodeURIComponent(doc.name)}">${escape(doc.name)}</a>${doc.title && doc.title !== doc.name ? ` · ${escape(doc.title)}` : ''}</li>`).join('');
      const hidden = entry.hidden_count ? `<li>${entry.hidden_count} restricted ${entry.hidden_count === 1 ? 'document' : 'documents'}</li>` : '';
      return `<p><strong>${escape(linked)}</strong></p><ul>${rows}${hidden}</ul>`;
    });
  win.frappe.msgprint({ title: 'Links', message: sections.length ? `<p>Documents linked with <strong>${escape(name.value)}</strong>:</p>${sections.join('')}` : 'Not linked to any record' });
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload()));
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Could not copy', 'The browser blocked clipboard access.');
  }
}

async function remindMe() {
  await ensureDeskRuntime();
  const inOneHour = new Date(Date.now() + 3600000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const fallback = `${inOneHour.getFullYear()}-${pad(inOneHour.getMonth() + 1)}-${pad(inOneHour.getDate())} ${pad(inOneHour.getHours())}:${pad(inOneHour.getMinutes())}:00`;
  win.frappe.prompt([
    { fieldname: 'remind_at', fieldtype: 'Datetime', label: 'Remind At', reqd: 1, default: fallback },
    { fieldname: 'description', fieldtype: 'Small Text', label: 'Description', reqd: 1, default: `Follow up on ${doctype.value} ${name.value}` },
  ], (values: { remind_at: string; description: string }) => {
    void run('Remind Me', () => erpnextApi.callPost('frappe.automation.doctype.reminder.reminder.create_new_reminder', { remind_at: values.remind_at, description: values.description, reminder_doctype: doctype.value, reminder_docname: name.value }), 'Reminder set');
  }, 'Remind Me', 'Create');
}

async function autoRepeat() {
  await ensureDeskRuntime();
  win.frappe.prompt([
    { fieldname: 'frequency', fieldtype: 'Select', label: 'Frequency', reqd: 1, options: 'Daily\nWeekly\nMonthly\nQuarterly\nHalf-yearly\nYearly', default: 'Monthly' },
    { fieldname: 'start_date', fieldtype: 'Date', label: 'Start Date', reqd: 1, default: win.frappe.datetime.get_today() },
    { fieldname: 'end_date', fieldtype: 'Date', label: 'End Date' },
  ], async (values: Record<string, string>) => {
    const outcome = await run('Repeat', () => erpnextApi.callPost('frappe.automation.doctype.auto_repeat.auto_repeat.make_auto_repeat', { doctype: doctype.value, docname: name.value, ...values }), 'Auto Repeat created for this document');
    if (outcome.ok) await reloadFromServer();
  }, 'Auto Repeat', 'Create');
}

async function customize() {
  await ensureDeskRuntime();
  // Customize Form's own script reads the DocType from route_options.
  win.frappe.route_options = { doc_type: doctype.value };
  await router.push({ name: 'document-detail', params: { doctype: 'Customize Form', name: 'Customize Form' } });
}

// Undo / redo: edits are snapshots of the buffer, kept for this page visit.
const undoStack = ref<string[]>([]);
const redoStack = ref<string[]>([]);
let lastSnapshot = '';
watch(form, (value) => {
  const next = JSON.stringify(value);
  if (next === lastSnapshot) return;
  if (lastSnapshot && dirtyFlag.value) { undoStack.value = [...undoStack.value.slice(-49), lastSnapshot]; redoStack.value = []; }
  lastSnapshot = next;
}, { deep: true });
watch(() => `${doctype.value}/${name.value}`, () => { undoStack.value = []; redoStack.value = []; lastSnapshot = ''; });
function restoreSnapshot(snapshot: string) {
  lastSnapshot = snapshot;
  form.value = JSON.parse(snapshot);
  if (win.frappe) indexDoc(form.value);
}
function undo() {
  const snapshot = undoStack.value[undoStack.value.length - 1];
  if (!snapshot) return;
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, lastSnapshot];
  restoreSnapshot(snapshot);
}
function redo() {
  const snapshot = redoStack.value[redoStack.value.length - 1];
  if (!snapshot) return;
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, lastSnapshot];
  restoreSnapshot(snapshot);
}

function runScriptAction(action: FormButton) {
  moreOpen.value = false;
  try { void action.fn(); } catch (cause) { console.error(`[desk] "${action.label}"`, cause); }
}

// ---------- Connections tab ----------
const connectionCount = ref<number | null>(null);
const dashboard = computed(() => meta.value?.__dashboard ?? null);
const hasConnections = computed(() => !isNew.value && Boolean(document.value) && !docinfo.value.is_static && !meta.value?.issingle && meta.value?.name === doctype.value
  && Boolean(dashboard.value && ((dashboard.value.transactions?.length ?? 0) + (dashboard.value.reports?.length ?? 0) + ui.value.transactionsExtra.length) > 0));
const extraTabs = computed(() => (hasConnections.value ? [{ key: 'connections', label: 'Connections', count: connectionCount.value }] : []));
watch(() => `${doctype.value}/${name.value}`, () => { connectionCount.value = null; });

const emailRecipient = computed(() => {
  for (const key of ['contact_email', 'email_id', 'email', 'customer_email', 'supplier_email']) {
    if (typeof form.value[key] === 'string' && form.value[key]) return form.value[key] as string;
  }
  return '';
});

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (editable.value && !ui.value.saveDisabled && (dirty.value || isNew.value)) void save();
  }
}
// Closing or reloading the tab with unsaved edits: the browser's own prompt.
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onMounted(() => { window.addEventListener('keydown', onKeydown); window.addEventListener('beforeunload', onBeforeUnload); });
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); window.removeEventListener('beforeunload', onBeforeUnload); });

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
        <div class="doc-identity">
          <div class="doc-titles">
            <div class="doc-title-row">
              <h1 class="page-title">
                <span v-if="loading && !form.doctype" class="skeleton" style="width: 220px; height: 26px" />
                <template v-else>{{ isNew ? `New ${doctype}` : doctype }}</template>
              </h1>
              <BaseBadge v-if="status" :tone="status.tone" :label="status.label" size="md" />
              <span v-if="dirty && !isNew" class="dirty-pill" role="status"><span class="save-dot" aria-hidden="true" />Unsaved changes</span>
            </div>
            <p v-if="!isNew && name" class="doc-name"><span class="doc-id">{{ name }}</span><template v-if="showTitleLine"><span class="doc-dot" aria-hidden="true">·</span><span class="doc-title-text">{{ title }}</span></template></p>
            <p v-if="subtitle" class="doc-subtitle">{{ subtitle }}</p>
          </div>

          <div class="doc-actions">
            <BaseButton v-if="dirty && !isNew" variant="ghost" size="md" @click="discard"><RotateCcw :size="15" />Discard</BaseButton>
            <FormActionBar :buttons="ui.buttons" :primary-group="ui.primaryGroup" :workflow-actions="workflowActions" />
            <BaseButton v-if="canNavigate" variant="quiet" size="md" class="icon-only" aria-label="Previous document" title="Previous document" @click="navigateRecords(true)"><ChevronLeft :size="16" /></BaseButton>
            <BaseButton v-if="canNavigate" variant="quiet" size="md" class="icon-only" aria-label="Next document" title="Next document" @click="navigateRecords(false)"><ChevronRight :size="16" /></BaseButton>
            <div v-if="!isNew && document" class="more">
              <BaseButton variant="quiet" size="md" class="icon-only" aria-label="More actions" title="More actions" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen"><MoreHorizontal :size="16" /></BaseButton>
              <Transition name="pop">
                <div v-if="moreOpen" class="menu-panel more-menu" role="menu" @click="moreOpen = false">
                  <button type="button" role="menuitem" class="menu-item" @click="asideHidden = !asideHidden"><PanelRight :size="14" />Toggle Sidebar</button>
                  <button v-if="showEmail" type="button" role="menuitem" class="menu-item" @click="emailOpen = true"><Mail :size="14" />Email</button>
                  <button v-if="showRename" type="button" role="menuitem" class="menu-item" @click="rename"><FilePen :size="14" />Rename</button>
                  <button type="button" role="menuitem" class="menu-item" @click="load"><RefreshCw :size="14" />Reload</button>
                  <button v-if="showDuplicate" type="button" role="menuitem" class="menu-item" @click="duplicate"><Copy :size="14" />Duplicate</button>
                  <button v-if="canCreate && !meta?.issingle" type="button" role="menuitem" class="menu-item" @click="router.push({ name: 'document-create', params: { doctype } })"><FilePlus :size="14" />New {{ doctype }}</button>
                  <button type="button" role="menuitem" class="menu-item" @click="jumpToField"><LocateFixed :size="14" />Jump to field</button>
                  <button v-if="!meta?.issingle" type="button" role="menuitem" class="menu-item" @click="showLinks"><Link2 :size="14" />Show Links</button>
                  <button type="button" role="menuitem" class="menu-item" @click="copyToClipboard"><ClipboardCopy :size="14" />Copy to Clipboard</button>
                  <button type="button" role="menuitem" class="menu-item" @click="remindMe"><Bell :size="14" />Remind Me</button>
                  <button type="button" role="menuitem" class="menu-item" :disabled="!undoStack.length" @click="undo"><Undo2 :size="14" />Undo</button>
                  <button type="button" role="menuitem" class="menu-item" :disabled="!redoStack.length" @click="redo"><Redo2 :size="14" />Redo</button>
                  <button v-if="showRepeat" type="button" role="menuitem" class="menu-item" @click="autoRepeat"><Repeat :size="14" />Repeat</button>
                  <button v-if="showCustomize" type="button" role="menuitem" class="menu-item" @click="customize"><Settings2 :size="14" />Customize</button>
                  <button v-for="item in ui.menu" :key="item.label" type="button" role="menuitem" class="menu-item" @click="runScriptAction(item)"><CircleDot :size="14" />{{ item.label }}</button>
                  <button type="button" role="menuitem" class="menu-item" @click="hideEmpty = !hideEmpty"><component :is="hideEmpty ? Eye : EyeOff" :size="14" />{{ hideEmpty ? 'Show empty fields' : 'Hide empty fields' }}</button>
                  <div v-if="showDelete || showDiscard" class="menu-separator" role="separator" />
                  <button v-if="showDiscard" type="button" role="menuitem" class="menu-item menu-item--danger" @click="discardDocument"><Ban :size="14" />Discard</button>
                  <button v-if="showDelete" type="button" role="menuitem" class="menu-item menu-item--danger" @click="remove"><Trash2 :size="14" />Delete</button>
                </div>
              </Transition>
              <div v-if="moreOpen" class="more-scrim" @click="moreOpen = false" />
            </div>
            <BaseButton v-if="showPrint" variant="quiet" size="md" @click="print"><Printer :size="15" />Print</BaseButton>
            <BaseButton v-if="showCancel" variant="danger" size="md" :loading="busy === 'Cancel'" @click="cancelDocument"><Ban :size="15" />Cancel</BaseButton>
            <BaseButton v-if="showAmend" variant="outline" size="md" :loading="busy === 'Amend'" @click="amend"><FilePen :size="15" />Amend</BaseButton>
            <!-- Save is always visible on an editable form; it enables once there is something to save. -->
            <BaseButton v-if="ui.secondaryAction" variant="outline" size="md" @click="runScriptAction(ui.secondaryAction)">{{ ui.secondaryAction.label }}</BaseButton>
            <BaseButton v-if="ui.primaryAction" variant="primary" size="md" @click="runScriptAction(ui.primaryAction)">{{ ui.primaryAction.label }}</BaseButton>
            <BaseButton v-if="showSave" :variant="showSubmit && !dirty ? 'quiet' : 'primary'" size="md" :loading="busy === 'Save'" :disabled="!dirty && !isNew" :title="!dirty && !isNew ? 'No changes to save' : undefined" aria-keyshortcuts="Control+S Meta+S" @click="save()"><Save :size="15" />{{ isNew ? `Save ${doctype}` : docstatus === 1 ? 'Update' : 'Save' }}</BaseButton>
            <BaseButton v-if="showSubmit && !dirty" variant="primary" size="md" :loading="busy === 'Submit'" @click="submit"><Send :size="15" />Submit</BaseButton>
          </div>
        </div>
        <p v-if="readOnlyNotice" class="doc-notice">{{ readOnlyNotice }}</p>
        <p v-if="ui.intro" :class="['doc-script-note', `doc-script-note--${ui.intro.color}`]" v-html="sanitizeHtml(ui.intro.html)" />
        <p v-if="ui.headline" :class="['doc-script-note', `doc-script-note--${ui.headline.color}`]" v-html="sanitizeHtml(ui.headline.html)" />
        <p v-for="(note, index) in ui.comments" :key="index" :class="['doc-script-note', `doc-script-note--${note.color}`]" v-html="sanitizeHtml(note.html)" />
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

      <div v-else-if="form.doctype || !isNew" :class="['doc-layout', { 'doc-layout--single': !showAside || asideHidden }]">
        <form class="doc-main" @submit.prevent="save()">
          <section v-if="facts.length >= 2" class="doc-facts" aria-label="Summary" :style="{ '--fact-count': facts.length + (status ? 1 : 0) }">
            <div v-for="fact in facts" :key="fact.field.fieldname" class="doc-fact">
              <span class="doc-fact-icon" aria-hidden="true"><component :is="fact.icon" :size="17" /></span>
              <span class="doc-fact-copy"><small>{{ fact.label }}</small><strong class="tabular" :title="fact.value">{{ fact.value }}</strong></span>
            </div>
            <div v-if="status" class="doc-fact">
              <span class="doc-fact-icon" aria-hidden="true"><CircleDot :size="17" /></span>
              <span class="doc-fact-copy"><small>Status</small><BaseBadge :tone="status.tone" :label="status.label" /><em v-if="form.modified">Modified {{ relativeTime(form.modified as string) }}</em></span>
            </div>
          </section>
          <section v-if="ui.progress.length || ui.badges.length" class="doc-progress" aria-label="Progress">
            <span v-for="badge in ui.badges" :key="badge.label" class="doc-progress-badge"><BaseBadge :tone="INDICATOR_TONES[badge.color] ?? 'slate'" :label="badge.label" /></span>
            <div v-for="bar in ui.progress" :key="bar.title" class="doc-progress-row" :title="bar.message">
              <span class="doc-progress-label">{{ bar.title }}</span>
              <span class="doc-progress-track" role="progressbar" :aria-valuenow="Math.round(bar.percent)" aria-valuemin="0" aria-valuemax="100" :aria-label="bar.title"><i :style="{ width: `${Math.min(100, bar.percent)}%` }" /></span>
              <span class="doc-progress-value tabular">{{ Math.round(bar.percent) }}%</span>
            </div>
          </section>
          <DynamicForm
            ref="formRef"
            :doctype="doctype"
            :fields="metadata"
            :child-fields="childFields"
            :doc="form"
            :docname="name"
            :read-only="!editable"
            :hide-empty="hideEmpty && !editable"
            :errors="errors"
            :extra-tabs="extraTabs"
          >
            <template #tab-connections>
              <ConnectionsPanel v-if="dashboard && name" :doctype="doctype" :name="name" :dashboard="dashboard" :doc="form" :frm="frm" :extra="ui.transactionsExtra" @total="connectionCount = $event" />
            </template>
          </DynamicForm>
        </form>
        <aside v-if="showAside && !asideHidden" class="doc-aside">
          <section v-if="lifecycle.length" class="aside-card">
            <h3 class="aside-title"><CircleDot :size="15" />{{ isSubmittable ? 'Document lifecycle' : 'Record' }}</h3>
            <ol class="lifecycle">
              <li v-for="step in lifecycle" :key="step.label" :class="`lifecycle--${step.state}`">
                <span class="lifecycle-dot" aria-hidden="true"><Check v-if="step.state === 'done'" :size="10" /></span>
                <span class="lifecycle-copy"><strong>{{ step.label }}</strong><small v-if="step.detail">{{ step.detail }}</small></span>
              </li>
            </ol>
          </section>
          <section v-if="isNew && requiredChecklist.length" class="aside-card">
            <h3 class="aside-title"><ListChecks :size="15" />Required fields<span class="aside-count tabular">{{ requiredDone }} / {{ requiredChecklist.length }}</span></h3>
            <div class="checklist-bar" aria-hidden="true"><i :style="{ width: `${(requiredDone / requiredChecklist.length) * 100}%` }" /></div>
            <ul class="checklist">
              <li v-for="item in requiredChecklist" :key="item.fieldname" :class="{ done: item.done }"><span class="check-mark" aria-hidden="true"><Check v-if="item.done" :size="11" /></span>{{ item.label }}<span class="sr-only">{{ item.done ? '(filled)' : '(empty)' }}</span></li>
            </ul>
            <p class="aside-note">ERPNext fills some values (price list, exchange rate, UOM…) itself when you save.</p>
          </section>
          <DocMetaCard v-if="!isNew && document && !docinfo.is_static" :doctype="doctype" :name="name!" :docinfo="docinfo" :can-write="can('write')" :can-share="can('share')" @refresh="reloadDocument" />
          <ActivityPanel
          v-if="!isNew && document && !docinfo.is_static"
          :doctype="doctype"
          :name="name!"
          :doc="form"
          :docinfo="docinfo"
          :can-write="can('write')"
          @refresh="reloadDocument"
        />
        </aside>
      </div>

      <div v-if="editable && !ui.saveDisabled && (dirty || isNew)" class="save-bar" role="region" aria-label="Unsaved changes">
        <span class="save-hint"><span class="save-dot" />{{ isNew ? `New ${doctype}` : 'Unsaved changes' }} · <kbd>Ctrl</kbd> <kbd>S</kbd> to save</span>
        <div class="page-actions">
          <BaseButton v-if="!isNew" variant="ghost" size="sm" @click="discard">Discard</BaseButton>
          <BaseButton v-else variant="ghost" size="sm" @click="router.back()">Cancel</BaseButton>
          <BaseButton variant="primary" size="sm" :loading="busy === 'Save'" @click="save()"><Save :size="14" />{{ isNew ? 'Create' : 'Save changes' }}</BaseButton>
        </div>
      </div>
    </template>

    <EmailDialog v-if="!isNew" :open="emailOpen" :doctype="doctype" :name="name || ''" :default-recipient="emailRecipient" @close="emailOpen = false" @sent="reloadDocument" />
  </div>
</template>

<style scoped>
.document-page { gap: 16px; }
.document-error { border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }

/* Header: compact, sticky under the topbar. */
.doc-header { position: sticky; z-index: 8; top: var(--topbar-height); display: flex; flex-direction: column; gap: 10px; margin: -8px -28px 0; padding: 10px 28px 14px; background: color-mix(in srgb, var(--background) 96%, transparent); backdrop-filter: blur(10px); }
.doc-identity { display: flex; align-items: flex-start; gap: 16px; }
.doc-titles { min-width: 0; flex: 1; }
.doc-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; }
.doc-title-row .page-title { margin: 0; }
.doc-name { display: flex; min-width: 0; align-items: baseline; gap: 8px; margin-top: 4px; color: var(--muted-foreground); font-family: var(--font-display); font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
.doc-id { flex: none; }
.doc-dot { color: var(--faint-foreground); }
.doc-title-text { min-width: 0; overflow: hidden; color: var(--subtle-foreground); font-family: var(--font-sans); font-size: 14px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.doc-subtitle { margin-top: 6px; color: var(--subtle-foreground); font-size: 14px; }
.dirty-pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; color: var(--warning-soft-foreground); border: 1px dashed color-mix(in srgb, var(--warning) 45%, transparent); border-radius: 999px; font-size: 11.5px; font-weight: 600; }
.doc-actions { display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 2px; }
.icon-only { width: var(--control-height); padding: 0; }
.doc-notice { padding: 9px 12px; color: var(--info-soft-foreground); border: 1px solid color-mix(in srgb, var(--info) 20%, transparent); border-radius: var(--radius-md); background: var(--info-soft); font-size: 12.5px; }
.doc-errors { padding: 9px 12px; color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent); border-radius: var(--radius-md); background: var(--danger-soft); font-size: 12.5px; }

.more { position: relative; }
.more-scrim { position: fixed; z-index: 19; inset: 0; }
.more-menu { position: absolute; z-index: 20; top: calc(100% + 6px); right: 0; }

/* Notes and progress set by the DocType's form script. */
.doc-script-note { padding: 9px 12px; color: var(--info-soft-foreground); border: 1px solid color-mix(in srgb, var(--info) 20%, transparent); border-radius: var(--radius-md); background: var(--info-soft); font-size: 12.5px; }
.doc-script-note--orange, .doc-script-note--yellow { color: var(--warning-soft-foreground); border-color: color-mix(in srgb, var(--warning) 25%, transparent); background: var(--warning-soft); }
.doc-script-note--red { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 25%, transparent); background: var(--danger-soft); }
.doc-progress { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; padding: 12px 18px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.doc-progress-row { display: grid; grid-template-columns: minmax(120px, 200px) minmax(0, 1fr) 44px; align-items: center; gap: 12px; font-size: 12.5px; }
.doc-progress-label { overflow: hidden; color: var(--muted-foreground); text-overflow: ellipsis; white-space: nowrap; }
.doc-progress-track { height: 6px; overflow: hidden; border-radius: 999px; background: var(--chart-track); }
.doc-progress-track i { display: block; height: 100%; border-radius: 999px; background: var(--primary); }
.doc-progress-value { color: var(--foreground); font-weight: 600; text-align: right; }

/* Summary strip */
.doc-facts { display: grid; grid-template-columns: repeat(var(--fact-count, 4), minmax(0, 1fr)); margin-bottom: 16px; padding: 4px 0; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.doc-fact { display: flex; min-width: 0; align-items: flex-start; gap: 12px; padding: 14px 20px; }
.doc-fact + .doc-fact { border-left: 1px solid var(--border); }
.doc-fact-icon { display: grid; width: 40px; height: 40px; flex: none; place-items: center; color: var(--primary); border-radius: 50%; background: var(--primary-soft); }
.doc-fact-copy { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 3px; }
.doc-fact-copy small { max-width: 100%; overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.doc-fact-copy strong { max-width: 100%; overflow: hidden; color: var(--foreground); font-size: 15px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.doc-fact-copy em { color: var(--subtle-foreground); font-size: 11.5px; font-style: normal; white-space: nowrap; }
/* Narrow form column (side panel open, smaller screens): facts in two columns. */
@container (max-width: 820px) {
  .doc-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .doc-fact:nth-child(odd) { border-left: 0; }
  .doc-fact:nth-child(n + 3) { border-top: 1px solid var(--border); }
  .doc-fact:last-child:nth-child(odd) { grid-column: 1 / -1; }
}
@container (max-width: 480px) {
  .doc-facts { grid-template-columns: minmax(0, 1fr); }
  .doc-fact + .doc-fact { border-left: 0; border-top: 1px solid var(--border); }
}

/* Layout + side panel */
.doc-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: start; gap: 20px; }
.doc-layout--single { grid-template-columns: minmax(0, 1fr); }
.doc-main { min-width: 0; container-type: inline-size; }
.doc-aside { position: sticky; top: calc(var(--topbar-height) + var(--form-sticky-offset, 0px)); display: flex; max-height: calc(100dvh - var(--topbar-height) - var(--form-sticky-offset, 0px) - 16px); flex-direction: column; gap: 14px; overflow-y: auto; scrollbar-width: none; }
.aside-card { padding: 16px 18px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.aside-title { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--foreground); font-size: 13.5px; font-weight: 600; }
.aside-title svg { color: var(--primary); }
.aside-count { margin-left: auto; color: var(--muted-foreground); font-size: 12px; font-weight: 600; }
.aside-note { margin-top: 12px; color: var(--subtle-foreground); font-size: 11.5px; line-height: 1.45; }

.lifecycle { position: relative; display: flex; flex-direction: column; gap: 16px; margin: 0; padding: 0; list-style: none; }
.lifecycle::before { position: absolute; top: 8px; bottom: 8px; left: 8px; width: 2px; content: ''; border-radius: 2px; background: var(--border); }
.lifecycle li { position: relative; display: flex; gap: 12px; }
.lifecycle-dot { position: relative; display: grid; width: 18px; height: 18px; flex: none; place-items: center; color: var(--primary-foreground); border: 2px solid var(--border-strong); border-radius: 50%; background: var(--surface); }
.lifecycle--done .lifecycle-dot { border-color: var(--primary); background: var(--primary); }
.lifecycle--current .lifecycle-dot { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-soft); }
.lifecycle--current .lifecycle-dot::after { width: 8px; height: 8px; content: ''; border-radius: 50%; background: var(--primary); }
.lifecycle-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.lifecycle-copy strong { color: var(--foreground); font-size: 13px; font-weight: 600; }
.lifecycle--pending .lifecycle-copy strong { color: var(--subtle-foreground); font-weight: 500; }
.lifecycle-copy small { color: var(--subtle-foreground); font-size: 12px; }

.checklist-bar { height: 6px; margin-bottom: 12px; overflow: hidden; border-radius: 999px; background: var(--chart-track); }
.checklist-bar i { display: block; height: 100%; border-radius: 999px; background: var(--primary); transition: width var(--dur-med) var(--ease); }
.checklist { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.checklist li { display: flex; align-items: center; gap: 9px; color: var(--muted-foreground); font-size: 12.5px; }
.checklist li.done { color: var(--foreground); }
.check-mark { display: grid; width: 16px; height: 16px; flex: none; place-items: center; color: var(--primary-foreground); border: 1.5px solid var(--border-strong); border-radius: 50%; }
.checklist li.done .check-mark { border-color: var(--secondary); background: var(--secondary); }

.doc-skeleton { display: flex; flex-direction: column; gap: 14px; }
.skeleton-section { display: flex; flex-direction: column; gap: 16px; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }

.save-bar { position: sticky; z-index: 9; bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px 10px 18px; border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border)); border-radius: var(--radius-xl); background: color-mix(in srgb, var(--surface-elevated) 94%, transparent); backdrop-filter: blur(10px); box-shadow: var(--shadow-lg); animation: stagger-in .2s var(--ease) both; }
.save-hint { display: flex; align-items: center; gap: 8px; color: var(--muted-foreground); font-size: 12.5px; }
.save-hint kbd { padding: 1px 5px; border: 1px solid var(--border); border-radius: 4px; background: var(--muted); font: 500 11px var(--font-sans); }
.save-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--warning); box-shadow: 0 0 0 3px var(--warning-soft); }

@media (max-width: 1200px) {
  .doc-layout { grid-template-columns: minmax(0, 1fr); }
  .doc-aside { position: static; max-height: none; overflow: visible; }
}
@media (max-width: 1360px) { .doc-fact { padding: 14px 16px; } .doc-fact-icon { width: 34px; height: 34px; } }
@media (max-width: 900px) { .doc-header { margin: -4px -16px 0; padding: 8px 16px 12px; } }
@media (max-width: 760px) {
  .doc-identity { flex-wrap: wrap; }
  .doc-actions { width: 100%; justify-content: flex-start; }
  .doc-header { position: static; }
  .save-hint { display: none; }
  .save-bar .page-actions { width: 100%; justify-content: flex-end; }
}
</style>
