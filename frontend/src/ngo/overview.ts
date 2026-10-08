import { CENTRES, CHILDREN, DONORS, EXPENSES, HEADS, MONTHS, ORG, PROGRAMS, PROJECTS, RECEIPT_TREND, RECEIPTS, SPEND_TREND, TOTALS, byId, composite, donorCommitted, donorUtilised, flagOf } from './data';
import type { StatusTone, ChartSegment } from '@/types/erp';
import type { BudgetRow } from '@/components/charts/BudgetBars.vue';
import type { TrendSeries } from '@/components/charts/TrendChart.vue';

/*
 * Overview content for the NGO modules, computed from the demo dataset.
 * Same panels and components as ERPNext overviews; only the figures differ.
 */

export const lakh = (value: number) => `₹${(value / 100000).toFixed(1)} L`;
export const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const record = (doctype: string, name: string) => `/record/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;

export interface OverviewKpi { label: string; value: string; hint: string; tone: StatusTone; lead?: boolean }
export type OverviewPanel =
  | { kind: 'trend'; title: string; note: string; labels: string[]; series: TrendSeries[]; wide?: boolean }
  | { kind: 'segments'; title: string; note: string; segments: ChartSegment[] }
  | { kind: 'budget'; title: string; note: string; rows: BudgetRow[]; wide?: boolean }
  | { kind: 'progress'; title: string; note: string; rows: { label: string; detail: string; value: number; target: number; unit: string; to?: string }[]; wide?: boolean };

export interface NgoOverview { eyebrow: string; kpis: OverviewKpi[]; panels: OverviewPanel[] }

// Categorical slots in fixed order; never cycled: anything past six reads as neutral "other".
const chart = (index: number) => (index < 6 ? `--chart-${index + 1}` : '--chart-neutral');
const projectBudget = (): BudgetRow[] => PROJECTS.map((project, index) => ({ label: project.name, allocated: project.budget, used: project.used, to: record('NGO Project', project.id) }));
const fundsTrend = (): OverviewPanel => ({ kind: 'trend', title: 'Funds received and utilised', note: `${ORG.fy} to date`, labels: MONTHS, series: [{ name: 'Funds received', data: RECEIPT_TREND, color: '--chart-1' }, { name: 'Funds utilised', data: SPEND_TREND, color: '--chart-2' }] });
const outcomesPanel = (title = 'Outcomes against target'): OverviewPanel => ({
  kind: 'progress', title, note: 'Current value versus programme target', wide: true,
  rows: PROGRAMS.flatMap((programme) => programme.outcomes.map((outcome, index) => ({ label: outcome.n, detail: programme.name, value: outcome.c, target: outcome.t, unit: outcome.u, to: record('Impact Outcome', `${programme.id}-O${index + 1}`) }))).slice(0, 10),
});

export function ngoOverview(moduleId: string): NgoOverview | null {
  switch (moduleId) {
    case 'ngo-projects':
      return {
        eyebrow: `${ORG.fy} · ${TOTALS.projects} funded projects`,
        kpis: [
          { label: 'Total budget', value: lakh(TOTALS.budget), hint: `${TOTALS.projects} projects committed`, tone: 'cyan', lead: true },
          { label: 'Funds utilised', value: lakh(TOTALS.used), hint: `${pct(TOTALS.used, TOTALS.budget)}% of budget`, tone: 'amber' },
          { label: 'Available balance', value: lakh(TOTALS.available), hint: 'Received minus utilised', tone: 'green' },
          { label: 'Children reached', value: TOTALS.children.toLocaleString('en-IN'), hint: `${TOTALS.centres} centres`, tone: 'violet' },
        ],
        panels: [
          { kind: 'budget', title: 'Budget versus actual', note: 'Grey is allocated, colour is utilised', rows: projectBudget(), wide: true },
          { kind: 'segments', title: 'Utilisation by project', note: `Share of ${lakh(TOTALS.used)} spent`, segments: PROJECTS.map((project, index) => ({ label: project.name, value: project.used, color: chart(index), display: lakh(project.used) })) },
          fundsTrend(),
        ],
      };
    case 'programmes': {
      const sessions = PROGRAMS.reduce((sum, programme) => sum + programme.activities.reduce((total, activity) => total + activity.held, 0), 0);
      return {
        eyebrow: `${PROGRAMS.length} programmes across ${TOTALS.projects} projects`,
        kpis: [
          { label: 'Programmes', value: String(PROGRAMS.length), hint: `${PROGRAMS.filter((programme) => programme.status === 'Running').length} running`, tone: 'green', lead: true },
          { label: 'Children', value: PROGRAMS.reduce((sum, programme) => sum + programme.children, 0).toLocaleString('en-IN'), hint: 'across programmes', tone: 'violet' },
          { label: 'Parents & caregivers', value: PROGRAMS.reduce((sum, programme) => sum + programme.parents, 0).toLocaleString('en-IN'), hint: 'engaged', tone: 'cyan' },
          { label: 'Sessions held', value: String(sessions), hint: 'in recorded cycles', tone: 'blue' },
        ],
        panels: [
          { kind: 'budget', title: 'Programme budget versus actual', note: 'Grey is allocated, colour is utilised', rows: PROGRAMS.map((programme, index) => ({ label: programme.name, allocated: programme.budget, used: programme.used, to: record('Programme', programme.id) })), wide: true },
          outcomesPanel(),
        ],
      };
    }
    case 'beneficiaries': {
      const flags = CHILDREN.map((child) => flagOf(composite(child.rounds[child.rounds.length - 1].s)));
      const average = Math.round(CHILDREN.reduce((sum, child) => sum + child.attendance, 0) / CHILDREN.length);
      return {
        eyebrow: `${CHILDREN.length} children in the tracked cohort`,
        kpis: [
          { label: 'Children tracked', value: String(CHILDREN.length), hint: 'Udaan cohort A & B', tone: 'violet', lead: true },
          { label: 'Average attendance', value: `${average}%`, hint: 'across all sessions', tone: 'cyan' },
          { label: 'On track (Green)', value: String(flags.filter((flag) => flag === 'Green').length), hint: 'composite ≥ 70%', tone: 'green' },
          { label: 'Needs support', value: String(flags.filter((flag) => flag !== 'Green').length), hint: 'Amber or Red flag', tone: 'amber' },
        ],
        panels: [
          { kind: 'segments', title: 'Risk flags', note: 'Latest milestone round', segments: [{ label: 'Green', value: flags.filter((flag) => flag === 'Green').length, color: '--success' }, { label: 'Amber', value: flags.filter((flag) => flag === 'Amber').length, color: '--warning' }, { label: 'Red', value: flags.filter((flag) => flag === 'Red').length, color: '--danger' }].filter((segment) => segment.value).map((segment) => ({ ...segment, display: `${segment.value} children` })) },
          { kind: 'progress', title: 'Latest composite score', note: 'Lowest first — who needs attention', wide: false, rows: [...CHILDREN].map((child) => ({ child, score: composite(child.rounds[child.rounds.length - 1].s) })).sort((a, b) => a.score - b.score).slice(0, 6).map(({ child, score }) => ({ label: child.name, detail: byId(CENTRES, child.centre)?.name ?? child.centre, value: score, target: 100, unit: '%', to: record('Beneficiary', child.id) })) },
        ],
      };
    }
    case 'centres':
      return {
        eyebrow: `${CENTRES.length} centres in and around ${ORG.city}`,
        kpis: [
          { label: 'Centres', value: String(CENTRES.length), hint: `${CENTRES.filter((centre) => centre.area === 'Rural').length} rural`, tone: 'cyan', lead: true },
          { label: 'Children enrolled', value: String(CENTRES.reduce((sum, centre) => sum + centre.children, 0)), hint: 'across centres', tone: 'violet' },
          { label: 'Programmes', value: String(PROGRAMS.length), hint: 'delivered at centres', tone: 'green' },
          { label: 'Social Change Agents', value: String(new Set(CENTRES.map((centre) => centre.sca)).size), hint: 'leading centres', tone: 'blue' },
        ],
        panels: [{ kind: 'segments', title: 'Children by centre', note: 'Currently enrolled', segments: CENTRES.map((centre, index) => ({ label: centre.name, value: centre.children, color: chart(index), display: `${centre.children} children` })) }],
      };
    case 'donors':
      return {
        eyebrow: `${DONORS.length} funders · ${ORG.fy}`,
        kpis: [
          { label: 'Committed', value: lakh(DONORS.reduce((sum, donor) => sum + donorCommitted(donor), 0)), hint: `${DONORS.length} donors`, tone: 'green', lead: true },
          { label: 'Received', value: lakh(TOTALS.received), hint: `${pct(TOTALS.received, TOTALS.budget)}% of commitments`, tone: 'cyan' },
          { label: 'Utilised', value: lakh(TOTALS.used), hint: `${pct(TOTALS.used, TOTALS.received)}% of receipts`, tone: 'amber' },
          { label: '80G receipts', value: String(RECEIPTS.length), hint: 'issued this year', tone: 'violet' },
        ],
        panels: [
          { kind: 'budget', title: 'Received versus utilised by donor', note: 'Grey is received, colour is the donor’s share utilised', rows: DONORS.map((donor, index) => ({ label: donor.name, allocated: donor.received, used: Math.round(donorUtilised(donor)), to: record('Donor', donor.id) })), wide: true },
          fundsTrend(),
        ],
      };
    case 'expenses': {
      const byHead = HEADS.map((head, index) => ({ head, index, used: EXPENSES.filter((expense) => expense.h === head.id).reduce((sum, expense) => sum + expense.amt, 0), allocated: PROJECTS.reduce((sum, project) => sum + (project.heads.find((entry) => entry.h === head.id)?.a ?? 0), 0) }));
      return {
        eyebrow: `${EXPENSES.length} vouchers · ${ORG.fy}`,
        kpis: [
          { label: 'Spent to date', value: lakh(TOTALS.used), hint: `${EXPENSES.length} vouchers`, tone: 'amber', lead: true },
          { label: 'Largest head', value: [...byHead].sort((a, b) => b.used - a.used)[0].head.name, hint: lakh([...byHead].sort((a, b) => b.used - a.used)[0].used), tone: 'violet' },
          { label: 'This month', value: lakh(SPEND_TREND[SPEND_TREND.length - 1]), hint: MONTHS[MONTHS.length - 1], tone: 'cyan' },
          { label: 'Budget left', value: lakh(TOTALS.budget - TOTALS.used), hint: `${100 - pct(TOTALS.used, TOTALS.budget)}% unspent`, tone: 'green' },
        ],
        panels: [
          { kind: 'budget', title: 'Spend by budget head', note: 'Grey is allocated, colour is utilised', rows: byHead.map((entry) => ({ label: entry.head.name, allocated: entry.allocated, used: entry.used, to: record('NGO Budget Head', entry.head.id) })), wide: true },
          { kind: 'trend', title: 'Monthly spend', note: ORG.fy, labels: MONTHS, series: [{ name: 'Utilised', data: SPEND_TREND, color: '--chart-2' }] },
        ],
      };
    }
    case 'impact': {
      const outcomes = PROGRAMS.flatMap((programme) => programme.outcomes);
      const achieved = outcomes.filter((outcome) => outcome.c >= outcome.t).length;
      return {
        eyebrow: `${outcomes.length} outcome indicators`,
        kpis: [
          { label: 'Indicators', value: String(outcomes.length), hint: `${PROGRAMS.length} programmes`, tone: 'cyan', lead: true },
          { label: 'Targets met', value: String(achieved), hint: `${pct(achieved, outcomes.length)}% of indicators`, tone: 'green' },
          { label: 'Children reached', value: TOTALS.children.toLocaleString('en-IN'), hint: 'across projects', tone: 'violet' },
          { label: 'Assessments', value: String(CHILDREN.reduce((sum, child) => sum + child.rounds.length, 0)), hint: 'milestone rounds recorded', tone: 'blue' },
        ],
        panels: [outcomesPanel('All outcome indicators')],
      };
    }
    default:
      return null;
  }
}
