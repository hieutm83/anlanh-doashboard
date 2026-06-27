export type DatasetType = 'orders' | 'ads' | 'products' | 'creator_performance' | 'videos' | 'traffic';
export type ImportRow = Record<string, string | number | boolean | null>;
export interface RowError { row: number; column: string; message: string; value?: unknown }
export interface ParseResult { headers: string[]; rows: ImportRow[]; errors: RowError[]; totalRows: number }
