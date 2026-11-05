// src/services/erpnext-api.ts

const FRAPPE_BASE_URL =
  import.meta.env.VITE_FRAPPE_BASE_URL;

if (!FRAPPE_BASE_URL) {
  throw new Error(
    "VITE_FRAPPE_BASE_URL is not configured."
  );
}

// In development, requests stay same-origin ("/api") and the Vite dev
// server proxies them to VITE_FRAPPE_BASE_URL. This avoids CORS and lets
// the Frappe session cookie (sid) be sent with every request.
export const API_BASE_URL = import.meta.env.DEV
  ? "/api"
  : `${FRAPPE_BASE_URL.replace(/\/$/, "")}/api`;


// ============================================================
// Types
// ============================================================

export interface FrappeResponse<T> {
  message: T;
}

/** Shape returned by /api/resource/:doctype/:name (get, create, update). */
export interface FrappeDocResponse<T> {
  data: T;
}

export interface FrappeListResponse<T> {
  data: T[];
}

export interface ListOptions {
  fields?: string[];
  filters?: Record<string, any> | any[][];
  orFilters?: Record<string, any> | any[][];
  orderBy?: string;
  limit?: number;
  limitStart?: number;
  groupBy?: string;
}


export class FrappeApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "FrappeApiError";
  }
}


// ============================================================
// Query Builder
// ============================================================

export function buildQuery(
  params: Record<string, any>
): string {

  const query = new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return;
      }

      if (
        typeof value === "object"
      ) {
        query.set(
          key,
          JSON.stringify(value)
        );
      } else {
        query.set(
          key,
          String(value)
        );
      }
    }
  );

  const result = query.toString();

  return result
    ? `?${result}`
    : "";
}


// ============================================================
// Common Request
// ============================================================

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      credentials: "include",

      headers: {
        "Content-Type":
          "application/json",

        ...(options.headers || {}),
      },

      ...options,
    }
  );


  const text =
    await response.text();

  let data: any = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    data = text;
  }


  if (!response.ok) {

    let message =
      `Frappe API Error ${response.status}`;

    if (data?.message) {
      message += `: ${data.message}`;
    }

    else if (data?.exception) {
      message += `: ${data.exception}`;
    }

    else if (typeof data === "string") {
      message += `: ${data}`;
    }

    throw new FrappeApiError(message, response.status, data);
  }


  return data as T;
}


// ============================================================
// ERPNext API
// ============================================================

export const erpnextApi = {

  // ----------------------------------------------------------
  // Current User
  // ----------------------------------------------------------

  getLoggedUser() {
    return request<FrappeResponse<string>>(
      "/method/frappe.auth.get_logged_user"
    );
  },


  // ----------------------------------------------------------
  // List
  // ----------------------------------------------------------

  getList<T = any>(
    doctype: string,
    options: ListOptions = {}
  ) {

    const query = buildQuery({

      fields:
        options.fields,

      filters:
        options.filters,

      or_filters:
        options.orFilters,

      order_by:
        options.orderBy,

      limit_page_length:
        options.limit ?? 20,

      limit_start:
        options.limitStart ?? 0,

      group_by:
        options.groupBy,
    });


    return request<FrappeListResponse<T>>(
      `/resource/${encodeURIComponent(doctype)}${query}`
    );
  },


  // ----------------------------------------------------------
  // Single Document
  // ----------------------------------------------------------

  getDoc<T = any>(
    doctype: string,
    name: string
  ) {

    return request<FrappeDocResponse<T>>(
      `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
    );
  },


  // ----------------------------------------------------------
  // Create
  // ----------------------------------------------------------

  createDoc<T = any>(
    doctype: string,
    data: Record<string, any>
  ) {

    return request<FrappeDocResponse<T>>(
      `/resource/${encodeURIComponent(doctype)}`,
      {
        method: "POST",

        body:
          JSON.stringify(data),
      }
    );
  },


  // ----------------------------------------------------------
  // Update
  // ----------------------------------------------------------

  updateDoc<T = any>(
    doctype: string,
    name: string,
    data: Record<string, any>
  ) {

    return request<FrappeDocResponse<T>>(
      `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      {
        method: "PUT",

        body:
          JSON.stringify(data),
      }
    );
  },


  // ----------------------------------------------------------
  // Delete
  // ----------------------------------------------------------

  deleteDoc(
    doctype: string,
    name: string
  ) {

    return request(
      `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
      }
    );
  },


  // ----------------------------------------------------------
  // Metadata
  // ----------------------------------------------------------

  getMeta(
    doctype: string
  ) {

    return this.getMetaBundle(doctype).then(
      (docs): FrappeResponse<any> => ({
        message: docs.find((doc) => doc.name === doctype) ?? docs[0],
      })
    );
  },


  /**
   * The DocType plus the metadata of every child table it contains,
   * exactly as Frappe Desk loads it.
   */
  getMetaBundle(
    doctype: string
  ) {

    return request<{ docs: any[] }>(
      `/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(doctype)}`
    ).then((response) => response.docs ?? []);
  },


  // ----------------------------------------------------------
  // Document with docinfo (permissions, comments, attachments)
  // ----------------------------------------------------------

  getDocWithInfo<T = any>(
    doctype: string,
    name: string
  ) {

    return request<{ docs: T[]; docinfo?: any }>(
      `/method/frappe.desk.form.load.getdoc${buildQuery({ doctype, name })}`
    );
  },


  // ----------------------------------------------------------
  // Link search (same endpoint Desk's Link control uses)
  // ----------------------------------------------------------

  searchLink(
    doctype: string,
    txt: string,
    options: { filters?: unknown; pageLength?: number; referenceDoctype?: string; query?: string } = {}
  ) {

    return request<FrappeResponse<Array<{ value: string; description?: string; label?: string }>>>(
      `/method/frappe.desk.search.search_link${buildQuery({
        doctype,
        txt,
        filters: options.filters,
        page_length: options.pageLength ?? 10,
        reference_doctype: options.referenceDoctype,
        query: options.query,
      })}`
    );
  },


  // ----------------------------------------------------------
  // Permission check (doctype-level when name is empty)
  // ----------------------------------------------------------

  hasPermission(
    doctype: string,
    permType: string,
    name = ""
  ) {

    // POST so an empty docname survives (a query string drops it) and Frappe checks the DocType itself.
    return request<FrappeResponse<{ has_permission: boolean }>>(
      "/method/frappe.client.has_permission",
      { method: "POST", body: JSON.stringify({ doctype, docname: name, perm_type: permType }) }
    );
  },


  // ----------------------------------------------------------
  // Count
  // ----------------------------------------------------------

  getCount(
    doctype: string,
    filters: any = {}
  ) {

    const query =
      buildQuery({
        doctype,
        filters,
      });

    return request<FrappeResponse<number>>(
      `/method/frappe.client.get_count${query}`
    );
  },


  /** Count that, unlike frappe.client.get_count, also accepts or_filters. */
  getReportCount(
    doctype: string,
    filters: any = [],
    orFilters: any = []
  ) {

    return request<FrappeResponse<number>>(
      `/method/frappe.desk.reportview.get_count${buildQuery({
        doctype,
        filters,
        or_filters: orFilters,
      })}`
    );
  },


  // ----------------------------------------------------------
  // Generic Frappe Method
  // ----------------------------------------------------------

  call<T = any>(
    method: string,
    args: Record<string, any> = {}
  ) {

    const query =
      buildQuery(args);

    return request<FrappeResponse<T>>(
      `/method/${method}${query}`
    );
  },


  // ----------------------------------------------------------
  // POST Frappe Method
  // ----------------------------------------------------------

  callPost<T = any>(
    method: string,
    args: Record<string, any> = {}
  ) {

    return request<FrappeResponse<T>>(
      `/method/${method}`,
      {
        method: "POST",

        body:
          JSON.stringify(args),
      }
    );
  },


  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  saveDoc<T = any>(
    doc: Record<string, any>
  ) {

    return request<FrappeResponse<T>>(
      "/method/frappe.client.save",
      {
        method: "POST",

        body:
          JSON.stringify({ doc }),
      }
    );
  },


  // ----------------------------------------------------------
  // Save / Submit / Update, as Desk does
  // ----------------------------------------------------------

  saveDocs<T = any>(
    doc: Record<string, any>,
    action: string
  ) {

    return request<{ docs?: T[]; _server_messages?: string }>(
      "/method/frappe.desk.form.save.savedocs",
      {
        method: "POST",

        body:
          JSON.stringify({ doc: JSON.stringify(doc), action }),
      }
    );
  },


  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------

  submitDoc<T = any>(
    doc: Record<string, any>
  ) {

    return request<FrappeResponse<T>>(
      "/method/frappe.client.submit",
      {
        method: "POST",

        body:
          JSON.stringify({ doc }),
      }
    );
  },


  // ----------------------------------------------------------
  // Cancel
  // ----------------------------------------------------------

  cancelDoc<T = any>(
    doctype: string,
    name: string
  ) {

    return request<FrappeResponse<T>>(
      "/method/frappe.client.cancel",
      {
        method: "POST",

        body:
          JSON.stringify({
            doctype,
            name,
          }),
      }
    );
  },


  // ----------------------------------------------------------
  // Connection Test
  // ----------------------------------------------------------

  testConnection() {

    return this.getLoggedUser();
  },


  // ----------------------------------------------------------
  // Base URL
  // ----------------------------------------------------------

  getBaseUrl() {

    return FRAPPE_BASE_URL;
  },
};


export default erpnextApi;

// ============================================================
// Error presentation
// ============================================================

function plainText(value: string) {
  return new DOMParser().parseFromString(value, "text/html").body.textContent?.trim() || "";
}

/**
 * The human message inside a Frappe error: the server's msgprint
 * (`_server_messages`) when present, otherwise the exception text.
 */
export function frappeErrorMessage(cause: unknown, fallback = "ERPNext could not complete the request."): string {
  if (!(cause instanceof FrappeApiError)) return cause instanceof Error ? cause.message : fallback;
  const data = cause.data as { _server_messages?: string; exception?: string; message?: string; exc_type?: string } | null;
  if (data?._server_messages) {
    try {
      const messages = (JSON.parse(data._server_messages) as string[])
        .map((entry) => {
          try { const parsed = JSON.parse(entry); return plainText(String(parsed.message ?? parsed)); } catch { return plainText(entry); }
        })
        .filter(Boolean);
      if (messages.length) return [...new Set(messages)].join(" ");
    } catch { /* fall through */ }
  }
  if (data?.exception) return plainText(data.exception.replace(/^[\w.]+(Error|Exception):\s*/, "")) || fallback;
  if (typeof data?.message === "string") return plainText(data.message);
  if (cause.status === 403) return "You don’t have permission to do this.";
  return fallback;
}

/** Fieldnames Frappe reported as missing in a MandatoryError ("[DocType, name]: a, b"). */
export function missingFieldsFromError(cause: unknown): string[] {
  if (!(cause instanceof FrappeApiError)) return [];
  const data = cause.data as { exc_type?: string; exception?: string } | null;
  if (data?.exc_type !== "MandatoryError" || !data.exception) return [];
  const match = data.exception.match(/\]:\s*(.+)$/);
  return match ? match[1].split(",").map((part) => part.trim()).filter(Boolean) : [];
}
