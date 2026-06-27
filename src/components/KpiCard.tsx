import type { KpiValue } from '../types/dashboard';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
export function KpiCard({ label, kpi, currency = false }: { label: string; kpi: KpiValue; currency?: boolean }) {
  const suffix = currency ? ' ₫' : '';
  const positive = (kpi.changePct ?? 0) >= 0;
  return <article className="kpi-card">
    <span>{label}</span><strong>{number.format(kpi.value)}{suffix}</strong>
    <small className={positive ? 'positive' : 'negative'}>{kpi.changePct == null ? '—' : `${positive ? '+' : ''}${kpi.changePct.toFixed(1)}%`} so với kỳ trước</small>
  </article>;
}
