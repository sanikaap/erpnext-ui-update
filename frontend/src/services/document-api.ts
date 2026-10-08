import { API_BASE_URL, erpnextApi } from "./erpnext-api";
import { isStaticDocType, StaticReadOnlyError, staticCount, staticGet, staticList, staticSearch } from "./static-data";
import type { DocPermissions, Filter, FrappeDocument, Sort } from "@/types/erp";

export interface DocumentListOptions {
  fields?: string[];
  filters?: Record<string, unknown> | unknown[][];
  orFilters?: Record<string, unknown> | unknown[][];
  orderBy?: string;
  limit?: number;
  limitStart?: number;
}

/** Timeline data Frappe returns next to a document (`docinfo`). */
export interface DocInfo {
  permissions?: DocPermissions;
  attachments?: Array<{ name: string; file_name: string; file_url: string; is_private?: number }>;
  comments?: Array<{ name: string; content: string; owner: string; creation: string; comment_email?: string }>;
  communications?: Array<{ name: string; subject?: string; content?: string; sender?: string; creation: string; communication_type?: string }>;
  versions?: Array<{ name: string; owner: string; creation: string; data: string }>;
  is_document_amended?: boolean;
  [key: string]: unknown;
}

export const documentApi = {
  /**
   * Get a list of documents from any DocType.
   *
   * Example:
   * documentApi.list("Item", {
   *   fields: ["name", "item_name", "item_group"],
   *   limit: 20
   * });
   */
  async list<T = Record<string, unknown>>(
    doctype: string,
    options: DocumentListOptions = {}
  ): Promise<T[]> {
    if (isStaticDocType(doctype)) return staticList<T>(doctype, options);
    const response = await erpnextApi.getList<T>(doctype, {
      fields: options.fields,
      filters: options.filters,
      orFilters: options.orFilters,
      orderBy: options.orderBy,
      limit: options.limit,
      limitStart: options.limitStart,
    });

    return response.data ?? [];
  },

  /**
   * Get one document by name.
   *
   * Example:
   * documentApi.get("Item", "ITEM-001");
   */
  async get<T = Record<string, unknown>>(
    doctype: string,
    name: string
  ): Promise<T> {
    if (isStaticDocType(doctype)) return staticGet<T>(doctype, name);
    const response = await erpnextApi.getDoc<T>(doctype, name);

    return response.data;
  },

  /**
   * Create a new document.
   *
   * Example:
   * documentApi.create("Item", {
   *   item_code: "ITEM-001",
   *   item_name: "Test Item",
   *   item_group: "Products"
   * });
   */
  async create<T = Record<string, unknown>>(
    doctype: string,
    data: Record<string, unknown>
  ): Promise<T> {
    if (isStaticDocType(doctype)) throw new StaticReadOnlyError(doctype);
    const response = await erpnextApi.createDoc<T>(doctype, data);

    return response.data;
  },

  /**
   * Update an existing document.
   *
   * Example:
   * documentApi.update("Item", "ITEM-001", {
   *   item_name: "Updated Item"
   * });
   */
  async update<T = Record<string, unknown>>(
    doctype: string,
    name: string,
    data: Record<string, unknown>
  ): Promise<T> {
    if (isStaticDocType(doctype)) throw new StaticReadOnlyError(doctype);
    const response = await erpnextApi.updateDoc<T>(
      doctype,
      name,
      data
    );

    return response.data;
  },

  /**
   * Delete a document.
   *
   * Example:
   * documentApi.delete("Item", "ITEM-001");
   */
  async delete(
    doctype: string,
    name: string
  ): Promise<void> {
    if (isStaticDocType(doctype)) throw new StaticReadOnlyError(doctype);
    await erpnextApi.deleteDoc(doctype, name);
  },

  /**
   * Save a complete Frappe document.
   *
   * Useful when working with DynamicForm.
   */
  async save<T = Record<string, unknown>>(
    doc: Record<string, unknown>
  ): Promise<T> {
    if (isStaticDocType(String(doc.doctype))) throw new StaticReadOnlyError(String(doc.doctype));
    const response = await erpnextApi.saveDoc<T>(doc);

    return response.message;
  },

  /**
   * Submit a document.
   *
   * The document must contain the required fields
   * and normally have docstatus = 0.
   */
  async submit<T = Record<string, unknown>>(
    doc: Record<string, unknown>
  ): Promise<T> {
    if (isStaticDocType(String(doc.doctype))) throw new StaticReadOnlyError(String(doc.doctype));
    const response = await erpnextApi.submitDoc<T>(doc);

    return response.message;
  },

  /**
   * Cancel a submitted document.
   */
  async cancel<T = Record<string, unknown>>(
    doctype: string,
    name: string
  ): Promise<T> {
    const response = await erpnextApi.cancelDoc<T>(
      doctype,
      name
    );

    return response.message;
  },

  /**
   * Get the number of documents matching filters.
   *
   * Example:
   * documentApi.count("Item", {
   *   item_group: "Products"
   * });
   */
  async count(
    doctype: string,
    filters?: Record<string, unknown> | unknown[][],
    orFilters?: unknown[][]
  ): Promise<number> {
    if (isStaticDocType(doctype)) return staticCount(doctype, filters, orFilters);
    const response = orFilters?.length
      ? await erpnextApi.getReportCount(doctype, filters, orFilters)
      : await erpnextApi.getCount(doctype, filters);

    return Number(response.message ?? 0);
  },

  /**
   * Load a document together with its docinfo
   * (evaluated permissions, comments, attachments, versions).
   */
  async getWithInfo<T = FrappeDocument>(
    doctype: string,
    name: string
  ): Promise<{ doc: T; docinfo: DocInfo }> {
    if (isStaticDocType(doctype)) {
      // Demo records: readable, exportable; no comments, attachments or changes.
      return { doc: staticGet<T>(doctype, name), docinfo: { permissions: { read: 1, export: 1, report: 1 }, comments: [], attachments: [], versions: [], communications: [], is_static: true } };
    }
    const response = await erpnextApi.getDocWithInfo<T>(doctype, name);
    const doc = response.docs?.[0];
    if (!doc) throw new Error(`${doctype} ${name} was not found.`);

    return { doc, docinfo: response.docinfo ?? {} };
  },

  /** Server-side search for a Link field's target DocType. */
  async searchLink(
    doctype: string,
    txt: string,
    options: { filters?: unknown; pageLength?: number; referenceDoctype?: string } = {}
  ) {
    if (isStaticDocType(doctype)) return staticSearch(doctype, txt, options.pageLength);
    const response = await erpnextApi.searchLink(doctype, txt, options);

    return response.message ?? [];
  },

  /** Add a timeline comment to a document. */
  async addComment(
    doctype: string,
    name: string,
    content: string,
    user: { email: string; fullName: string }
  ) {
    return erpnextApi.callPost("frappe.desk.form.utils.add_comment", {
      reference_doctype: doctype,
      reference_name: name,
      content,
      comment_email: user.email,
      comment_by: user.fullName,
    });
  },

  /** Email a document through Frappe's Communication API, optionally attaching its print. */
  async sendEmail(params: {
    doctype: string;
    name: string;
    recipients: string;
    subject: string;
    content: string;
    attachPrint?: boolean;
  }) {
    return erpnextApi.callPost("frappe.core.doctype.communication.email.make", {
      doctype: params.doctype,
      name: params.name,
      recipients: params.recipients,
      subject: params.subject,
      content: params.content,
      send_email: 1,
      print_format: params.attachPrint ? "Standard" : undefined,
      attach_document_print: params.attachPrint ? 1 : 0,
    });
  },

  /**
   * Amend a cancelled document: a new draft copy linked through `amended_from`,
   * the same copy Desk makes (Frappe names it NAME-1, NAME-2…).
   */
  async amend<T = FrappeDocument>(doc: FrappeDocument): Promise<T> {
    const strip = (row: Record<string, unknown>) => {
      const copy: Record<string, unknown> = { ...row };
      for (const key of ["name", "creation", "modified", "modified_by", "owner", "docstatus", "parent", "idx"]) delete copy[key];
      return copy;
    };
    const draft: Record<string, unknown> = strip(doc);
    for (const [key, value] of Object.entries(draft)) {
      if (Array.isArray(value)) draft[key] = value.map((row) => strip(row as Record<string, unknown>));
    }
    draft.amended_from = doc.name;
    draft.docstatus = 0;

    return this.save<T>(draft);
  },

  /** PDF of the document's print view, served through the same session. */
  printUrl(doctype: string, name: string, format = "Standard") {
    return `${API_BASE_URL}/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}&format=${encodeURIComponent(format)}&no_letterhead=0`;
  },
};

// ============================================================
// Named helpers used by pages and composables
// ============================================================

export interface ListDocumentsParams {
  doctype: string;
  fields?: string[];
  search?: string;
  /** Fields the search text is matched against (OR). Defaults to `name`. */
  searchFields?: string[];
  filters?: Filter[];
  sort?: Sort[];
  start?: number;
  pageLength?: number;
}

/** Serialize Sorts to Frappe's `order_by` wire form ("modified desc, name asc"). */
export function toOrderBy(sort: Sort[] = []) {
  return sort.map((rule) => `${rule.fieldname} ${rule.direction}`).join(", ") || undefined;
}

export async function listDocuments<T = FrappeDocument>(
  params: ListDocumentsParams
): Promise<{ data: T[]; total: number }> {
  const filters: unknown[][] = (params.filters ?? [])
    .filter((filter) => filter.value !== "" && filter.value !== undefined && filter.value !== null)
    .map((filter) => [
      params.doctype,
      filter.fieldname,
      filter.operator,
      filter.operator === "like" ? `%${filter.value}%` : filter.value,
    ]);
  const searchFields = params.searchFields?.length ? params.searchFields : ["name"];
  const orFilters: unknown[][] = params.search
    ? [...new Set(searchFields)].map((fieldname) => [params.doctype, fieldname, "like", `%${params.search}%`])
    : [];

  const [data, total] = await Promise.all([
    documentApi.list<T>(params.doctype, {
      fields: params.fields,
      filters,
      orFilters,
      orderBy: toOrderBy(params.sort),
      limit: params.pageLength,
      limitStart: params.start,
    }),
    documentApi.count(params.doctype, filters, orFilters),
  ]);

  return { data, total };
}

export const countDocuments = documentApi.count;

export function getDocument<T = FrappeDocument>(doctype: string, name: string) {
  return documentApi.get<T>(doctype, name);
}

export function createDocument<T = FrappeDocument>(
  doctype: string,
  data: Record<string, unknown>
) {
  return documentApi.create<T>(doctype, data);
}

export function updateDocument<T = FrappeDocument>(
  doctype: string,
  name: string,
  data: Record<string, unknown>
) {
  return documentApi.update<T>(doctype, name, data);
}

export function deleteDocument(doctype: string, name: string) {
  return documentApi.delete(doctype, name);
}
