import {
  Activity, Award, BadgeCheck, Banknote, BarChart3, BookOpen, Boxes, BriefcaseBusiness, Building2, CalendarClock, ClipboardCheck,
  ClipboardList, Coins, Contact, Factory, FileSpreadsheet, FileText, FolderKanban, Gauge, GraduationCap, HandCoins, Handshake,
  HeartHandshake, Headphones, Landmark, LayoutDashboard, LineChart, ListChecks, MapPin, Megaphone, Network, PackageCheck, PackageOpen,
  PackageSearch, PiggyBank, Printer, Receipt, ReceiptText, Route, ScrollText, Settings2, ShieldCheck, ShoppingBag, ShoppingCart,
  SlidersHorizontal, Sprout, Tags, Target, Truck, UserCog, UserRound, UsersRound, Wallet, WalletCards, Warehouse, Workflow, Wrench,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import type { DocumentListConfig, NavigationItem } from '@/types/erp';

/*
 * Two-level navigation, entirely configuration-driven.
 *
 *   Level 1  modules, grouped by workspace (ERPNext, NGO, …)
 *   Level 2  that module's sections and items (DocType lists, single records, reports, pages)
 *
 * The sidebar does not care whether a module is standard ERPNext (`type: 'erpnext'`)
 * or a custom app (`type: 'custom'`): both use this same schema. Items whose DocType or
 * Report is not installed on the site are hidden at runtime, so a module appears as
 * soon as its app is installed — no code changes needed.
 */

export interface NavItemConfig {
  label: string;
  icon: Component;
  /** DocType listed by this item (route defaults to its list page). */
  doctype?: string;
  /** Open the DocType's single record instead of a list (Single DocTypes). */
  single?: boolean;
  /** ERPNext Script/Query Report name. */
  report?: string;
  /** Explicit route; otherwise derived from doctype / report. */
  route?: string;
  description?: string;
}

export interface NavSectionConfig {
  label: string;
  items: NavItemConfig[];
}

export interface NavModuleConfig {
  id: string;
  label: string;
  icon: Component;
  /** CSS custom property with the module's accent color. */
  color: string;
  type: 'erpnext' | 'custom';
  /** Level-1 grouping heading. */
  workspace: string;
  /** ERPNext module names whose reports appear on this module's Reports page. */
  reportModules?: string[];
  /** DocTypes that must exist for the module to show at all (e.g. the app's core DocType). */
  requires?: string[];
  sections: NavSectionConfig[];
}

const list = (label: string, doctype: string, icon: Component, route?: string, description?: string): NavItemConfig => ({ label, doctype, icon, route, description });
const single = (label: string, doctype: string, icon: Component): NavItemConfig => ({ label, doctype, icon, single: true });
const report = (label: string, name: string, icon: Component = FileSpreadsheet): NavItemConfig => ({ label, report: name, icon });

export const navigationModules: NavModuleConfig[] = [
  // ---------------------------------------------------------------- NGO (custom app)
  // Served from the NGO Impact Console demo data until the NGO app's DocTypes exist.
  {
    id: 'ngo-projects', label: 'Projects', icon: FolderKanban, color: '--mod-projects', type: 'custom', workspace: 'NGO', requires: ['NGO Project'],
    sections: [
      { label: 'Delivery', items: [list('Projects', 'NGO Project', BriefcaseBusiness, '/ngo/projects/list', 'Funded projects, their budgets and the children they reach.')] },
      { label: 'Funding', items: [list('Budget Heads', 'NGO Budget Head', PiggyBank, '/ngo/projects/budget-heads', 'Allocated versus utilised across every project.'), list('Allocations', 'Allocation', Network, '/ngo/projects/allocations', 'Which donor funds which project.')] },
    ],
  },
  {
    id: 'programmes', label: 'Programmes', icon: Sprout, color: '--mod-quality', type: 'custom', workspace: 'NGO', requires: ['Programme'],
    sections: [
      { label: 'Programmes', items: [list('Programmes', 'Programme', Sprout, '/ngo/programmes/list', 'Programmes delivered under each funded project.'), list('Programme Activities', 'Programme Activity', Activity, '/ngo/programmes/activities', 'Sessions held per curriculum module.')] },
      { label: 'Results', items: [list('Outcomes', 'Impact Outcome', Target, '/ngo/programmes/outcomes', 'Outcome indicators against baseline and target.')] },
    ],
  },
  {
    id: 'beneficiaries', label: 'Beneficiaries', icon: HeartHandshake, color: '--mod-crm', type: 'custom', workspace: 'NGO', requires: ['Beneficiary'],
    sections: [{ label: 'Children', items: [list('Beneficiaries', 'Beneficiary', HeartHandshake, '/ngo/beneficiaries/list', 'Enrolled children, their progress and risk flags.'), list('Assessments', 'Beneficiary Assessment', GraduationCap, '/ngo/beneficiaries/assessments', 'Monthly milestone assessments across five domains.')] }],
  },
  {
    id: 'centres', label: 'Centres', icon: MapPin, color: '--mod-assets', type: 'custom', workspace: 'NGO', requires: ['Centre'],
    sections: [{ label: 'Centres', items: [list('Centres', 'Centre', MapPin, '/ngo/centres/list', 'Anganwadis and learning centres where programmes run.')] }],
  },
  {
    id: 'donors', label: 'Donors', icon: HandCoins, color: '--mod-accounts', type: 'custom', workspace: 'NGO', requires: ['Donor'],
    sections: [{ label: 'Fundraising', items: [list('Donors', 'Donor', HandCoins, '/ngo/donors/list', 'Funders, what they committed and what has been utilised.'), list('Contributions', 'Contribution', Coins, '/ngo/donors/contributions', 'Funds received and 80G receipts.'), list('Allocations', 'Allocation', Network, '/ngo/donors/allocations', 'Which donor funds which project.')] }],
  },
  {
    id: 'expenses', label: 'Expenses', icon: Wallet, color: '--mod-support', type: 'custom', workspace: 'NGO', requires: ['NGO Expense'],
    sections: [{ label: 'Spending', items: [list('Expenses', 'NGO Expense', Wallet, '/ngo/expenses/list', 'Every voucher, attributed to a project, programme and budget head.'), list('Budget Heads', 'NGO Budget Head', PiggyBank, '/ngo/expenses/budget-heads', 'Allocated versus utilised by budget head.')] }],
  },
  {
    id: 'impact', label: 'Impact', icon: LineChart, color: '--mod-manufacturing', type: 'custom', workspace: 'NGO', requires: ['Impact Outcome'],
    sections: [{ label: 'Measurement', items: [list('Outcomes', 'Impact Outcome', Target, '/ngo/impact/outcomes', 'Outcome indicators against baseline and target.'), list('Assessments', 'Beneficiary Assessment', GraduationCap, '/ngo/impact/assessments', 'Monthly milestone assessments across five domains.')] }],
  },

  // ---------------------------------------------------------------- ERPNext
  {
    id: 'crm', label: 'CRM', icon: Handshake, color: '--mod-crm', type: 'erpnext', workspace: 'ERPNext', reportModules: ['CRM'],
    sections: [
      { label: 'Pipeline', items: [list('Leads', 'Lead', UsersRound, '/crm/leads'), list('Opportunities', 'Opportunity', Target, '/crm/opportunities'), list('Prospects', 'Prospect', Award, '/crm/prospects'), list('Campaigns', 'Campaign', Megaphone, '/crm/campaigns'), list('Appointments', 'Appointment', CalendarClock, '/crm/appointments')] },
      { label: 'Masters', items: [list('Customers', 'Customer', UserRound, '/crm/customers'), list('Contacts', 'Contact', Contact, '/crm/contacts'), list('Addresses', 'Address', MapPin, '/crm/addresses'), list('Contracts', 'Contract', ScrollText, '/crm/contracts')] },
      { label: 'Campaigns & Setup', items: [list('Email Campaigns', 'Email Campaign', FileText), list('Competitors', 'Competitor', FileText), list('Contract Templates', 'Contract Template', FileText), list('Opportunity Types', 'Opportunity Type', FileText), list('Lost Reasons', 'Opportunity Lost Reason', FileText), list('Sales Stages', 'Sales Stage', FileText), list('Market Segments', 'Market Segment', FileText), list('Industry Types', 'Industry Type', FileText), list('UTM Sources', 'UTM Source', FileText), list('Communications', 'Communication', FileText), list('Email Groups', 'Email Group', FileText), single('CRM Settings', 'CRM Settings', Settings2)] },
      { label: 'Reports', items: [report('Lead Details', 'Lead Details'), report('Sales Funnel', 'Sales Funnel', BarChart3)] },
    ],
  },
  {
    id: 'selling', label: 'Selling', icon: ShoppingCart, color: '--mod-selling', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Selling'],
    sections: [
      { label: 'Transactions', items: [list('Quotations', 'Quotation', FileText, '/selling/quotations'), list('Sales Orders', 'Sales Order', ShoppingCart, '/selling/orders'), list('Delivery Notes', 'Delivery Note', Truck, '/selling/delivery-notes'), list('Sales Invoices', 'Sales Invoice', ReceiptText, '/selling/sales-invoices'), list('Blanket Orders', 'Blanket Order', ClipboardList, '/selling/blanket-orders')] },
      { label: 'Masters', items: [list('Customers', 'Customer', UserRound, '/selling/customers'), list('Customer Groups', 'Customer Group', UsersRound, '/selling/customer-groups'), list('Sales Persons', 'Sales Person', BadgeCheck, '/selling/sales-persons'), list('Territories', 'Territory', MapPin, '/selling/territories')] },
      { label: 'Pricing', items: [list('Pricing Rules', 'Pricing Rule', Tags, '/selling/pricing-rules'), list('Promotional Schemes', 'Promotional Scheme', Megaphone, '/selling/promotional-schemes'), list('Price Lists', 'Price List', ScrollText, '/stock/price-lists')] },
      { label: 'Point of Sale', items: [list('POS Invoices', 'POS Invoice', FileText), list('POS Profiles', 'POS Profile', FileText), list('POS Opening Entries', 'POS Opening Entry', FileText), list('POS Closing Entries', 'POS Closing Entry', FileText), list('POS Merge Logs', 'POS Invoice Merge Log', FileText), single('POS Settings', 'POS Settings', Settings2)] },
      { label: 'Loyalty & Coupons', items: [list('Loyalty Programs', 'Loyalty Program', FileText), list('Loyalty Point Entries', 'Loyalty Point Entry', FileText), list('Coupon Codes', 'Coupon Code', FileText)] },
      { label: 'Selling Setup', items: [list('Product Bundles', 'Product Bundle', FileText), list('Installation Notes', 'Installation Note', FileText), list('Sales Partners', 'Sales Partner', FileText), list('Sales Partner Types', 'Sales Partner Type', FileText), list('Party Specific Items', 'Party Specific Item', FileText), list('Delivery Schedule Items', 'Delivery Schedule Item', FileText), list('Sales Tax Templates', 'Sales Taxes and Charges Template', FileText), list('Shipping Rules', 'Shipping Rule', FileText), list('Terms and Conditions', 'Terms and Conditions', FileText), list('Monthly Distribution', 'Monthly Distribution', FileText), list('Quotation Lost Reasons', 'Quotation Lost Reason', FileText)] },
      { label: 'Reports', items: [report('Sales Analytics', 'Sales Analytics', BarChart3), report('Sales Order Analysis', 'Sales Order Analysis'), report('Item-wise Sales History', 'Item-wise Sales History')] },
    ],
  },
  {
    id: 'buying', label: 'Buying', icon: ShoppingBag, color: '--mod-buying', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Buying'],
    sections: [
      { label: 'Transactions', items: [list('Material Requests', 'Material Request', ClipboardList, '/buying/material-requests'), list('Requests for Quotation', 'Request for Quotation', ScrollText, '/buying/rfq'), list('Supplier Quotations', 'Supplier Quotation', FileText, '/buying/supplier-quotations'), list('Purchase Orders', 'Purchase Order', ShoppingBag, '/buying/purchase-orders'), list('Purchase Receipts', 'Purchase Receipt', PackageCheck, '/buying/purchase-receipts'), list('Purchase Invoices', 'Purchase Invoice', Receipt, '/buying/purchase-invoices')] },
      { label: 'Masters', items: [list('Suppliers', 'Supplier', Building2, '/buying/suppliers'), list('Supplier Groups', 'Supplier Group', UsersRound, '/buying/supplier-groups')] },
      { label: 'Supplier Scorecard', items: [list('Supplier Scorecards', 'Supplier Scorecard', FileText), list('Scorecard Periods', 'Supplier Scorecard Period', FileText), list('Scorecard Criteria', 'Supplier Scorecard Criteria', FileText), list('Scorecard Standings', 'Supplier Scorecard Standing', FileText), list('Scorecard Variables', 'Supplier Scorecard Variable', FileText)] },
      { label: 'Subcontracting', items: [list('Subcontracting Orders', 'Subcontracting Order', FileText), list('Subcontracting Receipts', 'Subcontracting Receipt', FileText), list('Subcontracting BOMs', 'Subcontracting BOM', FileText), list('Inward Orders', 'Subcontracting Inward Order', FileText)] },
      { label: 'Buying Setup', items: [list('Purchase Tax Templates', 'Purchase Taxes and Charges Template', FileText), single('Buying Settings', 'Buying Settings', Settings2)] },
      { label: 'Reports', items: [report('Purchase Analytics', 'Purchase Analytics', BarChart3), report('Purchase Order Analysis', 'Purchase Order Analysis')] },
    ],
  },
  {
    id: 'accounts', label: 'Accounts', icon: Landmark, color: '--mod-accounts', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Accounts'],
    sections: [
      { label: 'Transactions', items: [list('Journal Entries', 'Journal Entry', BookOpen, '/accounts/journal-entries'), list('Payment Entries', 'Payment Entry', Banknote, '/accounts/payment-entries'), list('Sales Invoices', 'Sales Invoice', ReceiptText, '/accounting/invoices'), list('Purchase Invoices', 'Purchase Invoice', Receipt, '/accounts/purchase-invoices'), list('Payment Requests', 'Payment Request', WalletCards, '/accounts/payment-requests')] },
      { label: 'Outstanding', items: [list('Receivables', 'Sales Invoice', WalletCards, '/accounts/accounts-receivable'), list('Payables', 'Purchase Invoice', WalletCards, '/accounts/accounts-payable')] },
      { label: 'Masters', items: [list('Chart of Accounts', 'Account', Landmark, '/accounts/chart-of-accounts'), list('Cost Centers', 'Cost Center', Gauge, '/accounts/cost-centers'), list('Bank Accounts', 'Bank Account', Building2, '/accounts/bank-accounts'), list('Budgets', 'Budget', PiggyBank, '/accounts/budgets'), list('Modes of Payment', 'Mode of Payment', WalletCards, '/accounts/modes-of-payment'), list('Fiscal Years', 'Fiscal Year', CalendarClock, '/accounts/fiscal-years')] },
      { label: 'Banking', items: [list('Banks', 'Bank', FileText), list('Bank Transactions', 'Bank Transaction', FileText), list('Bank Transaction Rules', 'Bank Transaction Rule', FileText), list('Bank Guarantees', 'Bank Guarantee', FileText), list('Bank Account Balances', 'Bank Account Balance', FileText), list('Bank Account Types', 'Bank Account Type', FileText), list('Bank Account Subtypes', 'Bank Account Subtype', FileText), list('Payment Orders', 'Payment Order', FileText), list('Invoice Discounting', 'Invoice Discounting', FileText), list('Cheque Print Templates', 'Cheque Print Template', FileText), list('Cashier Closings', 'Cashier Closing', FileText), list('Dunnings', 'Dunning', FileText), list('Dunning Types', 'Dunning Type', FileText), single('Payment Reconciliation', 'Payment Reconciliation', Settings2), single('Bank Reconciliation Tool', 'Bank Reconciliation Tool', Settings2), single('Bank Clearance', 'Bank Clearance', Settings2)] },
      { label: 'Taxes', items: [list('Sales Tax Templates', 'Sales Taxes and Charges Template', FileText), list('Purchase Tax Templates', 'Purchase Taxes and Charges Template', FileText), list('Item Tax Templates', 'Item Tax Template', FileText), list('Tax Categories', 'Tax Category', FileText), list('Tax Rules', 'Tax Rule', FileText), list('Tax Withholding Categories', 'Tax Withholding Category', FileText), list('Tax Withholding Groups', 'Tax Withholding Group', FileText), list('Lower Deduction Certificates', 'Lower Deduction Certificate', FileText)] },
      { label: 'Budget & Closing', items: [list('Cost Center Allocations', 'Cost Center Allocation', FileText), list('Accounting Periods', 'Accounting Period', FileText), list('Finance Books', 'Finance Book', FileText), list('Period Closing Vouchers', 'Period Closing Voucher', FileText), list('Exchange Rate Revaluations', 'Exchange Rate Revaluation', FileText), list('Accounting Dimensions', 'Accounting Dimension', FileText)] },
      { label: 'Accounts Setup', items: [list('Account Categories', 'Account Category', FileText), list('Journal Entry Templates', 'Journal Entry Template', FileText), list('Currency Exchange', 'Currency Exchange', FileText), list('Payment Terms', 'Payment Term', FileText), list('Payment Terms Templates', 'Payment Terms Template', FileText), list('Party Links', 'Party Link', FileText), list('Statements of Accounts', 'Process Statement Of Accounts', FileText), list('GL Entries', 'GL Entry', FileText), list('Payment Ledger Entries', 'Payment Ledger Entry', FileText), single('Accounts Settings', 'Accounts Settings', Settings2)] },
      { label: 'Subscriptions', items: [list('Subscriptions', 'Subscription', FileText), list('Subscription Plans', 'Subscription Plan', FileText), single('Subscription Settings', 'Subscription Settings', Settings2)] },
      { label: 'Share Management', items: [list('Shareholders', 'Shareholder', FileText), list('Share Transfers', 'Share Transfer', FileText), list('Share Types', 'Share Type', FileText)] },
      { label: 'Reports', items: [report('General Ledger', 'General Ledger'), report('Trial Balance', 'Trial Balance'), report('Balance Sheet', 'Balance Sheet', BarChart3), report('Profit and Loss', 'Profit and Loss Statement', LineChart), report('Accounts Receivable', 'Accounts Receivable'), report('Accounts Payable', 'Accounts Payable')] },
    ],
  },
  {
    id: 'stock', label: 'Stock', icon: Boxes, color: '--mod-stock', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Stock'],
    sections: [
      { label: 'Masters', items: [list('Items', 'Item', Boxes, '/stock/items'), list('Item Groups', 'Item Group', PackageOpen, '/stock/item-groups'), list('Warehouses', 'Warehouse', Warehouse, '/stock/warehouses'), list('UOM', 'UOM', SlidersHorizontal, '/setup/uoms'), list('Brands', 'Brand', Award, '/stock/brands'), list('Serial Nos', 'Serial No', ListChecks, '/stock/serial-nos'), list('Batches', 'Batch', Boxes, '/stock/batches'), list('Item Prices', 'Item Price', Banknote, '/stock/item-prices')] },
      { label: 'Transactions', items: [list('Stock Entries', 'Stock Entry', PackageSearch, '/stock/entries'), list('Stock Reconciliation', 'Stock Reconciliation', ClipboardCheck, '/stock/reconciliation'), list('Pick Lists', 'Pick List', ListChecks, '/stock/pick-lists'), list('Packing Slips', 'Packing Slip', PackageCheck, '/stock/packing-slips'), list('Delivery Notes', 'Delivery Note', Truck, '/stock/delivery-notes'), list('Purchase Receipts', 'Purchase Receipt', PackageCheck, '/stock/purchase-receipts'), list('Landed Cost Vouchers', 'Landed Cost Voucher', Receipt, '/stock/landed-cost-vouchers')] },
      { label: 'Logistics', items: [list('Shipments', 'Shipment', FileText), list('Delivery Trips', 'Delivery Trip', FileText), list('Parcel Templates', 'Shipment Parcel Template', FileText), list('Drivers', 'Driver', FileText), list('Vehicles', 'Vehicle', FileText), list('Incoterms', 'Incoterm', FileText)] },
      { label: 'Item Setup', items: [list('Item Attributes', 'Item Attribute', FileText), list('Item Alternatives', 'Item Alternative', FileText), list('Item Manufacturers', 'Item Manufacturer', FileText), list('Manufacturers', 'Manufacturer', FileText), list('Customs Tariff Numbers', 'Customs Tariff Number', FileText), list('UOM Categories', 'UOM Category', FileText), list('UOM Conversion Factors', 'UOM Conversion Factor', FileText), list('Serial and Batch Bundles', 'Serial and Batch Bundle', FileText), list('Putaway Rules', 'Putaway Rule', FileText), list('Inventory Dimensions', 'Inventory Dimension', FileText), list('Stock Entry Types', 'Stock Entry Type', FileText), list('Warehouse Types', 'Warehouse Type', FileText), list('Repost Item Valuations', 'Repost Item Valuation', FileText)] },
      { label: 'Inspection Setup', items: [list('Inspection Templates', 'Quality Inspection Template', FileText), list('Inspection Parameters', 'Quality Inspection Parameter', FileText), list('Parameter Groups', 'Quality Inspection Parameter Group', FileText)] },
      { label: 'Stock Setup', items: [single('Stock Settings', 'Stock Settings', Settings2), single('Item Variant Settings', 'Item Variant Settings', Settings2), single('Delivery Settings', 'Delivery Settings', Settings2)] },
      { label: 'Reports', items: [list('Stock Ledger', 'Stock Ledger Entry', FileSpreadsheet, '/stock/ledger'), report('Stock Balance', 'Stock Balance'), report('Stock Analytics', 'Stock Analytics', BarChart3), report('Stock Projected Qty', 'Stock Projected Qty')] },
    ],
  },
  {
    id: 'manufacturing', label: 'Manufacturing', icon: Factory, color: '--mod-manufacturing', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Manufacturing'],
    sections: [
      { label: 'Production', items: [list('Production Plans', 'Production Plan', CalendarClock, '/manufacturing/production-plans'), list('Work Orders', 'Work Order', Factory, '/manufacturing/work-orders'), list('Job Cards', 'Job Card', ClipboardCheck, '/manufacturing/job-cards'), list('Downtime Entries', 'Downtime Entry', Activity, '/manufacturing/downtime')] },
      { label: 'Masters', items: [list('Bill of Materials', 'BOM', ListChecks, '/manufacturing/bom'), list('Workstations', 'Workstation', Wrench, '/manufacturing/workstations'), list('Operations', 'Operation', Workflow, '/manufacturing/operations'), list('Routings', 'Routing', Route, '/manufacturing/routings'), list('Plant Floors', 'Plant Floor', Building2, '/manufacturing/plant-floors')] },
      { label: 'Planning', items: [list('Master Production Schedules', 'Master Production Schedule', FileText), list('Sales Forecasts', 'Sales Forecast', FileText), list('BOM Creators', 'BOM Creator', FileText), list('Item Lead Times', 'Item Lead Time', FileText), list('Workstation Types', 'Workstation Type', FileText), list('Operating Components', 'Workstation Operating Component', FileText), single('BOM Update Tool', 'BOM Update Tool', Settings2), single('Manufacturing Settings', 'Manufacturing Settings', Settings2)] },
      { label: 'Reports', items: [report('Work Order Summary', 'Work Order Summary'), report('Production Planning', 'Production Planning Report'), report('BOM Search', 'BOM Search')] },
    ],
  },
  {
    // Labelled "Project Mgmt" to tell it apart from the NGO "Projects" module (id and routes unchanged).
    id: 'projects', label: 'Project Mgmt', icon: FolderKanban, color: '--mod-projects', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Projects'],
    sections: [
      { label: 'Projects', items: [list('Projects', 'Project', BriefcaseBusiness, '/projects/projects'), list('Tasks', 'Task', ListChecks, '/projects/tasks'), list('Timesheets', 'Timesheet', CalendarClock, '/projects/timesheets'), list('Activity Types', 'Activity Type', SlidersHorizontal, '/projects/activity-types')] },
      { label: 'Project Setup', items: [list('Project Templates', 'Project Template', FileText), list('Project Types', 'Project Type', FileText), list('Project Updates', 'Project Update', FileText), list('Activity Costs', 'Activity Cost', FileText), list('Task Types', 'Task Type', FileText), single('Projects Settings', 'Projects Settings', Settings2)] },
      { label: 'Reports', items: [report('Project Summary', 'Project Summary')] },
    ],
  },
  {
    id: 'assets', label: 'Assets', icon: Building2, color: '--mod-assets', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Assets'],
    sections: [
      { label: 'Assets', items: [list('Assets', 'Asset', Building2, '/assets/register'), list('Asset Movement', 'Asset Movement', Truck, '/assets/movement'), list('Asset Maintenance', 'Asset Maintenance', Wrench, '/assets/maintenance'), list('Asset Repairs', 'Asset Repair', Wrench, '/assets/repairs'), list('Asset Capitalization', 'Asset Capitalization', Coins, '/assets/capitalization')] },
      { label: 'Masters', items: [list('Asset Categories', 'Asset Category', PackageOpen, '/assets/categories'), list('Locations', 'Location', MapPin, '/assets/locations')] },
      { label: 'Asset Operations', items: [list('Depreciation Schedules', 'Asset Depreciation Schedule', FileText), list('Value Adjustments', 'Asset Value Adjustment', FileText), list('Maintenance Teams', 'Asset Maintenance Team', FileText), list('Maintenance Logs', 'Asset Maintenance Log', FileText), list('Asset Activities', 'Asset Activity', FileText), list('Shift Factors', 'Asset Shift Factor', FileText), list('Shift Allocations', 'Asset Shift Allocation', FileText)] },
      { label: 'Reports', items: [report('Fixed Asset Register', 'Fixed Asset Register')] },
    ],
  },
  {
    id: 'support', label: 'Support', icon: Headphones, color: '--mod-support', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Support', 'Maintenance'],
    sections: [
      { label: 'Service', items: [list('Issues', 'Issue', Headphones, '/support/issues'), list('Warranty Claims', 'Warranty Claim', ShieldCheck, '/support/warranty-claims'), list('Maintenance Schedules', 'Maintenance Schedule', CalendarClock, '/support/maintenance-schedules'), list('Maintenance Visits', 'Maintenance Visit', Wrench, '/support/maintenance-visits'), list('Service Level Agreements', 'Service Level Agreement', ScrollText, '/support/service-level-agreements')] },
      { label: 'Support Setup', items: [list('Issue Types', 'Issue Type', FileText), list('Issue Priorities', 'Issue Priority', FileText), single('Support Settings', 'Support Settings', Settings2)] },
      { label: 'Reports', items: [report('Issue Analytics', 'Issue Analytics', BarChart3)] },
    ],
  },
  {
    id: 'hr', label: 'HR', icon: UsersRound, color: '--mod-crm', type: 'erpnext', workspace: 'ERPNext', reportModules: ['HR', 'Payroll'],
    sections: [
      { label: 'People', items: [list('Employees', 'Employee', UserRound, '/setup/employees'), list('Departments', 'Department', UsersRound, '/setup/departments'), list('Designations', 'Designation', BadgeCheck, '/setup/designations'), list('Holiday Lists', 'Holiday List', CalendarClock, '/setup/holiday-lists')] },
      // HRMS DocTypes: shown automatically once the HRMS app is installed.
      { label: 'Attendance & Leave', items: [list('Attendance', 'Attendance', ClipboardCheck, '/hr/attendance'), list('Leave Applications', 'Leave Application', FileText, '/hr/leave-applications'), list('Leave Allocations', 'Leave Allocation', FileText, '/hr/leave-allocations')] },
      { label: 'Payroll', items: [list('Salary Slips', 'Salary Slip', WalletCards, '/hr/payroll'), list('Expense Claims', 'Expense Claim', Receipt, '/hr/expense-claims')] },
      { label: 'Organization', items: [list('Employee Groups', 'Employee Group', FileText), list('Branches', 'Branch', FileText)] },
    ],
  },
  {
    id: 'quality', label: 'Quality', icon: ShieldCheck, color: '--mod-quality', type: 'erpnext', workspace: 'ERPNext', reportModules: ['Quality Management'],
    sections: [
      { label: 'Quality', items: [list('Quality Inspections', 'Quality Inspection', ClipboardCheck, '/quality/inspections'), list('Quality Goals', 'Quality Goal', Target, '/quality/goals'), list('Quality Procedures', 'Quality Procedure', FileText, '/quality/procedures'), list('Quality Reviews', 'Quality Review', BadgeCheck, '/quality/reviews'), list('Quality Actions', 'Quality Action', Activity, '/quality/actions'), list('Quality Meetings', 'Quality Meeting', UsersRound, '/quality/meetings'), list('Non Conformance', 'Non Conformance', ShieldCheck, '/quality/non-conformance')] },
      { label: 'Feedback & Setup', items: [list('Quality Feedback', 'Quality Feedback', FileText), list('Feedback Templates', 'Quality Feedback Template', FileText), list('Inspection Templates', 'Quality Inspection Template', FileText)] },
      { label: 'Reports', items: [report('Inspection Summary', 'Quality Inspection Summary')] },
    ],
  },
  {
    id: 'setup', label: 'Setup', icon: Settings2, color: '--mod-setup', type: 'erpnext', workspace: 'ERPNext',
    sections: [
      { label: 'Organization', items: [list('Company', 'Company', Building2, '/settings/company'), list('Users', 'User', UserCog, '/settings/users'), list('Roles', 'Role', ShieldCheck, '/settings/roles'), list('Currencies', 'Currency', Banknote, '/setup/currencies')] },
      { label: 'Settings', items: [single('System Settings', 'System Settings', Settings2), single('Global Defaults', 'Global Defaults', SlidersHorizontal), single('Selling Settings', 'Selling Settings', ShoppingCart), single('Buying Settings', 'Buying Settings', ShoppingBag), single('Stock Settings', 'Stock Settings', Boxes), single('Accounts Settings', 'Accounts Settings', Landmark), single('Manufacturing Settings', 'Manufacturing Settings', Factory), single('Print Settings', 'Print Settings', Printer)] },
      { label: 'Automation & Print', items: [list('Authorization Rules', 'Authorization Rule', FileText), list('Email Digests', 'Email Digest', FileText), list('Email Accounts', 'Email Account', FileText), list('Letter Heads', 'Letter Head', FileText), list('Party Types', 'Party Type', FileText), list('Financial Report Templates', 'Financial Report Template', FileText)] },
    ],
  },
];

// ------------------------------------------------------------------ routes

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function moduleRoute(module: Pick<NavModuleConfig, 'id' | 'type'>) {
  return module.type === 'custom' ? `/ngo/${module.id.replace(/^ngo-/, '')}/` : `/${module.id}/`;
}

export function moduleReportsRoute(module: Pick<NavModuleConfig, 'id' | 'type'>) {
  return `${moduleRoute(module)}reports`;
}

export const reportRoute = (name: string) => `/report/${encodeURIComponent(name)}`;
const singleRecord = (doctype: string) => `/record/${encodeURIComponent(doctype)}/${encodeURIComponent(doctype)}`;

/** The route an item opens. */
export function itemRoute(module: NavModuleConfig, item: NavItemConfig) {
  if (item.route) return item.route;
  if (item.report) return reportRoute(item.report);
  if (item.doctype && item.single) return singleRecord(item.doctype);
  if (item.doctype) return `${moduleRoute(module)}${slug(item.label)}`;
  return moduleRoute(module);
}

// ------------------------------------------------------------------ list page titles

/** Friendlier descriptions for list pages; anything missing falls back to the nav label. */
const descriptions: Record<string, string> = {
  Lead: 'Manage qualified demand before it enters the sales pipeline.',
  Opportunity: 'Track active revenue opportunities from qualification to close.',
  Customer: 'Keep customer relationships and account ownership in view.',
  Contact: 'The people connected to your customer and supplier records.',
  Quotation: 'Prepare and track commercial proposals before confirmation.',
  'Sales Order': 'Track committed revenue from confirmation to fulfilment.',
  'Delivery Note': 'Follow outbound shipments and delivery confirmation.',
  'Sales Invoice': 'Invoices raised to customers and their payment status.',
  Supplier: 'Manage supplier relationships and purchasing context.',
  'Material Request': 'Internal requests for stock and procurement.',
  'Purchase Order': 'Keep supplier commitments and incoming stock in view.',
  'Purchase Receipt': 'Goods received against supplier commitments.',
  'Purchase Invoice': 'Supplier invoices awaiting payment or reconciliation.',
  'Journal Entry': 'Manual and system-generated accounting entries.',
  'Payment Entry': 'Incoming and outgoing payments across accounts.',
  Account: 'The financial structure of the company.',
  Item: 'Everything you sell, buy, stock or manufacture.',
  Warehouse: 'Stock locations across the company.',
  'Stock Entry': 'Inventory movements and stock transactions.',
  'Stock Ledger Entry': 'Item-level stock movement and valuation.',
  BOM: 'Components and operations behind manufactured items.',
  'Work Order': 'Production work in progress on the shop floor.',
  Project: 'Delivery commitments and project ownership.',
  Task: 'Work items across every active project.',
  Asset: 'Equipment and fixed assets the business owns.',
  Issue: 'Customer and internal support requests.',
  Employee: 'Your people directory.',
};
const routeDescriptions: Record<string, string> = {
  '/accounts/accounts-receivable': 'Outstanding customer invoices and collection work.',
  '/accounts/accounts-payable': 'Outstanding supplier invoices and payment work.',
};

const configs: Record<string, DocumentListConfig> = {};
// Standard modules register first, so a DocType's canonical list is its ERPNext one.
const byType = [...navigationModules].sort((a, b) => Number(a.type === 'custom') - Number(b.type === 'custom'));
for (const module of byType) {
  for (const section of module.sections) {
    for (const item of section.items) {
      if (!item.doctype || item.single || item.report) continue;
      const route = itemRoute(module, item);
      configs[route] ??= {
        route,
        title: item.label,
        doctype: item.doctype,
        description: item.description || routeDescriptions[route] || descriptions[item.doctype] || '',
      };
    }
  }
}

/** Every configured DocType list route (title + DocType); the router registers these. */
export const documentConfigs: Record<string, DocumentListConfig> = configs;

/** Fixed filters some list routes apply on top of the user's own (e.g. outstanding only). */
export const routeFilters: Record<string, { fieldname: string; operator: string; value: unknown }[]> = {
  '/accounts/accounts-receivable': [{ fieldname: 'outstanding_amount', operator: '>', value: 0 }, { fieldname: 'docstatus', operator: '=', value: 1 }],
  '/accounts/accounts-payable': [{ fieldname: 'outstanding_amount', operator: '>', value: 0 }, { fieldname: 'docstatus', operator: '=', value: 1 }],
};

/** Old routes kept working after the navigation was reorganized. */
export const legacyRedirects: Record<string, string> = {
  '/hr/employees': '/setup/employees',
  '/settings/print-settings': singleRecord('Print Settings'),
};

export const utilityNavigation: NavigationItem[] = [
  { label: 'Preferences', path: '/settings', icon: SlidersHorizontal },
  { label: 'Profile', path: '/profile', icon: UserRound },
];

export const overviewItem: NavigationItem = { label: 'Overview', path: '/', icon: LayoutDashboard };

/** Flat list of every navigable item (for search and breadcrumbs). */
export const allNavigation: (NavigationItem & { moduleId: string })[] = navigationModules.flatMap((module) => module.sections.flatMap((section) => section.items.map((item) => ({
  label: item.label,
  path: itemRoute(module, item),
  icon: item.icon,
  group: section.label,
  doctype: item.doctype,
  moduleId: module.id,
}))));

/** The list route for a DocType: its configured route when there is one, else the generic list. */
export function getDocumentRouteForDocType(doctype: string) {
  return Object.values(documentConfigs).find((config) => config.doctype === doctype)?.route || `/list/${encodeURIComponent(doctype)}`;
}
