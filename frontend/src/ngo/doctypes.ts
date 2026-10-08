import type { DocField, DocTypeMeta } from '@/services/metadata-api';
import type { FrappeDocument } from '@/types/erp';
import {
  CENTRES, CHILDREN, DOMAINS, DONORS, EXPENSES, HEADS, ORG, PROGRAMS, PROJECTS, RECEIPTS,
  byId, composite, donorCommitted, donorUtilised, flagOf, isoDate,
} from './data';

/*
 * NGO data expressed as Frappe DocTypes (metadata + documents), so the generic
 * list and document engine renders it exactly like ERPNext DocTypes.
 * Read-only: these stand in for the NGO app until its DocTypes exist on the site.
 */

type F = Partial<DocField> & { fieldname: string; fieldtype: string };
const f = (fieldname: string, fieldtype: string, label: string, extra: Partial<DocField> = {}): F => ({ fieldname, fieldtype, label, ...extra });
const list = { in_list_view: 1 } as const;
const filter = { in_standard_filter: 1 } as const;
const sb = (label?: string, extra: Partial<DocField> = {}): F => ({ fieldname: `sb_${(label || 'x').toLowerCase().replace(/\W+/g, '_')}_${Math.random().toString(36).slice(2, 6)}`, fieldtype: 'Section Break', label, ...extra });
const cb = (): F => ({ fieldname: `cb_${Math.random().toString(36).slice(2, 7)}`, fieldtype: 'Column Break' });
const tab = (label: string): F => ({ fieldname: `tab_${label.toLowerCase().replace(/\W+/g, '_')}`, fieldtype: 'Tab Break', label });
const currency = f('currency', 'Link', 'Currency', { options: 'Currency', hidden: 1 });
const money = (fieldname: string, label: string, extra: Partial<DocField> = {}) => f(fieldname, 'Currency', label, { options: 'currency', ...extra });

export interface StaticDocType {
  meta: DocTypeMeta;
  rows: FrappeDocument[];
}

function meta(name: string, fields: F[], extra: Partial<DocTypeMeta> = {}): DocTypeMeta {
  return {
    name, module: 'NGO', fields: fields.map((field, idx) => ({ ...field, idx } as DocField)),
    sort_field: 'name', sort_order: 'asc', ...extra,
  } as DocTypeMeta;
}

const stamp = { owner: 'ngo.demo@spacece.in', creation: '2026-09-04 10:00:00', modified: '2026-09-04 10:00:00', docstatus: 0, currency: ORG.currency };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const doc = (doctype: string, name: string, values: Record<string, unknown>): FrappeDocument => ({ ...stamp, doctype, name, ...values });
const row = (doctype: string, parentfield: string, idx: number, values: Record<string, unknown>) => ({ doctype, parentfield, idx, name: `${parentfield}-${idx}`, currency: ORG.currency, ...values });

// ------------------------------------------------------------------ child tables
const childMetas: StaticDocType[] = [
  { meta: meta('NGO Project Budget Head', [f('budget_head', 'Link', 'Budget Head', { options: 'NGO Budget Head', ...list }), money('allocated', 'Allocated', list), money('utilised', 'Utilised', list), money('balance', 'Balance', list), f('utilisation', 'Percent', 'Utilisation', list), currency], { istable: 1 }), rows: [] },
  { meta: meta('NGO Project Programme', [f('programme', 'Link', 'Programme', { options: 'Programme', ...list }), f('cadence', 'Data', 'Cadence', list), money('budget', 'Budget', list), money('utilised', 'Utilised', list), f('children', 'Int', 'Children', list), currency], { istable: 1 }), rows: [] },
  { meta: meta('Programme Centre', [f('centre', 'Link', 'Centre', { options: 'Centre', ...list })], { istable: 1 }), rows: [] },
  { meta: meta('Programme Activity Row', [f('period', 'Data', 'Period', list), f('module', 'Data', 'Curriculum Module', list), f('centres', 'Int', 'Centres', list), f('sessions_held', 'Int', 'Sessions Held', list), f('attendance', 'Data', 'Attendance', list)], { istable: 1 }), rows: [] },
  { meta: meta('Programme Outcome', [f('indicator', 'Data', 'Indicator', list), f('baseline', 'Float', 'Baseline', list), f('current', 'Float', 'Current', list), f('target', 'Float', 'Target', list), f('unit', 'Data', 'Unit', list), f('progress', 'Percent', 'Progress to Target', list)], { istable: 1 }), rows: [] },
  { meta: meta('Beneficiary Assessment Row', [f('month', 'Data', 'Round', list), ...DOMAINS.slice(0, 4).map((domain) => f(domain.toLowerCase().replace(/\W+/g, '_'), 'Int', domain, list)), f('aesthetic_cultural', 'Int', 'Aesthetic & Cultural'), f('composite', 'Percent', 'Composite', list), f('flag', 'Data', 'Flag')], { istable: 1 }), rows: [] },
  { meta: meta('Donor Funding', [f('project', 'Link', 'Project', { options: 'NGO Project', ...list }), money('amount', 'Committed', list), currency], { istable: 1 }), rows: [] },
];

// ------------------------------------------------------------------ helpers for derived values
const programmeOutcomes = (programmeId: string) => byId(PROGRAMS, programmeId)!.outcomes;
const progressOf = (outcome: { b: number; c: number; t: number }) => (outcome.t === outcome.b ? 100 : Math.max(0, Math.round(((outcome.c - outcome.b) / (outcome.t - outcome.b)) * 1000) / 10));
const outcomeStatus = (outcome: { c: number; t: number; b: number }) => (outcome.c >= outcome.t ? 'Achieved' : progressOf(outcome) >= 70 ? 'On Track' : 'Behind');
const scoreFields = ['physical_motor', 'language_literacy', 'cognitive', 'socio_emotional', 'aesthetic_cultural'];

// ------------------------------------------------------------------ parent DocTypes
const projectDocType: StaticDocType = {
  meta: meta('NGO Project', [
    f('project_name', 'Data', 'Project Name', { reqd: 1, bold: 1 }),
    f('status', 'Select', 'Status', { options: 'Active\nStarting\nCompleted', ...list, ...filter }),
    f('donor', 'Link', 'Funding Source', { options: 'Donor', ...list, ...filter }),
    cb(),
    f('project_lead', 'Data', 'Project Lead', filter),
    f('start_date', 'Date', 'Start Date'),
    f('end_date', 'Date', 'End Date', list),
    sb(),
    f('purpose', 'Small Text', 'Purpose'),
    sb('Funds'),
    money('budget', 'Budget', list), money('utilised', 'Utilised', list), cb(), money('balance', 'Balance'), f('utilisation', 'Percent', 'Utilisation', list),
    sb('Reach'),
    f('children', 'Int', 'Children Reached', list), cb(), f('centres', 'Int', 'Centres'),
    currency,
    tab('Budget'), f('budget_heads', 'Table', 'Budget Heads', { options: 'NGO Project Budget Head' }),
    tab('Programmes'), f('programmes', 'Table', 'Programmes', { options: 'NGO Project Programme' }),
  ], { title_field: 'project_name', search_fields: 'project_name,project_lead' }),
  rows: PROJECTS.map((project) => doc('NGO Project', project.id, {
    project_name: project.name, status: project.status, donor: project.donor, project_lead: project.lead,
    start_date: isoDate(project.start), end_date: isoDate(project.end), purpose: project.purpose,
    budget: project.budget, utilised: project.used, balance: project.budget - project.used, utilisation: pct(project.used, project.budget),
    children: project.children, centres: project.centres,
    budget_heads: project.heads.map((head, index) => row('NGO Project Budget Head', 'budget_heads', index + 1, { budget_head: head.h, allocated: head.a, utilised: head.u, balance: head.a - head.u, utilisation: pct(head.u, head.a) })),
    programmes: project.programs.map((id, index) => { const programme = byId(PROGRAMS, id)!; return row('NGO Project Programme', 'programmes', index + 1, { programme: id, cadence: programme.cadence, budget: programme.budget, utilised: programme.used, children: programme.children }); }),
  })),
};

const programmeDocType: StaticDocType = {
  meta: meta('Programme', [
    f('programme_name', 'Data', 'Programme Name', { reqd: 1, bold: 1 }),
    f('project', 'Link', 'Project', { options: 'NGO Project', ...list, ...filter }),
    f('status', 'Select', 'Status', { options: 'Running\nStarting\nClosed', ...list, ...filter }),
    cb(),
    f('lead_sca', 'Data', 'Social Change Agent'),
    f('cadence', 'Data', 'Cadence', list),
    f('age_group', 'Data', 'Age Group'),
    sb(), f('about', 'Small Text', 'About'),
    sb('Funds & Reach'),
    money('budget', 'Budget', list), money('utilised', 'Utilised'), f('utilisation', 'Percent', 'Utilisation', list),
    cb(), f('children', 'Int', 'Children', list), f('parents', 'Int', 'Parents & Caregivers'),
    currency,
    tab('Activities'), f('activities', 'Table', 'Activities', { options: 'Programme Activity Row' }),
    tab('Outcomes'), f('outcomes', 'Table', 'Outcomes', { options: 'Programme Outcome' }),
    tab('Centres'), f('centres', 'Table', 'Centres', { options: 'Programme Centre' }),
  ], { title_field: 'programme_name', search_fields: 'programme_name,cadence' }),
  rows: PROGRAMS.map((programme) => doc('Programme', programme.id, {
    programme_name: programme.name, project: programme.project, status: programme.status, lead_sca: programme.sca, cadence: programme.cadence, age_group: programme.ages, about: programme.about,
    budget: programme.budget, utilised: programme.used, utilisation: pct(programme.used, programme.budget), children: programme.children, parents: programme.parents,
    activities: programme.activities.map((activity, index) => row('Programme Activity Row', 'activities', index + 1, { period: activity.w, module: activity.mod, centres: activity.centres, sessions_held: activity.held, attendance: activity.att })),
    outcomes: programme.outcomes.map((outcome, index) => row('Programme Outcome', 'outcomes', index + 1, { indicator: outcome.n, baseline: outcome.b, current: outcome.c, target: outcome.t, unit: outcome.u, progress: progressOf(outcome) })),
    centres: programme.centres.map((centre, index) => row('Programme Centre', 'centres', index + 1, { centre })),
  })),
};

const activityDocType: StaticDocType = {
  meta: meta('Programme Activity', [
    f('programme', 'Link', 'Programme', { options: 'Programme', ...list, ...filter }), f('period', 'Data', 'Period', list), f('module', 'Data', 'Curriculum Module', list),
    cb(), f('centres', 'Int', 'Centres', list), f('sessions_held', 'Int', 'Sessions Held', list), f('attendance', 'Data', 'Attendance', list),
  ], { title_field: 'module', search_fields: 'module,period' }),
  rows: PROGRAMS.flatMap((programme) => programme.activities.map((activity, index) => doc('Programme Activity', `${programme.id}-A${String(index + 1).padStart(2, '0')}`, {
    programme: programme.id, period: activity.w, module: activity.mod, centres: activity.centres, sessions_held: activity.held, attendance: activity.att,
  }))),
};

const beneficiaryDocType: StaticDocType = {
  meta: meta('Beneficiary', [
    f('child_name', 'Data', 'Child Name', { reqd: 1, bold: 1 }),
    f('status', 'Select', 'Risk Flag', { options: 'Green\nAmber\nRed', ...list, ...filter, description: 'From the latest composite milestone score: below 50% is Red, below 70% Amber.' }),
    f('guardian', 'Data', 'Parent / Guardian'),
    f('date_of_birth', 'Date', 'Date of Birth'),
    cb(),
    f('centre', 'Link', 'Centre', { options: 'Centre', ...list, ...filter }),
    f('programme', 'Link', 'Programme', { options: 'Programme', ...filter }),
    f('cohort', 'Select', 'Cohort', { options: 'Cohort A\nCohort B', ...list, ...filter }),
    f('enrolled_on', 'Date', 'Enrolled On'),
    sb('Progress'),
    f('attendance', 'Percent', 'Attendance', list), cb(), f('latest_score', 'Percent', 'Latest Composite Score', list), f('latest_round', 'Data', 'Latest Round'),
    tab('Assessments'), f('assessments', 'Table', 'Milestone Assessments', { options: 'Beneficiary Assessment Row', description: 'Each domain is scored 1–5 by the Social Change Agent.' }),
  ], { title_field: 'child_name', search_fields: 'child_name,guardian' }),
  rows: CHILDREN.map((child) => {
    const latest = child.rounds[child.rounds.length - 1];
    const score = composite(latest.s);
    return doc('Beneficiary', child.id, {
      child_name: child.name, status: flagOf(score), guardian: child.guardian, date_of_birth: isoDate(child.dob), centre: child.centre, programme: child.program,
      cohort: child.cohort, enrolled_on: isoDate(child.enrolled), attendance: child.attendance, latest_score: score, latest_round: latest.m,
      assessments: child.rounds.map((round, index) => row('Beneficiary Assessment Row', 'assessments', index + 1, {
        month: round.m, ...Object.fromEntries(scoreFields.map((field, position) => [field, round.s[position]])), composite: composite(round.s), flag: flagOf(composite(round.s)),
      })),
    });
  }),
};

const assessmentDocType: StaticDocType = {
  meta: meta('Beneficiary Assessment', [
    f('beneficiary', 'Link', 'Beneficiary', { options: 'Beneficiary', ...list, ...filter }), f('round', 'Data', 'Round', list, ), f('status', 'Select', 'Flag', { options: 'Green\nAmber\nRed', ...list, ...filter }),
    cb(), f('composite', 'Percent', 'Composite Score', list), f('centre', 'Link', 'Centre', { options: 'Centre', ...filter }),
    sb('Domain Scores (1–5)'), ...scoreFields.map((field, index) => f(field, 'Int', DOMAINS[index])),
  ], { search_fields: 'beneficiary,round' }),
  rows: CHILDREN.flatMap((child) => child.rounds.map((round, index) => doc('Beneficiary Assessment', `${child.id}-R${index + 1}`, {
    beneficiary: child.id, round: round.m, status: flagOf(composite(round.s)), composite: composite(round.s), centre: child.centre,
    ...Object.fromEntries(scoreFields.map((field, position) => [field, round.s[position]])),
  }))),
};

const centreDocType: StaticDocType = {
  meta: meta('Centre', [
    f('centre_name', 'Data', 'Centre Name', { reqd: 1, bold: 1 }), f('area', 'Select', 'Area', { options: 'Urban\nUrban settlement\nRural', ...list, ...filter }), f('city', 'Data', 'City', list),
    cb(), f('sca', 'Data', 'Social Change Agent', list), f('children', 'Int', 'Children Enrolled', list),
  ], { title_field: 'centre_name', search_fields: 'centre_name,city,sca' }),
  rows: CENTRES.map((centre) => doc('Centre', centre.id, { centre_name: centre.name, area: centre.area, city: centre.city, sca: centre.sca, children: centre.children })),
};

const donorDocType: StaticDocType = {
  meta: meta('Donor', [
    f('donor_name', 'Data', 'Donor Name', { reqd: 1, bold: 1 }), f('donor_type', 'Select', 'Donor Type', { options: 'Corporate CSR\nInstitutional\nHNI & Retail', ...list, ...filter }),
    cb(), f('contact_person', 'Data', 'Contact Person'), f('donor_since', 'Data', 'Donor Since'),
    sb('Funds'), money('committed', 'Committed', list), money('received', 'Received', list), cb(), money('utilised', 'Utilised (share)', list, ), money('balance', 'Unspent Received'),
    sb('Reach'), f('children_reached', 'Int', 'Children Reached'),
    currency,
    tab('Funding'), f('funding', 'Table', 'Projects Funded', { options: 'Donor Funding' }),
  ], { title_field: 'donor_name', search_fields: 'donor_name,contact_person' }),
  rows: DONORS.map((donor) => {
    const utilised = Math.round(donorUtilised(donor));
    return doc('Donor', donor.id, {
      donor_name: donor.name, donor_type: donor.type, contact_person: donor.contact, donor_since: donor.since,
      committed: donorCommitted(donor), received: donor.received, utilised, balance: donor.received - utilised,
      children_reached: donor.funding.reduce((sum, funding) => sum + (byId(PROJECTS, funding.p)?.children ?? 0), 0),
      funding: donor.funding.map((funding, index) => row('Donor Funding', 'funding', index + 1, { project: funding.p, amount: funding.amt })),
    });
  }),
};

const contributionDocType: StaticDocType = {
  meta: meta('Contribution', [
    f('donor', 'Link', 'Donor', { options: 'Donor', ...list, ...filter }), f('posting_date', 'Date', 'Received On', list), money('amount', 'Amount', list),
    cb(), f('mode', 'Select', 'Mode', { options: 'NEFT\nCheque\nUPI\nCash', ...list, ...filter }), f('status', 'Select', '80G Receipt', { options: 'Issued\nPending', ...list }),
    currency,
  ], { search_fields: 'donor', sort_field: 'posting_date', sort_order: 'desc' }),
  rows: RECEIPTS.map((receipt) => doc('Contribution', receipt.id, { donor: receipt.donor, posting_date: isoDate(receipt.d), amount: receipt.amt, mode: receipt.mode, status: receipt.g80 })),
};

const allocationDocType: StaticDocType = {
  meta: meta('Allocation', [
    f('donor', 'Link', 'Donor', { options: 'Donor', ...list, ...filter }), f('project', 'Link', 'Project', { options: 'NGO Project', ...list, ...filter }),
    cb(), money('amount', 'Committed', list), f('share', 'Percent', 'Share of Project Budget', list), currency,
  ]),
  rows: DONORS.flatMap((donor) => donor.funding.map((funding, index) => doc('Allocation', `ALC-${donor.id.slice(4)}-${index + 1}`, {
    donor: donor.id, project: funding.p, amount: funding.amt, share: pct(funding.amt, byId(PROJECTS, funding.p)?.budget ?? 0),
  }))),
};

const expenseDocType: StaticDocType = {
  meta: meta('NGO Expense', [
    f('posting_date', 'Date', 'Date', list), f('description', 'Data', 'Description', { bold: 1, ...list }), money('amount', 'Amount', list),
    cb(), f('vendor', 'Data', 'Vendor / Payee', filter),
    sb('Attribution', { description: 'Every voucher is attributed to a project, a programme and a budget head.' }),
    f('project', 'Link', 'Project', { options: 'NGO Project', ...list, ...filter }), f('programme', 'Link', 'Programme', { options: 'Programme', ...filter }),
    cb(), f('budget_head', 'Link', 'Budget Head', { options: 'NGO Budget Head', ...list, ...filter }),
    currency,
  ], { title_field: 'description', search_fields: 'description,vendor', sort_field: 'posting_date', sort_order: 'desc' }),
  rows: EXPENSES.map((expense) => doc('NGO Expense', expense.id, {
    posting_date: isoDate(expense.d), description: expense.note, amount: expense.amt, vendor: expense.vendor, project: expense.p, programme: expense.g, budget_head: expense.h,
  })),
};

const budgetHeadDocType: StaticDocType = {
  meta: meta('NGO Budget Head', [
    f('head_name', 'Data', 'Budget Head', { reqd: 1, bold: 1 }), cb(),
    sb('Across all projects'), money('allocated', 'Allocated', list), money('utilised', 'Utilised', list), cb(), money('balance', 'Balance', list), f('utilisation', 'Percent', 'Utilisation', list), currency,
  ], { title_field: 'head_name' }),
  rows: HEADS.map((head) => {
    const allocated = PROJECTS.reduce((sum, project) => sum + (project.heads.find((entry) => entry.h === head.id)?.a ?? 0), 0);
    const utilised = PROJECTS.reduce((sum, project) => sum + (project.heads.find((entry) => entry.h === head.id)?.u ?? 0), 0);
    return doc('NGO Budget Head', head.id, { head_name: head.name, allocated, utilised, balance: allocated - utilised, utilisation: pct(utilised, allocated) });
  }),
};

const outcomeDocType: StaticDocType = {
  meta: meta('Impact Outcome', [
    f('indicator', 'Data', 'Indicator', { bold: 1, ...list }), f('status', 'Select', 'Status', { options: 'Achieved\nOn Track\nBehind', ...list, ...filter }),
    f('programme', 'Link', 'Programme', { options: 'Programme', ...list, ...filter }), f('project', 'Link', 'Project', { options: 'NGO Project', ...filter }),
    sb('Measurement'), f('baseline', 'Float', 'Baseline'), f('current', 'Float', 'Current', list), cb(), f('target', 'Float', 'Target', list), f('unit', 'Data', 'Unit'),
    f('progress', 'Percent', 'Progress to Target', { ...list, description: 'Movement from baseline toward target.' }),
  ], { title_field: 'indicator', search_fields: 'indicator' }),
  rows: PROGRAMS.flatMap((programme) => programmeOutcomes(programme.id).map((outcome, index) => doc('Impact Outcome', `${programme.id}-O${index + 1}`, {
    indicator: outcome.n, status: outcomeStatus(outcome), programme: programme.id, project: programme.project, baseline: outcome.b, current: outcome.c, target: outcome.t, unit: outcome.u, progress: progressOf(outcome),
  }))),
};

export const staticDocTypes: StaticDocType[] = [
  projectDocType, programmeDocType, activityDocType, beneficiaryDocType, assessmentDocType, centreDocType,
  donorDocType, contributionDocType, allocationDocType, expenseDocType, budgetHeadDocType, outcomeDocType, ...childMetas,
];
