import { erpnextApi } from "./erpnext-api";
import { isStaticDocType, staticMeta } from "./static-data";

export interface DocField {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: string;
  reqd?: number;
  read_only?: number;
  hidden?: number;
  default?: unknown;
  description?: string;
  depends_on?: string;
  mandatory_depends_on?: string;
  read_only_depends_on?: string;
  fetch_from?: string;
  in_list_view?: number;
  in_standard_filter?: number;
  bold?: number;
  width?: number | string;
  precision?: string | number;
  collapsible?: number;
  collapsible_depends_on?: string;
  columns?: number;
  length?: number;
  permlevel?: number;
  allow_on_submit?: number;
  no_copy?: number;
  link_filters?: string;
  [key: string]: unknown;
}

/** A DocType's Connections definition (its <doctype>_dashboard.py). */
export interface DocTypeDashboard {
  fieldname?: string;
  non_standard_fieldnames?: Record<string, string>;
  internal_links?: Record<string, string | string[]>;
  internal_and_external_links?: Record<string, string | string[]>;
  dynamic_links?: Record<string, [string, string]>;
  transactions?: Array<{ label?: string; items: string[] }>;
  reports?: Array<{ label?: string; items: string[] }>;
  method?: string;
}

export interface DocTypeMeta {
  name: string;
  module?: string;
  title_field?: string;
  search_fields?: string;
  sort_field?: string;
  sort_order?: string;
  is_submittable?: number;
  is_tree?: number;
  issingle?: number;
  istable?: number;
  track_changes?: number;
  image_field?: string;
  autoname?: string;
  default_print_format?: string;
  allow_rename?: number;
  __js?: string;
  __custom_js?: string;
  __css?: string;
  __templates?: Record<string, string>;
  __dashboard?: DocTypeDashboard;
  __print_formats?: Array<{ name: string }>;
  __workflow_docs?: Array<{ name: string; workflow_state_field?: string; document_type?: string; is_active?: number }>;
  fields: DocField[];
  permissions?: Array<{
    role: string;
    permlevel?: number;
    read?: number;
    write?: number;
    create?: number;
    delete?: number;
    submit?: number;
    cancel?: number;
    amend?: number;
    print?: number;
    email?: number;
    export?: number;
    report?: number;
    share?: number;
  }>;
  /** Server-side list/form scripts' indicator settings, when present. */
  [key: string]: unknown;
}

// Metadata rarely changes during a session; Desk caches it the same way.
// The cache stores promises so concurrent callers share one request.
const metaCache = new Map<string, Promise<DocTypeMeta>>();
/** Every DocType loaded so far, for synchronous reads (form scripts' frappe.get_meta). */
export const metaRegistry = new Map<string, DocTypeMeta>();

function loadBundle(doctype: string): Promise<DocTypeMeta> {
  const pending = erpnextApi.getMetaBundle(doctype).then((docs: DocTypeMeta[]) => {
    // The bundle also carries each child table's metadata: cache those too,
    // so child tables render without another round trip.
    for (const doc of docs) {
      metaRegistry.set(doc.name, doc);
      if (doc.name !== doctype && !metaCache.has(doc.name)) metaCache.set(doc.name, Promise.resolve(doc));
    }
    const meta = docs.find((doc) => doc.name === doctype) ?? docs[0];
    if (!meta) throw new Error(`ERPNext returned no metadata for ${doctype}.`);
    return meta;
  });
  // Failed requests must not stay cached, or a transient error would stick.
  pending.catch(() => metaCache.delete(doctype));
  metaCache.set(doctype, pending);
  return pending;
}

/**
 * Get complete metadata for a DocType.
 */
export async function getDocTypeMetadata(
  doctype: string
): Promise<DocTypeMeta> {
  const local = staticMeta(doctype);
  if (local) { metaRegistry.set(doctype, local); return local; }
  return metaCache.get(doctype) ?? loadBundle(doctype);
}

/** Drop cached metadata, e.g. after a DocType is customized. */
export function clearMetadataCache(doctype?: string) {
  if (doctype) metaCache.delete(doctype);
  else metaCache.clear();
}

/**
 * Get only the fields of a DocType.
 */
export async function getDocTypeFields(
  doctype: string
): Promise<DocField[]> {
  const metadata = await getDocTypeMetadata(doctype);

  return metadata.fields ?? [];
}

/**
 * Get permissions for a DocType.
 */
export async function getDocTypePermissions(
  doctype: string
) {
  const metadata = await getDocTypeMetadata(doctype);

  return metadata.permissions ?? [];
}

const permissionCache = new Map<string, Promise<boolean>>();

/**
 * Whether the current user has a DocType-level permission ("create", "delete", "read"…),
 * evaluated by Frappe for the session user's roles.
 */
export function hasDocTypePermission(doctype: string, permType: string): Promise<boolean> {
  // Static demo DocTypes can be read and exported, never changed.
  if (isStaticDocType(doctype)) return Promise.resolve(['read', 'export', 'report'].includes(permType));
  const key = `${doctype}:${permType}`;
  let pending = permissionCache.get(key);
  if (!pending) {
    pending = erpnextApi
      .hasPermission(doctype, permType)
      .then((response) => Boolean(response.message?.has_permission))
      .catch(() => false);
    permissionCache.set(key, pending);
  }
  return pending;
}

/**
 * Find a specific field.
 */
export async function getDocTypeField(
  doctype: string,
  fieldname: string
): Promise<DocField | undefined> {
  const fields = await getDocTypeFields(doctype);

  return fields.find(
    (field) => field.fieldname === fieldname
  );
}

/**
 * Get Link fields.
 */
export async function getLinkFields(
  doctype: string
): Promise<DocField[]> {
  const fields = await getDocTypeFields(doctype);

  return fields.filter(
    (field) => field.fieldtype === "Link"
  );
}

/**
 * Get Table / child-table fields.
 */
export async function getTableFields(
  doctype: string
): Promise<DocField[]> {
  const fields = await getDocTypeFields(doctype);

  return fields.filter(
    (field) =>
      field.fieldtype === "Table" ||
      field.fieldtype === "Table MultiSelect"
  );
}

/**
 * Default API object.
 *
 * This allows both styles:
 *
 * metadataApi.getDocTypeMetadata("Item")
 *
 * and:
 *
 * getDocTypeMetadata("Item")
 */
export const metadataApi = {
  getDocTypeMetadata,
  getDocTypeFields,
  getDocTypePermissions,
  getDocTypeField,
  getLinkFields,
  getTableFields,
  hasDocTypePermission,
  clearMetadataCache,
};
