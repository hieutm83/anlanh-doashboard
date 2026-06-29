import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration } from 'chart.js';
import { getDashboardSection, getOverview } from '../api/dashboardApi';
import { KpiCard } from '../components/KpiCard';
import { DateFilter, defaultRange } from '../components/DateFilter';
import { DashboardChart } from '../components/DashboardChart';
import type { DashboardFilters } from '../types/dashboard';

const common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 18, font: { size: 10 } } } } };

export function OverviewPage() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultRange);
  const query = useQuery({ queryKey: ['dashboard', 'overview', filters], queryFn: () => getOverview(filters), staleTime: 5 * 60_000 });
  const products = useQuery({ queryKey: ['dashboard', 'overview-products', filters], queryFn: () => getDashboardSection('products', filters), staleTime: 5 * 60_000 });
  const charts = useMemo(() => {
    const rows = query.data?.series ?? [];
    const labels = rows.map((x) => x.date.slice(8, 10) + '/' + x.date.slice(5, 7));
    const revenueOrders: ChartConfiguration = { type: 'bar', data: { labels, datasets: [
      { type: 'line', label: 'Số lượng đơn hủy', data: rows.map((x) => x.cancelledOrders ?? 0), borderColor: '#ff4148', backgroundColor: '#ff4148', yAxisID: 'y1', tension: .3 },
      { type: 'line', label: 'Số lượng đơn', data: rows.map((x) => x.orders), borderColor: '#00b982', backgroundColor: '#00b982', yAxisID: 'y1', tension: .3 },
      { type: 'bar', label: 'GMV (VNĐ)', data: rows.map((x) => x.revenue), backgroundColor: '#347ff0', borderRadius: 3, yAxisID: 'y' },
    ]}, options: { ...common, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } }, y1: { beginAtZero: true, position: 'right', grid: { display: false } } } } };
    const aov: ChartConfiguration = { type: 'bar', data: { labels, datasets: [{ label: 'AOV (VNĐ)', data: rows.map((x) => x.orders ? x.revenue / x.orders : 0), backgroundColor: '#8150ee', borderRadius: 4 }] }, options: { ...common, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } } } } };
    const customers: ChartConfiguration = { type: 'line', data: { labels, datasets: [
      { label: 'Khách mới', data: rows.map((x) => x.newCustomers ?? 0), borderColor: '#00b982', backgroundColor: '#00b98218', fill: true, tension: .3 },
      { label: 'Khách cũ', data: rows.map((x) => x.repeatCustomers ?? 0), borderColor: '#6774f7', backgroundColor: '#6774f7', tension: .3 },
    ]}, options: { ...common, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } } } } };
    const provinces = query.data?.provinces?.length ? query.data.provinces : [{ name: 'Chưa có dữ liệu', revenue: 1 }];
    const province: ChartConfiguration<'doughnut'> = { type: 'doughnut', data: { labels: provinces.map((x) => x.name), datasets: [{ data: provinces.map((x) => x.revenue), backgroundColor: ['#2f9dde','#ff5b7d','#ff963c','#ffc044','#45b8ad','#8653e7','#aeb4bb','#168dd1','#f3456b','#ff963c'], borderColor: '#fff', borderWidth: 2 }] }, options: { ...common, cutout: '55%' } };
    return { revenueOrders, aov, customers, province };
  }, [query.data]);

  return <>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-2xl font-bold text-[#1a1a1a]">Phân tích Doanh thu</h1><div className="heading-tools"><button className="refresh" onClick={() => query.refetch()}>↻</button><DateFilter value={filters} onChange={setFilters} /></div></header>
    {query.isLoading && <div className="state">Đang tải KPI đã tổng hợp…</div>}
    {query.error && <div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {query.data && <><section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="TỔNG GMV" kpi={query.data.revenue} currency /><KpiCard label="TỔNG ĐƠN HÀNG" kpi={query.data.orders} /><KpiCard label="AOV" kpi={{ value: query.data.orders.value ? query.data.revenue.value / query.data.orders.value : 0, previous: query.data.orders.previous ? query.data.revenue.previous / query.data.orders.previous : 0, changePct: null }} currency /><KpiCard label="TỈ LỆ KHÁCH MUA LẠI" kpi={query.data.repeatRate} /></section>
      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">{[['Số lượng đơn, đơn hủy và GMV',charts.revenueOrders],['AOV theo thời gian',charts.aov],['Khách cũ và khách mới',charts.customers],['Doanh thu theo Tỉnh/Thành phố (Top 10)',charts.province]].map(([title,config])=><article className="card" key={String(title)}><h2 className="mb-4 text-center text-xs font-bold text-slate-700">{String(title)}</h2><DashboardChart config={config as ChartConfiguration} /></article>)}</section>
      {['GMV Theo Sản Phẩm','GMV Theo Phân Loại (SKU)'].map((title) => <article className="card mb-5" key={title}><h2 className="mb-4 text-sm font-bold">{title}</h2><div className="legacy-table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Tổng đơn</th><th>GMV</th><th>AOV</th><th>Tỷ lệ GMV</th></tr></thead><tbody>{(products.data?.rows ?? []).map((row,index) => { const revenue=Number(row.revenue??0); const orders=Number(row.orders??0); return <tr key={index}><td>{String(row.label??'—')}</td><td>{orders.toLocaleString('vi-VN')}</td><td>{revenue.toLocaleString('vi-VN')} ₫</td><td>{(orders?revenue/orders:0).toLocaleString('vi-VN')} ₫</td><td>{query.data?.revenue.value ? (revenue*100/query.data.revenue.value).toFixed(2) : '0'}%</td></tr>})}</tbody></table></div></article>)}
    </>}
  </>;
}
