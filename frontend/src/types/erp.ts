import type { Component } from 'vue';

export type ThemePreference = 'dark' | 'light' | 'system';
export type StatusTone = 'cyan' | 'blue' | 'violet' | 'green' | 'amber' | 'rose' | 'slate';

export interface NavigationItem {
  label: string;
  path: string;
  icon: Component;
  group?: string;
  description?: string;
  /** DocType this entry lists, when it is a DocType list. */
  doctype?: string;
  /** ERPNext report this entry opens. */
  report?: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  tone: StatusTone;
  icon: Component;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: StatusTone;
  /** Optional right-aligned value (amount, quantity) and status for list rows. */
  value?: string;
  status?: string;
}

export interface DocumentListConfig {
  title: string;
  doctype: string;
  description: string;
  /** Unused: list columns come from metadata. Kept for older configs. */
  columns?: string[];
  route: string;
}

/** A DocField normalized from Frappe metadata (0/1 flags become booleans). */
export interface ERPNextMetadataField {
  fieldname: string;
  label: string;
  /** True when ERPNext gave no label and `label` is the humanized fieldname. */
  label_missing?: boolean;
  fieldtype: string;
  reqd?: boolean;
  options?: string;
  read_only?: boolean;
  hidden?: boolean;
  default?: unknown;
  precision?: number;
  description?: string;
  depends_on?: string;
  mandatory_depends_on?: string;
  read_only_depends_on?: string;
  fetch_from?: string;
  in_list_view?: boolean;
  in_standard_filter?: boolean;
  bold?: boolean;
  collapsible?: boolean;
  collapsible_depends_on?: string;
  columns?: number;
  length?: number;
  /** Frappe permission level; fields above 0 need extra role rights. */
  permlevel?: number;
  allow_on_submit?: number | boolean;
  no_copy?: number | boolean;
  link_filters?: string;
  /** Set by form scripts through frm.set_query. */
  get_query?: unknown;
  /** Any other DocField property; form scripts read and set them directly. */
  [key: string]: unknown;
  /** Child DocType for Table / Table MultiSelect fields. */
  link_target?: string;
  is_table?: boolean;
}

/** Evaluated document permissions as returned by Frappe (`docinfo.permissions`). */
export interface DocPermissions {
  read?: number;
  write?: number;
  create?: number;
  delete?: number;
  submit?: number;
  cancel?: number;
  amend?: number;
  print?: number;
  email?: number;
  share?: number;
  report?: number;
  export?: number;
}

export interface FrappeDocument {
  name: string;
  [key: string]: unknown;
}

export interface DocumentListColumn {
  label: string;
  fieldname: string;
  /** Frappe fieldtype when known from metadata; used for display formatting. */
  fieldtype?: string;
  options?: string;
  /** CSS width, e.g. "11rem". */
  width?: string;
}

/** A single ordering rule; a list's ordering is an ordered list of Sorts. */
export interface Sort {
  fieldname: string;
  direction: 'asc' | 'desc';
}

/** A fieldtype-aware condition on a DocType field, in Frappe's filter-tuple form. */
export interface Filter {
  /** Set when the field lives on a child table of the listed DocType. */
  doctype?: string;
  fieldname: string;
  operator: string;
  value: unknown;
}

export interface FrappeListResult<T extends FrappeDocument = FrappeDocument> {
  data: T[];
  total: number;
}

export interface FrappeErrorShape {
  status: number;
  message: string;
  details?: unknown;
}

export interface ChartSegment {
  label: string;
  value: number;
  /** Token name for the segment color, e.g. '--chart-1'. */
  color: string;
  /** Optional preformatted value shown in the legend (e.g. "$42.1k"). */
  display?: string;
}
