<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FileBarChart, Link2, Plus } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import EmptyState from '@/components/feedback/EmptyState.vue';
import { erpnextApi, frappeErrorMessage } from '@/services/erpnext-api';
import { getDocumentRouteForDocType } from '@/config/navigation';
import type { DocTypeDashboard } from '@/services/metadata-api';
import { ensureDeskRuntime } from '@/desk/runtime';
import type { FormController } from '@/desk/form';

/**
 * Desk's Connections: the groups of linked DocTypes from the DocType's *_dashboard.py,
 * with counts from frappe.desk.notifications.get_open_count (ERPNext's own permission
 * checks apply). Nothing here knows about a specific DocType.
 */
const props = defineProps<{ doctype: string; name: string; dashboard: DocTypeDashboard; doc: Record<string, unknown>; frm: FormController | null; extra?: { label: string; items: string[] }[] }>();
const emit = defineEmits<{ total: [count: number] }>();
const router = useRouter();

interface Count { count: number; open_count: number; names?: string[] }
const counts = ref<Record<string, Count>>({});
const loading = ref(true);
const failure = ref('');
const readable = ref<Set<string>>(new Set());
const creatable = ref<Set<string>>(new Set());

const allGroups = computed(() => [...(props.dashboard.transactions ?? []), ...(props.extra ?? [])]);
const allItems = computed(() => [...new Set(allGroups.value.flatMap((group) => group.items))]);
const groups = computed(() => allGroups.value
  .map((group) => ({ label: group.label ?? '', items: group.items.filter((item) => readable.value.has(item)) }))
  .filter((group) => group.items.length));
const reports = computed(() => (props.dashboard.reports ?? []).filter((group) => group.items.length));

async function load() {
  const items = allItems.value;
  if (!items.length || !props.name) { loading.value = false; return; }
  loading.value = true;
  failure.value = '';
  try {
    // The session's boot data lists what this user can read and create, as in Desk.
    await ensureDeskRuntime();
    const { can_read: canRead = [], can_create: canCreate = [] } = (window as unknown as { frappe: { boot: { user: { can_read?: string[]; can_create?: string[] } } } }).frappe.boot.user;
    readable.value = new Set(items.filter((item) => canRead.includes(item)));
    creatable.value = new Set(items.filter((item) => canCreate.includes(item)));
    const method = props.dashboard.method || 'frappe.desk.notifications.get_open_count';
    const response = await erpnextApi.call<{ count?: { external_links_found?: Array<Count & { doctype: string }>; internal_links_found?: Array<Count & { doctype: string }> } }>(method, { doctype: props.doctype, name: props.name, items: items.filter((item) => readable.value.has(item)) });
    const found = response.message?.count;
    const next: Record<string, Count> = {};
    for (const entry of [...(found?.external_links_found ?? []), ...(found?.internal_links_found ?? [])]) {
      const existing = next[entry.doctype];
      next[entry.doctype] = existing ? { ...entry, count: Math.max(existing.count ?? 0, entry.count ?? 0), names: entry.names ?? existing.names } : entry;
    }
    counts.value = next;
    emit('total', Object.values(next).reduce((sum, entry) => sum + (Number(entry.count) || 0), 0));
  } catch (cause) {
    failure.value = frappeErrorMessage(cause, 'Could not load connections.');
  } finally {
    loading.value = false;
  }
}
watch(() => [props.doctype, props.name, props.dashboard, allItems.value.length], load, { immediate: true });
defineExpose({ reload: load });

const internalLinks = computed(() => props.dashboard.internal_links ?? {});
/** Names of documents this document itself points at (internal links), read from its rows. */
function internalNames(doctype: string): string[] {
  const link = internalLinks.value[doctype];
  if (!link) return [];
  if (typeof link === 'string') { const value = props.doc[link]; return value ? [String(value)] : []; }
  const [table, fieldname] = link;
  const rows = props.doc[table];
  return Array.isArray(rows) ? [...new Set(rows.map((row) => row[fieldname]).filter(Boolean).map(String))] : [];
}
function listQuery(doctype: string): Record<string, string> | null {
  if (internalLinks.value[doctype]) {
    const names = counts.value[doctype]?.names ?? internalNames(doctype);
    return names.length ? { name: JSON.stringify(['in', names]) } : null;
  }
  if (!props.dashboard.fieldname) return null;
  const fieldname = props.dashboard.non_standard_fieldnames?.[doctype] ?? props.dashboard.fieldname;
  const query: Record<string, string> = { [fieldname]: props.name };
  const dynamic = props.dashboard.dynamic_links?.[fieldname];
  if (dynamic) query[dynamic[1]] = dynamic[0];
  return query;
}
function openList(doctype: string) {
  const query = listQuery(doctype);
  if (query) void router.push({ path: getDocumentRouteForDocType(doctype), query });
}
function create(doctype: string) {
  if (props.frm) void props.frm.make_new(doctype);
}
const canAdd = (doctype: string) => !internalLinks.value[doctype] && (props.frm ? props.frm.can_create(doctype) : creatable.value.has(doctype));
</script>

<template>
  <div class="connections">
    <p v-if="failure" class="connections-error" role="alert">{{ failure }}</p>
    <EmptyState v-if="!groups.length && !reports.length && !loading" :icon="Link2" title="No connections" description="This document type has no linked documents defined." />
    <div v-if="!groups.length && !reports.length && loading" class="connection-grid" aria-busy="true">
      <div v-for="index in 3" :key="index" class="connection-group">
        <span class="skeleton" style="display: block; width: 90px; height: 12px; margin-bottom: 14px" />
        <span v-for="row in 3" :key="row" class="skeleton" style="display: block; height: 38px; margin-bottom: 8px; border-radius: 8px" />
      </div>
    </div>
    <div v-else class="connection-grid">
      <section v-for="group in groups" :key="group.label" class="connection-group">
        <h3>{{ group.label }}</h3>
        <ul>
          <li v-for="item in group.items" :key="item" class="connection-row" :data-doctype="item">
            <button type="button" class="connection-link" :disabled="!listQuery(item)" @click="openList(item)">
              <span class="connection-name">{{ item }}</span>
              <span v-if="loading && counts[item] === undefined" class="skeleton connection-skeleton" />
              <!-- As in Desk, a count appears only when there are linked documents. -->
              <span v-else-if="counts[item]?.count" class="connection-count tabular">{{ counts[item].count }}</span>
              <span v-if="counts[item]?.open_count" class="connection-open tabular" :title="`${counts[item].open_count} open`">{{ counts[item].open_count }} open</span>
            </button>
            <button v-if="canAdd(item)" type="button" class="connection-add" :aria-label="`New ${item}`" :title="`New ${item}`" @click="create(item)"><Plus :size="14" /></button>
          </li>
        </ul>
      </section>
      <section v-for="group in reports" :key="`report-${group.label}`" class="connection-group">
        <h3>{{ group.label || 'Reports' }}</h3>
        <ul>
          <li v-for="report in group.items" :key="report" class="connection-row">
            <RouterLink class="connection-link" :to="{ name: 'report', params: { report } }"><FileBarChart :size="14" class="connection-report" /><span class="connection-name">{{ report }}</span></RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.connections { padding: 20px 22px 22px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.connections-error { margin-bottom: 12px; padding: 9px 12px; color: var(--danger); border-radius: var(--radius-md); background: var(--danger-soft); font-size: 12.5px; }
.connection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px; }
.connection-group h3 { margin-bottom: 10px; color: var(--foreground); font-size: 13px; font-weight: 600; }
.connection-group ul { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
/* One bordered row per linked DocType, with the "new" button inside it, as Desk lays it out. */
.connection-row { display: flex; min-height: 38px; align-items: center; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); transition: border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease); }
.connection-row:hover { border-color: var(--primary); background: var(--primary-softer); }
.connection-link { display: flex; min-width: 0; min-height: 36px; flex: 1; align-items: center; gap: 8px; padding: 0 10px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; font-size: 13px; text-align: left; text-decoration: none; }
.connection-link:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
.connection-link:disabled { cursor: default; opacity: .75; }
.connection-name { min-width: 0; overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.connection-count { flex: none; min-width: 22px; padding: 0 7px; color: var(--primary-soft-foreground); border-radius: 999px; background: var(--primary-soft); font-size: 11.5px; font-weight: 600; line-height: 19px; text-align: center; }
.connection-open { flex: none; color: var(--warning-soft-foreground); font-size: 11.5px; white-space: nowrap; }
.connection-report { flex: none; color: var(--icon-foreground); }
.connection-skeleton { width: 22px; height: 16px; border-radius: 999px; }
.connection-add { display: grid; width: 26px; height: 26px; flex: none; margin-right: 6px; place-items: center; color: var(--muted-foreground); border: 0; border-radius: var(--radius-sm, 6px); background: var(--muted); }
.connection-add:hover { color: var(--primary-foreground); background: var(--primary); }
.connection-add:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
</style>
