<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowRight, BarChart3, Trophy, Boxes, CheckCircle2, FilePen, HandCoins, HeartHandshake, PiggyBank, CircleDollarSign, ClipboardList, Clock3, Headphones, PackageCheck, Plus, ReceiptText, RefreshCw, ShoppingBag, ShoppingCart, Truck, UsersRound } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import MetricCard, { type Metric } from '@/components/data-display/MetricCard.vue';
import PanelCard from '@/components/ui/PanelCard.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import TrendChart from '@/components/charts/TrendChart.vue';
import DonutGauge from '@/components/charts/DonutGauge.vue';
import SegmentedBar from '@/components/charts/SegmentedBar.vue';
import RankBars, { type RankRow } from '@/components/charts/RankBars.vue';
import ChartPlaceholder from '@/components/charts/ChartPlaceholder.vue';
import DonutChart from '@/components/charts/DonutChart.vue';
import DashboardHeader from '@/components/dashboards/DashboardHeader.vue';
import ActivityFeed, { type ActivityRow } from '@/components/dashboards/ActivityFeed.vue';
import ValueTable, { type ValueRow } from '@/components/dashboards/ValueTable.vue';
import AlertList, { type AlertRow } from '@/components/dashboards/AlertList.vue';
import QuickActions, { type QuickAction } from '@/components/dashboards/QuickActions.vue';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import { useNavigation } from '@/composables/useNavigation';
import { ngoOverview, lakh } from '@/ngo/overview';
import { ORG } from '@/ngo/data';
import { documentApi } from '@/services/document-api';
import { getDocumentRouteForDocType } from '@/config/navigation';
import { getModuleForPath } from '@/app/module-registry';
import { documentStatus } from '@/lib/display';
import type { StatusTone } from '@/types/erp';
import { formatCurrency, relativeTime, today } from '@/lib/doctype';
import type { ChartSegment, FrappeDocument } from '@/types/erp';

/*
 * Every number on this page comes from ERPNext. A widget whose DocType the user
 * cannot read is left out rather than shown with made-up values.
 */
const { firstName } = useCurrentUser();
const { defaults, ready: defaultsReady } = useSessionDefaults();
const currency = computed(() => (defaults.value.currency as string) || undefined);
const money = (value: number) => formatCurrency(value, currency.value, 0);
const compactMoney = (value: number) => {
  const abs = Math.abs(value);
  const symbol = currency.value ? formatCurrency(0, currency.value, 0).replace(/[\d\s.,]/g, '') : '';
  if (abs >= 1e7 && currency.value === 'INR') return `${symbol}${(value / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5 && currency.value === 'INR') return `${symbol}${(value / 1e5).toFixed(1)}L`;
  if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(1)}k`;
  return `${symbol}${Math.round(value)}`;
};

const loading = ref(true);
const invoices = ref<FrappeDocument[] | null>(null);
const purchases = ref<FrappeDocument[] | null>(null);
const receivables = ref<FrappeDocument[] | null>(null);
const counts = ref<Record<string, number | null>>({});
const recent = ref<FrappeDocument[]>([]);

const DAYS = 30;
function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function safe<T>(task: Promise<T>): Promise<T | null> {
  try { return await task; } catch { return null; }
}

async function load() {
  loading.value = true;
  await defaultsReady;
  const since = isoDaysAgo(DAYS * 2 - 1);
  const countOf = (doctype: string, filters: unknown[][]) => safe(documentApi.count(doctype, filters));

  const [sales, buys, outstanding, openOrders, toReceive, overdue, lateDeliveries, pendingRequests, openIssues, items, customers] = await Promise.all([
    safe(documentApi.list<FrappeDocument>('Sales Invoice', { fields: ['name', 'posting_date', 'base_grand_total', 'customer', 'customer_name'], filters: [['docstatus', '=', 1], ['posting_date', '>=', since]], limit: 2000 })),
    safe(documentApi.list<FrappeDocument>('Purchase Invoice', { fields: ['name', 'posting_date', 'base_grand_total'], filters: [['docstatus', '=', 1], ['posting_date', '>=', since]], limit: 2000 })),
    safe(documentApi.list<FrappeDocument>('Sales Invoice', { fields: ['name', 'due_date', 'outstanding_amount', 'base_grand_total'], filters: [['docstatus', '=', 1], ['outstanding_amount', '>', 0]], limit: 2000 })),
    countOf('Sales Order', [['docstatus', '=', 1], ['status', 'in', ['To Deliver and Bill', 'To Bill', 'To Deliver']]]),
    countOf('Purchase Order', [['docstatus', '=', 1], ['status', 'in', ['To Receive and Bill', 'To Receive', 'To Bill']]]),
    countOf('Sales Invoice', [['docstatus', '=', 1], ['status', '=', 'Overdue']]),
    countOf('Sales Order', [['docstatus', '=', 1], ['status', 'in', ['To Deliver and Bill', 'To Deliver']], ['delivery_date', '<', today()]]),
    countOf('Material Request', [['docstatus', '=', 1], ['status', 'in', ['Pending', 'Partially Ordered']]]),
    countOf('Issue', [['status', '=', 'Open']]),
    countOf('Item', [['disabled', '=', 0]]),
    countOf('Customer', [['disabled', '=', 0]]),
  ]);
  invoices.value = sales;
  purchases.value = buys;
  receivables.value = outstanding;
  counts.value = { openOrders, toReceive, overdue, lateDeliveries, pendingRequests, openIssues, items, customers };

  // Latest changes across the main transaction DocTypes the user can read.
  const sources: { doctype: string; fields: string[] }[] = [
    { doctype: 'Sales Order', fields: ['customer_name', 'base_grand_total', 'status'] },
    { doctype: 'Sales Invoice', fields: ['customer_name', 'base_grand_total', 'status'] },
    { doctype: 'Purchase Order', fields: ['supplier_name', 'base_grand_total', 'status'] },
    { doctype: 'Purchase Invoice', fields: ['supplier_name', 'base_grand_total', 'status'] },
    { doctype: 'Payment Entry', fields: ['party_name', 'base_paid_amount', 'status'] },
    { doctype: 'Quotation', fields: ['customer_name', 'base_grand_total', 'status'] },
  ];
  const batches = await Promise.all(sources.map(async (source) => {
    const rows = await safe(documentApi.list<FrappeDocument>(source.doctype, { fields: ['name', 'modified', 'docstatus', ...source.fields], orderBy: 'modified desc', limit: 5 }));
    return (rows ?? []).map((row): FrappeDocument => ({ ...row, __doctype: source.doctype }));
  }));
  recent.value = batches.flat().sort((a, b) => String(b.modified).localeCompare(String(a.modified))).slice(0, 7);
  loading.value = false;
}
onMounted(load);

// ---------- Derived figures ----------
const sum = (rows: FrappeDocument[] | null, field: string) => (rows ?? []).reduce((total, row) => total + (Number(row[field]) || 0), 0);
const cutoff = computed(() => isoDaysAgo(DAYS - 1));
const salesNow = computed(() => sum((invoices.value ?? []).filter((row) => String(row.posting_date) >= cutoff.value), 'base_grand_total'));
const salesBefore = computed(() => sum((invoices.value ?? []).filter((row) => String(row.posting_date) < cutoff.value), 'base_grand_total'));
const outstandingTotal = computed(() => sum(receivables.value, 'outstanding_amount'));

function change(now: number, before: number): Pick<Metric, 'delta' | 'trend'> {
  if (!before) return now ? { delta: 'New this period', trend: 'up' } : {};
  const percent = ((now - before) / before) * 100;
  return { delta: `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`, trend: Math.abs(percent) < 0.5 ? 'flat' : percent > 0 ? 'up' : 'down' };
}

const metrics = computed<Metric[]>(() => {
  const list: Metric[] = [];
  if (invoices.value !== null || loading.value) list.push({ label: `Sales · last ${DAYS} days`, value: money(salesNow.value), ...change(salesNow.value, salesBefore.value), hint: 'vs previous period', tone: 'violet', icon: CircleDollarSign, to: getDocumentRouteForDocType('Sales Invoice'), loading: loading.value, emptyHint: salesNow.value ? undefined : 'Submit a sales invoice to start tracking', spark: invoices.value ? daily(invoices.value) : undefined });
  if (receivables.value !== null || loading.value) list.push({ label: 'Receivables outstanding', value: money(outstandingTotal.value), hint: counts.value.overdue ? `${counts.value.overdue} overdue` : `${receivables.value?.length ?? 0} invoices`, tone: counts.value.overdue ? 'rose' : 'cyan', icon: Clock3, to: '/accounts/accounts-receivable', loading: loading.value, emptyHint: outstandingTotal.value ? undefined : 'Nothing owed to you right now' });
  if (counts.value.openOrders !== null || loading.value) list.push({ label: 'Sales orders to fulfil', value: String(counts.value.openOrders ?? 0), hint: counts.value.lateDeliveries ? `${counts.value.lateDeliveries} past delivery date` : 'none late', tone: 'green', icon: ShoppingCart, to: getDocumentRouteForDocType('Sales Order'), loading: loading.value, emptyHint: counts.value.openOrders ? undefined : 'Create a sales order to fulfil' });
  if (counts.value.toReceive !== null || loading.value) list.push({ label: 'Purchase orders open', value: String(counts.value.toReceive ?? 0), hint: 'to receive or bill', tone: 'blue', icon: ShoppingBag, to: getDocumentRouteForDocType('Purchase Order'), loading: loading.value, emptyHint: counts.value.toReceive ? undefined : 'Raise a purchase order when you buy' });
  return list;
});

// Daily series for the last 30 days.
const chartLabels = computed(() => Array.from({ length: DAYS }, (_, index) => {
  const date = new Date(isoDaysAgo(DAYS - 1 - index));
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}));
function daily(rows: FrappeDocument[] | null) {
  const buckets = new Map<string, number>();
  for (const row of rows ?? []) buckets.set(String(row.posting_date), (buckets.get(String(row.posting_date)) ?? 0) + (Number(row.base_grand_total) || 0));
  return Array.from({ length: DAYS }, (_, index) => Math.round(buckets.get(isoDaysAgo(DAYS - 1 - index)) ?? 0));
}
const chartSeries = computed(() => [
  ...(invoices.value ? [{ name: 'Sales invoiced', data: daily(invoices.value), color: '--chart-1' }] : []),
  ...(purchases.value ? [{ name: 'Purchases billed', data: daily(purchases.value), color: '--chart-2' }] : []),
]);
// A line needs at least two days with figures; fewer shows the compact empty state instead.
const hasChartData = computed(() => chartLabels.value.filter((_, day) => chartSeries.value.some((series) => series.data[day])).length >= 2);
const netNow = computed(() => salesNow.value - purchasesNow.value);
const purchasesNow = computed(() => sum((purchases.value ?? []).filter((row) => String(row.posting_date) >= cutoff.value), 'base_grand_total'));

// Collection rate: share of the last 30 days' invoicing already paid.
const recentInvoiceNames = computed(() => new Set((invoices.value ?? []).filter((row) => String(row.posting_date) >= cutoff.value).map((row) => row.name)));
const unpaidRecent = computed(() => sum((receivables.value ?? []).filter((row) => recentInvoiceNames.value.has(row.name)), 'outstanding_amount'));
const collectionRate = computed(() => (salesNow.value ? Math.max(0, Math.round(((salesNow.value - unpaidRecent.value) / salesNow.value) * 1000) / 10) : 0));

const ageing = computed<ChartSegment[]>(() => {
  const buckets = [
    // Ordered by how late: a severity ramp, so "worse" always reads warmer.
    { label: 'Not yet due', value: 0, color: '--severity-0' },
    { label: '1–30 days', value: 0, color: '--severity-1' },
    { label: '31–60 days', value: 0, color: '--severity-2' },
    { label: 'Over 60 days', value: 0, color: '--severity-3' },
  ];
  const now = Date.now();
  for (const row of receivables.value ?? []) {
    const days = Math.floor((now - new Date(`${row.due_date}T00:00:00`).getTime()) / 86_400_000);
    const bucket = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3;
    buckets[bucket].value += Number(row.outstanding_amount) || 0;
  }
  return buckets.filter((bucket) => bucket.value > 0).map((bucket) => ({ ...bucket, display: compactMoney(bucket.value) }));
});

// Top customers by invoiced value over the last 30 days (from the invoices already loaded).
const topCustomers = computed<RankRow[]>(() => {
  const totals = new Map<string, { label: string; value: number; count: number }>();
  for (const row of invoices.value ?? []) {
    if (String(row.posting_date) < cutoff.value || !row.customer) continue;
    const key = String(row.customer);
    const entry = totals.get(key) ?? { label: String(row.customer_name || key), value: 0, count: 0 };
    entry.value += Number(row.base_grand_total) || 0;
    entry.count += 1;
    totals.set(key, entry);
  }
  return [...totals.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 5).map(([key, entry]) => ({
    key, label: entry.label, value: entry.value, display: compactMoney(entry.value), sub: `${entry.count} ${entry.count === 1 ? 'invoice' : 'invoices'}`,
    to: { name: 'document-detail', params: { doctype: 'Customer', name: key } },
  }));
});

interface Attention { key: string; title: string; detail: string; tone: 'rose' | 'amber' | 'blue' | 'slate'; icon: typeof Clock3; to: string | { name: string; params: Record<string, string> } }
const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;
const attention = computed<Attention[]>(() => {
  const queues: (Attention & { count: number })[] = [
    { key: 'overdue', count: counts.value.overdue ?? 0, title: plural(counts.value.overdue ?? 0, 'overdue sales invoice', 'overdue sales invoices'), detail: 'Accounts · follow up on collection', tone: 'rose', icon: Clock3, to: getDocumentRouteForDocType('Sales Invoice') },
    { key: 'late', count: counts.value.lateDeliveries ?? 0, title: plural(counts.value.lateDeliveries ?? 0, 'sales order past delivery date', 'sales orders past delivery date'), detail: 'Selling · deliveries are late', tone: 'amber', icon: Truck, to: getDocumentRouteForDocType('Sales Order') },
    { key: 'requests', count: counts.value.pendingRequests ?? 0, title: plural(counts.value.pendingRequests ?? 0, 'material request pending', 'material requests pending'), detail: 'Buying · waiting to be ordered', tone: 'amber', icon: ClipboardList, to: getDocumentRouteForDocType('Material Request') },
    { key: 'issues', count: counts.value.openIssues ?? 0, title: plural(counts.value.openIssues ?? 0, 'open support issue', 'open support issues'), detail: 'Support · awaiting a response', tone: 'blue', icon: Headphones, to: getDocumentRouteForDocType('Issue') },
  ];
  // Drafts among the recent changes this page already loaded: started but not submitted.
  const drafts: Attention[] = recent.value.filter((row) => Number(row.docstatus) === 0).slice(0, 3).map((row) => ({
    key: `draft-${row.__doctype}-${row.name}`, title: `${row.__doctype} ${row.name} is still a draft`,
    detail: `${String(row.customer_name || row.supplier_name || row.party_name || 'No party')} · edited ${relativeTime(row.modified)}`,
    tone: 'slate', icon: FilePen, to: { name: 'document-detail', params: { doctype: String(row.__doctype), name: row.name } },
  }));
  return [...queues.filter((entry) => entry.count > 0), ...drafts];
});

// NGO figures come from the NGO modules' own (demo) dataset; shown only when those modules are installed.
const { modules } = useNavigation();
const ngoModule = computed(() => modules.value.find((module) => module.key === 'ngo-projects'));
const ngoIcons = [PiggyBank, HandCoins, CircleDollarSign, HeartHandshake];
const ngoMetrics = computed<Metric[]>(() => {
  if (!ngoModule.value) return [];
  return (ngoOverview('ngo-projects')?.kpis ?? []).map((kpi, index) => ({ label: kpi.label, value: kpi.value, hint: kpi.hint, tone: kpi.tone, icon: ngoIcons[index % ngoIcons.length], to: ngoModule.value!.route, spark: kpi.spark, lead: kpi.lead }));
});
// Two headline NGO charts for the Overview, taken from the NGO Projects overview.
const ngoPanels = computed(() => {
  const panels = ngoModule.value ? ngoOverview('ngo-projects')?.panels ?? [] : [];
  return { trend: panels.find((panel) => panel.kind === 'trend'), heads: panels.find((panel) => panel.kind === 'donut' && panel.title === 'Spend by budget head') };
});

const recentRows = computed(() => recent.value.map((row) => {
  const doctype = String(row.__doctype);
  const module = getModuleForPath(getDocumentRouteForDocType(doctype), doctype);
  const amount = Number(row.base_grand_total ?? row.base_paid_amount ?? 0);
  return {
    key: `${doctype}-${row.name}`, doctype, name: row.name, party: String(row.customer_name || row.supplier_name || row.party_name || ''),
    amount: amount ? money(amount) : '', status: documentStatus(row, { submittable: true }), when: relativeTime(row.modified), color: module?.color || '--primary', icon: module?.icon || ReceiptText,
  };
}));

const shortcuts = [
  { label: 'New Sales Order', detail: 'Selling', doctype: 'Sales Order', icon: ShoppingCart, color: '--mod-selling' },
  { label: 'New Sales Invoice', detail: 'Accounts', doctype: 'Sales Invoice', icon: ReceiptText, color: '--mod-accounts' },
  { label: 'New Purchase Order', detail: 'Buying', doctype: 'Purchase Order', icon: ShoppingBag, color: '--mod-buying' },
  { label: 'New Item', detail: 'Stock', doctype: 'Item', icon: Boxes, color: '--mod-stock' },
  { label: 'New Customer', detail: 'CRM', doctype: 'Customer', icon: UsersRound, color: '--mod-crm' },
  { label: 'New Stock Entry', detail: 'Stock', doctype: 'Stock Entry', icon: PackageCheck, color: '--mod-manufacturing' },
];

// ---------- Reference-layout rows ----------
const statusToken: Record<StatusTone, string> = { green: '--success', rose: '--danger', amber: '--warning', blue: '--info', cyan: '--accent', violet: '--primary', slate: '--chart-neutral' };
const activityRows = computed<ActivityRow[]>(() => recentRows.value.map((row) => ({
  key: row.key, icon: row.icon, tone: row.status ? statusToken[row.status.tone] : row.color,
  title: row.doctype, titleMeta: row.name,
  subtitle: [row.party || '—', row.amount, row.status?.label].filter(Boolean).join(' · '),
  time: row.when, to: { name: 'document-detail', params: { doctype: row.doctype, name: row.name } },
})));
const customerRows = computed<ValueRow[]>(() => topCustomers.value.map((row) => ({
  key: row.key, label: row.label, value: row.display, amount: row.sub?.split(' ')[0], to: row.to as ValueRow['to'],
})));
const attentionTone = { rose: '--danger', amber: '--warning', blue: '--info', slate: '--chart-neutral' } as const;
const attentionRows = computed<AlertRow[]>(() => attention.value.map((entry) => ({
  key: entry.key, icon: entry.icon, tone: attentionTone[entry.tone], title: entry.title, detail: entry.detail,
  badge: { label: entry.tone === 'rose' ? 'Overdue' : entry.tone === 'amber' ? 'Pending' : entry.tone === 'blue' ? 'Open' : 'Draft', tone: entry.tone },
  to: entry.to,
})));
const quickActions = computed<QuickAction[]>(() => shortcuts.slice(0, 5).map((shortcut) => ({ label: shortcut.label, icon: shortcut.icon, to: { name: 'document-create', params: { doctype: shortcut.doctype } } })));

const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const greeting = computed(() => {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return firstName.value ? `${part}, ${firstName.value}` : part;
});
</script>

<template>
  <div class="page">
    <div class="dashboard">
      <DashboardHeader>
        <template #subtitle>Here's what's happening across your business · {{ todayLabel }}<template v-if="counts.items != null"> · {{ counts.items.toLocaleString() }} active items</template><template v-if="counts.customers != null"> · {{ counts.customers.toLocaleString() }} customers</template></template>
        <button type="button" class="tool-button tool-button--icon" :disabled="loading" aria-label="Refresh" title="Refresh" @click="load"><RefreshCw :size="15" :class="{ spin: loading }" /></button>
        <BaseButton variant="primary" size="md" @click="$router.push({ name: 'document-create', params: { doctype: 'Sales Invoice' } })"><Plus :size="15" />New Sales Invoice</BaseButton>
      </DashboardHeader>

      <section v-if="metrics.length" class="dash-kpis">
        <MetricCard v-for="(metric, index) in metrics" :key="metric.label" :metric="metric" :class="['stagger-in', `delay-${index + 1}`]" />
      </section>

      <section class="dash-main">
        <PanelCard title="Sales & Purchases" :eyebrow="`Submitted invoices, last ${DAYS} days`">
          <template v-if="hasChartData" #actions><span v-for="series in chartSeries.filter((entry) => entry.data.some(Boolean))" :key="series.name" class="legend-dot"><i :style="{ background: `var(${series.color})` }" />{{ series.name }}</span></template>
          <template v-if="loading"><span class="skeleton" style="height: 300px; border-radius: 10px" /></template>
          <template v-else-if="hasChartData">
            <div class="chart-summary">
              <div v-for="series in chartSeries" :key="series.name" class="summary-stat">
                <span>{{ series.name }}</span>
                <strong>{{ money(series.name === 'Sales invoiced' ? salesNow : purchasesNow) }}</strong>
              </div>
              <div v-if="chartSeries.length > 1" class="summary-stat summary-stat--net">
                <span>Net</span>
                <strong :class="netNow >= 0 ? 'change--up' : 'change--down'">{{ netNow >= 0 ? '+' : '−' }}{{ money(Math.abs(netNow)) }}</strong>
              </div>
            </div>
            <TrendChart :labels="chartLabels" :series="chartSeries" type="line" :height="250" :format-value="compactMoney" hide-legend />
          </template>
          <ChartPlaceholder v-else kind="line" :height="300" title="No submitted invoices yet" :description="`Sales and purchase invoices from the last ${DAYS} days will chart here.`" :icon="BarChart3">
            <BaseButton variant="primary" size="sm" @click="$router.push({ name: 'document-create', params: { doctype: 'Sales Invoice' } })"><Plus :size="14" />New Sales Invoice</BaseButton>
          </ChartPlaceholder>
        </PanelCard>

        <PanelCard title="Recent Transactions" eyebrow="Selling, buying and accounts">
          <template #actions><RouterLink :to="getDocumentRouteForDocType('Sales Invoice')" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
          <div v-if="loading" class="dash-list-skeleton"><span v-for="index in 5" :key="index" class="skeleton" style="height: 46px; border-radius: 10px" /></div>
          <ActivityFeed v-else-if="activityRows.length" :rows="activityRows.slice(0, 6)" />
          <ChartPlaceholder v-else kind="rows" :height="260" :icon="ReceiptText" title="No transactions yet" description="Quotations, orders, invoices and payments will appear here as your team works." />
        </PanelCard>
      </section>

      <section class="dash-three">
        <PanelCard title="Top Customers" no-padding>
          <template #actions><RouterLink :to="getDocumentRouteForDocType('Customer')" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
          <div v-if="loading" class="dash-list-skeleton dash-pad"><span v-for="index in 5" :key="index" class="skeleton" style="height: 36px; border-radius: 8px" /></div>
          <ValueTable v-else-if="customerRows.length" :rows="customerRows" label-header="Customer" :value-header="`Invoiced · ${DAYS}d`" amount-header="Invoices" />
          <div v-else class="dash-pad"><ChartPlaceholder kind="rows" :height="240" title="No customer invoices yet" description="Your biggest customers this month will rank here." :icon="Trophy" /></div>
        </PanelCard>

        <PanelCard title="Needs Your Attention">
          <div v-if="loading" class="dash-list-skeleton"><span v-for="index in 4" :key="index" class="skeleton" style="height: 46px; border-radius: 10px" /></div>
          <AlertList v-else-if="attentionRows.length" :rows="attentionRows.slice(0, 5)" />
          <p v-else class="caught-up"><CheckCircle2 :size="16" />You're all caught up.</p>
        </PanelCard>

        <PanelCard title="Quick Actions"><QuickActions :actions="quickActions" /></PanelCard>
      </section>

      <section class="dash-two">
        <PanelCard title="Receivables by Age" eyebrow="Outstanding balance by days past due">
          <span v-if="loading" class="skeleton" style="height: 220px; border-radius: 10px" />
          <SegmentedBar v-else-if="ageing.length" :segments="ageing" :heading="`${money(outstandingTotal)} outstanding`" label="Outstanding receivables split by days past due" />
          <ChartPlaceholder v-else kind="bar" :height="220" title="Nothing outstanding" description="Every submitted sales invoice is fully paid." :icon="CheckCircle2" />
        </PanelCard>
        <PanelCard title="Collection Rate" :eyebrow="`Paid share of the last ${DAYS} days’ invoicing`">
          <span v-if="loading" class="skeleton" style="height: 220px; border-radius: 10px" />
          <div v-else-if="salesNow" class="gauge-body">
            <DonutGauge :value="collectionRate" label="collected" color="--chart-1" />
            <dl class="gauge-stats">
              <div><dt>Invoiced</dt><dd class="tabular">{{ compactMoney(salesNow) }}</dd></div>
              <div><dt>Still unpaid</dt><dd class="tabular">{{ compactMoney(unpaidRecent) }}</dd></div>
            </dl>
          </div>
          <ChartPlaceholder v-else kind="donut" :height="220" title="Nothing invoiced yet" description="The share of invoicing already paid shows here." :icon="CircleDollarSign" />
        </PanelCard>
      </section>

      <section v-if="ngoMetrics.length" class="ngo-strip" aria-labelledby="ngo-heading">
        <header class="strip-head"><h2 id="ngo-heading" class="section-title">NGO</h2><span class="demo-tag">Demo data</span><span>{{ ORG.fy }}</span></header>
        <div class="dash-kpis">
          <MetricCard v-for="metric in ngoMetrics" :key="metric.label" :metric="metric" />
        </div>
        <div class="dash-main">
          <PanelCard v-if="ngoPanels.trend && ngoPanels.trend.kind === 'trend'" :title="ngoPanels.trend.title" :eyebrow="ngoPanels.trend.note">
            <TrendChart :labels="ngoPanels.trend.labels" :series="ngoPanels.trend.series" type="line" :height="240" :format-value="lakh" />
          </PanelCard>
          <PanelCard v-if="ngoPanels.heads && ngoPanels.heads.kind === 'donut'" :title="ngoPanels.heads.title" :eyebrow="ngoPanels.heads.note">
            <DonutChart :segments="ngoPanels.heads.segments" :label="ngoPanels.heads.title" :center-label="ngoPanels.heads.centerLabel" :center-value="ngoPanels.heads.centerValue" :size="170" />
          </PanelCard>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.chart-summary { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 32px; margin-bottom: 10px; }
.summary-stat strong { font-size: 22px; }
.summary-stat--net { margin-left: auto; padding-left: 20px; border-left: 1px solid var(--border); }
.summary-stat--net strong { font-size: 18px; }
.caught-up { display: flex; align-items: center; gap: 8px; color: var(--muted-foreground); font-size: 13px; }
.caught-up svg { flex: none; color: var(--secondary); }
.gauge-body { display: flex; flex-direction: column; align-items: center; gap: 18px; padding-top: 4px; }
.gauge-stats { display: grid; grid-template-columns: 1fr 1fr; width: 100%; margin: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-tint); }
.gauge-stats div { padding: 10px 14px; }
.gauge-stats div + div { border-left: 1px solid var(--border); }
.gauge-stats dt { color: var(--muted-foreground); font-size: 12px; }
.gauge-stats dd { margin: 2px 0 0; color: var(--foreground); font-size: 17px; font-weight: 700; }
.ngo-strip { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; padding-top: 20px; border-top: 1px solid var(--border); }
.strip-head { display: flex; align-items: center; gap: 10px; }
.strip-head span { color: var(--subtle-foreground); font-size: 12px; }
.strip-head .demo-tag { padding: 1px 8px; color: var(--accent-soft-foreground); border-radius: 999px; background: var(--accent-soft); font-size: 11.5px; font-weight: 600; }
</style>
