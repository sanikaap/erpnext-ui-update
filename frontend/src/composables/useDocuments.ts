import { onMounted, ref, watch, type Ref } from 'vue';
import type { Filter, FrappeDocument, Sort } from '@/types/erp';
import { listDocuments } from '@/services/document-api';
import { FrappeApiError, frappeErrorMessage } from '@/services/erpnext-api';

export interface DocumentQuery {
  doctype: string;
  /** Fieldnames to fetch (name is always included). */
  fields: string[];
  search: string;
  searchFields: string[];
  filters: Filter[];
  sort: Sort[];
  page: number;
  pageLength: number;
}

/**
 * Fetches one page of any DocType for the list view. The host owns the query
 * (search, Filters, Sorts, paging); this only turns it into Frappe requests.
 */
export function useDocuments(query: Ref<DocumentQuery>, enabled: Ref<boolean> = ref(true)) {
  const rows = ref<FrappeDocument[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const forbidden = ref(false);
  let generation = 0;

  async function load() {
    const current = query.value;
    if (!enabled.value || !current.doctype || !current.fields.length) return;
    const run = (generation += 1);
    loading.value = true;
    error.value = null;
    forbidden.value = false;
    try {
      const result = await listDocuments({
        doctype: current.doctype,
        fields: [...new Set(['name', ...current.fields])],
        search: current.search.trim(),
        searchFields: current.searchFields,
        filters: current.filters,
        sort: current.sort,
        start: (current.page - 1) * current.pageLength,
        pageLength: current.pageLength,
      });
      if (run !== generation) return;
      rows.value = result.data;
      total.value = result.total;
    } catch (cause) {
      if (run !== generation) return;
      rows.value = [];
      total.value = 0;
      forbidden.value = cause instanceof FrappeApiError && cause.status === 403;
      error.value = frappeErrorMessage(cause, 'Unable to load ERPNext records.');
    } finally {
      if (run === generation) loading.value = false;
    }
  }

  // Typing in search waits for a pause; every other change reloads at once.
  let searchTimer: number | undefined;
  watch(() => {
    const { search, ...rest } = query.value;
    return JSON.stringify(rest);
  }, () => void load());
  watch(() => query.value.search, () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void load(), 300);
  });
  watch(enabled, (value) => { if (value) void load(); });
  onMounted(load);

  return { rows, total, loading, error, forbidden, load };
}
