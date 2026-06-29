import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration } from 'chart.js';
import { getOverview } from '../api/dashboardApi';
import { KpiCard } from '../components/KpiCard';
import { DateFilter, defaultRange } from '../components/DateFilter';
import { DashboardChart } from '../components/DashboardChart';
import type { DashboardFilters } from '../types/dashboard';

const common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 18, font: { size: 10 } } } } };

export function OverviewPage() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultRange);
  const query = useQuery({ queryKey: ['dashboard', 'overview', filters], queryFn: () => getOverview(filters), staleTime: 5 * 60_000 });
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
    <header className="page-heading"><h1>Phân tích Doanh thu</h1><div className="heading-tools"><button className="refresh" onClick={() => query.refetch()}>↻</button><DateFilter value={filters} onChange={setFilters} /></div></header>
    {query.isLoading && <div className="state">Đang tải KPI đã tổng hợp…</div>}
    {query.error && <div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {query.data && <><section className="kpi-grid four"><KpiCard label="TỔNG GMV" kpi={query.data.revenue} currency /><KpiCard label="TỔNG ĐƠN HÀNG" kpi={query.data.orders} /><KpiCard label="AOV" kpi={{ value: query.data.orders.value ? query.data.revenue.value / query.data.orders.value : 0, previous: query.data.orders.previous ? query.data.revenue.previous / query.data.orders.previous : 0, changePct: null }} currency /><KpiCard label="TỈ LỆ KHÁCH MUA LẠI" kpi={query.data.repeatRate} /></section>
      <section className="chart-grid"><article className="chart-card"><h2>Số lượng đơn, đơn hủy và GMV</h2><DashboardChart config={charts.revenueOrders} /></article><article className="chart-card"><h2>AOV theo thời gian</h2><DashboardChart config={charts.aov} /></article><article className="chart-card"><h2>Khách cũ và khách mới</h2><DashboardChart config={charts.customers} /></article><article className="chart-card"><h2>Doanh thu theo Tỉnh/Thành phố (Top 10)</h2><DashboardChart config={charts.province} /></article></section>
    </>}
  </>;
}
