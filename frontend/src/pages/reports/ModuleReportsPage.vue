<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowUpRight, FileSpreadsheet, Search } from 'lucide-vue-next';
import { moduleRegistry } from '@/app/module-registry';
import { reportRoute } from '@/config/navigation';
import { documentApi } from '@/services/document-api';
import { frappeErrorMessage } from '@/services/erpnext-api';
import EmptyState from '@/components/feedback/EmptyState.vue';
import ErrorState from '@/components/feedback/ErrorState.vue';

/** Every enabled ERPNext report of a module, each opening in the in-app report runner. */
const route = useRoute();
const module = computed(() => moduleRegistry.find((candidate) => candidate.key === String(route.meta.moduleKey)));
const reports = ref<{ name: string; report_type: string; ref_doctype?: string }[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const search = ref('');

async function load() {
  if (!module.value) return;
  loading.value = true;
  error.value = null;
  try {
    reports.value = await documentApi.list('Report', {
      fields: ['name', 'report_type', 'ref_doctype'],
      filters: [['module', 'in', module.value.reportModules], ['disabled', '=', 0], ['report_type', 'in', ['Script Report', 'Query Report', 'Report Builder']]],
      orderBy: 'name asc',
      limit: 500,
    });
  } catch (cause) {
    error.value = frappeErrorMessage(cause, 'Unable to load reports.');
  } finally {
    loading.value = false;
  }
}
watch(module, load, { immediate: true });

const groups = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const filtered = reports.value.filter((report) => !needle || report.name.toLowerCase().includes(needle) || report.ref_doctype?.toLowerCase().includes(needle));
  const map = new Map<string, typeof filtered>();
  for (const report of filtered) {
    const key = report.ref_doctype || 'General';
    map.set(key, [...(map.get(key) ?? []), report]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});
</script>

<template>
  <div v-if="module" class="page stagger-in" :style="{ '--c': `var(${module.color})` }">
    <section class="page-header">
      <div><p class="eyebrow">{{ module.label }} · Reports</p><h1 class="page-title">{{ module.label }} reports<span v-if="reports.length" class="count-pill tabular">{{ reports.length }}</span></h1><p class="page-subtitle">ERPNext reports for this module, run inside this workspace.</p></div>
      <label class="report-search"><Search :size="14" /><input v-model="search" placeholder="Search reports…" aria-label="Search reports" /></label>
    </section>
    <ErrorState v-if="error" :message="error" @retry="load" />
    <div v-else-if="loading" class="report-grid"><span v-for="index in 9" :key="index" class="skeleton" style="height: 58px; border-radius: 12px" /></div>
    <EmptyState v-else-if="!groups.length" title="No reports found" :description="search ? 'Try a different search.' : 'This module has no enabled reports.'" :icon="FileSpreadsheet" />
    <section v-for="[group, items] in groups" v-else :key="group" class="report-group">
      <h2 class="group-title">{{ group }}</h2>
      <div class="report-grid">
        <RouterLink v-for="report in items" :key="report.name" :to="reportRoute(report.name)" class="report-card">
          <span class="report-icon"><FileSpreadsheet :size="15" /></span>
          <span class="report-copy"><strong>{{ report.name }}</strong><small>{{ report.report_type }}</small></span>
          <ArrowUpRight :size="14" class="report-arrow" />
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.count-pill { display: inline-flex; align-items: center; height: 22px; margin-left: 10px; padding: 0 9px; vertical-align: 3px; color: var(--primary-soft-foreground); border-radius: 999px; background: var(--primary-soft); font-size: 12px; font-weight: 600; }
.report-search { display: flex; align-items: center; gap: 8px; width: 260px; height: 36px; padding: 0 11px; color: var(--subtle-foreground); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-background); }
.report-search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.report-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: none; font-size: 13px; }
.report-group { display: flex; flex-direction: column; gap: 10px; }
.group-title { color: color-mix(in srgb, var(--c) 70%, var(--muted-foreground)); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.report-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.report-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); transition: border-color .15s, box-shadow .15s; }
.report-card:hover { border-color: color-mix(in srgb, var(--c) 45%, var(--border)); box-shadow: var(--shadow-md); }
.report-icon { display: grid; width: 32px; height: 32px; flex: none; place-items: center; color: var(--c); border-radius: 9px; background: color-mix(in srgb, var(--c) 12%, transparent); }
.report-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.report-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.report-copy small { color: var(--subtle-foreground); font-size: 11.5px; }
.report-arrow { flex: none; color: var(--subtle-foreground); }
.report-card:hover .report-arrow { color: var(--c); }
@media (max-width: 700px) { .report-search { width: 100%; } }
</style>
