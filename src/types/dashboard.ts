export type DateRange = { from: string; to: string };
export type DashboardFilters = DateRange & { channel?: 'tiktok' | 'shopee' | 'all' };

export interface KpiValue {
  value: number;
  previous: number;
  changePct: number | null;
}

export interface OverviewResult {
  revenue: KpiValue;
  orders: KpiValue;
  adSpend: KpiValue;
  roas: KpiValue;
  customers: KpiValue;
  series: Array<{ date: string; revenue: number; orders: number; adSpend: number }>;
}

export interface PageResult<T> {
  rows: T[];
  nextCursor: string | null;
}
