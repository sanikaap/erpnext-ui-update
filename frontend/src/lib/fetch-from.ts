import { erpnextApi } from '@/services/erpnext-api';
import type { ERPNextMetadataField } from '@/types/erp';

/**
 * Apply `fetch_from` after a Link changes, the way Desk does:
 * every field whose fetch_from is "<link_fieldname>.<source>" is filled from the
 * linked record. Works for any DocType and for child-table rows.
 */
export async function applyFetchFrom(
  doc: Record<string, unknown>,
  fields: ERPNextMetadataField[],
  linkField: ERPNextMetadataField,
  value: string,
) {
  const prefix = `${linkField.fieldname}.`;
  const targets = fields.filter((field) => field.fetch_from?.startsWith(prefix));
  if (!targets.length || linkField.fieldtype !== 'Link' || !linkField.options) return;

  if (!value) {
    for (const target of targets) doc[target.fieldname] = target.fieldtype === 'Check' ? 0 : null;
    return;
  }

  const sources = [...new Set(targets.map((target) => target.fetch_from!.slice(prefix.length)))];
  try {
    const response = await erpnextApi.call<Record<string, unknown>>('frappe.client.get_value', {
      doctype: linkField.options,
      filters: value,
      fieldname: sources,
    });
    const values = response.message || {};
    // The user may have picked another record while this request was in flight.
    if (doc[linkField.fieldname] !== value) return;
    for (const target of targets) {
      const source = target.fetch_from!.slice(prefix.length);
      if (source in values) doc[target.fieldname] = values[source];
    }
  } catch {
    // Fetching is a convenience; ERPNext re-fetches on save where it matters.
  }
}

/**
 * Resolve ":DocType" defaults the way Frappe does: read this field's value from the
 * DocType record linked on the document (or its parent), e.g. a row's cost_center
 * default ":Company" becomes the default cost center of the selected company.
 */
export async function applyDynamicDefaults(
  doc: Record<string, unknown>,
  fields: ERPNextMetadataField[],
  parent?: Record<string, unknown>,
) {
  const dynamic = fields.filter((field) => typeof field.default === 'string' && field.default.startsWith(':') && (doc[field.fieldname] === undefined || doc[field.fieldname] === '' || doc[field.fieldname] === null));
  await Promise.all(dynamic.map(async (field) => {
    const refDoctype = String(field.default).slice(1);
    const refField = refDoctype.toLowerCase().replace(/ /g, '_');
    const refValue = (parent ?? doc)[refField];
    if (typeof refValue !== 'string' || !refValue) return;
    try {
      const response = await erpnextApi.call<Record<string, unknown>>('frappe.client.get_value', { doctype: refDoctype, filters: refValue, fieldname: field.fieldname });
      const value = response.message?.[field.fieldname];
      if (value !== undefined && value !== null && (doc[field.fieldname] === undefined || doc[field.fieldname] === '' || doc[field.fieldname] === null)) doc[field.fieldname] = value;
    } catch { /* leave it to ERPNext */ }
  }));
}
