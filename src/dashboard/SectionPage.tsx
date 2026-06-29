import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration } from 'chart.js';
import { getDashboardSection } from '../api/dashboardApi';
import { DateFilter, defaultRange } from '../components/DateFilter';
import { DashboardChart } from '../components/DashboardChart';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const labels: Record<string, string> = { label: 'Tên/Nhóm', revenue: 'Doanh thu', orders: 'Đơn hàng', spend: 'Chi phí/Hoa hồng', quantity: 'Số lượng', customers: 'Khách hàng', impressions: 'Lượt hiển thị', clicks: 'Lượt nhấp', province: 'Tỉnh/Thành', date: 'Ngày', status: 'Trạng thái', priority: 'Ưu tiên' };
const numeric = new Set(['revenue','spend','orders','quantity','customers','impressions','clicks']);

export function SectionPage({ section, title }: { section: string; title: string }) {
  const [filters, setFilters] = useState(defaultRange);
  const query = useQuery({ queryKey: ['dashboard', section, filters.from, filters.to], queryFn: () => getDashboardSection(section, filters), staleTime: 5 * 60_000 });
  const rows = query.data?.rows ?? [];
  const chart = useMemo<ChartConfiguration>(() => ({ type: 'bar', data: { labels: rows.slice(0, 12).map((row) => String(row.label ?? row.date ?? '')), datasets: [{ label: rows.some((row) => Number(row.revenue)) ? 'Doanh thu' : 'Chi phí', data: rows.slice(0, 12).map((row) => Number(row.revenue ?? row.spend ?? 0)), backgroundColor: '#347ff0', borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } } }), [rows]);
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => key !== 'sort_order').slice(0, 8) : [];
  return <><header className="page-heading"><h1>{title}</h1><div className="heading-tools"><button className="refresh" onClick={() => query.refetch()}>↻</button><DateFilter value={filters} onChange={setFilters}/></div></header>
    {query.isLoading && <div className="state">Đang đọc dữ liệu tổng hợp…</div>}{query.error && <div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {query.data && <>{rows.length ? <section className="section-grid"><article className="chart-card"><h2>{title}</h2><DashboardChart config={chart}/></article><article className="panel data-table"><table><thead><tr>{columns.map((key) => <th key={key}>{labels[key] ?? key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((key) => <td key={key}>{numeric.has(key) ? money.format(Number(row[key] ?? 0)) : String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></article></section> : <div className="state">Không có dữ liệu trong khoảng thời gian đã chọn.</div>}</>}
  </>;
}
