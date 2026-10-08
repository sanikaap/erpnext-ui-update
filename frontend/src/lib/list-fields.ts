import { NO_VALUE_TYPES, TABLE_TYPES } from '@/lib/doctype';
import type { ERPNextMetadataField } from '@/types/erp';

/** Standard columns every DocType has, offered alongside its own fields. */
export const STANDARD_LIST_FIELDS: ERPNextMetadataField[] = [
  { fieldname: 'name', label: 'ID', fieldtype: 'Data' },
  { fieldname: 'modified', label: 'Last Updated', fieldtype: 'Datetime' },
  { fieldname: 'creation', label: 'Created On', fieldtype: 'Datetime' },
  { fieldname: 'owner', label: 'Created By', fieldtype: 'Link', options: 'User' },
];

/** Field Options: the fields a list control offers, derived from Meta. */
export function fieldOptions(fields: ERPNextMetadataField[]) {
  const own = fields.filter((field) => !NO_VALUE_TYPES.has(field.fieldtype) && !TABLE_TYPES.has(field.fieldtype) && !['Text Editor', 'Long Text', 'Code', 'JSON', 'HTML Editor', 'Password', 'Attach Image', 'Signature'].includes(field.fieldtype));
  const ownNames = new Set(own.map((field) => field.fieldname));
  return [...STANDARD_LIST_FIELDS.filter((field) => !ownNames.has(field.fieldname)), ...own];
}

export const OPERATORS: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'like', label: 'contains' }, { value: '=', label: 'equals' }, { value: '!=', label: 'not equals' },
    { value: 'not like', label: 'does not contain' }, { value: 'is', label: 'is' },
  ],
  link: [{ value: '=', label: 'equals' }, { value: '!=', label: 'not equals' }, { value: 'like', label: 'contains' }, { value: 'is', label: 'is' }],
  select: [{ value: '=', label: 'equals' }, { value: '!=', label: 'not equals' }, { value: 'is', label: 'is' }],
  check: [{ value: '=', label: 'is' }],
  number: [
    { value: '=', label: '=' }, { value: '!=', label: '≠' }, { value: '>', label: '>' }, { value: '>=', label: '≥' },
    { value: '<', label: '<' }, { value: '<=', label: '≤' }, { value: 'is', label: 'is' },
  ],
  date: [
    { value: '=', label: 'on' }, { value: '>', label: 'after' }, { value: '>=', label: 'on or after' },
    { value: '<', label: 'before' }, { value: '<=', label: 'on or before' }, { value: 'is', label: 'is' },
  ],
};

export function operatorGroup(field?: Pick<ERPNextMetadataField, 'fieldtype'>) {
  switch (field?.fieldtype) {
    case 'Link': case 'Dynamic Link': return 'link';
    case 'Select': return 'select';
    case 'Check': return 'check';
    case 'Int': case 'Float': case 'Currency': case 'Percent': return 'number';
    case 'Date': case 'Datetime': return 'date';
    default: return 'text';
  }
}

export function defaultOperator(field?: Pick<ERPNextMetadataField, 'fieldtype'>) {
  const group = operatorGroup(field);
  return group === 'text' ? 'like' : '=';
}
