import { erpnextApi } from '@/services/erpnext-api';

/*
 * Stock overview from modern_erp_ui.api.stock_dashboard.get_stock_overview.
 * The server applies the caller's ERPNext permissions; every section carries its own
 * `error` ("permission" | "failed") so one unreadable DocType only blanks its own card.
 */

export type SectionError = 'permission' | 'failed' | null;
export interface Section<T> { data: T | null; error: SectionError }

export interface StockAlert {
  item_code: string; item_name: string; uom: string; warehouse: string;
  actual_qty: number; projected_qty: number; reorder_level: number; reorder_qty: number;
  status: 'low' | 'out';
  /** Open requests/orders already lift the projected quantity above the reorder level. */
  replenishing: boolean;
}
export interface TopItem { item_code: string; item_name: string; item_group: string | null; uom: string | null; qty: number; value: number }
export interface TrendPoint { date: string; value: number }
/** A current figure and the same figure 30 days ago (from the ledger / creation dates). */
export interface Compared { value: number; value_30d_ago: number }
export type TrendPeriod = '30d' | '12w' | '26w' | '52w';
export interface StockActivity {
  voucher_type: string; voucher_no: string; posting_date: string; posted_at: string;
  party: string | null; qty_in: number; qty_out: number; value_change: number; item_count: number; warehouses: string[];
  first_item: string | null; from_warehouses: string[]; to_warehouses: string[];
}

export interface StockOverview {
  company: string;
  currency: string;
  as_of: string;
  period: string;
  stock_value: Section<Compared>;
  stock_items: Section<Compared>;
  pending_entries: Section<number>;
  low_stock: Section<{ items: StockAlert[]; configured: number }>;
  top_items: Section<TopItem[]>;
  trend: Section<{ points: TrendPoint[]; movement_days: number; opening_value: number; bucket: 'day' | 'week' }>;
  activity: Section<StockActivity[]>;
}

export const stockApi = {
  async overview(options: { company?: string; period?: TrendPeriod } = {}) {
    const response = await erpnextApi.call<StockOverview>('modern_erp_ui.api.stock_dashboard.get_stock_overview', {
      ...(options.company ? { company: options.company } : {}),
      period: options.period ?? '26w',
    });
    return response.message;
  },
};
