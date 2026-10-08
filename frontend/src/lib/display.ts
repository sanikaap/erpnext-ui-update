import type { StatusTone } from '@/types/erp';

// Presentation helpers shared by tables, detail pages and cards.

// Brand violet, cyan and neutral: green/red/amber are reserved for status meaning.
const monogramTones: StatusTone[] = ['violet', 'cyan', 'blue', 'slate'];

/** Stable tone for a record name, so the same record always gets the same color. */
export function monogramTone(value: string): StatusTone {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return monogramTones[Math.abs(hash) % monogramTones.length];
}

export function monogram(value: string) {
  const words = String(value ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

export function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/** Human-readable value for a Frappe field. Check fields become Yes/No. */
export function formatFieldValue(value: unknown, fieldtype?: string) {
  if (fieldtype === 'Check') return Number(value) === 1 || value === true ? 'Yes' : 'No';
  if (isEmptyValue(value)) return '—';
  if (typeof value === 'number' && ['Currency', 'Float', 'Percent'].includes(fieldtype ?? '')) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} rows` : 'Details available';
  return String(value);
}

/*
 * One status vocabulary for the whole app:
 *   slate  draft / inactive / neutral
 *   blue   submitted, open, in-flight work
 *   amber  waiting on someone (to bill, pending, unpaid)
 *   green  done and good (completed, paid, active)
 *   rose   cancelled, overdue, rejected
 */
const statusTones: Record<string, StatusTone> = {
  draft: 'slate', inactive: 'slate', disabled: 'slate', closed: 'slate', 'not started': 'slate', template: 'slate',
  open: 'blue', submitted: 'blue', 'in progress': 'blue', working: 'blue', replied: 'blue', 'not processed': 'blue', ordered: 'blue', issued: 'blue', transferred: 'blue', quotation: 'blue',
  pending: 'amber', 'to bill': 'amber', 'to deliver': 'amber', 'to deliver and bill': 'amber', 'to receive': 'amber', 'to receive and bill': 'amber',
  unpaid: 'amber', 'partly paid': 'amber', 'on hold': 'amber', hold: 'amber', 'partially ordered': 'amber', 'partly delivered': 'amber', 'partially received': 'amber', 'to pay': 'amber', 'material transferred': 'amber', 'not started yet': 'amber',
  completed: 'green', paid: 'green', active: 'green', enabled: 'green', converted: 'green', delivered: 'green', received: 'green', resolved: 'green', approved: 'green', 'fully billed': 'green', billed: 'green', return: 'cyan', 'credit note issued': 'cyan', 'debit note issued': 'cyan',
  // NGO vocabulary
  running: 'green', starting: 'blue', green: 'green', amber: 'amber', red: 'rose', achieved: 'green', 'on track': 'blue', behind: 'amber',
  cancelled: 'rose', overdue: 'rose', rejected: 'rose', lost: 'rose', stopped: 'rose', expired: 'rose', 'overdue and discounted': 'rose', 'unpaid and discounted': 'amber',
};

export function statusTone(value: unknown): StatusTone {
  return statusTones[String(value ?? '').toLowerCase()] ?? 'slate';
}

/**
 * Status badge for any document: its own `status` field when it has one,
 * otherwise docstatus, otherwise the `disabled` / `enabled` flags.
 */
export function documentStatus(doc: Record<string, unknown> | null | undefined, options: { submittable?: boolean } = {}): { label: string; tone: StatusTone } | null {
  if (!doc) return null;
  const docstatus = Number(doc.docstatus ?? 0);
  if (docstatus === 2) return { label: 'Cancelled', tone: 'rose' };
  if (typeof doc.status === 'string' && doc.status) return { label: doc.status, tone: statusTone(doc.status) };
  if (docstatus === 1) return { label: 'Submitted', tone: 'blue' };
  if (options.submittable) return { label: 'Draft', tone: 'slate' };
  if (doc.disabled !== undefined) return Number(doc.disabled) === 1 ? { label: 'Disabled', tone: 'slate' } : { label: 'Enabled', tone: 'green' };
  if (doc.enabled !== undefined) return Number(doc.enabled) === 1 ? { label: 'Enabled', tone: 'green' } : { label: 'Disabled', tone: 'slate' };
  if (doc.is_active !== undefined) return ['1', 1, 'Yes', true].includes(doc.is_active as never) ? { label: 'Active', tone: 'green' } : { label: 'Inactive', tone: 'slate' };
  return null;
}
