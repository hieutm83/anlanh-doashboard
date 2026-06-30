import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration, ChartType } from 'chart.js';
import { getDashboardSection } from '../../api/dashboardApi';
import { DateFilter, defaultRange } from '../../components/DateFilter';

export type ShopRow = Record<string, string | number | null>;
export type ShopMetric = 'revenue'|'orders'|'spend'|'quantity'|'customers'|'impressions'|'clicks';
export const formatNumber = (value: unknown) => Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
export const formatMoney = (value: unknown) => `${Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`;
export const total = (rows: ShopRow[], key: ShopMetric) => rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
const palette = ['#347ff0','#00b982','#8150ee','#ff963c','#ff5b7d','#45b8ad','#f5bd3d','#168dd1','#8653e7','#aeb4bb'];

export function useShopSection(section: string) {
  const [filters, setFilters] = useState(defaultRange);
  const query = useQuery({ queryKey: ['dashboard', section, filters.from, filters.to], queryFn: () => getDashboardSection(section, filters), staleTime: 5 * 60_000 });
  return { filters, setFilters, query, rows: query.data?.rows ?? [], summary: query.data?.summary ?? {} };
}

export function ShopHeader({ title, state }: { title: string; state: ReturnType<typeof useShopSection> }) {
  return <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-2xl font-bold">{title}</h1><div className="heading-tools"><button className="refresh" onClick={() => state.query.refetch()}>↻</button><DateFilter value={state.filters} onChange={state.setFilters}/></div></header>;
}

export function ShopState({ state, children }: { state: ReturnType<typeof useShopSection>; children: React.ReactNode }) {
  if (state.query.isLoading) return <div className="state">Đang tải dữ liệu tổng hợp…</div>;
  if (state.query.error) return <div className="state error">Không thể tải dữ liệu: {state.query.error.message}</div>;
  return <>{children}</>;
}

export function useShopChart(rows: ShopRow[], title: string, metric: ShopMetric, type: 'bar'|'line'|'doughnut'='bar', secondary?: ShopMetric) {
  return useMemo<ChartConfiguration>(() => {
    const source = rows.length ? rows.slice(0, 12) : [{ label: 'Chưa có dữ liệu' }];
    const labels = source.map(row => String(row.label ?? row.date ?? 'Khác'));
    const chartType = type as ChartType;
    if (type === 'doughnut') return { type, data: { labels, datasets: [{ label: title, data: source.map(row => Number(row[metric] ?? 0)), backgroundColor: palette, borderColor: '#fff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 9 } } } } } } as ChartConfiguration;
    const datasets: ChartConfiguration['data']['datasets'] = [{ label: title, data: source.map(row => Number(row[metric] ?? 0)), borderColor: palette[0], backgroundColor: type === 'line' ? '#347ff022' : palette[0], fill: type === 'line', tension: .3, borderRadius: type === 'bar' ? 3 : undefined }];
    if (secondary) datasets.push({ type: 'line', label: secondary, data: source.map(row => Number(row[secondary] ?? 0)), borderColor: palette[1], backgroundColor: palette[1], yAxisID: 'y1', tension: .3 });
    return { type: chartType, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 9 } } } }, scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } }, ...(secondary ? { y1: { beginAtZero: true, position: 'right' as const, grid: { display: false } } } : {}) } } } as ChartConfiguration;
  }, [rows, title, metric, type, secondary]);
}

export function EmptyRow({ colSpan }: { colSpan: number }) { return <tr><td colSpan={colSpan} className="empty-cell">Không có dữ liệu trong khoảng thời gian đã chọn</td></tr>; }
