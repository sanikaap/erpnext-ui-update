import { computed, onMounted, ref, watch, type Ref } from 'vue';
import type { DocPermissions, ERPNextMetadataField, FrappeDocument } from '@/types/erp';
import { getDocTypeMetadata, type DocTypeMeta } from '@/services/metadata-api';
import { documentApi, type DocInfo } from '@/services/document-api';
import { FrappeApiError } from '@/services/erpnext-api';
import { normalizeFields, TABLE_TYPES } from '@/lib/doctype';

export type LoadErrorKind = 'permission' | 'not-found' | 'error';

function classify(cause: unknown): { message: string; kind: LoadErrorKind } {
  if (cause instanceof FrappeApiError) {
    if (cause.status === 403) return { kind: 'permission', message: 'You don’t have permission to access this.' };
    if (cause.status === 404) return { kind: 'not-found', message: 'This DocType or document does not exist in ERPNext.' };
    return { kind: 'error', message: cause.message };
  }
  return { kind: 'error', message: cause instanceof Error ? cause.message : 'Unable to load ERPNext metadata.' };
}

/**
 * Metadata (and optionally one document) for any DocType.
 * Child-table metadata arrives in the same bundle and is exposed as `childFields`.
 */
export function useDocType(doctype: Ref<string>, name?: Ref<string | undefined>) {
  const meta = ref<DocTypeMeta | null>(null);
  const metadata = ref<ERPNextMetadataField[]>([]);
  const childFields = ref<Record<string, ERPNextMetadataField[]>>({});
  const document = ref<FrappeDocument | null>(null);
  const docinfo = ref<DocInfo>({});
  const loading = ref(true);
  const error = ref<string | null>(null);
  const errorKind = ref<LoadErrorKind | null>(null);

  let generation = 0;

  async function loadMeta() {
    const loaded = await getDocTypeMetadata(doctype.value);
    const fields = normalizeFields(loaded);
    const children: Record<string, ERPNextMetadataField[]> = {};
    await Promise.all(fields
      .filter((field) => TABLE_TYPES.has(field.fieldtype) && field.options)
      .map(async (field) => {
        try {
          children[field.options!] = normalizeFields(await getDocTypeMetadata(field.options!));
        } catch {
          children[field.options!] = [];
        }
      }));
    return { loaded, fields, children };
  }

  async function load() {
    const current = (generation += 1);
    if (!doctype.value) return;
    loading.value = true;
    error.value = null;
    errorKind.value = null;
    try {
      const [{ loaded, fields, children }, record] = await Promise.all([
        loadMeta(),
        name?.value ? documentApi.getWithInfo(doctype.value, name.value) : Promise.resolve(null),
      ]);
      if (current !== generation) return;
      meta.value = loaded;
      metadata.value = fields;
      childFields.value = children;
      document.value = record?.doc ?? null;
      docinfo.value = record?.docinfo ?? {};
    } catch (cause) {
      if (current !== generation) return;
      const classified = classify(cause);
      error.value = classified.message;
      errorKind.value = classified.kind;
    } finally {
      if (current === generation) loading.value = false;
    }
  }

  /** Re-read the document only (after save/submit), keeping metadata. */
  async function reloadDocument() {
    if (!name?.value) return;
    const record = await documentApi.getWithInfo(doctype.value, name.value);
    document.value = record.doc;
    docinfo.value = record.docinfo;
  }

  const permissions = computed<DocPermissions>(() => docinfo.value.permissions ?? {});
  const isSubmittable = computed(() => Boolean(meta.value?.is_submittable));
  const isSingle = computed(() => Boolean(meta.value?.issingle));
  const titleField = computed(() => meta.value?.title_field || undefined);

  onMounted(load);
  watch(() => [doctype.value, name?.value], (next, previous) => {
    if (next[0] !== previous?.[0] || next[1] !== previous?.[1]) void load();
  });

  return {
    meta, metadata, childFields, document, docinfo, permissions, isSubmittable, isSingle, titleField,
    loading, error, errorKind, load, reloadDocument,
  };
}
