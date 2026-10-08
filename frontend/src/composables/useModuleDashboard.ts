import { reactive, ref, watch, type Ref } from 'vue';
import { documentApi } from '@/services/document-api';
import { getDocTypeMetadata } from '@/services/metadata-api';
import { moduleDashboards, type DashboardRanking, type DashboardTrend } from '@/config/module-dashboards';
import { documentStatus } from '@/lib/display';
import { getDocumentRouteForDocType } from '@/config/navigation';
import type { VisibleModule } from '@/composables/useNavigation';
import type { ChartSegment, FrappeDocument, StatusTone } from '@/types/erp';

/*
 * Live figures for a module's Overview, from ERPNext (or the static NGO data — the
 * document service decides). Every query is independent: one DocType the user cannot
 * read only blanks its own tile.
 */

export interface KpiValue { label: string; value: number | null; hint: string; tone: StatusTone; to: string; doctype: string }
export interface TrendResult { title: string; note: string; money: boolean; labels: string[]; series: { name: string; data: number[]; color: string; total: number }[] }
export interface RankingResult { title: string; note: string; money: boolean; unit?: [string, string]; rows: { key: string; label: string; value: number; count: number; linkDoctype?: string }[] }
export interface RecentRecord { doctype: string; name: string; title: string; status: { label: string; tone: StatusTone } | null; modified: string }

const WEEKS = 8;
const safe = async <T>(task: Promise<T>): Promise<T | null> => { try { return await task; } catch { return null; } };
const SERIES_COLORS = ['--chart-1', '--chart-2', '--chart-3'];
const dayKey = (value: unknown) => String(value ?? '').slice(0, 10);

/** Bucket boundaries for a trend: last 30 days, 12 weeks or 12 months (oldest first). */
function buckets(bucket: DashboardTrend['bucket']) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (bucket === 'day') {
    return Array.from({ length: 30 }, (_, index) => { const date = new Date(now); date.setDate(date.getDate() - (29 - index)); return date; });
  }
  if (bucket === 'week') {
    const start = weekStart(now);
    return Array.from({ length: 12 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() - 7 * (11 - index)); return date; });
  }
  return Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (11 - index), 1));
}
function bucketLabel(date: Date, bucket: DashboardTrend['bucket']) {
  return bucket === 'month' ? date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

async function loadTrend(config: DashboardTrend): Promise<TrendResult | null> {
  const starts = buckets(config.bucket);
  const keys = starts.map(iso);
  const from = keys[0];
  const series = await Promise.all(config.series.slice(0, 3).map(async (entry, index) => {
    const fields = [...new Set(['name', entry.dateField, ...(entry.valueField ? [entry.valueField] : [])])];
    const rows = await safe(documentApi.list<FrappeDocument>(entry.doctype, { fields, filters: [...(entry.filters ?? []), [entry.dateField, '>=', from]], limit: 5000 }));
    if (!rows) return null;
    const data = keys.map(() => 0);
    for (const row of rows) {
      const day = dayKey(row[entry.dateField]);
      if (!day || day < from) continue;
      // Last bucket whose start is on or before the record's date.
      let slot = -1;
      for (let position = keys.length - 1; position >= 0; position -= 1) { if (keys[position] <= day) { slot = position; break; } }
      if (slot < 0) continue;
      data[slot] += entry.valueField ? Number(row[entry.valueField]) || 0 : 1;
    }
    const rounded = data.map((value) => Math.round(value * 100) / 100);
    return { name: entry.name, data: rounded, color: SERIES_COLORS[index], total: rounded.reduce((sum, value) => sum + value, 0) };
  }));
  const available = series.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (!available.length) return null;
  return { title: config.title, note: config.note, money: Boolean(config.money), labels: starts.map((date) => bucketLabel(date, config.bucket)), series: available };
}

async function loadRanking(config: DashboardRanking): Promise<RankingResult | null> {
  const fields = [...new Set(['name', config.groupField, ...(config.labelField ? [config.labelField] : []), ...(config.valueField ? [config.valueField] : [])])];
  const filters = typeof config.filters === 'function' ? config.filters() : config.filters ?? [];
  const rows = await safe(documentApi.list<FrappeDocument>(config.doctype, { fields, filters: [...filters, [config.groupField, 'is', 'set']], limit: 5000 }));
  if (!rows) return null;
  const groups = new Map<string, { label: string; value: number; count: number }>();
  for (const row of rows) {
    const key = String(row[config.groupField] ?? '');
    if (!key) continue;
    const entry = groups.get(key) ?? { label: String((config.labelField && row[config.labelField]) || key), value: 0, count: 0 };
    entry.value += config.valueField ? Number(row[config.valueField]) || 0 : 1;
    entry.count += 1;
    groups.set(key, entry);
  }
  const ranked = [...groups.entries()].filter(([, entry]) => entry.value > 0).sort((a, b) => b[1].value - a[1].value).slice(0, 5);
  return {
    title: config.title, note: config.note, money: Boolean(config.money), unit: config.unit,
    rows: ranked.map(([key, entry]) => ({ key, label: entry.label, value: entry.value, count: entry.count, linkDoctype: config.linkDoctype })),
  };
}

const weekStart = (date: Date) => { const copy = new Date(date); copy.setHours(0, 0, 0, 0); copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); return copy; };
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Record counts by item path, kept from the last module overview that loaded them,
 * so the sidebar can show them without making its own requests.
 */
export const recordCounts = reactive<Record<string, number | null>>({});

export function useModuleDashboard(module: Ref<VisibleModule | undefined>) {
  const loading = ref(true);
  const kpis = ref<KpiValue[]>([]);
  const statusMix = ref<ChartSegment[]>([]);
  const statusDoctype = ref('');
  const activityLabels = ref<string[]>([]);
  const activitySeries = ref<{ name: string; data: number[]; color: string }[]>([]);
  const recent = ref<RecentRecord[]>([]);
  const counts = ref<Record<string, number | null>>({});
  const trend = ref<TrendResult | null>(null);
  const ranking = ref<RankingResult | null>(null);
  /** New records per week (last 8 weeks) for every DocType on the page: activity chart + KPI sparklines. */
  const weekly = ref<Record<string, number[]>>({});
  let run = 0;

  async function load(current: VisibleModule) {
    const id = (run += 1);
    loading.value = true;
    const config = moduleDashboards[current.key];
    const listDoctypes = [...new Set(current.visibleSections.flatMap((section) => section.items).map((item) => item.doctype).filter((doctype): doctype is string => Boolean(doctype)))];
    const activity = (config?.activity ?? listDoctypes).filter((doctype) => listDoctypes.includes(doctype)).slice(0, 4);
    const primary = config?.primary && listDoctypes.includes(config.primary) ? config.primary : listDoctypes[0];

    // KPI tiles
    const kpiTask = Promise.all((config?.kpis ?? []).map(async (kpi) => ({
      label: kpi.label, hint: kpi.hint, tone: kpi.tone, to: getDocumentRouteForDocType(kpi.doctype), doctype: kpi.doctype,
      value: await safe(documentApi.count(kpi.doctype, typeof kpi.filters === 'function' ? kpi.filters() : kpi.filters)),
    })));

    // Record counts for the Browse panel
    const countTask = Promise.all(current.visibleSections.flatMap((section) => section.items).filter((item) => item.doctype && !item.report && !item.path.startsWith('/record/')).map(async (item) => [item.path, await safe(documentApi.count(item.doctype!))] as const));

    // Status mix of the primary DocType
    const statusTask = (async () => {
      if (!primary) return [];
      const meta = await safe(getDocTypeMetadata(primary));
      if (!meta) return [];
      const has = (field: string) => meta.fields.some((candidate) => candidate.fieldname === field);
      const fields = ['name', ...['status', 'disabled', 'enabled'].filter(has), ...(meta.is_submittable ? ['docstatus'] : [])];
      if (fields.length === 1) return [];
      const rows = (await safe(documentApi.list<FrappeDocument>(primary, { fields, limit: 1000, orderBy: 'modified desc' }))) ?? [];
      const groups = new Map<string, { value: number; tone: StatusTone }>();
      for (const row of rows) {
        const status = documentStatus(row, { submittable: Boolean(meta.is_submittable) });
        if (!status) continue;
        const entry = groups.get(status.label) ?? { value: 0, tone: status.tone };
        entry.value += 1;
        groups.set(status.label, entry);
      }
      // Status mixes use the reserved status colours (the badge tone), never series colours.
      const toneColor: Record<StatusTone, string> = { green: '--success', blue: '--info', violet: '--chart-1', cyan: '--chart-3', amber: '--warning', rose: '--danger', slate: '--chart-neutral' };
      return [...groups.entries()].sort((a, b) => b[1].value - a[1].value).map(([label, entry]) => ({ label, value: entry.value, color: toneColor[entry.tone] ?? '--chart-neutral', display: `${entry.value}` }));
    })();

    // Weekly creation activity
    const start = weekStart(new Date());
    start.setDate(start.getDate() - 7 * (WEEKS - 1));
    const weeks = Array.from({ length: WEEKS }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index * 7); return date; });
    const weeklyDoctypes = [...new Set([...activity.slice(0, 3), ...(config?.kpis ?? []).map((kpi) => kpi.doctype)])];
    const activityTask = Promise.all(weeklyDoctypes.map(async (doctype) => {
      const rows = (await safe(documentApi.list<FrappeDocument>(doctype, { fields: ['name', 'creation'], filters: [['creation', '>=', `${iso(start)} 00:00:00`]], limit: 1000 }))) ?? [];
      const data = weeks.map((week) => {
        const end = new Date(week); end.setDate(end.getDate() + 7);
        return rows.filter((row) => { const created = new Date(String(row.creation).replace(' ', 'T')); return created >= week && created < end; }).length;
      });
      return { name: doctype, data };
    }));
    const trendTask = config?.trend ? loadTrend(config.trend) : Promise.resolve(null);
    const rankingTask = config?.ranking ? loadRanking(config.ranking) : Promise.resolve(null);

    // Latest changes
    const recentTask = Promise.all(activity.map(async (doctype) => {
      const meta = await safe(getDocTypeMetadata(doctype));
      const has = (field: string) => meta?.fields.some((candidate) => candidate.fieldname === field);
      const titleField = meta?.title_field && has(meta.title_field) ? meta.title_field : undefined;
      const fields = ['name', 'modified', ...(titleField ? [titleField] : []), ...['status', 'disabled', 'enabled'].filter((field) => has(field)), ...(meta?.is_submittable ? ['docstatus'] : [])];
      const rows = (await safe(documentApi.list<FrappeDocument>(doctype, { fields, orderBy: 'modified desc', limit: 5 }))) ?? [];
      return rows.map((row): RecentRecord => ({
        doctype, name: row.name, title: titleField && typeof row[titleField] === 'string' && row[titleField] ? String(row[titleField]) : row.name,
        status: documentStatus(row, { submittable: Boolean(meta?.is_submittable) }), modified: String(row.modified || ''),
      }));
    }));

    const [kpiValues, countValues, mix, series, recentRows, trendResult, rankingResult] = await Promise.all([kpiTask, countTask, statusTask, activityTask, recentTask, trendTask, rankingTask]);
    if (id !== run) return;
    kpis.value = kpiValues;
    counts.value = Object.fromEntries(countValues);
    Object.assign(recordCounts, counts.value);
    statusMix.value = mix;
    statusDoctype.value = primary ?? '';
    activityLabels.value = weeks.map((week) => week.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    weekly.value = Object.fromEntries(series.map((entry) => [entry.name, entry.data]));
    activitySeries.value = activity.slice(0, 3).map((doctype, index) => ({ name: doctype, data: weekly.value[doctype] ?? weeks.map(() => 0), color: SERIES_COLORS[index] }));
    trend.value = trendResult;
    ranking.value = rankingResult;
    recent.value = recentRows.flat().sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 7);
    loading.value = false;
  }

  watch(module, (current) => { if (current) void load(current); }, { immediate: true });
  return { loading, kpis, statusMix, statusDoctype, activityLabels, activitySeries, recent, counts, trend, ranking, weekly };
}
