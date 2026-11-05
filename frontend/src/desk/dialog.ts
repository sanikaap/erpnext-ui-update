/* eslint-disable @typescript-eslint/no-explicit-any */
import { markRaw, reactive } from 'vue';
import { getDocTypeMetadata } from '@/services/metadata-api';
import { normalizeField, TABLE_TYPES } from '@/lib/doctype';
import type { ERPNextMetadataField } from '@/types/erp';
import { namespace } from './stubs';
import { deskState, docfields } from './runtime';
import { makeHtmlWrapper, resolveLinkArgs, type FormBinding } from './binding';

const win = window as any;
let dialogCounter = 0;

function normalizeDialogField(raw: any, index: number): ERPNextMetadataField {
  const df = { ...raw };
  if (!df.fieldname) df.fieldname = df.label ? String(df.label).toLowerCase().replace(/\W+/g, '_') : `__field_${index}`;
  if (!df.fieldtype) df.fieldtype = 'Data';
  return reactive(normalizeField(df)) as ERPNextMetadataField;
}

/** frappe.ui.Dialog, rendered by DeskDialog.vue with the same DynamicForm as documents. */
export class DeskDialog implements FormBinding {
  fields: ERPNextMetadataField[];
  childFields: Record<string, ERPNextMetadataField[]> = reactive({});
  doc: Record<string, any> = reactive({});
  fields_dict: Record<string, any> = {};
  fields_list: any[] = [];
  htmlFilled = reactive<Record<string, boolean>>({});
  body = document.createElement('div');
  footer = document.createElement('div');
  onhide?: () => void;
  on_page_show?: () => void;
  display = false;
  uid = (dialogCounter += 1);
  state = reactive({
    title: '',
    message: '',
    primaryLabel: '',
    secondaryLabel: '',
    primaryDisabled: false,
    busy: false,
    size: '',
    customActions: [] as { label: string; fn: () => unknown }[],
  });
  private primary?: (values: any) => unknown;
  private secondary?: () => unknown;
  private wrappers = new Map<string, HTMLElement>();
  private selections = new Map<string, () => string[]>();
  [key: string]: any;

  constructor(opts: any = {}) {
    Object.assign(this, { ...opts, fields: undefined });
    this.state.title = opts.title ?? '';
    this.state.size = opts.size ?? '';
    this.fields = reactive((opts.fields ?? []).map(normalizeDialogField)) as ERPNextMetadataField[];
    for (const df of this.fields) this.setUpField(df);
    if (opts.primary_action) this.set_primary_action(opts.primary_action_label ?? win.__('Submit'), opts.primary_action);
    if (opts.secondary_action) this.set_secondary_action(opts.secondary_action);
    if (opts.secondary_action_label) this.state.secondaryLabel = opts.secondary_action_label;
  }

  private setUpField(df: any) {
    if (TABLE_TYPES.has(df.fieldtype)) {
      const pseudo = `__dialog_${df.fieldname}`;
      df.options = pseudo;
      this.childFields[pseudo] = (df.fields ?? []).map(normalizeDialogField);
      df.data = df.data ?? [];
      this.doc[df.fieldname] = df.data;
    } else if (df.default !== undefined && df.default !== null) {
      this.doc[df.fieldname] = df.default;
    } else if (df.value !== undefined) {
      this.doc[df.fieldname] = df.value;
    } else if (df.fieldtype === 'Check') {
      this.doc[df.fieldname] = 0;
    }
    const dialog = this;
    const members: any = {
      df,
      layout: dialog,
      get value() { return dialog.doc[df.fieldname]; },
      get doc() { return dialog.doc; },
      get_value: () => (TABLE_TYPES.has(df.fieldtype) ? df.data : dialog.doc[df.fieldname]),
      set_value(value: unknown) { dialog.doc[df.fieldname] = value; dialog.fireChange(df, dialog.doc, value); return Promise.resolve(); },
      set_input(value: unknown) { dialog.doc[df.fieldname] = value; },
      refresh: () => { if (TABLE_TYPES.has(df.fieldtype)) dialog.doc[df.fieldname] = df.data; },
      refresh_input: () => undefined,
      set_focus: () => undefined,
      get get_query() { return df.get_query; },
      set get_query(value: unknown) { df.get_query = value; },
      get $wrapper() { return win.$(dialog.wrapperFor(df.fieldname)); },
      get wrapper() { return dialog.wrapperFor(df.fieldname); },
      get $input() { const input = win.$('<input>'); input.on('change', () => undefined); return input; },
      get input() { return document.createElement('input'); },
    };
    if (TABLE_TYPES.has(df.fieldtype)) {
      members.grid = namespace({
        df,
        get wrapper() { return win.$('<div>'); },
        get data() { return dialog.doc[df.fieldname]; },
        get docfields() { return dialog.childFields[df.options] ?? []; },
        refresh() { dialog.doc[df.fieldname] = df.data; },
        remove_all() { df.data = []; dialog.doc[df.fieldname] = df.data; },
        get_selected: () => dialog.selections.get(df.fieldname)?.() ?? [],
        get_selected_children() { const names = new Set(members.grid.get_selected()); return (dialog.doc[df.fieldname] ?? []).filter((row: any) => names.has(row.name ?? row.__key)); },
        add_new_row() { const row = {}; df.data.push(row); dialog.doc[df.fieldname] = df.data; return row; },
        get_field(fieldname: string) { const child: any = (dialog.childFields[df.options] ?? []).find((entry) => entry.fieldname === fieldname); return namespace({ df: child, get get_query() { return child?.get_query; }, set get_query(value: unknown) { if (child) child.get_query = value; } }, 'grid.field'); },
        update_docfield_property(fieldname: string, property: string, value: unknown) { const child: any = (dialog.childFields[df.options] ?? []).find((entry) => entry.fieldname === fieldname); if (child) child[property] = value; },
      }, `dialog.grid.${df.fieldname}`);
    }
    const object = namespace(members, `dialog.fields_dict.${df.fieldname}`);
    this.fields_dict[df.fieldname] = object;
    this.fields_list.push(object);
  }

  private wrapperFor(fieldname: string) {
    let element = this.wrappers.get(fieldname);
    if (!element) { element = makeHtmlWrapper(fieldname, this.htmlFilled); this.wrappers.set(fieldname, element); }
    return element;
  }

  private fireChange(df: any, doc: any, value: unknown) {
    const handler = df.change ?? df.onchange;
    if (typeof handler !== 'function') return;
    const context = { df, doc, value, get_value: () => value, layout: this, grid_row: { doc } };
    try { handler.call(context, { target: { value } }); } catch (error) { console.error(`[desk] dialog field ${df.fieldname}`, error); }
  }

  // ---------- Frappe Dialog API ----------
  get $wrapper() { return win.$(this.body); }
  get wrapper() { return this.body; }
  get $body() { return win.$(this.body); }
  get $message() { return win.$('<div>'); }
  show() {
    this.display = true;
    win.cur_dialog = this;
    if (!deskState.dialogs.includes(this)) deskState.dialogs.push(markRaw(this));
    return this;
  }
  hide() {
    this.display = false;
    deskState.dialogs = deskState.dialogs.filter((entry) => entry !== this);
    win.cur_dialog = deskState.dialogs[deskState.dialogs.length - 1] ?? null;
    this.onhide?.();
  }
  get_field(fieldname: string) { return this.fields_dict[fieldname]; }
  get_value(fieldname: string) { return this.fields_dict[fieldname]?.get_value(); }
  get_values(ignoreErrors?: boolean) {
    const missing: string[] = [];
    const values: Record<string, any> = {};
    for (const df of this.fields) {
      const value = TABLE_TYPES.has(df.fieldtype) ? (this.doc[df.fieldname] ?? []) : this.doc[df.fieldname];
      if (['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Button', 'Heading'].includes(df.fieldtype)) continue;
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
      if (df.reqd && empty && !df.hidden) missing.push(df.label);
      if (!empty || df.fieldtype === 'Check') values[df.fieldname] = value;
    }
    if (missing.length && !ignoreErrors) {
      win.frappe.msgprint({ title: win.__('Missing Values Required'), indicator: 'red', message: `${win.__('Following fields have missing values:')}<br><ul><li>${missing.join('</li><li>')}</li></ul>` });
      return null;
    }
    return JSON.parse(JSON.stringify(values));
  }
  set_value(fieldname: string, value: unknown) { return this.fields_dict[fieldname]?.set_value(value) ?? Promise.resolve(); }
  set_values(values: Record<string, unknown>) { return Promise.all(Object.entries(values).map(([fieldname, value]) => this.set_value(fieldname, value))); }
  clear() { for (const df of this.fields) this.doc[df.fieldname] = TABLE_TYPES.has(df.fieldtype) ? [] : undefined; }
  refresh() { /* Reactive. */ }
  set_title(title: string) { this.state.title = title; }
  set_message(text: string) { this.state.message = text; }
  clear_message() { this.state.message = ''; }
  set_primary_action(label: string, action: (values: any) => unknown) {
    this.state.primaryLabel = label;
    this.primary = action;
    this.has_primary_action = true;
    return win.$('<button>');
  }
  set_secondary_action(action: () => unknown) { this.secondary = action; if (!this.state.secondaryLabel) this.state.secondaryLabel = win.__('Close'); return win.$('<button>'); }
  set_secondary_action_label(label: string) { this.state.secondaryLabel = label; }
  disable_primary_action() { this.state.primaryDisabled = true; }
  enable_primary_action() { this.state.primaryDisabled = false; }
  get_primary_btn() { const button = win.$('<button>'); button.on('click', () => this.runPrimary()); return button; }
  get_secondary_btn() { return win.$('<button>'); }
  get_close_btn() { return win.$('<button>'); }
  get_minimize_btn() { return win.$('<button>'); }
  add_custom_action(label: string, fn: () => unknown) { this.state.customActions.push({ label, fn: markRaw(fn) }); }
  set_df_property(fieldname: string, property: string, value: unknown) { const df: any = this.fields_dict[fieldname]?.df; if (df) df[property] = value; }
  async runPrimary() {
    if (!this.primary) { this.hide(); return; }
    const values = this.get_values();
    if (values === null) return;
    this.state.busy = true;
    try { await this.primary(values); } catch (error) { if (!(error instanceof Error && error.constructor.name === 'ValidationStop')) console.error('[desk] dialog action', error); } finally { this.state.busy = false; }
  }
  runSecondary() { if (this.secondary) this.secondary(); else this.hide(); }

  // ---------- FormBinding ----------
  linkArgs(field: ERPNextMetadataField, doc: Record<string, unknown>) { return resolveLinkArgs(field, doc, this.doc); }
  fieldChanged(field: ERPNextMetadataField, doc: Record<string, unknown>, value: unknown) { this.fireChange(field, doc, value); }
  fieldClicked(field: ERPNextMetadataField) {
    if (typeof field.click === 'function') (field.click as (values: unknown) => void)(this.get_values(true));
  }
  rowAdded() { /* Rows live on df.data. */ }
  rowsRemoved() { /* Rows live on df.data. */ }
  rowMoved() { /* Rows live on df.data. */ }
  htmlWrapper(fieldname: string) { return this.wrapperFor(fieldname); }
  gridFlags(fieldname: string) { const df: any = this.fields_dict[fieldname]?.df; return { cannotAdd: Boolean(df?.cannot_add_rows), cannotDelete: Boolean(df?.cannot_delete_rows) }; }
  registerGrid(fieldname: string, selection: () => string[]) { this.selections.set(fieldname, selection); }
}

/** frappe.ui.form.MultiSelectDialog: the "Get Items From" document picker. */
class MultiSelectDialog {
  [key: string]: any;
  constructor(opts: any) {
    Object.assign(this, opts);
    this.args = {};
    this.page_length = 20;
    this.selected = new Set<string>();
    if (this.doctype === '[Select]') this.init();
    else void getDocTypeMetadata(this.doctype).then(() => this.init());
  }
  private setterFields() {
    if (Array.isArray(this.setters)) return this.setters.map((df: any) => ({ ...df, read_only: this.read_only_setters ? 1 : df.read_only }));
    return Object.keys(this.setters ?? {}).map((fieldname) => {
      const df: any = docfields(this.doctype).find((field) => field.fieldname === fieldname) ?? { fieldname, fieldtype: 'Data', label: fieldname };
      return { fieldname, fieldtype: df.fieldtype === 'Text' ? 'Data' : df.fieldtype, label: df.label, options: df.options, default: this.setters[fieldname], read_only: this.read_only_setters ? 1 : 0, bold: df.bold };
    });
  }
  private init() {
    const reload = () => { window.clearTimeout(this.timer); this.timer = window.setTimeout(() => this.get_results(), 250); };
    const setters = this.setterFields().map((df: any) => ({ ...df, onchange: reload, reqd: 0, hidden: 0, depends_on: undefined }));
    this.dialog = new DeskDialog({
      title: win.__('Select {0}', [this.for_select ? win.__('value') : win.__(this.doctype)]),
      size: this.size ?? 'large',
      fields: [
        { fieldname: 'search_term', fieldtype: 'Data', label: win.__('Search'), onchange: reload },
        ...setters,
        { fieldtype: 'Section Break' },
        { fieldname: 'results_area', fieldtype: 'HTML', options: ' ' },
        { fieldname: 'more_btn', fieldtype: 'Button', label: win.__('More'), click: () => { this.page_length += 20; this.get_results(); } },
        ...(this.data_fields?.length ? [{ fieldtype: 'Section Break' }, ...this.data_fields] : []),
      ],
      primary_action_label: this.primary_action_label ?? win.__('Get Items'),
      primary_action: () => {
        const values = this.dialog.get_values(true);
        return this.action([...this.selected], { ...this.args, ...values, filtered_children: [] });
      },
    });
    this.$results = this.dialog.fields_dict.results_area.$wrapper;
    this.$results.on('change', 'input[type=checkbox]', (event: Event) => {
      const box = event.target as HTMLInputElement;
      if (box.dataset.all) {
        this.$results.find('input[data-name]').each((_i: number, element: HTMLInputElement) => { element.checked = box.checked; if (box.checked) this.selected.add(element.dataset.name!); else this.selected.delete(element.dataset.name!); });
      } else if (box.checked) this.selected.add(box.dataset.name!);
      else this.selected.delete(box.dataset.name!);
    });
    this.dialog.show();
    this.get_results();
  }
  private filtersFromSetters() {
    const queryFilters = (this.get_query ? this.get_query()?.filters : {}) || {};
    const filters: unknown[][] = Array.isArray(queryFilters) ? [...queryFilters] : Object.entries<any>(queryFilters).map(([key, value]) => (Array.isArray(value) ? [this.doctype, key, value[0], value[1]] : [this.doctype, key, '=', value]));
    const fieldNames: string[] = [];
    for (const df of this.setterFields()) {
      const value = this.dialog.get_value(df.fieldname) || undefined;
      this.args[df.fieldname] = value;
      fieldNames.push(df.fieldname);
      if (value !== undefined && value !== null) filters.push(df.fieldtype === 'Data' ? [this.doctype, df.fieldname, 'like', `%${value}%`] : [this.doctype, df.fieldname, '=', value]);
    }
    return [filters, fieldNames] as const;
  }
  get_results() {
    const [filters, filterFields] = this.filtersFromSetters();
    const dateField = this.date_field ?? (docfields(this.doctype).some((field) => field.fieldname === 'transaction_date') ? 'transaction_date' : undefined);
    return win.frappe.call({
      type: 'GET', method: 'frappe.desk.search.search_widget', no_spinner: true,
      args: { doctype: this.doctype, txt: this.dialog.get_value('search_term') ?? '', filters, filter_fields: dateField ? [...filterFields, dateField] : filterFields, page_length: this.page_length + 5, query: this.get_query ? this.get_query()?.query ?? '' : '', query_filters_as_dict: true, as_dict: 1 },
      callback: (response: any) => this.render(response.values ?? response.message ?? [], [...filterFields, ...(dateField ? [dateField] : [])]),
    });
  }
  private render(rows: any[], columns: string[]) {
    const esc = win.frappe.utils.escape_html;
    const shown = rows.slice(0, this.page_length);
    this.dialog.set_df_property('more_btn', 'hidden', rows.length <= this.page_length);
    const labelFor = (fieldname: string) => docfields(this.doctype).find((field) => field.fieldname === fieldname)?.label ?? fieldname;
    this.$results.html(`<table class="desk-pick"><thead><tr><th><input type="checkbox" data-all="1" aria-label="${esc(win.__('Select all'))}"></th><th>${esc(win.__('Name'))}</th>${columns.map((column) => `<th>${esc(labelFor(column))}</th>`).join('')}</tr></thead><tbody>${
      shown.map((row: any) => `<tr><td><input type="checkbox" data-name="${esc(row.name)}" ${this.selected.has(row.name) ? 'checked' : ''} aria-label="${esc(row.name)}"></td><td class="desk-pick-name">${esc(row.name)}</td>${columns.map((column) => `<td>${esc(row[column] ?? '')}</td>`).join('')}</tr>`).join('')
      || `<tr><td colspan="${columns.length + 2}" class="desk-pick-empty">${esc(win.__('No {0} found', [win.__(this.doctype)]))}</td></tr>`
    }</tbody></table>`);
  }
}

export function installDialogs() {
  const { frappe, $ } = win;
  frappe.ui.Dialog = DeskDialog;
  frappe.ui.form.MultiSelectDialog = MultiSelectDialog;
  frappe.prompt = (fields: any, callback?: (values: any) => void, title?: string, primaryLabel?: string) => {
    const list = typeof fields === 'string' ? [{ label: fields, fieldname: 'value', fieldtype: 'Data', reqd: 1 }] : Array.isArray(fields) ? fields : [fields];
    const dialog: any = new DeskDialog({
      title: title ?? win.__('Enter Value'),
      fields: list,
      primary_action_label: primaryLabel ?? win.__('Submit'),
      primary_action(values: any) { dialog.hide(); return callback?.(values); },
    });
    dialog.show();
    return dialog;
  };
  // Bootstrap's jQuery plugins, which Desk's scripts call but this UI does not use.
  for (const plugin of ['modal', 'tooltip', 'popover', 'dropdown', 'collapse', 'tab']) $.fn[plugin] ??= function noop(this: unknown) { return this; };
}
