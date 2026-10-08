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

export interface ModuleDashboard {
  kpis: DashboardKpi[];
  /** DocType whose status mix is charted and which "New" creates. */
  primary: string;
  /** DocTypes whose creation activity and latest changes are shown. */
  activity: string[];
}

const monthStart = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; };

export const moduleDashboards: Record<string, ModuleDashboard> = {
  crm: {
    primary: 'Lead', activity: ['Lead', 'Opportunity', 'Customer'],
    kpis: [
      { label: 'Open leads', doctype: 'Lead', filters: [['status', 'in', ['Lead', 'Open', 'Replied', 'Interested']]], hint: 'awaiting qualification', tone: 'violet' },
      { label: 'Open opportunities', doctype: 'Opportunity', filters: [['status', '=', 'Open']], hint: 'in the pipeline', tone: 'blue' },
      { label: 'Customers', doctype: 'Customer', filters: [['disabled', '=', 0]], hint: 'active accounts', tone: 'green' },
      { label: 'Contacts', doctype: 'Contact', hint: 'people on record', tone: 'cyan' },
    ],
  },
  selling: {
    primary: 'Sales Order', activity: ['Quotation', 'Sales Order', 'Sales Invoice'],
    kpis: [
      { label: 'Open quotations', doctype: 'Quotation', filters: [['docstatus', '=', 1], ['status', '=', 'Open']], hint: 'sent, not yet ordered', tone: 'violet' },
      { label: 'Orders to fulfil', doctype: 'Sales Order', filters: [['docstatus', '=', 1], ['status', 'in', ['To Deliver and Bill', 'To Deliver', 'To Bill']]], hint: 'to deliver or bill', tone: 'blue' },
      { label: 'Unpaid invoices', doctype: 'Sales Invoice', filters: [['docstatus', '=', 1], ['status', 'in', ['Unpaid', 'Overdue', 'Partly Paid']]], hint: 'awaiting payment', tone: 'amber' },
      { label: 'Overdue invoices', doctype: 'Sales Invoice', filters: [['docstatus', '=', 1], ['status', '=', 'Overdue']], hint: 'past due date', tone: 'rose' },
    ],
  },
  buying: {
    primary: 'Purchase Order', activity: ['Material Request', 'Purchase Order', 'Purchase Invoice'],
    kpis: [
      { label: 'Pending requests', doctype: 'Material Request', filters: [['docstatus', '=', 1], ['status', 'in', ['Pending', 'Partially Ordered']]], hint: 'waiting to be ordered', tone: 'amber' },
      { label: 'Orders to receive', doctype: 'Purchase Order', filters: [['docstatus', '=', 1], ['status', 'in', ['To Receive and Bill', 'To Receive']]], hint: 'goods expected', tone: 'blue' },
      { label: 'Bills to pay', doctype: 'Purchase Invoice', filters: [['docstatus', '=', 1], ['status', 'in', ['Unpaid', 'Overdue', 'Partly Paid']]], hint: 'supplier invoices', tone: 'violet' },
      { label: 'Suppliers', doctype: 'Supplier', filters: [['disabled', '=', 0]], hint: 'active suppliers', tone: 'green' },
    ],
  },
  accounts: {
    primary: 'Sales Invoice', activity: ['Journal Entry', 'Payment Entry', 'Sales Invoice', 'Purchase Invoice'],
    kpis: [
      { label: 'Receivable invoices', doctype: 'Sales Invoice', filters: [['docstatus', '=', 1], ['outstanding_amount', '>', 0]], hint: 'with a balance due', tone: 'amber' },
      { label: 'Payable invoices', doctype: 'Purchase Invoice', filters: [['docstatus', '=', 1], ['outstanding_amount', '>', 0]], hint: 'with a balance to pay', tone: 'violet' },
      { label: 'Payments this month', doctype: 'Payment Entry', filters: () => [['docstatus', '=', 1], ['posting_date', '>=', monthStart()]], hint: 'submitted entries', tone: 'green' },
      { label: 'Draft journals', doctype: 'Journal Entry', filters: [['docstatus', '=', 0]], hint: 'not yet posted', tone: 'slate' },
    ],
  },
  stock: {
    primary: 'Stock Entry', activity: ['Stock Entry', 'Delivery Note', 'Purchase Receipt'],
    kpis: [
      { label: 'Active items', doctype: 'Item', filters: [['disabled', '=', 0]], hint: 'sellable, buyable or stocked', tone: 'violet' },
      { label: 'Warehouses', doctype: 'Warehouse', filters: [['is_group', '=', 0]], hint: 'stock locations', tone: 'cyan' },
      { label: 'Entries this month', doctype: 'Stock Entry', filters: () => [['docstatus', '=', 1], ['posting_date', '>=', monthStart()]], hint: 'submitted movements', tone: 'green' },
      { label: 'Draft entries', doctype: 'Stock Entry', filters: [['docstatus', '=', 0]], hint: 'not yet submitted', tone: 'amber' },
    ],
  },
  manufacturing: {
    primary: 'Work Order', activity: ['Work Order', 'Job Card', 'BOM'],
    kpis: [
      { label: 'Work orders open', doctype: 'Work Order', filters: [['docstatus', '=', 1], ['status', 'in', ['Not Started', 'In Process']]], hint: 'not started or in process', tone: 'blue' },
      { label: 'Active BOMs', doctype: 'BOM', filters: [['is_active', '=', 1], ['docstatus', '=', 1]], hint: 'in use', tone: 'violet' },
      { label: 'Job cards open', doctype: 'Job Card', filters: [['status', 'in', ['Open', 'Work In Progress']]], hint: 'on the shop floor', tone: 'amber' },
      { label: 'Workstations', doctype: 'Workstation', hint: 'production capacity', tone: 'cyan' },
    ],
  },
  projects: {
    primary: 'Task', activity: ['Project', 'Task', 'Timesheet'],
    kpis: [
      { label: 'Open projects', doctype: 'Project', filters: [['status', '=', 'Open']], hint: 'in delivery', tone: 'violet' },
      { label: 'Open tasks', doctype: 'Task', filters: [['status', 'in', ['Open', 'Working', 'Pending Review']]], hint: 'to be done', tone: 'blue' },
      { label: 'Overdue tasks', doctype: 'Task', filters: [['status', '=', 'Overdue']], hint: 'past expected end', tone: 'rose' },
      { label: 'Draft timesheets', doctype: 'Timesheet', filters: [['docstatus', '=', 0]], hint: 'not yet submitted', tone: 'amber' },
    ],
  },
  assets: {
    primary: 'Asset', activity: ['Asset', 'Asset Movement', 'Asset Maintenance'],
    kpis: [
      { label: 'Assets', doctype: 'Asset', filters: [['docstatus', '=', 1]], hint: 'submitted assets', tone: 'violet' },
      { label: 'Draft assets', doctype: 'Asset', filters: [['docstatus', '=', 0]], hint: 'not yet submitted', tone: 'amber' },
      { label: 'Maintenance plans', doctype: 'Asset Maintenance', hint: 'scheduled upkeep', tone: 'cyan' },
      { label: 'Categories', doctype: 'Asset Category', hint: 'depreciation groups', tone: 'green' },
    ],
  },
  support: {
    primary: 'Issue', activity: ['Issue', 'Warranty Claim', 'Maintenance Visit'],
    kpis: [
      { label: 'Open issues', doctype: 'Issue', filters: [['status', '=', 'Open']], hint: 'awaiting a response', tone: 'rose' },
      { label: 'Replied', doctype: 'Issue', filters: [['status', '=', 'Replied']], hint: 'waiting on the customer', tone: 'blue' },
      { label: 'Warranty claims', doctype: 'Warranty Claim', filters: [['status', '=', 'Open']], hint: 'open claims', tone: 'amber' },
      { label: 'Maintenance visits', doctype: 'Maintenance Visit', hint: 'recorded visits', tone: 'cyan' },
    ],
  },
  hr: {
    primary: 'Employee', activity: ['Employee', 'Department', 'Designation'],
    kpis: [
      { label: 'Active employees', doctype: 'Employee', filters: [['status', '=', 'Active']], hint: 'on the payroll', tone: 'violet' },
      { label: 'Departments', doctype: 'Department', filters: [['is_group', '=', 0]], hint: 'teams', tone: 'cyan' },
      { label: 'Designations', doctype: 'Designation', hint: 'job titles', tone: 'blue' },
      { label: 'Left', doctype: 'Employee', filters: [['status', '=', 'Left']], hint: 'former employees', tone: 'slate' },
    ],
  },
  quality: {
    primary: 'Quality Inspection', activity: ['Quality Inspection', 'Non Conformance', 'Quality Action'],
    kpis: [
      { label: 'Inspections', doctype: 'Quality Inspection', filters: [['docstatus', '=', 1]], hint: 'submitted', tone: 'violet' },
      { label: 'Rejected', doctype: 'Quality Inspection', filters: [['docstatus', '=', 1], ['status', '=', 'Rejected']], hint: 'failed inspection', tone: 'rose' },
      { label: 'Quality goals', doctype: 'Quality Goal', hint: 'targets tracked', tone: 'green' },
      { label: 'Non conformance', doctype: 'Non Conformance', hint: 'deviations logged', tone: 'amber' },
    ],
  },
  setup: {
    primary: 'User', activity: ['User', 'Company'],
    kpis: [
      { label: 'Active users', doctype: 'User', filters: [['enabled', '=', 1], ['user_type', '=', 'System User']], hint: 'desk users', tone: 'violet' },
      { label: 'Companies', doctype: 'Company', hint: 'legal entities', tone: 'cyan' },
      { label: 'Roles', doctype: 'Role', filters: [['disabled', '=', 0]], hint: 'permission roles', tone: 'blue' },
      { label: 'Enabled currencies', doctype: 'Currency', filters: [['enabled', '=', 1]], hint: 'for transactions', tone: 'green' },
    ],
  },
};
