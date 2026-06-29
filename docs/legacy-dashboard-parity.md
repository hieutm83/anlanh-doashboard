# Đối chiếu dashboard Apps Script → Supabase

Mỗi menu dưới đây có visual contract riêng trong `legacyDashboardSpecs.ts`; KPI được tính trên toàn bộ khoảng ngày bởi `dashboard_legacy`, còn chart/table chỉ nhận tối đa 500 nhóm đã tổng hợp.

| Nhóm | Màn hình | Thành phần cũ được giữ | Nguồn PostgreSQL |
|---|---|---|---|
| Cửa hàng | Phân tích Doanh thu | 4 KPI, 4 chart, bảng sản phẩm, bảng SKU | `orders`, `order_items`, `dashboard_daily`, `dashboard_province_daily` |
| Cửa hàng | Chi tiết Sản phẩm | 6 chart, bảng chi tiết, popup | `orders`, `order_items`, `products` |
| Cửa hàng | Chi tiết Nguồn | 8 KPI, 3 chart, phễu và bảng | `orders`, `tiktok_product_analysis` khi có dữ liệu |
| Cửa hàng | Phân tích Chi phí | 10 KPI, 4 chart, 2 bảng | Orders, Lookup SKU, Ads, Affiliate, đơn mẫu |
| Quảng cáo | Tổng quan/Sản phẩm/Nguồn | 20 chart, 4 bảng, popup | `tiktok_ad_records` |
| Video | Tổng quan | 12 KPI, 2 chart, 2 bảng, popup | `tiktok_ad_records` |
| KOC | Nguồn/Hoa hồng/Book KOC | KPI, chart, bảng, popup, tạo chiến dịch | Affiliate và các bảng `booking_*` |
| Khách hàng | Chân dung | KPI, heatmap/chart, bản đồ Việt Nam, bảng tỉnh | `orders`, RPC `dashboard_customer_portrait` |
| Planner | Tổng quan/Weekly | KPI, chart, lịch/bảng, thêm task | `planner_tasks` |
| Shopee | 4 dashboard | KPI, 16 chart, 6 bảng | Các bảng fact Shopee khi được import |

Nếu một nguồn chưa được import, dashboard vẫn giữ nguyên bố cục và hiển thị số 0/trạng thái không có dữ liệu thay vì đổi sang layout placeholder.
