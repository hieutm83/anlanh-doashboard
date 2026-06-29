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
    const labels = rows.map((x) => `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`);
    const revenueOrders: ChartConfiguration = { type: 'bar', data: { labels, datasets: [
      { type: 'line', label: 'Số lượng đơn hủy', data: rows.map((x) => x.cancelledOrders ?? 0), borderColor: '#ee3444', backgroundColor: '#ee3444', yAxisID: 'y1', tension: 0.3 },
      { type: 'line', label: 'Số lượng đơn', data: rows.map((x) => x.orders), borderColor: '#16a34a', backgroundColor: '#16a34a', yAxisID: 'y1', tension: 0.3 },
      { type: 'bar', label: 'GMV (VND)', data: rows.map((x) => x.revenue), backgroundColor: '#2563eb', borderRadius: 4, yAxisID: 'y' },
    ] }, options: { ...common, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } }, y1: { beginAtZero: true, position: 'right', grid: { display: false } } } } };
    const aov: ChartConfiguration = { type: 'line', data: { labels, datasets: [{ label: 'AOV (VND)', data: rows.map((x) => x.orders ? x.revenue / x.orders : 0), borderColor: '#6366f1', backgroundColor: '#6366f122', fill: true, tension: 0.3 }] }, options: { ...common, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } } } } };
    const customers: ChartConfiguration = { type: 'line', data: { labels, datasets: [
      { label: 'Khách mới', data: rows.map((x) => x.newCustomers ?? 0), borderColor: '#10b981', backgroundColor: '#10b98118', fill: true, tension: 0.3 },
      { label: 'Khách cũ', data: rows.map((x) => x.repeatCustomers ?? 0), borderColor: '#6366f1', backgroundColor: '#6366f1', tension: 0.3 },
    ] }, options: { ...common, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } } } } };
    const provinces = query.data?.provinces?.length ? query.data.provinces : [{ name: 'Chưa có dữ liệu', revenue: 1 }];
    const province: ChartConfiguration<'doughnut'> = { type: 'doughnut', data: { labels: provinces.map((x) => x.name), datasets: [{ data: provinces.map((x) => x.revenue), backgroundColor: ['#2563eb', '#ee3444', '#ea580c', '#f59e0b', '#16a34a', '#6366f1', '#94a3b8', '#0284c7', '#db2777', '#0f766e'], borderColor: '#fff', borderWidth: 2 }] }, options: { ...common, cutout: '55%' } };
    return { revenueOrders, aov, customers, province };
  }, [query.data]);

  return <>
    <header className="page-heading"><h1>Phân tích Doanh thu</h1><div className="heading-tools"><button className="refresh" onClick={() => query.refetch()}>↻</button><DateFilter value={filters} onChange={setFilters} /></div></header>
    {query.isLoading && <div className="state">Đang tải KPI đã tổng hợp...</div>}
    {query.error && <div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {query.data && <>
      <section className="kpi-grid four">
        <KpiCard label="TỔNG GMV" kpi={query.data.revenue} currency />
        <KpiCard label="TỔNG ĐƠN HÀNG" kpi={query.data.orders} />
        <KpiCard label="AOV" kpi={{ value: query.data.orders.value ? query.data.revenue.value / query.data.orders.value : 0, previous: query.data.orders.previous ? query.data.revenue.previous / query.data.orders.previous : 0, changePct: null }} currency />
        <KpiCard label="TỈ LỆ KHÁCH MUA LẠI" kpi={query.data.repeatRate} />
      </section>
      <section className="chart-grid">
        <article className="chart-card"><h2>Hiệu quả GMV & Đơn hàng</h2><DashboardChart config={charts.revenueOrders} /></article>
        <article className="chart-card"><h2>Biểu đồ AOV</h2><DashboardChart config={charts.aov} /></article>
        <article className="chart-card"><h2>Khách cũ và Khách mới</h2><DashboardChart config={charts.customers} /></article>
        <article className="chart-card"><h2>Doanh thu theo Tỉnh/Thành phố (Top 10)</h2><DashboardChart config={charts.province} /></article>
      </section>
      {['GMV Theo Sản Phẩm', 'GMV Theo Phân Loại (SKU)'].map((title) => <article className="legacy-table-card" key={title}>
        <h2>{title}</h2>
        <div className="legacy-table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Tổng đơn</th><th>GMV</th><th>AOV</th><th>Tỷ lệ GMV</th></tr></thead><tbody>{(products.data?.rows ?? []).map((row, index) => {
          const revenue = Number(row.revenue ?? 0);
          const orders = Number(row.orders ?? 0);
          return <tr key={index}><td>{String(row.label ?? '-')}</td><td>{orders.toLocaleString('vi-VN')}</td><td>{revenue.toLocaleString('vi-VN')} đ</td><td>{(orders ? revenue / orders : 0).toLocaleString('vi-VN')} đ</td><td>{query.data?.revenue.value ? (revenue * 100 / query.data.revenue.value).toFixed(2) : '0'}%</td></tr>;
        })}</tbody></table></div>
      </article>)}
    </>}
  </>;
}
