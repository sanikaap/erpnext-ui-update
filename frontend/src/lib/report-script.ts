import { erpnextApi } from '@/services/erpnext-api';
import { today } from '@/lib/doctype';
import type { ERPNextMetadataField } from '@/types/erp';

/*
 * ERPNext Script/Query Reports declare their filters in a client script
 * (frappe.query_reports["Name"] = { filters: [...] }). Desk runs that script; we run it
 * against a stand-in `frappe`/`erpnext` namespace that records what it declares, then
 * keep only the filter definitions. The script comes from this ERPNext server — the
 * same trust Desk gives it. Anything the stand-in cannot provide resolves to a harmless
 * stub, and a script that still fails just yields "no filters".
 */

export interface ReportFilter extends ERPNextMetadataField {
  /** Original Frappe filter type, e.g. MultiSelectList or DateRange. */
  filterType: string;
}

export interface ReportScriptContext {
  user?: string;
  defaults: Record<string, unknown>;
}

// A callable, indexable stub: any property or call returns another stub.
function makeStub(): unknown {
  const target = function stub() { /* noop */ };
  return new Proxy(target, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => '' : key === 'then' ? undefined : key === 'length' ? 0 : makeStub()),
    apply: () => makeStub(),
    construct: () => makeStub() as object,
  });
}

// An object that keeps assigned values and stubs everything else (e.g. `erpnext.utils`).
function makeNamespace(initial: Record<string | symbol, unknown> = {}): Record<string | symbol, unknown> {
  return new Proxy(initial, {
    get: (target, key) => (key in target ? target[key] : key === Symbol.toPrimitive || key === 'then' ? undefined : makeStub()),
    set: (target, key, value) => { target[key] = value; return true; },
    has: (target, key) => key in target,
  });
}

const pad = (value: number) => String(value).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parse = (value?: string) => (value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date());

const datetime = {
  get_today: today, nowdate: today, now_date: today,
  add_days: (value: string, days: number) => { const date = parse(value); date.setDate(date.getDate() + Number(days)); return toIso(date); },
  add_months: (value: string, months: number) => { const date = parse(value); date.setMonth(date.getMonth() + Number(months)); return toIso(date); },
  month_start: (value?: string) => { const date = parse(value); return toIso(new Date(date.getFullYear(), date.getMonth(), 1)); },
  month_end: (value?: string) => { const date = parse(value); return toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0)); },
  year_start: (value?: string) => `${parse(value).getFullYear()}-01-01`,
  year_end: (value?: string) => `${parse(value).getFullYear()}-12-31`,
  str_to_obj: (value: string) => parse(value),
  obj_to_str: (value: Date) => toIso(value),
  user_to_str: (value: string) => value,
  str_to_user: (value: string) => value,
};

function extend(...args: unknown[]) {
  const deep = typeof args[0] === 'boolean' ? Boolean(args.shift()) : false;
  const target = (args.shift() ?? {}) as Record<string, unknown>;
  for (const source of args as Record<string, unknown>[]) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      target[key] = deep && value && typeof value === 'object' && !Array.isArray(value)
        ? extend(true, { ...(target[key] as object) }, value)
        : Array.isArray(value) ? [...value] : value;
    }
  }
  return target;
}

const cache = new Map<string, Promise<ReportFilter[]>>();

function evaluate(name: string, script: string, context: ReportScriptContext) {
  const queryReports: Record<string, { filters?: unknown[] }> = {};
  const getDefault = (key: string) => context.defaults[key] ?? context.defaults[key.charAt(0).toUpperCase() + key.slice(1)];
  const frappe = makeNamespace({
    query_reports: queryReports,
    defaults: makeNamespace({ get_default: getDefault, get_user_default: getDefault, get_user_defaults: (key: string) => [getDefault(key)].filter(Boolean), get_global_default: getDefault }),
    datetime: makeNamespace(datetime),
    session: { user: context.user },
    boot: makeNamespace({ sysdefaults: context.defaults, user: makeNamespace({ defaults: context.defaults }) }),
    user: makeNamespace({ name: context.user }),
    provide: (namespace: string) => {
      const [root, ...rest] = namespace.split('.');
      let current = (root === 'frappe' ? frappe : scope[root] ??= makeNamespace()) as Record<string, unknown>;
      for (const part of rest) current = (current[part] && typeof current[part] === 'object' ? current[part] : (current[part] = makeNamespace())) as Record<string, unknown>;
      return current;
    },
    require: () => Promise.resolve(),
    call: () => Promise.resolve({ message: null }),
    query_report: makeNamespace({ get_filter_value: () => undefined, set_filter_value: () => undefined, refresh: () => undefined, get_filter: () => makeNamespace() }),
    utils: makeNamespace({ escape_html: (value: string) => value }),
  });
  const scope: Record<string, unknown> = {
    frappe,
    erpnext: makeNamespace(),
    __: (text: string, args?: unknown[]) => String(text ?? '').replace(/\{(\d+)\}/g, (_m, index) => String(args?.[Number(index)] ?? '')),
    $: Object.assign(makeStub() as object, { extend }),
    jQuery: Object.assign(makeStub() as object, { extend }),
    console: { log: () => undefined, warn: () => undefined, error: () => undefined },
    Math, Date, JSON, Object, Array, String, Number, Boolean, Promise, parseInt, parseFloat, isNaN,
  };
  // Every identifier the script reads resolves inside `scope` (unknown ones become stubs).
  const sandbox = new Proxy(scope, {
    has: () => true,
    get: (target, key) => (key === Symbol.unscopables ? undefined : key in target ? target[key as string] : makeStub()),
    set: (target, key, value) => { target[key as string] = value; return true; },
  });
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('sandbox', `with (sandbox) { ${script}\n}`)(sandbox);
  return queryReports[name]?.filters ?? [];
}

function toField(raw: Record<string, unknown>): ReportFilter | null {
  if (!raw || typeof raw !== 'object' || typeof raw.fieldname !== 'string') return null;
  const filterType = String(raw.fieldtype || 'Data');
  const fieldtype = filterType === 'MultiSelectList' ? 'Link' : filterType === 'DateRange' ? 'DateRange' : filterType;
  let options = raw.options;
  if (Array.isArray(options)) options = options.map((option) => (typeof option === 'object' && option ? (option as { value?: unknown }).value ?? '' : option)).join('\n');
  const value = typeof raw.default === 'function' || (raw.default && typeof raw.default === 'object' && !Array.isArray(raw.default)) ? undefined : raw.default;
  return {
    fieldname: raw.fieldname,
    label: String(raw.label || raw.fieldname).replace(/<[^>]+>/g, ''),
    fieldtype,
    filterType,
    options: typeof options === 'string' ? options : undefined,
    reqd: Boolean(raw.reqd),
    default: Array.isArray(value) ? value : value === undefined || value === null ? undefined : value,
    hidden: Boolean(raw.hidden),
    depends_on: typeof raw.depends_on === 'string' ? raw.depends_on : undefined,
  };
}

/** The report's filter definitions, or [] when they cannot be determined. */
export function loadReportFilters(name: string, context: ReportScriptContext): Promise<ReportFilter[]> {
  let pending = cache.get(name);
  if (!pending) {
    pending = erpnextApi.call<{ script?: string }>('frappe.desk.query_report.get_script', { report_name: name })
      .then((response) => {
        const script = response.message?.script || '';
        try {
          return (evaluate(name, script, context) as Record<string, unknown>[]).map(toField).filter(Boolean) as ReportFilter[];
        } catch {
          return [];
        }
      });
    pending.catch(() => cache.delete(name));
    cache.set(name, pending);
  }
  return pending;
}
