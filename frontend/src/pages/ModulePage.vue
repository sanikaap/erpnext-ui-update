<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowRight, ArrowUpRight, BarChart3, CircleDot, Clock3, FileSpreadsheet, Layers3, List, Plus, TrendingUp } from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';
import { useRoute } from 'vue-router';
import { useNavigation } from '@/composables/useNavigation';
import { useModuleDashboard } from '@/composables/useModuleDashboard';
import { moduleDashboards } from '@/config/module-dashboards';
import { isStaticDocType } from '@/services/static-data';
import { hasDocTypePermission } from '@/services/metadata-api';
import EmptyState from '@/components/feedback/EmptyState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import TrendChart from '@/components/charts/TrendChart.vue';
import SegmentedBar from '@/components/charts/SegmentedBar.vue';
import BudgetBars from '@/components/charts/BudgetBars.vue';
import PanelCard from '@/components/ui/PanelCard.vue';
import MetricCard, { type Metric } from '@/components/data-display/MetricCard.vue';
import StockOverview from '@/components/dashboards/StockOverview.vue';
import DashboardHeader from '@/components/dashboards/DashboardHeader.vue';
import ActivityFeed, { type ActivityRow } from '@/components/dashboards/ActivityFeed.vue';
import ValueTable, { type ValueRow } from '@/components/dashboards/ValueTable.vue';
import AlertList, { type AlertRow } from '@/components/dashboards/AlertList.vue';
import QuickActions, { type QuickAction } from '@/components/dashboards/QuickActions.vue';
import ChartPlaceholder from '@/components/charts/ChartPlaceholder.vue';
import RankBars, { type RankRow } from '@/components/charts/RankBars.vue';
import DonutChart from '@/components/charts/DonutChart.vue';
import RadarChart from '@/components/charts/RadarChart.vue';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import { ngoOverview, lakh } from '@/ngo/overview';
import { compactCurrency, formatDate, relativeTime } from '@/lib/doctype';
import { getDocumentRouteForDocType } from '@/config/navigation';
import type { StatusTone } from '@/types/erp';

/**
 * Overview of any module (Level 2 → Overview). One layout for ERPNext and custom
 * modules: KPI strip, main chart, status mix, latest records and a browse panel.
 * ERPNext figures are live; NGO modules use the NGO Impact Console dataset.
 */
const route = useRoute();
const router = useRouter();
const { modules } = useNavigation();
const module = computed(() => modules.value.find((candidate) => candidate.key === String(route.meta.moduleKey)));
const ngo = computed(() => (module.value ? ngoOverview(module.value.key) : null));
const isStatic = computed(() => module.value?.items.some((item) => item.doctype && isStaticDocType(item.doctype)) ?? false);
const dashboard = useModuleDashboard(module);
/** Stock has its own overview, computed server-side from the Stock Ledger (StockOverview). */
const isStock = computed(() => module.value?.key === 'stock');

const primaryDoctype = computed(() => (module.value ? moduleDashboards[module.value.key]?.primary : undefined));
const canCreate = ref(false);
watch(primaryDoctype, async (doctype) => { canCreate.value = doctype ? await hasDocTypePermission(doctype, 'create') : false; }, { immediate: true });

const money = (value: number) => (value >= 100000 ? lakh(value) : `₹${Math.round(value / 1000)}k`);
const hasActivityAtAll = computed(() => dashboard.activitySeries.value.some((series) => series.data.some(Boolean)));
// A chart needs at least two weeks with activity; a lone bar reads as "empty" anyway.
const hasActivity = computed(() => dashboard.activityLabels.value.filter((_, week) => dashboard.activitySeries.value.some((series) => series.data[week])).length >= 2);

/** Browse cards, grouped exactly like the module's Level-2 sidebar (including "All reports"). */
const browseSections = computed(() => {
  if (!module.value) return [];
  const current = module.value;
  const sections = current.visibleSections.map((section) => ({ label: section.label, items: section.items.map((item) => ({ ...item, allReports: false })) }));
  if (current.reportModules.length) {
    const all = { label: 'All reports', path: current.reportsRoute, icon: FileSpreadsheet, description: `Every report in ${current.label}`, allReports: true } as (typeof sections)[number]['items'][number];
    const reports = sections.find((section) => section.label === 'Reports');
    if (reports) reports.items.push(all); else sections.push({ label: 'Reports', items: [all] });
  }
  return sections;
});
type BrowseItem = (typeof browseSections.value)[number]['items'][number];
function browseDescription(item: BrowseItem) {
  if (item.description) return item.description;
  if (item.report) return 'Report';
  if (item.path.startsWith('/record/')) return 'Settings';
  if (item.doctype && item.doctype !== item.label) return item.doctype;
  return item.doctype ? 'Records' : 'Page';
}
/** Weekly creation counts for a KPI's DocType, when the activity chart already loaded them. */
const kpiSpark = (doctype: string) => dashboard.weekly.value[doctype];

// ---------- Headline trend + ranking (every ERPNext module, from config) ----------
const { defaults } = useSessionDefaults();
const currency = computed(() => (defaults.value.currency as string) || undefined);
const dashConfig = computed(() => (module.value ? moduleDashboards[module.value.key] : undefined));
// A single-series headline trend wears the module's own accent color.
const trend = computed(() => {
  const result = dashboard.trend.value;
  if (!result || result.series.length !== 1 || !module.value) return result;
  return { ...result, series: [{ ...result.series[0], color: module.value.color }] };
});
const trendFormat = (value: number) => (trend.value?.money ? compactCurrency(value, currency.value) : value.toLocaleString(undefined, { maximumFractionDigits: 1 }));
// Two or more buckets with figures; fewer reads as "empty" anyway.
const trendHasData = computed(() => Boolean(trend.value && trend.value.labels.filter((_, index) => trend.value!.series.some((series) => series.data[index])).length >= 2));
const rankingRows = computed<RankRow[]>(() => {
  const result = dashboard.ranking.value;
  if (!result) return [];
  const [one, many] = result.unit ?? ['', ''];
  return result.rows.map((row) => ({
    key: row.key, label: row.label, value: row.value,
    display: result.money ? compactCurrency(row.value, currency.value) : `${row.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${one ? ` ${row.value === 1 ? one : many}` : ''}`,
    to: row.linkDoctype ? { name: 'document-detail', params: { doctype: row.linkDoctype, name: row.key } } : undefined,
  }));
});
const statusTotal = computed(() => dashboard.statusMix.value.reduce((sum, segment) => sum + segment.value, 0));

/** Icon of the module page listing a DocType (falls back to the module's own icon). */
const doctypeIcon = (doctype: string) => module.value?.items.find((item) => item.doctype === doctype)?.icon ?? module.value?.icon ?? Layers3;
/** New records in the last 4 weeks against the 4 weeks before, from the weekly creation counts. */
function weeklyChange(weeks: number[] | undefined): Pick<Metric, 'delta' | 'trend'> {
  if (!weeks || weeks.length < 8) return {};
  const recent = weeks.slice(-4).reduce((sum, value) => sum + value, 0);
  const before = weeks.slice(-8, -4).reduce((sum, value) => sum + value, 0);
  if (!before) return recent ? { delta: `+${recent} new`, trend: 'up' } : { delta: 'No new', trend: 'flat' };
  const percent = ((recent - before) / before) * 100;
  return { delta: `${Math.abs(percent).toFixed(0)}%`, trend: Math.abs(percent) < 1 ? 'flat' : percent > 0 ? 'up' : 'down' };
}

/** KPI strip as MetricCard tiles: NGO figures from the dataset, ERPNext counts live. */
const kpiMetrics = computed<Metric[]>(() => {
  if (ngo.value) return ngo.value.kpis.map((kpi) => ({ label: kpi.label, value: kpi.value, hint: kpi.hint, tone: kpi.tone, spark: kpi.spark, icon: module.value?.icon }));
  return dashboard.kpis.value.map((kpi) => {
    const spark = kpiSpark(kpi.doctype);
    const hasSpark = Boolean(spark?.some(Boolean));
    return {
      label: kpi.label,
      value: kpi.value === null ? '—' : kpi.value.toLocaleString(),
      icon: doctypeIcon(kpi.doctype),
      ...(kpi.value === null ? {} : weeklyChange(spark)),
      hint: kpi.value === null ? 'not available to you' : spark ? 'new vs previous 4 weeks' : kpi.hint,
      tone: kpi.tone,
      to: kpi.to,
      spark: hasSpark ? spark : undefined,
    };
  });
});

// ---------- Reference layout for ERPNext modules ----------
const toneToken: Record<StatusTone, string> = { green: '--success', rose: '--danger', amber: '--warning', blue: '--info', cyan: '--accent', violet: '--primary', slate: '--chart-neutral' };
const activityRows = computed<ActivityRow[]>(() => dashboard.recent.value.slice(0, 6).map((record) => ({
  key: `${record.doctype}-${record.name}`, icon: doctypeIcon(record.doctype), tone: record.status ? toneToken[record.status.tone] : '--primary',
  title: record.title, titleMeta: record.title !== record.name ? record.name : undefined,
  subtitle: [record.doctype, record.status?.label].filter(Boolean).join(' · '),
  time: relativeTime(record.modified) || undefined, timeTitle: formatDate(record.modified, true),
  to: { name: 'document-detail', params: { doctype: record.doctype, name: record.name } },
})));
const rankingTable = computed<ValueRow[]>(() => {
  const result = dashboard.ranking.value;
  if (!result) return [];
  return rankingRows.value.slice(0, 5).map((row, index) => ({
    key: row.key, label: row.label, value: row.display,
    amount: result.money ? `${result.rows[index]?.count ?? ''}` : undefined,
    to: row.to as ValueRow['to'],
  }));
});
const statusRows = computed<AlertRow[]>(() => {
  const doctype = dashboard.statusDoctype.value;
  return dashboard.statusMix.value.slice(0, 5).map((segment) => ({
    key: segment.label, icon: CircleDot, tone: segment.color, title: segment.label,
    detail: `${statusTotal.value ? Math.round((segment.value / statusTotal.value) * 100) : 0}% of ${doctype || 'records'}`,
    badge: { label: segment.value.toLocaleString(), tone: 'slate' },
    to: doctype ? getDocumentRouteForDocType(doctype) : undefined,
  }));
});
/** Quick actions: create what the user may create among the module's main DocTypes, then lists and reports. */
const creatable = ref<string[]>([]);
watch(() => module.value?.key, async () => {
  creatable.value = [];
  const doctypes = (dashConfig.value?.activity ?? []).filter((doctype) => module.value?.items.some((item) => item.doctype === doctype)).slice(0, 3);
  const allowed = await Promise.all(doctypes.map((doctype) => hasDocTypePermission(doctype, 'create').catch(() => false)));
  creatable.value = doctypes.filter((_, index) => allowed[index]);
}, { immediate: true });
const quickActions = computed<QuickAction[]>(() => {
  if (!module.value) return [];
  const actions: QuickAction[] = creatable.value.map((doctype) => ({ label: `New ${doctype}`, icon: Plus, to: { name: 'document-create', params: { doctype } } }));
  if (primaryDoctype.value) actions.push({ label: `View ${primaryDoctype.value} list`, icon: List, to: getDocumentRouteForDocType(primaryDoctype.value) });
  if (module.value.reportModules.length) actions.push({ label: 'All reports', icon: FileSpreadsheet, to: module.value.reportsRoute });
  return actions.slice(0, 4);
});
const subtitle = computed(() => (module.value ? `Here's what's happening in ${module.value.label}.` : ''));
</script>

<template>
  <div v-if="module" class="page module-page stagger-in" :style="{ '--c': `var(${module.color})` }">
    <StockOverview v-if="isStock" />

    <div v-else class="dashboard">
      <DashboardHeader>
        <template #subtitle>{{ ngo ? ngo.eyebrow : subtitle }}<template v-if="isStatic"> · <span class="demo-tag">Demo data · read-only</span></template></template>
        <BaseButton v-if="module.reportModules.length" variant="quiet" size="md" @click="router.push(module.reportsRoute)"><FileSpreadsheet :size="15" />Reports</BaseButton>
        <BaseButton v-if="canCreate && primaryDoctype" variant="primary" size="md" @click="router.push({ name: 'document-create', params: { doctype: primaryDoctype } })"><Plus :size="15" />New {{ primaryDoctype }}</BaseButton>
      </DashboardHeader>

      <section v-if="kpiMetrics.length || (!ngo && dashboard.loading.value)" class="dash-kpis">
        <template v-if="!ngo && dashboard.loading.value && !kpiMetrics.length"><span v-for="index in 4" :key="index" class="skeleton kpi-skeleton" /></template>
        <MetricCard v-for="(metric, index) in kpiMetrics" :key="metric.label" :metric="metric" :class="['stagger-in', `delay-${Math.min(index + 1, 4)}`]" />
      </section>

      <!-- NGO modules: their own panel set (demo dataset). -->
      <section v-if="ngo" class="dash-grid">
        <PanelCard v-for="panel in ngo.panels" :key="panel.title" :title="panel.title" :eyebrow="panel.note" :class="{ 'panel--wide': 'wide' in panel && panel.wide }">
          <TrendChart v-if="panel.kind === 'trend'" :labels="panel.labels" :series="panel.series" type="line" :height="230" :format-value="money" />
          <SegmentedBar v-else-if="panel.kind === 'segments'" :segments="panel.segments" :label="panel.title" />
          <DonutChart v-else-if="panel.kind === 'donut'" :segments="panel.segments" :label="panel.title" :center-label="panel.centerLabel" :center-value="panel.centerValue" :size="180" />
          <TrendChart v-else-if="panel.kind === 'bars'" :labels="panel.labels" :series="panel.series" type="bar" :height="250" :stacked="panel.stacked" :bar-colors="panel.barColors" :format-value="panel.money ? money : undefined" :hide-legend="panel.series.length < 2" />
          <RadarChart v-else-if="panel.kind === 'radar'" :axes="panel.axes" :series="panel.series" :max="panel.max" :height="290" :label="panel.title" />
          <RankBars v-else-if="panel.kind === 'rank'" :rows="panel.rows" :label="panel.title" colorful />
          <BudgetBars v-else-if="panel.kind === 'budget'" :rows="panel.rows" :format="money" />
          <ul v-else-if="panel.kind === 'progress'" class="progress-list">
            <li v-for="row in panel.rows" :key="row.label + row.detail">
              <div class="progress-head">
                <component :is="row.to ? RouterLink : 'span'" :to="row.to" class="progress-label">{{ row.label }}</component>
                <span class="progress-figure tabular"><b>{{ row.value }}{{ row.unit }}</b> / {{ row.target }}{{ row.unit }}</span>
              </div>
              <div class="progress-track"><i :class="{ met: row.value >= row.target, low: row.value / row.target < 0.6 }" :style="{ width: `${Math.min(100, (row.value / (row.target || 1)) * 100)}%` }" /></div>
              <small>{{ row.detail }}</small>
            </li>
          </ul>
        </PanelCard>
      </section>

      <!-- ERPNext modules: the reference layout. -->
      <template v-else>
        <section class="dash-main">
          <PanelCard v-if="dashConfig?.trend" :title="dashConfig.trend.title" :eyebrow="dashConfig.trend.note">
            <template v-if="trend && trendHasData" #actions><span v-for="series in trend.series.filter((entry) => entry.total)" :key="series.name" class="legend-dot"><i :style="{ background: `var(${series.color})` }" />{{ series.name }}</span></template>
            <span v-if="dashboard.loading.value" class="skeleton" style="height: 290px; border-radius: 10px" />
            <template v-else-if="trend && trendHasData">
              <div class="trend-summary">
                <div v-for="series in trend.series" :key="series.name" class="summary-stat">
                  <span>{{ series.name }}</span>
                  <strong class="tabular">{{ trendFormat(series.total) }}</strong>
                </div>
              </div>
              <TrendChart :labels="trend.labels" :series="trend.series" type="line" :height="240" :format-value="trendFormat" :integer="!trend.money" hide-legend />
            </template>
            <ChartPlaceholder v-else kind="line" :height="290" :icon="TrendingUp" :title="`No ${dashConfig.trend.title.toLowerCase()} to chart yet`" :description="dashConfig.trend.note" />
          </PanelCard>
          <PanelCard v-else title="Activity" eyebrow="Documents created per week · last 8 weeks">
            <template v-if="hasActivity" #actions><span v-for="series in dashboard.activitySeries.value" :key="series.name" class="legend-dot"><i :style="{ background: `var(${series.color})` }" />{{ series.name }}</span></template>
            <span v-if="dashboard.loading.value" class="skeleton" style="height: 290px; border-radius: 10px" />
            <TrendChart v-else-if="hasActivity" :labels="dashboard.activityLabels.value" :series="dashboard.activitySeries.value" type="line" :height="260" integer hide-legend />
            <ChartPlaceholder v-else kind="line" :height="290" :icon="BarChart3" :title="hasActivityAtAll ? 'Not enough activity to chart yet' : 'No new documents in 8 weeks'" :description="`Activity appears here as your team creates ${module.label.toLowerCase()} documents.`" />
          </PanelCard>

          <PanelCard title="Recent Activity" :eyebrow="`Latest changes in ${module.label}`">
            <template v-if="primaryDoctype" #actions><RouterLink :to="getDocumentRouteForDocType(primaryDoctype)" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
            <div v-if="dashboard.loading.value" class="dash-list-skeleton"><span v-for="index in 5" :key="index" class="skeleton" style="height: 46px; border-radius: 10px" /></div>
            <ActivityFeed v-else-if="activityRows.length" :rows="activityRows" />
            <ChartPlaceholder v-else kind="rows" :height="260" :icon="Clock3" title="Nothing here yet" :description="`Records you create in ${module.label} will appear here.`" />
          </PanelCard>
        </section>

        <section class="dash-three">
          <PanelCard v-if="dashConfig?.ranking" :title="dashConfig.ranking.title" no-padding>
            <template v-if="module.reportModules.length" #actions><RouterLink :to="module.reportsRoute" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
            <div v-if="dashboard.loading.value" class="dash-list-skeleton dash-pad"><span v-for="index in 5" :key="index" class="skeleton" style="height: 36px; border-radius: 8px" /></div>
            <ValueTable v-else-if="rankingTable.length" :rows="rankingTable" label-header="Name" :value-header="dashboard.ranking.value?.money ? 'Value' : 'Total'" :amount-header="dashboard.ranking.value?.money ? 'Docs' : ''" />
            <div v-else class="dash-pad"><ChartPlaceholder kind="rows" :height="240" :icon="Layers3" title="Nothing to rank yet" :description="dashConfig.ranking.note" /></div>
          </PanelCard>
          <PanelCard v-else title="New per week" eyebrow="Documents created · last 8 weeks">
            <span v-if="dashboard.loading.value" class="skeleton" style="height: 240px; border-radius: 10px" />
            <TrendChart v-else-if="hasActivity" :labels="dashboard.activityLabels.value" :series="dashboard.activitySeries.value" type="bar" :height="240" integer />
            <ChartPlaceholder v-else kind="bar" :height="240" :icon="BarChart3" title="No new documents in 8 weeks" :description="`Activity appears here as your team creates ${module.label.toLowerCase()} documents.`" />
          </PanelCard>

          <PanelCard title="Status Overview" :eyebrow="dashboard.statusDoctype.value ? `${dashboard.statusDoctype.value} by current status` : undefined">
            <template v-if="dashboard.statusDoctype.value" #actions><RouterLink :to="getDocumentRouteForDocType(dashboard.statusDoctype.value)" class="view-all">View all<ArrowRight :size="13" /></RouterLink></template>
            <div v-if="dashboard.loading.value" class="dash-list-skeleton"><span v-for="index in 4" :key="index" class="skeleton" style="height: 46px; border-radius: 10px" /></div>
            <AlertList v-else-if="statusRows.length" :rows="statusRows" />
            <ChartPlaceholder v-else kind="rows" :height="240" :icon="Layers3" :title="`No ${dashboard.statusDoctype.value || 'records'} yet`" description="The status mix appears once records exist." />
          </PanelCard>

          <PanelCard title="Quick Actions"><QuickActions :actions="quickActions" /></PanelCard>
        </section>
      </template>
    </div>

    <!-- Browse: every page in the module, grouped like the sidebar -->
    <section class="browse" aria-label="Pages in this module">
      <div v-for="section in browseSections" :key="section.label" class="browse-section">
        <h2 class="group-label">{{ section.label === module.label ? 'Pages' : section.label }}</h2>
        <div class="browse-grid">
          <RouterLink v-for="entry in section.items" :key="entry.path" :to="entry.path" class="browse-card">
            <span class="browse-icon"><component :is="entry.icon" :size="16" /></span>
            <span class="browse-copy"><strong>{{ entry.label }}</strong><small>{{ browseDescription(entry) }}</small></span>
            <span v-if="dashboard.counts.value[entry.path] != null" class="browse-count tabular" :aria-label="`${dashboard.counts.value[entry.path]} records`">{{ dashboard.counts.value[entry.path]!.toLocaleString() }}</span>
            <ArrowUpRight v-else-if="entry.report || entry.allReports" :size="14" class="browse-go" />
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
  <div v-else class="page"><EmptyState title="Module not available" description="This module is not installed on this ERPNext site." :icon="Layers3" /></div>
</template>

<style scoped>
.module-page { gap: 24px; }
.demo-tag { padding: 1px 8px; color: var(--accent-soft-foreground); border-radius: 999px; background: var(--accent-soft); font-size: 11.5px; font-weight: 600; }
.kpi-skeleton { height: 150px; border-radius: var(--radius-xl); }

/* Panels (PanelCard) */
.dash-grid { display: grid; grid-auto-flow: row dense; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 14px; }
.panel--wide { grid-column: 1 / -1; }
.trend-summary { display: flex; flex-wrap: wrap; gap: 10px 32px; margin-bottom: 10px; }

.progress-list { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.progress-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.progress-label { color: var(--foreground); font-size: 13px; font-weight: 500; }
a.progress-label:hover { color: var(--primary); text-decoration: underline; }
.progress-figure { color: var(--subtle-foreground); font-size: 12px; white-space: nowrap; }
.progress-figure b { color: var(--foreground); font-size: 13px; }
.progress-track { height: 8px; overflow: hidden; border-radius: 999px; background: var(--chart-track); }
.progress-track i { display: block; height: 100%; border-radius: 999px; background: var(--chart-3); }
.progress-track i.met { background: var(--success); }
.progress-track i.low { background: var(--chart-2); }
.progress-list small { color: var(--subtle-foreground); font-size: 11.5px; }

/* Browse */
.browse { display: flex; flex-direction: column; gap: 18px; }
.browse-section { display: flex; flex-direction: column; gap: 8px; }
.browse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.browse-card { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-sm); transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-med) var(--ease); }
.browse-card:hover { border-color: color-mix(in srgb, var(--c) 40%, var(--border)); box-shadow: var(--shadow-hover); }
.browse-card:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.browse-icon { display: grid; width: 32px; height: 32px; flex: none; place-items: center; color: var(--c); border-radius: 9px; background: color-mix(in srgb, var(--c) 12%, transparent); }
.browse-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; line-height: 1.3; }
.browse-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.browse-copy small { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.browse-count { flex: none; padding: 0 8px; color: var(--muted-foreground); border-radius: 999px; background: var(--muted); font-size: 11.5px; font-weight: 600; line-height: 20px; }
.browse-go { flex: none; color: var(--icon-foreground); }
.browse-card:hover .browse-go { color: var(--c); }

@media (max-width: 1100px) { .dash-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
