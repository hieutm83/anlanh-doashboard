export type MetricKey = 'revenue' | 'orders' | 'spend' | 'quantity' | 'customers' | 'impressions' | 'clicks';
export type LegacySpec = {
  kpis: Array<{ label: string; metric: MetricKey; currency?: boolean; ratio?: 'roi' | 'cpa' | 'aov' | 'ctr' }>;
  charts: Array<{ title: string; metric: MetricKey; secondary?: MetricKey; type?: 'bar' | 'line' | 'doughnut' }>;
  tables: Array<{ title: string; columns: string[] }>;
};

const revenueColumns = ['label', 'orders', 'revenue', 'quantity'];
const adColumns = ['label', 'spend', 'revenue', 'orders', 'impressions', 'clicks'];

export const legacySpecs: Record<string, LegacySpec> = {
  products: {
    kpis: [],
    charts: [
      { title: 'GMV theo Sản phẩm', metric: 'revenue', type: 'doughnut' },
      { title: 'Đơn hàng, CTR & CR theo Sản phẩm', metric: 'orders', secondary: 'revenue' },
      { title: 'Diễn biến GMV', metric: 'revenue', type: 'line' },
      { title: 'Diễn biến Traffic (Lượt xem trang)', metric: 'impressions', type: 'line' },
      { title: 'Diễn biến CTR', metric: 'clicks', type: 'line' },
      { title: 'Diễn biến CR', metric: 'orders', type: 'line' },
    ],
    tables: [{ title: 'Hiệu quả chi tiết theo Sản phẩm (Cửa hàng)', columns: ['label', 'revenue', 'quantity', 'orders', 'impressions', 'clicks'] }],
  },
  sources: {
    kpis: [
      { label: 'Tổng GMV', metric: 'revenue', currency: true },
      { label: 'Đơn hàng', metric: 'orders' },
      { label: 'Số món', metric: 'quantity' },
      { label: 'Khách hàng', metric: 'customers' },
      { label: 'Hiển thị', metric: 'impressions' },
      { label: 'Lượt nhấp', metric: 'clicks' },
      { label: 'Thêm giỏ', metric: 'quantity' },
      { label: 'CTR', metric: 'clicks', ratio: 'ctr' },
    ],
    charts: [
      { title: 'Cơ cấu GMV theo Nguồn', metric: 'revenue', type: 'doughnut' },
      { title: 'GMV, CTR & CTOR theo Nguồn', metric: 'revenue', secondary: 'orders' },
      { title: 'Diễn biến theo Ngày', metric: 'revenue', type: 'line' },
    ],
    tables: [
      { title: 'Phễu chuyển đổi theo nguồn', columns: ['label', 'impressions', 'clicks', 'quantity', 'orders'] },
      { title: 'Hiệu quả chi tiết theo Nguồn', columns: ['label', 'revenue', 'orders', 'quantity', 'customers', 'impressions', 'clicks'] },
      { title: 'Chi tiết Nguồn', columns: revenueColumns },
    ],
  },
  costs: {
    kpis: [
      { label: 'Tổng GMV', metric: 'revenue', currency: true },
      { label: 'Tổng chi phí', metric: 'spend', currency: true },
      { label: 'Lợi nhuận dự kiến', metric: 'revenue', currency: true },
      { label: 'Tỷ lệ chi phí', metric: 'spend' },
      { label: 'Phí cố định', metric: 'spend', currency: true },
      { label: 'Chi phí biến động', metric: 'spend', currency: true },
      { label: 'Chi phí Ads', metric: 'spend', currency: true },
      { label: 'Hoa hồng KOC', metric: 'spend', currency: true },
      { label: 'Chi phí đơn mẫu', metric: 'spend', currency: true },
      { label: 'AOV', metric: 'revenue', ratio: 'aov', currency: true },
    ],
    charts: [
      { title: 'Cơ cấu Chi phí / Doanh số', metric: 'spend', type: 'doughnut' },
      { title: 'Doanh số & Chi phí theo Ngày', metric: 'revenue', secondary: 'spend' },
      { title: 'Chi phí Cố định theo Ngày', metric: 'spend', type: 'line' },
      { title: 'Chi phí Biến động theo Ngày', metric: 'spend', type: 'line' },
    ],
    tables: [
      { title: 'Chi tiết Chi phí Sản phẩm', columns: ['label', 'spend', 'revenue', 'orders'] },
      { title: 'Chi phí theo KOC', columns: ['label', 'spend', 'revenue', 'orders'] },
    ],
  },
  ads: {
    kpis: [
      { label: 'Tổng chi phí', metric: 'spend', currency: true },
      { label: 'Doanh thu quảng cáo', metric: 'revenue', currency: true },
      { label: 'Đơn hàng SKU', metric: 'orders' },
      { label: 'ROI', metric: 'revenue', ratio: 'roi' },
    ],
    charts: [
      { title: 'Hiệu quả GMV và Đơn hàng', metric: 'revenue', secondary: 'orders' },
      { title: 'Chi phí quảng cáo', metric: 'spend', type: 'line' },
      { title: 'Chỉ số ROI', metric: 'revenue', secondary: 'spend', type: 'line' },
      { title: 'Chỉ số CPA', metric: 'spend', secondary: 'orders', type: 'line' },
    ],
    tables: [],
  },
  'product-ads': {
    kpis: [],
    charts: [
      { title: 'Diễn biến GMV theo từng sản phẩm', metric: 'revenue', type: 'line' },
      { title: 'Diễn biến Chi phí theo từng sản phẩm', metric: 'spend', type: 'line' },
      { title: 'Biến động ROI theo từng sản phẩm', metric: 'revenue', secondary: 'spend', type: 'line' },
      { title: 'Biến động CPA theo từng sản phẩm', metric: 'spend', secondary: 'orders', type: 'line' },
      { title: 'Doanh thu và Chi phí', metric: 'revenue', secondary: 'spend' },
      { title: 'ROI theo ngày', metric: 'revenue', secondary: 'spend', type: 'line' },
      { title: 'Phân bổ ngân sách theo Sản phẩm', metric: 'spend', type: 'doughnut' },
      { title: 'Hiệu quả ROI', metric: 'revenue', secondary: 'spend' },
    ],
    tables: [{ title: 'Hiệu quả chi tiết theo Sản phẩm (Seller SKU)', columns: adColumns }],
  },
  'source-ads': {
    kpis: [],
    charts: [
      { title: 'Diễn biến GMV theo Nguồn', metric: 'revenue', type: 'line' },
      { title: 'Diễn biến Chi phí theo Nguồn', metric: 'spend', type: 'line' },
      { title: 'Biến động ROI theo Nguồn', metric: 'revenue', secondary: 'spend', type: 'line' },
      { title: 'Biến động CPA theo Nguồn', metric: 'spend', secondary: 'orders', type: 'line' },
      { title: 'Doanh thu và Chi phí', metric: 'revenue', secondary: 'spend' },
      { title: 'ROI theo ngày', metric: 'revenue', secondary: 'spend', type: 'line' },
      { title: 'Phân bổ ngân sách theo Nguồn', metric: 'spend', type: 'doughnut' },
      { title: 'Hiệu quả CPA', metric: 'spend', secondary: 'orders' },
    ],
    tables: [
      { title: 'Hiệu quả chi tiết theo Nguồn', columns: adColumns },
      { title: 'Hiệu quả Sản phẩm theo Nguồn', columns: adColumns },
      { title: 'Chiến dịch hiệu quả', columns: adColumns },
    ],
  },
  video: {
    kpis: [
      { label: 'Tổng Video', metric: 'quantity' },
      { label: 'Video có đơn', metric: 'orders' },
      { label: 'Tổng GMV', metric: 'revenue', currency: true },
      { label: 'Tổng Đơn', metric: 'orders' },
      { label: 'Tổng chi phí', metric: 'spend', currency: true },
      { label: 'ROI', metric: 'revenue', ratio: 'roi' },
      { label: 'Lượt hiển thị', metric: 'impressions' },
      { label: 'Lượt nhấp', metric: 'clicks' },
      { label: 'CTR', metric: 'clicks', ratio: 'ctr' },
      { label: 'CPA', metric: 'spend', ratio: 'cpa', currency: true },
      { label: 'GMV / Video', metric: 'revenue', currency: true },
      { label: 'Đơn / Video', metric: 'orders' },
    ],
    charts: [
      { title: 'Doanh số theo video', metric: 'revenue', type: 'doughnut' },
      { title: 'Số lượng video và đơn theo thời gian', metric: 'quantity', secondary: 'orders' },
    ],
    tables: [
      { title: 'Chi tiết theo video', columns: adColumns },
      { title: 'Chi tiết video', columns: adColumns },
    ],
  },
  creators: {
    kpis: [
      { label: 'Creators', metric: 'quantity' },
      { label: 'Đơn hàng', metric: 'orders' },
      { label: 'GMV', metric: 'revenue', currency: true },
    ],
    charts: [],
    tables: [
      { title: 'Tổng quan GMV KOC theo Sản phẩm', columns: revenueColumns },
      { title: 'Thống kê Nguồn doanh thu của creator', columns: revenueColumns },
      { title: 'Phân tích hiệu quả KOC theo Sản phẩm', columns: ['label', 'revenue', 'orders', 'quantity', 'spend'] },
    ],
  },
  commission: {
    kpis: [
      { label: 'Tổng GMV KOC', metric: 'revenue', currency: true },
      { label: 'Tổng Đơn', metric: 'orders' },
      { label: 'Hoa hồng', metric: 'spend', currency: true },
      { label: 'Tỷ lệ hoa hồng', metric: 'spend' },
    ],
    charts: [{ title: 'Thống kê hoa hồng ADS và Tự nhiên', metric: 'spend', secondary: 'revenue' }],
    tables: [
      { title: 'Creator - Hoa hồng ADS và Tự nhiên', columns: ['label', 'revenue', 'orders', 'spend'] },
      { title: 'Chi tiết đóng góp Video', columns: ['label', 'revenue', 'orders', 'quantity', 'spend'] },
    ],
  },
  booking: {
    kpis: [
      { label: 'Tổng KOC', metric: 'quantity' },
      { label: 'Đã chốt', metric: 'orders' },
      { label: 'Chờ xử lý', metric: 'customers' },
      { label: 'Đơn Book', metric: 'orders' },
      { label: 'Video đăng', metric: 'quantity' },
      { label: 'Tổng chi phí', metric: 'spend', currency: true },
    ],
    charts: [
      { title: 'KOC liên hệ theo ngày', metric: 'quantity', type: 'line' },
      { title: 'KOC phản hồi theo ngày', metric: 'customers', type: 'line' },
      { title: 'Đơn Book theo ngày', metric: 'orders', type: 'line' },
      { title: 'Video đăng theo ngày', metric: 'quantity', type: 'line' },
      { title: 'Trạng thái KOC', metric: 'orders', type: 'doughnut' },
      { title: 'Nguồn liên hệ', metric: 'quantity', type: 'doughnut' },
    ],
    tables: [
      { title: 'Top KOC', columns: ['label', 'status', 'date', 'spend'] },
      { title: 'Bảng đơn Book', columns: ['label', 'status', 'date', 'spend'] },
      { title: 'Bảng Video', columns: ['label', 'status', 'date'] },
    ],
  },
  customers: {
    kpis: [
      { label: 'Tổng khách hàng', metric: 'customers' },
      { label: 'Tổng đơn hàng', metric: 'orders' },
      { label: 'Tổng GMV', metric: 'revenue', currency: true },
      { label: 'AOV', metric: 'revenue', ratio: 'aov', currency: true },
    ],
    charts: [
      { title: 'Tần suất mua hàng theo Ngày và Giờ', metric: 'orders' },
      { title: 'Phân bố địa lý (Bản đồ)', metric: 'revenue', type: 'doughnut' },
    ],
    tables: [{ title: 'Chi tiết Tỉnh/Thành', columns: ['province', 'label', 'orders', 'revenue'] }],
  },
  planner: {
    kpis: [
      { label: 'Công việc đã thêm', metric: 'quantity' },
      { label: 'Đã hoàn thành', metric: 'orders' },
      { label: 'Điểm hiệu suất', metric: 'customers' },
      { label: 'Tỷ lệ hoàn thành', metric: 'orders' },
    ],
    charts: [
      { title: 'Tỷ lệ hoàn thành công việc theo ngày', metric: 'orders', type: 'line' },
      { title: 'Số lượng công việc theo ngày', metric: 'quantity' },
    ],
    tables: [{ title: 'Lịch hoàn thành công việc', columns: ['date', 'label', 'status', 'priority'] }],
  },
  weekly: {
    kpis: [
      { label: 'Tổng nhiệm vụ', metric: 'quantity' },
      { label: 'Hoàn thành', metric: 'orders' },
      { label: 'Đang làm', metric: 'customers' },
      { label: 'Tiến độ', metric: 'orders' },
    ],
    charts: [
      { title: 'Hoàn thành công việc', metric: 'orders', type: 'doughnut' },
      { title: 'Nhiệm vụ theo ngày', metric: 'quantity' },
    ],
    tables: [
      { title: 'LỊCH BIỂU CÔNG VIỆC', columns: ['date', 'label', 'status', 'priority'] },
      { title: 'Thói quen', columns: ['label', 'status', 'date'] },
      { title: 'Công việc trong ngày', columns: ['label', 'status', 'priority'] },
    ],
  },
  shopee: {
    kpis: [
      { label: 'Tổng GMV', metric: 'revenue', currency: true },
      { label: 'Tổng Đơn hàng', metric: 'orders' },
      { label: 'AOV', metric: 'revenue', ratio: 'aov', currency: true },
      { label: 'Tỷ lệ hủy', metric: 'orders' },
    ],
    charts: [
      { title: 'GMV và Đơn hàng', metric: 'revenue', secondary: 'orders' },
      { title: 'Đơn thành công và đơn hủy', metric: 'orders' },
      { title: 'Chi phí quảng cáo', metric: 'spend', type: 'line' },
      { title: 'GMV theo Tỉnh/Thành', metric: 'revenue', type: 'doughnut' },
    ],
    tables: [
      { title: 'GMV Theo Sản Phẩm', columns: revenueColumns },
      { title: 'GMV Theo Phân Loại (SKU)', columns: revenueColumns },
    ],
  },
  'shopee-products': {
    kpis: [],
    charts: [
      { title: 'GMV theo Sản phẩm', metric: 'revenue', type: 'doughnut' },
      { title: 'Đơn hàng & Tỷ lệ hủy theo Sản phẩm', metric: 'orders' },
      { title: 'Diễn biến GMV', metric: 'revenue', type: 'line' },
      { title: 'Diễn biến Sản lượng', metric: 'quantity', type: 'line' },
      { title: 'Diễn biến AOV', metric: 'revenue', secondary: 'orders', type: 'line' },
      { title: 'Diễn biến Tỷ lệ hủy', metric: 'orders', type: 'line' },
    ],
    tables: [{ title: 'Hiệu quả chi tiết theo Sản phẩm (Shopee)', columns: revenueColumns }],
  },
  'shopee-ads': {
    kpis: [
      { label: 'Chi phí', metric: 'spend', currency: true },
      { label: 'Doanh thu', metric: 'revenue', currency: true },
      { label: 'Đơn hàng', metric: 'orders' },
      { label: 'ROAS', metric: 'revenue', ratio: 'roi' },
    ],
    charts: [
      { title: 'Hiệu quả GMV và Đơn hàng', metric: 'revenue', secondary: 'orders' },
      { title: 'Chi phí quảng cáo', metric: 'spend', type: 'line' },
      { title: 'Chỉ số ROAS', metric: 'revenue', secondary: 'spend', type: 'line' },
      { title: 'Chỉ số CPA', metric: 'spend', secondary: 'orders', type: 'line' },
    ],
    tables: [],
  },
  'shopee-traffic': {
    kpis: [
      { label: 'Lượt hiển thị sản phẩm', metric: 'impressions' },
      { label: 'Lượt nhấp vào sản phẩm', metric: 'clicks' },
      { label: 'Số khách truy cập', metric: 'customers' },
      { label: 'Lượt xem trang', metric: 'impressions' },
      { label: 'CTR', metric: 'clicks', ratio: 'ctr' },
      { label: 'Tỷ lệ chuyển đổi', metric: 'orders' },
      { label: 'Doanh số', metric: 'revenue', currency: true },
      { label: 'Đơn hàng', metric: 'orders' },
      { label: 'Sản phẩm', metric: 'quantity' },
      { label: 'Người mua', metric: 'customers' },
    ],
    charts: [
      { title: 'Tổng quan lưu lượng', metric: 'impressions', secondary: 'clicks' },
      { title: 'Nguồn lưu lượng truy cập', metric: 'revenue', type: 'doughnut' },
    ],
    tables: [
      { title: 'Nguồn lưu lượng của tất cả nguồn', columns: ['label', 'impressions', 'clicks', 'orders', 'revenue'] },
      { title: 'Nguồn lưu lượng theo sản phẩm', columns: ['label', 'impressions', 'clicks', 'orders', 'revenue'] },
      { title: 'Chi tiết doanh số', columns: revenueColumns },
    ],
  },
};
