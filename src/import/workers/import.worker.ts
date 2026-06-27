import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DatasetType, ImportRow, ParseResult } from '../types';

const key = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const orderAliases: Record<string, string> = {
  'order id': 'order_id', 'ma don hang': 'order_id',
  'created time': 'ordered_at', 'thoi gian tao': 'ordered_at', 'order time': 'ordered_at',
  'order status': 'status', 'trang thai': 'status',
  'customer name': 'customer_name', 'ten khach hang': 'customer_name',
  'buyer username': 'customer_name',
  'province': 'province', 'tinh thanh pho': 'province',
  'gross amount': 'gross_amount', 'tong tien': 'gross_amount',
  'discount amount': 'discount_amount', 'giam gia': 'discount_amount',
  'net gmv': 'net_gmv', 'doanh thu': 'net_gmv', 'order amount': 'net_gmv', 'channel': 'channel',
};

function isoDate(value: unknown) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (!match) return text;
  const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
  // Source reports use Vietnam local time. Explicit offset makes PostgreSQL parsing deterministic.
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}+07:00`;
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOrder(row: ImportRow): ImportRow {
  const status = String(row.status ?? '').trim();
  row.order_id = String(row.order_id ?? '').replace(/[^a-zA-Z0-9]/g, '');
  row.ordered_at = isoDate(row.ordered_at);
  row.net_gmv = numberValue(row.net_gmv);
  row.gross_amount = numberValue(row.gross_amount ?? row.net_gmv);
  row.discount_amount = numberValue(row.discount_amount);
  row.is_cancelled = /hủy|huỷ|cancel/i.test(status);
  row.channel = 'tiktok';
  return row;
}

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
    const rows: ImportRow[] = matrix.map((values) => {
      const row = Object.fromEntries(headers.map((header, index) => [aliases[key(header)] ?? header, values[index] == null ? null : String(values[index]).trim()]));
      return event.data.datasetType === 'orders' ? normalizeOrder(row) : row;
    });
    const result: ParseResult = { headers, rows, errors: [], totalRows: rows.length };
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
};
