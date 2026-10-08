/*
 * NGO demo dataset — SpacECE India Foundation (from the "NGO Impact Console" prototype).
 * Figures are illustrative. Locations, programme names, staff roles and vocabulary
 * follow spacece.in; financial and beneficiary figures do not.
 *
 * This is static, read-only data served through the regular document services
 * (see services/static-data.ts) until the NGO app's DocTypes exist in ERPNext.
 */

export const ORG = { name: 'SpacECE India Foundation', fy: 'FY 2026–27', city: 'Pune, Maharashtra', currency: 'INR' };

export interface Donor { id: string; name: string; type: string; contact: string; since: string; received: number; funding: { p: string; amt: number }[] }
export interface BudgetHead { id: string; name: string; color: string }
export interface Project { id: string; name: string; donor: string; status: string; start: string; end: string; lead: string; budget: number; used: number; children: number; centres: number; programs: string[]; purpose: string; heads: { h: string; a: number; u: number }[] }
export interface Programme { id: string; name: string; project: string; status: string; budget: number; used: number; children: number; parents: number; centres: string[]; cadence: string; ages: string; sca: string; about: string; activities: { w: string; mod: string; centres: number; held: number; att: string }[]; outcomes: { n: string; b: number; c: number; t: number; u: string }[] }
export interface Centre { id: string; name: string; area: string; city: string; sca: string; children: number }
export interface Child { id: string; name: string; guardian: string; centre: string; cohort: string; dob: string; attendance: number; program: string; enrolled: string; rounds: { m: string; s: number[] }[] }
export interface Expense { id: string; d: string; sort: number; p: string; g: string; h: string; amt: number; note: string; vendor: string }
export interface Receipt { id: string; d: string; donor: string; amt: number; mode: string; g80: string }

export const DONORS: Donor[] = [
  { id: 'DNR-001', name: 'ABC Foundation', type: 'Corporate CSR', contact: 'Meera Iyer', since: 'Apr 2024', received: 3150000, funding: [{ p: 'PRJ-001', amt: 4200000 }] },
  { id: 'DNR-002', name: 'Kirloskar Community Trust', type: 'Corporate CSR', contact: 'R. Sathe', since: 'Jul 2024', received: 1900000, funding: [{ p: 'PRJ-002', amt: 2500000 }] },
  { id: 'DNR-003', name: 'Sahyadri Foundation', type: 'Institutional', contact: 'Dr. A. Kulkarni', since: 'Jan 2025', received: 1350000, funding: [{ p: 'PRJ-003', amt: 1800000 }] },
  { id: 'DNR-004', name: 'Deccan Pharma CSR', type: 'Corporate CSR', contact: 'N. Bhalla', since: 'Apr 2026', received: 600000, funding: [{ p: 'PRJ-004', amt: 1200000 }] },
  { id: 'DNR-005', name: 'Individual Givers Pool', type: 'HNI & Retail', contact: '—', since: 'Ongoing', received: 240000, funding: [{ p: 'PRJ-004', amt: 240000 }] },
];

export const HEADS: BudgetHead[] = [
  { id: 'BH-1', name: 'Programme Personnel', color: '--chart-1' },
  { id: 'BH-2', name: 'Learning Materials & Kits', color: '--chart-4' },
  { id: 'BH-3', name: 'Training & Capacity Building', color: '--chart-3' },
  { id: 'BH-4', name: 'Travel & Field Costs', color: '--chart-2' },
  { id: 'BH-5', name: 'Community & Parent Events', color: '--chart-5' },
  { id: 'BH-6', name: 'M&E and Administration', color: '--chart-6' },
];

export const PROJECTS: Project[] = [
  { id: 'PRJ-001', name: 'Project Udaan', donor: 'DNR-001', status: 'Active', start: '01 Apr 2026', end: '31 Mar 2027', lead: 'Aparna Chaudhari', budget: 4200000, used: 2864500, children: 168, centres: 4, programs: ['PGM-001', 'PGM-002'],
    purpose: 'Parent–toddler early stimulation across four Pune communities, with a parallel parent capacity-building track.',
    heads: [{ h: 'BH-1', a: 1680000, u: 1210000 }, { h: 'BH-2', a: 840000, u: 632500 }, { h: 'BH-3', a: 504000, u: 345000 }, { h: 'BH-4', a: 420000, u: 288000 }, { h: 'BH-5', a: 336000, u: 214000 }, { h: 'BH-6', a: 420000, u: 175000 }] },
  { id: 'PRJ-002', name: 'Project HAALS', donor: 'DNR-002', status: 'Active', start: '01 Jul 2025', end: '30 Jun 2027', lead: 'Sachin Mohite', budget: 2500000, used: 1620000, children: 640, centres: 4, programs: ['PGM-003', 'PGM-004'],
    purpose: 'Home as a Learning SPACE — turning the home environment into a learning space for children aged 0–8.',
    heads: [{ h: 'BH-1', a: 1050000, u: 712000 }, { h: 'BH-2', a: 525000, u: 368000 }, { h: 'BH-3', a: 300000, u: 196000 }, { h: 'BH-4', a: 325000, u: 214000 }, { h: 'BH-5', a: 150000, u: 84000 }, { h: 'BH-6', a: 150000, u: 46000 }] },
  { id: 'PRJ-003', name: 'Project Saksham 2.0', donor: 'DNR-003', status: 'Active', start: '01 Jan 2026', end: '31 Dec 2026', lead: 'Aparna Chaudhari', budget: 1800000, used: 1145000, children: 312, centres: 3, programs: ['PGM-005', 'PGM-006'],
    purpose: 'Foundational literacy and numeracy observation, remedial support and reading-library monitoring.',
    heads: [{ h: 'BH-1', a: 756000, u: 498000 }, { h: 'BH-2', a: 396000, u: 262000 }, { h: 'BH-3', a: 252000, u: 158000 }, { h: 'BH-4', a: 216000, u: 141000 }, { h: 'BH-5', a: 90000, u: 52000 }, { h: 'BH-6', a: 90000, u: 34000 }] },
  { id: 'PRJ-004', name: 'Project Smart Start', donor: 'DNR-004', status: 'Starting', start: '01 Aug 2026', end: '31 Jul 2027', lead: 'Sachin Mohite', budget: 1440000, used: 480000, children: 128, centres: 2, programs: ['PGM-007'],
    purpose: 'School-readiness bridge for children transitioning from Anganwadi to early-grade classrooms.',
    heads: [{ h: 'BH-1', a: 576000, u: 210000 }, { h: 'BH-2', a: 302000, u: 118000 }, { h: 'BH-3', a: 216000, u: 74000 }, { h: 'BH-4', a: 158000, u: 48000 }, { h: 'BH-5', a: 110000, u: 22000 }, { h: 'BH-6', a: 78000, u: 8000 }] },
];

export const PROGRAMS: Programme[] = [
  { id: 'PGM-001', name: 'Udaan – Parent Toddler Program', project: 'PRJ-001', status: 'Running', budget: 2940000, used: 2010000, children: 168, parents: 402, centres: ['CTR-01', 'CTR-02', 'CTR-03', 'CTR-04'], cadence: 'Weekly, 45 min', ages: '12–36 months', sca: 'Asha Kale (lead)',
    about: 'Weekly guided play sessions where a parent and toddler attend together. The Social Change Agent runs the curriculum module for the week and records attendance and observations.',
    activities: [{ w: 'Week 21', mod: 'Sensory Play', centres: 4, held: 4, att: '91%' }, { w: 'Week 22', mod: 'Early Sounds', centres: 4, held: 4, att: '88%' }, { w: 'Week 23', mod: 'Grasp and Release', centres: 4, held: 3, att: '84%' }, { w: 'Week 24', mod: 'Name and Point', centres: 4, held: 4, att: '93%' }, { w: 'Week 25', mod: 'Move and Balance', centres: 4, held: 4, att: '89%' }, { w: 'Week 26', mod: 'Turn Taking', centres: 4, held: 4, att: '90%' }],
    outcomes: [{ n: 'Children meeting age-appropriate milestones', b: 41, c: 68, t: 75, u: '%' }, { n: 'Average session attendance', b: 62, c: 89, t: 85, u: '%' }, { n: 'Parents attending the monthly workshop', b: 28, c: 61, t: 70, u: '%' }, { n: 'At-risk flags closed within 30 days', b: 0, c: 74, t: 80, u: '%' }] },
  { id: 'PGM-002', name: 'Udaan – Parent Capacity Building', project: 'PRJ-001', status: 'Running', budget: 1260000, used: 854500, children: 0, parents: 402, centres: ['CTR-01', 'CTR-02'], cadence: 'Monthly workshop', ages: 'Parents & caregivers', sca: 'Vinod More',
    about: 'Monthly parenting workshops and home-visit coaching, so the weekly session carries on between visits.',
    activities: [{ w: 'Jun 2026', mod: 'Talking with your toddler', centres: 4, held: 4, att: '58%' }, { w: 'Jul 2026', mod: 'Play without toys', centres: 4, held: 4, att: '63%' }, { w: 'Aug 2026', mod: 'Routines and sleep', centres: 4, held: 4, att: '61%' }],
    outcomes: [{ n: 'Caregivers demonstrating 3+ stimulation practices', b: 19, c: 54, t: 60, u: '%' }, { n: 'Home visits completed against plan', b: 0, c: 82, t: 90, u: '%' }] },
  { id: 'PGM-003', name: 'HAALS Early Stimulation', project: 'PRJ-002', status: 'Running', budget: 1750000, used: 1150000, children: 480, parents: 445, centres: ['CTR-01', 'CTR-02', 'CTR-03'], cadence: 'Fortnightly home visit', ages: '0–8 years', sca: 'Sunita Jadhav',
    about: 'Home-based early stimulation delivered through fortnightly visits, aligned with the ICDS Anganwadi calendar.',
    activities: [{ w: 'Aug W1', mod: 'Home learning corner', centres: 9, held: 9, att: '—' }, { w: 'Aug W3', mod: 'Story and song routine', centres: 9, held: 8, att: '—' }, { w: 'Sep W1', mod: 'Everyday maths talk', centres: 9, held: 9, att: '—' }],
    outcomes: [{ n: 'Homes with an active learning corner', b: 12, c: 57, t: 65, u: '%' }, { n: 'Children screened this quarter', b: 0, c: 480, t: 520, u: '' }] },
  { id: 'PGM-004', name: 'HAALS on Wheels', project: 'PRJ-002', status: 'Running', budget: 750000, used: 470000, children: 160, parents: 151, centres: ['CTR-03', 'CTR-04'], cadence: 'Bus route, 3 days/week', ages: '3–8 years', sca: 'Prakash Sawant',
    about: 'A bus converted into a mobile learning space, reaching rural settlements without a functioning Anganwadi.',
    activities: [{ w: 'Route R1', mod: 'Khed Shivapur circuit', centres: 5, held: 5, att: '86%' }, { w: 'Route R2', mod: 'Shriram Nagar circuit', centres: 4, held: 4, att: '81%' }],
    outcomes: [{ n: 'Settlements covered per month', b: 4, c: 9, t: 12, u: '' }, { n: 'Average children per stop', b: 11, c: 18, t: 20, u: '' }] },
  { id: 'PGM-005', name: 'Saksham FLN Remediation', project: 'PRJ-003', status: 'Running', budget: 1260000, used: 812000, children: 240, parents: 0, centres: ['CTR-02', 'CTR-03'], cadence: 'Twice weekly', ages: 'Grades 1–3', sca: 'Asha Kale',
    about: 'Foundational literacy and numeracy observation followed by small-group remedial sessions.',
    activities: [{ w: 'Cycle 3', mod: 'FLN baseline observation', centres: 6, held: 6, att: '94%' }, { w: 'Cycle 4', mod: 'Remedial group A', centres: 6, held: 6, att: '87%' }, { w: 'Cycle 5', mod: 'Remedial group B', centres: 6, held: 5, att: '85%' }],
    outcomes: [{ n: 'Children reading at grade level', b: 34, c: 59, t: 70, u: '%' }, { n: 'Children at numeracy grade level', b: 29, c: 52, t: 65, u: '%' }] },
  { id: 'PGM-006', name: 'Saksham Library & Reading', project: 'PRJ-003', status: 'Running', budget: 540000, used: 333000, children: 72, parents: 0, centres: ['CTR-01'], cadence: 'Daily issue/return', ages: 'Grades 1–5', sca: 'Vinod More',
    about: 'A monitored reading library with issue and return tracking at each centre.',
    activities: [{ w: 'Aug 2026', mod: 'Library issue cycle', centres: 6, held: 6, att: '—' }, { w: 'Sep 2026', mod: 'Reading circle', centres: 6, held: 4, att: '78%' }],
    outcomes: [{ n: 'Books issued per child per month', b: 0.4, c: 2.1, t: 3, u: '' }, { n: 'Titles in circulation', b: 180, c: 412, t: 500, u: '' }] },
  { id: 'PGM-007', name: 'Smart Start School Readiness', project: 'PRJ-004', status: 'Starting', budget: 1440000, used: 480000, children: 128, parents: 120, centres: ['CTR-01', 'CTR-04'], cadence: 'Thrice weekly', ages: '5–6 years', sca: 'Sunita Jadhav',
    about: 'A bridge programme for the Anganwadi-to-school transition, run in the two months before admission.',
    activities: [{ w: 'Batch 1', mod: 'Classroom routines', centres: 3, held: 3, att: '92%' }, { w: 'Batch 1', mod: 'Pre-writing skills', centres: 3, held: 3, att: '88%' }],
    outcomes: [{ n: 'Children assessed school-ready', b: 0, c: 38, t: 80, u: '%' }, { n: 'Admissions completed on time', b: 0, c: 64, t: 95, u: '%' }] },
];

export const CENTRES: Centre[] = [
  { id: 'CTR-01', name: 'Gosavi Vasti Anganwadi', area: 'Urban settlement', city: 'Pune', sca: 'Asha Kale', children: 62 },
  { id: 'CTR-02', name: 'Karve Nagar Learning Centre', area: 'Urban', city: 'Pune', sca: 'Vinod More', children: 48 },
  { id: 'CTR-03', name: 'Shriram Nagar Anganwadi', area: 'Rural', city: 'Pune district', sca: 'Sunita Jadhav', children: 34 },
  { id: 'CTR-04', name: 'Khed Shivapur Anganwadi', area: 'Rural', city: 'Pune district', sca: 'Prakash Sawant', children: 24 },
];

export const DOMAINS = ['Physical & Motor', 'Language & Literacy', 'Cognitive', 'Socio-Emotional', 'Aesthetic & Cultural'];

const child = (id: string, name: string, guardian: string, centre: string, cohort: string, dob: string, attendance: number, rounds: Child['rounds']): Child =>
  ({ id, name, guardian, centre, cohort, dob, attendance, program: 'PGM-001', enrolled: '15 Apr 2026', rounds });

export const CHILDREN: Child[] = [
  child('SPC-CH-0001', 'Aarav Pawar', 'Sunita Pawar', 'CTR-01', 'Cohort A', '12 Mar 2024', 94, [{ m: 'Jun 2026', s: [3, 2, 3, 3, 2] }, { m: 'Jul 2026', s: [4, 3, 3, 4, 3] }, { m: 'Aug 2026', s: [4, 4, 4, 4, 4] }]),
  child('SPC-CH-0002', 'Isha Shinde', 'Ramesh Shinde', 'CTR-01', 'Cohort B', '02 Jun 2024', 88, [{ m: 'Jun 2026', s: [2, 2, 2, 3, 2] }, { m: 'Jul 2026', s: [3, 2, 3, 3, 3] }, { m: 'Aug 2026', s: [3, 3, 3, 4, 3] }]),
  child('SPC-CH-0003', 'Kabir Gaikwad', 'Kavita Gaikwad', 'CTR-02', 'Cohort A', '19 Jan 2024', 71, [{ m: 'Jun 2026', s: [2, 1, 2, 2, 2] }, { m: 'Jul 2026', s: [2, 2, 2, 2, 2] }, { m: 'Aug 2026', s: [2, 2, 2, 3, 2] }]),
  child('SPC-CH-0004', 'Myra Chavan', 'Prakash Chavan', 'CTR-02', 'Cohort B', '28 Aug 2024', 96, [{ m: 'Jun 2026', s: [4, 3, 4, 4, 3] }, { m: 'Jul 2026', s: [4, 4, 4, 5, 4] }, { m: 'Aug 2026', s: [5, 4, 5, 5, 4] }]),
  child('SPC-CH-0005', 'Vivaan Patil', 'Sunita Patil', 'CTR-03', 'Cohort A', '07 Nov 2023', 83, [{ m: 'Jun 2026', s: [3, 3, 3, 3, 3] }, { m: 'Jul 2026', s: [3, 3, 4, 3, 3] }, { m: 'Aug 2026', s: [4, 3, 4, 4, 3] }]),
  child('SPC-CH-0006', 'Anaya Sawant', 'Ramesh Sawant', 'CTR-03', 'Cohort B', '23 Apr 2024', 64, [{ m: 'Jun 2026', s: [2, 1, 2, 2, 1] }, { m: 'Jul 2026', s: [2, 2, 2, 2, 2] }, { m: 'Aug 2026', s: [2, 2, 3, 2, 2] }]),
  child('SPC-CH-0007', 'Reyansh Bhosale', 'Kavita Bhosale', 'CTR-04', 'Cohort A', '15 Feb 2024', 90, [{ m: 'Jun 2026', s: [3, 3, 3, 4, 3] }, { m: 'Jul 2026', s: [4, 3, 4, 4, 4] }, { m: 'Aug 2026', s: [4, 4, 4, 5, 4] }]),
  child('SPC-CH-0008', 'Saanvi Kadam', 'Prakash Kadam', 'CTR-04', 'Cohort B', '30 Sep 2024', 78, [{ m: 'Jun 2026', s: [2, 2, 3, 3, 2] }, { m: 'Jul 2026', s: [3, 3, 3, 3, 3] }, { m: 'Aug 2026', s: [3, 3, 4, 3, 3] }]),
  child('SPC-CH-0009', 'Arjun Jadhav', 'Sunita Jadhav', 'CTR-01', 'Cohort A', '11 Jul 2024', 92, [{ m: 'Jun 2026', s: [3, 3, 4, 3, 3] }, { m: 'Jul 2026', s: [4, 4, 4, 4, 3] }, { m: 'Aug 2026', s: [4, 4, 5, 4, 4] }]),
  child('SPC-CH-0010', 'Diya Nikam', 'Ramesh Nikam', 'CTR-02', 'Cohort B', '05 Dec 2023', 58, [{ m: 'Jun 2026', s: [2, 1, 2, 2, 2] }, { m: 'Jul 2026', s: [2, 1, 2, 2, 2] }, { m: 'Aug 2026', s: [2, 2, 2, 2, 2] }]),
  child('SPC-CH-0011', 'Ayaan Pawar', 'Kavita Pawar', 'CTR-03', 'Cohort A', '21 May 2024', 86, [{ m: 'Jun 2026', s: [3, 2, 3, 3, 3] }, { m: 'Jul 2026', s: [3, 3, 3, 4, 3] }, { m: 'Aug 2026', s: [4, 3, 4, 4, 3] }]),
  child('SPC-CH-0012', 'Kiara Shinde', 'Prakash Shinde', 'CTR-04', 'Cohort B', '14 Oct 2024', 97, [{ m: 'Jun 2026', s: [4, 4, 4, 4, 4] }, { m: 'Jul 2026', s: [5, 4, 4, 5, 4] }, { m: 'Aug 2026', s: [5, 5, 5, 5, 4] }]),
];

export const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
export const SPEND_TREND = [620000, 780000, 940000, 1160000, 1320000, 1289500];
export const RECEIPT_TREND = [1800000, 900000, 1240000, 1100000, 1400000, 800000];

export const RECEIPTS: Receipt[] = [
  { id: 'RCPT-2026-014', d: '12 Aug 2026', donor: 'DNR-001', amt: 1050000, mode: 'NEFT', g80: 'Issued' },
  { id: 'RCPT-2026-009', d: '04 Jun 2026', donor: 'DNR-001', amt: 1050000, mode: 'NEFT', g80: 'Issued' },
  { id: 'RCPT-2026-002', d: '18 Apr 2026', donor: 'DNR-001', amt: 1050000, mode: 'NEFT', g80: 'Issued' },
];

// ------------------------------------------------------------------ expense register
// Generated (as in the prototype) so it reconciles exactly: every voucher carries a
// project, programme and budget head, and sums to the utilised figure on all three.
const HEAD_NOTES: Record<string, string[]> = {
  'BH-1': ['Social Change Agent honoraria', 'Field team honoraria', 'Programme coordinator honoraria'],
  'BH-2': ['Play and learning kits', 'Home learning corner materials', 'Workbooks and printed material'],
  'BH-3': ['Facilitator refresher training', 'Observer training workshop', 'Curriculum orientation'],
  'BH-4': ['Field travel reimbursement', 'Vehicle fuel and maintenance', 'Local conveyance, field visits'],
  'BH-5': ['Parent workshop', 'Community mobilisation drive', 'Centre-level parents meet'],
  'BH-6': ['Monitoring visit and data audit', 'Office and administration', 'Audit and compliance fee'],
};
const HEAD_VENDOR: Record<string, string> = {
  'BH-1': 'Payroll', 'BH-2': 'Balbharati Supplies', 'BH-3': 'Azim Premji Univ.', 'BH-4': 'Reimbursement', 'BH-5': 'Community partner', 'BH-6': 'Internal',
};
const HEAD_SPLITS: Record<string, number> = { 'BH-1': 6, 'BH-2': 3, 'BH-3': 2, 'BH-4': 4, 'BH-5': 2, 'BH-6': 2 };
const EXP_DATES = ['05 Apr 2026', '08 May 2026', '09 Jun 2026', '11 Jul 2026', '13 Aug 2026', '04 Sep 2026'];

export const EXPENSES: Expense[] = (() => {
  const out: Omit<Expense, 'id'>[] = [];
  for (const project of PROJECTS) {
    const programmes = project.programs.map((id) => PROGRAMS.find((programme) => programme.id === id)!);
    // North-west-corner split of heads × programmes keeps both row and column totals exact.
    const rowRem = project.heads.map((head) => head.u);
    const colRem = programmes.map((programme) => programme.used);
    const cells: { h: string; g: string; amt: number }[] = [];
    let i = 0; let j = 0; let guard = 0;
    while (i < rowRem.length && j < colRem.length && guard++ < 400) {
      const value = Math.min(rowRem[i], colRem[j]);
      if (value > 0) cells.push({ h: project.heads[i].h, g: programmes[j].id, amt: value });
      rowRem[i] -= value; colRem[j] -= value;
      if (rowRem[i] === 0) i++; else j++;
    }
    // A project that started in August cannot have April vouchers.
    const window = EXP_DATES.slice(project.id === 'PRJ-004' ? 4 : 0);
    for (const cell of cells) {
      let parts = Math.min(HEAD_SPLITS[cell.h] || 2, window.length);
      if (cell.amt < parts * 1000) parts = 1;
      const base = Math.floor((cell.amt / parts) / 500) * 500;
      let left = cell.amt;
      const notes = HEAD_NOTES[cell.h];
      for (let n = 0; n < parts; n++) {
        const amt = n === parts - 1 ? left : base;
        left -= amt;
        const date = window[window.length - parts + n];
        out.push({ d: date, sort: EXP_DATES.indexOf(date), p: project.id, g: cell.g, h: cell.h, amt, note: `${notes[n % notes.length]} — ${date.split(' ')[1]} ${date.split(' ')[2]}`, vendor: HEAD_VENDOR[cell.h] });
      }
    }
  }
  out.sort((a, b) => a.sort - b.sort);
  return out.map((expense, index) => ({ ...expense, id: `EXP-${1000 + index + 1}` })).reverse();
})();

// ------------------------------------------------------------------ derived figures
export const byId = <T extends { id: string }>(rows: T[], id: string) => rows.find((row) => row.id === id);

export function composite(scores: number[]) {
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / (scores.length * 5)) * 1000) / 10;
}
export const flagOf = (pct: number) => (pct < 50 ? 'Red' : pct < 70 ? 'Amber' : 'Green');

/** A donor's utilised amount is their share of each project they fund — never double counted. */
export function donorUtilised(donor: Donor) {
  return donor.funding.reduce((sum, funding) => {
    const project = byId(PROJECTS, funding.p);
    return sum + (project ? project.used * (funding.amt / project.budget) : 0);
  }, 0);
}
export const donorCommitted = (donor: Donor) => donor.funding.reduce((sum, funding) => sum + funding.amt, 0);

export const TOTALS = (() => {
  const budget = PROJECTS.reduce((sum, project) => sum + project.budget, 0);
  const used = PROJECTS.reduce((sum, project) => sum + project.used, 0);
  const received = DONORS.reduce((sum, donor) => sum + donor.received, 0);
  return { budget, used, received, available: received - used, children: PROJECTS.reduce((sum, project) => sum + project.children, 0), programmes: PROGRAMS.length, projects: PROJECTS.length, centres: CENTRES.length };
})();

const MONTH_INDEX: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "01 Apr 2026" → "2026-04-01"; anything else is returned unchanged. */
export function isoDate(value: string) {
  const match = value.match(/^(\d{1,2}) (\w{3}) (\d{4})$/);
  return match ? `${match[3]}-${MONTH_INDEX[match[2]]}-${match[1].padStart(2, '0')}` : value;
}
