import type { KpiValue } from '../types/dashboard';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
export function KpiCard({ label, kpi, currency = false }: { label: string; kpi: KpiValue; currency?: boolean }) {
  const suffix = currency ? ' ₫' : '';
  const positive = (kpi.changePct ?? 0) >= 0;
  return <article className="card min-h-[100px] p-4">
    <span className="block text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">{label}</span><strong className="my-2 block font-display text-2xl font-bold">{number.format(kpi.value)}{suffix}</strong>
    <small className={`rounded-full px-2 py-1 text-[9px] ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{kpi.changePct == null ? '—' : `${positive ? '+' : ''}${kpi.changePct.toFixed(1)}%`} so với kỳ trước</small>
  </article>;
}
