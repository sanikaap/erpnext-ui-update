<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Download, FileSpreadsheet, Play, RefreshCw } from 'lucide-vue-next';
import FieldRenderer from '@/components/forms/FieldRenderer.vue';
import TrendChart from '@/components/charts/TrendChart.vue';
import EmptyState from '@/components/feedback/EmptyState.vue';
import ErrorState from '@/components/feedback/ErrorState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { erpnextApi, frappeErrorMessage } from '@/services/erpnext-api';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { loadReportFilters, type ReportFilter } from '@/lib/report-script';
import { formatValue, stripHtml, NUMERIC_TYPES } from '@/lib/doctype';
import { documentApi } from '@/services/document-api';

/**
 * Runs any ERPNext Script/Query Report inside this UI (no hand-off to Desk).
 * Filters come from the report's own definition; Report Builder reports open as lists.
 */
const route = useRoute();
const router = useRouter();
const name = computed(() => String(route.params.report || ''));
const { context, ready: defaultsReady } = useSessionDefaults();
const { user } = useCurrentUser();

interface Column { fieldname: string; label: string; fieldtype: string; options?: string; width?: number }
interface Summary { label: string; value: unknown; datatype?: string; indicator?: string }

const reportDoc = ref<Record<string, unknown> | null>(null);
const filters = ref<ReportFilter[]>([]);
const values = reactive<Record<string, unknown>>({});
const columns = ref<Column[]>([]);
const rows = ref<Record<string, unknown>[]>([]);
const summary = ref<Summary[]>([]);
const chart = ref<{ labels: string[]; series: { name: string; data: number[]; color: string }[]; type: 'bar' | 'line' } | null>(null);
const message = ref<string | null>(null);
const loading = ref(true);
const running = ref(false);
const error = ref<string | null>(null);
const runError = ref<string | null>(null);
const hasRun = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const report = await documentApi.get<Record<string, unknown>>('Report', name.value);
    reportDoc.value = report;
    // Report Builder reports are saved list views: open the DocType's list instead.
    if (report.report_type === 'Report Builder' && report.ref_doctype) {
      await router.replace({ name: 'document-list', params: { doctype: String(report.ref_doctype) } });
      return;
    }
    await defaultsReady;
    filters.value = (await loadReportFilters(name.value, { user: user.value?.id, defaults: context().defaults ?? {} })).filter((filter) => !filter.hidden);
    for (const key of Object.keys(values)) delete values[key];
    for (const filter of filters.value) {
      if (filter.default !== undefined) values[filter.fieldname] = filter.filterType === 'MultiSelectList' && Array.isArray(filter.default) ? filter.default[0] : filter.default;
    }
    // Run straight away when nothing required is missing, as Desk does.
    if (!missing.value.length) await run();
  } catch (cause) {
    error.value = frappeErrorMessage(cause, 'Unable to load this report.');
  } finally {
    loading.value = false;
  }
}

const missing = computed(() => filters.value.filter((filter) => filter.reqd && (values[filter.fieldname] === undefined || values[filter.fieldname] === '' || values[filter.fieldname] === null)));

function parseColumn(raw: unknown, index: number): Column {
  if (typeof raw === 'string') {
    // Legacy "Label:Fieldtype/Options:Width"
    const [label, type = 'Data', width] = raw.split(':');
    const [fieldtype, options] = type.split('/');
    return { label, fieldname: label.toLowerCase().replace(/\W+/g, '_') || `col_${index}`, fieldtype: fieldtype || 'Data', options, width: Number(width) || undefined };
  }
  const column = raw as Record<string, unknown>;
  return { fieldname: String(column.fieldname || column.id || `col_${index}`), label: String(column.label || column.fieldname || ''), fieldtype: String(column.fieldtype || 'Data'), options: column.options ? String(column.options) : undefined, width: Number(column.width) || undefined };
}

async function run() {
  if (missing.value.length) { runError.value = `Fill in: ${missing.value.map((filter) => filter.label).join(', ')}`; return; }
  running.value = true;
  runError.value = null;
  try {
    const payload: Record<string, unknown> = {};
    for (const filter of filters.value) {
      const value = values[filter.fieldname];
      if (value === undefined || value === null || value === '') continue;
      payload[filter.fieldname] = filter.filterType === 'MultiSelectList' ? [value] : value;
    }
    const response = await erpnextApi.callPost<Record<string, unknown>>('frappe.desk.query_report.run', { report_name: name.value, filters: payload, ignore_prepared_report: 1 });
    const result = response.message || {};
    columns.value = ((result.columns as unknown[]) || []).map(parseColumn).filter((column) => column.label);
    rows.value = ((result.result as unknown[]) || []).map((row) => (Array.isArray(row) ? Object.fromEntries(columns.value.map((column, index) => [column.fieldname, row[index]])) : row as Record<string, unknown>));
    summary.value = ((result.report_summary as Summary[]) || []).filter((entry) => entry && entry.label);
    message.value = typeof result.message === 'string' ? stripHtml(result.message) : null;
    const data = (result.chart as { data?: { labels?: unknown[]; datasets?: { name?: string; values?: unknown[] }[] }; type?: string } | undefined);
    chart.value = data?.data?.labels?.length && data.data.datasets?.length
      ? { labels: data.data.labels.map((label) => stripHtml(String(label))), series: data.data.datasets.slice(0, 4).map((set, index) => ({ name: set.name || `Series ${index + 1}`, data: (set.values || []).map(Number), color: `--chart-${index + 1}` })), type: data.type === 'line' ? 'line' : 'bar' }
      : null;
    hasRun.value = true;
  } catch (cause) {
    runError.value = frappeErrorMessage(cause, 'ERPNext could not run this report.');
  } finally {
    running.value = false;
  }
}

watch(name, load, { immediate: true });

const isNumeric = (column: Column) => NUMERIC_TYPES.has(column.fieldtype);
function cell(row: Record<string, unknown>, column: Column) {
  const value = row[column.fieldname];
  if (typeof value === 'string' && /<[a-z][\s\S]*>/i.test(value)) return stripHtml(value);
  return formatValue(value, { fieldtype: column.fieldtype, options: column.fieldtype === 'Currency' ? (column.options || 'currency') : column.options }, row);
}
function linkTarget(row: Record<string, unknown>, column: Column) {
  const value = row[column.fieldname];
  if (column.fieldtype === 'Link' && column.options && typeof value === 'string' && value) return { name: 'document-detail', params: { doctype: column.options, name: value } };
  if (column.fieldtype === 'Dynamic Link' && column.options && typeof value === 'string' && value && typeof row[column.options] === 'string') return { name: 'document-detail', params: { doctype: String(row[column.options]), name: value } };
  return null;
}
const indent = (row: Record<string, unknown>) => (Number(row.indent) > 0 ? `${Number(row.indent) * 16}px` : undefined);

function exportCsv() {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [columns.value.map((column) => escape(column.label)).join(','), ...rows.value.map((row) => columns.value.map((column) => escape(isNumeric(column) ? String(row[column.fieldname] ?? '') : cell(row, column).replace(/^—$/, ''))).join(','))];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  link.download = `${name.value.replace(/\s+/g, '-').toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
</script>

<template>
  <div class="page stagger-in">
    <button type="button" class="back-link" @click="router.back()"><ArrowLeft :size="14" />Back</button>
    <section class="page-header">
      <div>
        <p class="eyebrow">{{ reportDoc?.module || 'Report' }} · {{ reportDoc?.report_type || 'ERPNext report' }}</p>
        <h1 class="page-title">{{ name }}</h1>
        <p v-if="reportDoc?.ref_doctype" class="page-subtitle">Based on {{ reportDoc.ref_doctype }}</p>
      </div>
      <div class="page-actions">
        <BaseButton v-if="rows.length" variant="quiet" size="sm" @click="exportCsv"><Download :size="14" />Export CSV</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="running" :disabled="loading" @click="run"><Play v-if="!running" :size="14" />Run report</BaseButton>
      </div>
    </section>

    <ErrorState v-if="error" :message="error" class="report-card" @retry="load" />
    <template v-else>
      <section v-if="filters.length" class="report-filters">
        <div v-for="filter in filters" :key="filter.fieldname" :class="['report-filter', { 'report-filter--check': filter.fieldtype === 'Check' }]">
          <label v-if="filter.fieldtype !== 'Check'" class="filter-label">{{ filter.label }}<b v-if="filter.reqd">*</b></label>
          <div v-if="filter.fieldtype === 'DateRange'" class="date-range">
            <input class="control" type="date" :value="Array.isArray(values[filter.fieldname]) ? (values[filter.fieldname] as string[])[0] : ''" @input="values[filter.fieldname] = [($event.target as HTMLInputElement).value, Array.isArray(values[filter.fieldname]) ? (values[filter.fieldname] as string[])[1] : '']" />
            <input class="control" type="date" :value="Array.isArray(values[filter.fieldname]) ? (values[filter.fieldname] as string[])[1] : ''" @input="values[filter.fieldname] = [Array.isArray(values[filter.fieldname]) ? (values[filter.fieldname] as string[])[0] : '', ($event.target as HTMLInputElement).value]" />
          </div>
          <FieldRenderer v-else v-model="values[filter.fieldname]" :field="filter" :doc="values" :invalid="missing.includes(filter) && Boolean(runError)" />
        </div>
      </section>
      <p v-if="runError" class="run-error" role="alert">{{ runError }}</p>

      <section v-if="summary.length" class="summary-grid">
        <article v-for="entry in summary" :key="entry.label" :class="['summary', `summary--${(entry.indicator || '').toLowerCase()}`]">
          <span>{{ entry.label }}</span>
          <strong class="tabular">{{ formatValue(entry.value, { fieldtype: entry.datatype || 'Data' }, { currency: context().defaults?.currency }) }}</strong>
        </article>
      </section>

      <section v-if="chart && rows.length" class="report-card report-chart">
        <TrendChart :labels="chart.labels" :series="chart.series" :type="chart.type" :height="240" />
      </section>

      <section class="report-card">
        <div v-if="loading || (running && !rows.length)" class="report-loading" aria-busy="true"><span v-for="index in 6" :key="index" class="skeleton" style="height: 28px; border-radius: 6px" /></div>
        <EmptyState v-else-if="!hasRun" title="Set the filters and run the report" description="Required filters are marked with *." :icon="FileSpreadsheet" />
        <EmptyState v-else-if="!rows.length" title="No data for these filters" :description="message || 'Try a wider date range or fewer filters.'" :icon="FileSpreadsheet">
          <BaseButton variant="quiet" size="sm" @click="run"><RefreshCw :size="14" />Run again</BaseButton>
        </EmptyState>
        <div v-else class="report-scroll">
          <table class="report-table">
            <thead><tr><th v-for="column in columns" :key="column.fieldname" :class="{ num: isNumeric(column) }" :style="column.width ? { minWidth: `${Math.min(column.width, 320)}px` } : undefined">{{ column.label }}</th></tr></thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="index" :class="{ 'row-bold': row.bold || row.is_total_row }">
                <td v-for="(column, columnIndex) in columns" :key="column.fieldname" :class="{ num: isNumeric(column) }" :style="columnIndex === 0 ? { paddingLeft: indent(row) ? `calc(14px + ${indent(row)})` : undefined } : undefined">
                  <RouterLink v-if="linkTarget(row, column)" :to="linkTarget(row, column)!" class="report-link">{{ row[column.fieldname] }}</RouterLink>
                  <span v-else :class="{ muted: cell(row, column) === '—' }">{{ cell(row, column) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="report-count tabular">{{ rows.length.toLocaleString() }} rows</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.report-card { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.report-chart { padding: 16px 18px 8px; }
.report-filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px 14px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.report-filter { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.report-filter--check { justify-content: flex-end; }
.filter-label { color: var(--muted-foreground); font-size: 12px; font-weight: 500; }
.filter-label b { margin-left: 2px; color: var(--danger); }
.date-range { display: flex; gap: 6px; }
.run-error { padding: 8px 12px; color: var(--danger); border-radius: var(--radius-md); background: var(--danger-soft); font-size: 12.5px; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.summary { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius-lg); background: var(--surface); }
.summary--green { border-left-color: var(--secondary); } .summary--red { border-left-color: var(--danger); } .summary--orange, .summary--yellow { border-left-color: var(--warning); }
.summary span { color: var(--muted-foreground); font-size: 12px; }
.summary strong { color: var(--foreground); font-size: 18px; font-weight: 700; }
.report-loading { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
.report-scroll { overflow: auto; max-height: calc(100dvh - 260px); }
.report-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12.5px; }
.report-table th { position: sticky; z-index: 1; top: 0; height: 36px; padding: 0 14px; color: var(--muted-foreground); border-bottom: 1px solid var(--border); background: var(--surface-tint); font-size: 11.5px; font-weight: 600; text-align: left; white-space: nowrap; }
.report-table td { height: 36px; padding: 0 14px; color: var(--foreground); border-bottom: 1px solid var(--border); white-space: nowrap; }
.report-table tbody tr:hover td { background: var(--primary-softer); }
.report-table .num { font-variant-numeric: tabular-nums; text-align: right; }
.row-bold td { font-weight: 700; }
.report-link { color: var(--info); font-weight: 500; }
.report-link:hover { text-decoration: underline; }
.muted { color: var(--subtle-foreground); }
.report-count { padding: 10px 14px; color: var(--muted-foreground); border-top: 1px solid var(--border); font-size: 12px; }
</style>
