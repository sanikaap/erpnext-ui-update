<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowRight, ArrowUpRight, BarChart3, ChevronRight, Clock3, FileSpreadsheet, Layers3, Plus } from 'lucide-vue-next';
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
import { ngoOverview, lakh } from '@/ngo/overview';
import { monogram, monogramTone } from '@/lib/display';
import { relativeTime } from '@/lib/doctype';

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
const hasActivity = computed(() => dashboard.activitySeries.value.some((series) => series.data.some(Boolean)));
const toneIcon: Record<string, string> = { violet: 'tone-violet', blue: 'tone-blue', green: 'tone-green', amber: 'tone-amber', rose: 'tone-rose', cyan: 'tone-cyan', slate: 'tone-slate' };
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
      <article v-for="kpi in ngo.kpis" :key="kpi.label" :class="['kpi', { 'kpi--lead': kpi.lead }]">
        <span class="kpi-label">{{ kpi.label }}</span>
        <strong class="kpi-value tabular">{{ kpi.value }}</strong>
        <span class="kpi-hint">{{ kpi.hint }}</span>
      </article>
    </section>
    <section v-else-if="dashboard.kpis.value.length || dashboard.loading.value" class="kpi-grid">
      <template v-if="dashboard.loading.value && !dashboard.kpis.value.length"><span v-for="index in 4" :key="index" class="skeleton kpi-skeleton" /></template>
      <RouterLink v-for="(kpi, index) in dashboard.kpis.value" :key="kpi.label" :to="kpi.to" :class="['kpi kpi--link', { 'kpi--lead': index === 0 }]">
        <span class="kpi-top"><span class="kpi-label">{{ kpi.label }}</span><span :class="['kpi-dot', toneIcon[kpi.tone]]" /></span>
        <strong class="kpi-value tabular">{{ kpi.value === null ? '—' : kpi.value.toLocaleString() }}</strong>
        <span class="kpi-hint">{{ kpi.value === null ? 'not available to you' : kpi.hint }}</span>
      </RouterLink>
    </section>

    <!-- Charts -->
    <section class="dash-grid">
      <template v-if="ngo">
        <article v-for="panel in ngo.panels" :key="panel.title" :class="['panel', { 'panel--wide': 'wide' in panel && panel.wide }]">
          <header class="panel-head"><div><h2>{{ panel.title }}</h2><p>{{ panel.note }}</p></div></header>
          <TrendChart v-if="panel.kind === 'trend'" :labels="panel.labels" :series="panel.series" type="line" :height="230" :format-value="money" />
          <SegmentedBar v-else-if="panel.kind === 'segments'" :segments="panel.segments" :label="panel.title" />
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
          <TrendChart v-else-if="hasActivity" :labels="dashboard.activityLabels.value" :series="dashboard.activitySeries.value" :height="240" />
          <EmptyState v-else compact :icon="BarChart3" title="No new documents in 8 weeks" :description="`Activity appears here as your team creates ${module.label.toLowerCase()} documents.`" />
        </article>
        <article class="panel">
          <header class="panel-head"><div><h2>Status</h2><p>{{ dashboard.statusDoctype.value || module.label }} by current status</p></div></header>
          <span v-if="dashboard.loading.value" class="skeleton" style="height: 180px; border-radius: 10px" />
          <SegmentedBar v-else-if="dashboard.statusMix.value.length" :segments="dashboard.statusMix.value" :label="`${dashboard.statusDoctype.value} by status`" />
          <EmptyState v-else compact :icon="Layers3" :title="`No ${dashboard.statusDoctype.value || 'records'} yet`" description="The status mix appears once records exist." />
        </article>
      </template>
    </section>

    <!-- Recent + browse -->
    <section class="dash-grid">
      <article class="panel panel--main">
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
        <EmptyState v-else compact :icon="Clock3" title="Nothing here yet" :description="`Records you create in ${module.label} will appear here.`" />
      </article>

      <article class="panel">
        <header class="panel-head"><div><h2>Browse</h2><p>Everything in {{ module.label }}</p></div></header>
        <div class="browse">
          <section v-for="section in module.visibleSections" :key="section.label" class="browse-section">
            <h3>{{ section.label }}</h3>
            <RouterLink v-for="entry in section.items" :key="entry.path" :to="entry.path" class="browse-row">
              <component :is="entry.icon" :size="15" class="browse-icon" />
              <span>{{ entry.label }}</span>
              <span v-if="dashboard.counts.value[entry.path] != null" class="browse-count tabular">{{ dashboard.counts.value[entry.path]!.toLocaleString() }}</span>
              <ArrowUpRight v-else-if="entry.report" :size="13" class="browse-go" />
            </RouterLink>
          </section>
          <RouterLink v-if="module.reportModules.length" :to="module.reportsRoute" class="browse-all">All {{ module.label }} reports<ArrowRight :size="14" /></RouterLink>
        </div>
      </article>
    </section>
  </div>
  <div v-else class="page"><EmptyState title="Module not available" description="This module is not installed on this ERPNext site." :icon="Layers3" /></div>
</template>

<style scoped>
.module-page { gap: 16px; }

/* Header: solid, quiet, with the module's color only on its mark. */
.module-header { display: flex; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.module-mark { display: grid; width: 44px; height: 44px; flex: none; place-items: center; color: #fff; border-radius: 12px; background: var(--c); }
.module-heading { min-width: 0; flex: 1; }
.module-heading .page-title { margin-top: 2px; }
.demo-tag { padding: 1px 8px; color: var(--accent-soft-foreground); border-radius: 999px; background: var(--accent-soft); font-size: 11.5px; font-weight: 600; }

/* KPI strip */
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.kpi { display: flex; min-width: 0; flex-direction: column; gap: 4px; padding: 16px 18px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow-sm); transition: border-color .15s, box-shadow .15s; }
.kpi--link:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kpi-label { overflow: hidden; color: var(--muted-foreground); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.kpi-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: currentColor; }
.kpi-value { overflow: hidden; margin-top: 6px; color: var(--foreground); font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.kpi-hint { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.kpi--lead { border-color: #0f3b3d; background: #0f3b3d; box-shadow: none; }
.kpi--lead .kpi-label, .kpi--lead .kpi-hint { color: #a9c7c5; }
.kpi--lead .kpi-value { color: #fff; }
.kpi--lead .kpi-dot { color: #5fd0c8; }
.kpi--lead.kpi--link:hover { border-color: #17565a; background: #124446; }
.kpi-skeleton { height: 104px; border-radius: 12px; }

/* Panels */
.dash-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 14px; }
.panel { display: flex; min-width: 0; flex-direction: column; gap: 14px; padding: 18px 20px 20px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow-sm); }
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
.progress-track i { display: block; height: 100%; border-radius: 999px; background: #0e6e70; }
.progress-track i.met { background: var(--secondary); }
.progress-track i.low { background: var(--warning); }
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
.browse { display: flex; flex-direction: column; gap: 14px; }
.browse-section h3 { margin-bottom: 4px; color: var(--subtle-foreground); font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
.browse-row { display: flex; align-items: center; gap: 10px; height: 32px; margin: 0 -8px; padding: 0 8px; color: var(--foreground); border-radius: 7px; font-size: 13px; }
.browse-row span:first-of-type { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browse-row:hover { background: var(--muted); }
.browse-icon { flex: none; color: var(--c); }
.browse-count { padding: 0 7px; color: var(--muted-foreground); border-radius: 999px; background: var(--muted); font-size: 11.5px; font-weight: 600; }
.browse-row:hover .browse-count { background: var(--surface); }
.browse-go { color: var(--subtle-foreground); }
.browse-all { display: inline-flex; align-items: center; gap: 6px; color: var(--primary); font-size: 12.5px; font-weight: 600; }
.browse-all:hover { text-decoration: underline; }

@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dash-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .module-header { flex-wrap: wrap; }
  .module-header .page-actions { width: 100%; }
  .recent-time { display: none; }
}
@media (max-width: 480px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
