# Hợp đồng tính toán từ hệ thống Apps Script

Tài liệu này là chuẩn đối chiếu khi chuyển các dashboard sang PostgreSQL. Nguồn đã kiểm tra gồm `Code.gs`, `Shopee.gs`, `JS_RenderMain.html`, `JS_ProductSourceCost.html`, `JS_PlannerKoc.html`, `JS_Shopee.html`, `JS_TabsBooking.html` và `JS_Upload.html`.

## Đơn hàng TikTok

- Khóa đơn: `Order ID` sau khi bỏ ký tự không phải chữ/số.
- Ngày: `Created Time`, timezone Việt Nam.
- Hủy: trạng thái chứa `hủy`, `huỷ` hoặc `cancel`.
- GMV dòng: `SKU Unit Original Price - SKU Seller Discount`.
- GMV đơn: tổng GMV dòng của các SKU; đơn hủy và đơn mẫu không vào GMV doanh thu.
- Tổng đơn: số `Order ID` duy nhất không hủy, không phải đơn mẫu.
- AOV: `GMV / tổng đơn`.
- Khách hàng: khóa `Buyer Username + '_' + Province`.
- Khách mua lại: khách có hơn một Order ID trong khoảng lọc.
- Tỷ lệ mua lại: `khách mua lại / tổng khách * 100`.
- Tỉnh/thành: bỏ tiền tố `Tỉnh`, `Thành phố`, `TP.` trước khi nhóm.

## Affiliate/KOC

- Ngày: `Thời gian đã tạo` trong file.
- Khóa chi tiết: Order ID + SKU ID + Content ID.
- Giữ riêng hoa hồng tiêu chuẩn, hoa hồng quảng cáo, ước tính và thực tế.
- `hhThucTe`, `hhAds`, `hhOrg` không được cộng lẫn; dashboard commission chọn đúng trường theo ngữ cảnh.
- Account ID được map qua `account_mappings`; không tìm thấy thì dùng username nguồn.

## Quảng cáo TikTok

- Ngày lấy từ tên file `creative data for product campaigns YYYY-MM-DD 00 ~ YYYY-MM-DD 23`.
- Chi phí: cột K; đơn SKU: L; CPA nguồn: M; doanh thu: N; ROI: O.
- Khi tổng hợp lại: `CPA = SUM(spend) / SUM(orders)`, `ROI = SUM(revenue) / SUM(spend)`; không lấy trung bình CPA/ROI từng dòng.
- CTR: `SUM(clicks) / SUM(impressions)`; CVR: `SUM(orders) / SUM(clicks)`.
- Nguồn: product card nếu loại nội dung là thẻ sản phẩm; Inhouse nếu account thuộc `inhouse_accounts`; còn lại là KOC.
- Product ID được map qua `product_mappings`.

## Phân tích sản phẩm TikTok

- Ngày lấy từ tên `product_list_YYYYMMDD`.
- Header có hai tầng: group ở dòng 3 và metric ở dòng 4.
- Lưu toàn bộ 176 cột theo khóa `group > metric` trong JSONB.
- Chỉ cộng các đại lượng tuyệt đối: GMV, orders, sales, customers, impressions, clicks, ATC.
- AOV khi tổng hợp: `SUM(GMV) / SUM(orders)`.
- CTR khi tổng hợp: `SUM(clicks) / SUM(impressions)`.
- CTOR khi tổng hợp: `SUM(ATC) / SUM(clicks)`.
- Không lấy trung bình đơn giản các tỷ lệ theo ngày/sản phẩm.

## Chi phí

- Doanh số niêm yết SKU: giá Lookup × số đơn SKU; fallback về GMV khi không có giá.
- Phí giao dịch: `GMV * 6%`.
- Hoa hồng nền tảng: `GMV * 11%`.
- Phí xử lý: `orders * 3.000`.
- Voucher Xtra: `GMV * 4%`.
- Chi phí khuyến mãi: `max(0, doanh số niêm yết - GMV)`.
- Chi phí Ads: tổng spend.
- Hoa hồng KOC: tổng hoa hồng thực tế.
- Đơn mẫu: 30.000 × số đơn mẫu duy nhất theo sản phẩm.

## Shopee

- GMV, order và cancellation dedupe theo Order ID.
- Cancel rate: `cancelled / (success + cancelled)`.
- AOV: `GMV / success orders`.
- Net revenue: GMV trừ platform fees và shop subsidies.
- Ads: ROAS `revenue/cost`, ACOS `cost/revenue`, CTR `clicks/impressions`, CR `conversions/clicks`.
- Traffic: bounce rate `bounces/page views`; revenue/confirmed order; confirmed conversion `confirmed orders/product clicks`.

## Nguyên tắc PostgreSQL

- Raw payload luôn được giữ để có thể tái tính.
- KPI tỷ lệ phải tính từ tổng tử số/tổng mẫu số, không cộng hoặc trung bình tỷ lệ tùy tiện.
- Current/previous dùng hai khoảng có cùng số ngày, kỳ trước kết thúc ngay trước kỳ hiện tại.
- Aggregate chỉ rebuild các ngày bị import ảnh hưởng.
