import { ref } from 'vue';
import { erpnextApi } from '@/services/erpnext-api';
import { useCurrentUser } from '@/composables/useCurrentUser';
import type { DefaultContext } from '@/lib/doctype';

// Global Defaults are what Desk pre-fills into new documents (company, currency).
// Loaded once per page load and shared by every form.
const defaults = ref<Record<string, unknown>>({});
let pending: Promise<void> | null = null;

async function loadDefaults() {
  const read = (field: string) => erpnextApi
    .call<string>('frappe.client.get_single_value', { doctype: 'Global Defaults', field })
    .then((response) => response.message || undefined)
    .catch(() => undefined);
  const [company, currency] = await Promise.all([read('default_company'), read('default_currency')]);
  defaults.value = {
    ...(company ? { Company: company, company } : {}),
    ...(currency ? { Currency: currency, currency } : {}),
  };
}

export function useSessionDefaults() {
  if (!pending) pending = loadDefaults();
  const { user } = useCurrentUser();
  const ready = pending;

  function context(): DefaultContext {
    return { user: user.value?.id, defaults: defaults.value };
  }

  return { defaults, ready, context };
}
