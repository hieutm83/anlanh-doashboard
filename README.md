# Data Dashboard

Bản viết lại của Dashboard dùng React/TypeScript trên GitHub Pages và Supabase/PostgreSQL làm backend.

## Chạy local

1. Tạo Supabase project.
2. Chạy lần lượt các file trong `supabase/migrations` bằng Supabase CLI hoặc SQL editor.
3. Tạo organization và gán user đầu tiên vào `organization_members` với role `admin`.
4. Sao chép `.env.example` thành `.env.local`, điền URL và publishable/anon key.
5. Chạy `npm install` và `npm run dev`.

Ví dụ bootstrap user đầu tiên trong SQL editor (thay các UUID):

```sql
insert into public.organizations(id,name) values ('ORG_UUID','Tên doanh nghiệp');
insert into public.organization_members(organization_id,user_id,role)
values ('ORG_UUID','AUTH_USER_UUID','admin');
```

## Deploy GitHub Pages

- Đưa riêng thư mục này thành repository, hoặc điều chỉnh `working-directory` nếu dùng monorepo.
- Trong repository Variables, tạo `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
- Bật Pages với nguồn `GitHub Actions`.
- Push nhánh `main`; workflow sẽ build và deploy `dist`.

Anon/publishable key không phải secret. Không đưa service-role key vào frontend.

## Import

File được parse trong Web Worker, preview và validate trước khi gửi. File gốc được lưu ở private Storage bucket `imports`; dữ liệu được gửi theo batch 750 dòng với retry và batch idempotency. Hiện adapter canonical đầu tiên dành cho đơn hàng; các dataset còn lại đã có staging/schema và cần map header cụ thể theo chính xác mẫu file thực tế trước khi production import.

## Hiệu năng

- KPI đọc từ `dashboard_daily`, không scan toàn bộ order/ads mỗi lượt mở trang.
- RPC nhận khoảng ngày và kênh.
- Chi tiết dùng cursor pagination, tối đa 200 dòng/request.
- Migration `004_incremental_precompute.sql` xác định chính xác ngày cũ và ngày mới bị import ảnh hưởng, rồi chỉ upsert aggregate của các ngày đó.
- TanStack Query cache mỗi tổ hợp tab/khoảng ngày/bộ lọc trong 5 phút và tự invalidate sau khi `finalize_import` hoàn tất.
- RLS giới hạn dữ liệu theo organization.
