import type { DocTypeMeta } from '@/services/metadata-api';
import type { FrappeDocument } from '@/types/erp';
import { staticDocTypes, type StaticDocType } from '@/ngo/doctypes';

/*
 * In-memory backend for static (demo) DocTypes. The document and metadata services
 * consult it first, so lists, records, links and child tables behave exactly like
 * ERPNext — only the data source differs. Everything here is read-only.
 */

const registry = new Map<string, StaticDocType>(staticDocTypes.map((entry) => [entry.meta.name, entry]));

export class StaticReadOnlyError extends Error {
  constructor(doctype: string) {
    super(`${doctype} is demo data from the NGO Impact Console and is read-only.`);
    this.name = 'StaticReadOnlyError';
  }
}

export const isStaticDocType = (doctype: string) => registry.has(doctype);
export const staticDocTypeNames = () => [...registry.keys()];

export function staticMeta(doctype: string): DocTypeMeta | undefined {
  return registry.get(doctype)?.meta;
}

type FilterTuple = unknown[];

function normalizeFilters(filters: unknown): FilterTuple[] {
  if (!filters) return [];
  if (Array.isArray(filters)) return filters.map((filter) => (Array.isArray(filter) && filter.length === 4 ? filter.slice(1) : filter) as FilterTuple);
  return Object.entries(filters as Record<string, unknown>).map(([field, value]) => (Array.isArray(value) ? [field, value[0], value[1]] : [field, '=', value]));
}

function matches(row: FrappeDocument, [field, operator, value]: FilterTuple) {
  const actual = row[String(field)];
  const text = String(actual ?? '').toLowerCase();
  const pattern = String(value ?? '').toLowerCase().replace(/%/g, '');
  switch (String(operator).toLowerCase()) {
    case '=': return String(actual ?? '') === String(value ?? '') || (actual === undefined && (value === 0 || value === '0'));
    case '!=': return String(actual ?? '') !== String(value ?? '');
    case 'like': return text.includes(pattern);
    case 'not like': return !text.includes(pattern);
    case '>': return Number(actual) > Number(value) || String(actual) > String(value);
    case '<': return Number(actual) < Number(value) || String(actual) < String(value);
    case '>=': return Number(actual) >= Number(value) || String(actual) >= String(value);
    case '<=': return Number(actual) <= Number(value) || String(actual) <= String(value);
    case 'in': return (Array.isArray(value) ? value : String(value).split(',')).map(String).includes(String(actual));
    case 'not in': return !(Array.isArray(value) ? value : String(value).split(',')).map(String).includes(String(actual));
    case 'is': return value === 'set' ? actual !== undefined && actual !== null && actual !== '' : actual === undefined || actual === null || actual === '';
    default: return true;
  }
}

export interface StaticQuery {
  fields?: string[];
  filters?: unknown;
  orFilters?: unknown;
  orderBy?: string;
  limit?: number;
  limitStart?: number;
}

function query(doctype: string, options: StaticQuery) {
  const entry = registry.get(doctype);
  if (!entry) return [];
  const all = normalizeFilters(options.filters);
  const any = normalizeFilters(options.orFilters);
  let rows = entry.rows.filter((row) => all.every((filter) => matches(row, filter)) && (!any.length || any.some((filter) => matches(row, filter))));
  const [field, direction] = (options.orderBy || '').split(',')[0].trim().split(/\s+/);
  if (field) {
    const sign = direction?.toLowerCase() === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const left = a[field]; const right = b[field];
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
      return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true }) * sign;
    });
  }
  return rows;
}

export function staticList<T>(doctype: string, options: StaticQuery = {}): T[] {
  const start = options.limitStart ?? 0;
  const rows = query(doctype, options).slice(start, start + (options.limit ?? 20));
  if (!options.fields?.length || options.fields.includes('*')) return rows as T[];
  return rows.map((row) => Object.fromEntries(['name', ...options.fields!].filter((key) => key in row).map((key) => [key, row[key]]))) as T[];
}

export function staticCount(doctype: string, filters?: unknown, orFilters?: unknown) {
  return query(doctype, { filters, orFilters }).length;
}

export function staticGet<T = FrappeDocument>(doctype: string, name: string): T {
  const row = registry.get(doctype)?.rows.find((candidate) => candidate.name === name);
  if (!row) throw new Error(`${doctype} ${name} was not found.`);
  return JSON.parse(JSON.stringify(row)) as T;
}

/** Display title of a static record (its title_field), for Link fields and cells. */
export function staticLinkTitle(doctype: string | undefined, name: unknown): string | undefined {
  if (!doctype || typeof name !== 'string' || !name) return undefined;
  const entry = registry.get(doctype);
  const titleField = entry?.meta.title_field;
  if (!entry || !titleField) return undefined;
  const value = entry.rows.find((row) => row.name === name)?.[titleField];
  return typeof value === 'string' && value !== name ? value : undefined;
}

/** Link search over a static DocType's name and search fields. */
export function staticSearch(doctype: string, txt: string, pageLength = 10) {
  const entry = registry.get(doctype);
  if (!entry) return [];
  const fields = ['name', ...(entry.meta.search_fields || '').split(',').map((field) => field.trim()).filter(Boolean), entry.meta.title_field].filter(Boolean) as string[];
  const needle = txt.trim().toLowerCase();
  return entry.rows
    .filter((row) => !needle || fields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle)))
    .slice(0, pageLength)
    .map((row) => ({ value: row.name, label: entry.meta.title_field ? String(row[entry.meta.title_field] ?? row.name) : row.name, description: fields.slice(1).map((field) => row[field]).filter((value) => value && value !== row[entry.meta.title_field || '']).join(', ') }));
}

/** Records across all static DocTypes matching text (command palette). */
export function staticGlobalSearch(text: string, limit = 6) {
  const results: { doctype: string; name: string; title?: string; content?: string }[] = [];
  for (const [doctype, entry] of registry) {
    if (entry.meta.istable) continue;
    for (const hit of staticSearch(doctype, text, limit)) results.push({ doctype, name: hit.value, title: hit.label, content: hit.description });
  }
  return results.slice(0, limit);
}
