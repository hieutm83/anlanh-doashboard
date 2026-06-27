import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DatasetType, ImportRow, ParseResult } from '../types';

const key = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const orderAliases: Record<string, string> = {
  'order id': 'order_id', 'ma don hang': 'order_id',
  'created time': 'ordered_at', 'thoi gian tao': 'ordered_at', 'order time': 'ordered_at',
  'order status': 'status', 'trang thai': 'status',
  'customer name': 'customer_name', 'ten khach hang': 'customer_name',
  'province': 'province', 'tinh thanh pho': 'province',
  'gross amount': 'gross_amount', 'tong tien': 'gross_amount',
  'discount amount': 'discount_amount', 'giam gia': 'discount_amount',
  'net gmv': 'net_gmv', 'doanh thu': 'net_gmv', 'channel': 'channel',
};

self.onmessage = async (event: MessageEvent<{ file: File; datasetType: DatasetType }>) => {
  try {
    const file = event.data.file;
    let matrix: unknown[][];
    if (file.name.toLowerCase().endsWith('.csv')) {
      const parsed = Papa.parse<unknown[]>(await file.text(), { skipEmptyLines: true });
      matrix = parsed.data;
    } else {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', dense: true });
      matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null, raw: false });
    }
    const headers = (matrix.shift() ?? []).map((value, index) => String(value ?? `column_${index + 1}`).trim());
    const aliases = event.data.datasetType === 'orders' ? orderAliases : {};
    const rows: ImportRow[] = matrix.map((values) => Object.fromEntries(headers.map((header, index) => [aliases[key(header)] ?? header, values[index] == null ? null : String(values[index]).trim()])));
    const result: ParseResult = { headers, rows, errors: [], totalRows: rows.length };
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
};
