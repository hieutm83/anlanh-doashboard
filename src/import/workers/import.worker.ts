import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DatasetType, ImportRow, ParseResult } from '../types';

const normalizedKey = (value: unknown) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const valueOf = (row: ImportRow, ...names: string[]) => {
  const wanted = new Set(names.map(normalizedKey));
  const found = Object.entries(row).find(([name]) => wanted.has(normalizedKey(name)));
  return found?.[1] ?? null;
};
const numeric = (value: unknown) => {
  const text = String(value ?? '').trim().replace(/₫/g, '').replace(/\s/g, '');
  if (!text) return 0;
  const normalized = text.includes(',') && text.includes('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const percent = (value: unknown) => numeric(value) / (String(value ?? '').includes('%') ? 100 : 1);
const isoDate = (value: unknown) => {
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T${(match[4] ?? '00').padStart(2, '0')}:${match[5] ?? '00'}:${match[6] ?? '00'}+07:00`;
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}T${(match[4] ?? '00').padStart(2, '0')}:${match[5] ?? '00'}:${match[6] ?? '00'}+07:00`;
  return text;
};
const dateFromFilename = (name: string, type: DatasetType) => {
  if (type === 'ads') return name.match(/(20\d{2})-(\d{2})-(\d{2})(?:\s+00\s*~\s*20\d{2}-\d{2}-\d{2}\s+23)?/i)?.slice(1, 4).join('-') ?? '';
  if (type === 'product_analysis') {
    const match = name.match(/product_list_(20\d{2})(\d{2})(\d{2})/i);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  }
  return '';
};
const matrixRows = (matrix: unknown[][], headerIndex = 0) => {
  const headers = (matrix[headerIndex] ?? []).map((value, index) => String(value ?? '').trim() || `column_${index + 1}`);
  return { headers, rows: matrix.slice(headerIndex + 1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] == null ? null : String(values[index]).trim()]))) as ImportRow[] };
};

function normalizeOrder(raw: ImportRow) {
  const status = String(valueOf(raw, 'Order Status', 'Trạng thái đơn hàng') ?? '');
  const original = numeric(valueOf(raw, 'SKU Unit Original Price'));
  const sellerDiscount = numeric(valueOf(raw, 'SKU Seller Discount'));
  return { ...raw, order_id: String(valueOf(raw, 'Order ID', 'ID đơn hàng') ?? '').replace(/[^a-zA-Z0-9]/g, ''), ordered_at: isoDate(valueOf(raw, 'Created Time', 'Thời gian đã tạo')), status,
    is_cancelled: /hủy|huỷ|cancel/i.test(status), customer_name: String(valueOf(raw, 'Buyer Username') ?? ''), province: String(valueOf(raw, 'Province') ?? ''),
    sku_id: String(valueOf(raw, 'SKU ID', 'ID SKU') ?? ''), seller_sku: String(valueOf(raw, 'Seller SKU') ?? ''), product_name: String(valueOf(raw, 'Product Name', 'Tên sản phẩm') ?? ''),
    quantity: numeric(valueOf(raw, 'Quantity', 'Số lượng')) || 1, sku_unit_original_price: original, sku_seller_discount: sellerDiscount,
    line_gmv: Math.max(0, original - sellerDiscount), channel: 'tiktok', raw_payload: raw } as ImportRow;
}

function normalizeAffiliate(raw: ImportRow) {
  return { ...raw, order_id: String(valueOf(raw, 'ID đơn hàng') ?? '').replace(/[^a-zA-Z0-9]/g, ''), product_external_id: String(valueOf(raw, 'ID sản phẩm') ?? ''),
    product_name: String(valueOf(raw, 'Tên sản phẩm') ?? ''), sku_id: String(valueOf(raw, 'ID SKU') ?? ''), price: numeric(valueOf(raw, 'Giá')),
    payment_amount: numeric(valueOf(raw, 'Payment Amount')), quantity: numeric(valueOf(raw, 'Số lượng')), status: String(valueOf(raw, 'Trạng thái đơn hàng') ?? ''),
    creator_username: String(valueOf(raw, 'Tên người dùng nhà sáng tạo') ?? ''), content_type: String(valueOf(raw, 'Loại nội dung') ?? ''), content_id: String(valueOf(raw, 'Id nội dung') ?? ''),
    estimated_commission_base: numeric(valueOf(raw, 'Cơ sở hoa hồng ước tính')), estimated_standard_commission: numeric(valueOf(raw, 'Thanh toán hoa hồng tiêu chuẩn ước tính')),
    actual_standard_commission: numeric(valueOf(raw, 'Thanh toán hoa hồng thực tế')), estimated_ad_commission: numeric(valueOf(raw, 'Thanh toán hoa hồng Quảng cáo cửa hàng ước tính')),
    actual_ad_commission: numeric(valueOf(raw, 'Thanh toán hoa hồng Quảng cáo cửa hàng thực tế')), created_at: isoDate(valueOf(raw, 'Thời gian đã tạo')), raw_payload: raw } as ImportRow;
}

function normalizeAd(raw: ImportRow, metricDate: string) {
  return { ...raw, metric_date: metricDate, campaign_name: String(valueOf(raw, 'Tên chiến dịch') ?? ''), campaign_id: String(valueOf(raw, 'ID chiến dịch') ?? ''),
    product_external_id: String(valueOf(raw, 'ID sản phẩm') ?? ''), creative_type: String(valueOf(raw, 'Loại nội dung sáng tạo') ?? ''), video_title: String(valueOf(raw, 'Tiêu đề video') ?? ''),
    video_id: String(valueOf(raw, 'ID video') ?? ''), account_name: String(valueOf(raw, 'Tài khoản TikTok') ?? ''), posted_at: isoDate(valueOf(raw, 'Thời gian đăng')),
    status: String(valueOf(raw, 'Trạng thái') ?? ''), authorization_type: String(valueOf(raw, 'Loại ủy quyền') ?? ''), spend: numeric(valueOf(raw, 'Chi phí')),
    orders: numeric(valueOf(raw, 'Số lượng đơn hàng SKU')), cpa: numeric(valueOf(raw, 'Chi phí cho mỗi đơn hàng')), revenue: numeric(valueOf(raw, 'Doanh thu gộp')), roi: numeric(valueOf(raw, 'ROI')),
    impressions: numeric(valueOf(raw, 'Số lượt hiển thị quảng cáo sản phẩm')), clicks: numeric(valueOf(raw, 'Số lượt nhấp vào quảng cáo sản phẩm')),
    ctr: percent(valueOf(raw, 'Tỷ lệ nhấp vào quảng cáo sản phẩm')), conversion_rate: percent(valueOf(raw, 'Tỷ lệ chuyển đổi quảng cáo')),
    view_2s_rate: percent(valueOf(raw, 'Tỷ lệ xem video quảng cáo trong 2 giây')), view_6s_rate: percent(valueOf(raw, 'Tỷ lệ xem video quảng cáo trong 6 giây')),
    view_25_rate: percent(valueOf(raw, 'Tỷ lệ xem 25% thời lượng video quảng cáo')), view_50_rate: percent(valueOf(raw, 'Tỷ lệ xem 50% thời lượng video quảng cáo')),
    view_75_rate: percent(valueOf(raw, 'Tỷ lệ xem 75% thời lượng video quảng cáo')), view_100_rate: percent(valueOf(raw, 'Tỷ lệ xem 100% thời lượng video quảng cáo')), raw_payload: raw } as ImportRow;
}

function hasBillableAdActivity(row: ImportRow) {
  return Number(row.spend ?? 0) !== 0 || Number(row.orders ?? 0) !== 0;
}

function productRows(matrix: unknown[][], metricDate: string) {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => /Tên sản phẩm|ID sản phẩm/i.test(String(cell ?? ''))));
  if (headerIndex < 0) throw new Error('Không tìm thấy dòng tiêu đề sản phẩm.');
  const groupRow = matrix[Math.max(0, headerIndex - 1)] ?? [];
  const headerRow = matrix[headerIndex] ?? [];
  const keys = headerRow.map((header, index) => {
    const group = String(groupRow[index] ?? '').trim();
    const field = String(header ?? '').trim() || `column_${index + 1}`;
    return group && group !== 'Tất cả' ? `${group} > ${field}` : field;
  });
  return { headers: keys, rows: matrix.slice(headerIndex + 1).filter((row) => row.some((value) => String(value ?? '').trim())).map((values) => {
    const raw = Object.fromEntries(keys.map((field, index) => [field, values[index] == null ? null : String(values[index]).trim()])) as ImportRow;
    return { metric_date: metricDate, product_external_id: String(valueOf(raw, 'ID sản phẩm') ?? ''), product_name: String(valueOf(raw, 'Tên sản phẩm') ?? ''), product_status: String(valueOf(raw, 'Trạng thái sản phẩm') ?? ''), raw_payload: raw } as ImportRow;
  }) };
}

self.onmessage = async (event: MessageEvent<{ file: File; datasetType: DatasetType }>) => {
  try {
    const { file, datasetType } = event.data;
    let matrix: unknown[][];
    if (file.name.toLowerCase().endsWith('.csv')) matrix = Papa.parse<unknown[]>(await file.text(), { skipEmptyLines: true }).data;
    else { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', dense: true }); matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null, raw: false }); }
    const metricDate = dateFromFilename(file.name, datasetType);
    if ((datasetType === 'ads' || datasetType === 'product_analysis') && !metricDate) throw new Error(`Tên file không chứa ngày đúng định dạng cho ${datasetType}.`);
    const parsed = datasetType === 'product_analysis' ? productRows(matrix, metricDate) : matrixRows(matrix);
    const normalizedRows = parsed.rows.map((row) => datasetType === 'orders' || datasetType === 'sample_orders' ? normalizeOrder(row) : datasetType === 'affiliate_orders' ? normalizeAffiliate(row) : datasetType === 'ads' ? normalizeAd(row, metricDate) : row);
    const rows = datasetType === 'ads' ? normalizedRows.filter(hasBillableAdActivity) : normalizedRows;
    const result: ParseResult = { headers: parsed.headers, rows, errors: [], totalRows: rows.length, metricDate };
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
};
