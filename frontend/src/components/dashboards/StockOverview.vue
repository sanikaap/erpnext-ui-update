<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, Boxes, ClipboardCheck, Coins, FilePen,
  FileSpreadsheet, PackageMinus, PackagePlus, Plus, RefreshCw, TrendingUp, Trophy, Truck, type LucideIcon,
} from 'lucide-vue-next';
import PanelCard from '@/components/ui/PanelCard.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import MetricCard, { type Metric } from '@/components/data-display/MetricCard.vue';
import TrendChart from '@/components/charts/TrendChart.vue';
import ChartPlaceholder from '@/components/charts/ChartPlaceholder.vue';
import ErrorState from '@/components/feedback/ErrorState.vue';
import DashboardHeader from '@/components/dashboards/DashboardHeader.vue';
import ActivityFeed, { type ActivityRow } from '@/components/dashboards/ActivityFeed.vue';
import ValueTable, { type ValueRow } from '@/components/dashboards/ValueTable.vue';
import AlertList, { type AlertRow } from '@/components/dashboards/AlertList.vue';
import QuickActions from '@/components/dashboards/QuickActions.vue';
import { stockApi, type Compared, type Section, type StockActivity, type StockOverview, type TrendPeriod } from '@/services/stock-api';
import { hasDocTypePermission } from '@/services/metadata-api';
import { FrappeApiError, frappeErrorMessage } from '@/services/erpnext-api';
import { getDocumentRouteForDocType } from '@/config/navigation';
import { getModuleByKey } from '@/app/module-registry';
import { compactCurrency, formatCurrency, formatDate, relativeTime } from '@/lib/doctype';

/**
 * Stock module overview, from ERPNext's own stock records (see
 * modern_erp_ui/api/stock_dashboard.py for every definition). Nothing here is computed
 * from mock data: a section without data shows an empty state, a section the user
 * cannot read shows a permission state.
 */
const router = useRouter();
const reportsRoute = getModuleByKey('stock')?.reportsRoute;
const overview = ref<StockOverview | null>(null);
const loading = ref(true);
const trendLoading = ref(false);
const failure = ref('');
const failureKind = ref<'error' | 'permission'>('error');
const period = ref<TrendPeriod>('26w');
const periods: { value: TrendPeriod; label: string }[] = [
  { value: '30d', label: 'Last 30 days' }, { value: '12w', label: 'Last 12 weeks' },
  { value: '26w', label: 'Last 26 weeks' }, { value: '52w', label: 'Last 52 weeks' },
];

async function load() {
  loading.value = true;
  failure.value = '';
  failureKind.value = 'error';
  try {
    overview.value = await stockApi.overview({ period: period.value });
  } catch (cause) {
    const denied = cause instanceof FrappeApiError && (cause.status === 401 || cause.status === 403);
    failureKind.value = denied ? 'permission' : 'error';
    failure.value = denied ? 'Your session may have expired, or your ERPNext role cannot read stock data. Sign in again or ask an administrator for access.' : frappeErrorMessage(cause, 'The stock overview could not be loaded.');
  } finally {
    loading.value = false;
  }
}
/** A new period only changes the trend; the other cards keep their figures. */
async function changePeriod() {
  if (!overview.value) return load();
  trendLoading.value = true;
  try {
    const next = await stockApi.overview({ period: period.value });
    overview.value = { ...overview.value, trend: next.trend, period: next.period };
  } catch (cause) {
    overview.value = { ...overview.value, trend: { data: null, error: cause instanceof FrappeApiError && cause.status === 403 ? 'permission' : 'failed' } };
  } finally {
    trendLoading.value = false;
  }
}
onMounted(load);

const currency = computed(() => overview.value?.currency);
const money = (value: number) => compactCurrency(value, currency.value);
const fullMoney = (value: number) => formatCurrency(value, currency.value, 0);
const qty = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const reportRoute = (report: string) => `/report/${encodeURIComponent(report)}`;
const errorKind = (section?: Section<unknown>) => (section?.error === 'permission' ? 'permission' : 'error');
const errorMessage = (section?: Section<unknown>) => (section?.error === 'permission' ? 'Your ERPNext role does not allow reading this stock data.' : 'ERPNext could not compute this section.');

// ---------- KPIs ----------
const trendPoints = computed(() => overview.value?.trend.data?.points ?? []);
/** Change against 30 days ago: a percentage when there was a base, otherwise the absolute change. */
function compare(figure: Compared | null | undefined, format: (value: number) => string): Pick<Metric, 'delta' | 'trend'> {
  if (!figure) return {};
  const change = figure.value - figure.value_30d_ago;
  const trend = Math.abs(change) < 1e-9 ? 'flat' : change > 0 ? 'up' : 'down';
  if (!figure.value_30d_ago) return change ? { delta: `${change > 0 ? '+' : '−'}${format(Math.abs(change))}`, trend } : { delta: 'No change', trend: 'flat' };
  const percent = (change / Math.abs(figure.value_30d_ago)) * 100;
  return { delta: `${Math.abs(percent) < 0.05 ? '0' : Math.abs(percent).toFixed(1)}%`, trend: Math.abs(percent) < 0.05 ? 'flat' : trend };
}
const metrics = computed<Metric[]>(() => {
  const data = overview.value;
  const busy = loading.value && !data;
  const value = data?.stock_value;
  const items = data?.stock_items;
  const pending = data?.pending_entries;
  const low = data?.low_stock;
  const lowCount = low?.data?.items.length ?? 0;
  const spark = trendPoints.value.slice(-12).map((point) => point.value);
  const unavailable = (section?: Section<unknown>) => (section?.error === 'permission' ? 'not available to you' : 'could not be loaded');
  return [
    {
      label: 'Total stock value', icon: Coins, tone: 'cyan', loading: busy, to: reportRoute('Stock Balance'),
      value: value?.data ? fullMoney(value.data.value) : '—',
      ...(value?.data ? compare(value.data, money) : {}),
      hint: value?.error ? unavailable(value) : 'vs 30 days ago',
      spark: spark.length > 1 ? spark : undefined, sparkColor: '--chart-1',
    },
    {
      label: 'Stock items', icon: Boxes, tone: 'blue', loading: busy, to: getDocumentRouteForDocType('Item'),
      value: items?.data ? items.data.value.toLocaleString() : '—',
      ...(items?.data ? compare(items.data, (number) => number.toLocaleString()) : {}),
      hint: items?.error ? unavailable(items) : 'vs 30 days ago',
    },
    {
      label: 'Low-stock items', icon: AlertTriangle, tone: lowCount ? 'rose' : 'green', loading: busy, to: reportRoute('Stock Projected Qty'),
      value: low?.data ? String(lowCount) : '—',
      hint: low?.error ? unavailable(low) : low?.data ? `at or below reorder level (${low.data.configured} set)` : undefined,
      emptyHint: low?.data && !low.data.configured ? 'No reorder levels set on items yet' : undefined,
    },
    {
      label: 'Pending stock entries', icon: FilePen, tone: 'amber', loading: busy, to: getDocumentRouteForDocType('Stock Entry'),
      value: pending?.data != null ? String(pending.data) : '—',
      hint: pending?.error ? unavailable(pending) : 'drafts awaiting submission',
    },
  ];
});

// ---------- Trend ----------
const trendLabels = computed(() => trendPoints.value.map((point) => new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })));
const trendSeries = computed(() => [{ name: 'Stock value', data: trendPoints.value.map((point) => point.value), color: '--chart-1' }]);
const hasTrend = computed(() => trendPoints.value.some((point) => point.value));
const trendChange = computed(() => {
  const points = trendPoints.value;
  return points.length < 2 ? null : points[points.length - 1].value - points[0].value;
});
const periodLabel = computed(() => periods.find((option) => option.value === period.value)?.label.toLowerCase() ?? '');

// ---------- Top items ----------
const topRows = computed<ValueRow[]>(() => (overview.value?.top_items.data ?? []).slice(0, 5).map((item) => ({
  key: item.item_code, label: item.item_name, group: item.item_group ?? undefined, value: fullMoney(item.value), amount: qty(item.qty),
  to: { name: 'document-detail', params: { doctype: 'Item', name: item.item_code } },
})));

// ---------- Alerts ----------
const alertRows = computed<AlertRow[]>(() => (overview.value?.low_stock.data?.items ?? []).slice(0, 5).map((alert) => ({
  key: `${alert.item_code}-${alert.warehouse}`, icon: AlertTriangle, tone: alert.replenishing ? '--warning' : '--danger', title: alert.item_name,
  detail: `${alert.status === 'out' ? 'Out of stock' : `Only ${qty(alert.actual_qty)} left`} · level ${qty(alert.reorder_level)} · ${alert.warehouse}`,
  badge: { tone: alert.replenishing ? 'amber' : 'rose', label: alert.replenishing ? 'On order' : alert.status === 'out' ? 'Out of stock' : 'Low stock', title: alert.replenishing ? `${qty(alert.projected_qty)} projected after open requests and orders` : 'No open request or order covers it' },
  to: { name: 'document-detail', params: { doctype: 'Item', name: alert.item_code } },
})));

// ---------- Activity ----------
function activityIcon(entry: StockActivity): LucideIcon {
  if (entry.voucher_type === 'Stock Reconciliation') return ClipboardCheck;
  if (entry.voucher_type === 'Delivery Note') return Truck;
  if (entry.qty_in && entry.qty_out) return ArrowLeftRight;
  return entry.qty_in ? PackagePlus : PackageMinus;
}
function activityTone(entry: StockActivity) {
  if (entry.voucher_type === 'Stock Reconciliation') return '--chart-6';
  if (entry.qty_in && entry.qty_out) return '--chart-3';
  return entry.qty_in ? '--success' : '--danger';
}
function activityText(entry: StockActivity) {
  const what = `${entry.first_item ?? 'items'}${entry.item_count > 1 ? ` +${entry.item_count - 1} more` : ''}`;
  if (entry.voucher_type === 'Stock Reconciliation') return `Updated inventory count · ${what}`;
  if (entry.qty_in && entry.qty_out) return `Moved ${qty(entry.qty_in)} units of ${what}${entry.to_warehouses.length ? ` to ${entry.to_warehouses.join(', ')}` : ''}`;
  if (entry.qty_in) return `${entry.voucher_type === 'Purchase Receipt' ? 'Received' : 'Added'} ${qty(entry.qty_in)} units of ${what}${entry.voucher_type === 'Purchase Receipt' && entry.party ? ` from ${entry.party}` : ''}`;
  return `${entry.voucher_type === 'Delivery Note' ? 'Delivered' : 'Issued'} ${qty(entry.qty_out)} units of ${what}${entry.voucher_type === 'Delivery Note' && entry.party ? ` to ${entry.party}` : ''}`;
}
const activityRows = computed<ActivityRow[]>(() => (overview.value?.activity.data ?? []).slice(0, 6).map((entry) => ({
  key: `${entry.voucher_type}-${entry.voucher_no}`, icon: activityIcon(entry), tone: activityTone(entry),
  title: entry.voucher_no, subtitle: `${entry.voucher_type} · ${activityText(entry)}`,
  time: relativeTime(entry.posted_at) || formatDate(entry.posting_date), timeTitle: formatDate(entry.posted_at, true),
  to: { name: 'document-detail', params: { doctype: entry.voucher_type, name: entry.voucher_no } },
})));

// ---------- Actions (only what the user may create) ----------
const canCreate = ref<Record<string, boolean>>({});
onMounted(async () => {
  const doctypes = ['Stock Entry', 'Stock Reconciliation'];
  const results = await Promise.all(doctypes.map((doctype) => hasDocTypePermission(doctype, 'create').catch(() => false)));
  canCreate.value = Object.fromEntries(doctypes.map((doctype, index) => [doctype, results[index]]));
});
const quickActions = computed(() => [
  ...(canCreate.value['Stock Entry'] ? [{ label: 'New Stock Entry', icon: Plus, to: { name: 'document-create', params: { doctype: 'Stock Entry' } } }] : []),
  { label: 'View Items', icon: Boxes, to: getDocumentRouteForDocType('Item') },
  ...(canCreate.value['Stock Reconciliation'] ? [{ label: 'Stock Reconciliation', icon: ClipboardCheck, to: { name: 'document-create', params: { doctype: 'Stock Reconciliation' } } }] : []),
  { label: 'Stock Balance report', icon: FileSpreadsheet, to: reportRoute('Stock Balance') },
]);
</script>

<template>
  <div class="dashboard">
    <DashboardHeader>
      <template #subtitle>Here's what's happening with your stock and inventory<template v-if="overview"> · {{ overview.company }} · as of {{ formatDate(overview.as_of) }}</template>.</template>
      <button type="button" class="tool-button tool-button--icon" :disabled="loading" aria-label="Refresh" title="Refresh" @click="load"><RefreshCw :size="15" :class="{ spin: loading }" /></button>
      <BaseButton v-if="reportsRoute" variant="quiet" size="md" @click="router.push(reportsRoute)"><FileSpreadsheet :size="15" />Reports</BaseButton>
      <BaseButton v-if="canCreate['Stock Entry']" variant="primary" size="md" @click="router.push({ name: 'document-create', params: { doctype: 'Stock Entry' } })"><Plus :size="15" />New Stock Entry</BaseButton>
    </DashboardHeader>

    <PanelCard v-if="failure && !overview"><ErrorState :kind="failureKind" :title="failureKind === 'permission' ? 'Stock figures are not available to you' : 'Stock figures could not be loaded'" :message="failure" @retry="load" /></PanelCard>

    <template v-else>
      <section class="dash-kpis" aria-label="Stock key figures">
        <MetricCard v-for="(metric, index) in metrics" :key="metric.label" :metric="metric" :class="['stagger-in', `delay-${index + 1}`]" />
      </section>

      <section class="dash-main">
        <PanelCard title="Stock Value Trend" :eyebrow="`Value on hand at each ${overview?.trend.data?.bucket === 'day' ? 'day' : 'week'}'s end · ${periodLabel}`">
          <template #actions>
            <span class="legend-dot" aria-hidden="true"><i style="background: var(--chart-1)" />Total value</span>
            <select v-model="period" class="control period-select" aria-label="Trend period" :disabled="loading || trendLoading" @change="changePeriod">
              <option v-for="option in periods" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </template>
          <span v-if="(loading && !overview) || trendLoading" class="skeleton" style="height: 290px; border-radius: 10px" />
          <ErrorState v-else-if="overview?.trend.error" :kind="errorKind(overview.trend)" :message="errorMessage(overview.trend)" @retry="changePeriod" />
          <template v-else-if="hasTrend">
            <div class="trend-summary">
              <div class="summary-stat"><span>Current value</span><strong>{{ fullMoney(trendPoints[trendPoints.length - 1].value) }}</strong></div>
              <div v-if="trendChange !== null" class="summary-stat">
                <span>Change over period</span>
                <strong :class="trendChange > 0 ? 'change--up' : trendChange < 0 ? 'change--down' : ''">{{ trendChange > 0 ? '+' : trendChange < 0 ? '−' : '' }}{{ money(Math.abs(trendChange)) }}</strong>
              </div>
            </div>
            <TrendChart :labels="trendLabels" :series="trendSeries" type="line" :height="240" :format-value="money" hide-legend />
          </template>
          <ChartPlaceholder v-else kind="line" :height="290" :icon="TrendingUp" title="No stock value in this period" description="Submitted receipts, deliveries and stock entries will chart here." />
        </PanelCard>

        <PanelCard title="Recent Stock Activity" eyebrow="Latest submitted movements">
          <template #actions><RouterLink :to="reportRoute('Stock Ledger')" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
          <div v-if="loading && !overview" class="dash-list-skeleton"><span v-for="index in 5" :key="index" class="skeleton" style="height: 46px; border-radius: 10px" /></div>
          <ErrorState v-else-if="overview?.activity.error" :kind="errorKind(overview.activity)" :message="errorMessage(overview.activity)" @retry="load" />
          <ActivityFeed v-else-if="activityRows.length" :rows="activityRows" />
          <ChartPlaceholder v-else kind="rows" :height="260" :icon="Boxes" title="No stock movements yet" description="Submitted receipts, deliveries and stock entries will appear here." />
        </PanelCard>
      </section>

      <section class="dash-three">
        <PanelCard title="Top Items by Value" no-padding>
          <template #actions><RouterLink :to="reportRoute('Stock Balance')" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
          <div v-if="loading && !overview" class="dash-list-skeleton dash-pad"><span v-for="index in 5" :key="index" class="skeleton" style="height: 36px; border-radius: 8px" /></div>
          <div v-else-if="overview?.top_items.error" class="dash-pad"><ErrorState :kind="errorKind(overview.top_items)" :message="errorMessage(overview.top_items)" @retry="load" /></div>
          <ValueTable v-else-if="topRows.length" :rows="topRows" label-header="Item" group-header="Item Group" value-header="Stock Value" amount-header="Qty" />
          <div v-else class="dash-pad"><ChartPlaceholder kind="rows" :height="240" :icon="Trophy" title="No stock on hand" description="Items will rank here once stock is received." /></div>
        </PanelCard>

        <PanelCard title="Stock Alerts">
          <template #actions><RouterLink :to="reportRoute('Stock Projected Qty')" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
          <div v-if="loading && !overview" class="dash-list-skeleton"><span v-for="index in 4" :key="index" class="skeleton" style="height: 46px; border-radius: 10px" /></div>
          <ErrorState v-else-if="overview?.low_stock.error" :kind="errorKind(overview.low_stock)" :message="errorMessage(overview.low_stock)" @retry="load" />
          <AlertList v-else-if="alertRows.length" :rows="alertRows" />
          <ChartPlaceholder v-else-if="overview?.low_stock.data && !overview.low_stock.data.configured" kind="rows" :height="240" :icon="AlertTriangle" title="No reorder levels set" description="Add reorder levels on items (Item › Auto Re-order) to get low-stock alerts." />
          <p v-else class="all-clear">Every item with a reorder level is above it.</p>
        </PanelCard>

        <PanelCard title="Quick Actions"><QuickActions :actions="quickActions" /></PanelCard>
      </section>
    </template>
  </div>
</template>

<style scoped>
.period-select { width: auto; height: 32px; padding-left: 10px; font-size: 12.5px; }
.trend-summary { display: flex; flex-wrap: wrap; gap: 10px 32px; margin-bottom: 10px; }
.all-clear { color: var(--muted-foreground); font-size: 13px; }
</style>
