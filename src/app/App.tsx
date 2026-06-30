import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { env } from '../config/env';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { SectionPage } from '../dashboard/SectionPage';
import { RevenueOverview } from '../dashboard/shop/RevenueOverview';
import { ShopProductDetails } from '../dashboard/shop/ShopProductDetails';
import { ShopSourceDetails } from '../dashboard/shop/ShopSourceDetails';
import { CostAnalysis } from '../dashboard/shop/CostAnalysis';
import { ImportPage } from '../import/ImportPage';
import { supabase } from '../database/supabase';
import { getCurrentRole } from '../api/accountApi';
import { MenuIcon } from '../components/MenuIcon';

type MenuItem = { label: string; id: string };
type MenuGroup = { label: string; icon: string; items: MenuItem[]; staffOnly?: boolean };

const menu: MenuGroup[] = [
  { label: 'CỬA HÀNG', icon: 'store', items: [
    { label: 'Phân tích Doanh thu', id: 'overview' }, { label: 'Chi tiết Sản phẩm', id: 'products' },
    { label: 'Chi tiết Nguồn', id: 'sources' }, { label: 'Phân tích Chi phí', id: 'costs' },
  ]},
  { label: 'QUẢNG CÁO', icon: 'ads', items: [{ label: 'Tổng quan', id: 'ads' }, { label: 'Chi tiết Sản phẩm', id: 'product-ads' }, { label: 'Chi tiết Nguồn', id: 'source-ads' }] },
  { label: 'VIDEO', icon: 'video', items: [{ label: 'Tổng quan', id: 'video' }] },
  { label: 'KOC', icon: 'koc', items: [{ label: 'Nguồn doanh thu', id: 'creators' }, { label: 'Hoa hồng', id: 'commission' }, { label: 'Book KOC', id: 'booking' }] },
  { label: 'KHÁCH HÀNG', icon: 'customers', items: [{ label: 'Chân dung', id: 'customers' }] },
  { label: 'PLANNER', icon: 'planner', items: [{ label: 'Tổng quan', id: 'planner' }, { label: 'Weekly Planner', id: 'weekly' }] },
  { label: 'SHOPEE', icon: 'shopee', items: [{ label: 'Tổng quan', id: 'shopee' }, { label: 'Chi tiết Sản phẩm', id: 'shopee-products' }, { label: 'Quảng cáo', id: 'shopee-ads' }, { label: 'Lưu lượng truy cập', id: 'shopee-traffic' }] },
  { label: 'HỆ THỐNG', icon: 'system', staffOnly: true, items: [{ label: 'Nhập dữ liệu', id: 'import' }] },
];

export default function App() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState('overview');
  const role = useQuery({ queryKey: ['account-role', session?.user.id], queryFn: getCurrentRole, enabled: Boolean(session), staleTime: Infinity });
  if (!env.isConfigured) return <main className="state full">Chưa cấu hình Supabase.</main>;
  if (loading) return <main className="state full">Đang kiểm tra phiên đăng nhập…</main>;
  if (!session) return <LoginPage />;
  const isStaff = role.data === 'admin' || role.data === 'editor';
  const visibleMenu = menu.filter((group) => !group.staffOnly || isStaff);
  const current = visibleMenu.flatMap((group) => group.items).find((item) => item.id === page);
  const shopPages: Record<string, React.ReactNode> = { overview: <RevenueOverview/>, products: <ShopProductDetails/>, sources: <ShopSourceDetails/>, costs: <CostAnalysis/> };
  return <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#f6f7f9] text-[#1a1a1a]">
    <aside className="flex h-full w-[230px] shrink-0 flex-col overflow-y-auto border-r border-[#e8e8e8] bg-white px-3 py-5 max-md:w-[76px] max-md:px-2">
      <div className="mb-7 px-2 font-display text-xl font-extrabold leading-none text-brand max-md:text-center max-md:text-sm">MINHHIEU<small className="mt-1.5 block font-sans text-[8px] font-normal text-slate-500 max-md:hidden">Dashboard · AnlanhFarm</small></div>
      <div className="mb-3 px-2 text-[9px] font-semibold tracking-[.14em] text-slate-400 max-md:hidden">MENU</div>
      <nav className="space-y-4">{visibleMenu.map((group) => <section key={group.label}>
        <h3 className="mb-1.5 flex items-center gap-2 px-2 font-display text-[11px] font-semibold tracking-[.1em] text-slate-500 max-md:justify-center max-md:px-0"><MenuIcon name={group.icon}/><span className="max-md:hidden">{group.label}</span></h3>
        <div className="ml-[17px] space-y-0.5 border-l border-slate-200 pl-1 max-md:ml-0 max-md:border-0 max-md:pl-0">{group.items.map((item) => <button
          className={`w-full rounded-md px-2.5 py-2 text-left text-[11px] transition-colors max-md:px-1 max-md:text-center max-md:text-[9px] ${page === item.id ? 'bg-brand-soft font-semibold text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-brand'}`}
          onClick={() => setPage(item.id)} key={item.id}>{item.label}</button>)}</div>
      </section>)}</nav>
      <button className="mt-auto w-full rounded-md px-3 py-2 text-left text-[11px] text-slate-500 hover:bg-brand-soft hover:text-brand max-md:text-center max-md:text-[9px]" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
    </aside>
    <main className="h-full min-w-0 flex-1 overflow-y-auto p-5 md:p-7 lg:p-8"><div className="mx-auto w-full max-w-[1480px]">{shopPages[page] ?? (page === 'import' && isStaff ? <ImportPage /> : current ? <SectionPage section={page} title={current.label} canEdit={isStaff}/> : null)}</div></main>
  </div>;
}
