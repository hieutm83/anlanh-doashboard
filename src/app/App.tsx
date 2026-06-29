import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { env } from '../config/env';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { OverviewPage } from '../dashboard/OverviewPage';
import { SectionPage } from '../dashboard/SectionPage';
import { ImportPage } from '../import/ImportPage';
import { supabase } from '../database/supabase';
import { getCurrentRole } from '../api/accountApi';
import { MenuIcon } from '../components/MenuIcon';

type MenuItem = { label: string; id: string };
type MenuGroup = { label: string; icon: string; items: MenuItem[]; staffOnly?: boolean };

const menu: MenuGroup[] = [
  { label: 'CỬA HÀNG', icon: 'store', items: [
    { label: 'Phân tích Doanh thu', id: 'overview' },
    { label: 'Chi tiết Sản phẩm', id: 'products' },
    { label: 'Chi tiết Nguồn', id: 'sources' },
    { label: 'Phân tích Chi phí', id: 'costs' },
  ] },
  { label: 'QUẢNG CÁO', icon: 'ads', items: [
    { label: 'Tổng quan', id: 'ads' },
    { label: 'Chi tiết Sản phẩm', id: 'product-ads' },
    { label: 'Chi tiết Nguồn', id: 'source-ads' },
  ] },
  { label: 'VIDEO', icon: 'video', items: [{ label: 'Tổng quan', id: 'video' }] },
  { label: 'KOC', icon: 'koc', items: [
    { label: 'Nguồn doanh thu', id: 'creators' },
    { label: 'Hoa hồng', id: 'commission' },
    { label: 'Book KOC', id: 'booking' },
  ] },
  { label: 'KHÁCH HÀNG', icon: 'customers', items: [{ label: 'Chân dung', id: 'customers' }] },
  { label: 'PLANNER', icon: 'planner', items: [
    { label: 'Tổng quan', id: 'planner' },
    { label: 'Weekly Planner', id: 'weekly' },
  ] },
  { label: 'SHOPEE', icon: 'shopee', items: [
    { label: 'Tổng quan', id: 'shopee' },
    { label: 'Chi tiết Sản phẩm', id: 'shopee-products' },
    { label: 'Quảng cáo', id: 'shopee-ads' },
    { label: 'Lưu lượng truy cập', id: 'shopee-traffic' },
  ] },
  { label: 'HỆ THỐNG', icon: 'system', staffOnly: true, items: [{ label: 'Nhập dữ liệu', id: 'import' }] },
];

export default function App() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState('overview');
  const role = useQuery({ queryKey: ['account-role', session?.user.id], queryFn: getCurrentRole, enabled: Boolean(session), staleTime: Infinity });

  if (!env.isConfigured) return <main className="state full">Chưa cấu hình Supabase.</main>;
  if (loading) return <main className="state full">Đang kiểm tra phiên đăng nhập...</main>;
  if (!session) return <LoginPage />;

  const isStaff = role.data === 'admin' || role.data === 'editor';
  const visibleMenu = menu.filter((group) => !group.staffOnly || isStaff);
  const current = visibleMenu.flatMap((group) => group.items).find((item) => item.id === page);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="app-logo">MINHHIEU<small>Dashboard - AnlanhFarm</small></div>
      <div className="menu-caption">MENU</div>
      <nav>{visibleMenu.map((group) => <section className="nav-group" key={group.label}>
        <h3><MenuIcon name={group.icon} />{group.label}</h3>
        <div>{group.items.map((item) => <button className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)} key={item.id}>{item.label}</button>)}</div>
      </section>)}</nav>
      <button className="sign-out" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
    </aside>
    <main className="content">{page === 'overview' ? <OverviewPage /> : page === 'import' && isStaff ? <ImportPage /> : current ? <SectionPage section={page} title={current.label} canEdit={isStaff} /> : null}</main>
  </div>;
}
