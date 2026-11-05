/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, type Component } from 'vue';
import type { Router } from 'vue-router';
import { API_BASE_URL } from '@/services/erpnext-api';
import { getDocTypeMetadata, metaRegistry, type DocTypeMeta } from '@/services/metadata-api';
import { formatValue, newChildRow, newDocument, NO_VALUE_TYPES, normalizeField, formatCurrency, TABLE_TYPES } from '@/lib/doctype';
import { getDocumentRouteForDocType } from '@/config/navigation';
import { sanitizeHtml } from '@/lib/sanitize';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import type { ERPNextMetadataField } from '@/types/erp';
import { namespace, stub } from './stubs';

/**
 * A Vue-backed implementation of the client API ERPNext's form scripts are written against
 * (`frappe`, `locals`, `cur_frm`, `__`, `flt`…). The scripts themselves are the ones ERPNext
 * serves in DocType metadata, so buttons, queries and triggers stay ERPNext's own: this file
 * only provides the platform they run on, with the Vue UI in place of Desk's.
 */
const win = window as any;

// ---------- Reactive state rendered by DeskHost ----------
export interface MessageEntry { id: number; title?: string; html: string; indicator?: string; primary?: { label: string; action: () => void }; secondary?: { label: string; action: () => void }; wide?: boolean }
export const deskState = reactive({
  freezeCount: 0,
  freezeMessage: '',
  messages: [] as MessageEntry[],
  dialogs: [] as any[],
});
export type { Component };

let router: Router | null = null;
export function bindDeskRouter(instance: Router) { router = instance; }

// ---------- Plain helpers ----------
export const cint = (value: unknown, fallback = 0) => { const parsed = Number.parseInt(String(value), 10); return Number.isNaN(parsed) ? fallback : parsed; };
export const cstr = (value: unknown) => (value === null || value === undefined ? '' : String(value));
function round(value: number, decimals: number) {
  const places = cint(decimals);
  const factor = 10 ** places;
  const scaled = Number((places ? Math.abs(value) * factor : Math.abs(value)).toFixed(8));
  const whole = Math.floor(scaled);
  // Banker's rounding, Frappe's default; the server recomputes authoritative totals on save.
  const rounded = scaled - whole === 0.5 ? (whole % 2 === 0 ? whole : whole + 1) : Math.round(scaled);
  const result = places ? rounded / factor : rounded;
  return value < 0 ? -result : result;
}
export function flt(value: unknown, decimals?: number | null) {
  if (value === null || value === undefined || value === '') return 0;
  let number = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''));
  if (Number.isNaN(number)) number = 0;
  return decimals === null || decimals === undefined ? number : round(number, decimals);
}
const scrub = (text: string) => String(text || '').replace(/ /g, '_').toLowerCase();
const unscrub = (text: string) => String(text || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const random = (length: number) => { let out = ''; const chars = 'abcdefghijklmnopqrstuvwxyz'; while (out.length < length) out += chars[Math.floor(Math.random() * 26)]; return out; };
const escapeHtml = (text: unknown) => String(text ?? '').replace(/[&<>"'`]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[char] as string));

function translate(text: unknown, replace?: unknown[] | null) {
  let out = cstr(text);
  const messages = win.frappe?._messages;
  if (messages && messages[out]) out = messages[out];
  if (replace) out = out.replace(/{(\d+)}/g, (match, index) => (replace[Number(index)] !== undefined ? cstr(replace[Number(index)]) : match));
  return out;
}

// ---------- Field metadata store ----------
/** The docfields in effect, per DocType. The open form registers its own reactive copies here, so script edits reach the UI. */
const dfStore = new Map<string, ERPNextMetadataField[]>();
export function registerFormFields(doctype: string, fields: ERPNextMetadataField[]) { dfStore.set(doctype, fields); }
export function docfields(doctype: string): ERPNextMetadataField[] {
  let fields = dfStore.get(doctype);
  if (!fields) {
    const meta = metaRegistry.get(doctype);
    if (!meta) return [];
    fields = (meta.fields ?? []).map(normalizeField);
    dfStore.set(doctype, fields);
  }
  return fields;
}
const docfield = (doctype: string, fieldname: string) => docfields(doctype).find((field) => field.fieldname === fieldname);

function fieldPrecision(df: any) {
  if (df && cint(df.precision)) return cint(df.precision);
  if (df?.fieldtype === 'Currency') return cint(win.frappe.defaults.get_default('currency_precision')) || 2;
  return cint(win.frappe.defaults.get_default('float_precision')) || 3;
}

/** frappe.utils.filter_dict: {key: value} or {key: [operator, value]}, over a list or a map. */
function filterDict(source: any, filters: Record<string, any>): any[] {
  const list: any[] = Array.isArray(source) ? source : Object.values(source ?? {});
  return list.filter((row) => Object.entries(filters).every(([key, rule]) => {
    if (!Array.isArray(rule)) return row[key] === rule;
    const [operator, value] = rule;
    if (operator === 'in') return value.includes(row[key]);
    if (operator === 'not in') return !value.includes(row[key]);
    if (operator === '!=') return row[key] !== value;
    if (operator === '>') return row[key] > value;
    if (operator === '<') return row[key] < value;
    return row[key] === value;
  }));
}

// ---------- Locals: the in-memory documents scripts read and write ----------
const locals: Record<string, Record<string, any>> = {};
win.locals = locals;
const newName = (doctype: string) => `new-${doctype.toLowerCase().replace(/ /g, '-')}-${random(10)}`;
const store = (doc: any) => { (locals[doc.doctype] ??= {})[doc.name] = doc; };

/** Registers a document and its rows (named if new). Pass the reactive form document to keep identity. */
export function indexDoc(doc: any) {
  if (!doc?.doctype) return doc;
  if (!doc.name && doc.__islocal) doc.name = newName(doc.doctype);
  store(doc);
  for (const key of Object.keys(doc)) {
    const rows = doc[key];
    if (!Array.isArray(rows)) continue;
    rows.forEach((_, index) => {
      const row = rows[index];
      if (row && typeof row === 'object' && row.doctype) {
        if (!row.name) { row.name = newName(row.doctype); row.__islocal = 1; }
        if (!row.parent) row.parent = doc.name;
        if (!row.parentfield) row.parentfield = key;
        if (!row.parenttype) row.parenttype = doc.doctype;
        store(row);
      }
    });
  }
  return doc;
}

/** Merge a server copy into the live document so the form updates in place (frappe.model.sync). */
function updateInLocals(local: any, incoming: any) {
  for (const [key, value] of Object.entries<any>(incoming)) {
    if (Array.isArray(value) && value.every((row) => row && typeof row === 'object')) {
      const current: any[] = Array.isArray(local[key]) ? local[key] : [];
      local[key] = value.map((row) => {
        const existing = row.name ? current.find((entry) => entry.name === row.name) : undefined;
        if (existing) { Object.assign(existing, row); return existing; }
        return row;
      });
    } else {
      local[key] = value;
    }
  }
}
function syncDocs(input: any) {
  const envelope = input && (input.docs || input.docinfo) ? input : { docs: input };
  const list = Array.isArray(envelope.docs) ? envelope.docs : envelope.docs ? [envelope.docs] : [];
  const result = list.map((doc: any) => {
    if (!doc?.doctype) return doc;
    if (!doc.name && doc.__islocal) doc.name = newName(doc.doctype);
    const existing = doc.name ? locals[doc.doctype]?.[doc.name] : undefined;
    if (doc.doctype === 'DocType') { metaRegistry.set(doc.name, doc); return doc; }
    if (existing) { updateInLocals(existing, doc); return indexDoc(existing); }
    return indexDoc(doc);
  });
  if (envelope.docinfo) win.frappe.model.docinfo[envelope.docinfo.doctype] = { ...(win.frappe.model.docinfo[envelope.docinfo.doctype] ?? {}), [envelope.docinfo.name]: envelope.docinfo };
  return result;
}

function emptyDoc(doctype: string, parentDoc?: any, parentfield?: string, withMandatoryChildren?: boolean) {
  const fields = docfields(doctype);
  const defaults = bootContext();
  if (parentDoc) {
    const row = newChildRow(doctype, fields, { doctype: parentDoc.doctype, fieldname: parentfield ?? '', idx: (parentDoc[parentfield ?? '']?.length ?? 0) + 1 }, defaults);
    row.parent = parentDoc.name;
    return row;
  }
  const doc: any = newDocument(doctype, fields, defaults);
  doc.name = newName(doctype);
  doc.__unsaved = 1;
  doc.owner = win.frappe.session.user;
  if (withMandatoryChildren) createMandatoryChildren(doc);
  return doc;
}
/** Required child tables start with one empty row, as in Desk. */
export function createMandatoryChildren(doc: any) {
  for (const field of docfields(doc.doctype)) {
    if (field.fieldtype === 'Table' && field.reqd && field.options && !doc[field.fieldname]?.length) {
      doc[field.fieldname] = [newChildRow(field.options, docfields(field.options), { doctype: doc.doctype, fieldname: field.fieldname, idx: 1 }, bootContext())];
      doc[field.fieldname][0].parent = doc.name;
    }
  }
  return doc;
}
export function bootContext() {
  const boot = win.frappe?.boot ?? {};
  const sys = boot.sysdefaults ?? {};
  return {
    user: win.frappe?.session?.user,
    defaults: { ...(sys.company ? { Company: sys.company, company: sys.company } : {}), ...(sys.currency ? { Currency: sys.currency, currency: sys.currency } : {}), ...(boot.user?.defaults ?? {}) },
  };
}

const NEVER_COPIED = new Set(['name', 'amended_from', 'amendment_date', 'cancel_reason']);
/** Desk's copy rules: only real fields, and "No Copy" ones are kept only when amending. */
function copyValues(source: any, doctype: string, fromAmend?: boolean) {
  const out: any = {};
  for (const field of docfields(doctype)) {
    if (NEVER_COPIED.has(field.fieldname) || NO_VALUE_TYPES.has(field.fieldtype) || (!fromAmend && field.no_copy)) continue;
    if (source[field.fieldname] !== undefined) out[field.fieldname] = source[field.fieldname];
  }
  return out;
}
function copyDoc(doc: any, fromAmend?: boolean) {
  const plain = JSON.parse(JSON.stringify(doc));
  const copy: any = { ...copyValues(plain, doc.doctype, fromAmend), doctype: doc.doctype, docstatus: 0, __islocal: 1, __unsaved: 1, name: newName(doc.doctype), owner: win.frappe.session.user };
  for (const field of docfields(doc.doctype)) {
    if (!TABLE_TYPES.has(field.fieldtype) || !Array.isArray(copy[field.fieldname])) continue;
    copy[field.fieldname] = copy[field.fieldname].map((row: any, index: number) => ({
      ...copyValues(row, row.doctype ?? field.options, fromAmend),
      doctype: row.doctype ?? field.options, docstatus: 0, idx: index + 1, __islocal: 1, name: newName(row.doctype ?? field.options ?? 'row'), parent: copy.name, parentfield: field.fieldname, parenttype: doc.doctype,
    }));
  }
  return indexDoc(copy);
}

// ---------- Requests ----------
let inFlight = 0;
const idleWaiters: Array<() => void> = [];
const settleRequest = () => { inFlight -= 1; if (inFlight === 0) idleWaiters.splice(0).forEach((resolve) => resolve()); };
const afterServerCall = () => (inFlight === 0 ? Promise.resolve() : new Promise<void>((resolve) => { idleWaiters.push(resolve); }));

function plainMessage(html: string) { return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || html; }
function showServerMessages(raw?: string) {
  if (!raw) return;
  try {
    for (const entry of JSON.parse(raw) as string[]) {
      let parsed: any;
      try { parsed = JSON.parse(entry); } catch { parsed = { message: entry }; }
      win.frappe.msgprint(parsed);
    }
  } catch { /* not a message list */ }
}

function encodeArgs(args: Record<string, unknown>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || typeof value === 'function') continue;
    if (value === null) body.set(key, '');
    else body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return body;
}

function frappeCall(first: any, argsArg?: any, callbackArg?: any): any {
  const opts: any = typeof first === 'string' ? { method: first, args: argsArg, callback: callbackArg } : first;
  const args: Record<string, unknown> = { ...(opts.args ?? {}) };
  let method = opts.method as string;
  if (opts.doc) {
    args.docs = win.frappe.get_doc(opts.doc.doctype, opts.doc.name) ?? opts.doc;
    args.method = opts.method;
    args.args = opts.args;
    method = 'run_doc_method';
  } else if (opts.module && opts.page) {
    method = `${opts.module}.page.${opts.page}.${opts.page}.${opts.method}`;
  }
  const type = String(opts.type || 'POST').toUpperCase();
  const encoded = encodeArgs(args);
  const url = `${API_BASE_URL}/method/${method}${type === 'GET' && encoded.size ? `?${encoded}` : ''}`;
  const freeze = opts.freeze || (opts.args as any)?.freeze;
  if (freeze) { deskState.freezeCount += 1; deskState.freezeMessage = opts.freeze_message || ''; }
  inFlight += 1;

  const promise: any = fetch(url, {
    method: type,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(type === 'GET' ? {} : { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }), ...(opts.headers ?? {}) },
    ...(type === 'GET' ? {} : { body: encoded }),
  }).then(async (response) => {
    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (data.docs || data.docinfo) data.docs = syncDocs(data);
    showServerMessages(data._server_messages);
    if (!response.ok) {
      data.exc = data.exc || data.exception || `HTTP ${response.status}`;
      if (!data._server_messages && !opts.silent) win.frappe.msgprint({ title: translate('Error'), indicator: 'red', message: escapeHtml(plainMessage(cstr(data.exception).replace(/^[\w.]+(Error|Exception):\s*/, '')) || `The server returned ${response.status}.`) });
      opts.error?.(data);
      opts.callback?.(data, text);
      throw Object.assign(new Error(cstr(data.exception) || `Request failed: ${method}`), { response: data, status: response.status });
    }
    opts.callback?.(data, text);
    return data;
  }).finally(() => {
    settleRequest();
    if (freeze) deskState.freezeCount = Math.max(0, deskState.freezeCount - 1);
    opts.always?.();
  });
  promise.catch(() => { /* reported above; scripts that care attach their own handler */ });
  return decorate(promise);
}
/** Scripts expect jQuery-style promises. */
function decorate(promise: any) {
  promise.done = (fn: any) => { promise.then(fn, () => undefined); return promise; };
  promise.fail = (fn: any) => { promise.then(undefined, fn); return promise; };
  promise.always = (fn: any) => { promise.then(fn, fn); return promise; };
  return promise;
}
const xcall = (method: string, args?: any, type?: string) => frappeCall({ method, args, type }).then((response: any) => response.message);

async function runSerially(tasks: Array<(() => unknown) | unknown>) {
  let result: unknown;
  for (const task of tasks) if (typeof task === 'function') result = await task();
  return result;
}

// ---------- Messages ----------
let messageId = 0;
export class ValidationStop extends Error {}
function renderMessage(message: any) {
  if (message.as_table && Array.isArray(message.message)) {
    return `<table class="desk-msg-table">${message.message.map((row: unknown[]) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  if (message.as_list && Array.isArray(message.message)) return `<ul>${message.message.map((item: unknown) => `<li>${cstr(item)}</li>`).join('')}</ul>`;
  return Array.isArray(message.message) ? message.message.map(cstr).join('<br>') : cstr(message.message);
}
function msgprint(input: any, title?: string, isMinimizable?: boolean) {
  const message: any = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : { message: input, title };
  void isMinimizable;
  if (message.alert) { showAlert({ message: message.message, indicator: message.indicator }); return dialogHandle(0); }
  const id = (messageId += 1);
  const action = (spec: any) => (spec ? {
    label: spec.label ?? translate('OK'),
    action: () => {
      if (spec.server_action) frappeCall({ method: spec.server_action, args: { args: spec.args }, freeze: true });
      else if (spec.client_action) { const fn = spec.client_action.split('.').reduce((scope: any, key: string) => scope?.[key], win); fn?.(spec.args); }
      else spec.action?.(spec.args);
      dismissMessage(id);
    },
  } : undefined);
  deskState.messages.push({ id, title: message.title, html: sanitizeHtml(renderMessage(message)), indicator: message.indicator, primary: action(message.primary_action), secondary: action(message.secondary_action), wide: message.wide });
  return dialogHandle(id);
}
export function dismissMessage(id: number) { deskState.messages = deskState.messages.filter((entry) => entry.id !== id); }
const dialogHandle = (id: number) => namespace({ hide: () => dismissMessage(id), show: () => undefined }, 'msg_dialog');
function frappeThrow(input: any, excType?: unknown) {
  void excType;
  const message = input && typeof input === 'object' ? input : { message: input };
  msgprint({ indicator: 'red', title: translate('Error'), ...message });
  throw new ValidationStop(typeof message.message === 'string' ? plainMessage(message.message) : 'Validation failed');
}
function showAlert(input: any, seconds?: number) {
  void seconds;
  const message = typeof input === 'string' ? { message: input } : input;
  const text = plainMessage(cstr(message.message ?? message.body ?? ''));
  const toast = useToast();
  const indicator = message.indicator || message.color;
  if (indicator === 'red' || indicator === 'error') toast.error(text);
  else if (indicator === 'orange' || indicator === 'yellow' || indicator === 'warning') toast.warning(text);
  else if (indicator === 'green' || indicator === 'success') toast.success(text);
  else toast.info(text);
  return stub('alert');
}
function frappeConfirm(message: string, yes?: () => void, no?: () => void) {
  void useConfirm().confirm({ title: translate('Confirm'), message: plainMessage(cstr(message)), confirmLabel: translate('Yes') }).then((ok) => (ok ? yes?.() : no?.()));
  return stub('confirm');
}

// ---------- Routing ----------
function routeOptionsQuery(options: any) {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(options ?? {})) {
    if (value === undefined || value === null || typeof value === 'function') continue;
    query[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return query;
}
function setRoute(...input: any[]) {
  let parts: string[] = input.flat().filter((part) => part !== undefined && part !== null).map(String);
  if (parts.length === 1 && parts[0].includes('/')) parts = parts[0].split('/').map((part) => decodeURIComponent(part));
  const options = win.frappe.route_options;
  win.frappe.route_options = null;
  const [view, doctype, name] = parts;
  const kind = String(view || '').toLowerCase();
  const go = (location: any) => router?.push(location) ?? Promise.resolve();
  if (kind === 'form' && doctype) {
    if (!name) return go({ name: 'document-detail', params: { doctype, name: doctype } });
    const local = locals[doctype]?.[name];
    if (local?.__islocal || name.startsWith('new-')) {
      if (!local) return go({ name: 'document-create', params: { doctype }, query: routeOptionsQuery(options) });
      return go({ name: 'document-create', params: { doctype }, query: { __local: name } });
    }
    return go({ name: 'document-detail', params: { doctype, name } });
  }
  if ((kind === 'list' || kind === 'tree' || kind === 'report') && doctype && kind !== 'report') return go({ path: getDocumentRouteForDocType(doctype), query: routeOptionsQuery(options) });
  if (kind === 'query-report' && doctype) return go({ name: 'report', params: { report: doctype }, query: routeOptionsQuery(options) });
  if (kind === 'report' && doctype) return name ? go({ name: 'report', params: { report: name }, query: routeOptionsQuery(options) }) : go({ path: getDocumentRouteForDocType(doctype), query: routeOptionsQuery(options) });
  showAlert({ message: translate('This page is not available in this interface yet: {0}', [parts.join(' / ')]), indicator: 'orange' });
  return Promise.resolve();
}
function getRoute() {
  const route = router?.currentRoute.value;
  if (!route) return [];
  const doctype = route.params.doctype as string | undefined;
  if (route.name === 'document-detail') return ['Form', doctype, route.params.name];
  if (route.name === 'document-create') return ['Form', doctype, win.cur_frm?.docname];
  if (route.name === 'report') return ['query-report', route.params.report];
  return doctype ? ['List', doctype, 'List'] : [];
}
function newDoc(doctype: string, opts?: any, initCallback?: (doc: any) => void) {
  if (opts && typeof opts === 'object') win.frappe.route_options = { ...(win.frappe.route_options ?? {}), ...opts };
  return withDoctype(doctype).then(() => {
    const doc = indexDoc(emptyDoc(doctype, undefined, undefined, true));
    Object.assign(doc, win.frappe.route_options ?? {});
    win.frappe.route_options = null;
    initCallback?.(doc);
    return setRoute('Form', doctype, doc.name);
  });
}
const withDoctype = (doctype: string, callback?: () => void) => getDocTypeMetadata(doctype).then(() => { callback?.(); });

// ---------- Permissions ----------
const canList = (key: string, doctype: string) => Boolean(win.frappe.boot?.user?.[key]?.includes?.(doctype));
export function roles(): string[] { return win.frappe?.boot?.user?.roles ?? []; }
/** Role-based rights per permlevel, computed from metadata as Desk does. */
export function levelPerms(meta: DocTypeMeta | null | undefined, level: number) {
  const mine = new Set(roles());
  const rights: Record<string, number> = {};
  for (const rule of (meta?.permissions ?? []) as any[]) {
    if (cint(rule.permlevel) !== level || !mine.has(rule.role)) continue;
    for (const [key, value] of Object.entries(rule)) if (typeof value === 'number' && value && key !== 'permlevel') rights[key] = 1;
  }
  return rights;
}

// ---------- Dates (Desk's API over the same moment.js build) ----------
const dateTime = () => {
  const moment = () => win.moment;
  const parse = (value: any) => moment()(value);
  const dateFormat = () => (win.frappe.sys_defaults?.date_format || 'yyyy-mm-dd').toUpperCase();
  return namespace({
    get_today: () => moment()().format('YYYY-MM-DD'),
    nowdate: () => moment()().format('YYYY-MM-DD'),
    now_date: (asObject?: boolean) => (asObject ? moment()().toDate() : moment()().format('YYYY-MM-DD')),
    now_datetime: (asObject?: boolean) => (asObject ? moment()().toDate() : moment()().format('YYYY-MM-DD HH:mm:ss')),
    now_time: (asObject?: boolean) => (asObject ? moment()() : moment()().format('HH:mm:ss')),
    system_datetime: () => moment()().format('YYYY-MM-DD HH:mm:ss'),
    convert_to_user_tz: (value: any) => value,
    convert_to_system_tz: (value: any) => value,
    is_system_time_zone: () => true,
    str_to_obj: (value: any) => (value ? parse(value).toDate() : value),
    obj_to_str: (value: any) => (value ? moment()(value).format('YYYY-MM-DD') : ''),
    obj_to_user: (value: any) => moment()(value).format(dateFormat()),
    get_datetime_as_string: (value: any) => moment()(value ?? undefined).format('YYYY-MM-DD HH:mm:ss'),
    add_days: (date: any, days: number) => parse(date).add(days, 'days').format('YYYY-MM-DD'),
    add_months: (date: any, months: number) => parse(date).add(months, 'months').format('YYYY-MM-DD'),
    get_diff: (a: any, b: any) => moment()(a).startOf('day').diff(moment()(b).startOf('day'), 'days'),
    get_day_diff: (a: any, b: any) => moment()(a).startOf('day').diff(moment()(b).startOf('day'), 'days'),
    get_hour_diff: (a: any, b: any) => moment()(a).diff(moment()(b), 'hours'),
    get_minute_diff: (a: any, b: any) => moment()(a).diff(moment()(b), 'minutes'),
    month_start: () => moment()().startOf('month').format('YYYY-MM-DD'),
    month_end: () => moment()().endOf('month').format('YYYY-MM-DD'),
    quarter_start: () => moment()().startOf('quarter').format('YYYY-MM-DD'),
    quarter_end: () => moment()().endOf('quarter').format('YYYY-MM-DD'),
    year_start: () => moment()().startOf('year').format('YYYY-MM-DD'),
    year_end: () => moment()().endOf('year').format('YYYY-MM-DD'),
    str_to_user: (value: any) => (value ? parse(value).format(String(value).length > 10 ? `${dateFormat()} HH:mm:ss` : dateFormat()) : ''),
    user_to_str: (value: any) => (value ? moment()(value, dateFormat()).format('YYYY-MM-DD') : ''),
    global_date_format: (value: any) => moment()(value).format('MMMM DD, YYYY'),
    get_user_date_fmt: () => win.frappe.sys_defaults?.date_format || 'yyyy-mm-dd',
    get_user_fmt: () => win.frappe.sys_defaults?.date_format || 'yyyy-mm-dd',
    prettyDate: (value: any) => moment()(value).fromNow(),
    comment_when: (value: any) => moment()(value).fromNow(),
  }, 'frappe.datetime');
};

// ---------- Templates (Desk's microtemplate) ----------
const templateCache = new Map<string, (data: unknown) => string>();
function compileTemplate(source: string, key: string) {
  const cached = templateCache.get(key);
  if (cached) return cached;
  const str = source.replace(/{{/g, '{%=').replace(/}}/g, '%}')
    .replace(/{%\s?if\s?\s?not\s?([^(][^%{]+)\s?%}/g, '{% if (! $1) { %}')
    .replace(/{%\s?if\s?([^(][^%{]+)\s?%}/g, '{% if ($1) { %}')
    .replace(/{%\s?for\s([a-z._]+)\sin\s([a-z._]+)\s?%}/g, (_match, item, list) => { const i = random(3); const len = random(3); return `{% for (var ${i}=0, ${len}=${list}.length; ${i}<${len}; ${i}++) { var ${item} = ${list}[${i}]; ${item}._index = ${i}; %}`; })
    .replace(/{%\s?endif\s?%}/g, '{% }; %}')
    .replace(/{%\s?else\s?%}/g, '{% } else { %}')
    .replace(/{%\s?endfor\s?%}/g, '{% }; %}');
  const body = `var _p=[],print=function(){_p.push.apply(_p,arguments)};with(obj){\n_p.push('${str.replace(/[\r\t\n]/g, ' ').split('{%').join('\t').replace(/((^|%})[^\t]*)'/g, '$1\r').replace(/\t=(.*?)%}/g, "',$1,'").split('\t').join("');\n").split('%}').join("\n_p.push('").split('\r').join("\\'")}');}return _p.join('');`;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const compiled = new Function('obj', body) as (data: unknown) => string;
  templateCache.set(key, compiled);
  return compiled;
}
function renderTemplate(name: string, data: unknown = {}) {
  const template = name.includes(' ') ? name : win.frappe.templates[name];
  if (!template) { console.debug(`[desk] template not found: ${name}`); return ''; }
  return compileTemplate(template, name)(data);
}

// ---------- The frappe global ----------
function buildFrappe() {
  const handlers: Record<string, Record<string, any[]>> = {};
  const handlerList = (doctype: string, event: string) => (((win.frappe.ui.form.handlers[doctype] ??= {})[event] ??= []) as any[]);

  const formNamespace = namespace({
    handlers,
    get_event_handler_list: handlerList,
    on(doctype: string, fieldname: any, handler?: any) {
      const add = (event: string, fn: any) => {
        handlerList(doctype, event).push(fn);
        if (win.cur_frm && win.cur_frm.doctype === doctype) win.cur_frm.events[event] = fn;
      };
      if (!handler && fieldname && typeof fieldname === 'object') {
        for (const [event, fn] of Object.entries(fieldname)) if (typeof fn === 'function') add(event, fn);
      } else if (typeof fieldname === 'string') add(fieldname, handler);
    },
    off(doctype: string, fieldname: string) {
      if (win.frappe.ui.form.handlers[doctype]) win.frappe.ui.form.handlers[doctype][fieldname] = [];
      if (win.cur_frm?.doctype === doctype) { delete win.cur_frm.events?.[fieldname]; delete win.cur_frm.cscript?.[fieldname]; }
    },
    trigger(doctype: string, fieldname: string) { return win.cur_frm?.script_manager.trigger(fieldname, doctype); },
    make_quick_entry(doctype: string, _after: any, init: any, doc: any) {
      return withDoctype(doctype).then(() => {
        const draft = doc ?? indexDoc(emptyDoc(doctype, undefined, undefined, true));
        indexDoc(draft);
        init?.(draft);
        return setRoute('Form', doctype, draft.name);
      });
    },
    is_saving: false,
    Controller: class Controller { constructor(opts: any) { Object.assign(this, opts); } },
  }, 'frappe.ui.form');
  const uiNamespace = namespace({ form: formNamespace }, 'frappe.ui');

  const model = namespace({
    docinfo: {} as any,
    std_fields_list: ['name', 'owner', 'creation', 'modified', 'modified_by', '_user_tags', '_comments', '_assign', '_liked_by', 'docstatus', 'idx'],
    child_table_field_list: ['parent', 'parenttype', 'parentfield'],
    no_value_type: [...NO_VALUE_TYPES],
    layout_fields: ['Section Break', 'Column Break', 'Tab Break', 'Fold'],
    table_fields: [...TABLE_TYPES],
    numeric_fieldtypes: ['Int', 'Float', 'Currency', 'Percent'],
    core_doctypes_list: ['DocType', 'DocField', 'DocPerm', 'User', 'Role', 'Has Role', 'Page', 'Module Def', 'Print Format', 'Report', 'Customize Form', 'Customize Form Field', 'Property Setter', 'Custom Field', 'Client Script'],
    new_names: {} as Record<string, string>,
    events: {} as Record<string, Record<string, any[]>>,
    scrub, unscrub,
    sync: syncDocs,
    add_to_locals: indexDoc,
    get_new_name: newName,
    get_doc: (doctype: string, name?: string) => win.frappe.get_doc(doctype, name),
    get_list: (doctype: string, filters?: any) => {
      const all = Object.values(locals[doctype] ?? {});
      if (!filters) return all;
      return all.filter((doc: any) => Object.entries(filters).every(([key, value]) => doc[key] === value));
    },
    get_value(doctype: string, filters: any, fieldname: string, callback?: (value: unknown) => void) {
      if (callback) return win.frappe.db.get_value(doctype, filters, fieldname).then((response: any) => callback(response.message?.[fieldname]));
      return typeof filters === 'string' ? locals[doctype]?.[filters]?.[fieldname] : undefined;
    },
    get_children(parent: any, parentfield?: string) {
      return parent?.[parentfield ?? ''] ?? [];
    },
    get_new_doc: emptyDoc,
    make_new_doc_and_get_name: (doctype: string) => indexDoc(emptyDoc(doctype, undefined, undefined, true)).name,
    set_default_values: () => undefined,
    with_doctype: withDoctype,
    with_doc(doctype: string, name: string, callback?: (name: string, response: any) => void) {
      if (locals[doctype]?.[name]) { const doc = locals[doctype][name]; callback?.(name, { docs: [doc] }); return Promise.resolve(doc); }
      return frappeCall({ type: 'GET', method: 'frappe.desk.form.load.getdoc', args: { doctype, name } }).then((response: any) => { callback?.(name, response); return locals[doctype]?.[name]; });
    },
    add_child(parent: any, doctype: any, parentfield?: string, idx?: number) {
      // add_child(doc, parentfield) is also accepted.
      let field = parentfield;
      let childType = doctype;
      if (field === undefined || typeof field === 'number') { idx = field as number | undefined; field = doctype; childType = docfield(parent.doctype, doctype)?.options; }
      const list = (parent[field!] ??= []);
      const row = emptyDoc(childType, parent, field);
      row.name = newName(childType);
      row.idx = idx ?? list.length + 1;
      if (idx !== undefined) list.splice(idx - 1, 0, row); else list.push(row);
      list.forEach((entry: any, index: number) => { entry.idx = index + 1; });
      const live = list.find((entry: any) => entry.name === row.name);
      store(live);
      win.cur_frm?.markDirty?.();
      return live;
    },
    clear_table(doc: any, parentfield: string) { doc[parentfield] = []; },
    clear_doc(doctype: string, name: string) { if (locals[doctype]) delete locals[doctype][name]; },
    remove_from_locals(doctype: string, name: string) { if (locals[doctype]) delete locals[doctype][name]; },
    copy_doc: copyDoc,
    has_value(doctype: string, name: string, fieldname: string) {
      const value = locals[doctype]?.[name]?.[fieldname];
      return !(value === undefined || value === null || value === '');
    },
    round_floats_in(doc: any, fieldnames?: string[]) {
      const names = fieldnames ?? docfields(doc.doctype).filter((field) => ['Float', 'Currency', 'Percent'].includes(field.fieldtype)).map((field) => field.fieldname);
      for (const name of names) doc[name] = flt(doc[name], fieldPrecision(docfield(doc.doctype, name)));
    },
    validate_missing(doc: any, fieldname: string) {
      if (!doc[fieldname]) win.frappe.throw(translate('Please specify') + `: ${translate(docfield(doc.doctype, fieldname)?.label ?? fieldname)}`);
    },
    get_server_module_name(doctype: string) { const meta: any = metaRegistry.get(doctype); return `${scrub(meta?.module ?? '')}.doctype.${scrub(doctype)}.${scrub(doctype)}`; },
    can_create: (doctype: string) => canList('can_create', doctype),
    can_read: (doctype: string) => canList('can_read', doctype),
    can_write: (doctype: string) => canList('can_write', doctype),
    can_delete: (doctype: string) => canList('can_delete', doctype),
    can_submit: (doctype: string) => canList('can_submit', doctype),
    can_cancel: (doctype: string) => canList('can_cancel', doctype),
    is_submittable: (doctype: string) => Boolean(metaRegistry.get(doctype)?.is_submittable),
    is_single: (doctype: string) => Boolean(metaRegistry.get(doctype)?.issingle),
    is_table: (doctype: string) => Boolean(metaRegistry.get(doctype)?.istable),
    is_tree: (doctype: string) => Boolean(metaRegistry.get(doctype)?.is_tree),
    get_doc_title: (doc: any) => doc?.name,
    on(doctype: string, fieldname: string, fn: any) { ((model.events[doctype] ??= {})[fieldname] ??= []).push(fn); },
    set_value(doctype: any, name: any, fieldname: any, value?: any, fieldtype?: any, skipDirty?: boolean) {
      // Also called as set_value(cdt, cdn, {field: value, …}).
      void fieldtype;
      const doc = locals[doctype]?.[name] ?? win.frappe.get_doc(doctype, name);
      if (!doc) return Promise.resolve();
      const changes: Record<string, unknown> = typeof fieldname === 'string' ? { [fieldname]: value } : fieldname;
      const tasks: Array<() => unknown> = [];
      for (const [key, next] of Object.entries(changes)) {
        const current = doc[key];
        const same = current === next || ((current === undefined || current === null || current === '') && (next === undefined || next === null || next === ''));
        if (same) continue;
        doc[key] = next;
        tasks.push(() => model.trigger(key, next, doc, skipDirty));
      }
      return runSerially(tasks);
    },
    trigger(fieldname: string, value: unknown, doc: any, skipDirty?: boolean) {
      const tasks: Array<() => unknown> = [];
      const listeners = [...(model.events[doc.doctype]?.[fieldname] ?? []), ...(model.events[doc.doctype]?.['*'] ?? []), ...(model.events['*']?.[fieldname] ?? [])];
      for (const listener of listeners) tasks.push(() => listener(fieldname, value, doc, skipDirty));
      const frm = win.cur_frm;
      if (frm) {
        if (!skipDirty) frm.markDirty?.();
        tasks.push(() => frm.script_manager.trigger(fieldname, doc.doctype, doc.name));
      }
      return runSerially(tasks);
    },
    open_mapped_doc(opts: any) {
      if (opts.frm?.doc.__unsaved) return win.frappe.throw(translate('You have unsaved changes in this form. Please save before you continue.'));
      const source = opts.source_name ?? opts.frm?.doc.name ?? null;
      return frappeCall({
        type: 'POST', method: 'frappe.model.mapper.make_mapped_doc', freeze: true, freeze_message: opts.freeze_message || '',
        args: { method: opts.method, source_name: source, args: opts.args || null, selected_children: opts.frm ? opts.frm.get_selected() : null },
        callback(response: any) {
          if (response.exc) return;
          const [doc] = syncDocs(response.message);
          if (opts.run_link_triggers) doc.__run_link_triggers = true;
          void setRoute('Form', doc.doctype, doc.name);
        },
      });
    },
    rename_doc: () => undefined,
  }, 'frappe.model');

  const meta = namespace({
    docfield_map: new Proxy({}, { get: (_t, doctype: string) => Object.fromEntries(docfields(doctype).map((field) => [field.fieldname, field])) }),
    get_docfield: (doctype: string, fieldname: string) => docfield(doctype, fieldname),
    get_docfields: (doctype: string, _name?: string, filters?: any) => (filters ? filterDict(docfields(doctype), filters) : docfields(doctype)),
    get_fieldnames: (doctype: string, _name?: string, filters?: any) => (filters ? filterDict(docfields(doctype), filters) : docfields(doctype)).map((field: any) => field.fieldname),
    get_field: (doctype: string, fieldname: string) => docfield(doctype, fieldname),
    has_field: (doctype: string, fieldname: string) => Boolean(docfield(doctype, fieldname)),
    get_table_fields: (doctype: string) => docfields(doctype).filter((field) => TABLE_TYPES.has(field.fieldtype)),
    get_label: (doctype: string, fieldname: string) => docfield(doctype, fieldname)?.label ?? (fieldname === 'name' ? translate('ID') : unscrub(fieldname)),
    get_translated_label: (doctype: string, fieldname: string) => translate(docfield(doctype, fieldname)?.label ?? unscrub(fieldname)),
    get_fieldtype: (doctype: string, fieldname: string) => docfield(doctype, fieldname)?.fieldtype,
    get_parentfield(parent: string, child: string) { return docfields(parent).find((field) => field.options === child && TABLE_TYPES.has(field.fieldtype))?.fieldname; },
    get_field_precision: (df: any) => fieldPrecision(df),
    get_field_currency(df: any, doc: any) {
      const source = doc ?? win.cur_frm?.doc ?? {};
      const option = df?.options;
      if (option && !option.includes(':')) {
        if (source[option]) return source[option];
        const parent = source.parent ? win.cur_frm?.doc : undefined;
        if (parent?.[option]) return parent[option];
        if (/^[A-Z]{3}$/.test(option)) return option;
      }
      return win.frappe.boot?.sysdefaults?.currency;
    },
    get_print_formats: (doctype: string) => ((metaRegistry.get(doctype) as any)?.__print_formats ?? []).map((format: any) => format.name),
    get_default_print_format: (doctype: string) => (metaRegistry.get(doctype) as any)?.default_print_format,
    is_print_hide: () => false,
    get_title_field: (doctype: string) => metaRegistry.get(doctype)?.title_field,
    sync(doc: any) { metaRegistry.set(doc.name, doc); },
    make_docfield_copy_for: () => undefined,
  }, 'frappe.meta');

  const db = namespace({
    get_value(doctype: string, filters: any, fieldname: any, callback?: (value: any) => void, parent?: string) {
      return frappeCall({ type: 'GET', method: 'frappe.client.get_value', args: { doctype, fieldname, filters, parent }, callback: callback ? (r: any) => callback(r.message) : undefined });
    },
    get_single_value: (doctype: string, field: string) => xcall('frappe.client.get_single_value', { doctype, field }, 'GET'),
    set_value: (doctype: string, name: string, fieldname: any, value?: any, callback?: any) => frappeCall({ method: 'frappe.client.set_value', args: { doctype, name, fieldname, value }, callback }),
    get_doc: (doctype: string, name?: string, filters?: any) => xcall('frappe.client.get', { doctype, name, filters }, 'GET'),
    get_list: (doctype: string, args: any = {}) => xcall('frappe.client.get_list', { doctype, fields: args.fields ?? ['name'], filters: args.filters, or_filters: args.or_filters, order_by: args.order_by, limit_start: args.start ?? args.limit_start, limit_page_length: args.limit ?? args.page_length ?? 20, group_by: args.group_by, parent: args.parent }),
    get_all: (doctype: string, args: any = {}) => win.frappe.db.get_list(doctype, args),
    insert: (doc: any) => xcall('frappe.client.insert', { doc }),
    delete_doc: (doctype: string, name: string) => xcall('frappe.client.delete', { doctype, name }),
    exists: (doctype: string, name: string) => xcall('frappe.client.get_value', { doctype, filters: { name }, fieldname: 'name' }, 'GET').then((value: any) => Boolean(value?.name)),
    count: (doctype: string, args: any = {}) => xcall('frappe.client.get_count', { doctype, filters: args.filters }, 'GET'),
    get_link_options: (doctype: string, txt = '', filters: any = {}) => xcall('frappe.desk.search.search_link', { doctype, txt, filters, page_length: 20 }, 'GET'),
  }, 'frappe.db');

  const utils = namespace({
    escape_html: escapeHtml,
    get_random: random,
    get_form_link(doctype: string, name: string, html?: boolean, label?: string) {
      const url = router?.resolve({ name: 'document-detail', params: { doctype, name } }).href ?? '#';
      return html ? `<a href="${url}">${escapeHtml(label ?? name)}</a>` : url;
    },
    get_url_to_form: (doctype: string, name: string) => router?.resolve({ name: 'document-detail', params: { doctype, name } }).href ?? '#',
    get_url_to_list: (doctype: string) => getDocumentRouteForDocType(doctype),
    get_url_to_report: (name: string) => router?.resolve({ name: 'report', params: { report: name } }).href ?? '#',
    icon: () => '',
    is_html: (text: unknown) => /<[a-z][\s\S]*>/i.test(cstr(text)),
    is_url: (text: unknown) => /^https?:\/\//i.test(cstr(text)),
    strip_html: (text: unknown) => plainMessage(cstr(text)),
    html2text: (text: unknown) => plainMessage(cstr(text)),
    sum: (values: number[]) => values.reduce((total, value) => total + flt(value), 0),
    unique: <T,>(values: T[]) => [...new Set(values)],
    filter_dict: filterDict,
    to_title_case: (text: string) => unscrub(text),
    flt, cint, cstr,
    now: () => win.moment().format('YYYY-MM-DD HH:mm:ss'),
    nowdate: () => win.moment().format('YYYY-MM-DD'),
    guess_colour: () => 'gray',
    play_sound: () => undefined,
    debounce<T extends (...args: any[]) => unknown>(fn: T, wait = 200) { let timer: number | undefined; return (...args: Parameters<T>) => { window.clearTimeout(timer); timer = window.setTimeout(() => fn(...args), wait); }; },
    throttle<T extends (...args: any[]) => unknown>(fn: T) { return fn; },
    deep_equal: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
    deep_clone: <T,>(value: T): T => JSON.parse(JSON.stringify(value)),
    copy_to_clipboard: (text: string) => navigator.clipboard?.writeText(text),
    get_abbr: (text: string) => cstr(text).split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    string_to_boolean: (text: unknown) => ['true', 'yes', '1', 'on'].includes(cstr(text).toLowerCase()),
    format_timedelta: (value: unknown) => cstr(value),
    get_number_system: () => [],
    shorten_number: (value: number) => String(value),
    get_link_to_form: (doctype: string, name: string, label?: string) => `<a href="${router?.resolve({ name: 'document-detail', params: { doctype, name } }).href ?? '#'}">${escapeHtml(label ?? name)}</a>`,
    dict: (keys: string[], values: unknown[][]) => values.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index]]))),
    sleep: (ms: number) => new Promise((resolve) => { window.setTimeout(resolve, ms); }),
  }, 'frappe.utils');

  return namespace({
    _messages: {} as Record<string, string>,
    templates: {} as Record<string, string>,
    template: namespace({ compiled: {}, debug: {} }, 'frappe.template'),
    provide(path: string) {
      let scope: any = win;
      for (const part of path.split('.')) {
        if (!scope[part]) scope[part] = {};
        scope = scope[part];
      }
      return scope;
    },
    boot: { user: { roles: [] }, sysdefaults: {} } as any,
    sys_defaults: {} as any,
    session: { user: 'Guest', user_fullname: '', user_email: '' } as any,
    user_roles: [] as string[],
    user_defaults: {} as any,
    flags: {} as any,
    route_options: null as any,
    route_flags: {} as any,
    route_hooks: {} as any,
    dynamic_link: null as any,
    validated: true,
    listview_settings: {} as any,
    treeview_settings: {} as any,
    query_reports: {} as any,
    views: namespace({ calendar: {} }, 'frappe.views'),
    pages: {} as any,
    ui: uiNamespace,
    model, meta, db, utils,
    datetime: dateTime(),
    defaults: namespace({
      get_default(key: string) {
        const user = win.frappe.boot?.user?.defaults?.[key];
        const value = user !== undefined && user !== null ? user : win.frappe.boot?.sysdefaults?.[key];
        return Array.isArray(value) ? value[0] : value;
      },
      get_user_default: (key: string) => win.frappe.defaults.get_default(key),
      get_global_default: (key: string) => win.frappe.boot?.sysdefaults?.[key],
      get_user_defaults: (key: string) => { const value = win.frappe.boot?.user?.defaults?.[key]; return Array.isArray(value) ? value : value ? [value] : []; },
      get_user_permissions: () => win.frappe.boot?.user?.user_permissions ?? {},
      set_user_default_local(key: string, value: unknown) { (win.frappe.boot.user.defaults ??= {})[key] = value; },
    }, 'frappe.defaults'),
    user: namespace({
      get name() { return win.frappe.session.user; },
      has_role(role: string | string[]) { const list = Array.isArray(role) ? role : [role]; return list.some((entry) => roles().includes(entry)); },
      full_name: (user?: string) => win.frappe.boot?.user_info?.[user ?? win.frappe.session.user]?.fullname ?? user ?? win.frappe.session.user,
      image: () => '',
      get_emails: () => [],
    }, 'frappe.user'),
    user_info: (user: string) => win.frappe.boot?.user_info?.[user] ?? { fullname: user, image: '', abbr: cstr(user).slice(0, 2).toUpperCase() },
    perm: namespace({
      has_perm(doctype: string, level = 0, ptype = 'read') {
        const meta = metaRegistry.get(doctype);
        if (meta) return Boolean(levelPerms(meta, level)[ptype]);
        // Scripts ask about DocTypes this page never loaded: the session's boot lists answer, as in Desk.
        const list = win.frappe.boot?.user?.[`can_${ptype}`];
        return level === 0 && Array.isArray(list) && list.includes(doctype);
      },
      get_perm: (doctype: string) => [levelPerms(metaRegistry.get(doctype), 0)],
      get_field_display_status: () => 'Write',
      is_visible: () => true,
    }, 'frappe.perm'),
    dom: namespace({
      freeze(message?: string) { deskState.freezeCount += 1; deskState.freezeMessage = message || ''; },
      unfreeze() { deskState.freezeCount = Math.max(0, deskState.freezeCount - 1); },
      set_style(css: string) { const style = document.createElement('style'); style.textContent = css; document.head.append(style); },
      eval(code: string) { // eslint-disable-next-line @typescript-eslint/no-implied-eval
        new Function(code)(); },
    }, 'frappe.dom'),
    realtime: namespace({ on: () => undefined, off: () => undefined, emit: () => undefined, doc_subscribe: () => undefined, doc_unsubscribe: () => undefined }, 'frappe.realtime'),
    router: namespace({ slug: (name: string) => String(name).toLowerCase().replace(/ /g, '-') }, 'frappe.router'),
    urllib: namespace({ get_full_url: (path: string) => path, get_base_url: () => window.location.origin }, 'frappe.urllib'),
    help: namespace({}, 'frappe.help'),
    tour: {} as any,
    call: frappeCall,
    xcall,
    after_ajax(callback?: () => void) { return afterServerCall().then(() => callback?.()); },
    after_server_call: afterServerCall,
    run_serially: runSerially,
    throw: frappeThrow,
    msgprint,
    hide_msgprint() { deskState.messages = []; },
    show_alert: showAlert,
    toast: showAlert,
    confirm: frappeConfirm,
    warn(title: string, message: string, yes?: () => void, label?: string, _sidebar?: boolean, no?: () => void) {
      void useConfirm().confirm({ title, message: plainMessage(message), confirmLabel: label || translate('Proceed'), tone: 'danger' }).then((ok) => (ok ? yes?.() : no?.()));
    },
    set_route: setRoute,
    get_route: getRoute,
    get_route_str: () => getRoute().join('/'),
    get_prev_route: () => [],
    new_doc: newDoc,
    open_in_new_tab: true,
    is_mobile: () => window.innerWidth < 768,
    is_large_screen: () => window.innerWidth > 1200,
    is_online: () => navigator.onLine,
    get_doc(doctype: string, name?: string) {
      if (!name) name = doctype;
      const doc = locals[doctype]?.[name];
      if (doc) return doc;
      if (doctype === 'DocType') return metaRegistry.get(name);
      // Rows added directly to the form's arrays are found on the open document.
      const open = win.cur_frm?.doc;
      if (open) {
        if (open.doctype === doctype && open.name === name) return open;
        for (const value of Object.values<any>(open)) {
          if (!Array.isArray(value)) continue;
          const row = value.find((entry) => entry?.doctype === doctype && entry?.name === name);
          if (row) { store(row); return row; }
        }
      }
      return undefined;
    },
    get_list(doctype: string, filters?: any) { return model.get_list(doctype, filters); },
    get_children(parent: any, parentfield: string) { return parent?.[parentfield] ?? []; },
    get_meta: (doctype: string) => metaRegistry.get(doctype),
    scrub, unscrub,
    _: translate,
    format(value: unknown, df: any, _options?: unknown, doc?: any) { return formatValue(value, df ?? { fieldtype: 'Data' }, doc); },
    form_dict: {} as any,
    render: (source: string, data: unknown, name?: string) => compileTemplate(source, name ?? source)(data),
    render_template: renderTemplate,
    require(assets: string | string[], callback?: () => void) {
      const list = Array.isArray(assets) ? assets : [assets];
      return Promise.all(list.filter((asset) => asset.endsWith('.js')).map(loadNamedBundle)).catch(() => undefined).then(() => { callback?.(); });
    },
    get_cookie: (name: string) => document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))?.split('=')[1],
    contacts: {
      /** The document an Address or Contact is being created from. */
      get_last_doc() {
        const link = win.frappe.dynamic_link;
        return link?.doc ? { doctype: link.doc.doctype ?? link.doctype, docname: link.doc[link.fieldname ?? 'name'] } : { doctype: undefined, docname: undefined };
      },
      clear_address_and_contact(frm: any) {
        for (const name of ['address_html', 'contact_html']) frm.fields_dict[name]?.$wrapper?.html?.('');
      },
      render_address_and_contact(frm: any) {
        const onload = frm.doc.__onload ?? {};
        const render = (rows: any[], doctype: string, title: (row: any) => string) => `<div class="desk-party-list">${rows.map((row) => `<a class="desk-party-card" href="${utils.get_url_to_form(doctype, row.name)}"><strong>${escapeHtml(title(row))}</strong><span>${row.display ?? [row.email_id, row.phone].filter(Boolean).map(escapeHtml).join(' · ')}</span></a>`).join('') || `<p class="desk-party-empty">${translate(`No ${doctype} yet`)}</p>`}</div><button type="button" class="desk-party-new" data-doctype="${doctype}">+ ${translate(`New ${doctype}`)}</button>`;
        const mount = (fieldname: string, doctype: string, rows: any[], title: (row: any) => string) => {
          const wrapper = frm.fields_dict[fieldname]?.$wrapper;
          if (!wrapper) return;
          wrapper.html(render(rows, doctype, title));
          wrapper.find('.desk-party-new').on('click', () => {
            win.frappe.dynamic_link = { doc: frm.doc, fieldname: 'name', doctype: frm.doctype };
            void win.frappe.new_doc(doctype);
          });
        };
        mount('address_html', 'Address', onload.addr_list ?? [], (row) => row.address_title ?? row.name);
        mount('contact_html', 'Contact', onload.contact_list ?? [], (row) => [row.first_name, row.last_name].filter(Boolean).join(' ') || row.name);
      },
    } as any,
  }, 'frappe');
}

// ---------- Boot ----------
function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.append(script);
  });
}
const assetBase = () => API_BASE_URL.replace(/\/api$/, '');
let assetMap: Promise<Record<string, string>> | null = null;
function loadNamedBundle(name: string) {
  assetMap ??= fetch(`${assetBase()}/assets/assets.json`, { credentials: 'include' }).then((response) => response.json());
  return assetMap.then((map) => (map[name] ? loadScript(`${assetBase()}${map[name]}`) : undefined));
}

function applyBoot(boot: any) {
  const frappe = win.frappe;
  frappe.boot = boot;
  frappe.sys_defaults = boot.sysdefaults ?? {};
  frappe.user_roles = boot.user?.roles ?? [];
  frappe.user_defaults = boot.user?.defaults ?? {};
  frappe.session.user = boot.user?.name ?? 'Guest';
  frappe.session.user_fullname = boot.user?.full_name ?? boot.user?.name;
  frappe.session.user_email = boot.user?.email ?? boot.user?.name;
  frappe._messages = boot.__messages ?? {};
  frappe.boot.docs ??= [];
  // Boot documents (":Company", ":Currency"…) are read through frappe.get_doc.
  for (const doc of frappe.boot.docs) if (doc?.doctype && doc.name) store(doc);
}

/** Handlers registered by app bundles survive form reloads; a DocType's own script is re-evaluated per form. */
let baselineHandlers: Record<string, Record<string, any[]>> = {};
const copyHandlers = (source: Record<string, Record<string, any[]>>) => Object.fromEntries(Object.entries(source).map(([doctype, events]) => [doctype, Object.fromEntries(Object.entries(events).map(([event, list]) => [event, [...list]]))]));
export function resetFormHandlers() { win.frappe.ui.form.handlers = copyHandlers(baselineHandlers); }

let ready: Promise<void> | null = null;
export function ensureDeskRuntime(): Promise<void> {
  ready ??= (async () => {
    const base = assetBase();
    if (!win.jQuery) await loadScript(`${base}/assets/frappe/node_modules/jquery/dist/jquery.min.js`);
    win.$ = win.jQuery;
    if (!win.moment) await loadScript(`${base}/assets/frappe/node_modules/moment/min/moment.min.js`);

    Object.assign(win, {
      __: translate,
      flt, cint, cstr,
      frappe: buildFrappe(),
      erpnext: win.erpnext ?? {},
      cur_frm: null,
      cur_dialog: null,
      validated: true,
      in_list: (list: unknown[], item: unknown) => Array.isArray(list) && list.includes(item),
      has_common: (a: unknown[], b: unknown[]) => (a ?? []).some((item) => (b ?? []).includes(item)),
      is_null: (value: unknown) => value === null || value === undefined || value === '',
      replace_all: (text: string, a: string, b: string) => String(text).split(a).join(b),
      strip: (text: string) => String(text ?? '').trim(),
      strip_html: (text: unknown) => plainMessage(cstr(text)),
      refresh_field(fieldname: any) { win.cur_frm?.refresh_field(fieldname); },
      refresh_many(fieldnames: string[]) { fieldnames.forEach((fieldname) => win.cur_frm?.refresh_field(fieldname)); },
      set_field_options: () => undefined,
      hide_field(fieldname: any) { win.cur_frm?.toggle_display(fieldname, false); },
      unhide_field(fieldname: any) { win.cur_frm?.toggle_display(fieldname, true); },
      get_currency_symbol: (currency?: string) => formatCurrency(0, currency, 0).replace(/[\d\s.,]/g, ''),
      format_currency: (value: unknown, currency?: string, decimals?: number) => formatCurrency(value, currency, decimals ?? 2),
      fmt_money: (value: unknown, _format?: string, currency?: string) => formatCurrency(value, currency, 2),
      format_number: (value: unknown, _format?: string, decimals?: number) => flt(value, decimals).toLocaleString(),
      precision(fieldname: string, doc?: any) {
        const doctype = doc?.doctype ?? win.cur_frm?.doctype;
        return fieldPrecision(doctype ? docfield(doctype, fieldname) : undefined);
      },
      get_number_format: () => win.frappe.boot?.sysdefaults?.number_format || '#,###.##',
      get_number_format_info(format?: string) {
        const known: Record<string, unknown> = { '#,###.##': { decimal_str: '.', group_sep: ',', precision: 2 }, '#.###,##': { decimal_str: ',', group_sep: '.', precision: 2 }, '# ###.##': { decimal_str: '.', group_sep: ' ', precision: 2 }, '#,##,###.##': { decimal_str: '.', group_sep: ',', precision: 2 }, '#.###': { decimal_str: '', group_sep: '.', precision: 0 }, '#,###': { decimal_str: '', group_sep: ',', precision: 0 } };
        return known[format ?? ''] ?? { decimal_str: '.', group_sep: ',', precision: 2 };
      },
      strip_number_groups: (value: unknown) => cstr(value).replace(/,/g, ''),
      _round: (value: unknown, decimals = 0) => flt(value, decimals),
      roundNumber: (value: unknown, decimals = 0) => flt(value, decimals),
      remainder(value: number, divisor: number, decimals: number) {
        const scale = 10 ** cint(decimals);
        return (Math.round(value * scale) % Math.round(divisor * scale)) / scale;
      },
      round_based_on_smallest_currency_fraction(value: number, currency: string, decimals: number) {
        const smallest = flt(locals[':Currency']?.[currency]?.smallest_currency_fraction_value);
        if (!smallest) return flt(value, 0);
        const rest = win.remainder(value, smallest, decimals);
        return rest > smallest / 2 ? value + smallest - rest : value - rest;
      },
      repl: (text: string, values: Record<string, unknown>) => String(text).replace(/%\((\w+)\)s/g, (_match, key) => cstr(values[key])),
      nth(value: number) { const tens = value % 100; if (tens > 10 && tens < 14) return `${value}th`; return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`; },
      comment_when: (value: unknown) => win.moment(value).fromNow(),
      prettyDate: (value: unknown) => win.moment(value).fromNow(),
      is_html: (text: unknown) => /<[a-z][\s\S]*>/i.test(cstr(text)),
      validate_email: (text: unknown) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cstr(text)),
      validate_phone: (text: unknown) => /^[+\d][\d\s()-]{3,}$/.test(cstr(text)),
      validate_name: (text: unknown) => /^[\p{L}'\s.-]+$/u.test(cstr(text)),
      validate_url: (text: unknown) => /^https?:\/\//i.test(cstr(text)),
      open_url_post(url: string, args: Record<string, unknown>, newTab?: boolean) {
        const form = document.createElement('form');
        form.method = 'POST'; form.action = url; if (newTab) form.target = '_blank';
        for (const [key, value] of Object.entries(args ?? {})) { const input = document.createElement('input'); input.type = 'hidden'; input.name = key; input.value = cstr(value); form.append(input); }
        document.body.append(form); form.submit(); form.remove();
      },
      extend_cscript(cscript: any, controller: any) {
        win.$.extend(cscript, controller);
        if (cscript && controller) Object.setPrototypeOf(cscript, Object.getPrototypeOf(controller));
        return cscript;
      },
      add_fetch: (...args: any[]) => win.cur_frm?.add_fetch(...args),
    });

    const response = await fetch(`${API_BASE_URL}/method/modern_erp_ui.api.desk.get_boot`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (response.ok) applyBoot((await response.json()).message ?? {});
    else console.error('[desk] could not load session boot data', response.status);

    const { installDialogs } = await import('./dialog');
    installDialogs();

    // Each app's Desk bundle: ERPNext's controllers (TransactionController, utils, queries…).
    let bundles: string[] = [];
    try {
      const listed = await fetch(`${API_BASE_URL}/method/modern_erp_ui.api.desk.get_form_script_bundles`, { credentials: 'include', headers: { Accept: 'application/json' } });
      bundles = listed.ok ? (await listed.json()).message ?? [] : [];
    } catch { bundles = []; }
    if (bundles.length) {
      for (const url of bundles) await loadScript(`${base}${url}`).catch((error) => console.error('[desk]', error));
    } else {
      await loadNamedBundle('erpnext.bundle.js').catch((error) => console.error('[desk]', error));
    }
    baselineHandlers = copyHandlers(win.frappe.ui.form.handlers);
  })();
  return ready;
}
