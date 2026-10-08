import type { DocField, DocTypeMeta } from '@/services/metadata-api';
import type { ERPNextMetadataField, FrappeDocument } from '@/types/erp';

/*
 * Generic DocType engine: everything here is driven by Frappe metadata.
 * Nothing in this file knows about a specific DocType.
 */

/** Structural fields: they shape the layout but hold no value. */
export const LAYOUT_TYPES = new Set(['Section Break', 'Column Break', 'Tab Break', 'Fold']);
/** Fields that hold no document value (layout plus decorative types). */
export const NO_VALUE_TYPES = new Set([...LAYOUT_TYPES, 'HTML', 'Heading', 'Button', 'Image']);
export const TABLE_TYPES = new Set(['Table', 'Table MultiSelect']);
export const NUMERIC_TYPES = new Set(['Int', 'Float', 'Currency', 'Percent']);
export const LONG_TEXT_TYPES = new Set(['Text', 'Small Text', 'Long Text', 'Text Editor', 'Code', 'JSON', 'HTML Editor', 'Markdown Editor']);
/** Fields that span the full row of a section regardless of its columns. */
export const WIDE_TYPES = new Set([...TABLE_TYPES, 'Text Editor', 'Long Text', 'Code', 'JSON', 'HTML Editor', 'Markdown Editor', 'HTML']);

/** Standard columns every document has; never shown as regular fields. */
export const STANDARD_FIELDS = ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx', 'parent', 'parentfield', 'parenttype'];

function humanize(fieldname: string) {
  const words = fieldname.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function normalizeField(field: DocField): ERPNextMetadataField {
  const precision = field.precision === undefined || field.precision === '' ? undefined : Number(field.precision);
  return {
    fieldname: field.fieldname,
    label: field.label || humanize(field.fieldname),
    label_missing: !field.label,
    fieldtype: field.fieldtype,
    options: field.options,
    default: field.default,
    description: field.description,
    reqd: Boolean(field.reqd),
    read_only: Boolean(field.read_only),
    hidden: Boolean(field.hidden),
    bold: Boolean(field.bold),
    in_list_view: Boolean(field.in_list_view),
    in_standard_filter: Boolean(field.in_standard_filter),
    collapsible: Boolean(field.collapsible),
    collapsible_depends_on: field.collapsible_depends_on,
    depends_on: field.depends_on,
    mandatory_depends_on: field.mandatory_depends_on,
    read_only_depends_on: field.read_only_depends_on,
    fetch_from: field.fetch_from,
    precision: Number.isNaN(precision) ? undefined : precision,
    columns: field.columns,
    length: field.length,
    permlevel: field.permlevel ?? 0,
    is_table: TABLE_TYPES.has(field.fieldtype),
    link_target: TABLE_TYPES.has(field.fieldtype) ? field.options : undefined,
  };
}

export function normalizeFields(meta: DocTypeMeta | null | undefined) {
  return (meta?.fields ?? []).map(normalizeField);
}

// ------------------------------------------------------------
// Layout: Tab → Section → Column, exactly as the DocType defines it
// ------------------------------------------------------------

export interface FormSectionLayout {
  key: string;
  label?: string;
  description?: string;
  collapsible: boolean;
  collapsibleDependsOn?: string;
  dependsOn?: string;
  columns: ERPNextMetadataField[][];
}

export interface FormTabLayout {
  key: string;
  label: string;
  dependsOn?: string;
  sections: FormSectionLayout[];
}

/**
 * Label of a Tab/Section Break. Desk shows no heading for an unlabeled section;
 * an unlabeled tab gets its humanized fieldname unless the name is auto-generated.
 */
function breakLabel(field: ERPNextMetadataField) {
  if (!field.label_missing) return field.label;
  if (field.fieldtype !== 'Tab Break') return undefined;
  if (/^(section|tab|column)_break|^sb\d*$|^cb\d*$/.test(field.fieldname)) return undefined;
  return field.label;
}

/**
 * Turns the flat DocField list into the nested layout Desk renders.
 * Empty columns, sections and tabs are dropped so hidden fields take no space.
 */
export function buildLayout(fields: ERPNextMetadataField[], include: (field: ERPNextMetadataField) => boolean = () => true): FormTabLayout[] {
  const tabs: FormTabLayout[] = [];
  let tab: FormTabLayout = { key: 'tab-details', label: 'Details', sections: [] };
  let section: FormSectionLayout = { key: 'section-0', collapsible: false, columns: [[]] };

  const closeSection = () => {
    section.columns = section.columns.filter((column) => column.length);
    if (section.columns.length) tab.sections.push(section);
  };
  const closeTab = () => {
    closeSection();
    if (tab.sections.length) tabs.push(tab);
  };

  fields.forEach((field, index) => {
    if (field.fieldtype === 'Tab Break') {
      closeTab();
      tab = { key: `tab-${field.fieldname || index}`, label: breakLabel(field) || 'Details', dependsOn: field.depends_on, sections: [] };
      section = { key: `section-${index}`, collapsible: false, columns: [[]] };
    } else if (field.fieldtype === 'Section Break') {
      closeSection();
      section = {
        key: `section-${field.fieldname || index}`,
        label: breakLabel(field),
        description: field.description,
        collapsible: Boolean(field.collapsible),
        collapsibleDependsOn: field.collapsible_depends_on,
        dependsOn: field.depends_on,
        columns: [[]],
      };
      if (field.hidden) section.dependsOn = 'eval:false';
    } else if (field.fieldtype === 'Column Break') {
      section.columns.push([]);
    } else if (field.fieldtype !== 'Fold' && include(field)) {
      section.columns[section.columns.length - 1].push(field);
    }
  });
  closeTab();
  return tabs;
}

/** Fieldnames that sit inside collapsible sections (where ERPNext usually auto-fills values). */
export function collapsibleFieldnames(fields: ERPNextMetadataField[]) {
  const names = new Set<string>();
  for (const tab of buildLayout(fields)) {
    for (const section of tab.sections) {
      if (section.collapsible) section.columns.flat().forEach((field) => names.add(field.fieldname));
    }
  }
  return names;
}

// ------------------------------------------------------------
// depends_on / mandatory_depends_on / read_only_depends_on
// ------------------------------------------------------------

export function isTruthyValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '' && value !== 0 && value !== '0' && value !== false;
}

const cint = (value: unknown) => Number.parseInt(String(value ?? 0), 10) || 0;
const flt = (value: unknown) => Number.parseFloat(String(value ?? 0)) || 0;
const cstr = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const inList = (list: unknown[], value: unknown) => Array.isArray(list) && list.includes(value);

/** The small slice of Desk's client globals that DocType expressions commonly use. */
export interface ExpressionContext {
  user?: string;
  roles?: string[];
}

const compiled = new Map<string, ((...args: unknown[]) => unknown) | null>();

/**
 * Evaluate a Frappe display condition the way Desk does:
 * - empty → true
 * - "eval:<js>" → the expression, with `doc`, `parent` and helpers in scope
 * - "fieldname" → truthiness of that field
 * Expressions come from DocType metadata (set by System Managers), the same
 * trust model Desk applies. A failing expression shows the field rather than hiding data.
 */
export function evaluateCondition(expression: string | undefined, doc: Record<string, unknown>, parent?: Record<string, unknown>, context: ExpressionContext = {}) {
  if (!expression) return true;
  const trimmed = expression.trim();
  if (!trimmed.startsWith('eval:')) return isTruthyValue(doc[trimmed]);

  const code = trimmed.slice(5).trim();
  if (!code) return true;
  let fn = compiled.get(code);
  if (fn === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      fn = new Function('doc', 'parent', 'frappe', 'cint', 'flt', 'cstr', 'in_list', `"use strict"; return (${code});`) as (...args: unknown[]) => unknown;
    } catch {
      fn = null;
    }
    compiled.set(code, fn);
  }
  if (!fn) return true;
  const frappe = {
    user: context.user,
    session: { user: context.user },
    user_roles: context.roles ?? [],
    boot: { sysdefaults: {}, user: { roles: context.roles ?? [] } },
    defaults: { get_default: () => undefined, get_user_default: () => undefined },
    datetime: { get_today: () => today(), nowdate: () => today() },
  };
  try {
    return Boolean(fn(doc, parent ?? {}, frappe, cint, flt, cstr, inList));
  } catch {
    return true;
  }
}

// ------------------------------------------------------------
// Defaults & new documents
// ------------------------------------------------------------

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function nowDatetime() {
  const now = new Date();
  return `${today()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

export interface DefaultContext {
  user?: string;
  /** Session defaults such as company and currency, keyed by fieldname or DocType. */
  defaults?: Record<string, unknown>;
}

/** Resolve a DocField default (including Desk's keywords) to a concrete value. */
export function resolveDefault(field: ERPNextMetadataField, context: DefaultContext = {}): unknown {
  const raw = field.default;
  if (raw === undefined || raw === null || raw === '') {
    if (field.fieldtype === 'Check') return 0;
    if (TABLE_TYPES.has(field.fieldtype)) return [];
    if (field.fieldtype === 'Link' && field.options && context.defaults?.[field.options] !== undefined && field.reqd) return context.defaults[field.options];
    if (field.fieldtype === 'Select' && field.reqd) return selectOptions(field)[0] ?? '';
    return undefined;
  }
  const value = String(raw);
  const keyword = value.toLowerCase();
  if (['Date'].includes(field.fieldtype) && keyword === 'today') return today();
  if (['Datetime'].includes(field.fieldtype) && keyword === 'now') return nowDatetime();
  if (field.fieldtype === 'Time' && keyword === 'now') return nowDatetime().slice(11);
  if (value === '__user' || value === 'user') return context.user;
  // ":Company" means "this field's value on the linked Company" — resolved asynchronously by applyDynamicDefaults.
  if (value.startsWith(':')) return undefined;
  if (field.fieldtype === 'Check') return cint(value);
  if (NUMERIC_TYPES.has(field.fieldtype)) return flt(value);
  return value;
}

export function selectOptions(field: Pick<ERPNextMetadataField, 'options'>) {
  return (field.options || '').split('\n').map((option) => option.trim()).filter((option, index, all) => option !== '' || (index === 0 && all.length > 1));
}

export function newDocument(doctype: string, fields: ERPNextMetadataField[], context: DefaultContext = {}): FrappeDocument {
  const doc: FrappeDocument = { name: '', doctype, docstatus: 0, __islocal: 1 };
  for (const field of fields) {
    if (NO_VALUE_TYPES.has(field.fieldtype)) continue;
    const value = resolveDefault(field, context);
    if (value !== undefined) doc[field.fieldname] = value;
  }
  delete (doc as Record<string, unknown>).name;
  return doc;
}

let rowCounter = 0;

export function newChildRow(childDoctype: string, fields: ERPNextMetadataField[], parent: { doctype: string; fieldname: string; idx: number }, context: DefaultContext = {}) {
  const row: Record<string, unknown> = {
    doctype: childDoctype,
    parenttype: parent.doctype,
    parentfield: parent.fieldname,
    idx: parent.idx,
    __islocal: 1,
    // Stable key for rendering before Frappe assigns a name on save.
    __key: `new-row-${Date.now().toString(36)}-${(rowCounter += 1)}`,
  };
  for (const field of fields) {
    if (NO_VALUE_TYPES.has(field.fieldtype)) continue;
    const value = resolveDefault(field, context);
    if (value !== undefined) row[field.fieldname] = value;
  }
  return row;
}

// ------------------------------------------------------------
// Field state (visibility, mandatory, read-only) and validation
// ------------------------------------------------------------

export interface FieldState {
  visible: boolean;
  required: boolean;
  readOnly: boolean;
}

export function fieldState(field: ERPNextMetadataField, doc: Record<string, unknown>, options: { parent?: Record<string, unknown>; readOnly?: boolean; context?: ExpressionContext } = {}): FieldState {
  const visible = !field.hidden && evaluateCondition(field.depends_on, doc, options.parent, options.context);
  const submitted = Number(doc.docstatus ?? 0) > 0;
  const readOnly = Boolean(options.readOnly)
    || field.read_only
    || submitted
    || (field.read_only_depends_on ? evaluateCondition(field.read_only_depends_on, doc, options.parent, options.context) : false);
  const required = field.reqd || (field.mandatory_depends_on ? evaluateCondition(field.mandatory_depends_on, doc, options.parent, options.context) : false);
  return { visible, required: Boolean(required) && !field.read_only, readOnly };
}

export interface ValidationError {
  fieldname: string;
  label: string;
  /** For child rows: the table fieldname and 1-based row number. */
  table?: string;
  tableLabel?: string;
  row?: number;
}

function isMissing(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/** Mandatory-field check over the document and every child row, using metadata only. */
export function validateDocument(
  doc: Record<string, unknown>,
  fields: ERPNextMetadataField[],
  childFields: Record<string, ERPNextMetadataField[]>,
  context: ExpressionContext = {},
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of fields) {
    if (NO_VALUE_TYPES.has(field.fieldtype)) continue;
    const state = fieldState(field, doc, { context });
    if (!state.visible) continue;
    if (state.required && isMissing(doc[field.fieldname])) errors.push({ fieldname: field.fieldname, label: field.label });
    if (TABLE_TYPES.has(field.fieldtype) && field.options && Array.isArray(doc[field.fieldname]) && field.fieldtype === 'Table') {
      const rowFields = childFields[field.options] ?? [];
      (doc[field.fieldname] as Record<string, unknown>[]).forEach((row, index) => {
        for (const rowField of rowFields) {
          if (NO_VALUE_TYPES.has(rowField.fieldtype)) continue;
          const rowState = fieldState(rowField, row, { parent: doc, context });
          if (rowState.visible && rowState.required && isMissing(row[rowField.fieldname])) {
            errors.push({ fieldname: rowField.fieldname, label: rowField.label, table: field.fieldname, tableLabel: field.label, row: index + 1 });
          }
        }
      });
    }
  }
  return errors;
}

// ------------------------------------------------------------
// List & grid columns
// ------------------------------------------------------------

/** Fields Desk would show in a list or a child grid, from `in_list_view`. */
export function listViewFields(fields: ERPNextMetadataField[], options: { limit?: number; titleField?: string } = {}) {
  const limit = options.limit ?? 6;
  const valueFields = fields.filter((field) => !NO_VALUE_TYPES.has(field.fieldtype) && !TABLE_TYPES.has(field.fieldtype) && !LONG_TEXT_TYPES.has(field.fieldtype));
  let chosen = valueFields.filter((field) => field.in_list_view);
  if (!chosen.length) chosen = valueFields.filter((field) => field.reqd && !field.hidden);
  if (!chosen.length) chosen = valueFields.filter((field) => !field.hidden).slice(0, 4);
  if (options.titleField) {
    const title = valueFields.find((field) => field.fieldname === options.titleField);
    if (title && !chosen.includes(title)) chosen = [title, ...chosen];
  }
  return chosen.slice(0, limit);
}

// ------------------------------------------------------------
// Display formatting
// ------------------------------------------------------------

const currencyCache = new Map<string, Intl.NumberFormat>();

/**
 * Currency code for a Currency field. `options` names the field holding the currency
 * (e.g. "currency") or, rarely, a literal ISO code.
 */
export function currencyFor(field: Pick<ERPNextMetadataField, 'options'>, doc?: Record<string, unknown>, parent?: Record<string, unknown>, fallback?: string) {
  const option = (field.options || '').trim();
  if (option && !option.includes(':')) {
    const fromDoc = doc?.[option] ?? parent?.[option];
    if (typeof fromDoc === 'string' && /^[A-Z]{3}$/.test(fromDoc)) return fromDoc;
    if (/^[A-Z]{3}$/.test(option)) return option;
  }
  const docCurrency = doc?.currency ?? parent?.currency;
  if (typeof docCurrency === 'string' && /^[A-Z]{3}$/.test(docCurrency)) return docCurrency;
  return fallback;
}

export function formatCurrency(value: unknown, currency?: string, precision = 2) {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(number)) return '—';
  if (!currency) return number.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
  const key = `${currency}:${precision}`;
  let formatter = currencyCache.get(key);
  if (!formatter) {
    try {
      // Rupee amounts read best in Indian grouping (₹12,34,567).
      formatter = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency, minimumFractionDigits: precision, maximumFractionDigits: precision });
    } catch {
      formatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
    }
    currencyCache.set(key, formatter);
  }
  return formatter.format(number);
}

export function formatDate(value: unknown, withTime = false) {
  if (!value || typeof value !== 'string') return '—';
  const date = new Date(value.includes(' ') ? value.replace(' ', 'T') : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function relativeTime(value: unknown) {
  if (!value || typeof value !== 'string') return '';
  const date = new Date(value.replace(' ', 'T'));
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 60) return 'just now';
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  let amount = seconds / 60;
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [size, unit] of units) {
    if (Math.abs(amount) < size) return format.format(-Math.round(amount), unit);
    amount /= size;
  }
  return '';
}

/** Human-readable value of any field, using its metadata. */
export function formatValue(value: unknown, field: Pick<ERPNextMetadataField, 'fieldtype' | 'options' | 'precision'>, doc?: Record<string, unknown>, parent?: Record<string, unknown>) {
  switch (field.fieldtype) {
    case 'Check': return Number(value) === 1 || value === true ? 'Yes' : 'No';
    case 'Currency': return formatCurrency(value, currencyFor(field, doc, parent), field.precision ?? 2);
    case 'Float': return value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: field.precision ?? 3 });
    case 'Percent': return value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: field.precision ?? 2 })}%`;
    case 'Int': return value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString();
    case 'Date': return formatDate(value);
    case 'Datetime': return formatDate(value, true);
    case 'Password': return value ? '••••••••' : '—';
    default:
      if (value === null || value === undefined || value === '') return '—';
      if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'row' : 'rows'}`;
      if (typeof value === 'object') return '—';
      return String(value);
  }
}

/** Plain text from Text Editor HTML, for compact previews. */
export function stripHtml(value: unknown) {
  if (typeof value !== 'string') return '';
  // DOMParser documents are inert: scripts and event handlers in the value never run.
  return (new DOMParser().parseFromString(value, 'text/html').body.textContent || '').trim();
}

/**
 * Short amount for charts and tiles: ₹4.2L / ₹1.3Cr for rupees, $12.4k / $3.1M otherwise.
 * Full figures belong in tooltips and tables; this is for at-a-glance reading.
 */
export function compactCurrency(value: number, currency?: string) {
  const abs = Math.abs(value);
  const symbol = currency ? formatCurrency(0, currency, 0).replace(/[\d\s.,]/g, '') : '';
  const sign = value < 0 ? '−' : '';
  const trim = (number: number) => number.toFixed(1).replace(/\.0$/, '');
  if (currency === 'INR' && abs >= 1e7) return `${sign}${symbol}${trim(abs / 1e7)}Cr`;
  if (currency === 'INR' && abs >= 1e5) return `${sign}${symbol}${trim(abs / 1e5)}L`;
  if (abs >= 1e6) return `${sign}${symbol}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${trim(abs / 1e3)}k`;
  return `${sign}${symbol}${Math.round(abs)}`;
}
