<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowUpRight, BarChart3, ChevronRight, Clock3, FileSpreadsheet, Layers3, Plus, TrendingUp, Trophy } from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';
import { useRoute } from 'vue-router';
import { modulePageCount, useNavigation } from '@/composables/useNavigation';
import { useModuleDashboard } from '@/composables/useModuleDashboard';
import { moduleDashboards } from '@/config/module-dashboards';
import { isStaticDocType } from '@/services/static-data';
import { hasDocTypePermission } from '@/services/metadata-api';
import EmptyState from '@/components/feedback/EmptyState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import TrendChart from '@/components/charts/TrendChart.vue';
import SegmentedBar from '@/components/charts/SegmentedBar.vue';
import BudgetBars from '@/components/charts/BudgetBars.vue';
import Sparkline from '@/components/charts/Sparkline.vue';
import ChartPlaceholder from '@/components/charts/ChartPlaceholder.vue';
import RankBars, { type RankRow } from '@/components/charts/RankBars.vue';
import DonutChart from '@/components/charts/DonutChart.vue';
import RadarChart from '@/components/charts/RadarChart.vue';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import { ngoOverview, lakh } from '@/ngo/overview';
import { monogram, monogramTone } from '@/lib/display';
import { compactCurrency, relativeTime } from '@/lib/doctype';

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

const primaryDoctype = computed(() => (module.value ? moduleDashboards[module.value.key]?.primary : undefined));
const canCreate = ref(false);
watch(primaryDoctype, async (doctype) => { canCreate.value = doctype ? await hasDocTypePermission(doctype, 'create') : false; }, { immediate: true });

const money = (value: number) => (value >= 100000 ? lakh(value) : `₹${Math.round(value / 1000)}k`);
const pageCount = computed(() => (module.value ? modulePageCount(module.value) : 0));
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
</script>

<template>
  <div v-if="module" class="page module-page stagger-in" :style="{ '--c': `var(${module.color})` }">
    <!-- Header -->
    <header class="module-header">
      <span class="module-mark"><component :is="module.icon" :size="20" :stroke-width="2" /></span>
      <div class="module-heading">
        <p class="eyebrow">{{ module.type === 'custom' ? `${module.workspace} workspace` : 'ERPNext' }}<template v-if="ngo"> · {{ ngo.eyebrow }}</template></p>
        <h1 class="page-title">{{ module.label }}</h1>
        <p class="page-subtitle">{{ pageCount }} pages in this module<template v-if="isStatic"> · <span class="demo-tag">Demo data · read-only</span></template></p>
      </div>
      <div class="page-actions">
        <BaseButton v-if="module.reportModules.length" variant="quiet" size="sm" @click="router.push(module.reportsRoute)"><FileSpreadsheet :size="14" />Reports</BaseButton>
        <BaseButton v-if="canCreate && primaryDoctype" variant="primary" size="sm" @click="router.push({ name: 'document-create', params: { doctype: primaryDoctype } })"><Plus :size="14" />New {{ primaryDoctype }}</BaseButton>
      </div>
    </header>

    <!-- KPI strip -->
    <section v-if="ngo" class="kpi-grid">
      <article v-for="kpi in ngo.kpis" :key="kpi.label" :class="['kpi', `kpi-tone-${kpi.tone}`, { 'kpi--lead': kpi.lead }]">
        <span class="kpi-top"><span class="kpi-label">{{ kpi.label }}</span><span class="kpi-dot" /></span>
        <span class="kpi-body">
          <strong :class="['kpi-value tabular', { 'kpi-value--text': kpi.value.length > 10 }]" :title="kpi.value">{{ kpi.value }}</strong>
          <Sparkline v-if="kpi.spark" :data="kpi.spark" :color="kpi.lead ? '--primary-foreground' : '--tone'" :height="30" class="kpi-spark" />
        </span>
        <span class="kpi-hint">{{ kpi.hint }}</span>
      </article>
    </section>
    <section v-else-if="dashboard.kpis.value.length || dashboard.loading.value" class="kpi-grid">
      <template v-if="dashboard.loading.value && !dashboard.kpis.value.length"><span v-for="index in 4" :key="index" class="skeleton kpi-skeleton" /></template>
      <RouterLink v-for="(kpi, index) in dashboard.kpis.value" :key="kpi.label" :to="kpi.to" :class="['kpi kpi--link', `kpi-tone-${kpi.tone}`, { 'kpi--lead': index === 0 }]">
        <span class="kpi-top"><span class="kpi-label">{{ kpi.label }}</span><span class="kpi-dot" /></span>
        <span class="kpi-body">
          <strong class="kpi-value tabular">{{ kpi.value === null ? '—' : kpi.value.toLocaleString() }}</strong>
          <Sparkline v-if="kpiSpark(kpi.doctype)?.some(Boolean)" :data="kpiSpark(kpi.doctype)!" :color="index === 0 ? '--primary-foreground' : '--tone'" :height="30" class="kpi-spark" />
        </span>
        <span class="kpi-hint">{{ kpi.value === null ? 'not available to you' : kpi.hint }}<template v-if="kpiSpark(kpi.doctype)?.some(Boolean)"> · new per week</template></span>
      </RouterLink>
    </section>

    <!-- Headline trend + ranking -->
    <section v-if="!ngo && dashConfig?.trend" class="dash-grid">
      <article class="panel panel--main">
        <header class="panel-head"><div><h2>{{ dashConfig.trend.title }}</h2><p>{{ dashConfig.trend.note }}</p></div></header>
        <span v-if="dashboard.loading.value" class="skeleton" style="height: 290px; border-radius: 10px" />
        <template v-else-if="trend && trendHasData">
          <div class="trend-summary">
            <div v-for="series in trend.series" :key="series.name" class="summary-stat">
              <span><i :style="{ background: `var(${series.color})` }" />{{ series.name }}</span>
              <strong class="tabular">{{ trendFormat(series.total) }}</strong>
            </div>
          </div>
          <TrendChart :labels="trend.labels" :series="trend.series" type="line" :height="230" :format-value="trendFormat" :integer="!trend.money" hide-legend />
        </template>
        <ChartPlaceholder v-else kind="line" :height="290" :icon="TrendingUp" :title="`No ${dashConfig.trend.title.toLowerCase()} to chart yet`" :description="dashConfig.trend.note" />
      </article>
      <article v-if="dashConfig.ranking" class="panel">
        <header class="panel-head"><div><h2>{{ dashConfig.ranking.title }}</h2><p>{{ dashConfig.ranking.note }}</p></div></header>
        <div v-if="dashboard.loading.value" class="list-skeleton"><span v-for="index in 5" :key="index" class="skeleton" style="height: 40px; border-radius: 8px" /></div>
        <RankBars v-else-if="rankingRows.length" :rows="rankingRows" :label="dashConfig.ranking.title" colorful />
        <ChartPlaceholder v-else kind="rows" :height="260" :icon="Trophy" :title="`Nothing to rank yet`" :description="dashConfig.ranking.note" />
      </article>
    </section>

    <!-- Charts -->
    <section class="dash-grid">
      <template v-if="ngo">
        <article v-for="panel in ngo.panels" :key="panel.title" :class="['panel', { 'panel--wide': 'wide' in panel && panel.wide }]">
          <header class="panel-head"><div><h2>{{ panel.title }}</h2><p>{{ panel.note }}</p></div></header>
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
        </article>
      </template>
      <template v-else>
        <article class="panel panel--main">
          <header class="panel-head">
            <div><h2>Activity</h2><p>Documents created per week · last 8 weeks</p></div>
            <div v-if="hasActivity" class="legend"><span v-for="series in dashboard.activitySeries.value" :key="series.name"><i :style="{ background: `var(${series.color})` }" />{{ series.name }}</span></div>
          </header>
          <span v-if="dashboard.loading.value" class="skeleton" style="height: 240px; border-radius: 10px" />
          <TrendChart v-else-if="hasActivity" :labels="dashboard.activityLabels.value" :series="dashboard.activitySeries.value" type="line" :height="240" integer hide-legend />
          <ChartPlaceholder v-else kind="line" :height="240" :icon="BarChart3" :title="hasActivityAtAll ? 'Not enough activity to chart yet' : 'No new documents in 8 weeks'" :description="`Activity appears here as your team creates ${module.label.toLowerCase()} documents.`" />
        </article>
        <article class="panel">
          <header class="panel-head"><div><h2>Status</h2><p>{{ dashboard.statusDoctype.value || module.label }} by current status</p></div></header>
          <span v-if="dashboard.loading.value" class="skeleton" style="height: 180px; border-radius: 10px" />
          <DonutChart v-else-if="dashboard.statusMix.value.length" :segments="dashboard.statusMix.value" :center-value="statusTotal.toLocaleString()" :center-label="dashboard.statusDoctype.value" :label="`${dashboard.statusDoctype.value} by status`" :size="170" />
          <ChartPlaceholder v-else kind="bar" :height="240" :icon="Layers3" :title="`No ${dashboard.statusDoctype.value || 'records'} yet`" description="The status mix appears once records exist." />
        </article>
      </template>
    </section>

    <!-- Browse: every page in the module, grouped like the sidebar -->
    <section class="browse" aria-label="Pages in this module">
      <div v-for="section in browseSections" :key="section.label" class="browse-section">
        <h2 class="browse-title">{{ section.label === module.label ? 'Pages' : section.label }}</h2>
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

    <!-- Recent -->
    <section class="dash-grid">
      <article class="panel panel--wide">
        <header class="panel-head"><div><h2>Latest changes</h2><p>Most recently updated records in {{ module.label }}</p></div></header>
        <div v-if="dashboard.loading.value" class="list-skeleton"><span v-for="index in 5" :key="index" class="skeleton" style="height: 40px; border-radius: 8px" /></div>
        <ul v-else-if="dashboard.recent.value.length" class="recent-list">
          <li v-for="record in dashboard.recent.value" :key="`${record.doctype}-${record.name}`">
            <RouterLink :to="{ name: 'document-detail', params: { doctype: record.doctype, name: record.name } }" class="recent-row">
              <span :class="['monogram', `tone-${monogramTone(record.name)}`]">{{ monogram(record.title) }}</span>
              <span class="recent-copy"><strong>{{ record.title }}</strong><small>{{ record.doctype }}<template v-if="record.title !== record.name"> · {{ record.name }}</template></small></span>
              <BaseBadge v-if="record.status" :tone="record.status.tone" :label="record.status.label" />
              <span class="recent-time"><Clock3 :size="12" />{{ relativeTime(record.modified) || '—' }}</span>
              <ChevronRight :size="15" class="recent-arrow" />
            </RouterLink>
          </li>
        </ul>
        <ChartPlaceholder v-else kind="rows" :height="220" :icon="Clock3" title="Nothing here yet" :description="`Records you create in ${module.label} will appear here.`" />
      </article>

    </section>
  </div>
  <div v-else class="page"><EmptyState title="Module not available" description="This module is not installed on this ERPNext site." :icon="Layers3" /></div>
</template>

<style scoped>
.module-page { gap: 16px; }

/* Header: solid, quiet, with the module's color only on its mark. */
.module-header { display: flex; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.module-mark { display: grid; width: 44px; height: 44px; flex: none; place-items: center; color: var(--surface); border-radius: 12px; background: var(--c); }
.module-heading { min-width: 0; flex: 1; }
.module-heading .page-title { margin-top: 2px; }
.demo-tag { padding: 1px 8px; color: var(--accent-soft-foreground); border-radius: 999px; background: var(--accent-soft); font-size: 11.5px; font-weight: 600; }

/* KPI strip */
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.kpi { display: flex; min-width: 0; flex-direction: column; gap: 4px; padding: 16px 18px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--tone, var(--primary)) 12%, transparent), transparent 62%), var(--surface); box-shadow: var(--shadow-md); transition: border-color var(--dur-fast) var(--ease); }
.kpi--link:hover { border-color: color-mix(in srgb, var(--tone, var(--primary)) 45%, var(--border)); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kpi-label { overflow: hidden; color: var(--muted-foreground); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.kpi-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--tone, var(--primary)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone, var(--primary)) 20%, transparent); }
.trend-summary { display: flex; flex-wrap: wrap; gap: 10px 32px; }
.summary-stat { display: flex; flex-direction: column; gap: 4px; }
.summary-stat span { display: inline-flex; align-items: center; gap: 7px; color: var(--subtle-foreground); font-size: 12px; font-weight: 500; }
.summary-stat i { width: 10px; height: 10px; border-radius: 3px; }
.summary-stat strong { color: var(--foreground); font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.kpi-body { display: flex; align-items: flex-end; gap: 12px; margin-top: 6px; }
.kpi-spark { width: 40%; max-width: 110px; flex: none; }
.kpi-value { min-width: 0; flex: 1; overflow: hidden; color: var(--foreground); font-family: var(--font-display); font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.kpi-value--text { font-size: 19px; line-height: 1.5; }
.kpi-hint { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.kpi--lead { border-color: transparent; background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 55%, var(--chart-3)) 100%); box-shadow: var(--shadow-md); }
.kpi--lead .kpi-label, .kpi--lead .kpi-hint { color: color-mix(in srgb, var(--primary-foreground) 80%, transparent); }
.kpi--lead .kpi-value { color: var(--primary-foreground); }
.kpi--lead .kpi-dot { background: var(--primary-foreground); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-foreground) 25%, transparent); }
.kpi--lead.kpi--link:hover { border-color: color-mix(in srgb, var(--primary-foreground) 35%, transparent); }
.kpi-skeleton { height: 104px; border-radius: 12px; }

/* Panels */
.dash-grid { display: grid; grid-auto-flow: row dense; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 14px; }
.panel { display: flex; min-width: 0; flex-direction: column; gap: 14px; padding: 18px 20px 20px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.panel--wide { grid-column: 1 / -1; }
.panel-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px; }
.panel-head h2 { color: var(--foreground); font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; }
.panel-head p { margin-top: 2px; color: var(--muted-foreground); font-size: 12.5px; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; color: var(--muted-foreground); font-size: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 9px; height: 9px; border-radius: 3px; }

.progress-list { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.progress-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.progress-label { color: var(--foreground); font-size: 13px; font-weight: 500; }
a.progress-label:hover { color: var(--primary); text-decoration: underline; }
.progress-figure { color: var(--subtle-foreground); font-size: 12px; white-space: nowrap; }
.progress-figure b { color: var(--foreground); font-size: 13px; }
.progress-track { height: 8px; overflow: hidden; border-radius: 999px; background: var(--chart-track); }
.progress-track i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--chart-3) 75%, transparent), var(--chart-3)); }
.progress-track i.met { background: linear-gradient(90deg, color-mix(in srgb, var(--success) 75%, transparent), var(--success)); }
.progress-track i.low { background: linear-gradient(90deg, color-mix(in srgb, var(--chart-2) 75%, transparent), var(--chart-2)); }
.progress-list small { color: var(--subtle-foreground); font-size: 11.5px; }

/* Latest changes */
.list-skeleton { display: flex; flex-direction: column; gap: 8px; }
.recent-list { display: flex; flex-direction: column; margin: -6px -10px; padding: 0; list-style: none; }
.recent-row { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 8px; transition: background-color .12s; }
.recent-row:hover { background: var(--muted); }
.recent-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; line-height: 1.3; }
.recent-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.recent-copy small { overflow: hidden; color: var(--subtle-foreground); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.recent-time { display: inline-flex; flex: none; align-items: center; gap: 4px; width: 92px; justify-content: flex-end; color: var(--subtle-foreground); font-size: 12px; }
.recent-arrow { flex: none; color: var(--subtle-foreground); }
.recent-row:hover .recent-arrow { color: var(--c); }

/* Browse */
.browse { display: flex; flex-direction: column; gap: 16px; }
.browse-section { display: flex; flex-direction: column; gap: 8px; }
.browse-title { color: var(--subtle-foreground); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.browse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.browse-card { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); transition: border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease); }
.browse-card:hover { border-color: color-mix(in srgb, var(--c) 45%, var(--border)); }
.browse-card:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.browse-icon { display: grid; width: 32px; height: 32px; flex: none; place-items: center; color: var(--c); border-radius: 9px; background: color-mix(in srgb, var(--c) 13%, transparent); }
.browse-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; line-height: 1.3; }
.browse-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.browse-copy small { overflow: hidden; color: var(--muted-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.browse-count { flex: none; padding: 0 8px; color: var(--muted-foreground); border-radius: 999px; background: var(--muted); font-size: 11.5px; font-weight: 600; line-height: 20px; }
.browse-go { flex: none; color: var(--subtle-foreground); }
.browse-card:hover .browse-go { color: var(--c); }

@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dash-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .module-header { flex-wrap: wrap; }
  .module-header .page-actions { width: 100%; }
  .recent-time { display: none; }
}
@media (max-width: 480px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
