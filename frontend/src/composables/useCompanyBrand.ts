import { computed, ref, watch } from 'vue';
import { erpnextApi } from '@/services/erpnext-api';
import { fileApi } from '@/services/file-api';
import { useSessionDefaults } from '@/composables/useSessionDefaults';

/*
 * Brand shown in the sidebar: the default company's name and logo
 * (Company › Company Logo). Loaded once per page load and shared.
 * Without a readable company the sidebar falls back to "ERPNext" and the built-in mark.
 */
interface CompanyBrand { name: string; logo: string }
const brand = ref<CompanyBrand | null>(null);
let loadedFor = '';

async function load(company: string) {
  loadedFor = company;
  try {
    const response = await erpnextApi.call<{ company_name?: string; company_logo?: string }>('frappe.client.get_value', {
      doctype: 'Company', filters: company, fieldname: JSON.stringify(['company_name', 'company_logo']),
    });
    const values = response.message ?? {};
    brand.value = { name: values.company_name || company, logo: values.company_logo ? fileApi.getUrl(values.company_logo) : '' };
  } catch {
    // No read access to Company: still show its name, with the built-in mark.
    brand.value = { name: company, logo: '' };
  }
}

export function useCompanyBrand() {
  const { defaults } = useSessionDefaults();
  watch(() => defaults.value.company as string | undefined, (company) => {
    if (company && company !== loadedFor) void load(company);
  }, { immediate: true });
  return {
    name: computed(() => brand.value?.name || 'ERPNext'),
    logo: computed(() => brand.value?.logo || ''),
  };
}
