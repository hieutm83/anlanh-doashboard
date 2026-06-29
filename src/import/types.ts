export type DatasetType = 'orders' | 'sample_orders' | 'affiliate_orders' | 'ads' | 'product_analysis';
export type ImportRow = Record<string, string | number | boolean | null | Record<string, unknown>>;
export interface RowError { row: number; column: string; message: string; value?: unknown }
export interface ParseResult { headers: string[]; rows: ImportRow[]; errors: RowError[]; totalRows: number; metricDate?: string }
