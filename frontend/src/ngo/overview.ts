import { CENTRES, CHILDREN, DOMAINS, DONORS, EXPENSES, FIELD_TEAM, FY_HISTORY, HEADS, MONTHS, ORG, PROGRAMS, PROJECTS, RECEIPT_TREND, RECEIPTS, SPEND_TREND, TOTALS, byId, composite, donorCommitted, donorUtilised, flagOf } from './data';
import type { StatusTone, ChartSegment } from '@/types/erp';
import type { BudgetRow } from '@/components/charts/BudgetBars.vue';
import type { TrendSeries } from '@/components/charts/TrendChart.vue';
import type { RadarSeries } from '@/components/charts/RadarChart.vue';
import type { RankRow } from '@/components/charts/RankBars.vue';

/*
 * Overview content for the NGO modules, computed from the demo dataset.
 * Same panels and components as ERPNext overviews; only the figures differ.
 */

export const lakh = (value: number) => `₹${(value / 100000).toFixed(1)} L`;
export const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const record = (doctype: string, name: string) => `/record/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;

export interface OverviewKpi { label: string; value: string; hint: string; tone: StatusTone; lead?: boolean; /** Recent values, oldest first, for the tile's trend line. */ spark?: number[] }
export type OverviewPanel =
  | { kind: 'trend'; title: string; note: string; labels: string[]; series: TrendSeries[]; wide?: boolean }
  | { kind: 'segments'; title: string; note: string; segments: ChartSegment[] }
  | { kind: 'budget'; title: string; note: string; rows: BudgetRow[]; wide?: boolean }
  | { kind: 'progress'; title: string; note: string; rows: { label: string; detail: string; value: number; target: number; unit: string; to?: string }[]; wide?: boolean }
  | { kind: 'donut'; title: string; note: string; segments: ChartSegment[]; centerLabel: string; centerValue?: string; wide?: boolean }
  | { kind: 'bars'; title: string; note: string; labels: string[]; series: TrendSeries[]; stacked?: boolean; barColors?: string[]; money?: boolean; wide?: boolean }
  | { kind: 'radar'; title: string; note: string; axes: string[]; series: RadarSeries[]; max: number; wide?: boolean }
  | { kind: 'rank'; title: string; note: string; rows: RankRow[]; wide?: boolean };

export interface NgoOverview { eyebrow: string; kpis: OverviewKpi[]; panels: OverviewPanel[] }

// Categorical slots in fixed order; never cycled: anything past six reads as neutral "other".
const chart = (index: number) => (index < 6 ? `--chart-${index + 1}` : '--chart-neutral');
const projectBudget = (): BudgetRow[] => PROJECTS.map((project, index) => ({ label: project.name, allocated: project.budget, used: project.used, to: record('NGO Project', project.id) }));
const fundsTrend = (): OverviewPanel => ({ kind: 'trend', title: 'Funds received and utilised', note: `${ORG.fy} to date`, labels: MONTHS, series: [{ name: 'Funds received', data: RECEIPT_TREND, color: '--chart-1' }, { name: 'Funds utilised', data: SPEND_TREND, color: '--chart-2' }] });
const slots = (count: number) => Array.from({ length: count }, (_, index) => chart(index));
/** "Udaan – Parent Toddler Program" → "Parent Toddler Program" (axis labels stay short). */
const shortName = (name: string) => name.split(' – ').pop()!.replace(/^Project /, '');
const cumulative = (values: number[]) => values.reduce<number[]>((out, value) => [...out, (out[out.length - 1] ?? 0) + value], []);

/** Utilised spend per budget head (each head keeps its own fixed color). */
const headSpend = () => HEADS.map((head) => ({ head, used: EXPENSES.filter((expense) => expense.h === head.id).reduce((sum, expense) => sum + expense.amt, 0) }));
const headDonut = (title: string): OverviewPanel => ({ kind: 'donut', title, note: 'Share of utilised funds', centerLabel: 'utilised', centerValue: lakh(TOTALS.used), segments: headSpend().map(({ head, used }) => ({ label: head.name, value: used, color: head.color, display: lakh(used) })) });
/** Monthly spend stacked by budget head. */
const monthlyByHead = (): OverviewPanel => ({
  kind: 'bars', title: 'Monthly spend by budget head', note: `${ORG.fy} · stacked`, labels: MONTHS, stacked: true, money: true, wide: true,
  series: HEADS.map((head) => ({ name: head.name, color: head.color, data: MONTHS.map((_, month) => EXPENSES.filter((expense) => expense.h === head.id && expense.sort === month).reduce((sum, expense) => sum + expense.amt, 0)) })),
});
/** Cohort average per development domain (1–5) in the first and latest milestone rounds. */
const domainRadar = (title = 'Development domains'): OverviewPanel => {
  const round = (index: (rounds: number) => number) => DOMAINS.map((_, domain) => Math.round((CHILDREN.reduce((sum, child) => sum + child.rounds[index(child.rounds.length)].s[domain], 0) / CHILDREN.length) * 10) / 10);
  const first = CHILDREN[0].rounds[0].m;
  const last = CHILDREN[0].rounds[CHILDREN[0].rounds.length - 1].m;
  return { kind: 'radar', title, note: `Cohort average score (1–5), ${first} vs ${last}`, axes: DOMAINS, max: 5, series: [{ name: first, values: round(() => 0), color: '--chart-2' }, { name: last, values: round((count) => count - 1), color: '--chart-1' }] };
};
const roundMonths = CHILDREN[0].rounds.map((round) => round.m);
const compositeByRound = () => roundMonths.map((_, index) => Math.round(CHILDREN.reduce((sum, child) => sum + composite(child.rounds[index].s), 0) / CHILDREN.length));

/** Children reached, FY over FY — shows the three-year growth trajectory. */
const growthPanel = (): OverviewPanel => ({
  kind: 'bars', title: 'Growth over 3 years', note: 'Children reached per financial year', labels: FY_HISTORY.map((fy) => fy.short),
  series: [{ name: 'Children reached', data: FY_HISTORY.map((fy) => fy.children), color: '--chart-1' }], barColors: slots(FY_HISTORY.length),
});
/** Funds utilised, FY over FY — same three years, money this time. */
const fundsHistoryPanel = (): OverviewPanel => ({
  kind: 'trend', title: 'Funds utilised over 3 years', note: 'Full-year actuals; current year is to date', labels: FY_HISTORY.map((fy) => fy.short),
  series: [{ name: 'Funds utilised', data: FY_HISTORY.map((fy) => fy.used), color: '--chart-2' }],
});
/** Field team (Social Change Agents) ranked by children reached this FY. */
const fieldTeamPanel = (): OverviewPanel => ({
  kind: 'rank', title: 'Field team impact', note: 'Children reached per Social Change Agent',
  rows: [...FIELD_TEAM].sort((a, b) => b.children - a.children).map((agent) => ({
    key: agent.id, label: agent.name, value: agent.children, display: `${agent.children} children`, sub: `${agent.centre} · ${agent.sessionsYtd} sessions · ★ ${agent.rating}`,
  })),
});

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
          { label: 'Funds utilised', value: lakh(TOTALS.used), hint: `${pct(TOTALS.used, TOTALS.budget)}% of budget`, tone: 'amber', spark: cumulative(SPEND_TREND) },
          { label: 'Available balance', value: lakh(TOTALS.available), hint: 'Received minus utilised', tone: 'green', spark: cumulative(RECEIPT_TREND).map((received, index) => received - cumulative(SPEND_TREND)[index]) },
          { label: 'Children reached', value: TOTALS.children.toLocaleString('en-IN'), hint: `${TOTALS.centres} centres`, tone: 'violet' },
        ],
        panels: [
          { kind: 'budget', title: 'Budget versus actual', note: 'Grey is allocated, colour is utilised', rows: projectBudget(), wide: true },
          { kind: 'donut', title: 'Utilisation by project', note: `Share of ${lakh(TOTALS.used)} spent`, centerLabel: 'spent', centerValue: lakh(TOTALS.used), segments: PROJECTS.map((project, index) => ({ label: project.name, value: project.used, color: chart(index), display: lakh(project.used) })) },
          fundsTrend(),
          { kind: 'bars', title: 'Children reached by project', note: 'Enrolled across centres', labels: PROJECTS.map((project) => shortName(project.name)), series: [{ name: 'Children', data: PROJECTS.map((project) => project.children), color: '--chart-1' }], barColors: slots(PROJECTS.length) },
          headDonut('Spend by budget head'),
          monthlyByHead(),
          growthPanel(),
          fundsHistoryPanel(),
          fieldTeamPanel(),
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
          { kind: 'bars', title: 'Reach by programme', note: 'Children and parents engaged', labels: PROGRAMS.map((programme) => shortName(programme.name)), series: [{ name: 'Children', data: PROGRAMS.map((programme) => programme.children), color: '--chart-1' }, { name: 'Parents & caregivers', data: PROGRAMS.map((programme) => programme.parents), color: '--chart-2' }], wide: true },
          { kind: 'donut', title: 'Budget share', note: 'Allocated budget by programme', centerLabel: 'budget', centerValue: lakh(PROGRAMS.reduce((sum, programme) => sum + programme.budget, 0)), segments: PROGRAMS.map((programme, index) => ({ label: shortName(programme.name), value: programme.budget, color: chart(index), display: lakh(programme.budget) })) },
          { kind: 'bars', title: 'Sessions held', note: 'Recorded delivery cycles per programme', labels: PROGRAMS.map((programme) => shortName(programme.name)), series: [{ name: 'Sessions', data: PROGRAMS.map((programme) => programme.activities.reduce((total, activity) => total + activity.held, 0)), color: '--chart-3' }], barColors: slots(PROGRAMS.length) },
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
          domainRadar(),
          { kind: 'bars', title: 'Average composite score', note: 'Cohort mean per milestone round (%)', labels: roundMonths, series: [{ name: 'Composite score', data: compositeByRound(), color: '--chart-1' }], barColors: slots(roundMonths.length) },
          { kind: 'donut', title: 'Attendance bands', note: 'Children by session attendance', centerLabel: 'children', segments: [
            { label: '90% and above', value: CHILDREN.filter((child) => child.attendance >= 90).length, color: '--severity-0' },
            { label: '75–89%', value: CHILDREN.filter((child) => child.attendance >= 75 && child.attendance < 90).length, color: '--severity-1' },
            { label: 'Below 75%', value: CHILDREN.filter((child) => child.attendance < 75).length, color: '--severity-3' },
          ].filter((segment) => segment.value).map((segment) => ({ ...segment, display: `${segment.value}` })) },
          { kind: 'donut', title: 'Risk flags', note: 'Latest milestone round', centerLabel: 'children', segments: [{ label: 'Green', value: flags.filter((flag) => flag === 'Green').length, color: '--success' }, { label: 'Amber', value: flags.filter((flag) => flag === 'Amber').length, color: '--warning' }, { label: 'Red', value: flags.filter((flag) => flag === 'Red').length, color: '--danger' }].filter((segment) => segment.value).map((segment) => ({ ...segment, display: `${segment.value} children` })) },
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
        panels: [
          { kind: 'donut', title: 'Children by centre', note: 'Currently enrolled', centerLabel: 'children', segments: CENTRES.map((centre, index) => ({ label: centre.name, value: centre.children, color: chart(index), display: `${centre.children}` })) },
          { kind: 'donut', title: 'Urban and rural reach', note: 'Children by centre setting', centerLabel: 'children', segments: ['Urban settlement', 'Urban', 'Rural'].map((area, index) => ({ label: area, value: CENTRES.filter((centre) => centre.area === area).reduce((sum, centre) => sum + centre.children, 0), color: chart(index + 2) })).filter((segment) => segment.value).map((segment) => ({ ...segment, display: `${segment.value}` })) },
          { kind: 'bars', title: 'Programmes per centre', note: 'Programmes delivered at each centre', labels: CENTRES.map((centre) => centre.name.replace(/ (Anganwadi|Learning Centre)$/, '')), series: [{ name: 'Programmes', data: CENTRES.map((centre) => PROGRAMS.filter((programme) => programme.centres.includes(centre.id)).length), color: '--chart-1' }], barColors: slots(CENTRES.length), wide: true },
        ],
      };
    case 'donors':
      return {
        eyebrow: `${DONORS.length} funders · ${ORG.fy}`,
        kpis: [
          { label: 'Committed', value: lakh(DONORS.reduce((sum, donor) => sum + donorCommitted(donor), 0)), hint: `${DONORS.length} donors`, tone: 'green', lead: true },
          { label: 'Received', value: lakh(TOTALS.received), hint: `${pct(TOTALS.received, TOTALS.budget)}% of commitments`, tone: 'cyan', spark: cumulative(RECEIPT_TREND) },
          { label: 'Utilised', value: lakh(TOTALS.used), hint: `${pct(TOTALS.used, TOTALS.received)}% of receipts`, tone: 'amber', spark: cumulative(SPEND_TREND) },
          { label: '80G receipts', value: String(RECEIPTS.length), hint: 'issued this year', tone: 'violet' },
        ],
        panels: [
          { kind: 'bars', title: 'Committed, received and utilised', note: 'Per donor, this financial year', labels: DONORS.map((donor) => donor.name.replace(/ (Foundation|Community Trust|CSR|Pool)$/, '')), money: true, wide: true, series: [
            { name: 'Committed', data: DONORS.map(donorCommitted), color: '--chart-3' },
            { name: 'Received', data: DONORS.map((donor) => donor.received), color: '--chart-1' },
            { name: 'Utilised', data: DONORS.map((donor) => Math.round(donorUtilised(donor))), color: '--chart-2' },
          ] },
          { kind: 'donut', title: 'Funding by donor', note: 'Share of commitments', centerLabel: 'committed', centerValue: lakh(DONORS.reduce((sum, donor) => sum + donorCommitted(donor), 0)), segments: DONORS.map((donor, index) => ({ label: donor.name, value: donorCommitted(donor), color: chart(index), display: lakh(donorCommitted(donor)) })) },
          { kind: 'donut', title: 'Donor mix', note: 'Commitments by donor type', centerLabel: 'donors', centerValue: String(DONORS.length), segments: [...new Set(DONORS.map((donor) => donor.type))].map((type, index) => ({ label: type, value: DONORS.filter((donor) => donor.type === type).reduce((sum, donor) => sum + donorCommitted(donor), 0), color: chart(index + 3) })).map((segment) => ({ ...segment, display: lakh(segment.value) })) },
          { kind: 'budget', title: 'Received versus utilised by donor', note: 'Grey is received, colour is the donor’s share utilised', rows: DONORS.map((donor) => ({ label: donor.name, allocated: donor.received, used: Math.round(donorUtilised(donor)), to: record('Donor', donor.id) })), wide: true },
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
          { label: 'This month', value: lakh(SPEND_TREND[SPEND_TREND.length - 1]), hint: MONTHS[MONTHS.length - 1], tone: 'cyan', spark: SPEND_TREND },
          { label: 'Budget left', value: lakh(TOTALS.budget - TOTALS.used), hint: `${100 - pct(TOTALS.used, TOTALS.budget)}% unspent`, tone: 'green' },
        ],
        panels: [
          { kind: 'budget', title: 'Spend by budget head', note: 'Grey is allocated, colour is utilised', rows: byHead.map((entry) => ({ label: entry.head.name, allocated: entry.allocated, used: entry.used, to: record('NGO Budget Head', entry.head.id) })), wide: true },
          monthlyByHead(),
          headDonut('Share by budget head'),
          { kind: 'rank', title: 'Top payees', note: 'Utilised funds by vendor', rows: [...new Set(EXPENSES.map((expense) => expense.vendor))].map((vendor) => ({ vendor, total: EXPENSES.filter((expense) => expense.vendor === vendor).reduce((sum, expense) => sum + expense.amt, 0), count: EXPENSES.filter((expense) => expense.vendor === vendor).length })).sort((a, b) => b.total - a.total).slice(0, 6).map((entry) => ({ key: entry.vendor, label: entry.vendor, value: entry.total, display: lakh(entry.total), sub: `${entry.count} vouchers` })) },
          { kind: 'trend', title: 'Monthly spend', note: ORG.fy, labels: MONTHS, series: [{ name: 'Utilised', data: SPEND_TREND, color: '--chart-2' }], wide: true },
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
        panels: [
          { kind: 'bars', title: 'Target attainment by programme', note: 'Average % of target reached across indicators', labels: PROGRAMS.map((programme) => shortName(programme.name)), series: [{ name: 'Attainment', data: PROGRAMS.map((programme) => Math.round(programme.outcomes.reduce((sum, outcome) => sum + Math.min(100, (outcome.c / (outcome.t || 1)) * 100), 0) / programme.outcomes.length)), color: '--chart-1' }], barColors: slots(PROGRAMS.length), wide: true },
          domainRadar('Child development profile'),
          { kind: 'donut', title: 'Indicator status', note: 'Against programme targets', centerLabel: 'indicators', segments: [
            { label: 'Target met', value: achieved, color: '--success', display: String(achieved) },
            { label: 'Within 10 points', value: outcomes.filter((outcome) => outcome.c < outcome.t && outcome.t - outcome.c <= outcome.t * 0.1).length, color: '--warning' },
            { label: 'Behind target', value: outcomes.filter((outcome) => outcome.c < outcome.t && outcome.t - outcome.c > outcome.t * 0.1).length, color: '--danger' },
          ].filter((segment) => segment.value).map((segment) => ({ ...segment, display: String(segment.value) })) },
          outcomesPanel('All outcome indicators'),
        ],
      };
    }
    default:
      return null;
  }
}
