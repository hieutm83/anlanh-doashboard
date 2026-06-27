import { useState } from 'react';
import { env } from '../config/env';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { OverviewPage } from '../dashboard/OverviewPage';
import { ImportPage } from '../import/ImportPage';
import { supabase } from '../database/supabase';

const groups = [
  ['Tổng quan', 'overview'], ['Doanh thu', 'revenue'], ['Khách hàng', 'customers'], ['Quảng cáo', 'ads'],
  ['KOC & Creator', 'creators'], ['Sản phẩm', 'products'], ['Nguồn', 'sources'], ['Chi phí', 'costs'],
  ['Shopee', 'shopee'], ['Booking', 'booking'], ['Planner', 'planner'], ['Nhập dữ liệu', 'import'],
];

export default function App() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState('overview');
  if (!env.isConfigured) return <main className="state full">Chưa cấu hình Supabase. Sao chép <code>.env.example</code> thành <code>.env.local</code>.</main>;
  if (loading) return <main className="state full">Đang kiểm tra phiên đăng nhập…</main>;
  if (!session) return <LoginPage />;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">D</div><div><strong>Data</strong><span>Dashboard</span></div></div><nav>{groups.map(([label, id]) => <button className={page === id ? 'active' : ''} onClick={() => setPage(id)} key={id}>{label}</button>)}</nav><button className="sign-out" onClick={() => supabase.auth.signOut()}>Đăng xuất</button></aside>
    <main className="content">{page === 'overview' ? <OverviewPage /> : page === 'import' ? <ImportPage /> : <section className="state"><h2>{groups.find((x) => x[1] === page)?.[0]}</h2><p>Module đã được định tuyến; API chuyên biệt sẽ dùng cùng lớp aggregate/RPC.</p></section>}</main></div>;
}
