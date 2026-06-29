import type { DatasetType, ImportRow, RowError } from './types';

const schemas: Record<DatasetType, string[]> = {
  orders: ['order_id', 'ordered_at'],
  sample_orders: ['order_id', 'ordered_at'],
  affiliate_orders: ['order_id', 'created_at'],
  ads: ['metric_date', 'campaign_id', 'product_external_id'],
  product_analysis: ['metric_date', 'product_name'],
};

export function validateHeaders(type: DatasetType, _headers: string[], rows: ImportRow[] = []) {
  if (!rows.length) return ['data'];
  return schemas[type].filter((field) => !rows.some((row) => row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== ''));
}

export function validateRows(rows: ImportRow[]): RowError[] {
  const errors: RowError[] = [];
  rows.forEach((row, index) => {
    if (Object.values(row).every((value) => value == null || String(value).trim() === '')) {
      errors.push({ row: index + 2, column: '*', message: 'Dòng trống' });
    }
  });
  return errors;
}
