import type { DatasetType, ImportRow, RowError } from './types';

const schemas: Record<DatasetType, { required: string[][] }> = {
  orders: { required: [['order_id', 'order id', 'mã đơn hàng'], ['ordered_at', 'created time', 'thời gian tạo']] },
  ads: { required: [['date', 'ngày'], ['spend', 'cost', 'chi phí']] },
  products: { required: [['product_id', 'id sản phẩm', 'product name', 'tên sản phẩm']] },
  creator_performance: { required: [['creator', 'creator name', 'tên nhà sáng tạo']] },
  videos: { required: [['video_id', 'video id', 'video link']] },
  traffic: { required: [['date', 'ngày'], ['source', 'nguồn lưu lượng']] },
};

const normalized = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function validateHeaders(type: DatasetType, headers: string[]) {
  const keys = headers.map(normalized);
  return schemas[type].required.filter((aliases) => !aliases.some((alias) => keys.includes(normalized(alias)))).map((aliases) => aliases[0]);
}

export function validateRows(rows: ImportRow[], headers: string[]): RowError[] {
  const errors: RowError[] = [];
  rows.forEach((row, index) => {
    if (headers.every((header) => row[header] == null || String(row[header]).trim() === '')) errors.push({ row: index + 2, column: '*', message: 'Dòng trống' });
  });
  return errors;
}
