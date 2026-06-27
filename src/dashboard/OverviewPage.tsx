import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOverview } from '../api/dashboardApi';
import { KpiCard } from '../components/KpiCard';
import { DateFilter } from '../components/DateFilter';
import type { DashboardFilters } from '../types/dashboard';

const today = new Date();
const end = today.toISOString().slice(0, 10);
const startDate = new Date(today); startDate.setDate(today.getDate() - 29);

export function OverviewPage() {
  const [filters, setFilters] = useState<DashboardFilters>({ from: startDate.toISOString().slice(0, 10), to: end, channel: 'all' });
  // Every filter belongs in the key. Revisiting a range within five minutes is a 0-request cache hit.
  const query = useQuery({ queryKey: ['dashboard', 'overview', filters], queryFn: () => getOverview(filters), staleTime: 5 * 60_000 });
  return <>
    <header className="page-heading"><div><p>Tổng quan hoạt động</p><h1>Dashboard kinh doanh</h1></div><DateFilter value={filters} onChange={setFilters} /></header>
    {query.isLoading && <div className="state">Đang tải KPI đã tổng hợp…</div>}
    {query.error && <div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {query.data && <>
      <section className="kpi-grid"><KpiCard label="Doanh thu" kpi={query.data.revenue} currency /><KpiCard label="Đơn hàng" kpi={query.data.orders} /><KpiCard label="Chi phí quảng cáo" kpi={query.data.adSpend} currency /><KpiCard label="ROAS" kpi={query.data.roas} /><KpiCard label="Khách hàng" kpi={query.data.customers} /></section>
      <section className="panel"><div className="panel-title"><div><small>THEO NGÀY</small><h2>Doanh thu và chi phí</h2></div></div>
        <div className="simple-chart">{query.data.series.map((point) => { const max = Math.max(...query.data.series.map((x) => x.revenue), 1); return <div key={point.date} className="chart-column" title={`${point.date}: ${point.revenue.toLocaleString('vi-VN')} ₫`}><i style={{ height: `${Math.max(4, point.revenue / max * 100)}%` }} /><span>{point.date.slice(8)}</span></div>; })}</div>
      </section>
    </>}
  </>;
}
