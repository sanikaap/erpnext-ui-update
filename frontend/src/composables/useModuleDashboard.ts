import { ref, watch, type Ref } from 'vue';
import { documentApi } from '@/services/document-api';
import { getDocTypeMetadata } from '@/services/metadata-api';
import { moduleDashboards } from '@/config/module-dashboards';
import { documentStatus } from '@/lib/display';
import { getDocumentRouteForDocType } from '@/config/navigation';
import type { VisibleModule } from '@/composables/useNavigation';
import type { ChartSegment, FrappeDocument, StatusTone } from '@/types/erp';

/*
 * Live figures for a module's Overview, from ERPNext (or the static NGO data — the
 * document service decides). Every query is independent: one DocType the user cannot
 * read only blanks its own tile.
 */

export interface KpiValue { label: string; value: number | null; hint: string; tone: StatusTone; to: string }
export interface RecentRecord { doctype: string; name: string; title: string; status: { label: string; tone: StatusTone } | null; modified: string }

const WEEKS = 8;
const safe = async <T>(task: Promise<T>): Promise<T | null> => { try { return await task; } catch { return null; } };
const weekStart = (date: Date) => { const copy = new Date(date); copy.setHours(0, 0, 0, 0); copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); return copy; };
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function useModuleDashboard(module: Ref<VisibleModule | undefined>) {
  const loading = ref(true);
  const kpis = ref<KpiValue[]>([]);
  const statusMix = ref<ChartSegment[]>([]);
  const statusDoctype = ref('');
  const activityLabels = ref<string[]>([]);
  const activitySeries = ref<{ name: string; data: number[]; color: string }[]>([]);
  const recent = ref<RecentRecord[]>([]);
  const counts = ref<Record<string, number | null>>({});
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
      label: kpi.label, hint: kpi.hint, tone: kpi.tone, to: getDocumentRouteForDocType(kpi.doctype),
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
      const toneColor: Record<StatusTone, string> = { green: '--chart-2', blue: '--chart-6', violet: '--chart-1', cyan: '--chart-3', amber: '--chart-4', rose: '--danger', slate: '--chart-5' };
      return [...groups.entries()].sort((a, b) => b[1].value - a[1].value).map(([label, entry]) => ({ label, value: entry.value, color: toneColor[entry.tone] ?? '--chart-5', display: `${entry.value}` }));
    })();

    // Weekly creation activity
    const start = weekStart(new Date());
    start.setDate(start.getDate() - 7 * (WEEKS - 1));
    const weeks = Array.from({ length: WEEKS }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index * 7); return date; });
    const activityTask = Promise.all(activity.slice(0, 3).map(async (doctype, index) => {
      const rows = (await safe(documentApi.list<FrappeDocument>(doctype, { fields: ['name', 'creation'], filters: [['creation', '>=', `${iso(start)} 00:00:00`]], limit: 1000 }))) ?? [];
      const data = weeks.map((week) => {
        const end = new Date(week); end.setDate(end.getDate() + 7);
        return rows.filter((row) => { const created = new Date(String(row.creation).replace(' ', 'T')); return created >= week && created < end; }).length;
      });
      return { name: doctype, data, color: ['--chart-1', '--chart-2', '--chart-3'][index] };
    }));

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

    const [kpiValues, countValues, mix, series, recentRows] = await Promise.all([kpiTask, countTask, statusTask, activityTask, recentTask]);
    if (id !== run) return;
    kpis.value = kpiValues;
    counts.value = Object.fromEntries(countValues);
    statusMix.value = mix;
    statusDoctype.value = primary ?? '';
    activityLabels.value = weeks.map((week) => week.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    activitySeries.value = series;
    recent.value = recentRows.flat().sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 7);
    loading.value = false;
  }

  watch(module, (current) => { if (current) void load(current); }, { immediate: true });
  return { loading, kpis, statusMix, statusDoctype, activityLabels, activitySeries, recent, counts };
}
