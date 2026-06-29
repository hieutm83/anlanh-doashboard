import type { KpiValue } from '../types/dashboard';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const iconMap: Array<[RegExp, string]> = [
  [/gmv|doanh thu|doanh số|chi phí|hoa hồng/i, '$'],
  [/đơn|book/i, '🛒'],
  [/aov|roi|roas|cpa|ctr|tỷ lệ/i, '↗'],
  [/khách|creator|koc/i, '👥'],
  [/video/i, '▶'],
];

export function KpiCard({ label, kpi, currency = false }: { label: string; kpi: KpiValue; currency?: boolean }) {
  const suffix = currency ? ' đ' : '';
  const positive = (kpi.changePct ?? 0) >= 0;
  const icon = iconMap.find(([pattern]) => pattern.test(label))?.[1] ?? '✓';
  return <article className="kpi-card">
    <div>
      <span>{label}</span>
      <strong>{number.format(kpi.value)}{suffix}</strong>
      <small className={positive ? 'trend-up' : 'trend-down'}>{kpi.changePct == null ? '—' : `${positive ? '↗ +' : '↘ '}${kpi.changePct.toFixed(1)}%`}</small>
    </div>
    <i aria-hidden="true">{icon}</i>
  </article>;
}
