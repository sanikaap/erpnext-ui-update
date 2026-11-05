/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InjectionKey } from 'vue';
import type { ERPNextMetadataField } from '@/types/erp';

/**
 * What form controls need from whoever owns the form: the open document's controller
 * (FormController) or a script dialog. Plain forms have none and behave as before.
 */
export interface FormBinding {
  /** Search args for a Link control: frm.set_query / df.get_query / link_filters. */
  linkArgs(field: ERPNextMetadataField, doc: Record<string, unknown>): { filters?: unknown; query?: string } | undefined;
  /** The user changed a value on the document or on a child row. */
  fieldChanged(field: ERPNextMetadataField, doc: Record<string, unknown>, value: unknown): void;
  fieldClicked(field: ERPNextMetadataField, doc: Record<string, unknown>): void;
  rowAdded(field: ERPNextMetadataField, row: Record<string, unknown>): void;
  rowsRemoved(field: ERPNextMetadataField, rows: Record<string, unknown>[]): void;
  rowMoved(field: ERPNextMetadataField): void;
  /** The real element scripts write into for an HTML field. */
  htmlWrapper(fieldname: string): HTMLElement | undefined;
  /** Reactive: fieldnames whose wrapper has content. */
  htmlFilled: Record<string, boolean>;
  gridFlags(fieldname: string): { cannotAdd: boolean; cannotDelete: boolean };
  registerGrid(fieldname: string, selection: () => string[]): void;
}

export const FORM_BINDING: InjectionKey<FormBinding> = Symbol('desk-form-binding');

/** Desk's rules for turning a query definition into search args. */
export function resolveLinkArgs(field: ERPNextMetadataField, doc: any, context: any) {
  const args: { filters?: unknown; query?: string } = {};
  const getQuery: any = field.get_query;
  let definition: any = getQuery;
  if (typeof getQuery === 'function') {
    try {
      definition = getQuery(context ?? doc, doc?.doctype, doc?.name);
    } catch (error) {
      console.error(`[desk] get_query failed for ${field.fieldname}`, error);
      definition = undefined;
    }
  }
  if (typeof definition === 'string') args.query = definition;
  else if (definition) {
    if (definition.query) args.query = definition.query;
    if (definition.filters) args.filters = definition.filters;
    else if (definition.params) args.filters = definition.params;
    else if (!definition.query && !definition.filters && Object.keys(definition).length) args.filters = definition;
  }
  if (!args.filters && !args.query && field.link_filters) {
    try {
      const rows = (typeof field.link_filters === 'string' ? JSON.parse(field.link_filters) : field.link_filters) as unknown[][];
      const values = rows.map((row) => {
        const value = row[3];
        if (typeof value === 'string' && value.startsWith('eval:')) {
          // Same trust model as depends_on: expressions come from DocType metadata.
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          return [row[0], row[1], row[2], new Function('doc', `return (${value.slice(5)})`)(context ?? doc)];
        }
        return row;
      });
      // A filter on a value that isn't set yet doesn't constrain the search, as in Desk.
      const usable = values.filter((row) => row[3] !== undefined && row[3] !== null && row[3] !== '');
      if (usable.length) args.filters = usable;
    } catch (error) {
      console.error(`[desk] bad link_filters on ${field.fieldname}`, error);
    }
  }
  return args.filters || args.query ? args : undefined;
}

/** A persistent element scripts can fill with jQuery; the renderer mounts it when it has content. */
export function makeHtmlWrapper(fieldname: string, filled: Record<string, boolean>): HTMLElement {
  const element = document.createElement('div');
  element.className = `desk-html desk-html--${fieldname}`;
  new MutationObserver(() => { filled[fieldname] = element.childNodes.length > 0; }).observe(element, { childList: true });
  return element;
}
