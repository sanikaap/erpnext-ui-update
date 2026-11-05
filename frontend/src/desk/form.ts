/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, markRaw } from 'vue';
import type { DocTypeMeta } from '@/services/metadata-api';
import { hasDocTypePermission, metaRegistry } from '@/services/metadata-api';
import { TABLE_TYPES } from '@/lib/doctype';
import type { DocPermissions, ERPNextMetadataField } from '@/types/erp';
import { namespace } from './stubs';
import { docfields, ensureDeskRuntime, indexDoc, levelPerms, registerFormFields, resetFormHandlers, ValidationStop } from './runtime';
import { makeHtmlWrapper, resolveLinkArgs, type FormBinding } from './binding';

const win = window as any;

export interface FormButton { label: string; group?: string; fn: () => unknown; type?: string }
export interface FormProgress { title: string; percent: number; message?: string }

/** What the page provides: the document buffer and the actions that touch the server. */
export interface FormHost {
  doc(): Record<string, any>;
  docinfo(): Record<string, any>;
  permissions(): DocPermissions;
  setDirty(value: boolean): void;
  isDirty(): boolean;
  save(action?: string): Promise<unknown>;
  cancel(): Promise<unknown>;
  amend(): Promise<unknown>;
  reload(): Promise<unknown>;
  print(): void;
  email(): void;
}

/**
 * The `frm` object ERPNext's form scripts talk to, on top of the Vue form: same API as
 * Desk's frappe.ui.form.Form, with its toolbar and dashboard kept as reactive state
 * (`ui`) that DocumentPage renders. Docfields are the page's reactive metadata, so
 * frm.set_df_property / toggle_display update the form directly.
 */
export class FormController implements FormBinding {
  doctype: string;
  meta: DocTypeMeta;
  fields_dict: Record<string, any> = {};
  fields: any[] = [];
  events: Record<string, any> = {};
  cscript: any;
  custom_buttons: Record<string, any> = {};
  custom_make_buttons: Record<string, string> = {};
  make_methods: Record<string, any> = {};
  can_make_methods: Record<string, any> = {};
  ignore_doctypes_on_cancel_all: string[] = [];
  script_manager: any;
  page: any;
  dashboard: any;
  sidebar: any;
  timeline: any;
  toolbar: any;
  layout: any;
  attachments: any;
  wrapper: any;
  selected_doc: any;
  fetch_dict: Record<string, any> = {};
  is_first_load = true;
  htmlFilled = reactive<Record<string, boolean>>({});
  private gridLocks = reactive<Record<string, { add: boolean; remove: boolean }>>({});

  ui = reactive({
    buttons: [] as FormButton[],
    primaryGroup: null as string | null,
    menu: [] as FormButton[],
    primaryAction: null as FormButton | null,
    secondaryAction: null as FormButton | null,
    indicator: null as { label: string; color: string } | null,
    intro: null as { html: string; color: string } | null,
    headline: null as { html: string; color: string } | null,
    comments: [] as { html: string; color: string }[],
    progress: [] as FormProgress[],
    badges: [] as { label: string; color: string }[],
    saveDisabled: false,
    readOnly: false,
    transactionsExtra: [] as { label: string; items: string[] }[],
  });

  private host: FormHost;
  private childFields: Record<string, ERPNextMetadataField[]>;
  private metaFields: ERPNextMetadataField[];
  private grids = new Map<string, any>();
  private selections = new Map<string, () => string[]>();
  private htmlWrappers = new Map<string, HTMLElement>();
  private opened = new Set<string>();
  private lifecycleRunning = false;
  private scriptsReady: Promise<void> | null = null;

  constructor(meta: DocTypeMeta, fields: ERPNextMetadataField[], childFields: Record<string, ERPNextMetadataField[]>, host: FormHost) {
    this.doctype = meta.name;
    this.meta = meta;
    this.metaFields = fields;
    this.childFields = childFields;
    this.host = host;
    this.script_manager = markRaw({
      frm: this,
      trigger: (event: string, doctype?: string, name?: string) => this.runEvent(event, doctype, name),
      has_handler: (event: string) => Boolean(win.frappe.ui.form.handlers[this.doctype]?.[event]),
      has_handlers: (event: string, doctype?: string) => { const list = this.handlersFor(event, doctype ?? this.doctype); return list.modern.length + list.legacy.length > 0; },
      get_handlers: (event: string, doctype?: string) => this.handlersFor(event, doctype ?? this.doctype),
      make: (Controller: any) => { this.cscript = win.extend_cscript(this.cscript, new Controller({ frm: this })); },
      copy_from_first_row: (parentfield: string, row: any, fieldnames: string | string[]) => {
        const rows = this.doc[parentfield];
        if (rows.length === 1 || rows[0] === row) return;
        for (const fieldname of [fieldnames].flat()) void win.frappe.model.set_value(row.doctype, row.name, fieldname, rows[0][fieldname]);
      },
      log_error: (caller: string, error: unknown) => console.error('[desk] client script', caller, error),
    });
    this.page = this.makePage();
    this.dashboard = this.makeDashboard();
    this.sidebar = namespace({}, 'frm.sidebar');
    this.timeline = namespace({ wrapper: undefined as unknown }, 'frm.timeline');
    this.toolbar = namespace({}, 'frm.toolbar');
    this.layout = namespace({ tabs: [] as unknown[], get wrapper() { return win.$('<div>'); } }, 'frm.layout');
    this.attachments = namespace({ get_attachments: () => this.host.docinfo().attachments ?? [] }, 'frm.attachments');
  }

  // ---------- Document ----------
  get doc() { return this.host.doc(); }
  get docname() { return this.doc?.name; }
  get docinfo() { return this.host.docinfo(); }
  get perm() {
    const own = this.host.permissions();
    const levels: any[] = [];
    levels[0] = Object.keys(own ?? {}).length ? own : levelPerms(this.meta, 0);
    for (const field of this.metaFields) {
      const level = Number(field.permlevel ?? 0);
      if (level && !levels[level]) levels[level] = levelPerms(this.meta, level);
    }
    return levels;
  }
  is_new() { return Boolean(this.doc?.__islocal); }
  is_dirty() { return this.host.isDirty(); }
  markDirty() {
    // Values a script fills in aren't edits: an untouched new form stays clean (defaults such as
    // taxes and addresses often arrive after it opens), as does a submitted form while loading.
    if (this.is_new() || (this.lifecycleRunning && Number(this.doc?.docstatus ?? 0) !== 0)) return;
    if (this.doc) this.doc.__unsaved = 1;
    this.host.setDirty(true);
  }
  /** A change the user made themselves always counts. */
  private markEdited() {
    if (this.doc) this.doc.__unsaved = 1;
    this.host.setDirty(true);
  }
  /** The script says the document changed (e.g. rows mapped in), so it does count as an edit. */
  dirty() { this.markEdited(); }
  has_perm(ptype: string, level = 0) { return Boolean(this.perm[level]?.[ptype]); }
  get_perm(level: number, ptype: string) { return this.perm[level]?.[ptype]; }
  get_docinfo() { return this.host.docinfo(); }
  get_files() { return this.host.docinfo().attachments ?? []; }
  get_involved_users() { return []; }
  precision(fieldname: string, doc?: any) { return win.precision(fieldname, doc ?? this.doc); }

  // ---------- Startup: the same order as Desk ----------
  /** Loads the app bundles and this DocType's scripts, once per form. */
  prepare() {
    this.scriptsReady ??= (async () => {
      await ensureDeskRuntime();
      win.cur_frm = this;
      registerFormFields(this.doctype, this.metaFields);
      for (const [doctype, fields] of Object.entries(this.childFields)) registerFormFields(doctype, fields);
      this.applyPermLevels();
      this.buildFieldObjects();
      resetFormHandlers();
      for (const [event, list] of Object.entries<any[]>(win.frappe.ui.form.handlers[this.doctype] ?? {})) if (list.length) this.events[event] = list[list.length - 1];
      this.cscript = new win.frappe.ui.form.Controller({ frm: this });
      Object.assign(win.frappe.templates, this.meta.__templates ?? {});
      this.evaluate(this.meta.__js, 'form script');
      this.evaluate(this.meta.__custom_js, 'client script');
      if (this.meta.__css) win.frappe.dom.set_style(this.meta.__css);
      await this.runEvent('setup');
    })().catch((error) => { console.error(`[desk] could not start form scripts for ${this.doctype}`, error); });
    return this.scriptsReady;
  }

  private evaluate(source: string | undefined, label: string) {
    if (!source) return;
    try {
      // The same code, from the same server, that Desk evaluates here.
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function(`${source}\n//# sourceURL=desk-form/${encodeURIComponent(this.doctype)}.${label.replace(/ /g, '-')}.js`)();
    } catch (error) {
      console.error(`[desk] error in ${label} of ${this.doctype}`, error);
    }
  }

  /** Runs after the page adopted a document. */
  async documentLoaded() {
    await this.prepare();
    if (!win.frappe || !this.doc) return;
    win.cur_frm = this;
    indexDoc(this.doc);
    this.lifecycleRunning = true;
    try {
      const firstView = !this.opened.has(this.doc.name);
      if (firstView) {
        this.opened.add(this.doc.name);
        await this.runEvent('before_load');
        await this.runEvent('onload');
      }
      await this.refresh();
      if (firstView) {
        await this.runEvent('onload_post_render');
        this.is_first_load = false;
      }
      if (this.doc.__run_link_triggers) {
        delete this.doc.__run_link_triggers;
        for (const field of this.metaFields) if (field.fieldtype === 'Link' && this.doc[field.fieldname]) await this.runEvent(field.fieldname);
      }
    } finally {
      this.lifecycleRunning = false;
    }
  }

  /** frm.refresh(): rebuilds the toolbar and re-runs the refresh handlers. */
  async refresh(_docname?: string) {
    if (!win.frappe) return;
    this.clear_custom_buttons();
    this.ui.primaryAction = null;
    this.ui.intro = null;
    this.ui.headline = null;
    this.ui.comments = [];
    this.ui.progress = [];
    this.ui.badges = [];
    this.ui.indicator = null;
    indexDoc(this.doc);
    await this.runEvent('refresh');
  }

  // ---------- Events ----------
  private handlersFor(event: string, doctype: string) {
    const registry = win.frappe.ui.form.handlers;
    const modern = [...(registry[doctype]?.[event] ?? []), ...(registry['*']?.[event] ?? [])];
    const legacy = [event, `custom_${event}`].filter((name) => typeof this.cscript?.[name] === 'function');
    return { modern, legacy };
  }

  /** Each handler is isolated: a failure in one must not stop the others or the form. */
  private async invoke(run: () => unknown, event: string) {
    try {
      const result = run();
      await (result && typeof (result as any).then === 'function' ? result : win.frappe.after_server_call());
    } catch (error) {
      if (!(error instanceof ValidationStop)) console.error(`[desk] ${this.doctype}: handler for "${event}" failed`, error);
      if (['validate', 'before_save', 'before_submit', 'before_cancel'].includes(event)) win.frappe.validated = false;
    }
  }

  runEvent(event: string, doctype?: string, name?: string): Promise<void> {
    if (!win.frappe?.ui) return Promise.resolve();
    const type = doctype ?? this.doctype;
    const target = name ?? this.docname;
    const { modern, legacy } = this.handlersFor(event, type);
    if (type === this.doctype || target) {
      if (this.doc) indexDoc(this.doc);
      this.selected_doc = win.frappe.get_doc(type, target);
    }
    if (event === 'setup') {
      for (const fn of modern) { try { fn(this, type, target); } catch (error) { console.error(`[desk] ${this.doctype}: setup handler failed`, error); } }
      for (const fn of legacy) { try { this.cscript[fn](this.doc, type, target); } catch (error) { console.error(`[desk] ${this.doctype}: legacy setup failed`, error); } }
      return Promise.resolve();
    }
    return (async () => {
      for (const fn of modern) await this.invoke(() => fn(this, type, target), event);
      for (const fn of legacy) await this.invoke(() => this.cscript[fn](this.doc, type, target), event);
    })();
  }
  trigger(event: string, doctype?: string, name?: string) { return this.runEvent(event, doctype, name); }

  // ---------- Fields ----------
  private makeFieldObject(df: ERPNextMetadataField) {
    const frm = this;
    const member: any = {
      df,
      get doc() { return frm.doc; },
      get value() { return frm.doc?.[df.fieldname]; },
      get_value: () => frm.doc?.[df.fieldname],
      set_value: (value: unknown) => frm.set_value(df.fieldname, value),
      set_input: (value: unknown) => { frm.doc[df.fieldname] = value; },
      refresh: () => undefined,
      refresh_input: () => undefined,
      set_label: (label: string) => { df.label = label; },
      set_description: (text: string) => { df.description = text; },
      set_new_description: (text: string) => { df.description = text; },
      set_focus: () => undefined,
      get get_query() { return df.get_query; },
      set get_query(value: unknown) { df.get_query = value; },
      get $wrapper() { return win.$(frm.ensureWrapper(df.fieldname)); },
      // Desk exposes a section's or tab's wrapper as jQuery, a control's as an element.
      get wrapper() { return ['Section Break', 'Tab Break', 'Column Break'].includes(df.fieldtype) ? win.$(frm.ensureWrapper(df.fieldname)) : frm.ensureWrapper(df.fieldname); },
      // HTML control: scripts render into it with frm.get_field(x).html(markup).
      html: (markup: string) => { frm.ensureWrapper(df.fieldname).innerHTML = markup; },
      get $input() { return win.$('<input>'); },
      get input() { return document.createElement('input'); },
      get $input_area() { return win.$('<div>'); },
    };
    if (TABLE_TYPES.has(df.fieldtype)) {
      Object.defineProperty(member, 'grid', { get: () => this.gridFor(df) });
      // Table control's lookup: the fieldname of a child column, by fieldname or label.
      member.get_field = (name: string) => {
        const wanted = String(name).toLowerCase();
        return docfields(df.options ?? '').find((field) => field.fieldname.toLowerCase() === wanted || String(field.label ?? '').toLowerCase() === wanted)?.fieldname;
      };
    }
    return namespace(member, `frm.fields_dict.${df.fieldname}`);
  }

  private buildFieldObjects() {
    this.fields = this.metaFields.map((df) => this.makeFieldObject(df));
    this.fields_dict = Object.fromEntries(this.fields.map((field) => [field.df.fieldname, field]));
  }

  private ensureWrapper(fieldname: string) {
    let element = this.htmlWrappers.get(fieldname);
    if (!element) { element = makeHtmlWrapper(fieldname, this.htmlFilled); this.htmlWrappers.set(fieldname, element); }
    return element;
  }

  private gridFor(df: ERPNextMetadataField) {
    let grid = this.grids.get(df.fieldname);
    if (grid) return grid;
    const frm = this;
    const childDoctype = df.options ?? '';
    const children = () => this.childFields[childDoctype] ?? docfields(childDoctype);
    const childDf = (fieldname: string) => children().find((field) => field.fieldname === fieldname);
    const members: any = {
      df,
      doctype: childDoctype,
      frm,
      parentfield: df.fieldname,
      get cannot_add_rows() { return frm.gridLocks[df.fieldname]?.add ?? false; },
      set cannot_add_rows(value: boolean) { frm.gridLocks[df.fieldname] = { remove: false, ...frm.gridLocks[df.fieldname], add: Boolean(value) }; },
      get cannot_delete_rows() { return frm.gridLocks[df.fieldname]?.remove ?? false; },
      set cannot_delete_rows(value: boolean) { frm.gridLocks[df.fieldname] = { add: false, ...frm.gridLocks[df.fieldname], remove: Boolean(value) }; },
      get docfields() { return children(); },
      get fields_map() { return Object.fromEntries(children().map((field) => [field.fieldname, field])); },
      get data() { return frm.doc?.[df.fieldname] ?? []; },
      get grid_rows() { return (frm.doc?.[df.fieldname] ?? []).map((row: any) => ({ doc: row })); },
      get wrapper() { return win.$('<div>'); },
      get_field(fieldname: string) {
        const child = childDf(fieldname);
        return namespace({ df: child, get get_query() { return child?.get_query; }, set get_query(value: unknown) { if (child) child.get_query = value; } }, `grid.${fieldname}`);
      },
      get_docfield: (fieldname: string) => childDf(fieldname),
      update_docfield_property(fieldname: string, property: string, value: unknown) { const child = childDf(fieldname); if (child) child[property] = value; },
      set_column_disp(fieldnames: string | string[], show: boolean) { for (const fieldname of [fieldnames].flat()) { const child = childDf(fieldname); if (child) child.hidden = !show; } },
      toggle_display(fieldname: string, show: boolean) { const child = childDf(fieldname); if (child) child.hidden = !show; },
      toggle_reqd(fieldname: string, required: boolean) { const child = childDf(fieldname); if (child) child.reqd = required; },
      toggle_enable(fieldname: string, enabled: boolean) { const child = childDf(fieldname); if (child) child.read_only = !enabled; },
      get_selected: () => frm.selections.get(df.fieldname)?.() ?? [],
      get_selected_children() { const names = new Set(members.get_selected()); return (frm.doc?.[df.fieldname] ?? []).filter((row: any) => names.has(row.name)); },
      add_new_row: () => frm.add_child(df.fieldname),
      refresh: () => undefined,
      get_row: (index: number) => ({ doc: frm.doc?.[df.fieldname]?.[index] }),
    };
    grid = namespace(members, `frm.grid.${df.fieldname}`);
    this.grids.set(df.fieldname, grid);
    return grid;
  }

  /** Fields above permlevel 0 follow the role's rights at that level. */
  private applyPermLevels() {
    if (!win.frappe?.boot?.user?.roles?.length) return;
    const apply = (fields: ERPNextMetadataField[], meta: DocTypeMeta | undefined) => {
      for (const field of fields) {
        const level = Number(field.permlevel ?? 0);
        if (!level) continue;
        const rights = levelPerms(meta, level);
        if (!rights.read && !rights.write) field.hidden = true;
        else if (!rights.write) field.read_only = true;
      }
    };
    apply(this.metaFields, this.meta);
    for (const [doctype, fields] of Object.entries(this.childFields)) apply(fields, metaRegistry.get(doctype) ?? this.meta);
  }

  get_field(fieldname: string) { return this.fields_dict[fieldname]; }
  get_docfield(fieldname: string, childFieldname?: string) {
    if (childFieldname) return docfields(this.fields_dict[fieldname]?.df.options).find((field) => field.fieldname === childFieldname);
    return this.metaFields.find((field) => field.fieldname === fieldname);
  }
  set_df_property(fieldname: string, property: string, value: unknown, docname?: string, tableField?: string) {
    const df = docname && tableField ? this.get_docfield(fieldname, tableField) : this.get_docfield(fieldname);
    if (df) df[property] = value;
  }
  private toggleEach(fields: string | string[], apply: (df: ERPNextMetadataField) => void) {
    for (const fieldname of [fields].flat()) { const df = this.get_docfield(fieldname); if (df) apply(df); }
  }
  toggle_display(fields: string | string[], show: unknown) { this.toggleEach(fields, (df) => { df.hidden = !show; }); }
  toggle_reqd(fields: string | string[], required: unknown) { this.toggleEach(fields, (df) => { df.reqd = Boolean(required); }); }
  toggle_enable(fields: string | string[], enabled: unknown) { this.toggleEach(fields, (df) => { df.read_only = !enabled; }); }
  refresh_field(_fieldname?: unknown) { /* Reactive: the form already shows the current values. */ }
  refresh_fields() { /* Reactive. */ }
  scroll_to_field(fieldname: string) { document.getElementById(`field-${this.doctype.replace(/\W+/g, '-')}-${fieldname}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  set_currency_labels(fieldnames: string[], currency: string, parentfield?: string) {
    if (!currency) return;
    const fields = parentfield ? docfields(this.fields_dict[parentfield]?.df.options) : this.metaFields;
    for (const fieldname of fieldnames) {
      const df: any = fields.find((field) => field.fieldname === fieldname);
      if (!df) continue;
      df._original_label ??= df.label;
      df.label = `${String(df._original_label).trim()} (${currency})`;
    }
  }
  set_value(field: string | Record<string, unknown>, value?: unknown, ifMissing?: boolean, skipDirty?: boolean): Promise<unknown> {
    const assign = (fieldname: string, next: any) => {
      const object = this.fields_dict[fieldname];
      if (!object) {
        // Not a field on this form (mapped or standard values): keep it on the document.
        if (this.doc && !(ifMissing && this.doc[fieldname])) this.doc[fieldname] = next;
        return undefined;
      }
      if (ifMissing && win.frappe.model.has_value(this.doctype, this.doc.name, fieldname)) return undefined;
      if (TABLE_TYPES.has(object.df.fieldtype) && Array.isArray(next)) {
        this.doc[fieldname] = [];
        for (const row of next) Object.assign(win.frappe.model.add_child(this.doc, object.df.options, fieldname), row);
        return undefined;
      }
      return win.frappe.model.set_value(this.doctype, this.doc.name, fieldname, next, undefined, skipDirty);
    };
    const changes: Record<string, unknown> = typeof field === 'string' ? { [field]: value } : field;
    return win.frappe.run_serially(Object.entries(changes).map(([fieldname, next]) => () => assign(fieldname, next)));
  }
  add_child(fieldname: string, values?: Record<string, unknown>) {
    const row = win.frappe.model.add_child(this.doc, this.get_docfield(fieldname)?.options, fieldname);
    if (values) { const { idx: _idx, name: _name, ...rest } = values; Object.assign(row, rest); }
    return row;
  }
  clear_table(fieldname: string) { if (this.doc) this.doc[fieldname] = []; }
  get_selected() {
    const selected: Record<string, string[]> = {};
    for (const [fieldname, read] of this.selections) { const names = read(); if (names.length) selected[fieldname] = names; }
    return selected;
  }
  set_query(fieldname: string, tableOrQuery: any, query?: any) {
    if (query) {
      const child = this.get_docfield(tableOrQuery, fieldname);
      if (child) child.get_query = query;
    } else {
      const df = this.get_docfield(fieldname);
      if (df) df.get_query = tableOrQuery;
    }
  }
  add_fetch(linkField: string, sourceField: string, targetField: string, parentDoctype?: string) {
    const scope = parentDoctype ?? this.doctype;
    ((this.fetch_dict[scope] ??= {})[linkField] ??= { columns: [], fields: [] });
    this.fetch_dict[scope][linkField].columns.push(sourceField);
    this.fetch_dict[scope][linkField].fields.push(targetField);
  }
  /** Fills a Select with the fields of another DocType (Assignment Rule, Form Tour…). */
  set_fields_as_options(fieldname: string, doctype: string, filter?: (df: any) => boolean, defaults: Array<string | { label: string; value: string }> = [], tableField?: string) {
    if (!doctype) return Promise.resolve([]);
    return win.frappe.model.with_doctype(doctype).then(() => {
      const fields = docfields(doctype).filter((df) => !filter || filter(df));
      const options = [...defaults, ...fields.map((df) => ({ label: df.label, value: df.fieldname }))];
      if (tableField) this.set_df_property(tableField, 'options', options, this.docname, fieldname);
      else this.set_df_property(fieldname, 'options', options);
      return options;
    });
  }
  set_indicator_formatter(_fieldname: string, _formatter: unknown) { /* Grid rows carry no indicator dot here. */ }
  set_footnote(_text: string) { /* Not shown. */ }

  // ---------- Toolbar ----------
  /** Desk shows these as sidebar links; here they join the form's menu. */
  add_web_link(path: string, label?: string) {
    const title = label || win.__('See on Website');
    if (!this.ui.menu.some((item) => item.label === title)) this.ui.menu.push({ label: title, fn: markRaw(() => window.open(path, '_blank', 'noopener')) });
  }
  /** Whether Connections offers "+" for a DocType: Desk's own rule. */
  can_create(doctype: string) {
    if (!win.frappe.boot?.user?.can_create?.includes(doctype)) return false;
    const label = this.custom_make_buttons?.[doctype];
    if (label) return this.ui.buttons.some((button) => button.label === win.__(label));
    if (this.can_make_methods?.[doctype]) return this.can_make_methods[doctype](this);
    return !(this.meta.is_submittable && this.doc.docstatus !== 1);
  }
  add_custom_button(label: string, fn: () => unknown, group?: string) {
    const groupName = group && !group.includes('fa fa-') ? group : undefined;
    return this.addButton(label, fn, groupName);
  }
  private addButton(label: string, fn: () => unknown, group?: string, type?: string) {
    const existing = this.ui.buttons.findIndex((entry) => entry.label === label && entry.group === group);
    const button: FormButton = { label, group, fn: markRaw(fn), type };
    if (existing >= 0) this.ui.buttons[existing] = button; else this.ui.buttons.push(button);
    const handle: any = win.$('<button>');
    handle.on('click', fn);
    this.custom_buttons[label] = handle;
    return handle;
  }
  remove_custom_button(label: string, group?: string) {
    this.ui.buttons = this.ui.buttons.filter((entry) => !(entry.label === label && (group === undefined || entry.group === group)));
    delete this.custom_buttons[label];
  }
  change_custom_button_type(label: string, group: string | undefined | null, type: string) {
    const button = this.ui.buttons.find((entry) => entry.label === label && (!group || entry.group === group));
    if (button) button.type = type;
  }
  clear_custom_buttons() { this.ui.buttons = []; this.ui.primaryGroup = null; this.custom_buttons = {}; this.ui.menu = this.ui.menu.filter((item) => item.type === 'standard'); }
  disable_save(_setReadOnly?: boolean) { this.ui.saveDisabled = true; }
  enable_save() { this.ui.saveDisabled = false; }
  disable_form() { this.ui.readOnly = true; this.ui.saveDisabled = true; }
  enable_form() { this.ui.readOnly = false; this.ui.saveDisabled = false; }
  set_read_only() { this.ui.readOnly = true; }
  set_intro(text?: string, color: unknown = 'blue') { this.ui.intro = text ? { html: text, color: typeof color === 'string' ? color : 'blue' } : null; }

  private makePage() {
    const ui = this.ui;
    return namespace({
      get wrapper() { return win.$('<div>'); },
      get btn_primary() { return win.$('<button>'); },
      get btn_secondary() { return win.$('<button>'); },
      add_inner_button: (label: string, fn: () => unknown, group?: string, type?: string) => this.addButton(label, fn, group, type),
      remove_inner_button: (label: string, group?: string) => this.remove_custom_button(label, group),
      change_inner_button_type: (label: string, group: string | null, type: string) => this.change_custom_button_type(label, group, type),
      set_inner_btn_group_as_primary: (group: string) => { ui.primaryGroup = group; },
      clear_inner_toolbar: () => { ui.buttons = []; ui.primaryGroup = null; },
      clear_user_actions: () => undefined,
      inner_toolbar: namespace({}, 'frm.page.inner_toolbar'),
      add_menu_item: (label: string, fn: () => unknown, _standard?: boolean) => { ui.menu.push({ label, fn: markRaw(fn) }); return win.$('<a>'); },
      add_action_item: (label: string, fn: () => unknown) => { ui.menu.push({ label, fn: markRaw(fn) }); return win.$('<a>'); },
      clear_menu: () => { ui.menu = []; },
      clear_actions_menu: () => undefined,
      set_primary_action: (label: string, fn: () => unknown) => { ui.primaryAction = { label, fn: markRaw(fn) }; return win.$('<button>'); },
      clear_primary_action: () => { ui.primaryAction = null; },
      set_secondary_action: (label: string, fn: () => unknown) => { ui.secondaryAction = { label, fn: markRaw(fn) }; return win.$('<button>'); },
      clear_secondary_action: () => { ui.secondaryAction = null; },
      set_indicator: (label: string, color: string) => { ui.indicator = { label, color }; },
      clear_indicator: () => { ui.indicator = null; return { removeClass: () => ({ addClass: () => undefined }) }; },
      set_title: () => undefined,
      show_menu: () => undefined,
      hide_menu: () => undefined,
    }, 'frm.page');
  }

  private makeDashboard() {
    const ui = this.ui;
    const frm = this;
    const progress = (title: string, percent: unknown, message?: string) => {
      const entry = { title, percent: Number(Array.isArray(percent) ? (percent as any[]).reduce((sum, part) => sum + Number(part?.width?.replace?.('%', '') ?? part ?? 0), 0) : percent) || 0, message };
      const index = ui.progress.findIndex((item) => item.title === title);
      if (index >= 0) ui.progress[index] = entry; else ui.progress.push(entry);
      return win.$('<div>');
    };
    return namespace({
      get frm() { return frm; },
      get data() { return frm.meta.__dashboard ?? {}; },
      get stats_area_row() { return win.$('<div>'); },
      get stats_area() { return win.$('<div>'); },
      set_headline: (html: string, color = 'blue') => { ui.headline = { html, color }; },
      set_headline_alert: (html: string, color = 'blue') => { ui.headline = html ? { html, color } : null; },
      clear_headline: () => { ui.headline = null; },
      add_comment: (html: string, color = 'blue', _permanent?: boolean) => { ui.comments.push({ html, color }); },
      clear_comment: () => { ui.comments = []; },
      add_indicator: (label: string, color: string) => { ui.badges.push({ label, color }); return win.$('<div>'); },
      add_progress: progress,
      show_progress: progress,
      hide_progress: (title?: string) => { ui.progress = title ? ui.progress.filter((item) => item.title !== title) : []; },
      add_section: (html: string) => { ui.comments.push({ html, color: 'gray' }); return win.$('<div>'); },
      add_transactions: (group: any) => { for (const entry of [group].flat()) ui.transactionsExtra.push(entry); },
      refresh: () => undefined,
      reset: () => undefined,
    }, 'frm.dashboard');
  }

  // ---------- Actions ----------
  save(action?: string, callback?: (response?: unknown) => void, _btn?: unknown, onError?: () => void) {
    return this.host.save(action || 'Save').then((result) => { callback?.(result); return result; }, (error) => { onError?.(); throw error; });
  }
  savesubmit() { return this.save('Submit'); }
  savecancel() { return this.host.cancel(); }
  save_or_update() { return this.save(Number(this.doc?.docstatus) === 1 ? 'Update' : 'Save'); }
  reload_doc() { return this.host.reload(); }
  amend_doc() { return this.host.amend(); }
  copy_doc(onload?: (doc: any) => void, fromAmend?: boolean) {
    const copy = win.frappe.model.copy_doc(this.doc, fromAmend);
    copy.idx = null;
    onload?.(copy);
    return win.frappe.set_route('Form', copy.doctype, copy.name);
  }
  print_doc() { this.host.print(); }
  email_doc() { this.host.email(); }
  call(opts: any, args?: any, callback?: any) {
    const options: any = typeof opts === 'string' ? { method: opts, doc: this.doc, args, callback } : { ...opts };
    const original = options.callback;
    if (!options.doc) {
      if (!options.method.includes('.')) options.method = `${win.frappe.model.get_server_module_name(this.doctype)}.${options.method}`;
      options.callback = (response: any) => {
        const message = response.message;
        if (message && typeof message === 'object' && !Array.isArray(message)) {
          if (options.child) {
            const row = win.locals[options.child.doctype]?.[options.child.name];
            if (row) for (const [key, value] of Object.entries(message)) if (!['doctype', ...win.frappe.model.std_fields_list, ...win.frappe.model.child_table_field_list].includes(key)) row[key] = value;
          } else {
            void this.set_value(message as Record<string, unknown>);
          }
        }
        original?.(response);
      };
    }
    return win.frappe.call(options);
  }

  /** Connections "+": hand over to the script's own maker, else a new linked document. */
  make_new(doctype: string) {
    const label = this.custom_make_buttons?.[doctype];
    if (this.make_methods?.[doctype]) return this.make_methods[doctype](this);
    if (label) {
      const button = this.ui.buttons.find((entry) => entry.label === win.__(label));
      if (button) return button.fn();
    }
    return win.frappe.model.with_doctype(doctype, () => {
      const draft = win.frappe.model.get_new_doc(doctype, null, null, true);
      this.setLinkFields(doctype, draft);
      indexDoc(draft);
      return win.frappe.set_route('Form', doctype, draft.name);
    });
  }
  private setLinkFields(doctype: string, target: any) {
    for (const df of docfields(doctype)) {
      if (df.fieldtype === 'Link' && df.options === this.doctype) target[df.fieldname] = this.doc.name;
      else if (['Link', 'Dynamic Link'].includes(df.fieldtype) && this.doc[df.fieldname]) target[df.fieldname] = this.doc[df.fieldname];
      else if (df.fieldtype === 'Table' && df.options && df.reqd && target[df.fieldname]?.[0]) this.setLinkFields(df.options, target[df.fieldname][0]);
    }
  }
  canCreate(doctype: string) { return hasDocTypePermission(doctype, 'create'); }

  // ---------- FormBinding ----------
  linkArgs(field: ERPNextMetadataField, doc: Record<string, unknown>) {
    // Desk passes the parent document first; rows are reached through cdt/cdn.
    const isRow = Boolean(doc.parentfield);
    if (!isRow) return resolveLinkArgs(field, doc, this.doc);
    const getQuery: any = field.get_query;
    if (typeof getQuery === 'function') {
      return resolveLinkArgs({ ...field, get_query: () => getQuery(this.doc, doc.doctype, doc.name) }, doc, this.doc);
    }
    return resolveLinkArgs(field, doc, doc);
  }
  fieldChanged(field: ERPNextMetadataField, doc: Record<string, unknown>, value: unknown) {
    this.markEdited();
    if (!win.frappe?.model) return;
    if (doc.parentfield) indexDoc(this.doc);
    if (field.fieldtype === 'Link') void this.applyScriptFetch(field, doc as any, value as string);
    void win.frappe.model.trigger(field.fieldname, value, doc);
  }
  private async applyScriptFetch(field: ERPNextMetadataField, doc: any, value: string) {
    const scoped = this.fetch_dict[doc.doctype]?.[field.fieldname];
    if (!scoped || !value || !field.options) return;
    const response = await win.frappe.db.get_value(field.options, value, scoped.columns);
    scoped.fields.forEach((target: string, index: number) => { const source = response.message?.[scoped.columns[index]]; if (source !== undefined) doc[target] = source; });
  }
  fieldClicked(field: ERPNextMetadataField, doc: Record<string, unknown>) {
    if (typeof field.click === 'function') { (field.click as () => void)(); return; }
    void this.runEvent(field.fieldname, doc.doctype as string | undefined, doc.name as string | undefined);
  }
  rowAdded(field: ERPNextMetadataField, row: Record<string, unknown>) {
    this.markEdited();
    if (!win.frappe?.ui) return;
    if (!row.parent) row.parent = this.docname;
    indexDoc(this.doc);
    void this.runEvent(`${field.fieldname}_add`, field.options, row.name as string);
  }
  rowsRemoved(field: ERPNextMetadataField, rows: Record<string, unknown>[]) {
    this.markEdited();
    if (!win.frappe?.ui) return;
    for (const row of rows) {
      void this.runEvent(`${field.fieldname}_remove`, field.options, row.name as string);
      if (win.locals[row.doctype as string]) delete win.locals[row.doctype as string][row.name as string];
    }
  }
  rowMoved(field: ERPNextMetadataField) {
    this.markEdited();
    if (win.frappe?.ui) void this.runEvent(`${field.fieldname}_move`, field.options);
  }
  htmlWrapper(fieldname: string) { return this.ensureWrapper(fieldname); }
  gridFlags(fieldname: string) {
    const df = this.get_docfield(fieldname);
    const locks = this.gridLocks[fieldname];
    return { cannotAdd: Boolean(locks?.add || df?.cannot_add_rows), cannotDelete: Boolean(locks?.remove || df?.cannot_delete_rows) };
  }
  registerGrid(fieldname: string, selection: () => string[]) { this.selections.set(fieldname, selection); }
}
