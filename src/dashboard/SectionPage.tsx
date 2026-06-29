import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration, ChartType } from 'chart.js';
import { getDashboardSection } from '../api/dashboardApi';
import { DateFilter, defaultRange } from '../components/DateFilter';
import { DashboardChart } from '../components/DashboardChart';
import { VietnamGeoMap } from '../components/VietnamGeoMap';
import { legacySpecs, type MetricKey } from './legacyDashboardSpecs';
import { exportJson, exportMarkdown } from '../export/download';
import { OperationsEditor } from './OperationsEditor';

type Row = Record<string, string | number | null>;
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const columnLabels: Record<string, string> = {
  label: 'Tên/Nhóm',
  revenue: 'Doanh thu',
  orders: 'Đơn hàng',
  spend: 'Chi phí/Hoa hồng',
  quantity: 'Số lượng',
  customers: 'Khách hàng',
  impressions: 'Hiển thị',
  clicks: 'Lượt nhấp',
  province: 'Tỉnh/Thành',
  date: 'Ngày',
  status: 'Trạng thái',
  priority: 'Ưu tiên',
};
const currencyColumns = new Set(['revenue', 'spend']);
const palette = ['#2563eb', '#16a34a', '#6366f1', '#ea580c', '#ee3444', '#0f766e', '#94a3b8', '#f59e0b', '#0284c7', '#8b5cf6'];

const sum = (rows: Row[], key: MetricKey) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

function kpiValue(rows: Row[], summary: Record<string, number>, metric: MetricKey, ratio?: 'roi' | 'cpa' | 'aov' | 'ctr') {
  const get = (key: MetricKey) => Number(summary[key] ?? sum(rows, key));
  if (!ratio) return get(metric);
  if (ratio === 'roi') return get('spend') ? get('revenue') / get('spend') : 0;
  if (ratio === 'cpa') return get('orders') ? get('spend') / get('orders') : 0;
  if (ratio === 'aov') return get('orders') ? get('revenue') / get('orders') : 0;
  return get('impressions') ? get('clicks') * 100 / get('impressions') : 0;
}

function formatValue(value: string | number | null, key: string) {
  if (value == null || value === '') return '-';
  if (currencyColumns.has(key)) return `${money.format(Number(value))} đ`;
  if (typeof value === 'number') return number.format(value);
  return String(value);
}

function chartConfig(rows: Row[], item: { title: string; metric: MetricKey; secondary?: MetricKey; type?: 'bar' | 'line' | 'doughnut' }): ChartConfiguration {
  const source = rows.length ? rows.slice(0, 10) : [{ label: 'Chưa có dữ liệu' }];
  const labels = source.map((row) => String(row.label ?? row.date ?? 'Khác'));
  const type = (item.type ?? 'bar') as ChartType;

  if (type === 'doughnut') {
    return {
      type: 'doughnut',
      data: { labels, datasets: [{ label: item.title, data: source.map((row) => Number(row[item.metric] ?? 0)), backgroundColor: palette, borderColor: '#fff', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } },
    } as ChartConfiguration;
  }

  const datasets: ChartConfiguration['data']['datasets'] = [{
    label: columnLabels[item.metric] ?? item.metric,
    data: source.map((row) => Number(row[item.metric] ?? 0)),
    borderColor: palette[0],
    backgroundColor: type === 'line' ? '#2563eb22' : palette[0],
    fill: type === 'line',
    tension: 0.3,
    borderRadius: type === 'bar' ? 4 : undefined,
  }];
  if (item.secondary) {
    datasets.push({
      type: 'line',
      label: columnLabels[item.secondary] ?? item.secondary,
      data: source.map((row) => Number(row[item.secondary!] ?? 0)),
      borderColor: palette[1],
      backgroundColor: palette[1],
      tension: 0.3,
      yAxisID: 'y1',
    });
  }

  return {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 10 } } } },
      scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' } }, ...(item.secondary ? { y1: { beginAtZero: true, position: 'right' as const, grid: { display: false } } } : {}) },
    },
  } as ChartConfiguration;
}

export function SectionPage({ section, title, canEdit = false }: { section: string; title: string; canEdit?: boolean }) {
  const spec = legacySpecs[section];
  const [filters, setFilters] = useState(defaultRange);
  const [detail, setDetail] = useState<Row | null>(null);
  const query = useQuery({ queryKey: ['dashboard', section, filters.from, filters.to], queryFn: () => getDashboardSection(section, filters), staleTime: 5 * 60_000 });
  const rows = query.data?.rows ?? [];
  const summary = query.data?.summary ?? {};
  const charts = useMemo(() => spec?.charts.map((item) => chartConfig(rows, item)) ?? [], [rows, spec]);

  if (!spec) return <div className="state error">Chưa định nghĩa dashboard: {section}</div>;

  return <>
    <header className="page-heading">
      <h1>{title}</h1>
      <div className="heading-tools">
        {canEdit && <OperationsEditor section={section} />}
        <button className="export-button" onClick={() => exportJson(`${section}-${filters.from}-${filters.to}`, query.data)}>JSON</button>
        <button className="export-button" onClick={() => exportMarkdown(`${section}-${filters.from}-${filters.to}`, rows)}>MD</button>
        <button className="refresh" onClick={() => query.refetch()}>↻</button>
        <DateFilter value={filters} onChange={setFilters} />
      </div>
    </header>
    {query.isLoading && <div className="state">Đang đọc dữ liệu tổng hợp...</div>}
    {query.error && <div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {!query.isLoading && !query.error && <>
      {spec.kpis.length > 0 && <section className={`legacy-kpis ${spec.kpis.length > 8 ? 'dense' : ''}`}>{spec.kpis.map((item, index) => {
        const value = kpiValue(rows, summary, item.metric, item.ratio);
        const formatted = item.currency ? `${money.format(value)} đ` : item.ratio === 'ctr' ? `${number.format(value)}%` : number.format(value);
        return <article className="legacy-kpi" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <strong>{formatted}</strong>
          <small className={rows.length ? 'trend-up' : 'trend-neutral'}>{rows.length ? `↗ ${rows.length} nhóm dữ liệu` : '— Chưa có dữ liệu'}</small>
        </article>;
      })}</section>}
      {spec.charts.length > 0 && <section className="legacy-chart-grid">{spec.charts.map((item, index) => <article className="legacy-chart-card" key={`${item.title}-${index}`}>
        <h2>{item.title}</h2>
        <div className="legacy-chart-wrap">{item.title.includes('Bản đồ') ? <VietnamGeoMap rows={rows} /> : <DashboardChart config={charts[index]} />}</div>
      </article>)}</section>}
      {spec.tables.map((table, index) => <article className="legacy-table-card" key={`${table.title}-${index}`}>
        <h2>{table.title}</h2>
        <div className="legacy-table-scroll"><table>
          <thead><tr>{table.columns.map((column) => <th key={column}>{columnLabels[column] ?? column}</th>)}<th>Chi tiết</th></tr></thead>
          <tbody>{rows.length ? rows.slice(0, 100).map((row, rowIndex) => <tr key={rowIndex}>
            {table.columns.map((column) => <td key={column}>{formatValue(row[column], column)}</td>)}
            <td><button className="detail-button" onClick={() => setDetail(row)}>Xem</button></td>
          </tr>) : <tr><td colSpan={table.columns.length + 1} className="empty-cell">Không có dữ liệu trong khoảng thời gian đã chọn</td></tr>}</tbody>
        </table></div>
      </article>)}
    </>}
    {detail && <div className="legacy-modal" onClick={() => setDetail(null)}>
      <article onClick={(event) => event.stopPropagation()}>
        <header><h2>Chi tiết: {String(detail.label ?? 'Dữ liệu')}</h2><button onClick={() => setDetail(null)}>×</button></header>
        <div className="detail-grid">{Object.entries(detail).map(([key, value]) => <div key={key}><span>{columnLabels[key] ?? key}</span><b>{formatValue(value, key)}</b></div>)}</div>
      </article>
    </div>}
  </>;
}
