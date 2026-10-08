import type { StatusTone } from '@/types/erp';

/*
 * What each ERPNext module's Overview measures. Every figure is a live ERPNext count;
 * modules without an entry still get activity, status and recent records from their
 * navigation items.
 */
export interface DashboardKpi {
  label: string;
  doctype: string;
  /** Frappe filters ([field, operator, value]); a function is evaluated at load time. */
  filters?: unknown[][] | (() => unknown[][]);
  hint: string;
  tone: StatusTone;
}

/** One line in a module's headline trend: a sum (valueField) or a count per date bucket. */
export interface TrendSeriesConfig {
  name: string;
  doctype: string;
  /** Date or Datetime field that places a record in a bucket. */
  dateField: string;
  /** Summed per bucket; omitted = count records. */
  valueField?: string;
  filters?: unknown[][];
}

export interface DashboardTrend {
  title: string;
  note: string;
  /** day = last 30 days · week = last 12 weeks · month = last 12 months */
  bucket: 'day' | 'week' | 'month';
  /** Values are amounts in the company currency. */
  money?: boolean;
  series: TrendSeriesConfig[];
}

/** "Top N" ranking: records grouped by a field, summed (valueField) or counted. */
export interface DashboardRanking {
  title: string;
  note: string;
  doctype: string;
  groupField: string;
  /** Field holding a readable name for the group (e.g. customer_name). */
  labelField?: string;
  valueField?: string;
  filters?: unknown[][] | (() => unknown[][]);
  money?: boolean;
  /** Each row opens this DocType's record named by the group value. */
  linkDoctype?: string;
  /** Singular / plural noun for counts, e.g. ['task', 'tasks']. */
  unit?: [string, string];
}

export interface ModuleDashboard {
  kpis: DashboardKpi[];
  /** DocType whose status mix is charted and which "New" creates. */
  primary: string;
  /** DocTypes whose creation activity and latest changes are shown. */
  activity: string[];
  /** Headline trend chart at the top of the module overview. */
  trend?: DashboardTrend;
  /** Ranking shown beside the trend. */
  ranking?: DashboardRanking;
}

const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); };
const monthStart = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; };

export const moduleDashboards: Record<string, ModuleDashboard> = {
  crm: {
    trend: { title: 'Pipeline value', note: 'Opportunity amount by opportunity date, last 12 weeks', bucket: 'week', money: true, series: [{ name: 'Opportunities', doctype: 'Opportunity', dateField: 'transaction_date', valueField: 'base_opportunity_amount' }] },
    ranking: { title: 'Leads by source', note: 'Where your leads come from', doctype: 'Lead', groupField: 'utm_source', unit: ['lead', 'leads'] },
    primary: 'Lead', activity: ['Lead', 'Opportunity', 'Customer'],
    kpis: [
      { label: 'Open leads', doctype: 'Lead', filters: [['status', 'in', ['Lead', 'Open', 'Replied', 'Interested']]], hint: 'awaiting qualification', tone: 'violet' },
      { label: 'Open opportunities', doctype: 'Opportunity', filters: [['status', '=', 'Open']], hint: 'in the pipeline', tone: 'blue' },
      { label: 'Customers', doctype: 'Customer', filters: [['disabled', '=', 0]], hint: 'active accounts', tone: 'green' },
      { label: 'Contacts', doctype: 'Contact', hint: 'people on record', tone: 'cyan' },
    ],
  },
  selling: {
    trend: { title: 'Orders booked', note: 'Submitted sales orders, last 30 days', bucket: 'day', money: true, series: [{ name: 'Sales orders', doctype: 'Sales Order', dateField: 'transaction_date', valueField: 'base_grand_total', filters: [['docstatus', '=', 1]] }, { name: 'Quotations', doctype: 'Quotation', dateField: 'transaction_date', valueField: 'base_grand_total', filters: [['docstatus', '=', 1]] }] },
    ranking: { title: 'Top customers', note: 'By ordered value, last 90 days', doctype: 'Sales Order', groupField: 'customer', labelField: 'customer_name', valueField: 'base_grand_total', filters: () => [['docstatus', '=', 1], ['transaction_date', '>=', daysAgo(90)]], money: true, linkDoctype: 'Customer' },
    primary: 'Sales Order', activity: ['Quotation', 'Sales Order', 'Sales Invoice'],
    kpis: [
      { label: 'Open quotations', doctype: 'Quotation', filters: [['docstatus', '=', 1], ['status', '=', 'Open']], hint: 'sent, not yet ordered', tone: 'violet' },
      { label: 'Orders to fulfil', doctype: 'Sales Order', filters: [['docstatus', '=', 1], ['status', 'in', ['To Deliver and Bill', 'To Deliver', 'To Bill']]], hint: 'to deliver or bill', tone: 'blue' },
      { label: 'Unpaid invoices', doctype: 'Sales Invoice', filters: [['docstatus', '=', 1], ['status', 'in', ['Unpaid', 'Overdue', 'Partly Paid']]], hint: 'awaiting payment', tone: 'amber' },
      { label: 'Overdue invoices', doctype: 'Sales Invoice', filters: [['docstatus', '=', 1], ['status', '=', 'Overdue']], hint: 'past due date', tone: 'rose' },
    ],
  },
  buying: {
    trend: { title: 'Purchasing', note: 'Submitted orders and bills, last 30 days', bucket: 'day', money: true, series: [{ name: 'Purchase orders', doctype: 'Purchase Order', dateField: 'transaction_date', valueField: 'base_grand_total', filters: [['docstatus', '=', 1]] }, { name: 'Purchase invoices', doctype: 'Purchase Invoice', dateField: 'posting_date', valueField: 'base_grand_total', filters: [['docstatus', '=', 1]] }] },
    ranking: { title: 'Top suppliers', note: 'By ordered value, last 90 days', doctype: 'Purchase Order', groupField: 'supplier', labelField: 'supplier_name', valueField: 'base_grand_total', filters: () => [['docstatus', '=', 1], ['transaction_date', '>=', daysAgo(90)]], money: true, linkDoctype: 'Supplier' },
    primary: 'Purchase Order', activity: ['Material Request', 'Purchase Order', 'Purchase Invoice'],
    kpis: [
      { label: 'Pending requests', doctype: 'Material Request', filters: [['docstatus', '=', 1], ['status', 'in', ['Pending', 'Partially Ordered']]], hint: 'waiting to be ordered', tone: 'amber' },
      { label: 'Orders to receive', doctype: 'Purchase Order', filters: [['docstatus', '=', 1], ['status', 'in', ['To Receive and Bill', 'To Receive']]], hint: 'goods expected', tone: 'blue' },
      { label: 'Bills to pay', doctype: 'Purchase Invoice', filters: [['docstatus', '=', 1], ['status', 'in', ['Unpaid', 'Overdue', 'Partly Paid']]], hint: 'supplier invoices', tone: 'violet' },
      { label: 'Suppliers', doctype: 'Supplier', filters: [['disabled', '=', 0]], hint: 'active suppliers', tone: 'green' },
    ],
  },
  accounts: {
    trend: { title: 'Cash in and out', note: 'Submitted payments, last 30 days', bucket: 'day', money: true, series: [{ name: 'Received', doctype: 'Payment Entry', dateField: 'posting_date', valueField: 'base_paid_amount', filters: [['docstatus', '=', 1], ['payment_type', '=', 'Receive']] }, { name: 'Paid', doctype: 'Payment Entry', dateField: 'posting_date', valueField: 'base_paid_amount', filters: [['docstatus', '=', 1], ['payment_type', '=', 'Pay']] }] },
    ranking: { title: 'Largest balances due', note: 'Outstanding on submitted sales invoices', doctype: 'Sales Invoice', groupField: 'customer', labelField: 'customer_name', valueField: 'outstanding_amount', filters: [['docstatus', '=', 1], ['outstanding_amount', '>', 0]], money: true, linkDoctype: 'Customer' },
    primary: 'Sales Invoice', activity: ['Journal Entry', 'Payment Entry', 'Sales Invoice', 'Purchase Invoice'],
    kpis: [
      { label: 'Receivable invoices', doctype: 'Sales Invoice', filters: [['docstatus', '=', 1], ['outstanding_amount', '>', 0]], hint: 'with a balance due', tone: 'amber' },
      { label: 'Payable invoices', doctype: 'Purchase Invoice', filters: [['docstatus', '=', 1], ['outstanding_amount', '>', 0]], hint: 'with a balance to pay', tone: 'violet' },
      { label: 'Payments this month', doctype: 'Payment Entry', filters: () => [['docstatus', '=', 1], ['posting_date', '>=', monthStart()]], hint: 'submitted entries', tone: 'green' },
      { label: 'Draft journals', doctype: 'Journal Entry', filters: [['docstatus', '=', 0]], hint: 'not yet posted', tone: 'slate' },
    ],
  },
  stock: {
    trend: { title: 'Goods in and out', note: 'Submitted receipts and deliveries, last 12 weeks', bucket: 'week', series: [{ name: 'Deliveries', doctype: 'Delivery Note', dateField: 'posting_date', filters: [['docstatus', '=', 1]] }, { name: 'Receipts', doctype: 'Purchase Receipt', dateField: 'posting_date', filters: [['docstatus', '=', 1]] }] },
    ranking: { title: 'Stock value by warehouse', note: 'Current valuation of stock on hand', doctype: 'Bin', groupField: 'warehouse', valueField: 'stock_value', money: true, linkDoctype: 'Warehouse' },
    primary: 'Stock Entry', activity: ['Stock Entry', 'Delivery Note', 'Purchase Receipt'],
    kpis: [
      { label: 'Active items', doctype: 'Item', filters: [['disabled', '=', 0]], hint: 'sellable, buyable or stocked', tone: 'violet' },
      { label: 'Warehouses', doctype: 'Warehouse', filters: [['is_group', '=', 0]], hint: 'stock locations', tone: 'cyan' },
      { label: 'Entries this month', doctype: 'Stock Entry', filters: () => [['docstatus', '=', 1], ['posting_date', '>=', monthStart()]], hint: 'submitted movements', tone: 'green' },
      { label: 'Draft entries', doctype: 'Stock Entry', filters: [['docstatus', '=', 0]], hint: 'not yet submitted', tone: 'amber' },
    ],
  },
  manufacturing: {
    trend: { title: 'Production', note: 'Planned and produced quantity, last 12 weeks', bucket: 'week', series: [{ name: 'Planned', doctype: 'Work Order', dateField: 'planned_start_date', valueField: 'qty', filters: [['docstatus', '=', 1]] }, { name: 'Produced', doctype: 'Work Order', dateField: 'planned_start_date', valueField: 'produced_qty', filters: [['docstatus', '=', 1]] }] },
    ranking: { title: 'Most produced items', note: 'Work order quantity, all time', doctype: 'Work Order', groupField: 'production_item', labelField: 'item_name', valueField: 'qty', filters: [['docstatus', '=', 1]], linkDoctype: 'Item', unit: ['unit', 'units'] },
    primary: 'Work Order', activity: ['Work Order', 'Job Card', 'BOM'],
    kpis: [
      { label: 'Work orders open', doctype: 'Work Order', filters: [['docstatus', '=', 1], ['status', 'in', ['Not Started', 'In Process']]], hint: 'not started or in process', tone: 'blue' },
      { label: 'Active BOMs', doctype: 'BOM', filters: [['is_active', '=', 1], ['docstatus', '=', 1]], hint: 'in use', tone: 'violet' },
      { label: 'Job cards open', doctype: 'Job Card', filters: [['status', 'in', ['Open', 'Work In Progress']]], hint: 'on the shop floor', tone: 'amber' },
      { label: 'Workstations', doctype: 'Workstation', hint: 'production capacity', tone: 'cyan' },
    ],
  },
  projects: {
    trend: { title: 'Hours logged', note: 'Timesheet hours, last 12 weeks', bucket: 'week', series: [{ name: 'Hours', doctype: 'Timesheet', dateField: 'start_date', valueField: 'total_hours', filters: [['docstatus', '!=', 2]] }] },
    ranking: { title: 'Open tasks by project', note: 'Tasks not yet completed', doctype: 'Task', groupField: 'project', filters: [['status', 'not in', ['Completed', 'Cancelled', 'Template']]], linkDoctype: 'Project', unit: ['task', 'tasks'] },
    primary: 'Task', activity: ['Project', 'Task', 'Timesheet'],
    kpis: [
      { label: 'Open projects', doctype: 'Project', filters: [['status', '=', 'Open']], hint: 'in delivery', tone: 'violet' },
      { label: 'Open tasks', doctype: 'Task', filters: [['status', 'in', ['Open', 'Working', 'Pending Review']]], hint: 'to be done', tone: 'blue' },
      { label: 'Overdue tasks', doctype: 'Task', filters: [['status', '=', 'Overdue']], hint: 'past expected end', tone: 'rose' },
      { label: 'Draft timesheets', doctype: 'Timesheet', filters: [['docstatus', '=', 0]], hint: 'not yet submitted', tone: 'amber' },
    ],
  },
  assets: {
    trend: { title: 'Assets acquired', note: 'Purchase value, last 12 months', bucket: 'month', money: true, series: [{ name: 'Purchase value', doctype: 'Asset', dateField: 'purchase_date', valueField: 'net_purchase_amount', filters: [['docstatus', '=', 1]] }] },
    ranking: { title: 'Value by category', note: 'Purchase value of submitted assets', doctype: 'Asset', groupField: 'asset_category', valueField: 'net_purchase_amount', filters: [['docstatus', '=', 1]], money: true, linkDoctype: 'Asset Category' },
    primary: 'Asset', activity: ['Asset', 'Asset Movement', 'Asset Maintenance'],
    kpis: [
      { label: 'Assets', doctype: 'Asset', filters: [['docstatus', '=', 1]], hint: 'submitted assets', tone: 'violet' },
      { label: 'Draft assets', doctype: 'Asset', filters: [['docstatus', '=', 0]], hint: 'not yet submitted', tone: 'amber' },
      { label: 'Maintenance plans', doctype: 'Asset Maintenance', hint: 'scheduled upkeep', tone: 'cyan' },
      { label: 'Categories', doctype: 'Asset Category', hint: 'depreciation groups', tone: 'green' },
    ],
  },
  support: {
    trend: { title: 'Issues opened', note: 'New issues per week, last 12 weeks', bucket: 'week', series: [{ name: 'Issues', doctype: 'Issue', dateField: 'opening_date' }] },
    ranking: { title: 'Open issues by type', note: 'Issues awaiting a resolution', doctype: 'Issue', groupField: 'issue_type', filters: [['status', 'in', ['Open', 'Replied', 'On Hold']]], unit: ['issue', 'issues'] },
    primary: 'Issue', activity: ['Issue', 'Warranty Claim', 'Maintenance Visit'],
    kpis: [
      { label: 'Open issues', doctype: 'Issue', filters: [['status', '=', 'Open']], hint: 'awaiting a response', tone: 'rose' },
      { label: 'Replied', doctype: 'Issue', filters: [['status', '=', 'Replied']], hint: 'waiting on the customer', tone: 'blue' },
      { label: 'Warranty claims', doctype: 'Warranty Claim', filters: [['status', '=', 'Open']], hint: 'open claims', tone: 'amber' },
      { label: 'Maintenance visits', doctype: 'Maintenance Visit', hint: 'recorded visits', tone: 'cyan' },
    ],
  },
  hr: {
    trend: { title: 'New joiners', note: 'Employees by joining month, last 12 months', bucket: 'month', series: [{ name: 'Joined', doctype: 'Employee', dateField: 'date_of_joining' }] },
    ranking: { title: 'Headcount by department', note: 'Active employees', doctype: 'Employee', groupField: 'department', filters: [['status', '=', 'Active']], linkDoctype: 'Department', unit: ['employee', 'employees'] },
    primary: 'Employee', activity: ['Employee', 'Department', 'Designation'],
    kpis: [
      { label: 'Active employees', doctype: 'Employee', filters: [['status', '=', 'Active']], hint: 'on the payroll', tone: 'violet' },
      { label: 'Departments', doctype: 'Department', filters: [['is_group', '=', 0]], hint: 'teams', tone: 'cyan' },
      { label: 'Designations', doctype: 'Designation', hint: 'job titles', tone: 'blue' },
      { label: 'Left', doctype: 'Employee', filters: [['status', '=', 'Left']], hint: 'former employees', tone: 'slate' },
    ],
  },
  quality: {
    trend: { title: 'Inspections', note: 'Accepted and rejected, last 12 weeks', bucket: 'week', series: [{ name: 'Accepted', doctype: 'Quality Inspection', dateField: 'report_date', filters: [['docstatus', '=', 1], ['status', '=', 'Accepted']] }, { name: 'Rejected', doctype: 'Quality Inspection', dateField: 'report_date', filters: [['docstatus', '=', 1], ['status', '=', 'Rejected']] }] },
    ranking: { title: 'Most inspected items', note: 'Submitted inspections, all time', doctype: 'Quality Inspection', groupField: 'item_code', labelField: 'item_name', filters: [['docstatus', '=', 1]], linkDoctype: 'Item', unit: ['inspection', 'inspections'] },
    primary: 'Quality Inspection', activity: ['Quality Inspection', 'Non Conformance', 'Quality Action'],
    kpis: [
      { label: 'Inspections', doctype: 'Quality Inspection', filters: [['docstatus', '=', 1]], hint: 'submitted', tone: 'violet' },
      { label: 'Rejected', doctype: 'Quality Inspection', filters: [['docstatus', '=', 1], ['status', '=', 'Rejected']], hint: 'failed inspection', tone: 'rose' },
      { label: 'Quality goals', doctype: 'Quality Goal', hint: 'targets tracked', tone: 'green' },
      { label: 'Non conformance', doctype: 'Non Conformance', hint: 'deviations logged', tone: 'amber' },
    ],
  },
  setup: {
    trend: { title: 'New users', note: 'System users created, last 12 months', bucket: 'month', series: [{ name: 'Users', doctype: 'User', dateField: 'creation', filters: [['user_type', '=', 'System User']] }] },
    ranking: { title: 'Users by type', note: 'Enabled accounts', doctype: 'User', groupField: 'user_type', filters: [['enabled', '=', 1]], unit: ['user', 'users'] },
    primary: 'User', activity: ['User', 'Company'],
    kpis: [
      { label: 'Active users', doctype: 'User', filters: [['enabled', '=', 1], ['user_type', '=', 'System User']], hint: 'desk users', tone: 'violet' },
      { label: 'Companies', doctype: 'Company', hint: 'legal entities', tone: 'cyan' },
      { label: 'Roles', doctype: 'Role', filters: [['disabled', '=', 0]], hint: 'permission roles', tone: 'blue' },
      { label: 'Enabled currencies', doctype: 'Currency', filters: [['enabled', '=', 1]], hint: 'for transactions', tone: 'green' },
    ],
  },
};
